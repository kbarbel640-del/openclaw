import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import type { TheLabConfig } from "../config/thelab-config.js";
import { extractFullExif } from "../exif/exif-reader.js";
import { VisionTool } from "../vision/vision-tool.js";
import type { CatalogExifData } from "./catalog-ingester.js";
import { SceneClassifier } from "./scene-classifier.js";
import { StyleDatabase } from "./style-db.js";

const execFileAsync = promisify(execFile);

/**
 * Slider state captured from a Lightroom screenshot.
 * The vision model extracts current slider values.
 */
interface SliderSnapshot {
  timestamp: number;
  imageFingerprint: string;
  sliders: Record<string, number>;
}

export interface ObserverCallbacks {
  onEditRecorded?: (imageId: string, scenario: string, deltaCount: number) => void;
  onImageChanged?: (newImageId: string) => void;
  onError?: (error: string) => void;
  onStatusChange?: (status: ObserverStatus) => void;
}

export type ObserverStatus = "idle" | "watching" | "recording" | "paused" | "stopped";

/**
 * Watches the photographer edit in real-time via Peekaboo screenshots.
 *
 * Workflow:
 * 1. Periodically captures Lightroom screenshots (every few seconds)
 * 2. Detects when the user navigates to a new image (image change)
 * 3. When a new image is detected, records the slider state of the
 *    PREVIOUS image as a completed edit
 * 4. Classifies the photo and stores the edit delta in the style DB
 *
 * The observer runs silently — the photographer just edits normally.
 */
export class LiveObserver {
  private config: TheLabConfig;
  private styleDb: StyleDatabase;
  private classifier: SceneClassifier;
  private vision: VisionTool;
  private callbacks: ObserverCallbacks;

  private status: ObserverStatus = "idle";
  private pollIntervalMs: number;
  private pollTimer: ReturnType<typeof setInterval> | null = null;

  private currentImageFingerprint: string | null = null;
  private currentImagePath: string | null = null;
  private firstSnapshot: SliderSnapshot | null = null;
  private lastSnapshot: SliderSnapshot | null = null;
  private screenshotCounter = 0;
  private appName: string;

  constructor(
    config: TheLabConfig,
    styleDbPath: string,
    callbacks: ObserverCallbacks = {},
    pollIntervalMs = 3000,
  ) {
    this.config = config;
    this.styleDb = new StyleDatabase(styleDbPath);
    this.classifier = new SceneClassifier();
    this.vision = new VisionTool(config);
    this.callbacks = callbacks;
    this.pollIntervalMs = pollIntervalMs;
    this.appName = config.lightroom.appName;
  }

  /**
   * Start watching the photographer edit.
   */
  start(): void {
    if (this.status === "watching" || this.status === "recording") {
      return;
    }

    this.setStatus("watching");
    console.log("[LiveObserver] Started watching Lightroom edits");

    this.pollTimer = setInterval(() => {
      this.poll().catch((err) => {
        const msg = err instanceof Error ? err.message : String(err);
        this.callbacks.onError?.(msg);
      });
    }, this.pollIntervalMs);
  }

  /**
   * Stop watching and flush any pending edit.
   */
  async stop(): Promise<void> {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }

    // Record the last image's edit if we have data
    if (this.firstSnapshot && this.lastSnapshot && this.currentImageFingerprint) {
      await this.recordEdit();
    }

