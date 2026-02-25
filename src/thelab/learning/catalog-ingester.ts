import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { inflateSync } from "node:zlib";

/**
 * Raw develop settings extracted from a Lightroom catalog image.
 * Maps Lightroom's internal setting names to their numeric values.
 */
export interface DevelopSettings {
  [key: string]: number | string | null;
}

/**
 * EXIF metadata extracted from the Lightroom catalog.
 */
export interface CatalogExifData {
  dateTimeOriginal: string | null;
  isoSpeedRating: number | null;
  focalLength: number | null;
  aperture: number | null;
  shutterSpeed: number | null;
  flashFired: boolean | null;
  whiteBalance: string | null;
  cameraModel: string | null;
  lensModel: string | null;
  gpsLatitude: number | null;
  gpsLongitude: number | null;
}

/**
 * A fully extracted photo record from the Lightroom catalog.
 */
export interface CatalogPhotoRecord {
  imageId: string;
  fileName: string;
  filePath: string;
  rating: number | null;
  pickStatus: number | null;
  exif: CatalogExifData;
  developSettings: DevelopSettings;
  hasBeenEdited: boolean;
}

/**
 * Lightroom's internal develop setting names mapped to our normalized control names.
 */
const LR_SETTING_MAP: Record<string, string> = {
  Exposure2012: "exposure",
  Contrast2012: "contrast",
  Highlights2012: "highlights",
  Shadows2012: "shadows",
  Whites2012: "whites",
  Blacks2012: "blacks",
  Temperature: "temp",
  Tint: "tint",
  Vibrance: "vibrance",
  Saturation: "saturation",
  Clarity2012: "clarity",
  Dehaze: "dehaze",
  Texture: "texture",
  GrainAmount: "grain_amount",
  GrainSize: "grain_size",
  GrainFrequency: "grain_roughness",
  PostCropVignetteAmount: "vignette_amount",
  ParametricShadows: "tone_curve_shadows",
  ParametricDarks: "tone_curve_darks",
  ParametricLights: "tone_curve_lights",
  ParametricHighlights: "tone_curve_highlights",
  HueAdjustmentRed: "hsl_hue_red",
  HueAdjustmentOrange: "hsl_hue_orange",
  HueAdjustmentYellow: "hsl_hue_yellow",
  HueAdjustmentGreen: "hsl_hue_green",
  HueAdjustmentAqua: "hsl_hue_aqua",
  HueAdjustmentBlue: "hsl_hue_blue",
  HueAdjustmentPurple: "hsl_hue_purple",
  HueAdjustmentMagenta: "hsl_hue_magenta",
  SaturationAdjustmentRed: "hsl_sat_red",
  SaturationAdjustmentOrange: "hsl_sat_orange",
  SaturationAdjustmentYellow: "hsl_sat_yellow",
  SaturationAdjustmentGreen: "hsl_sat_green",
  SaturationAdjustmentAqua: "hsl_sat_aqua",
  SaturationAdjustmentBlue: "hsl_sat_blue",
  SaturationAdjustmentPurple: "hsl_sat_purple",
  SaturationAdjustmentMagenta: "hsl_sat_magenta",
  LuminanceAdjustmentRed: "hsl_lum_red",
  LuminanceAdjustmentOrange: "hsl_lum_orange",
  LuminanceAdjustmentYellow: "hsl_lum_yellow",
  LuminanceAdjustmentGreen: "hsl_lum_green",
  LuminanceAdjustmentAqua: "hsl_lum_aqua",
  LuminanceAdjustmentBlue: "hsl_lum_blue",
  LuminanceAdjustmentPurple: "hsl_lum_purple",
  LuminanceAdjustmentMagenta: "hsl_lum_magenta",
};

/**
 * Default "zero" values for Lightroom develop settings.
 * These represent an unedited image's baseline.
 */
