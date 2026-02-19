#!/usr/bin/env node
/**
 * The Lab — Session Runner
 *
 * CLI entry point for running an editing session using learned profiles.
 *
 * Usage:
 *   # Learn from your catalog first:
 *   npx tsx src/thelab/run.ts learn [--catalog <path>] [--limit N]
 *
 *   # Edit photos using your learned style:
 *   npx tsx src/thelab/run.ts edit --folder <path> [--confidence 0.75]
 *
 *   # Show your editing DNA:
 *   npx tsx src/thelab/run.ts profile [--db <path>]
 *
 *   # Validate accuracy against your existing edits:
 *   npx tsx src/thelab/run.ts validate [--catalog <path>] [--sample 50]
 */

import fs from "node:fs/promises";
import path from "node:path";
import { DEFAULT_CONFIG } from "./config/defaults.js";
import { resolveConfigPaths } from "./config/thelab-config.js";
import { discoverActiveCatalog, discoverCatalogs } from "./learning/catalog-discovery.js";
import { IngestPipeline } from "./learning/ingest-pipeline.js";
import { StyleDatabase } from "./learning/style-db.js";
import { EditingLoop } from "./loop/editing-loop.js";
import type { SessionStats } from "./loop/editing-loop.js";
import { ImageQueue } from "./loop/queue.js";
import { SessionNotifier } from "./notifications/imessage.js";

function parseArgs(): { command: string; flags: Record<string, string> } {
  const args = process.argv.slice(2);
  const command = args[0] && !args[0].startsWith("--") ? args[0] : "edit";
  const flags: Record<string, string> = {};

  for (let i = command === args[0] ? 1 : 0; i < args.length; i++) {
    if (args[i].startsWith("--")) {
      const key = args[i].slice(2);
      const value = args[i + 1];
      if (value && !value.startsWith("--")) {
        flags[key] = value;
        i++;
      } else {
        flags[key] = "true";
      }
    }
  }

  return { command, flags };
}

function resolvePath(p: string): string {
  return p.replace(/^~/, process.env.HOME ?? "~");
}

function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  if (hours > 0) {
    return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
  }
  if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  }
  return `${seconds}s`;
}

// --- LEARN command ---

async function runLearn(flags: Record<string, string>): Promise<void> {
  let catalogPath = flags["catalog"];

  if (!catalogPath) {
    console.log("[The Lab] Searching for Lightroom catalogs...\n");
    const catalogs = discoverCatalogs();

    if (catalogs.length === 0) {
      console.error("No Lightroom catalogs found. Use --catalog <path> to specify one.");
      process.exit(1);
    }

    console.log("  Found catalogs:");
    for (const cat of catalogs) {
      const sizeMb = (cat.sizeBytes / 1_048_576).toFixed(1);
      console.log(
        `    ${cat.name} (${sizeMb} MB, modified ${cat.lastModified.toLocaleDateString()})`,
      );
      console.log(`    ${cat.path}`);
    }

    catalogPath = catalogs[0].path;
    console.log(`\n  Using most recent: ${catalogs[0].name}\n`);
  } else {
    catalogPath = resolvePath(catalogPath);
  }

  const dbPath = resolvePath(flags["db"] ?? "~/.thelab/style.db");
  const limit = flags["limit"] ? Number.parseInt(flags["limit"], 10) : undefined;

  console.log("=".repeat(60));
  console.log("  THE LAB — Learning Your Style");
  console.log("=".repeat(60));
  console.log(`  Catalog:  ${catalogPath}`);
  console.log(`  Style DB: ${dbPath}`);
  if (limit) {
    console.log(`  Limit:    ${limit} photos`);
  }
  console.log("=".repeat(60) + "\n");

  const pipeline = new IngestPipeline(catalogPath, dbPath, {
    onProgress: (p) => {
      process.stdout.write(
        `\r  Progress: ${p.processed} processed, ${p.skipped} skipped, ${p.errors} errors`,
      );
    },
    onComplete: (p) => {
      console.log("\n\n" + "=".repeat(60));
      console.log("  Learning Complete");
      console.log("=".repeat(60));
      console.log(`  Photos analyzed:  ${p.total}`);
      console.log(`  Profiles stored:  ${p.stored}`);
      console.log(`  Scenarios found:  ${p.scenariosFound}`);
      console.log(`  Skipped:          ${p.skipped}`);
      console.log(`  Errors:           ${p.errors}`);
      console.log("=".repeat(60));
      console.log("\n  Run 'npx tsx src/thelab/run.ts profile' to see your editing DNA.\n");
    },
  });

  await pipeline.run(limit);
}

