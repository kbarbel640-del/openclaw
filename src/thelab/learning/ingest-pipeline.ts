import { createHash } from "node:crypto";
import { classifyImage } from "../vision/vlm-adapter.js";
import type { VlmAdapterConfig } from "../vision/vlm-adapter.js";
import { CatalogIngester } from "./catalog-ingester.js";
import type { CatalogPhotoRecord } from "./catalog-ingester.js";
import { SceneClassifier } from "./scene-classifier.js";
import { StyleDatabase } from "./style-db.js";
import type { PhotoEditRecord } from "./style-db.js";

export interface IngestProgress {
  total: number;
  processed: number;
  stored: number;
  skipped: number;
  errors: number;
  scenariosFound: number;
}

export interface IngestCallbacks {
  onProgress?: (progress: IngestProgress) => void;
  onPhotoProcessed?: (photo: CatalogPhotoRecord, scenario: string) => void;
  onError?: (photo: CatalogPhotoRecord, error: string) => void;
  onComplete?: (progress: IngestProgress) => void;
}

/**
 * Orchestrates the full catalog ingestion pipeline:
 *
 * 1. Open the .lrcat catalog (read-only)
 * 2. Extract all edited photos with develop settings + EXIF
 * 3. Classify each photo into a scenario
 * 4. Compute edit deltas (what the photographer changed vs defaults)
 * 5. Store everything in the style database
 * 6. Recompute per-scenario statistical profiles
 */
export class IngestPipeline {
  private catalogPath: string;
  private styleDbPath: string;
  private classifier: SceneClassifier;
  private callbacks: IngestCallbacks;
  /** Optional VLM config for vision-augmented classification during ingestion */
  private vlmConfig: VlmAdapterConfig | null;

  constructor(
    catalogPath: string,
    styleDbPath: string,
    callbacks: IngestCallbacks = {},
    vlmConfig?: VlmAdapterConfig,
  ) {
    this.catalogPath = catalogPath;
    this.styleDbPath = styleDbPath;
    this.classifier = new SceneClassifier();
    this.callbacks = callbacks;
    this.vlmConfig = vlmConfig ?? null;
  }

  /**
   * Run the full ingestion pipeline.
   */
  async run(limit?: number): Promise<IngestProgress> {
    const progress: IngestProgress = {
      total: 0,
      processed: 0,
      stored: 0,
      skipped: 0,
      errors: 0,
      scenariosFound: 0,
    };

    const ingester = new CatalogIngester(this.catalogPath);
    const styleDb = new StyleDatabase(this.styleDbPath);

    try {
      ingester.open();

      const totalImages = ingester.getImageCount();
      const editedCount = ingester.getEditedImageCount();
      console.log(`[IngestPipeline] Catalog: ${totalImages} total images, ${editedCount} edited`);

      // Step 1: Extract all edited photos
      console.log("[IngestPipeline] Extracting edited photos...");
      const photos = ingester.extractEditedPhotos(limit);
      progress.total = photos.length;
      console.log(`[IngestPipeline] Extracted ${photos.length} edited photos`);

      // Step 2-4: Classify, compute deltas, store
      const batch: PhotoEditRecord[] = [];
      const scenariosSeenSet = new Set<string>();

      for (const photo of photos) {
        try {
          if (!photo.hasBeenEdited || Object.keys(photo.developSettings).length === 0) {
            progress.skipped++;
            continue;
          }

          // Classify the scene (EXIF + optional VLM)
          const exifClassification = this.classifier.classifyFromExif(photo.exif);
          let classification = exifClassification;

          // Optional VLM vision-augmented classification
          if (this.vlmConfig?.enabled && photo.filePath) {
            try {
              const visionResult = await classifyImage(photo.filePath, this.vlmConfig);
              if (visionResult.confidence > 0) {
                classification = this.classifier.mergeVisionClassification(
                  exifClassification,
                  visionResult,
                );
              }
            } catch {
              // VLM failure is non-fatal — fall back to EXIF-only
            }
          }

          const key = styleDb.ensureScenario(classification);
          scenariosSeenSet.add(key);

          // Compute edit delta
          const delta = CatalogIngester.computeEditDelta(photo.developSettings);
          if (Object.keys(delta).length === 0) {
            progress.skipped++;
            continue;
          }

          // Build the photo edit record
          const photoHash = createHash("sha256")
            .update(photo.filePath + photo.imageId)
            .digest("hex")
            .slice(0, 16);

          batch.push({
            photoHash,
            scenarioKey: key,
            exifJson: JSON.stringify(photo.exif),
            adjustmentsJson: JSON.stringify(delta),
            editedAt: photo.exif.dateTimeOriginal ?? new Date().toISOString(),
            source: "catalog",
          });

          progress.processed++;
          this.callbacks.onPhotoProcessed?.(photo, key);
        } catch (error) {
          progress.errors++;
          const msg = error instanceof Error ? error.message : String(error);
          this.callbacks.onError?.(photo, msg);
        }

        // Report progress every 100 photos
        if ((progress.processed + progress.skipped + progress.errors) % 100 === 0) {
          this.callbacks.onProgress?.(progress);
        }
      }

      // Step 5: Batch insert all photo edits
      if (batch.length > 0) {
        console.log(`[IngestPipeline] Storing ${batch.length} photo edits...`);
        progress.stored = styleDb.storePhotoEditBatch(batch);
      }

      progress.scenariosFound = scenariosSeenSet.size;
      console.log(`[IngestPipeline] Found ${progress.scenariosFound} distinct scenarios`);

      // Step 6: Recompute all scenario profiles
      console.log("[IngestPipeline] Computing scenario profiles...");
      const profilesComputed = styleDb.recomputeAllProfiles();
      console.log(`[IngestPipeline] Computed ${profilesComputed} scenario profiles`);

      // Store metadata
      styleDb.setMeta("last_ingest", new Date().toISOString());
      styleDb.setMeta("catalog_path", this.catalogPath);
      styleDb.setMeta("total_edits_ingested", String(progress.stored));

      this.callbacks.onComplete?.(progress);
    } finally {
      ingester.close();
      styleDb.close();
    }

    return progress;
  }
}

