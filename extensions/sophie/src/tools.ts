/**
 * Sophie's OpenClaw Tools
 *
 * These register Sophie's domain-specific capabilities as proper OpenClaw tools,
 * making them callable by any LLM through the agent loop. The domain logic
 * stays in src/thelab/; these are the tool wrappers.
 */

import path from "node:path";
import { Type } from "@sinclair/typebox";
import type { AnyAgentTool } from "../../../src/agents/tools/common.js";
import { jsonResult } from "../../../src/agents/tools/common.js";
import { DEFAULT_CONFIG } from "../../../src/thelab/config/defaults.js";
import { resolveConfigPaths } from "../../../src/thelab/config/thelab-config.js";
import { Culler } from "../../../src/thelab/culling/culler.js";
import {
  discoverCatalogs,
  discoverActiveCatalog,
} from "../../../src/thelab/learning/catalog-discovery.js";
import { CatalogIngester } from "../../../src/thelab/learning/catalog-ingester.js";
import { IngestPipeline } from "../../../src/thelab/learning/ingest-pipeline.js";
import {
  SceneClassifier,
  scenarioKey,
  scenarioLabel,
} from "../../../src/thelab/learning/scene-classifier.js";
import { StyleDatabase } from "../../../src/thelab/learning/style-db.js";
import type { ScenarioProfile } from "../../../src/thelab/learning/style-db.js";
import {
  generateStyleReport,
  generateSessionReport,
} from "../../../src/thelab/learning/style-report.js";
import { LightroomController } from "../../../src/thelab/lightroom/controller.js";
import { renderBPrimeMarkdown } from "../../../src/thelab/validation/bprime-render.js";
import { runBPrimeValidation } from "../../../src/thelab/validation/bprime-runner.js";
import {
  profileToAdjustments,
  mergeProfileWithVision,
} from "../../../src/thelab/validation/profile-merge.js";
import { generateCoverageArtifacts } from "../../../src/thelab/validation/toolkit.js";
import { VisionTool } from "../../../src/thelab/vision/vision-tool.js";

let styleDbInstance: StyleDatabase | null = null;

function getStyleDb(dbPath?: string): StyleDatabase {
  const resolvedPath = dbPath ?? resolveConfigPaths({ ...DEFAULT_CONFIG }).learning.styleDbPath;
  if (!styleDbInstance) {
    styleDbInstance = new StyleDatabase(resolvedPath);
  }
  return styleDbInstance;
}

export function createSophieTools(): AnyAgentTool[] {
  return [
    createGetProfileTool(),
    createListScenariosTool(),
    createIngestCatalogTool(),
    createDiscoverCatalogsTool(),
    createClassifySceneTool(),
    createGenerateReportTool(),
    createGetEditStatsTool(),
    createValidateCoverageTool(),
    createValidateBPrimeTool(),
    createCullImagesTool(),
    createGetCorrelationsTool(),
    createFindProfileTool(),
  ];
}

function createGetProfileTool(): AnyAgentTool {
  return {
    name: "sophie_get_profile",
    description:
      "Get the photographer's learned editing profile for a specific scenario. " +
      "Returns statistical data: mean/median/std dev for each slider adjustment " +
      "the photographer typically makes for this type of photo. " +
      "Scenario keys look like: golden_hour::outdoor::natural_bright::portrait",
    parameters: Type.Object({
      scenario_key: Type.String({
        description:
          "The scenario key to look up, e.g. 'golden_hour::outdoor::natural_bright::portrait'",
      }),
      db_path: Type.Optional(
        Type.String({
          description: "Path to the style database. Uses default if not provided.",
        }),
      ),
    }),
    async execute(_id, params: Record<string, unknown>) {
      const key = params.scenario_key as string;
      const db = getStyleDb(params.db_path as string | undefined);
      const profile = db.getProfile(key);

      if (!profile) {
        return jsonResult({
          found: false,
          scenario_key: key,
          message: `No profile found for scenario '${key}'. The photographer may not have enough edits for this scenario.`,
        });
      }

      return jsonResult({
        found: true,
        scenario_key: profile.scenarioKey,
        label: profile.scenarioLabel,
        sample_count: profile.sampleCount,
        last_updated: profile.lastUpdated,
        adjustments: Object.fromEntries(
          Object.entries(profile.adjustments).map(([k, v]) => [
            k,
            {
              mean: Math.round(v.mean * 100) / 100,
              median: Math.round(v.median * 100) / 100,
              std_dev: Math.round(v.stdDev * 100) / 100,
              min: v.min,
              max: v.max,
              samples: v.sampleCount,
            },
          ]),
        ),
        correlations: profile.correlations.slice(0, 5).map((c) => ({
          control_a: c.controlA,
          control_b: c.controlB,
          correlation: Math.round(c.correlation * 100) / 100,
        })),
      });
    },
  };
}

