/**
 * Real EXIF extraction for Sophie.
 *
 * Uses the system `exiftool` binary (Phil Harvey's ExifTool) for reliable,
 * format-agnostic metadata extraction from RAW, JPEG, TIFF, and HEIC files.
 *
 * Two extraction modes:
 *   - `extractFullExif()`: Complete CatalogExifData for learning/editing (slower, all fields)
 *   - `extractQuickExif()`: Minimal ExifQuickData for culling pass (fast, key fields only)
 *
 * Falls back gracefully when exiftool is not installed.
 *
 * @equity-partner exiftool (Phil Harvey) — https://exiftool.org
 */

import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { CatalogExifData } from "../learning/catalog-ingester.js";

const execFileAsync = promisify(execFile);

/**
 * Minimal EXIF data for fast culling — matches the Culler's ExifQuickData interface.
 */
export interface ExifQuickData {
  shutterSpeed?: number;
  aperture?: number;
  iso?: number;
  focalLength?: number;
  flash?: boolean;
  timestamp?: string;
}

/**
 * Raw exiftool JSON output (subset of fields we care about).
 */
interface ExifToolOutput {
  DateTimeOriginal?: string;
  CreateDate?: string;
  ISO?: number;
  FocalLength?: string | number;
  FocalLengthIn35mmFormat?: string | number;
  Aperture?: number;
  FNumber?: number;
  ShutterSpeed?: string | number;
  ExposureTime?: string | number;
  Flash?: string;
  WhiteBalance?: string;
  Model?: string;
  LensModel?: string;
  LensID?: string;
  GPSLatitude?: string | number;
  GPSLongitude?: string | number;
  GPSPosition?: string;
}

/** Cached exiftool availability check. */
let exiftoolAvailable: boolean | null = null;

/**
 * Check if exiftool is installed and accessible.
 */
export async function isExiftoolAvailable(): Promise<boolean> {
  if (exiftoolAvailable !== null) {
    return exiftoolAvailable;
  }

  try {
    await execFileAsync("exiftool", ["-ver"], { timeout: 5000 });
    exiftoolAvailable = true;
  } catch {
    exiftoolAvailable = false;
    console.warn(
      "[ExifReader] exiftool not found on PATH. EXIF extraction will be limited. " +
        "Install via: brew install exiftool",
    );
  }

  return exiftoolAvailable;
}

/**
 * Extract full EXIF metadata from an image file.
 * Returns CatalogExifData compatible with the learning system.
 *
 * @param filePath - Absolute path to the image file (RAW, JPEG, TIFF, HEIC, etc.)
 * @returns Typed EXIF data, with nulls for unavailable fields.
 */
export async function extractFullExif(filePath: string): Promise<CatalogExifData> {
  const available = await isExiftoolAvailable();
  if (!available) {
    return nullExifData();
  }

  try {
    const raw = await runExiftool(filePath, [
      "-DateTimeOriginal",
      "-CreateDate",
      "-ISO",
      "-FocalLength",
      "-FocalLengthIn35mmFormat",
      "-Aperture",
      "-FNumber",
      "-ShutterSpeed",
      "-ExposureTime",
      "-Flash",
      "-WhiteBalance",
      "-Model",
      "-LensModel",
      "-LensID",
      "-GPSLatitude",
      "-GPSLongitude",
      "-GPSPosition",
    ]);

    return {
      dateTimeOriginal: parseDateTime(raw.DateTimeOriginal ?? raw.CreateDate) ?? null,
      isoSpeedRating: raw.ISO ?? null,
      focalLength: parseFocalLength(raw.FocalLength ?? raw.FocalLengthIn35mmFormat),
      aperture: raw.Aperture ?? raw.FNumber ?? null,
      shutterSpeed: parseShutterSpeed(raw.ShutterSpeed ?? raw.ExposureTime),
      flashFired: parseFlash(raw.Flash),
      whiteBalance: raw.WhiteBalance ?? null,
      cameraModel: raw.Model ?? null,
      lensModel: raw.LensModel ?? raw.LensID ?? null,
      gpsLatitude: parseGpsCoord(raw.GPSLatitude),
      gpsLongitude: parseGpsCoord(raw.GPSLongitude),
    };
  } catch (err) {
    console.error(`[ExifReader] Failed to extract EXIF from ${filePath}:`, err);
    return nullExifData();
  }
}

/**
 * Extract minimal EXIF data for fast culling decisions.
 * Only reads the fields needed for blur detection, exposure checks, etc.
 *
 * @param filePath - Absolute path to the image file.
 * @returns Quick EXIF data for culling heuristics.
 */
