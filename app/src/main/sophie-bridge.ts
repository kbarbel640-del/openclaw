/**
 * Bridge between the Electron main process and Sophie's backend engine.
 *
 * Initializes real backend modules (StyleDatabase, SophieBrain) and
 * delegates all UI requests to them. Reads from the actual style.db
 * and session files on disk.
 */

import fs from "node:fs";
import path from "node:path";
import { DEFAULT_CONFIG } from "../../../src/thelab/config/defaults.js";
import { resolveConfigPaths, type TheLabConfig } from "../../../src/thelab/config/thelab-config.js";
import { StyleDatabase } from "../../../src/thelab/learning/style-db.js";
import { SophieBrain } from "../../../src/thelab/sophie/sophie-brain.js";
import type { SophieBrainDeps } from "../../../src/thelab/sophie/sophie-brain.js";
import type { ActiveSessionState } from "../../../src/thelab/sophie/types.js";

// --- UI-facing interfaces (kept for renderer compatibility) ---

export interface SophieMessageResponse {
  id: string;
  type: "sophie" | "progress" | "flag" | "question";
  content: string;
  timestamp: string;
  data?: Record<string, unknown>;
}

export interface SophieState {
  status: "idle" | "editing" | "learning" | "paused" | "waiting" | "complete";
  sessionProgress?: {
    current: number;
    total: number;
    flagged: number;
    eta: string;
    scenario?: string;
    confidence?: number;
  };
  learningStatus?: {
    catalogPath: string;
    lastIngested: string;
    photosAnalyzed: number;
    scenarioCount: number;
    observing: boolean;
  };
}

export interface ScenarioEntry {
  name: string;
  sampleCount: number;
  confidence: "high" | "good" | "moderate" | "low";
}

export interface ProfileData {
  totalPhotos: number;
  scenarioCount: number;
  scenarios: ScenarioEntry[];
  signatureMoves: Array<{ slider: string; description: string }>;
  correlations: Array<{ pair: string; r: number }>;
  scenarioProfiles: Array<{
    name: string;
    sampleCount: number;
    adjustments: Array<{ slider: string; median: number; deviation: number }>;
  }>;
}

export interface SessionRecord {
  id: string;
  name: string;
  date: string;
  edited: number;
  flagged: number;
  duration: string;
}

// --- Singleton backend instances ---

let config: TheLabConfig;
let styleDb: StyleDatabase | null = null;
let brain: SophieBrain | null = null;
let initError: string | null = null;

/**
 * Initialize the real backend.
 * Called once at app startup. Safe to call multiple times (idempotent).
 */
export function initBridge(): void {
  if (brain) {
    return;
  } // already initialized

  try {
    const baseDir = path.resolve(__dirname, "../../../");
    config = resolveConfigPaths(DEFAULT_CONFIG, baseDir);

    // Ensure data directory exists
    const dataDir = path.dirname(config.learning.styleDbPath);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    // Ensure session directory exists
    if (!fs.existsSync(config.session.sessionDir)) {
      fs.mkdirSync(config.session.sessionDir, { recursive: true });
    }

    styleDb = new StyleDatabase(config.learning.styleDbPath);

    const deps: SophieBrainDeps = {
      styleDb,
      onStartEditing: (params) => {
        console.log("[SophieBridge] Start editing requested:", params);
        // IPC handlers will wire this to a real EditingLoop
      },
      onStopEditing: () => {
        console.log("[SophieBridge] Stop editing requested");
      },
      onPauseEditing: () => {
        console.log("[SophieBridge] Pause editing requested");
      },
      onResumeEditing: () => {
        console.log("[SophieBridge] Resume editing requested");
      },
      onStartLearning: (params) => {
        console.log("[SophieBridge] Start learning requested:", params);
        // IPC handlers will wire this to a real IngestPipeline
      },
      onToggleObservation: (enabled) => {
        console.log(`[SophieBridge] Observation ${enabled ? "enabled" : "disabled"}`);
        // IPC handlers will wire this to a real LiveObserver
      },
      onFlagAction: (imageId, action) => {
        console.log(`[SophieBridge] Flag action: ${action} on ${imageId}`);
      },
    };

    brain = new SophieBrain(deps);
    console.log("[SophieBridge] Backend initialized successfully");
  } catch (err) {
    initError = err instanceof Error ? err.message : String(err);
    console.error("[SophieBridge] Failed to initialize backend:", initError);
  }
}

/**
 * Get the SophieBrain instance for external use (IPC handlers, etc.)
 */
export function getBrain(): SophieBrain | null {
  return brain;
}

/**
 * Get the StyleDatabase instance for external use.
 */
export function getStyleDb(): StyleDatabase | null {
  return styleDb;
}

/**
 * Get the resolved config.
 */
