/**
 * Image Embedder — CLIP Embeddings via Python Sidecar
 *
 * Computes 768-dimensional CLIP image embeddings for photo-RAG:
 * finding visually similar past edits to inform the current image.
 *
 * Same sidecar pattern as vlm-adapter.ts — uses execFile to call Python.
 *
 * @equity-partner CLIP (OpenAI), transformers (HuggingFace)
 */

import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import type { TheLabConfig } from "../config/thelab-config.js";

const execFileAsync = promisify(execFile);

const SCRIPT_PATH = path.resolve(import.meta.dirname ?? __dirname, "embed.py");

// --- Types ---

/** A float32 embedding vector as a Buffer */
export type EmbeddingVector = Float32Array;

export interface EmbeddingResult {
  imagePath: string;
  embedding: EmbeddingVector | null;
  dimensions: number;
  error?: string;
}

export interface EmbedderConfig {
  pythonPath: string;
  timeoutMs: number;
  enabled: boolean;
}

// --- Availability check ---

let embedderAvailable: boolean | null = null;

export async function isEmbedderAvailable(pythonPath: string): Promise<boolean> {
  if (embedderAvailable !== null) {
    return embedderAvailable;
  }

  try {
    await execFileAsync(pythonPath, ["-c", "import transformers; print('ok')"], {
      timeout: 15_000,
    });
    embedderAvailable = true;
  } catch {
    embedderAvailable = false;
    console.warn(
      "[Embedder] transformers not available. Embeddings disabled. " +
        "Install via: pip install transformers torch",
    );
  }

  return embedderAvailable;
}

export function resetEmbedderAvailabilityCache(): void {
  embedderAvailable = null;
}

// --- Embedding computation ---

/**
 * Compute a CLIP embedding for a single image.
 */
export async function computeEmbedding(
  imagePath: string,
  config: EmbedderConfig,
): Promise<EmbeddingResult> {
  const fallback: EmbeddingResult = {
    imagePath,
    embedding: null,
    dimensions: 0,
  };

  if (!config.enabled) {
    return fallback;
  }

  const available = await isEmbedderAvailable(config.pythonPath);
  if (!available) {
    return fallback;
  }

  try {
    await fs.access(imagePath);
  } catch {
    return { ...fallback, error: `Image not accessible: ${imagePath}` };
  }

  try {
    const { stdout, stderr } = await execFileAsync(
      config.pythonPath,
      [SCRIPT_PATH, "--image", imagePath],
      {
        timeout: config.timeoutMs,
        maxBuffer: 10 * 1024 * 1024,
        env: {
          ...process.env,
          PYTHONUNBUFFERED: "1",
        },
      },
    );

    if (stderr) {
      const errLines = stderr
        .split("\n")
        .filter((l) => l.includes("Error") || l.includes("Traceback"));
      if (errLines.length > 0) {
        console.error("[Embedder] Python errors:", errLines.join("\n"));
      }
    }

    const raw = JSON.parse(stdout.trim()) as {
      embedding_b64?: string | null;
      dimensions?: number;
      error?: string;
    };

    if (raw.error) {
      return { ...fallback, error: raw.error };
    }

    if (!raw.embedding_b64) {
      return { ...fallback, error: "No embedding returned" };
    }

    const embedding = decodeEmbedding(raw.embedding_b64);

    return {
      imagePath,
      embedding,
      dimensions: raw.dimensions ?? embedding.length,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[Embedder] Embedding failed:", msg);
    return { ...fallback, error: msg };
  }
}

/**
 * Decode a base64-encoded float32 embedding.
 */
export function decodeEmbedding(b64: string): Float32Array {
  const buffer = Buffer.from(b64, "base64");
  return new Float32Array(buffer.buffer, buffer.byteOffset, buffer.byteLength / 4);
}

/**
 * Encode a float32 embedding to base64.
 */
export function encodeEmbedding(embedding: Float32Array): string {
  const buffer = Buffer.from(embedding.buffer, embedding.byteOffset, embedding.byteLength);
  return buffer.toString("base64");
}

/**
 * Compute cosine similarity between two embeddings.
 */
export function cosineSimilarity(a: Float32Array, b: Float32Array): number {
  if (a.length !== b.length) {
    throw new Error(`Embedding dimension mismatch: ${a.length} vs ${b.length}`);
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  if (denom === 0) {
    return 0;
  }

  return dotProduct / denom;
}

/**
 * Build EmbedderConfig from TheLabConfig.
 */
export function embedderConfigFromLabConfig(config: TheLabConfig): EmbedderConfig {
  return {
    pythonPath: config.vision.pythonPath,
    timeoutMs: config.embeddings?.timeoutMs ?? 120_000,
    enabled: config.embeddings?.enabled ?? false,
  };
}