const LR_DEFAULTS: Record<string, number> = {
  exposure: 0,
  contrast: 0,
  highlights: 0,
  shadows: 0,
  whites: 0,
  blacks: 0,
  temp: 5500,
  tint: 0,
  vibrance: 0,
  saturation: 0,
  clarity: 0,
  dehaze: 0,
  texture: 0,
  grain_amount: 0,
  grain_size: 25,
  grain_roughness: 50,
  vignette_amount: 0,
  tone_curve_shadows: 0,
  tone_curve_darks: 0,
  tone_curve_lights: 0,
  tone_curve_highlights: 0,
  hsl_hue_red: 0,
  hsl_hue_orange: 0,
  hsl_hue_yellow: 0,
  hsl_hue_green: 0,
  hsl_hue_aqua: 0,
  hsl_hue_blue: 0,
  hsl_hue_purple: 0,
  hsl_hue_magenta: 0,
  hsl_sat_red: 0,
  hsl_sat_orange: 0,
  hsl_sat_yellow: 0,
  hsl_sat_green: 0,
  hsl_sat_aqua: 0,
  hsl_sat_blue: 0,
  hsl_sat_purple: 0,
  hsl_sat_magenta: 0,
  hsl_lum_red: 0,
  hsl_lum_orange: 0,
  hsl_lum_yellow: 0,
  hsl_lum_green: 0,
  hsl_lum_aqua: 0,
  hsl_lum_blue: 0,
  hsl_lum_purple: 0,
  hsl_lum_magenta: 0,
};

export { LR_DEFAULTS };

function safeCatalogScalarToString(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }
  if (typeof value === "number") {
    return String(value);
  }
  if (typeof value === "bigint") {
    return value.toString();
  }
  if (typeof value === "boolean") {
    return value ? "true" : "false";
  }
  if (value == null) {
    return "";
  }
  try {
    return JSON.stringify(value);
  } catch {
    return "[unstringifiable]";
  }
}

/**
 * Reads a Lightroom Classic .lrcat catalog (SQLite) and extracts
 * develop settings + EXIF metadata for all edited photos.
 *
 * Opens the catalog in read-only mode so it can run while Lightroom is open.
 */
export class CatalogIngester {
  private db: InstanceType<typeof DatabaseSync> | null = null;
  private catalogPath: string;

  constructor(catalogPath: string) {
    this.catalogPath = catalogPath;
  }

  open(): void {
    if (!fs.existsSync(this.catalogPath)) {
      throw new Error(`Catalog not found: ${this.catalogPath}`);
    }
    this.db = new DatabaseSync(this.catalogPath, { readOnly: true });
  }

  close(): void {
    this.db?.close();
    this.db = null;
  }