export function getConfig(): TheLabConfig {
  return config;
}

// --- Bridge functions (delegating to real backend) ---

/**
 * Process a user message through SophieBrain and return response(s).
 */
export async function handleSophieMessage(text: string): Promise<SophieMessageResponse> {
  if (!brain || !styleDb) {
    return {
      id: crypto.randomUUID(),
      type: "sophie",
      content: initError
        ? `I'm having trouble starting up: ${initError}. Check that ~/.thelab/ exists and is accessible.`
        : "Still initializing... give me a moment.",
      timestamp: new Date().toISOString(),
    };
  }

  try {
    const responses = await brain.processMessage(text);
    const primary = responses[0];

    if (!primary) {
      return {
        id: crypto.randomUUID(),
        type: "sophie",
        content: "I processed that but didn't generate a response. That shouldn't happen.",
        timestamp: new Date().toISOString(),
      };
    }

    // Map SophieMessage type to bridge type
    const typeMap: Record<string, SophieMessageResponse["type"]> = {
      text: "sophie",
      image_flag: "flag",
      session_card: "sophie",
      progress_update: "progress",
      question_card: "question",
    };

    return {
      id: primary.id,
      type: typeMap[primary.type] ?? "sophie",
      content: primary.content,
      timestamp: primary.timestamp,
      data: primary.metadata,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      id: crypto.randomUUID(),
      type: "sophie",
      content: `Something went wrong: ${msg}`,
      timestamp: new Date().toISOString(),
    };
  }
}

/**
 * Get Sophie's current state for the UI.
 */
export async function getSophieState(): Promise<SophieState> {
  if (!brain || !styleDb) {
    return {
      status: "idle",
      learningStatus: {
        catalogPath: config?.learning?.catalogPath ?? "Not configured",
        lastIngested: "Never",
        photosAnalyzed: 0,
        scenarioCount: 0,
        observing: false,
      },
    };
  }

  const brainState = brain.getState();
  const editCount = styleDb.getEditCount();
  const scenarios = styleDb.listScenarios();
  const lastIngestDate =
    styleDb.getMeta("last_ingest") ?? styleDb.getMeta("last_ingested") ?? "Never";

  // Map brain's active session to UI state
  let status: SophieState["status"] = "idle";
  let sessionProgress: SophieState["sessionProgress"];

  if (brainState.activeSession) {
    const s = brainState.activeSession;
    status = s.status === "paused" ? "paused" : "editing";
    sessionProgress = {
      current: s.completedImages,
      total: s.totalImages,
      flagged: s.flaggedImages,
      eta: estimateEta(s),
      scenario: s.currentScenario,
    };
  } else if (brainState.learningActive) {
    status = "learning";
  } else if (brainState.observing) {
    status = "learning";
  }

  return {
    status,
    sessionProgress,
    learningStatus: {
      catalogPath: config.learning.catalogPath,
      lastIngested: lastIngestDate,
      photosAnalyzed: editCount,
      scenarioCount: scenarios.length,
      observing: brainState.observing,
    },
  };
}

/**
 * Get the photographer's editing profile data for the DNA view.
 */