// --- EDIT command ---

async function runEdit(flags: Record<string, string>): Promise<void> {
  const folder = flags["folder"];
  if (!folder) {
    console.error("Usage: npx tsx src/thelab/run.ts edit --folder <path>");
    process.exit(1);
  }

  const repoRoot = import.meta.dirname ? path.resolve(import.meta.dirname, "../..") : process.cwd();

  const dbPath = resolvePath(flags["db"] ?? "~/.thelab/style.db");
  const confidence = Number.parseFloat(flags["confidence"] ?? "0.75");
  const maxAdj = Number.parseInt(flags["max-adjustments"] ?? "8", 10);
  const imessageTo = flags["notify"];

  const config = resolveConfigPaths(
    {
      ...DEFAULT_CONFIG,
      lightroom: {
        ...DEFAULT_CONFIG.lightroom,
        confidenceThreshold: confidence,
        maxAdjustmentsPerImage: maxAdj,
      },
    },
    repoRoot,
  );

  // Check style DB exists
  try {
    await fs.access(dbPath);
  } catch {
    console.error(`Style database not found: ${dbPath}`);
    console.error("Run 'npx tsx src/thelab/run.ts learn' first to build your editing profile.");
    process.exit(1);
  }

  const queue = new ImageQueue();
  const imageCount = await queue.loadFromFolder(resolvePath(folder));

  if (imageCount === 0) {
    console.error(`No supported images found in: ${folder}`);
    process.exit(1);
  }

  const notifier = imessageTo
    ? new SessionNotifier(imessageTo, true, config.notifications.progressInterval)
    : null;

  console.log("\n" + "=".repeat(60));
  console.log("  THE LAB — Editing Session");
  console.log("=".repeat(60));
  console.log(`  Folder:          ${folder}`);
  console.log(`  Images found:    ${imageCount}`);
  console.log(`  Style DB:        ${dbPath}`);
  console.log(`  Confidence:      ${confidence}`);
  console.log(`  Max adjustments: ${maxAdj}`);
  console.log(`  Notifications:   ${imessageTo ?? "disabled (use --notify <phone>)"}`);
  console.log("=".repeat(60) + "\n");

  await notifier?.notifySessionStart(imageCount, "learned profile");

  const loop = new EditingLoop(config, dbPath, queue.getAll(), {
    onImageStart: (imageId, index, total) => {
      console.log(`\n[${index + 1}/${total}] Starting: ${imageId}`);
    },
    onImageClassified: (imageId, classification, profile) => {
      const label = `${classification.timeOfDay}/${classification.location}/${classification.lighting}`;
      console.log(
        `  Scene: ${label} (${profile ? profile.sampleCount + " samples" : "no profile"})`,
      );
    },
    onImageComplete: (imageId, analysis) => {
      console.log(
        `  Done: ${imageId} — confidence ${analysis.confidence.toFixed(2)}, ` +
          `${analysis.adjustments.length} adjustments`,
      );
    },
    onImageFlagged: (imageId, reason) => {
      console.log(`  FLAGGED: ${imageId} — ${reason}`);
    },
    onImageError: (imageId, error) => {
      console.error(`  ERROR: ${imageId} — ${error}`);
    },
    onProgressMilestone: (completed, total) => {
      const progress = loop.getSession().getCurrentProgress();
      console.log(`\n  Progress: ${completed}/${total} images complete\n`);
      void notifier?.notifyProgress(completed, total, progress.flagged);
    },
    onSessionComplete: async (stats) => {
      printStats(stats);
      await notifier?.notifySessionComplete(stats);
    },
  });

  process.on("SIGINT", () => {
    console.log("\nReceived SIGINT — gracefully stopping...");
    loop.abort();
  });

  process.on("SIGTERM", () => {
    console.log("\nReceived SIGTERM — gracefully stopping...");
    loop.abort();
  });

  await loop.run();
}