function createListScenariosTool(): AnyAgentTool {
  return {
    name: "sophie_list_scenarios",
    description:
      "List all editing scenarios Sophie has learned from the photographer's catalog. " +
      "Returns each scenario with sample count and confidence level. " +
      "Use this to understand what types of photos Sophie can handle confidently.",
    parameters: Type.Object({
      db_path: Type.Optional(
        Type.String({
          description: "Path to the style database. Uses default if not provided.",
        }),
      ),
    }),
    async execute(_id, params: Record<string, unknown>) {
      const db = getStyleDb(params.db_path as string | undefined);
      const scenarios = db.listScenarios();
      const totalEdits = db.getEditCount();

      return jsonResult({
        total_edits_analyzed: totalEdits,
        scenario_count: scenarios.length,
        scenarios: scenarios.map((s) => ({
          key: s.key,
          label: s.label,
          sample_count: s.sampleCount,
          confidence:
            s.sampleCount >= 20
              ? "high"
              : s.sampleCount >= 10
                ? "good"
                : s.sampleCount >= 3
                  ? "moderate"
                  : "low",
        })),
      });
    },
  };
}

function createIngestCatalogTool(): AnyAgentTool {
  return {
    name: "sophie_ingest_catalog",
    description:
      "Read a Lightroom Classic catalog (.lrcat file) and learn the photographer's editing style. " +
      "This analyzes all edited photos, classifies scenes, computes edit deltas, and builds " +
      "per-scenario statistical profiles. This is how Sophie learns. " +
      "Run this when the photographer wants Sophie to study their past work.",
    parameters: Type.Object({
      catalog_path: Type.Optional(
        Type.String({
          description:
            "Path to the .lrcat file. If not provided, Sophie will try to auto-discover it.",
        }),
      ),
      limit: Type.Optional(
        Type.Number({
          description: "Maximum number of photos to analyze. Useful for testing with a subset.",
        }),
      ),
      db_path: Type.Optional(
        Type.String({
          description: "Path to the style database. Uses default if not provided.",
        }),
      ),
    }),
    async execute(_id, params: Record<string, unknown>) {
      let catalogPath = params.catalog_path as string | undefined;

      if (!catalogPath) {
        const active = discoverActiveCatalog();
        if (active) {
          catalogPath = active.path;
        } else {
          const all = discoverCatalogs();
          if (all.length > 0) {
            catalogPath = all[0].path;
          } else {
            return jsonResult({
              success: false,
              error: "No Lightroom catalog found. Please provide the path to your .lrcat file.",
            });
          }
        }
      }

      const config = resolveConfigPaths({ ...DEFAULT_CONFIG });
      const dbPath = (params.db_path as string) ?? config.learning.styleDbPath;

      try {
        const pipeline = new IngestPipeline(catalogPath, dbPath);
        const limit = params.limit as number | undefined;
        const progress = await pipeline.run(limit);

        return jsonResult({
          success: true,
          catalog: catalogPath,
          photos_extracted: progress.photosExtracted,
          photos_classified: progress.photosClassified,
          photos_stored: progress.photosStored,
          profiles_computed: progress.profilesComputed,
          scenarios_discovered: progress.profilesComputed,
        });
      } catch (err) {
        return jsonResult({
          success: false,
          catalog: catalogPath,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    },
  };
}

function createDiscoverCatalogsTool(): AnyAgentTool {
  return {
    name: "sophie_discover_catalogs",
    description:
      "Auto-discover Lightroom Classic catalogs on this Mac. " +
      "Searches common paths and Lightroom preferences. Returns found catalogs sorted by most recent.",
    parameters: Type.Object({}),
    async execute() {
      const catalogs = discoverCatalogs();
      const active = discoverActiveCatalog();

      return jsonResult({
        active_catalog: active
          ? {
              path: active.path,
              name: active.name,
              size_mb: Math.round(active.sizeBytes / 1024 / 1024),
              last_modified: active.lastModified,
            }
          : null,
        all_catalogs: catalogs.map((c) => ({
          path: c.path,
          name: c.name,
          size_mb: Math.round(c.sizeBytes / 1024 / 1024),
          last_modified: c.lastModified,
        })),
      });
    },
  };
}

function createClassifySceneTool(): AnyAgentTool {
  return {
    name: "sophie_classify_scene",
    description:
      "Classify a photo into an editing scenario based on EXIF data. " +
      "Returns time of day, location, lighting, subject type, and special conditions. " +
      "Use this to understand what scenario profile would apply to a given photo.",
    parameters: Type.Object({
      date_time: Type.Optional(
        Type.String({
          description: "Capture date/time in ISO format, e.g. '2025-06-15T18:30:00'",
        }),
      ),
      focal_length: Type.Optional(Type.Number({ description: "Focal length in mm" })),
      aperture: Type.Optional(Type.Number({ description: "Aperture f-number" })),
      iso: Type.Optional(Type.Number({ description: "ISO speed" })),
      flash: Type.Optional(Type.Boolean({ description: "Whether flash fired" })),
    }),
    async execute(_id, params: Record<string, unknown>) {
      const classifier = new SceneClassifier();
      const classification = classifier.classifyFromExif({
        dateTimeOriginal: params.date_time as string | undefined,
        focalLength: params.focal_length as number | undefined,
        aperture: params.aperture as number | undefined,
        isoSpeedRating: params.iso as number | undefined,
        flash: params.flash as boolean | undefined,
      });

      return jsonResult({
        scenario_key: scenarioKey(classification),
        label: scenarioLabel(classification),
        time_of_day: classification.timeOfDay,
        location: classification.location,
        lighting: classification.lighting,
        subject: classification.subject,
        special: classification.special,
        confidence: classification.confidence,
      });
    },
  };
}

function createGenerateReportTool(): AnyAgentTool {
  return {
    name: "sophie_generate_report",
    description:
      "Generate a human-readable 'Editing DNA' report showing the photographer's style profile. " +
      "Returns a markdown report with signature moves, per-scenario breakdowns, and correlations.",
    parameters: Type.Object({
      db_path: Type.Optional(
        Type.String({
          description: "Path to the style database. Uses default if not provided.",
        }),
      ),
    }),
    async execute(_id, params: Record<string, unknown>) {
      const config = resolveConfigPaths({ ...DEFAULT_CONFIG });
      const dbPath = (params.db_path as string) ?? config.learning.styleDbPath;

      try {
        const report = generateStyleReport(dbPath);
        return { content: [{ type: "text" as const, text: report }] };
      } catch (err) {
        return jsonResult({
          success: false,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    },
  };
}

function createGetEditStatsTool(): AnyAgentTool {
  return {
    name: "sophie_get_stats",
    description:
      "Get summary statistics about what Sophie has learned. " +
      "Returns total edits analyzed, number of scenarios, and top scenarios by sample count.",
    parameters: Type.Object({
      db_path: Type.Optional(
        Type.String({
          description: "Path to the style database. Uses default if not provided.",
        }),
      ),
    }),
    async execute(_id, params: Record<string, unknown>) {
      const db = getStyleDb(params.db_path as string | undefined);
      const editCount = db.getEditCount();
      const scenarios = db.listScenarios();

      const highConfidence = scenarios.filter((s) => s.sampleCount >= 20);
      const goodConfidence = scenarios.filter((s) => s.sampleCount >= 10 && s.sampleCount < 20);
      const lowConfidence = scenarios.filter((s) => s.sampleCount < 10);

      return jsonResult({
        total_edits: editCount,
        total_scenarios: scenarios.length,
        confidence_breakdown: {
          high: highConfidence.length,
          good: goodConfidence.length,
          low: lowConfidence.length,
        },
        top_scenarios: scenarios.slice(0, 5).map((s) => ({
          key: s.key,
          label: s.label,
          samples: s.sampleCount,
        })),
        ready_to_edit: editCount >= 50 && highConfidence.length >= 3,
      });
    },
  };
}

function createValidateCoverageTool(): AnyAgentTool {
  return {
    name: "sophie_validate_coverage",
    description:
      "Validation A (fast): summarize scenario coverage and style coherence from the style database. " +
      "Outputs a markdown report plus a canvas-ready HTML 'Accuracy Sheet' payload. " +
      "No Lightroom writes; safe to run anytime.",
    parameters: Type.Object({
      db_path: Type.Optional(
        Type.String({
          description: "Path to the style database. Uses default if not provided.",
        }),
      ),
      high_confidence_samples: Type.Optional(
        Type.Number({
          description: "Sample count required for HIGH confidence. Default 20.",
        }),
      ),
      std_dev_warning_threshold: Type.Optional(
        Type.Number({
          description: "Warn when a slider's std dev exceeds this threshold. Default 1.0.",
        }),
      ),
    }),
    async execute(_id, params: Record<string, unknown>) {
      const config = resolveConfigPaths({ ...DEFAULT_CONFIG });
      const dbPath = (params.db_path as string) ?? config.learning.styleDbPath;

      const artifacts = generateCoverageArtifacts(dbPath, {
        highConfidenceSamples: (params.high_confidence_samples as number | undefined) ?? 20,
        stdDevWarningThreshold: (params.std_dev_warning_threshold as number | undefined) ?? 1.0,
      });

      return jsonResult({
        ok: true,
        report: artifacts.report,
        markdown: artifacts.markdown,
        canvas: {
          note: artifacts.canvas.note,
          suggested_write_path: "docs/.local/sophie-validation-a-accuracy-sheet.html",
          html: artifacts.canvas.html,
          width: artifacts.canvas.width,
          height: artifacts.canvas.height,
          recommended_canvas_call: {
            action: "present",
            target: "file://<ABSOLUTE_PATH_TO_suggested_write_path>",
            width: artifacts.canvas.width,
            height: artifacts.canvas.height,
          },
        },
      });
    },
  };
}

function createValidateBPrimeTool(): AnyAgentTool {
  return {
    name: "sophie_validate_bprime",
    description:
      "Validation B' (vision): compare Sophie's vision-informed slider deltas against the photographer's actual edits " +
      "from the Lightroom catalog for a provided image list. " +
      "Uses Lightroom Develop screen capture (primary) and local pixels fallback (secondary). " +
      "No Lightroom writes; safe to run (but it will navigate images).",
    parameters: Type.Object({
      catalog_path: Type.Optional(
        Type.String({
          description:
            "Path to the .lrcat file. If not provided, Sophie will try to auto-discover it.",
        }),
      ),
      image_paths: Type.Array(Type.String(), {
        description:
          "Absolute paths to images to validate, in the same order they will be encountered in Lightroom Develop. " +
          "B' assumes Lightroom is showing this sequence starting at the first image.",
      }),
      db_path: Type.Optional(
        Type.String({
          description: "Path to the style database. Uses default if not provided.",
        }),
      ),
      pass_threshold: Type.Optional(
        Type.Number({
          description: "PASS if SLIDER_MATCH >= this threshold. Default 0.90.",
        }),
      ),
    }),
    async execute(_id, params: Record<string, unknown>) {
      const imagePaths = params.image_paths as string[];
      const passThreshold = (params.pass_threshold as number | undefined) ?? 0.9;

      let catalogPath = params.catalog_path as string | undefined;
      if (!catalogPath) {
        const active = discoverActiveCatalog();
        if (active) {
          catalogPath = active.path;
        } else {
          const all = discoverCatalogs();
          if (all.length > 0) {
            catalogPath = all[0].path;
          }
        }
      }

      if (!catalogPath) {
        return jsonResult({
          ok: false,
          error: "No Lightroom catalog found. Provide catalog_path.",
        });
      }

      const config = resolveConfigPaths({ ...DEFAULT_CONFIG });
      const dbPath = (params.db_path as string) ?? config.learning.styleDbPath;

      const ingester = new CatalogIngester(catalogPath);
      const styleDb = getStyleDb(dbPath);
      const classifier = new SceneClassifier();

      const lightroom = new LightroomController(config);
      const vision = new VisionTool(config);

      // Cache catalog lookups by path.
      const photoCache = new Map<string, ReturnType<CatalogIngester["extractPhotoByFilePath"]>>();

      try {
        ingester.open();

        await lightroom.initialize();
        await lightroom.switchToDevelop();
        await lightroom.navigateToFirstImage();

        // Advance Lightroom after each successful capture to align with image_paths order.
        let captureIndex = 0;

        const result = await runBPrimeValidation(
          {
            imagePaths,
            passThreshold,
            profileTargetDir: config.vision.screenshotDir,
            maxOutliers: 10,
          },
          {
            getImageId: async (imagePathStr) =>
              path.basename(imagePathStr, path.extname(imagePathStr)),
            getTruthDeltaForPath: async (imagePathStr) => {
              const rec =
                photoCache.get(imagePathStr) ?? ingester.extractPhotoByFilePath(imagePathStr);
              photoCache.set(imagePathStr, rec);
              if (!rec) {
                throw new Error("catalog_no_match");
              }
              if (!rec.hasBeenEdited) {
                throw new Error("catalog_not_edited");
              }
              return CatalogIngester.computeEditDelta(rec.developSettings);
            },
            getProfileForPath: async (imagePathStr) => {
              const rec =
                photoCache.get(imagePathStr) ?? ingester.extractPhotoByFilePath(imagePathStr);
              photoCache.set(imagePathStr, rec);
              if (!rec) return null;
              const classification = classifier.classifyFromExif(rec.exif);
              return styleDb.findClosestProfile(classification);
            },
            captureScreen: async (label) => {
              const screenshotPath = await lightroom.takeScreenshot(label);
              captureIndex++;
              if (captureIndex < imagePaths.length) {
                await lightroom.navigateToNextImage();
              }
              return screenshotPath;
            },
            analyze: async ({ imageId, visionPath, targetPath, profile }) => {
              const analysis = await vision.analyzeScreenshot(visionPath, targetPath);
              const baseline = profileToAdjustments(profile);
              const merged = mergeProfileWithVision(baseline, analysis);

              const predicted: Record<string, number> = {};
              for (const adj of merged.adjustments) {
                predicted[adj.control] = adj.target_delta;
              }

              // If the vision model wants a human, we treat it as a hard fail
              // (matches the "fail-closed" validation posture).
              if (merged.flag_for_review) {
                throw new Error(`flagged:${merged.flag_reason ?? "unknown"}`);
              }

              return predicted;
            },
          },
        );

        const markdown = renderBPrimeMarkdown({
          generatedAt: new Date().toISOString(),
          summary: result.summary,
          outliers: result.outliers,
        });

        return jsonResult({
          ok: true,
          catalog: catalogPath,
          db_path: dbPath,
          summary: result.summary,
          outliers: result.outliers,
          markdown,
          note: "B' assumes Lightroom Develop is currently showing the provided image_paths sequence starting at the first image.",
        });
      } catch (err) {
        return jsonResult({
          ok: false,
          catalog: catalogPath,
          error: err instanceof Error ? err.message : String(err),
        });
      } finally {
        ingester.close();
      }
    },
  };
}

function createCullImagesTool(): AnyAgentTool {
  return {
    name: "sophie_cull",
    description:
      "Analyze a set of images for culling — identify rejects (blur, exposure issues), " +
      "detect duplicate groups, and rank images by quality. " +
      "This is the first pass of the editor's workflow: select the strongest images from a shoot.",
    parameters: Type.Object({
      image_paths: Type.Array(Type.String(), {
        description: "Array of file paths to images to cull",
      }),
    }),
    async execute(_id, params: Record<string, unknown>) {
      const paths = params.image_paths as string[];
      const config = resolveConfigPaths({ ...DEFAULT_CONFIG });

      const culler = new Culler(config);
      const results = await culler.cull(paths);

      const picks = results.filter((r) => r.verdict === "pick");
      const rejects = results.filter((r) => r.verdict === "reject");
      const maybes = results.filter((r) => r.verdict === "maybe");
      const reviews = results.filter((r) => r.verdict === "review");

      return jsonResult({
        total: results.length,
        picks: picks.length,
        rejects: rejects.length,
        maybes: maybes.length,
        needs_review: reviews.length,
        results: results.map((r) => ({
          file: r.filePath,
          verdict: r.verdict,
          confidence: Math.round(r.confidence * 100) / 100,
          reasons: r.reasons,
          duplicate_group: r.duplicateGroupId ?? null,
        })),
      });
    },
  };
}

function createGetCorrelationsTool(): AnyAgentTool {
  return {
    name: "sophie_get_correlations",
    description:
      "Get slider correlations for a scenario — which adjustments the photographer " +
      "tends to pair together. For example, 'when you lift shadows, you also pull highlights down.' " +
      "Useful for understanding the photographer's editing patterns.",
    parameters: Type.Object({
      scenario_key: Type.String({
        description: "The scenario key to look up correlations for",
      }),
      db_path: Type.Optional(Type.String()),
    }),
    async execute(_id, params: Record<string, unknown>) {
      const db = getStyleDb(params.db_path as string | undefined);
      const profile = db.getProfile(params.scenario_key as string);

      if (!profile || profile.correlations.length === 0) {
        return jsonResult({
          scenario_key: params.scenario_key,
          correlations: [],
          message: "No correlations found. Need more samples or the scenario doesn't exist.",
        });
      }

      return jsonResult({
        scenario_key: profile.scenarioKey,
        sample_count: profile.sampleCount,
        correlations: profile.correlations.map((c) => ({
          control_a: c.controlA,
          control_b: c.controlB,
          correlation: Math.round(c.correlation * 100) / 100,
          direction: c.correlation > 0 ? "move together" : "move opposite",
          strength:
            Math.abs(c.correlation) > 0.7
              ? "strong"
              : Math.abs(c.correlation) > 0.5
                ? "moderate"
                : "weak",
          samples: c.sampleCount,
        })),
      });
    },
  };
}

function createFindProfileTool(): AnyAgentTool {
  return {
    name: "sophie_find_profile",
    description:
      "Find the best matching editing profile for a photo's characteristics. " +
      "Uses EXIF data to classify the scene, then finds the closest matching " +
      "profile in the style database, falling back to broader categories if needed.",
    parameters: Type.Object({
      date_time: Type.Optional(Type.String()),
      focal_length: Type.Optional(Type.Number()),
      aperture: Type.Optional(Type.Number()),
      iso: Type.Optional(Type.Number()),
      flash: Type.Optional(Type.Boolean()),
      db_path: Type.Optional(Type.String()),
    }),
    async execute(_id, params: Record<string, unknown>) {
      const classifier = new SceneClassifier();
      const classification = classifier.classifyFromExif({
        dateTimeOriginal: params.date_time as string | undefined,
        focalLength: params.focal_length as number | undefined,
        aperture: params.aperture as number | undefined,
        isoSpeedRating: params.iso as number | undefined,
        flash: params.flash as boolean | undefined,
      });

      const db = getStyleDb(params.db_path as string | undefined);
      const profile = db.findClosestProfile(classification);

      if (!profile) {
        return jsonResult({
          classification: {
            key: scenarioKey(classification),
            label: scenarioLabel(classification),
            confidence: classification.confidence,
          },
          profile: null,
          message: "No matching profile found. Need more training data.",
        });
      }

      const topAdjustments = Object.entries(profile.adjustments)
        .filter(([_, stats]) => Math.abs(stats.mean) > 0.5)
        .sort(([, a], [, b]) => Math.abs(b.mean) - Math.abs(a.mean))
        .slice(0, 8)
        .map(([name, stats]) => ({
          control: name,
          value: Math.round(stats.mean * 100) / 100,
          std_dev: Math.round(stats.stdDev * 100) / 100,
          consistent: stats.stdDev < Math.abs(stats.mean) * 0.5,
        }));

      return jsonResult({
        classification: {
          key: scenarioKey(classification),
          label: scenarioLabel(classification),
          confidence: classification.confidence,
        },
        profile: {
          scenario_key: profile.scenarioKey,
          label: profile.scenarioLabel,
          sample_count: profile.sampleCount,
          exact_match: profile.scenarioKey === scenarioKey(classification),
        },
        recommended_adjustments: topAdjustments,
      });
    },
  };
}
