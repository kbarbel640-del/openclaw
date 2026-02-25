/**
 * Feedback Handler — Correction Learning
 *
 * When the photographer corrects an edit Sophie made, the feedback handler:
 *   1. Records the correction in the style DB with source "correction"
 *   2. Tracks repeated corrections per scenario
 *   3. After 3+ identical corrections → auto-tightens the profile
 *   4. Optionally triggers Soul update when significant drift detected
 *
 * This creates a tight feedback loop: Sophie edits → photographer corrects →
 * Sophie immediately improves for that scenario.
 */

import { createHash } from "node:crypto";
import { StyleDatabase } from "../learning/style-db.js";
import type { PhotoEditRecord } from "../learning/style-db.js";
import { generateSoulData } from "../soul/soul-generator.js";
import { SoulStore } from "../soul/soul-store.js";

export interface Correction {
  imageId: string;
  scenarioKey: string;
  /** Map of control name → corrected delta */
  adjustments: Record<string, number>;
  /** What Sophie originally applied */
  originalAdjustments: Record<string, number>;
  timestamp: string;
}

export interface CorrectionPattern {
  scenarioKey: string;
  control: string;
  /** Average correction direction (positive = Sophie under-applies) */
  avgCorrectionDelta: number;
  correctionCount: number;
}

export interface FeedbackCallbacks {
  onCorrectionRecorded?: (correction: Correction, scenarioKey: string) => void;
  onProfileTightened?: (scenarioKey: string, patterns: CorrectionPattern[]) => void;
  onSoulUpdated?: () => void;
}

/** Threshold: after this many identical corrections, auto-tighten the profile */
const AUTO_TIGHTEN_THRESHOLD = 3;

export class FeedbackHandler {
  private styleDb: StyleDatabase;
  private callbacks: FeedbackCallbacks;
  private soulStore: SoulStore;

  /** Track correction patterns: scenarioKey::control → correction deltas */
  private correctionTracker = new Map<string, number[]>();

  constructor(styleDbPath: string, callbacks: FeedbackCallbacks = {}) {
    this.styleDb = new StyleDatabase(styleDbPath);
    this.callbacks = callbacks;
    this.soulStore = new SoulStore();
  }

  /**
   * Record a photographer's correction to an edit Sophie made.
   */
  recordCorrection(correction: Correction): void {
    // Store the corrected edit in the style DB
    const photoHash = createHash("sha256")
      .update(correction.imageId + correction.timestamp)
      .digest("hex")
      .slice(0, 16);

    const record: PhotoEditRecord = {
      photoHash,
      scenarioKey: correction.scenarioKey,
      exifJson: "{}",
      adjustmentsJson: JSON.stringify(correction.adjustments),
      editedAt: correction.timestamp,
      source: "live_observer", // Corrections come from live observation
    };

    this.styleDb.storePhotoEdit(record);

    this.callbacks.onCorrectionRecorded?.(correction, correction.scenarioKey);

    console.log(
      `[FeedbackHandler] Correction recorded: ${correction.imageId} ` +
        `(${Object.keys(correction.adjustments).length} adjustments)`,
    );

    // Track correction patterns
    this.trackPatterns(correction);

    // Check if we should auto-tighten the profile
    const patterns = this.checkAutoTighten(correction.scenarioKey);
    if (patterns.length > 0) {
      this.tightenProfile(correction.scenarioKey, patterns);
    }
  }

  /**
   * Track correction patterns to detect systematic issues.
   */
  private trackPatterns(correction: Correction): void {
    for (const [control, correctedValue] of Object.entries(correction.adjustments)) {
      const originalValue = correction.originalAdjustments[control] ?? 0;
      const delta = correctedValue - originalValue;

      if (Math.abs(delta) < 0.5) {
        continue; // Ignore trivial corrections
      }

      const key = `${correction.scenarioKey}::${control}`;
      const existing = this.correctionTracker.get(key) ?? [];
      existing.push(delta);
      this.correctionTracker.set(key, existing);
    }
  }

  /**
   * Check if any controls in a scenario have enough corrections to auto-tighten.
   */
  private checkAutoTighten(scenarioKey: string): CorrectionPattern[] {
    const patterns: CorrectionPattern[] = [];

    for (const [key, deltas] of this.correctionTracker) {
      if (!key.startsWith(scenarioKey + "::")) {
        continue;
      }

      if (deltas.length < AUTO_TIGHTEN_THRESHOLD) {
        continue;
      }

      // Check if corrections are consistently in the same direction
      const avgDelta = deltas.reduce((a, b) => a + b, 0) / deltas.length;
      const allSameDirection = deltas.every((d) => Math.sign(d) === Math.sign(avgDelta));

      if (allSameDirection && Math.abs(avgDelta) > 1.0) {
        const control = key.split("::").pop() ?? "";
        patterns.push({
          scenarioKey,
          control,
          avgCorrectionDelta: avgDelta,
          correctionCount: deltas.length,
        });
      }
    }

    return patterns;
  }

  /**
   * Auto-tighten a scenario profile based on repeated corrections.
   * Recomputes the profile from all stored edits (including corrections).
   */
  private tightenProfile(scenarioKey: string, patterns: CorrectionPattern[]): void {
    console.log(
      `[FeedbackHandler] Auto-tightening profile "${scenarioKey}" ` +
        `(${patterns.length} consistent corrections detected)`,
    );

    for (const pattern of patterns) {
      console.log(
        `  - ${pattern.control}: avg correction ${pattern.avgCorrectionDelta > 0 ? "+" : ""}${pattern.avgCorrectionDelta.toFixed(1)} ` +
          `(${pattern.correctionCount} times)`,
      );
    }

    // Recompute the profile with the new correction data included
    this.styleDb.recomputeProfile(scenarioKey);

    this.callbacks.onProfileTightened?.(scenarioKey, patterns);

    // Reset the correction tracker for this scenario
    for (const key of this.correctionTracker.keys()) {
      if (key.startsWith(scenarioKey + "::")) {
        this.correctionTracker.delete(key);
      }
    }
  }

  /**
   * Trigger a Soul update when significant style drift is detected.
   * Called externally or after many profile tightenings.
   */
  updateSoul(): void {
    try {
      const soulData = generateSoulData(this.styleDb);

      if (soulData) {
        void this.soulStore.saveSoul("default", soulData);
      }

      console.log("[FeedbackHandler] Soul updated with correction data");
      this.callbacks.onSoulUpdated?.();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[FeedbackHandler] Soul update failed:", msg);
    }
  }

  /**
   * Get accumulated correction patterns for inspection.
   */
  getCorrectionPatterns(): CorrectionPattern[] {
    const patterns: CorrectionPattern[] = [];

    for (const [key, deltas] of this.correctionTracker) {
      const parts = key.split("::");
      const control = parts.pop() ?? "";
      const scenarioKey = parts.join("::");
      const avgDelta = deltas.reduce((a, b) => a + b, 0) / deltas.length;

      patterns.push({
        scenarioKey,
        control,
        avgCorrectionDelta: avgDelta,
        correctionCount: deltas.length,
      });
    }

    return patterns.toSorted((a, b) => b.correctionCount - a.correctionCount);
  }

  close(): void {
    this.styleDb.close();
  }
}
