import fs from "node:fs";
import path from "node:path";
import type { TheLabConfig } from "../config/thelab-config.js";
import { extractFullExif } from "../exif/exif-reader.js";
import type { CatalogExifData } from "../learning/catalog-ingester.js";
import { SceneClassifier, scenarioKey, scenarioLabel } from "../learning/scene-classifier.js";
import type { SceneClassification } from "../learning/scene-classifier.js";
import { StyleDatabase } from "../learning/style-db.js";
import type { ScenarioProfile, AdjustmentStats } from "../learning/style-db.js";
import { LightroomController } from "../lightroom/controller.js";
import { SessionStore } from "../session/session-store.js";
import { SoulStore } from "../soul/soul-store.js";
import type {
  ImageAnalysisResultType,
  VerificationResultType,
  AdjustmentEntryType,
} from "../vision/schema.js";
import { VisionTool } from "../vision/vision-tool.js";
import { classifyScreenshot, vlmConfigFromLabConfig } from "../vision/vlm-adapter.js";
import type { VlmAdapterConfig } from "../vision/vlm-adapter.js";
import { evaluateGate, filterConfidentAdjustments } from "./gate.js";
import { ImageQueue } from "./queue.js";

export interface EditingLoopCallbacks {
  onImageStart?: (imageId: string, index: number, total: number) => void;
  onImageClassified?: (
    imageId: string,
    classification: SceneClassification,
    profile: ScenarioProfile | null,
  ) => void;
  onImageComplete?: (imageId: string, analysis: ImageAnalysisResultType) => void;
  onImageFlagged?: (imageId: string, reason: string) => void;
  onImageError?: (imageId: string, error: string) => void;
  onProgressMilestone?: (completed: number, total: number) => void;
  onSessionComplete?: (stats: SessionStats) => void;
}

export interface SessionStats {
  totalImages: number;
  completed: number;
  flagged: number;
  errors: number;
  elapsedMs: number;
  avgMsPerImage: number;
  scenariosUsed: number;
}

/**
 * The Lab's core editing loop — revised to use learned photographer profiles.
 *
 * Implements the 8-step per-image editing cycle:
 *   1. LOAD     — Navigate to next image in Lightroom Develop module
 *   2. CLASSIFY — Read EXIF + screenshot, classify the scene scenario
 *   3. LOOKUP   — Query style DB for the photographer's typical adjustments
 *   4. REASON   — Vision model refines profile-based recommendations for THIS image
 *   5. GATE     — Confidence check; flag if scenario is rare or image is unusual
 *   6. EXECUTE  — Apply adjustments via Lightroom UI
 *   7. VERIFY   — Re-screenshot, confirm adjustments applied
 *   8. LOG      — Persist to session JSONL
 */
export class EditingLoop {
  private lightroom: LightroomController;
  private vision: VisionTool;
  private session: SessionStore;
  private queue: ImageQueue;
  private config: TheLabConfig;
  private callbacks: EditingLoopCallbacks;
  private classifier: SceneClassifier;
  private styleDb: StyleDatabase;
  private aborted = false;
  private vlmConfig: VlmAdapterConfig;

  /** Photographer's Soul — qualitative style context for the VLM. */
  private soulContext: string | null = null;

  private scenariosUsed = new Set<string>();

  /**
   * Optional film stock target path for hybrid mode:
   * learned profile + film stock overlay.
   */
  private filmStockTargetPath: string | null;

  constructor(
    config: TheLabConfig,
    styleDbPath: string,
    imagePaths: string[],
    callbacks: EditingLoopCallbacks = {},
    filmStockTargetPath?: string,
  ) {
    this.config = config;
    this.callbacks = callbacks;
    this.filmStockTargetPath = filmStockTargetPath ?? null;

    this.lightroom = new LightroomController(config);
    this.vision = new VisionTool(config);
    this.classifier = new SceneClassifier();
    this.styleDb = new StyleDatabase(styleDbPath);
    this.vlmConfig = vlmConfigFromLabConfig(config);
    this.session = new SessionStore(config.session.sessionDir, "personal-style", imagePaths);
    this.queue = new ImageQueue();
    this.queue.loadFromPaths(imagePaths);

    // Load Soul context for VLM reasoning (non-blocking, non-fatal)
    this.loadSoulContext();
  }