// --- PROFILE command ---

async function runProfile(flags: Record<string, string>): Promise<void> {
  const dbPath = resolvePath(flags["db"] ?? "~/.thelab/style.db");

  try {
    await fs.access(dbPath);
  } catch {
    console.error(`Style database not found: ${dbPath}`);
    console.error("Run 'npx tsx src/thelab/run.ts learn' first.");
    process.exit(1);
  }

  const db = new StyleDatabase(dbPath);
  const scenarios = db.listScenarios();
  const totalEdits = db.getEditCount();
  const lastIngest = db.getMeta("last_ingest");

  console.log("\n" + "=".repeat(60));
  console.log("  THE LAB — Your Editing DNA");
  console.log("=".repeat(60));
  console.log(`  Total edits learned:  ${totalEdits}`);
  console.log(`  Scenarios discovered: ${scenarios.length}`);
  console.log(`  Last ingestion:       ${lastIngest ?? "never"}`);
  console.log("=".repeat(60));

  if (scenarios.length === 0) {
    console.log("\n  No scenarios found. Run 'learn' first.\n");
    db.close();
    return;
  }

  console.log("\n  Your editing scenarios (by frequency):\n");

  for (const scenario of scenarios) {
    const profile = db.getProfile(scenario.key);
    if (!profile) {
      continue;
    }

    console.log(`  📸 ${scenario.label} (${scenario.sampleCount} photos)`);

    const topAdjustments = Object.entries(profile.adjustments)
      .filter(([, stats]) => Math.abs(stats.median) > 0.5)
      .toSorted((a, b) => Math.abs(b[1].median) - Math.abs(a[1].median))
      .slice(0, 5);

    for (const [control, stats] of topAdjustments) {
      const sign = stats.median > 0 ? "+" : "";
      const consistency = stats.stdDev < Math.abs(stats.median) * 0.5 ? "consistent" : "varies";
      console.log(
        `     ${control}: ${sign}${stats.median.toFixed(1)} (${consistency}, ${stats.sampleCount} samples)`,
      );
    }
    console.log();
  }

  db.close();
}

// --- VALIDATE command ---

