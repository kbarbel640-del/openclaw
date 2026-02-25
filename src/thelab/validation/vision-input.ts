import fs from "node:fs/promises";
import path from "node:path";

export type VisionInputKind = "screen_capture" | "disk_fallback";

export interface VisionInputResult {
  kind: VisionInputKind;
  path: string;
}

export async function resolveVisionInput(params: {
  label: string;
  captureScreen: (label: string) => Promise<string>;
  fallbackImagePath: string;
}): Promise<VisionInputResult> {
  try {
    const screenPath = await params.captureScreen(params.label);
    return { kind: "screen_capture", path: screenPath };
  } catch {
    // fall through
  }

  // "Preview fallback" v0: use on-disk image if it is a compatible format.
  // True Lightroom preview extraction can be added later, but this maintains the
  // local-pixels contract and fail-closed behavior.
  const ext = path.extname(params.fallbackImagePath).toLowerCase();
  const supported = new Set([".jpg", ".jpeg", ".png", ".tif", ".tiff", ".webp", ".gif", ".heic"]);

  if (!supported.has(ext)) {
    throw new Error(`No vision input available: unsupported fallback extension '${ext}'`);
  }

  await fs.access(params.fallbackImagePath);
  return { kind: "disk_fallback", path: params.fallbackImagePath };
}