export async function extractQuickExif(filePath: string): Promise<ExifQuickData> {
  const available = await isExiftoolAvailable();
  if (!available) {
    return {};
  }

  try {
    const raw = await runExiftool(filePath, [
      "-ISO",
      "-FocalLength",
      "-Aperture",
      "-FNumber",
      "-ShutterSpeed",
      "-ExposureTime",
      "-Flash",
      "-DateTimeOriginal",
      "-CreateDate",
    ]);

    return {
      iso: raw.ISO,
      focalLength: parseFocalLength(raw.FocalLength) ?? undefined,
      aperture: raw.Aperture ?? raw.FNumber,
      shutterSpeed: parseShutterSpeed(raw.ShutterSpeed ?? raw.ExposureTime) ?? undefined,
      flash: parseFlash(raw.Flash) ?? undefined,
      timestamp: parseDateTime(raw.DateTimeOriginal ?? raw.CreateDate) ?? undefined,
    };
  } catch (err) {
    console.error(`[ExifReader] Quick EXIF failed for ${filePath}:`, err);
    return {};
  }
}

/**
 * Batch extract full EXIF from multiple files efficiently.
 * Uses exiftool's batch mode for significantly faster throughput on large sets.
 *
 * @param filePaths - Array of absolute file paths.
 * @returns Map of filePath -> CatalogExifData.
 */
export async function extractBatchExif(filePaths: string[]): Promise<Map<string, CatalogExifData>> {
  const results = new Map<string, CatalogExifData>();

  if (filePaths.length === 0) {
    return results;
  }

  const available = await isExiftoolAvailable();
  if (!available) {
    for (const fp of filePaths) {
      results.set(fp, nullExifData());
    }
    return results;
  }

  try {
    // exiftool batch mode: pass all files at once, get JSON array back
    const args = [
      "-json",
      "-n", // numeric output (no string formatting)
      "-DateTimeOriginal",
      "-CreateDate",
      "-ISO",
      "-FocalLength",
      "-FocalLengthIn35mmFormat",
      "-Aperture",
      "-FNumber",
      "-ShutterSpeed",
      "-ExposureTime",
      "-Flash",
      "-WhiteBalance",
      "-Model",
      "-LensModel",
      "-LensID",
      "-GPSLatitude",
      "-GPSLongitude",
      ...filePaths,
    ];

    const { stdout } = await execFileAsync("exiftool", args, {
      timeout: 60_000,
      maxBuffer: 10 * 1024 * 1024, // 10MB for large batches
    });

    const parsed: (ExifToolOutput & { SourceFile?: string })[] = JSON.parse(stdout);

    for (const entry of parsed) {
      const sourcePath = entry.SourceFile;
      if (!sourcePath) {
        continue;
      }

      results.set(sourcePath, {
        dateTimeOriginal: parseDateTime(entry.DateTimeOriginal ?? entry.CreateDate) ?? null,
        isoSpeedRating: entry.ISO ?? null,
        focalLength: parseFocalLength(entry.FocalLength ?? entry.FocalLengthIn35mmFormat),
        aperture: entry.Aperture ?? entry.FNumber ?? null,
        shutterSpeed: parseShutterSpeed(entry.ShutterSpeed ?? entry.ExposureTime),
        flashFired: parseFlashNumeric(entry.Flash),
        whiteBalance: typeof entry.WhiteBalance === "string" ? entry.WhiteBalance : null,
        cameraModel: entry.Model ?? null,
        lensModel: entry.LensModel ?? entry.LensID ?? null,
        gpsLatitude: typeof entry.GPSLatitude === "number" ? entry.GPSLatitude : null,
        gpsLongitude: typeof entry.GPSLongitude === "number" ? entry.GPSLongitude : null,
      });
    }

    // Fill in missing entries with null data
    for (const fp of filePaths) {
      if (!results.has(fp)) {
        results.set(fp, nullExifData());
      }
    }
  } catch (err) {
    console.error("[ExifReader] Batch EXIF extraction failed:", err);
    for (const fp of filePaths) {
      if (!results.has(fp)) {
        results.set(fp, nullExifData());
      }
    }
  }

  return results;
}

// --- Internal helpers ---

/**
 * Run exiftool and parse JSON output for a single file.
 */
async function runExiftool(filePath: string, tags: string[]): Promise<ExifToolOutput> {
  const args = [
    "-json",
    "-n", // numeric output for GPS, flash codes, etc.
    ...tags,
    filePath,
  ];

  const { stdout } = await execFileAsync("exiftool", args, {
    timeout: 10_000,
    maxBuffer: 1024 * 1024,
  });

  const parsed = JSON.parse(stdout);
  if (!Array.isArray(parsed) || parsed.length === 0) {
    return {};
  }

  return parsed[0] as ExifToolOutput;
}