async function runValidate(flags: Record<string, string>): Promise<void> {
  let catalogPath = flags["catalog"];

  if (!catalogPath) {
    const active = discoverActiveCatalog();
    if (!active) {
      console.error("No Lightroom catalog found. Use --catalog <path>.");
      process.exit(1);
    }
    catalogPath = active.path;
  } else {
    catalogPath = resolvePath(catalogPath);
  }

  const dbPath = resolvePath(flags["db"] ?? "~/.thelab/style.db");
  const sampleSize = Number.parseInt(flags["sample"] ?? "50", 10);

  try {
    await fs.access(dbPath);
  } catch {
    console.error(`Style database not found: ${dbPath}`);
    console.error("Run 'learn' first.");
    process.exit(1);
  }

  const { CatalogIngester } = await import("./learning/catalog-ingester.js");
  const { SceneClassifier } = await import("./learning/scene-classifier.js");

  const ingester = new CatalogIngester(catalogPath);
  const classifier = new SceneClassifier();
  const db = new StyleDatabase(dbPath);

  try {
    ingester.open();
    const photos = ingester.extractEditedPhotos(sampleSize);

    console.log("\n" + "=".repeat(60));
    console.log("  THE LAB — Validation");
    console.log("=".repeat(60));
    console.log(`  Sample size:  ${photos.length} photos`);
    console.log(`  Catalog:      ${catalogPath}`);
    console.log(`  Style DB:     ${dbPath}`);
    console.log("=".repeat(60) + "\n");

    let totalError = 0;
    let matchedPhotos = 0;
    let noProfilePhotos = 0;
    const perControlErrors: Record<string, { total: number; count: number }> = {};

    for (const photo of photos) {
      if (!photo.hasBeenEdited) {
        continue;
      }

      const classification = classifier.classifyFromExif(photo.exif);
      const profile = db.findClosestProfile(classification);

      if (!profile) {
        noProfilePhotos++;
        continue;
      }

      const actualDelta = CatalogIngester.computeEditDelta(photo.developSettings);
      let photoError = 0;
      let photoControls = 0;

      for (const [control, stats] of Object.entries(profile.adjustments)) {
        const actual = actualDelta[control] ?? 0;
        const predicted = stats.median;
        const error = Math.abs(actual - predicted);

        photoError += error;
        photoControls++;

        if (!perControlErrors[control]) {
          perControlErrors[control] = { total: 0, count: 0 };
        }
        perControlErrors[control].total += error;
        perControlErrors[control].count++;
      }

      if (photoControls > 0) {
        totalError += photoError / photoControls;
        matchedPhotos++;
      }
    }

    if (matchedPhotos === 0) {
      console.log("  No photos could be validated. Build more profiles first.\n");
      return;
    }

    const avgError = totalError / matchedPhotos;
    // Normalize to a 0-100% accuracy score
    // Typical slider ranges are ~200 units (e.g., -100 to +100)
    const accuracy = Math.max(0, Math.min(100, 100 - (avgError / 2) * 100));

    console.log(`  Photos validated:     ${matchedPhotos}`);
    console.log(`  No profile available: ${noProfilePhotos}`);
    console.log(`  Average error:        ${avgError.toFixed(2)} slider units`);
    console.log(`  Style match accuracy: ${accuracy.toFixed(1)}%`);
    console.log();

    console.log("  Per-control accuracy:");
    const sorted = Object.entries(perControlErrors)
      .map(([control, { total, count }]) => ({
        control,
        avgError: total / count,
        accuracy: Math.max(0, Math.min(100, 100 - (total / count / 2) * 100)),
      }))
      .toSorted((a, b) => b.accuracy - a.accuracy);

    for (const { control, accuracy: acc } of sorted.slice(0, 10)) {
      const bar = "█".repeat(Math.round(acc / 5)) + "░".repeat(20 - Math.round(acc / 5));
      console.log(`    ${control.padEnd(20)} ${bar} ${acc.toFixed(0)}%`);
    }

    console.log("\n" + "=".repeat(60) + "\n");
  } finally {
    ingester.close();
    db.close();
  }
}

// --- Stats printer ---

function printStats(stats: SessionStats): void {
  const savedHours = Math.round((stats.completed * 2.5) / 60);
  console.log("\n" + "=".repeat(60));
  console.log("  THE LAB — Session Complete");
  console.log("=".repeat(60));
  console.log(`  Total images:      ${stats.totalImages}`);
  console.log(`  Completed:         ${stats.completed}`);
  console.log(`  Flagged:           ${stats.flagged}`);
  console.log(`  Errors:            ${stats.errors}`);
  console.log(`  Scenarios used:    ${stats.scenariosUsed}`);
  console.log(`  Elapsed time:      ${formatDuration(stats.elapsedMs)}`);
  console.log(`  Avg per image:     ${formatDuration(stats.avgMsPerImage)}`);
  console.log(`  Est. time saved:   ~${savedHours} hours`);
  console.log("=".repeat(60) + "\n");
}

// --- Main ---

async function main(): Promise<void> {
  const { command, flags } = parseArgs();

  switch (command) {
    case "learn":
      await runLearn(flags);
      break;
    case "edit":
      await runEdit(flags);
      break;
    case "profile":
      await runProfile(flags);
      break;
    case "validate":
      await runValidate(flags);
      break;
    default:
      console.log("The Lab — Your Editing Clone\n");
      console.log("Commands:");
      console.log("  learn      Learn your editing style from a Lightroom catalog");
      console.log("  edit       Edit photos using your learned style");
      console.log("  profile    View your editing DNA");
      console.log("  validate   Test accuracy against your actual edits");
      console.log("\nRun any command with --help for details.");
      break;
  }
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