/**
 * CLI-friendly runner for the ingest pipeline.
 *
 * Usage:
 *   npx tsx src/thelab/learning/ingest-pipeline.ts \
 *     --catalog ~/Pictures/Lightroom/MyCatalog.lrcat \
 *     --db ~/.thelab/style.db \
 *     [--limit 500]
 */
async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const parsed: Record<string, string> = {};

  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith("--")) {
      const key = args[i].slice(2);
      const value = args[i + 1];
      if (value && !value.startsWith("--")) {
        parsed[key] = value;
        i++;
      }
    }
  }

  const catalogPath = parsed["catalog"];
  const dbPath = parsed["db"] ?? "~/.thelab/style.db";
  const limit = parsed["limit"] ? Number.parseInt(parsed["limit"], 10) : undefined;

  if (!catalogPath) {
    console.error(
      "Usage: npx tsx src/thelab/learning/ingest-pipeline.ts --catalog <path> [--db <path>] [--limit N]",
    );
    process.exit(1);
  }

  const resolvedCatalog = catalogPath.replace(/^~/, process.env.HOME ?? "~");
  const resolvedDb = dbPath.replace(/^~/, process.env.HOME ?? "~");

  console.log("=".repeat(60));
  console.log("  THE LAB — Catalog Ingestion");
  console.log("=".repeat(60));
  console.log(`  Catalog:  ${resolvedCatalog}`);
  console.log(`  Style DB: ${resolvedDb}`);
  if (limit) {
    console.log(`  Limit:    ${limit} photos`);
  }
  console.log("=".repeat(60));

  const pipeline = new IngestPipeline(resolvedCatalog, resolvedDb, {
    onProgress: (p) => {
      console.log(`  Progress: ${p.processed} processed, ${p.skipped} skipped, ${p.errors} errors`);
    },
    onComplete: (p) => {
      console.log("\n" + "=".repeat(60));
      console.log("  Ingestion Complete");
      console.log("=".repeat(60));
      console.log(`  Total photos:     ${p.total}`);
      console.log(`  Processed:        ${p.processed}`);
      console.log(`  Stored:           ${p.stored}`);
      console.log(`  Skipped:          ${p.skipped}`);
      console.log(`  Errors:           ${p.errors}`);
      console.log(`  Scenarios found:  ${p.scenariosFound}`);
      console.log("=".repeat(60));
    },
  });

  await pipeline.run(limit);
}

// Run if executed directly
const isMainModule =
  import.meta.url === `file://${process.argv[1]}` ||
  process.argv[1]?.endsWith("ingest-pipeline.ts");

if (isMainModule) {
  main().catch((err) => {
    console.error("Fatal error:", err);
    process.exit(1);
  });
}