  /**
   * List all tables in the catalog for schema discovery.
   */
  listTables(): string[] {
    this.ensureOpen();
    const rows = this.db!.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name",
    ).all() as Array<{ name: string }>;
    return rows.map((r) => r.name);
  }

  /**
   * Get total count of images in the catalog.
   */
  getImageCount(): number {
    this.ensureOpen();
    const row = this.db!.prepare("SELECT COUNT(*) as cnt FROM Adobe_images").get() as {
      cnt: number;
    };
    return row.cnt;
  }

  /**
   * Get count of images that have been edited (have develop settings).
   */
  getEditedImageCount(): number {
    this.ensureOpen();
    const row = this.db!.prepare(
      `SELECT COUNT(DISTINCT image) as cnt
       FROM Adobe_imageDevelopSettings
       WHERE settingsID IS NOT NULL`,
    ).get() as { cnt: number };
    return row.cnt;
  }

  /**
   * Extract all edited photos with their develop settings and EXIF data.
   * This is the main ingestion method.
   */
  extractEditedPhotos(limit?: number): CatalogPhotoRecord[] {
    this.ensureOpen();

    const query = `
      SELECT
        ai.id_local AS image_id,
        alf.baseName AS file_name,
        alf.pathFromRoot AS path_from_root,
        arf.absolutePath AS root_path,
        ai.rating,
        ai.pick,
        ai.captureTime,
        ae.isoSpeedRating,
        ae.focalLength,
        ae.aperture,
        ae.shutterSpeed,
        ae.flashFired,
        ae.cameraModelRef,
        ae.lensRef,
        ae.gpsLatitude,
        ae.gpsLongitude,
        ae.dateDay,
        ds.text AS develop_text,
        ds.digest
      FROM Adobe_images ai
      JOIN AgLibraryFile alf ON ai.rootFile = alf.id_local
      JOIN AgLibraryFolder afld ON alf.folder = afld.id_local
      JOIN AgLibraryRootFolder arf ON afld.rootFolder = arf.id_local
      LEFT JOIN Adobe_imageProperties ae ON ai.id_local = ae.image
      LEFT JOIN Adobe_imageDevelopSettings ds ON ai.id_local = ds.image
      WHERE ds.settingsID IS NOT NULL
      ORDER BY ai.captureTime DESC
      ${limit ? `LIMIT ${limit}` : ""}
    `;

    const rows = this.db!.prepare(query).all() as Array<Record<string, unknown>>;
    return rows.map((row) => this.buildPhotoRecord(row));
  }

  /**
   * Extract develop settings for a single image by its catalog ID.
   */
  extractSinglePhoto(imageId: number): CatalogPhotoRecord | null {
    this.ensureOpen();

    const query = `
      SELECT
        ai.id_local AS image_id,
        alf.baseName AS file_name,
        alf.pathFromRoot AS path_from_root,
        arf.absolutePath AS root_path,
        ai.rating,
        ai.pick,
        ai.captureTime,
        ae.isoSpeedRating,
        ae.focalLength,
        ae.aperture,
        ae.shutterSpeed,
        ae.flashFired,
        ae.cameraModelRef,
        ae.lensRef,
        ae.gpsLatitude,
        ae.gpsLongitude,
        ae.dateDay,
        ds.text AS develop_text,
        ds.digest
      FROM Adobe_images ai
      JOIN AgLibraryFile alf ON ai.rootFile = alf.id_local
      JOIN AgLibraryFolder afld ON alf.folder = afld.id_local
      JOIN AgLibraryRootFolder arf ON afld.rootFolder = arf.id_local
      LEFT JOIN Adobe_imageProperties ae ON ai.id_local = ae.image
      LEFT JOIN Adobe_imageDevelopSettings ds ON ai.id_local = ds.image
      WHERE ai.id_local = ?
    `;

    const row = this.db!.prepare(query).get(imageId) as Record<string, unknown> | undefined;
    if (!row) {
      return null;
    }
    return this.buildPhotoRecord(row);
  }

  /**
   * Extract a single photo record by its absolute file path.
   *
   * This is used by validation pipelines to map a known file on disk back to
   * its develop settings and EXIF in the Lightroom catalog.
   */
  extractPhotoByFilePath(absoluteFilePath: string): CatalogPhotoRecord | null {
    this.ensureOpen();

    // Reconstruct the absolute path the same way buildPhotoRecord() does:
    // path.join(root_path, path_from_root, file_name)
    //
    // In the catalog, `alf.pathFromRoot` typically includes a trailing slash,
    // so concatenation is sufficient and avoids platform-dependent separators.
    const query = `
      SELECT
        ai.id_local AS image_id,
        alf.baseName AS file_name,
        alf.pathFromRoot AS path_from_root,
        arf.absolutePath AS root_path,
        ai.rating,
        ai.pick,
        ai.captureTime,
        ae.isoSpeedRating,
        ae.focalLength,
        ae.aperture,
        ae.shutterSpeed,
        ae.flashFired,
        ae.cameraModelRef,
        ae.lensRef,
        ae.gpsLatitude,
        ae.gpsLongitude,
        ae.dateDay,
        ds.text AS develop_text,
        ds.digest
      FROM Adobe_images ai
      JOIN AgLibraryFile alf ON ai.rootFile = alf.id_local
      JOIN AgLibraryFolder afld ON alf.folder = afld.id_local
      JOIN AgLibraryRootFolder arf ON afld.rootFolder = arf.id_local
      LEFT JOIN Adobe_imageProperties ae ON ai.id_local = ae.image
      LEFT JOIN Adobe_imageDevelopSettings ds ON ai.id_local = ds.image
      WHERE (arf.absolutePath || alf.pathFromRoot || alf.baseName) = ?
      LIMIT 1
    `;

    const row = this.db!.prepare(query).get(absoluteFilePath) as
      | Record<string, unknown>
      | undefined;
    if (!row) {
      return null;
    }
    return this.buildPhotoRecord(row);
  }

  private buildPhotoRecord(row: Record<string, unknown>): CatalogPhotoRecord {
    const rootPath = (row.root_path as string) ?? "";
    const pathFromRoot = (row.path_from_root as string) ?? "";
    const fileName = (row.file_name as string) ?? "";
    const filePath = path.join(rootPath, pathFromRoot, fileName);

    const exif = this.extractExif(row);
    const developSettings = this.parseDevelopSettings(row.develop_text as string | null);
    const hasBeenEdited = Object.keys(developSettings).length > 0;

    return {
      imageId: String(row.image_id),
      fileName,
      filePath,
      rating: (row.rating as number) ?? null,
      pickStatus: (row.pick as number) ?? null,
      exif,
      developSettings,
      hasBeenEdited,
    };
  }

  private extractExif(row: Record<string, unknown>): CatalogExifData {
    return {
      dateTimeOriginal: (row.captureTime as string) ?? null,
      isoSpeedRating: (row.isoSpeedRating as number) ?? null,
      focalLength: (row.focalLength as number) ?? null,
      aperture: (row.aperture as number) ?? null,
      shutterSpeed: (row.shutterSpeed as number) ?? null,
      flashFired: row.flashFired != null ? Boolean(row.flashFired) : null,
      whiteBalance: null,
      cameraModel:
        row.cameraModelRef != null ? safeCatalogScalarToString(row.cameraModelRef) : null,
      lensModel: row.lensRef != null ? safeCatalogScalarToString(row.lensRef) : null,
      gpsLatitude: (row.gpsLatitude as number) ?? null,
      gpsLongitude: (row.gpsLongitude as number) ?? null,
    };
  }

  /**
   * Parse Lightroom develop settings from the text column or compressed XMP blob.
   * Returns normalized control names mapped to their values.
   */
  private parseDevelopSettings(text: string | null): DevelopSettings {
    if (!text) {
      return {};
    }

    const settings: DevelopSettings = {};

    if (text.startsWith("s = {")) {
      return this.parseLuaSettings(text);
    }

    if (text.includes("<?xml") || text.includes("<x:xmpmeta")) {
      return this.parseXmpSettings(text);
    }

    try {
      const decompressed = this.decompressXmp(text);
      if (decompressed) {
        return this.parseXmpSettings(decompressed);
      }
    } catch {
      // Not compressed, try other formats
    }

    return settings;
  }

  /**
   * Parse Lua-style develop settings (common in older catalogs).
   * Format: s = { key = value, ... }
   */
  private parseLuaSettings(text: string): DevelopSettings {
    const settings: DevelopSettings = {};
    const kvPattern = /(\w+)\s*=\s*([^,}]+)/g;
    let match: RegExpExecArray | null;

    while ((match = kvPattern.exec(text)) !== null) {
      const lrKey = match[1];
      const rawValue = match[2].trim().replace(/^"(.*)"$/, "$1");
      const normalizedKey = LR_SETTING_MAP[lrKey];

      if (normalizedKey) {
        const numVal = Number.parseFloat(rawValue);
        settings[normalizedKey] = Number.isNaN(numVal) ? null : numVal;
      }
    }

    return settings;
  }

  /**
   * Parse XMP-format develop settings.
   * Extracts crs: (Camera Raw Settings) namespace values.
   */
  private parseXmpSettings(xml: string): DevelopSettings {
    const settings: DevelopSettings = {};

    for (const [lrKey, normalizedKey] of Object.entries(LR_SETTING_MAP)) {
      const patterns = [
        new RegExp(`crs:${lrKey}="([^"]*)"`, "i"),
        new RegExp(`crs:${lrKey}>([^<]*)<`, "i"),
        new RegExp(`<crs:${lrKey}>([^<]*)</crs:${lrKey}>`, "i"),
      ];

      for (const pattern of patterns) {
        const match = pattern.exec(xml);
        if (match) {
          const numVal = Number.parseFloat(match[1]);
          settings[normalizedKey] = Number.isNaN(numVal) ? null : numVal;
          break;
        }
      }
    }

    return settings;
  }

  /**
   * Decompress Adobe's modified zlib-compressed XMP blobs.
   * Adobe prepends a 4-byte uncompressed length before the zlib data.
   */
  private decompressXmp(data: string): string | null {
    try {
      const buf = Buffer.from(data, "binary");
      if (buf.length < 6) {
        return null;
      }

      // Try standard zlib first
      try {
        const decompressed = inflateSync(buf);
        return decompressed.toString("utf-8");
      } catch {
        // Adobe's format: skip 4-byte length header
        const payload = buf.subarray(4);
        const decompressed = inflateSync(payload);
        return decompressed.toString("utf-8");
      }
    } catch {
      return null;
    }
  }

  /**
   * Compute the delta between an image's develop settings and the defaults.
   * This represents "what the photographer changed" for this image.
   */
  static computeEditDelta(settings: DevelopSettings): Record<string, number> {
    const delta: Record<string, number> = {};

    for (const [control, defaultVal] of Object.entries(LR_DEFAULTS)) {
      const currentVal = settings[control];
      if (typeof currentVal === "number") {
        const d = currentVal - defaultVal;
        if (Math.abs(d) > 0.001) {
          delta[control] = d;
        }
      }
    }

    return delta;
  }

  private ensureOpen(): void {
    if (!this.db) {
      throw new Error("Catalog not opened. Call open() first.");
    }
  }
}
