import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import type { SceneClassification } from "./scene-classifier.js";
import { scenarioKey, scenarioLabel } from "./scene-classifier.js";

/**
 * A per-scenario editing profile: statistical summary of what the
 * photographer typically does for this type of photo.
 */
export interface ScenarioProfile {
  scenarioKey: string;
  scenarioLabel: string;
  sampleCount: number;
  lastUpdated: string;
  adjustments: Record<string, AdjustmentStats>;
  correlations: SliderCorrelation[];
}

/**
 * Tracks how two sliders move together in a photographer's edits.
 * Positive correlation: when one goes up, the other goes up.
 * Negative correlation: when one goes up, the other goes down.
 */
export interface SliderCorrelation {
  controlA: string;
  controlB: string;
  correlation: number;
  sampleCount: number;
}

/**
 * Statistical distribution of a single slider adjustment across
 * all photos in a scenario.
 */
export interface AdjustmentStats {
  control: string;
  mean: number;
  median: number;
  stdDev: number;
  min: number;
  max: number;
  sampleCount: number;
}

/**
 * A single photo edit record stored in the database.
 */
export interface PhotoEditRecord {
  photoHash: string;
  scenarioKey: string;
  exifJson: string;
  adjustmentsJson: string;
  editedAt: string;
  source: "catalog" | "live_observer";
}

const SCHEMA_SQL = `
  CREATE TABLE IF NOT EXISTS scenarios (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    scenario_key TEXT UNIQUE NOT NULL,
    label TEXT NOT NULL,
    description TEXT,
    parent_key TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS photo_edits (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    photo_hash TEXT NOT NULL,
    scenario_key TEXT NOT NULL,
    exif_json TEXT,
    adjustments_json TEXT NOT NULL,
    edited_at TEXT NOT NULL,
    source TEXT NOT NULL DEFAULT 'catalog',
    ingested_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (scenario_key) REFERENCES scenarios(scenario_key)
  );

  CREATE INDEX IF NOT EXISTS idx_photo_edits_scenario
    ON photo_edits(scenario_key);
  CREATE INDEX IF NOT EXISTS idx_photo_edits_edited_at
    ON photo_edits(edited_at);
  CREATE INDEX IF NOT EXISTS idx_photo_edits_hash
    ON photo_edits(photo_hash);

  CREATE TABLE IF NOT EXISTS scenario_profiles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    scenario_key TEXT NOT NULL,
    control_name TEXT NOT NULL,
    mean_delta REAL NOT NULL,
    median_delta REAL NOT NULL,
    std_dev REAL NOT NULL,
    min_delta REAL NOT NULL,
    max_delta REAL NOT NULL,
    sample_count INTEGER NOT NULL,
    last_updated TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(scenario_key, control_name),
    FOREIGN KEY (scenario_key) REFERENCES scenarios(scenario_key)
  );

  CREATE INDEX IF NOT EXISTS idx_scenario_profiles_key
    ON scenario_profiles(scenario_key);

  CREATE TABLE IF NOT EXISTS slider_correlations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    scenario_key TEXT NOT NULL,
    control_a TEXT NOT NULL,
    control_b TEXT NOT NULL,
    correlation REAL NOT NULL,
    sample_count INTEGER NOT NULL,
    last_updated TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(scenario_key, control_a, control_b),
    FOREIGN KEY (scenario_key) REFERENCES scenarios(scenario_key)
  );

  CREATE INDEX IF NOT EXISTS idx_correlations_key
    ON slider_correlations(scenario_key);

  CREATE TABLE IF NOT EXISTS meta (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );
`;

/**
 * SQLite database storing the photographer's learned editing patterns.
 *
 * Stores individual photo edits tagged by scenario, and computes
 * per-scenario statistical profiles (mean, median, std dev) for
 * each Lightroom slider.
 */
export class StyleDatabase {
  private db: InstanceType<typeof DatabaseSync>;
  private dbPath: string;