  /**
   * Load the photographer's SOUL.md for VLM context injection.
   * Reads synchronously at construction — the file is small (~2-4KB).
   */
  private loadSoulContext(): void {
    try {
      const soulStore = new SoulStore();
      const soulDir = soulStore.getSoulDir("default");
      const soulPath = path.join(soulDir, "SOUL.md");
      if (fs.existsSync(soulPath)) {
        this.soulContext = fs.readFileSync(soulPath, "utf-8");
        console.log("[EditingLoop] Soul loaded — VLM will use qualitative style context");
      } else {
        console.log("[EditingLoop] No Soul found — VLM will use statistical profiles only");
      }
    } catch {
      console.warn("[EditingLoop] Could not load Soul — continuing without qualitative context");
    }
  }

  async run(): Promise<SessionStats> {
    const startTime = Date.now();

    await this.session.initialize();
    console.log(
      `[EditingLoop] Session ${this.session.getSessionId()} started — ` +
        `${this.queue.getTotal()} images, mode: learned profile`,
    );

    await this.lightroom.initialize();
    await this.lightroom.switchToDevelop();
    await this.lightroom.navigateToFirstImage();

    while (!this.queue.isComplete() && !this.aborted) {
      const imagePath = this.queue.getCurrent();
      if (!imagePath) {
        break;
      }

      const imageId = path.basename(imagePath, path.extname(imagePath));
      const index = this.queue.getCurrentIndex();
      const total = this.queue.getTotal();

      this.callbacks.onImageStart?.(imageId, index, total);

      try {
        await this.processImage(imageId, imagePath, index);
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        console.error(`[EditingLoop] Error processing ${imageId}:`, msg);
        await this.session.markError(imageId, msg);
        this.callbacks.onImageError?.(imageId, msg);
      }

      this.queue.advance();

      if (this.shouldNotifyProgress(index, total)) {
        const progress = this.session.getCurrentProgress();
        this.callbacks.onProgressMilestone?.(progress.completed, progress.total);
      }
    }

    await this.session.finalize();
    this.styleDb.close();

    const elapsedMs = Date.now() - startTime;
    const progress = this.session.getCurrentProgress();
    const stats: SessionStats = {
      totalImages: progress.total,
      completed: progress.completed,
      flagged: progress.flagged,
      errors: progress.errors,
      elapsedMs,
      avgMsPerImage: progress.completed > 0 ? Math.round(elapsedMs / progress.completed) : 0,
      scenariosUsed: this.scenariosUsed.size,
    };

    this.callbacks.onSessionComplete?.(stats);
    return stats;
  }

