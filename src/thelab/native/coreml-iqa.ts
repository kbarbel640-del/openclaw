/**
 * CoreML IQA Adapter — Apple Neural Engine quality scoring
 *
 * Adapter for running IQA models on Apple's Neural Engine via CoreML.
 * Same interface as iqa-scorer.ts — falls back to Python sidecar
 * if the CoreML model isn't available.
 *
 * The CoreML models would be compiled separately using coremltools
 * and stored in the app bundle.
 */

import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import { promisify } from "node:util";
import { scoreImage as pythonScoreImage } from "../iqa/iqa-scorer.js";
import type { IqaResult, IqaScorerConfig } from "../iqa/iqa-scorer.js";

const execFileAsync = promisify(execFile);

export interface CoreMlIqaConfig {
  /** Path to the CoreML IQA binary/runner */
  binaryPath: string;
  /** Path to the compiled IQA .mlpackage */
  modelPath: string;
  /** Timeout in ms */
  timeoutMs: number;
  /** Whether CoreML IQA is enabled */
  enabled: boolean;
}

/** Cached availability */
let coremlIqaAvailable: boolean | null = null;

/**
 * Check if the CoreML IQA binary and model are available.
 */
export async function isCoremlIqaAvailable(config: CoreMlIqaConfig): Promise<boolean> {
  if (coremlIqaAvailable !== null) {
    return coremlIqaAvailable;
  }

  try {
    await fs.access(config.binaryPath);
    await fs.access(config.modelPath);
    coremlIqaAvailable = true;
  } catch {
    coremlIqaAvailable = false;
    console.warn("[CoreMLIqa] CoreML IQA model not available. Falling back to Python.");
  }

  return coremlIqaAvailable;
}

export function resetCoremlIqaAvailabilityCache(): void {
  coremlIqaAvailable = null;
}

/**
 * Score an image using CoreML IQA on the Apple Neural Engine.
 * Falls back to Python sidecar if CoreML is unavailable.
 */
export async function scoreImage(
  imagePath: string,
  nativeConfig: CoreMlIqaConfig,
  fallbackConfig: IqaScorerConfig,
): Promise<IqaResult> {
  if (!nativeConfig.enabled) {
    return pythonScoreImage(imagePath, fallbackConfig);
  }

  const available = await isCoremlIqaAvailable(nativeConfig);
  if (!available) {
    return pythonScoreImage(imagePath, fallbackConfig);
  }

  try {
    await fs.access(imagePath);
  } catch {
    return {
      imagePath,
      clipIqa: {
        brightness: null,
        colorfulness: null,
        contrast: null,
        sharpness: null,
        noisiness: null,
        quality: null,
      },
      technicalQuality: null,
      aestheticScore: null,
      error: `Image not accessible: ${imagePath}`,
    };
  }

  try {
    const { stdout, stderr } = await execFileAsync(
      nativeConfig.binaryPath,
      ["--model", nativeConfig.modelPath, "--image", imagePath, "--output", "json"],
      {
        timeout: nativeConfig.timeoutMs,
        maxBuffer: 5 * 1024 * 1024,
      },
    );

    if (stderr) {
      const errLines = stderr.split("\n").filter((l) => l.includes("Error"));
      if (errLines.length > 0) {
        console.error("[CoreMLIqa] Errors:", errLines.join("\n"));
      }
    }

    const raw = JSON.parse(stdout.trim()) as {
      clip_iqa?: {
        brightness?: number | null;
        colorfulness?: number | null;
        contrast?: number | null;
        sharpness?: number | null;
        noisiness?: number | null;
        quality?: number | null;
      };
      technical_quality?: number | null;
      aesthetic_score?: number | null;
      error?: string;
    };

    if (raw.error) {
      console.warn(`[CoreMLIqa] Error: ${raw.error} — falling back to Python`);
      return pythonScoreImage(imagePath, fallbackConfig);
    }

    return {
      imagePath,
      clipIqa: {
        brightness: raw.clip_iqa?.brightness ?? null,
        colorfulness: raw.clip_iqa?.colorfulness ?? null,
        contrast: raw.clip_iqa?.contrast ?? null,
        sharpness: raw.clip_iqa?.sharpness ?? null,
        noisiness: raw.clip_iqa?.noisiness ?? null,
        quality: raw.clip_iqa?.quality ?? null,
      },
      technicalQuality: raw.technical_quality ?? null,
      aestheticScore: raw.aesthetic_score ?? null,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`[CoreMLIqa] Native scoring failed: ${msg} — falling back to Python`);
    return pythonScoreImage(imagePath, fallbackConfig);
  }
}
