/**
 * MLX-Swift VLM Wrapper — Native inference adapter
 *
 * Wraps a Swift executable that runs Qwen3-VL via MLX-Swift for
 * native inference on Apple Silicon. Eliminates the Python dependency.
 *
 * Same interface as vlm-adapter.ts — callers don't need to know
 * which backend is being used.
 *
 * Falls back to the Python sidecar if the Swift binary isn't available.
 */

import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import { promisify } from "node:util";
import { buildClassifyPrompt, parseClassifyOutput } from "../vision/classify-prompt.js";
import type { VisionClassification } from "../vision/classify-prompt.js";
import { classifyImage as pythonClassifyImage } from "../vision/vlm-adapter.js";
import type { VlmAdapterConfig } from "../vision/vlm-adapter.js";

const execFileAsync = promisify(execFile);

export interface MlxSwiftConfig {
  /** Path to the mlx-swift-vlm binary */
  binaryPath: string;
  /** Model name for MLX-Swift */
  modelName: string;
  /** Timeout in ms */
  timeoutMs: number;
  /** Whether native inference is enabled */
  enabled: boolean;
}

/** Cached availability check */
let mlxSwiftAvailable: boolean | null = null;

/**
 * Check if the MLX-Swift binary is available.
 */
export async function isMlxSwiftAvailable(binaryPath: string): Promise<boolean> {
  if (mlxSwiftAvailable !== null) {
    return mlxSwiftAvailable;
  }

  try {
    await fs.access(binaryPath);
    // Test the binary with a version check
    await execFileAsync(binaryPath, ["--version"], { timeout: 5_000 });
    mlxSwiftAvailable = true;
  } catch {
    mlxSwiftAvailable = false;
    console.warn("[MlxSwiftVlm] MLX-Swift binary not available. Falling back to Python sidecar.");
  }

  return mlxSwiftAvailable;
}

export function resetMlxSwiftAvailabilityCache(): void {
  mlxSwiftAvailable = null;
}

/**
 * Classify an image using MLX-Swift native inference.
 * Falls back to Python sidecar if Swift binary is unavailable.
 */
export async function classifyImage(
  imagePath: string,
  nativeConfig: MlxSwiftConfig,
  fallbackConfig: VlmAdapterConfig,
): Promise<VisionClassification> {
  if (!nativeConfig.enabled) {
    return pythonClassifyImage(imagePath, fallbackConfig);
  }

  const available = await isMlxSwiftAvailable(nativeConfig.binaryPath);
  if (!available) {
    return pythonClassifyImage(imagePath, fallbackConfig);
  }

  try {
    const prompt = buildClassifyPrompt();

    const { stdout, stderr } = await execFileAsync(
      nativeConfig.binaryPath,
      [
        "--model",
        nativeConfig.modelName,
        "--image",
        imagePath,
        "--prompt",
        prompt,
        "--max-tokens",
        "512",
        "--json",
      ],
      {
        timeout: nativeConfig.timeoutMs,
        maxBuffer: 5 * 1024 * 1024,
      },
    );

    if (stderr) {
      const errLines = stderr.split("\n").filter((l) => l.includes("Error") || l.includes("error"));
      if (errLines.length > 0) {
        console.error("[MlxSwiftVlm] Swift errors:", errLines.join("\n"));
      }
    }

    const result = parseClassifyOutput(stdout);

    if (result.confidence > 0) {
      console.log(
        `[MlxSwiftVlm] Classification (native): ` +
          `${result.subject ?? "?"}/${result.lighting ?? "?"} ` +
          `(confidence: ${result.confidence.toFixed(2)})`,
      );
    }

    return result;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`[MlxSwiftVlm] Native inference failed: ${msg} — falling back to Python`);
    return pythonClassifyImage(imagePath, fallbackConfig);
  }
}

/**
 * Classify a screenshot using MLX-Swift native inference.
 * Falls back to Python sidecar if Swift binary is unavailable.
 */
export async function classifyScreenshot(
  screenshotPath: string,
  nativeConfig: MlxSwiftConfig,
  fallbackConfig: VlmAdapterConfig,
): Promise<VisionClassification> {
  return classifyImage(screenshotPath, nativeConfig, fallbackConfig);
}