  /**
   * Process a single image through the revised 8-step cycle.
   */
  private async processImage(imageId: string, imagePath: string, index: number): Promise<void> {
    // Step 1: LOAD
    await this.session.markProcessing(imageId);
    console.log(`[EditingLoop] [${index + 1}/${this.queue.getTotal()}] Processing: ${imageId}`);

    // Step 2: CLASSIFY — determine the scene scenario
    //   a) EXIF-based classification (fast, always available)
    const screenshotPath = await this.lightroom.takeScreenshot(`pre_${imageId}`);
    const exif = await this.extractExifFromPath(imagePath);
    const exifClassification = this.classifier.classifyFromExif(exif);

    //   b) VLM vision classification (when enabled — detects backlit, moody, high-key, etc.)
    let classification: SceneClassification;
    if (this.vlmConfig.enabled) {
      const visionResult = await classifyScreenshot(screenshotPath, this.vlmConfig);
      if (visionResult.confidence > 0) {
        classification = this.classifier.mergeVisionClassification(
          exifClassification,
          visionResult,
        );
        console.log(
          `[EditingLoop]   VLM: ${visionResult.subject ?? "?"}/${visionResult.lighting ?? "?"} ` +
            `(confidence: ${visionResult.confidence.toFixed(2)})` +
            (visionResult.special ? ` [${visionResult.special}]` : "") +
            (visionResult.reasoning ? ` — ${visionResult.reasoning}` : ""),
        );
      } else {
        classification = exifClassification;
        console.log(
          "[EditingLoop]   VLM classification returned zero confidence — using EXIF only",
        );
      }
    } else {
      classification = exifClassification;
    }

    const scKey = scenarioKey(classification);
    this.scenariosUsed.add(scKey);

    console.log(
      `[EditingLoop]   Scene: ${scenarioLabel(classification)} ` +
        `(confidence: ${classification.confidence.toFixed(2)})`,
    );

    // Step 3: LOOKUP — get the photographer's profile for this scenario
    const profile = this.styleDb.findClosestProfile(classification);

    this.callbacks.onImageClassified?.(imageId, classification, profile);

    if (!profile) {
      console.log("[EditingLoop]   No learned profile found — flagging for review");
      await this.session.markFlagged(imageId, "No learned editing profile for this scenario");
      this.callbacks.onImageFlagged?.(imageId, "No learned editing profile for this scenario");
      await this.lightroom.navigateToNextImage();
      return;
    }

    console.log(
      `[EditingLoop]   Profile: "${profile.scenarioLabel}" ` +
        `(${profile.sampleCount} samples, ${Object.keys(profile.adjustments).length} controls)`,
    );

    // Step 4: REASON — vision model refines the profile for THIS specific image
    //   Soul context gives the VLM qualitative understanding of the photographer's style
    const profileAdjustments = this.profileToAdjustments(profile);
    const analysis = await this.vision.analyzeScreenshot(
      screenshotPath,
      this.buildProfileTargetPath(profile),
      this.soulContext ?? undefined,
    );

    // Merge: use the profile as the baseline, vision model as refinement
    const mergedAnalysis = this.mergeProfileWithVision(profileAdjustments, analysis);

    console.log(
      `[EditingLoop]   Analysis: confidence=${mergedAnalysis.confidence.toFixed(2)}, ` +
        `adjustments=${mergedAnalysis.adjustments.length}`,
    );

    // Step 5: GATE
    const gateResult = evaluateGate(mergedAnalysis, this.config.lightroom.confidenceThreshold);

    if (!gateResult.pass) {
      console.log(`[EditingLoop]   FLAGGED: ${gateResult.reason}`);
      await this.session.markFlagged(imageId, gateResult.reason!);
      this.callbacks.onImageFlagged?.(imageId, gateResult.reason!);
      await this.lightroom.navigateToNextImage();
      return;
    }

    const filteredAnalysis = filterConfidentAdjustments(
      mergedAnalysis,
      0.5,
      this.config.lightroom.maxAdjustmentsPerImage,
    );

    // Step 6: EXECUTE
    console.log(`[EditingLoop]   Applying ${filteredAnalysis.adjustments.length} adjustments...`);
    const applyResult = await this.lightroom.applyAdjustments(filteredAnalysis.adjustments);
    console.log(`[EditingLoop]   Applied: ${applyResult.applied} ok, ${applyResult.failed} failed`);

    // Step 7: VERIFY
    let verification: VerificationResultType | null = null;
    try {
      const verifyScreenshot = await this.lightroom.takeScreenshot(`post_${imageId}`);
      verification = await this.vision.verifyScreenshot(
        verifyScreenshot,
        this.buildProfileTargetPath(profile),
        filteredAnalysis.adjustments,
      );
      console.log(
        `[EditingLoop]   Verification: applied=${verification.adjustments_applied}, ` +
          `deviation=${verification.deviation_score.toFixed(2)}`,
      );

      if (verification.needs_retry && filteredAnalysis.adjustments.length > 0) {
        console.log("[EditingLoop]   Verification failed, retrying...");
        await this.lightroom.undo();
        await this.sleep(500);
        await this.lightroom.applyAdjustments(filteredAnalysis.adjustments);
      }
    } catch (error) {
      console.warn("[EditingLoop]   Verification skipped:", error);
    }

    // Step 8: LOG
    await this.session.markComplete(imageId, filteredAnalysis, verification);
    this.callbacks.onImageComplete?.(imageId, filteredAnalysis);

    await this.lightroom.navigateToNextImage();
  }

  /**
   * Convert a scenario profile's statistical adjustments into
   * the AdjustmentEntry format the Lightroom controller expects.
   *
   * Uses the median delta as the target (more robust than mean to outliers).
   */
  private profileToAdjustments(profile: ScenarioProfile): AdjustmentEntryType[] {
    const adjustments: AdjustmentEntryType[] = [];

    for (const [control, stats] of Object.entries(profile.adjustments)) {
      // Skip adjustments with very high variance (photographer is inconsistent)
      if (stats.stdDev > Math.abs(stats.median) * 2 && stats.sampleCount < 10) {
        continue;
      }

      // Skip near-zero adjustments
      if (Math.abs(stats.median) < 0.5) {
        continue;
      }

      const confidence = this.computeProfileConfidence(stats);

      adjustments.push({
        control: control as AdjustmentEntryType["control"],
        current_estimate: 0,
        target_delta: stats.median,
        confidence,
      });
    }

    return adjustments;
  }