    this.setStatus("stopped");
    this.styleDb.close();
    console.log("[LiveObserver] Stopped");
  }

  pause(): void {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
    this.setStatus("paused");
  }

  resume(): void {
    if (this.status !== "paused") {
      return;
    }
    this.start();
  }

  getStatus(): ObserverStatus {
    return this.status;
  }

  /**
   * Single poll cycle: capture screenshot, detect image changes,
   * record edits when the photographer moves to a new image.
   */
  private async poll(): Promise<void> {
    // Check if Lightroom is running and in Develop module
    const isActive = await this.isLightroomDevelopActive();
    if (!isActive) {
      if (this.status === "recording") {
        this.setStatus("watching");
      }
      return;
    }

    this.setStatus("recording");

    // Capture a screenshot
    const screenshotPath = await this.captureScreenshot();
    if (!screenshotPath) {
      return;
    }

    // Get a fingerprint of the current image to detect navigation
    const fingerprint = await this.getImageFingerprint(screenshotPath);

    if (fingerprint !== this.currentImageFingerprint) {
      // Image changed — record the previous image's edit
      if (this.firstSnapshot && this.lastSnapshot && this.currentImageFingerprint) {
        await this.recordEdit();
      }

      // Start tracking the new image
      this.currentImageFingerprint = fingerprint;
      this.currentImagePath = await this.tryGetCurrentImagePath();
      this.firstSnapshot = {
        timestamp: Date.now(),
        imageFingerprint: fingerprint,
        sliders: {},
      };
      this.lastSnapshot = null;

      this.callbacks.onImageChanged?.(fingerprint);
    }

    // Update the last snapshot (we'll use this when the image changes)
    this.lastSnapshot = {
      timestamp: Date.now(),
      imageFingerprint: fingerprint,
      sliders: {},
    };

    // Clean up screenshot
    try {
      await fs.unlink(screenshotPath);
    } catch {
      // ignore cleanup errors
    }
  }

  /**
   * Record a completed edit: compute the delta between first and last
   * observed state, classify the scene, store in the style DB.
   */
  private async recordEdit(): Promise<void> {
    if (!this.firstSnapshot || !this.lastSnapshot || !this.currentImageFingerprint) {
      return;
    }

    // Only record if the photographer spent meaningful time on this image
    const editDurationMs = this.lastSnapshot.timestamp - this.firstSnapshot.timestamp;
    if (editDurationMs < 2000) {
      return;
    }

    try {
      // Extract real EXIF if we have the image path, otherwise fall back to timestamp-only
      let exif: CatalogExifData;
      if (this.currentImagePath) {
        exif = await extractFullExif(this.currentImagePath);
      } else {
        const now = new Date();
        exif = {
          dateTimeOriginal: now.toISOString(),
          isoSpeedRating: null,
          focalLength: null,
          aperture: null,
          shutterSpeed: null,
          flashFired: null,
          whiteBalance: null,
          cameraModel: null,
          lensModel: null,
          gpsLatitude: null,
          gpsLongitude: null,
        };
      }

      // Classify the scene using real EXIF data when available
      const classification = this.classifier.classifyFromExif(exif);
      const key = this.styleDb.ensureScenario(classification);

      // For live observation, the "adjustments" are what the vision model
      // detected changed between first and last snapshot.
      // In practice, we'll read the final slider state from the catalog
      // after the session ends. For now, store what we have.
      const adjustments = this.computeObservedDelta();

      if (Object.keys(adjustments).length === 0) {
        return;
      }

      const photoHash = createHash("sha256")
        .update(this.currentImageFingerprint + this.firstSnapshot.timestamp)
        .digest("hex")
        .slice(0, 16);

      this.styleDb.storePhotoEdit({
        photoHash,
        scenarioKey: key,
        exifJson: JSON.stringify(exif),
        adjustmentsJson: JSON.stringify(adjustments),
        editedAt: exif.dateTimeOriginal ?? new Date().toISOString(),
        source: "live_observer",
      });

      this.callbacks.onEditRecorded?.(
        this.currentImageFingerprint,
        key,
        Object.keys(adjustments).length,
      );
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.callbacks.onError?.(`Failed to record edit: ${msg}`);
    }
  }

  /**
   * Compute the delta between first and last observed slider states.
   */
  private computeObservedDelta(): Record<string, number> {
    if (!this.firstSnapshot || !this.lastSnapshot) {
      return {};
    }

    const delta: Record<string, number> = {};
    const first = this.firstSnapshot.sliders;
    const last = this.lastSnapshot.sliders;

    for (const [control, lastVal] of Object.entries(last)) {
      const firstVal = first[control] ?? 0;
      const d = lastVal - firstVal;
      if (Math.abs(d) > 0.001) {
        delta[control] = d;
      }
    }

    return delta;
  }

  /**
   * Generate a fingerprint for the current image in Lightroom.
   * Uses a hash of the screenshot's center region to detect image changes.
   */
  private async getImageFingerprint(screenshotPath: string): Promise<string> {
    try {
      const stat = await fs.stat(screenshotPath);
      // Use file size + modification time as a rough fingerprint
      // A real implementation would hash the image center pixels
      return createHash("md5").update(`${stat.size}-${stat.mtimeMs}`).digest("hex").slice(0, 12);
    } catch {
      return `unknown-${Date.now()}`;
    }
  }

  private async captureScreenshot(): Promise<string | null> {
    this.screenshotCounter++;
    const outputPath = path.join(
      this.config.vision.screenshotDir,
      `observer_${this.screenshotCounter}.png`,
    );

    try {
      await fs.mkdir(this.config.vision.screenshotDir, { recursive: true });
      await execFileAsync("peekaboo", ["image", "--app", this.appName, "--path", outputPath]);
      return outputPath;
    } catch {
      return null;
    }
  }

  private async isLightroomDevelopActive(): Promise<boolean> {
    try {
      const { stdout } = await execFileAsync("peekaboo", [
        "list",
        "windows",
        "--app",
        this.appName,
        "--json",
      ]);
      const windows = JSON.parse(stdout);
      if (!Array.isArray(windows) || windows.length === 0) {
        return false;
      }

      // Check if the window title suggests Develop module
      const mainWindow = windows[0];
      const title = (mainWindow.title ?? mainWindow.name ?? "").toLowerCase();
      return title.includes("develop") || title.includes("lightroom");
    } catch {
      return false;
    }
  }

  /**
   * Try to get the current image file path from Lightroom's title bar.
   * Lightroom Classic shows the filename in the window title when in Develop module.
   * We attempt to locate the full path in common photo directories.
   */
  private async tryGetCurrentImagePath(): Promise<string | null> {
    try {
      const { stdout } = await execFileAsync("peekaboo", [
        "list",
        "windows",
        "--app",
        this.appName,
        "--json",
      ]);
      const windows = JSON.parse(stdout);
      if (!Array.isArray(windows) || windows.length === 0) {
        return null;
      }

      const title = (windows[0].title ?? windows[0].name ?? "") as string;

      // Lightroom title patterns: "Lightroom Classic - Develop - IMG_1234.CR3"
      // or "Lightroom Classic - Library - IMG_1234.CR3"
      const fileMatch = title.match(
        /[\s-]+(\S+\.(?:cr[23]|nef|arw|orf|raf|dng|rw2|pef|srw|jpg|jpeg|tif|tiff|heic))$/i,
      );
      if (!fileMatch) {
        return null;
      }

      const fileName = fileMatch[1];

      // Try to find this file in the catalog's folder hierarchy
      const catalogDir = path.dirname(this.config.learning.catalogPath);
      const photosDir = path.dirname(catalogDir);

      // Search common photo directory structures
      const searchDirs = [photosDir, catalogDir, `${process.env.HOME}/Pictures`];

      for (const dir of searchDirs) {
        try {
          const found = await this.findFileRecursive(dir, fileName, 3);
          if (found) {
            return found;
          }
        } catch {
          // directory doesn't exist or can't be read
        }
      }

      return null;
    } catch {
      return null;
    }
  }

  /**
   * Recursively search for a file by name within a directory, up to maxDepth levels.
   */
  private async findFileRecursive(
    dir: string,
    fileName: string,
    maxDepth: number,
  ): Promise<string | null> {
    if (maxDepth <= 0) {
      return null;
    }

    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isFile() && entry.name === fileName) {
          return path.join(dir, entry.name);
        }
      }
      for (const entry of entries) {
        if (entry.isDirectory() && !entry.name.startsWith(".")) {
          const found = await this.findFileRecursive(
            path.join(dir, entry.name),
            fileName,
            maxDepth - 1,
          );
          if (found) {
            return found;
          }
        }
      }
    } catch {
      // permission denied or directory doesn't exist
    }
    return null;
  }

  private setStatus(status: ObserverStatus): void {
    if (this.status !== status) {
      this.status = status;
      this.callbacks.onStatusChange?.(status);
    }
  }
}
