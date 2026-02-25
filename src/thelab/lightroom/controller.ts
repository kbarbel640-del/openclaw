import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import type { TheLabConfig } from "../config/thelab-config.js";
import type { AdjustmentEntryType } from "../vision/schema.js";
import { LR_SHORTCUTS } from "./shortcuts.js";
import { SliderController } from "./sliders.js";
import { LightroomWindow } from "./window.js";

const execFileAsync = promisify(execFile);

export interface LightroomState {
  isRunning: boolean;
  isFocused: boolean;
  currentModule: "library" | "develop" | "unknown";
  windowId: number | null;
}

/**
 * High-level controller for Adobe Lightroom Classic.
 * Orchestrates window management, screenshot capture, navigation,
 * and slider adjustments via Peekaboo and System Events.
 */
export class LightroomController {
  private window: LightroomWindow;
  private sliders: SliderController;
  private config: TheLabConfig;
  private screenshotDir: string;
  private screenshotCounter = 0;

  constructor(config: TheLabConfig) {
    this.config = config;
    this.window = new LightroomWindow(config.lightroom.appName);
    this.sliders = new SliderController(config.lightroom.appName);
    this.screenshotDir = config.vision.screenshotDir;
  }

  async initialize(): Promise<LightroomState> {
    await fs.mkdir(this.screenshotDir, { recursive: true });

    const isRunning = await this.window.isRunning();
    if (!isRunning) {
      console.log("[LightroomController] Lightroom not running, launching...");
      await this.window.launch();
    }

    await this.window.focus();
    const windowInfo = await this.window.findWindow();

    return {
      isRunning: true,
      isFocused: true,
      currentModule: "unknown",
      windowId: windowInfo?.windowId ?? null,
    };
  }

  async switchToDevelop(): Promise<void> {
    await this.window.focus();
    await this.peekabooHotkey(LR_SHORTCUTS.modules.develop);
    await this.sleep(1000);
  }

  async switchToLibrary(): Promise<void> {
    await this.window.focus();
    await this.peekabooHotkey(LR_SHORTCUTS.modules.library);
    await this.sleep(1000);
  }

  async navigateToNextImage(): Promise<void> {
    await this.peekabooPress(LR_SHORTCUTS.navigation.nextImage);
    await this.sleep(500);
  }

  async navigateToPrevImage(): Promise<void> {
    await this.peekabooPress(LR_SHORTCUTS.navigation.prevImage);
    await this.sleep(500);
  }

  async navigateToFirstImage(): Promise<void> {
    await this.peekabooPress(LR_SHORTCUTS.navigation.firstImage);
    await this.sleep(500);
  }

  /**
   * Take a screenshot of the current Lightroom state.
   * Returns the path to the saved screenshot.
   */
  async takeScreenshot(label?: string): Promise<string> {
    this.screenshotCounter++;
    const filename = label
      ? `lr_${label}_${this.screenshotCounter}.png`
      : `lr_screenshot_${this.screenshotCounter}.png`;
    const outputPath = path.join(this.screenshotDir, filename);

    const success = await this.window.captureScreenshot(outputPath);
    if (!success) {
      throw new Error(`Failed to capture screenshot: ${outputPath}`);
    }

    return outputPath;
  }

  /**
   * Apply a set of adjustments to the current image.
   * Returns results for each adjustment.
   */
  async applyAdjustments(adjustments: AdjustmentEntryType[]): Promise<{
    applied: number;
    failed: number;
    results: Array<{ control: string; success: boolean }>;
  }> {
    await this.window.focus();
    return await this.sliders.applyAdjustmentBatch(adjustments);
  }

  async rateImage(stars: 0 | 1 | 2 | 3 | 4 | 5): Promise<void> {
    const key = LR_SHORTCUTS.rating[`star${stars}` as keyof typeof LR_SHORTCUTS.rating];
    await this.peekabooPress(key);
  }

  async flagImage(flag: "pick" | "reject" | "unflag"): Promise<void> {
    const keyMap = {
      pick: LR_SHORTCUTS.rating.flagPick,
      reject: LR_SHORTCUTS.rating.flagReject,
      unflag: LR_SHORTCUTS.rating.flagUnflag,
    };
    await this.peekabooPress(keyMap[flag]);
  }

  /**
   * Apply a Lightroom preset via menu navigation.
   * Presets are accessed via Develop > Presets menu.
   */
  async applyPresetViaMenu(presetPath: string): Promise<boolean> {
    try {
      await execFileAsync("peekaboo", [
        "menu",
        "click",
        "--app",
        this.config.lightroom.appName,
        "--path",
        presetPath,
      ]);
      await this.sleep(1000);
      return true;
    } catch (error) {
      console.error("[LightroomController] Preset application failed:", error);
      return false;
    }
  }

  async undo(): Promise<void> {
    await this.peekabooHotkey(LR_SHORTCUTS.develop.undo);
    await this.sleep(300);
  }

  async resetDevelopSettings(): Promise<void> {
    await this.peekabooHotkey(LR_SHORTCUTS.develop.resetAll);
    await this.sleep(500);
  }

  async exportCurrentImage(): Promise<void> {
    await this.peekabooHotkey(LR_SHORTCUTS.general.export);
    await this.sleep(500);
  }

  private async peekabooHotkey(keys: string): Promise<void> {
    await execFileAsync("peekaboo", [
      "hotkey",
      "--keys",
      keys,
      "--app",
      this.config.lightroom.appName,
    ]);
  }

  private async peekabooPress(key: string): Promise<void> {
    await execFileAsync("peekaboo", ["press", key, "--app", this.config.lightroom.appName]);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