  /**
   * Compute confidence for a profile-based adjustment.
   * Higher sample count + lower variance = higher confidence.
   */
  private computeProfileConfidence(stats: AdjustmentStats): number {
    const sampleFactor = Math.min(stats.sampleCount / 20, 1.0);
    const consistencyFactor =
      stats.stdDev > 0 ? Math.max(0, 1 - stats.stdDev / (Math.abs(stats.median) + 1)) : 1.0;

    return Math.min(0.95, sampleFactor * 0.6 + consistencyFactor * 0.4);
  }

  /**
   * Merge profile-based adjustments with vision model refinements.
   *
   * The profile provides the baseline ("what you usually do for this scenario").
   * The vision model provides per-image refinements ("this specific image needs
   * more exposure because it's underexposed").
   */
  private mergeProfileWithVision(
    profileAdj: AdjustmentEntryType[],
    visionAnalysis: ImageAnalysisResultType,
  ): ImageAnalysisResultType {
    const merged = new Map<string, AdjustmentEntryType>();

    // Start with profile adjustments as the baseline
    for (const adj of profileAdj) {
      merged.set(adj.control, { ...adj });
    }

    // Layer vision refinements on top
    for (const vAdj of visionAnalysis.adjustments) {
      const existing = merged.get(vAdj.control);
      if (existing) {
        // Blend: weight profile more heavily (0.6 profile, 0.4 vision)
        const blendedDelta = existing.target_delta * 0.6 + vAdj.target_delta * 0.4;
        const blendedConfidence = existing.confidence * 0.5 + vAdj.confidence * 0.5;

        merged.set(vAdj.control, {
          ...existing,
          target_delta: blendedDelta,
          confidence: blendedConfidence,
          current_estimate: vAdj.current_estimate,
        });
      } else {
        // Vision found something the profile doesn't cover
        merged.set(vAdj.control, {
          ...vAdj,
          confidence: vAdj.confidence * 0.7,
        });
      }
    }

    const avgConfidence =
      merged.size > 0
        ? [...merged.values()].reduce((sum, a) => sum + a.confidence, 0) / merged.size
        : 0;

    return {
      image_id: visionAnalysis.image_id,
      confidence: Math.min(avgConfidence, visionAnalysis.confidence),
      adjustments: [...merged.values()],
      flag_for_review: visionAnalysis.flag_for_review,
      flag_reason: visionAnalysis.flag_reason,
      reasoning: visionAnalysis.reasoning,
    };
  }

  /**
   * Build a temporary JSON target file from a profile for the vision analyzer.
   * The vision model needs a target to compare against.
   */
  private buildProfileTargetPath(profile: ScenarioProfile): string {
    const target = {
      name: profile.scenarioLabel,
      description: `Learned editing profile: ${profile.scenarioLabel} (${profile.sampleCount} samples)`,
      target_ranges: {} as Record<string, { min: number; max: number; typical: number }>,
    };

    for (const [control, stats] of Object.entries(profile.adjustments)) {
      target.target_ranges[control] = {
        min: stats.min,
        max: stats.max,
        typical: stats.median,
      };
    }

    // Write to a temp file (reused across images in the same scenario)
    const targetPath = path.join(
      this.config.vision.screenshotDir,
      `profile_target_${profile.scenarioKey.replace(/::/g, "_")}.json`,
    );

    const fs = require("node:fs") as typeof import("node:fs");
    fs.mkdirSync(path.dirname(targetPath), { recursive: true });
    fs.writeFileSync(targetPath, JSON.stringify(target, null, 2));

    return targetPath;
  }

  /**
   * Extract EXIF data from a file using exiftool.
   * Returns full CatalogExifData for scene classification and profile lookup.
   */
  private async extractExifFromPath(imagePath: string): Promise<CatalogExifData> {
    return extractFullExif(imagePath);
  }

  abort(): void {
    this.aborted = true;
    console.log("[EditingLoop] Abort requested — finishing current image...");
  }

  getSession(): SessionStore {
    return this.session;
  }

  private shouldNotifyProgress(index: number, total: number): boolean {
    const interval = this.config.notifications.progressInterval;
    return (index + 1) % interval === 0 || index + 1 === total;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
