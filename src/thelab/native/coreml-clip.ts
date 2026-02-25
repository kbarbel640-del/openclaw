/**
 * CoreML CLIP Adapter — Apple Neural Engine embeddings
 *
 * Adapter for running CLIP on Apple's Neural Engine via CoreML.
 * Same interface as embedder.ts — falls back to Python sidecar
 * if the CoreML model isn't available.
 *
 * The CoreML model would be compiled separately using coremltools
 * and stored in the app bundle.
 */

import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import { promisify } from "node:util";
import {
  computeEmbedding as pythonComputeEmbedding,
  decodeEmbedding,
} from "../embeddings/embedder.js";
import type { EmbedderConfig, EmbeddingResult, EmbeddingVector } from "../embeddings/embedder.js";

const execFileAsync = promisify(execFile);

export interface CoreMlClipConfig {
  /** Path to the CoreML CLIP binary/runner */
  binaryPath: string;
  /** Path to the compiled .mlpackage */
  modelPath: string;
  /** Timeout in ms */
  timeoutMs: number;
  /** Whether CoreML CLIP is enabled */
  enabled: boolean;
}

/** Cached availability */
let coremlClipAvailable: boolean | null = null;

/**
 * Check if the CoreML CLIP binary is available.
 */
export async function isCoremlClipAvailable(config: CoreMlClipConfig): Promise<boolean> {
  if (coremlClipAvailable !== null) {
    return coremlClipAvailable;
  }

  try {
    await fs.access(config.binaryPath);
    await fs.access(config.modelPath);
    coremlClipAvailable = true;
  } catch {
    coremlClipAvailable = false;
    console.warn("[CoreMLClip] CoreML CLIP model not available. Falling back to Python.");
  }

  return coremlClipAvailable;
}

export function resetCoremlClipAvailabilityCache(): void {
  coremlClipAvailable = null;
}

/**
 * Compute a CLIP embedding using CoreML on the Apple Neural Engine.
 * Falls back to Python sidecar if CoreML is unavailable.
 */
export async function computeEmbedding(
  imagePath: string,
  nativeConfig: CoreMlClipConfig,
  fallbackConfig: EmbedderConfig,
): Promise<EmbeddingResult> {
  if (!nativeConfig.enabled) {
    return pythonComputeEmbedding(imagePath, fallbackConfig);
  }

  const available = await isCoremlClipAvailable(nativeConfig);
  if (!available) {
    return pythonComputeEmbedding(imagePath, fallbackConfig);
  }

  try {
    await fs.access(imagePath);
  } catch {
    return {
      imagePath,
      embedding: null,
      dimensions: 0,
      error: `Image not accessible: ${imagePath}`,
    };
  }

  try {
    const { stdout, stderr } = await execFileAsync(
      nativeConfig.binaryPath,
      ["--model", nativeConfig.modelPath, "--image", imagePath, "--output", "json"],
      {
        timeout: nativeConfig.timeoutMs,
        maxBuffer: 10 * 1024 * 1024,
      },
    );

    if (stderr) {
      const errLines = stderr.split("\n").filter((l) => l.includes("Error"));
      if (errLines.length > 0) {
        console.error("[CoreMLClip] Errors:", errLines.join("\n"));
      }
    }

    const raw = JSON.parse(stdout.trim()) as {
      embedding_b64?: string;
      dimensions?: number;
      error?: string;
    };

    if (raw.error) {
      console.warn(`[CoreMLClip] Error: ${raw.error} — falling back to Python`);
      return pythonComputeEmbedding(imagePath, fallbackConfig);
    }

    if (!raw.embedding_b64) {
      return pythonComputeEmbedding(imagePath, fallbackConfig);
    }

    const embedding: EmbeddingVector = decodeEmbedding(raw.embedding_b64);

    return {
      imagePath,
      embedding,
      dimensions: raw.dimensions ?? embedding.length,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`[CoreMLClip] Native embedding failed: ${msg} — falling back to Python`);
    return pythonComputeEmbedding(imagePath, fallbackConfig);
  }
}
