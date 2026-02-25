/**
 * Teach Flow Orchestrator — 50-Image Teach Session
 *
 * Primary onboarding: the photographer edits ~50 images while Sophie watches,
 * learns their style, then generates a Soul on completion.
 *
 * State machine:
 *   awaiting_start → watching (1-50) → analyzing → presenting → calibrating → complete
 *
 * Uses LiveObserver for the watching phase, then triggers Soul generation.
 */

import type { TheLabConfig } from "../config/thelab-config.js";
import { LiveObserver } from "../learning/live-observer.js";
import type { ObserverCallbacks } from "../learning/live-observer.js";
import { StyleDatabase } from "../learning/style-db.js";
import { generateSoulData } from "../soul/soul-generator.js";
import { SoulStore } from "../soul/soul-store.js";

export type TeachState =
  | "awaiting_start"
  | "watching"
  | "analyzing"
  | "presenting"
  | "calibrating"
  | "complete";

export interface TeachProgress {
  state: TeachState;
  imagesObserved: number;
  targetImages: number;
  scenariosFound: number;
  soulGenerated: boolean;
}

export interface TeachCallbacks {
  onStateChange?: (state: TeachState, progress: TeachProgress) => void;
  onImageRecorded?: (imageId: string, scenario: string, totalRecorded: number) => void;
  onTeachComplete?: (progress: TeachProgress) => void;
  onError?: (error: string) => void;
}

export class TeachFlow {
  private config: TheLabConfig;
  private styleDbPath: string;
  private callbacks: TeachCallbacks;
  private observer: LiveObserver | null = null;

  private state: TeachState = "awaiting_start";
  private imagesObserved = 0;
  private targetImages: number;
  private scenariosFound = new Set<string>();
  private soulGenerated = false;

  constructor(config: TheLabConfig, styleDbPath: string, callbacks: TeachCallbacks = {}) {
    this.config = config;
    this.styleDbPath = styleDbPath;
    this.callbacks = callbacks;
    this.targetImages = config.teach?.targetImages ?? 50;
  }

  getState(): TeachState {
    return this.state;
  }

  getProgress(): TeachProgress {
    return {
      state: this.state,
      imagesObserved: this.imagesObserved,
      targetImages: this.targetImages,
      scenariosFound: this.scenariosFound.size,
      soulGenerated: this.soulGenerated,
    };
  }

  /**
   * Start the teach session — begins watching the photographer edit.
   */
  start(): void {
    if (this.state !== "awaiting_start") {
      console.warn(`[TeachFlow] Cannot start from state: ${this.state}`);
      return;
    }

    this.setState("watching");
    console.log(`[TeachFlow] Teaching started — watching for ${this.targetImages} image edits`);

    const observerCallbacks: ObserverCallbacks = {
      onEditRecorded: (imageId, scenario, deltaCount) => {
        this.imagesObserved++;
        this.scenariosFound.add(scenario);

        console.log(
          `[TeachFlow] Image ${this.imagesObserved}/${this.targetImages}: ` +
            `${imageId} → ${scenario} (${deltaCount} adjustments)`,
        );

        this.callbacks.onImageRecorded?.(imageId, scenario, this.imagesObserved);

        if (this.imagesObserved >= this.targetImages) {
          void this.completeWatching();
        }
      },
      onImageChanged: (newImageId) => {
        console.log(`[TeachFlow] Photographer moved to: ${newImageId}`);
      },
      onError: (error) => {
        this.callbacks.onError?.(error);
      },
    };

    this.observer = new LiveObserver(
      this.config,
      this.styleDbPath,
      observerCallbacks,
      this.config.learning.observerPollMs,
    );

    this.observer.start();
  }

  /**
   * Pause the teach session (photographer takes a break).
   */
  pause(): void {
    if (this.state !== "watching") {
      return;
    }
    this.observer?.pause();
    console.log(`[TeachFlow] Paused at ${this.imagesObserved}/${this.targetImages}`);
  }

  /**
   * Resume the teach session.
   */
  resume(): void {
    if (this.observer?.getStatus() === "paused") {
      this.observer.resume();
      console.log(`[TeachFlow] Resumed at ${this.imagesObserved}/${this.targetImages}`);
    }
  }

  /**
   * Abort the teach session early.
   */
  async abort(): Promise<void> {
    if (this.observer) {
      await this.observer.stop();
      this.observer = null;
    }
    this.setState("awaiting_start");
    console.log("[TeachFlow] Aborted");
  }

  /**
   * Called when the target number of images has been observed.
   * Transitions through analyzing → presenting → calibrating → complete.
   */
  private async completeWatching(): Promise<void> {
    // Stop the observer
    if (this.observer) {
      await this.observer.stop();
      this.observer = null;
    }

    // Analyzing phase: recompute all profiles
    this.setState("analyzing");
    console.log("[TeachFlow] Analyzing learned edits...");

    const styleDb = new StyleDatabase(this.styleDbPath);
    try {
      const profilesComputed = styleDb.recomputeAllProfiles();
      console.log(`[TeachFlow] Computed ${profilesComputed} scenario profiles`);

      // Presenting phase: generate the Soul
      this.setState("presenting");

      if (this.config.teach?.autoGenerateSoul !== false) {
        console.log("[TeachFlow] Generating Soul...");
        try {
          const soulData = generateSoulData(styleDb);

          if (soulData) {
            const soulStore = new SoulStore();
            await soulStore.saveSoul("default", soulData);
          }

          this.soulGenerated = true;
          console.log("[TeachFlow] Soul generated and saved");
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          console.error("[TeachFlow] Soul generation failed:", msg);
          this.callbacks.onError?.(`Soul generation failed: ${msg}`);
        }
      }

      // Calibrating phase (for future use — auto-tightening profiles)
      this.setState("calibrating");

      // Complete
      this.setState("complete");
      this.callbacks.onTeachComplete?.(this.getProgress());

      console.log(
        `[TeachFlow] Teaching complete! Observed ${this.imagesObserved} images, ` +
          `found ${this.scenariosFound.size} scenarios, ` +
          `Soul: ${this.soulGenerated ? "generated" : "skipped"}`,
      );
    } finally {
      styleDb.close();
    }
  }

  private setState(state: TeachState): void {
    this.state = state;
    this.callbacks.onStateChange?.(state, this.getProgress());
  }
}