  constructor(dbPath: string) {
    this.dbPath = dbPath;
    const dir = path.dirname(dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    this.db = new DatabaseSync(dbPath);
    this.initSchema();
  }

  private initSchema(): void {
    this.db.exec(SCHEMA_SQL);
    this.setMeta("schema_version", "1");
  }

  close(): void {
    this.db.close();
  }

  // --- Scenario management ---

  ensureScenario(classification: SceneClassification): string {
    const key = scenarioKey(classification);
    const label = scenarioLabel(classification);

    const existing = this.db.prepare("SELECT id FROM scenarios WHERE scenario_key = ?").get(key) as
      | { id: number }
      | undefined;

    if (!existing) {
      this.db.prepare("INSERT INTO scenarios (scenario_key, label) VALUES (?, ?)").run(key, label);
    }

    return key;
  }

  listScenarios(): Array<{ key: string; label: string; sampleCount: number }> {
    const rows = this.db
      .prepare(
        `SELECT s.scenario_key, s.label,
                COUNT(pe.id) as sample_count
         FROM scenarios s
         LEFT JOIN photo_edits pe ON s.scenario_key = pe.scenario_key
         GROUP BY s.scenario_key
         ORDER BY sample_count DESC`,
      )
      .all() as Array<{ scenario_key: string; label: string; sample_count: number }>;

    return rows.map((r) => ({
      key: r.scenario_key,
      label: r.label,
      sampleCount: r.sample_count,
    }));
  }

  // --- Photo edit storage ---

  /**
   * Store a single photo's edit data, tagged with its scenario.
   */
  storePhotoEdit(record: PhotoEditRecord): void {
    this.db
      .prepare(
        `INSERT INTO photo_edits
         (photo_hash, scenario_key, exif_json, adjustments_json, edited_at, source)
         VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .run(
        record.photoHash,
        record.scenarioKey,
        record.exifJson,
        record.adjustmentsJson,
        record.editedAt,
        record.source,
      );
  }

  /**
   * Store a batch of photo edits in a single transaction.
   */
  storePhotoEditBatch(records: PhotoEditRecord[]): number {
    const insert = this.db.prepare(
      `INSERT INTO photo_edits
       (photo_hash, scenario_key, exif_json, adjustments_json, edited_at, source)
       VALUES (?, ?, ?, ?, ?, ?)`,
    );

    let count = 0;
    this.db.exec("BEGIN TRANSACTION");
    try {
      for (const r of records) {
        insert.run(r.photoHash, r.scenarioKey, r.exifJson, r.adjustmentsJson, r.editedAt, r.source);
        count++;
      }
      this.db.exec("COMMIT");
    } catch (err) {
      this.db.exec("ROLLBACK");
      throw err;
    }

    return count;
  }

  getEditCount(): number {
    const row = this.db.prepare("SELECT COUNT(*) as cnt FROM photo_edits").get() as { cnt: number };
    return row.cnt;
  }

  // --- Profile computation ---

  /**
   * Recompute the statistical profile for a specific scenario
   * from all stored photo edits in that scenario.
   */
  recomputeProfile(scenarioKeyStr: string): ScenarioProfile | null {
    const edits = this.db
      .prepare(
        "SELECT adjustments_json, edited_at FROM photo_edits WHERE scenario_key = ? ORDER BY edited_at DESC",
      )
      .all(scenarioKeyStr) as Array<{ adjustments_json: string; edited_at: string }>;

    if (edits.length === 0) {
      return null;
    }

    const allAdjustments: Record<string, number[]> = {};

    for (const edit of edits) {
      try {
        const adj = JSON.parse(edit.adjustments_json) as Record<string, number>;
        for (const [control, value] of Object.entries(adj)) {
          if (typeof value !== "number") {
            continue;
          }
          if (!allAdjustments[control]) {
            allAdjustments[control] = [];
          }
          allAdjustments[control].push(value);
        }
      } catch {
        continue;
      }
    }

    const adjustmentStats: Record<string, AdjustmentStats> = {};

    // Clear old profile entries
    this.db.prepare("DELETE FROM scenario_profiles WHERE scenario_key = ?").run(scenarioKeyStr);

    const insertProfile = this.db.prepare(
      `INSERT OR REPLACE INTO scenario_profiles
       (scenario_key, control_name, mean_delta, median_delta, std_dev, min_delta, max_delta, sample_count)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    );

    this.db.exec("BEGIN TRANSACTION");
    try {
      for (const [control, values] of Object.entries(allAdjustments)) {
        if (values.length === 0) {
          continue;
        }

        const stats = computeStats(values);
        adjustmentStats[control] = {
          control,
          ...stats,
          sampleCount: values.length,
        };

        insertProfile.run(
          scenarioKeyStr,
          control,
          stats.mean,
          stats.median,
          stats.stdDev,
          stats.min,
          stats.max,
          values.length,
        );
      }
      this.db.exec("COMMIT");
    } catch (err) {
      this.db.exec("ROLLBACK");
      throw err;
    }

    // Compute slider correlations
    const correlations = this.computeCorrelations(scenarioKeyStr, allAdjustments);

    const scenarioRow = this.db
      .prepare("SELECT label FROM scenarios WHERE scenario_key = ?")
      .get(scenarioKeyStr) as { label: string } | undefined;

    return {
      scenarioKey: scenarioKeyStr,
      scenarioLabel: scenarioRow?.label ?? scenarioKeyStr,
      sampleCount: edits.length,
      lastUpdated: new Date().toISOString(),
      adjustments: adjustmentStats,
      correlations,
    };
  }

  /**
   * Compute Pearson correlations between all slider pairs that have
   * enough data. Stores strong correlations (|r| > 0.3) in the database.
   */
  private computeCorrelations(
    scenarioKeyStr: string,
    allAdjustments: Record<string, number[]>,
  ): SliderCorrelation[] {
    const controls = Object.keys(allAdjustments).filter((k) => allAdjustments[k].length >= 5);
    const correlations: SliderCorrelation[] = [];

    this.db.prepare("DELETE FROM slider_correlations WHERE scenario_key = ?").run(scenarioKeyStr);

    const insertCorr = this.db.prepare(
      `INSERT OR REPLACE INTO slider_correlations
       (scenario_key, control_a, control_b, correlation, sample_count)
       VALUES (?, ?, ?, ?, ?)`,
    );

    this.db.exec("BEGIN TRANSACTION");
    try {
      for (let i = 0; i < controls.length; i++) {
        for (let j = i + 1; j < controls.length; j++) {
          const a = allAdjustments[controls[i]];
          const b = allAdjustments[controls[j]];
          const n = Math.min(a.length, b.length);
          if (n < 5) {
            continue;
          }

          const r = pearsonCorrelation(a.slice(0, n), b.slice(0, n));
          if (Math.abs(r) < 0.3) {
            continue;
          }

          correlations.push({
            controlA: controls[i],
            controlB: controls[j],
            correlation: r,
            sampleCount: n,
          });

          insertCorr.run(scenarioKeyStr, controls[i], controls[j], r, n);
        }
      }
      this.db.exec("COMMIT");
    } catch (err) {
      this.db.exec("ROLLBACK");
      throw err;
    }

    correlations.sort((a, b) => Math.abs(b.correlation) - Math.abs(a.correlation));
    return correlations;
  }

  /**
   * Recompute profiles for ALL scenarios.
   */
  recomputeAllProfiles(): number {
    const scenarios = this.db
      .prepare("SELECT DISTINCT scenario_key FROM photo_edits")
      .all() as Array<{ scenario_key: string }>;

    let computed = 0;
    for (const { scenario_key } of scenarios) {
      const profile = this.recomputeProfile(scenario_key);
      if (profile) {
        computed++;
      }
    }
    return computed;
  }

  /**
   * Look up the editing profile for a given scenario.
   * Returns the mean adjustment deltas the photographer typically applies.
   */
  getProfile(scenarioKeyStr: string): ScenarioProfile | null {
    const rows = this.db
      .prepare(
        `SELECT sp.control_name, sp.mean_delta, sp.median_delta,
                sp.std_dev, sp.min_delta, sp.max_delta, sp.sample_count,
                sp.last_updated
         FROM scenario_profiles sp
         WHERE sp.scenario_key = ?`,
      )
      .all(scenarioKeyStr) as Array<{
      control_name: string;
      mean_delta: number;
      median_delta: number;
      std_dev: number;
      min_delta: number;
      max_delta: number;
      sample_count: number;
      last_updated: string;
    }>;

    if (rows.length === 0) {
      return null;
    }

    const adjustments: Record<string, AdjustmentStats> = {};
    let totalSamples = 0;
    let lastUpdated = "";

    for (const row of rows) {
      adjustments[row.control_name] = {
        control: row.control_name,
        mean: row.mean_delta,
        median: row.median_delta,
        stdDev: row.std_dev,
        min: row.min_delta,
        max: row.max_delta,
        sampleCount: row.sample_count,
      };
      totalSamples = Math.max(totalSamples, row.sample_count);
      if (row.last_updated > lastUpdated) {
        lastUpdated = row.last_updated;
      }
    }

    // Load correlations
    const corrRows = this.db
      .prepare(
        `SELECT control_a, control_b, correlation, sample_count
         FROM slider_correlations
         WHERE scenario_key = ?
         ORDER BY ABS(correlation) DESC`,
      )
      .all(scenarioKeyStr) as Array<{
      control_a: string;
      control_b: string;
      correlation: number;
      sample_count: number;
    }>;

    const correlations: SliderCorrelation[] = corrRows.map((r) => ({
      controlA: r.control_a,
      controlB: r.control_b,
      correlation: r.correlation,
      sampleCount: r.sample_count,
    }));

    const scenarioRow = this.db
      .prepare("SELECT label FROM scenarios WHERE scenario_key = ?")
      .get(scenarioKeyStr) as { label: string } | undefined;

    return {
      scenarioKey: scenarioKeyStr,
      scenarioLabel: scenarioRow?.label ?? scenarioKeyStr,
      sampleCount: totalSamples,
      lastUpdated,
      adjustments,
      correlations,
    };
  }

  /**
   * Find the closest matching scenario profile when an exact match
   * doesn't exist. Falls back to broader categories.
   */
  findClosestProfile(classification: SceneClassification): ScenarioProfile | null {
    const key = scenarioKey(classification);

    // Try exact match first
    const exact = this.getProfile(key);
    if (exact && exact.sampleCount >= 3) {
      return exact;
    }

    // Fall back to broader matches by dropping specificity
    const fallbacks = this.generateFallbackKeys(classification);
    for (const fallbackKey of fallbacks) {
      const profile = this.getProfile(fallbackKey);
      if (profile && profile.sampleCount >= 3) {
        return profile;
      }
    }

    // Last resort: find the scenario with the most samples
    const bestRow = this.db
      .prepare(
        `SELECT scenario_key, COUNT(*) as cnt
         FROM photo_edits
         GROUP BY scenario_key
         ORDER BY cnt DESC
         LIMIT 1`,
      )
      .get() as { scenario_key: string; cnt: number } | undefined;

    if (bestRow) {
      return this.getProfile(bestRow.scenario_key);
    }

    return null;
  }

  /**
   * Generate fallback scenario keys by progressively dropping
   * the most specific classification dimensions.
   */
  private generateFallbackKeys(c: SceneClassification): string[] {
    const keys: string[] = [];

    // Drop special
    keys.push([c.timeOfDay, c.location, c.lighting, c.subject].join("::"));
    // Drop subject
    keys.push([c.timeOfDay, c.location, c.lighting, "unknown"].join("::"));
    // Drop lighting
    keys.push([c.timeOfDay, c.location, "unknown", "unknown"].join("::"));
    // Drop location
    keys.push([c.timeOfDay, "unknown", "unknown", "unknown"].join("::"));
    // Just time of day
    keys.push(["unknown", c.location, "unknown", "unknown"].join("::"));

    return keys;
  }

  // --- Metadata ---

  setMeta(key: string, value: string): void {
    this.db.prepare("INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)").run(key, value);
  }

  getMeta(key: string): string | null {
    const row = this.db.prepare("SELECT value FROM meta WHERE key = ?").get(key) as
      | { value: string }
      | undefined;
    return row?.value ?? null;
  }
}

// --- Statistics helpers ---

/**
 * Pearson correlation coefficient between two arrays of equal length.
 * Returns a value between -1 (perfect negative) and +1 (perfect positive).
 */
function pearsonCorrelation(x: number[], y: number[]): number {
  const n = x.length;
  if (n < 2) {
    return 0;
  }

  let sumX = 0,
    sumY = 0,
    sumXY = 0,
    sumX2 = 0,
    sumY2 = 0;
  for (let i = 0; i < n; i++) {
    sumX += x[i];
    sumY += y[i];
    sumXY += x[i] * y[i];
    sumX2 += x[i] * x[i];
    sumY2 += y[i] * y[i];
  }

  const numerator = n * sumXY - sumX * sumY;
  const denominator = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));

  if (denominator === 0) {
    return 0;
  }
  return numerator / denominator;
}

function computeStats(values: number[]): {
  mean: number;
  median: number;
  stdDev: number;
  min: number;
  max: number;
} {
  const n = values.length;
  if (n === 0) {
    return { mean: 0, median: 0, stdDev: 0, min: 0, max: 0 };
  }

  const sorted = [...values].toSorted((a, b) => a - b);
  const sum = values.reduce((a, b) => a + b, 0);
  const mean = sum / n;

  const median = n % 2 === 0 ? (sorted[n / 2 - 1] + sorted[n / 2]) / 2 : sorted[Math.floor(n / 2)];

  const variance = values.reduce((acc, v) => acc + (v - mean) ** 2, 0) / n;
  const stdDev = Math.sqrt(variance);

  return {
    mean,
    median,
    stdDev,
    min: sorted[0],
    max: sorted[n - 1],
  };
}