/**
 * Parse an EXIF date string like "2024:06:15 14:30:22" into ISO 8601.
 */
function parseDateTime(value: string | number | undefined): string | null {
  if (value === undefined || value === null) {
    return null;
  }

  const str = String(value);

  // EXIF format: "2024:06:15 14:30:22" or "2024:06:15 14:30:22+05:00"
  const exifMatch = str.match(/^(\d{4}):(\d{2}):(\d{2})\s+(\d{2}):(\d{2}):(\d{2})/);
  if (exifMatch) {
    const [, y, m, d, h, min, s] = exifMatch;
    const date = new Date(`${y}-${m}-${d}T${h}:${min}:${s}`);
    if (!isNaN(date.getTime())) {
      return date.toISOString();
    }
  }

  // Try ISO 8601 directly
  const date = new Date(str);
  if (!isNaN(date.getTime())) {
    return date.toISOString();
  }

  return null;
}

/**
 * Parse focal length from exiftool output.
 * Can be "85 mm", "85.0 mm", or just a number.
 */
function parseFocalLength(value: string | number | undefined): number | null {
  if (value === undefined || value === null) {
    return null;
  }
  if (typeof value === "number") {
    return value;
  }

  const match = String(value).match(/([\d.]+)/);
  return match ? parseFloat(match[1]) : null;
}

/**
 * Parse shutter speed from exiftool output.
 * Can be "1/200", "1/60", "0.5", "2", or a number.
 * Returns value in seconds.
 */
function parseShutterSpeed(value: string | number | undefined): number | null {
  if (value === undefined || value === null) {
    return null;
  }

  if (typeof value === "number") {
    // In -n mode, exiftool returns exposure time directly in seconds
    return value;
  }

  const str = String(value);

  // Fraction format: "1/200"
  const fracMatch = str.match(/^(\d+)\/(\d+)/);
  if (fracMatch) {
    const num = parseInt(fracMatch[1], 10);
    const den = parseInt(fracMatch[2], 10);
    return den > 0 ? num / den : null;
  }

  // Decimal seconds
  const num = parseFloat(str);
  return isNaN(num) ? null : num;
}

/**
 * Parse flash field from exiftool string output.
 * Returns true if flash fired, false if not, null if unknown.
 */
function parseFlash(value: string | number | undefined): boolean | null {
  if (value === undefined || value === null) {
    return null;
  }

  // In -n mode, flash is a numeric code
  if (typeof value === "number") {
    return parseFlashNumeric(value);
  }

  const str = String(value).toLowerCase();
  if (str.includes("fired") || str.includes("on")) {
    return true;
  }
  if (str.includes("no flash") || str.includes("off") || str.includes("did not fire")) {
    return false;
  }

  return null;
}

/**
 * Parse numeric flash code (EXIF standard).
 * Bit 0 = flash fired.
 */
function parseFlashNumeric(value: string | number | undefined): boolean | null {
  if (value === undefined || value === null) {
    return null;
  }
  const code = typeof value === "number" ? value : parseInt(String(value), 10);
  if (isNaN(code)) {
    return null;
  }

  // EXIF flash code bit 0: 1 = fired, 0 = did not fire
  return (code & 0x01) === 1;
}

/**
 * Parse GPS coordinate from exiftool output.
 * In -n mode, returns a signed decimal number directly.
 * In string mode, may be like "37 deg 46' 30.00\" N".
 */
function parseGpsCoord(value: string | number | undefined): number | null {
  if (value === undefined || value === null) {
    return null;
  }

  if (typeof value === "number") {
    return value;
  }

  const str = String(value);

  // DMS format: 37 deg 46' 30.00" N
  const dmsMatch = str.match(/([\d.]+)\s*deg\s*([\d.]+)'\s*([\d.]+)"\s*([NSEW])?/i);
  if (dmsMatch) {
    const [, deg, min, sec, dir] = dmsMatch;
    let coord = parseFloat(deg) + parseFloat(min) / 60 + parseFloat(sec) / 3600;
    if (dir === "S" || dir === "W" || dir === "s" || dir === "w") {
      coord = -coord;
    }
    return coord;
  }

  // Try plain number
  const num = parseFloat(str);
  return isNaN(num) ? null : num;
}

/**
 * Return a CatalogExifData with all fields set to null.
 */
function nullExifData(): CatalogExifData {
  return {
    dateTimeOriginal: null,
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
