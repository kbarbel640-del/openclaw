/**
 * Face Detector — InsightFace SCRFD via Python Sidecar
 *
 * Detects faces in photographs and computes per-face quality metrics:
 *   - Detection confidence
 *   - Face sharpness (Laplacian variance)
 *   - Eye openness estimation
 *   - Face orientation (pitch/yaw/roll)
 *
 * Used by the culling pipeline to:
 *   - Detect closed eyes → reject reason
 *   - Assess face quality in group shots
 *   - Flag extreme face angles
 */

import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const SCRIPT_PATH = path.resolve(import.meta.dirname ?? __dirname, "detect_faces.py");

// --- Types ---

export interface FaceOrientation {
  pitch: number;
  yaw: number;
  roll: number;
}

export interface DetectedFace {
  faceId: number;
  bbox: [number, number, number, number];
  detectionScore: number;
  sharpness: number;
  eyeOpenness: number | null;
  orientation: FaceOrientation | null;
}

export interface FaceDetectionResult {
  imagePath: string;
  faceCount: number;
  faces: DetectedFace[];
  imageWidth: number;
  imageHeight: number;
  error?: string;
}

export interface FaceDetectorConfig {
  pythonPath: string;
  timeoutMs: number;
  enabled: boolean;
}

// --- Availability check ---

let faceDetectorAvailable: boolean | null = null;

export async function isFaceDetectorAvailable(pythonPath: string): Promise<boolean> {
  if (faceDetectorAvailable !== null) {
    return faceDetectorAvailable;
  }

  try {
    await execFileAsync(pythonPath, ["-c", "import insightface; import cv2; print('ok')"], {
      timeout: 15_000,
    });
    faceDetectorAvailable = true;
  } catch {
    faceDetectorAvailable = false;
    console.warn(
      "[FaceDetector] insightface/opencv not available. " +
        "Install via: pip install insightface opencv-python",
    );
  }

  return faceDetectorAvailable;
}

export function resetFaceDetectorCache(): void {
  faceDetectorAvailable = null;
}

// --- Detection ---

/**
 * Detect faces in an image and compute quality metrics.
 */
export async function detectFaces(
  imagePath: string,
  config: FaceDetectorConfig,
): Promise<FaceDetectionResult> {
  const fallback: FaceDetectionResult = {
    imagePath,
    faceCount: 0,
    faces: [],
    imageWidth: 0,
    imageHeight: 0,
  };

  if (!config.enabled) {
    return fallback;
  }

  const available = await isFaceDetectorAvailable(config.pythonPath);
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
        console.error("[FaceDetector] Python errors:", errLines.join("\n"));
      }
    }

    const raw = JSON.parse(stdout.trim()) as {
      image?: string;
      face_count?: number;
      faces?: Array<{
        face_id: number;
        bbox: [number, number, number, number];
        detection_score: number;
        sharpness: number;
        eye_openness: number | null;
        orientation: { pitch: number; yaw: number; roll: number } | null;
      }>;
      image_width?: number;
      image_height?: number;
      error?: string;
    };

    if (raw.error) {
      return { ...fallback, error: raw.error };
    }

    const faces: DetectedFace[] = (raw.faces ?? []).map((f) => ({
      faceId: f.face_id,
      bbox: f.bbox,
      detectionScore: f.detection_score,
      sharpness: f.sharpness,
      eyeOpenness: f.eye_openness,
      orientation: f.orientation,
    }));

    return {
      imagePath,
      faceCount: raw.face_count ?? faces.length,
      faces,
      imageWidth: raw.image_width ?? 0,
      imageHeight: raw.image_height ?? 0,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[FaceDetector] Detection failed:", msg);
    return { ...fallback, error: msg };
  }
}

/**
 * Check if any face in the result has closed eyes.
 */
export function hasClosedEyes(result: FaceDetectionResult): boolean {
  const EYE_OPENNESS_THRESHOLD = 0.01;

  for (const face of result.faces) {
    if (face.eyeOpenness !== null && face.eyeOpenness < EYE_OPENNESS_THRESHOLD) {
      return true;
    }
  }

  return false;
}

/**
 * Get the overall face quality score for an image.
 * Accounts for sharpness, eye openness, and orientation.
 */
export function faceQualityScore(result: FaceDetectionResult): number {
  if (result.faces.length === 0) {
    return 1.0; // No faces = neutral quality (not a face photo)
  }

  let totalScore = 0;

  for (const face of result.faces) {
    let score = face.detectionScore;

    // Sharpness factor (normalized, higher = better)
    const sharpFactor = Math.min(1.0, face.sharpness / 500);
    score *= 0.4 + sharpFactor * 0.6;

    // Eye openness factor
    if (face.eyeOpenness !== null) {
      if (face.eyeOpenness < 0.01) {
        score *= 0.3; // Eyes likely closed
      } else if (face.eyeOpenness < 0.02) {
        score *= 0.7; // Eyes partially closed
      }
    }

    // Orientation factor (prefer frontal faces)
    if (face.orientation) {
      const yawPenalty = Math.abs(face.orientation.yaw) > 30 ? 0.8 : 1.0;
      const pitchPenalty = Math.abs(face.orientation.pitch) > 20 ? 0.9 : 1.0;
      score *= yawPenalty * pitchPenalty;
    }

    totalScore += score;
  }

  return Math.min(1.0, totalScore / result.faces.length);
}
