/**
 * VLM Inference Adapter
 *
 * Abstracts vision-language model invocation for scene classification.
 * Currently wraps the Python sidecar (mlx-vlm). Designed so Phase 8
 * can swap in MLX-Swift for native inference without changing callers.
 *
 * Two modes:
 *   - classifyImage(): Scene classification from a photo file
 *   - classifyScreenshot(): Scene classification from a Lightroom screenshot
 *
 * @equity-partner Qwen3-VL (Alibaba) via mlx-vlm (Apple)
 */

import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import { promisify } from "node:util";
import type { TheLabConfig } from "../config/thelab-config.js";
import { buildClassifyPrompt, parseClassifyOutput } from "./classify-prompt.js";
import type { VisionClassification } from "./classify-prompt.js";

const execFileAsync = promisify(execFile);

/**
 * Configuration for the VLM adapter.
 */
export interface VlmAdapterConfig {
  /** Python binary path (e.g. "python3") */
  pythonPath: string;
  /** Model name for mlx-vlm (e.g. "mlx-community/Qwen2-VL-7B-Instruct-4bit") */
  modelName: string;
  /** Max inference timeout in ms */
  timeoutMs: number;
  /** Whether VLM classification is enabled */
  enabled: boolean;
}

/** Cached model availability check */
let mlxVlmAvailable: boolean | null = null;

/**
 * Check if mlx-vlm is installed and available.
 */
export async function isMlxVlmAvailable(pythonPath: string): Promise<boolean> {
  if (mlxVlmAvailable !== null) {
    return mlxVlmAvailable;
  }

  try {
    await execFileAsync(pythonPath, ["-c", "import mlx_vlm; print('ok')"], {
      timeout: 10_000,
    });
    mlxVlmAvailable = true;
  } catch {
    mlxVlmAvailable = false;
    console.warn(
      "[VlmAdapter] mlx-vlm not available. VLM classification disabled. " +
        "Install via: pip install mlx-vlm",
    );
  }

  return mlxVlmAvailable;
}

/**
 * Reset the availability cache (useful for testing or after installing mlx-vlm).
 */
export function resetAvailabilityCache(): void {
  mlxVlmAvailable = null;
}

/**
 * Classify an image using the VLM.
 *
 * @param imagePath - Path to the photo file (RAW, JPEG, TIFF, etc.)
 * @param config - VLM adapter configuration
 * @returns VisionClassification result, or a zero-confidence fallback on failure.
 */
export async function classifyImage(
  imagePath: string,
  config: VlmAdapterConfig,
): Promise<VisionClassification> {
  if (!config.enabled) {
    return { confidence: 0 };
  }

  const available = await isMlxVlmAvailable(config.pythonPath);
  if (!available) {
    return { confidence: 0 };
  }

  try {
    await fs.access(imagePath);
  } catch {
    console.warn(`[VlmAdapter] Image not accessible: ${imagePath}`);
    return { confidence: 0 };
  }

  return runClassification(imagePath, config);
}

/**
 * Classify a Lightroom screenshot using the VLM.
 * Same as classifyImage but semantically distinct — the screenshot
 * contains the Lightroom UI frame around the actual image.
 *
 * @param screenshotPath - Path to the Lightroom screenshot
 * @param config - VLM adapter configuration
 * @returns VisionClassification result
 */
export async function classifyScreenshot(
  screenshotPath: string,
  config: VlmAdapterConfig,
): Promise<VisionClassification> {
  return classifyImage(screenshotPath, config);
}

/**
 * Build VlmAdapterConfig from TheLabConfig.
 */
export function vlmConfigFromLabConfig(config: TheLabConfig): VlmAdapterConfig {
  return {
    pythonPath: config.vision.pythonPath,
    modelName: config.models.primary,
    timeoutMs: 120_000, // 2 minutes default for classification
    enabled: config.vision.enableClassification ?? false,
  };
}

// --- Internal ---

/**
 * Run the VLM classification via Python sidecar.
 * Uses a lightweight inline script instead of the full analyze.py,
 * since classification is a different task than editing analysis.
 */
async function runClassification(
  imagePath: string,
  config: VlmAdapterConfig,
): Promise<VisionClassification> {
  const prompt = buildClassifyPrompt();

  // Inline Python script for classification
  // This avoids coupling to analyze.py's interface
  const script = `
import sys, json
try:
    from mlx_vlm import load, generate
    model, processor = load("${config.modelName}")
    output = generate(
        model,
        processor,
        ${JSON.stringify(prompt)},
        [${JSON.stringify(imagePath)}],
        verbose=False,
        max_tokens=512,
    )
    print(output, file=sys.stdout)
except Exception as e:
    print(json.dumps({"error": str(e), "confidence": 0}), file=sys.stdout)
`;

  try {
    const { stdout, stderr } = await execFileAsync(config.pythonPath, ["-c", script], {
      timeout: config.timeoutMs,
      maxBuffer: 5 * 1024 * 1024,
      env: {
        ...process.env,
        PYTHONUNBUFFERED: "1",
      },
    });

    if (stderr) {
      // mlx-vlm prints progress to stderr — only log actual errors
      const errLines = stderr
        .split("\n")
        .filter((l) => l.includes("Error") || l.includes("Traceback"));
      if (errLines.length > 0) {
        console.error("[VlmAdapter] Python errors:", errLines.join("\n"));
      }
    }

    const result = parseClassifyOutput(stdout);

    if (result.confidence > 0) {
      console.log(
        `[VlmAdapter] Classification: ` +
          `${result.subject ?? "?"}/${result.location ?? "?"}/${result.lighting ?? "?"} ` +
          `(confidence: ${result.confidence.toFixed(2)})` +
          (result.special ? ` [${result.special}]` : ""),
      );
    }

    return result;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);

    // Timeout is expected for first run (model loading)
    if (msg.includes("TIMEOUT") || msg.includes("timed out")) {
      console.warn("[VlmAdapter] Classification timed out — model may still be loading");
    } else {
      console.error("[VlmAdapter] Classification failed:", msg);
    }

    return { confidence: 0 };
  }
}
