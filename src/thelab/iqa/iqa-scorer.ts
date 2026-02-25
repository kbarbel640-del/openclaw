/**
 * IQA Scorer — Image Quality Assessment
 *
 * Quantitative image analysis using Python sidecar:
 *   - CLIP-IQA: brightness, colorfulness, contrast, sharpness, noisiness, quality
 *   - TOPIQ: overall technical quality (0-1)
 *   - Aesthetic Predictor V2.5: aesthetic score (1-10)
 *
 * Same sidecar pattern as vlm-adapter.ts — uses execFile to call Python.
 *
 * @equity-partner pyiqa (PyTorch), CLIP (OpenAI), transformers (HuggingFace)
 */

import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import type { TheLabConfig } from "../config/thelab-config.js";

const execFileAsync = promisify(execFile);

const SCRIPT_PATH = path.resolve(import.meta.dirname ?? __dirname, "score.py");

// --- Types ---

export interface ClipIqaScores {
  brightness: number | null;
  colorfulness: number | null;
  contrast: number | null;
  sharpness: number | null;
  noisiness: number | null;
  quality: number | null;
}

export interface IqaResult {
  imagePath: string;
  clipIqa: ClipIqaScores;
  /** Overall technical quality (0-1) */
  technicalQuality: number | null;
  /** Aesthetic score (1-10) */
  aestheticScore: number | null;
  /** Error message if scoring failed */
  error?: string;
}

export interface IqaScorerConfig {
  pythonPath: string;
  timeoutMs: number;
  enabled: boolean;
}

// --- Availability check ---

let iqaAvailable: boolean | null = null;

export async function isIqaAvailable(pythonPath: string): Promise<boolean> {
  if (iqaAvailable !== null) {
    return iqaAvailable;
  }

  try {
    await execFileAsync(pythonPath, ["-c", "import pyiqa; print('ok')"], {
      timeout: 15_000,
    });
    iqaAvailable = true;
  } catch {
    iqaAvailable = false;
    console.warn(
      "[IqaScorer] pyiqa not available. IQA scoring disabled. Install via: pip install pyiqa",
    );
  }

  return iqaAvailable;
}

export function resetIqaAvailabilityCache(): void {
  iqaAvailable = null;
}

// --- Scoring ---

/**
 * Score an image using all IQA metrics.
 */
export async function scoreImage(imagePath: string, config: IqaScorerConfig): Promise<IqaResult> {
  const fallback: IqaResult = {
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
  };

  if (!config.enabled) {
    return fallback;
  }

  const available = await isIqaAvailable(config.pythonPath);
  if (!available) {
    return fallback;
  }

  try {
    await fs.access(imagePath);
  } catch {
    console.warn(`[IqaScorer] Image not accessible: ${imagePath}`);
    return { ...fallback, error: `Image not accessible: ${imagePath}` };
  }

  try {
    const { stdout, stderr } = await execFileAsync(
      config.pythonPath,
      [SCRIPT_PATH, "--image", imagePath, "--metrics", "all"],
      {
        timeout: config.timeoutMs,
        maxBuffer: 5 * 1024 * 1024,
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
        console.error("[IqaScorer] Python errors:", errLines.join("\n"));
      }
    }

    const raw = JSON.parse(stdout.trim()) as {
      scores?: {
        clip_iqa?: Record<string, number | null>;
        topiq?: { technical_quality?: number | null };
        aesthetic?: { aesthetic_score?: number | null };
      };
      error?: string;
    };

    if (raw.error) {
      return { ...fallback, error: raw.error };
    }

    const scores = raw.scores ?? {};

    return {
      imagePath,
      clipIqa: {
        brightness: scores.clip_iqa?.brightness ?? null,
        colorfulness: scores.clip_iqa?.colorfulness ?? null,
        contrast: scores.clip_iqa?.contrast ?? null,
        sharpness: scores.clip_iqa?.sharpness ?? null,
        noisiness: scores.clip_iqa?.noisiness ?? null,
        quality: scores.clip_iqa?.quality ?? null,
      },
      technicalQuality: scores.topiq?.technical_quality ?? null,
      aestheticScore: scores.aesthetic?.aesthetic_score ?? null,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[IqaScorer] Scoring failed:", msg);
    return { ...fallback, error: msg };
  }
}

/**
 * Build IqaScorerConfig from TheLabConfig.
 */
export function iqaConfigFromLabConfig(config: TheLabConfig): IqaScorerConfig {
  return {
    pythonPath: config.vision.pythonPath,
    timeoutMs: config.iqa?.timeoutMs ?? 120_000,
    enabled: config.iqa?.enabled ?? false,
  };
}