export async function getProfileData(): Promise<ProfileData> {
  if (!styleDb) {
    return {
      totalPhotos: 0,
      scenarioCount: 0,
      scenarios: [],
      signatureMoves: [],
      correlations: [],
      scenarioProfiles: [],
    };
  }

  const editCount = styleDb.getEditCount();
  const rawScenarios = styleDb.listScenarios();

  // Map scenarios to UI format with confidence levels
  const scenarios: ScenarioEntry[] = rawScenarios.map((s) => ({
    name: s.key.toUpperCase().replace(/::/g, "::"),
    sampleCount: s.sampleCount,
    confidence: sampleCountToConfidence(s.sampleCount),
  }));

  // Build detailed profiles for the top scenarios
  const scenarioProfiles: ProfileData["scenarioProfiles"] = [];
  const allCorrelations: ProfileData["correlations"] = [];
  const signatureTracker = new Map<string, { total: number; count: number }>();

  for (const sc of rawScenarios.slice(0, 10)) {
    const profile = styleDb.getProfile(sc.key);
    if (!profile) {
      continue;
    }

    // Build adjustment list
    const adjustments: Array<{ slider: string; median: number; deviation: number }> = [];
    for (const [control, stats] of Object.entries(profile.adjustments)) {
      if (Math.abs(stats.median) > 0.1) {
        adjustments.push({
          slider: control.toUpperCase(),
          median: stats.median,
          deviation: stats.stdDev,
        });

        // Track for signature moves
        const existing = signatureTracker.get(control) ?? { total: 0, count: 0 };
        existing.total += stats.mean;
        existing.count += 1;
        signatureTracker.set(control, existing);
      }
    }

    adjustments.sort((a, b) => Math.abs(b.median) - Math.abs(a.median));

    scenarioProfiles.push({
      name: sc.key.toUpperCase(),
      sampleCount: sc.sampleCount,
      adjustments: adjustments.slice(0, 8),
    });

    // Collect correlations
    for (const corr of profile.correlations) {
      const suffix = corr.correlation > 0 ? " ↑" : " ↓";
      allCorrelations.push({
        pair: `${corr.controlA.toUpperCase()} ↑ + ${corr.controlB.toUpperCase()}${suffix}`,
        r: corr.correlation,
      });
    }
  }

  // Derive signature moves from cross-scenario patterns
  const signatureMoves: ProfileData["signatureMoves"] = [];
  for (const [control, data] of signatureTracker.entries()) {
    const avg = data.total / data.count;
    if (Math.abs(avg) > 2 && data.count >= 2) {
      const dir = avg > 0 ? "+" : "";
      signatureMoves.push({
        slider: control.toUpperCase(),
        description: `${dir}${avg.toFixed(0)} avg across ${data.count} scenarios`,
      });
    }
  }

  signatureMoves.sort((a, b) => {
    const numA = parseFloat(a.description.match(/[+-]?\d+/)?.[0] ?? "0");
    const numB = parseFloat(b.description.match(/[+-]?\d+/)?.[0] ?? "0");
    return Math.abs(numB) - Math.abs(numA);
  });

  // Deduplicate and sort correlations by strength
  const uniqueCorrelations = allCorrelations
    .filter((c, i, arr) => arr.findIndex((x) => x.pair === c.pair) === i)
    .toSorted((a, b) => Math.abs(b.r) - Math.abs(a.r))
    .slice(0, 10);

  return {
    totalPhotos: editCount,
    scenarioCount: rawScenarios.length,
    scenarios,
    signatureMoves: signatureMoves.slice(0, 6),
    correlations: uniqueCorrelations,
    scenarioProfiles,
  };
}

/**
 * Get real session history from JSONL files on disk.
 */
export async function getSessionHistory(): Promise<SessionRecord[]> {
  const sessionDir = config?.session?.sessionDir;
  if (!sessionDir || !fs.existsSync(sessionDir)) {
    return [];
  }

  try {
    const files = fs.readdirSync(sessionDir).filter((f) => f.endsWith(".jsonl"));
    const records: SessionRecord[] = [];

    for (const file of files.slice(-20).toReversed()) {
      try {
        const content = fs.readFileSync(path.join(sessionDir, file), "utf-8");
        const lines = content.trim().split("\n").filter(Boolean);
        if (lines.length === 0) {
          continue;
        }

        // First line has session metadata
        const first = JSON.parse(lines[0]);
        // Last line has final state
        const last = JSON.parse(lines[lines.length - 1]);

        const startTime = new Date(first.started_at ?? first.timestamp ?? file);
        const endTime =
          lines.length > 1 ? new Date(last.completed_at ?? last.timestamp ?? startTime) : startTime;
        const durationMs = endTime.getTime() - startTime.getTime();
        const durationStr = formatDuration(durationMs);

        records.push({
          id: first.session_id ?? file.replace(".jsonl", ""),
          name: first.film_stock ?? first.session_name ?? file.replace(".jsonl", ""),
          date: startTime.toISOString().split("T")[0],
          edited: last.completed ?? first.total_images ?? 0,
          flagged: last.flagged ?? 0,
          duration: durationStr,
        });
      } catch {
        // Skip malformed session files
      }
    }

    return records;
  } catch {
    return [];
  }
}

/**
 * Clean up resources on app shutdown.
 */
export function destroyBridge(): void {
  if (styleDb) {
    styleDb.close();
    styleDb = null;
  }
  brain = null;
  console.log("[SophieBridge] Backend shutdown complete");
}

// --- Helpers ---

function sampleCountToConfidence(count: number): ScenarioEntry["confidence"] {
  if (count >= 30) {
    return "high";
  }
  if (count >= 15) {
    return "good";
  }
  if (count >= 5) {
    return "moderate";
  }
  return "low";
}

function estimateEta(session: ActiveSessionState): string {
  if (session.completedImages === 0) {
    return "Calculating...";
  }

  const elapsed = Date.now() - new Date(session.startedAt).getTime();
  const avgPerImage = elapsed / session.completedImages;
  const remaining = session.totalImages - session.completedImages;
  const etaMs = avgPerImage * remaining;

  return formatDuration(etaMs);
}

function formatDuration(ms: number): string {
  const minutes = Math.round(ms / 60_000);
  if (minutes < 60) {
    return `${minutes}M`;
  }
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours}H ${mins}M`;
}
