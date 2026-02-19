#!/usr/bin/env node
/**
 * The Lab — Integration Smoke Test
 * Verifies all modules connect and work together without Lightroom/MLX.
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { DEFAULT_CONFIG } from "./config/defaults.js";
import { resolveConfigPaths } from "./config/thelab-config.js";
import { Culler } from "./culling/culler.js";
import { CatalogIngester, LR_DEFAULTS } from "./learning/catalog-ingester.js";
import type { CatalogExifData } from "./learning/catalog-ingester.js";
import { SceneClassifier, scenarioKey, scenarioLabel } from "./learning/scene-classifier.js";
import { StyleDatabase } from "./learning/style-db.js";
import { evaluateGate, filterConfidentAdjustments } from "./loop/gate.js";
import { ImageQueue } from "./loop/queue.js";
import { SessionStore } from "./session/session-store.js";
import { parseIntent } from "./sophie/intent-parser.js";
import { SophieBrain } from "./sophie/sophie-brain.js";
import { ImageAnalysisResult, FilmStockTarget } from "./vision/schema.js";

let passed = 0;
let failed = 0;

function assert(condition: boolean, label: string): void {
  if (condition) {
    console.log(`  PASS: ${label}`);
    passed++;
  } else {
    console.error(`  FAIL: ${label}`);
    failed++;
  }
}

async function testQueue(): Promise<void> {
  console.log("\n--- ImageQueue ---");
  const queue = new ImageQueue();
  queue.loadFromPaths(["/tmp/DSC_001.cr3", "/tmp/DSC_002.cr3", "/tmp/DSC_003.cr3"]);

  assert(queue.getTotal() === 3, "Queue has 3 images");
  assert(queue.getCurrent() === "/tmp/DSC_001.cr3", "First image is DSC_001");
  assert(!queue.isComplete(), "Queue not complete");

  queue.advance();
  assert(queue.getCurrent() === "/tmp/DSC_002.cr3", "After advance, current is DSC_002");
  assert(queue.getProgress().percent === 33, "Progress is 33%");

  queue.advance();
  queue.advance();
  assert(queue.isComplete(), "Queue complete after 3 advances");
}

async function testSession(): Promise<void> {
  console.log("\n--- SessionStore ---");
  const tmpDir = path.join(os.tmpdir(), `thelab-test-${Date.now()}`);
  const session = new SessionStore(tmpDir, "super8-wedding", [
    "/tmp/DSC_001.cr3",
    "/tmp/DSC_002.cr3",
  ]);

  await session.initialize();
  assert(session.getSessionId().startsWith("thelab_"), "Session ID has correct prefix");

  const progress = session.getCurrentProgress();
  assert(progress.total === 2, "Total is 2");
  assert(progress.pending === 2, "2 pending");
  assert(progress.completed === 0, "0 completed");

  const next = session.getNextPendingImage();
  assert(next?.image_id === "DSC_001", "Next pending is DSC_001");

  await session.markProcessing("DSC_001");
  await session.markComplete(
    "DSC_001",
    {
      image_id: "DSC_001",
      confidence: 0.85,
      adjustments: [
        { control: "exposure", current_estimate: -1.0, target_delta: 1.2, confidence: 0.9 },
      ],
      flag_for_review: false,
      flag_reason: null,
    },
    null,
  );

  const p2 = session.getCurrentProgress();
  assert(p2.completed === 1, "1 completed after markComplete");
  assert(p2.pending === 1, "1 still pending");

  await session.markFlagged("DSC_002", "Low confidence");
  const p3 = session.getCurrentProgress();
  assert(p3.flagged === 1, "1 flagged");

  await session.finalize();

  const sessionFile = path.join(tmpDir, `${session.getSessionId()}.jsonl`);
  assert(fs.existsSync(sessionFile), "Session JSONL file exists");

  const lines = fs.readFileSync(sessionFile, "utf-8").trim().split("\n");
  assert(lines.length >= 4, "Session file has at least 4 events");

  const firstEvent = JSON.parse(lines[0]);
  assert(firstEvent.type === "session_start", "First event is session_start");

  const lastEvent = JSON.parse(lines[lines.length - 1]);
  assert(lastEvent.type === "session_end", "Last event is session_end");

  // Test resume
  const resumed = await SessionStore.resume(sessionFile);
  assert(resumed !== null, "Session resumed successfully");
  if (resumed) {
    const rp = resumed.getCurrentProgress();
    assert(rp.completed === 1, "Resumed session has 1 completed");
    assert(rp.flagged === 1, "Resumed session has 1 flagged");
  }

  fs.rmSync(tmpDir, { recursive: true });
}

async function testGate(): Promise<void> {
  console.log("\n--- Confidence Gate ---");

  const lowConf = {
    image_id: "test",
    confidence: 0.5,
    adjustments: [
      { control: "exposure" as const, current_estimate: 0, target_delta: 1, confidence: 0.3 },
    ],
    flag_for_review: false,
    flag_reason: null,
  };
  const g1 = evaluateGate(lowConf, 0.75);
  assert(!g1.pass, "Low confidence blocked");

  const highConf = {
    ...lowConf,
    confidence: 0.9,
    adjustments: [
      { control: "exposure" as const, current_estimate: 0, target_delta: 1, confidence: 0.85 },
    ],
  };
  const g2 = evaluateGate(highConf, 0.75);
  assert(g2.pass, "High confidence passes");

  const flagged = { ...highConf, flag_for_review: true, flag_reason: "Unusual lighting" };
  const g3 = evaluateGate(flagged, 0.75);
  assert(!g3.pass, "Flagged-for-review blocked");

  const noAdj = { ...highConf, adjustments: [] };
  const g4 = evaluateGate(noAdj, 0.75);
  assert(!g4.pass, "No adjustments blocked");

  const filtered = filterConfidentAdjustments(
    {
      ...highConf,
      adjustments: [
        { control: "exposure", current_estimate: 0, target_delta: 1, confidence: 0.9 },
        { control: "temp", current_estimate: 5000, target_delta: 300, confidence: 0.4 },
        { control: "shadows", current_estimate: 0, target_delta: 20, confidence: 0.8 },
      ],
    },
    0.6,
    8,
  );
  assert(filtered.adjustments.length === 2, "Filtered removes low-confidence adjustments");
}

async function testSchemas(): Promise<void> {
  console.log("\n--- Zod Schemas ---");

  const valid = ImageAnalysisResult.safeParse({
    image_id: "DSC_0472",
    confidence: 0.82,
    adjustments: [
      { control: "exposure", current_estimate: -1.2, target_delta: 1.4, confidence: 0.91 },
    ],
    flag_for_review: false,
    flag_reason: null,
  });
  assert(valid.success, "Valid analysis passes schema");

  const invalid = ImageAnalysisResult.safeParse({
    image_id: "test",
    confidence: 2.0,
    adjustments: [],
    flag_for_review: false,
    flag_reason: null,
  });
  assert(!invalid.success, "Invalid confidence rejected");

  const super8 = JSON.parse(
    fs.readFileSync("skills/thelab-super8-wedding/lightroom_targets.json", "utf-8"),
  );
  assert(FilmStockTarget.safeParse(super8).success, "Super 8 target validates");

  const cinestill = JSON.parse(
    fs.readFileSync("skills/thelab-cinestill-800t/lightroom_targets.json", "utf-8"),
  );
  assert(FilmStockTarget.safeParse(cinestill).success, "Cinestill 800T target validates");
}

async function testConfig(): Promise<void> {
  console.log("\n--- Config ---");

  assert(DEFAULT_CONFIG.lightroom.confidenceThreshold === 0.75, "Default confidence is 0.75");
  assert(DEFAULT_CONFIG.lightroom.maxAdjustmentsPerImage === 8, "Default max adjustments is 8");
  assert(DEFAULT_CONFIG.learning.styleDbPath === "~/.thelab/style.db", "Default style DB path");
  assert(DEFAULT_CONFIG.learning.observerPollMs === 3000, "Default observer poll interval");
  assert(DEFAULT_CONFIG.learning.minSamplesForProfile === 3, "Default min samples");

  const resolved = resolveConfigPaths(DEFAULT_CONFIG, "/Users/test/thelab");
  assert(!resolved.lightroom.watchFolder.startsWith("~"), "Watch folder path resolved");
  assert(!resolved.session.sessionDir.startsWith("~"), "Session dir path resolved");
  assert(
    resolved.vision.analyzerScript.includes("/Users/test/thelab"),
    "Analyzer script path resolved",
  );
  assert(!resolved.learning.styleDbPath.startsWith("~"), "Style DB path resolved");
  assert(!resolved.learning.catalogPath.startsWith("~"), "Catalog path resolved");
}

async function testSceneClassifier(): Promise<void> {
  console.log("\n--- Scene Classifier ---");

  const classifier = new SceneClassifier();

  // Golden hour outdoor portrait
  const goldenHour: CatalogExifData = {
    dateTimeOriginal: "2026-06-15T19:30:00",
    isoSpeedRating: 200,
    focalLength: 85,
    aperture: 1.8,
    shutterSpeed: 0.002,
    flashFired: false,
    whiteBalance: null,
    cameraModel: null,
    lensModel: null,
    gpsLatitude: null,
    gpsLongitude: null,
  };
  const gh = classifier.classifyFromExif(goldenHour);
  assert(gh.timeOfDay === "golden_hour", "Golden hour detected from 19:30 summer");
  assert(gh.location === "outdoor", "Outdoor from low ISO");
  assert(gh.lighting === "natural_bright", "Natural bright from ISO 200");
  assert(gh.subject === "portrait", "Portrait from 85mm f/1.8");
  assert(gh.confidence > 0.8, "High confidence with full EXIF");

  // Indoor flash reception (ISO 1600+ for dance floor detection)
  const indoor: CatalogExifData = {
    dateTimeOriginal: "2026-06-15T22:00:00",
    isoSpeedRating: 1600,
    focalLength: 35,
    aperture: 2.8,
    shutterSpeed: 0.005,
    flashFired: true,
    whiteBalance: null,
    cameraModel: null,
    lensModel: null,
    gpsLatitude: null,
    gpsLongitude: null,
  };
  const ind = classifier.classifyFromExif(indoor);
  assert(ind.lighting === "mixed", "Mixed lighting from flash + high ISO");
  assert(ind.special === "dance_floor", "Dance floor from late night + flash + high ISO");

  // Minimal EXIF
  const minimal: CatalogExifData = {
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
  const min = classifier.classifyFromExif(minimal);
  assert(min.timeOfDay === "unknown", "Unknown time with no EXIF");
  assert(min.confidence < 0.1, "Very low confidence with no EXIF");

  // Scenario key and label
  const key = scenarioKey(gh);
  assert(key.includes("golden_hour"), "Scenario key contains time of day");
  assert(key.includes("::"), "Scenario key uses :: separator");
  const label = scenarioLabel(gh);
  assert(label.includes("golden hour"), "Scenario label is human-readable");

  // Vision merge (vision confidence must exceed EXIF confidence to override)
  const merged = classifier.mergeVisionClassification(gh, {
    location: "outdoor",
    subject: "couple",
    confidence: 0.98,
  });
  assert(merged.subject === "couple", "Vision override applied for subject");
  assert(merged.timeOfDay === "golden_hour", "EXIF time preserved");

  // Manual override
  const overridden = classifier.applyOverride(gh, { special: "first_look" });
  assert(overridden.special === "first_look", "Override applied");
  assert(overridden.confidence === 1.0, "Override sets confidence to 1.0");
  assert(overridden.overridden, "Override flag set");
}

async function testStyleDatabase(): Promise<void> {
  console.log("\n--- Style Database ---");

  const dbPath = path.join(os.tmpdir(), `thelab-test-style-${Date.now()}.db`);
  const db = new StyleDatabase(dbPath);

  // Ensure scenario
  const classifier = new SceneClassifier();
  const classification = classifier.classifyFromExif({
    dateTimeOriginal: "2026-06-15T19:30:00",
    isoSpeedRating: 200,
    focalLength: 85,
    aperture: 1.8,
    shutterSpeed: 0.002,
    flashFired: false,
    whiteBalance: null,
    cameraModel: null,
    lensModel: null,
    gpsLatitude: null,
    gpsLongitude: null,
  });
  const key = db.ensureScenario(classification);
  assert(key.includes("golden_hour"), "Scenario created with correct key");

  // Store edits
  const edits = [
    { exposure: 0.3, temp: 300, shadows: 35 },
    { exposure: 0.5, temp: 250, shadows: 40 },
    { exposure: 0.2, temp: 350, shadows: 30 },
    { exposure: 0.4, temp: 280, shadows: 38 },
    { exposure: 0.35, temp: 320, shadows: 42 },
  ];

  for (let i = 0; i < edits.length; i++) {
    db.storePhotoEdit({
      photoHash: `hash_${i}`,
      scenarioKey: key,
      exifJson: "{}",
      adjustmentsJson: JSON.stringify(edits[i]),
      editedAt: `2026-06-15T20:00:0${i}`,
      source: "catalog",
    });
  }

  assert(db.getEditCount() === 5, "5 edits stored");

  // Batch insert
  const batchCount = db.storePhotoEditBatch([
    {
      photoHash: "batch_1",
      scenarioKey: key,
      exifJson: "{}",
      adjustmentsJson: JSON.stringify({ exposure: 0.45 }),
      editedAt: "2026-06-15T21:00:00",
      source: "live_observer",
    },
    {
      photoHash: "batch_2",
      scenarioKey: key,
      exifJson: "{}",
      adjustmentsJson: JSON.stringify({ exposure: 0.55 }),
      editedAt: "2026-06-15T21:01:00",
      source: "live_observer",
    },
  ]);
  assert(batchCount === 2, "Batch inserted 2 records");
  assert(db.getEditCount() === 7, "7 total edits after batch");

  // Recompute profile
  const profile = db.recomputeProfile(key);
  assert(profile !== null, "Profile computed");
  assert(profile!.sampleCount === 7, "Profile has 7 samples");
  assert("exposure" in profile!.adjustments, "Profile has exposure stats");
  assert(profile!.adjustments["exposure"].mean > 0.2, "Exposure mean is positive");
  assert(profile!.adjustments["exposure"].stdDev > 0, "Exposure has non-zero std dev");

  // Lookup
  const looked = db.getProfile(key);
  assert(looked !== null, "Profile lookup works");
  assert(looked!.scenarioKey === key, "Lookup returns correct scenario");

  // Fallback
  const fallback = db.findClosestProfile({
    timeOfDay: "golden_hour",
    location: "outdoor",
    lighting: "natural_bright",
    subject: "couple",
    special: null,
    confidence: 0.8,
    overridden: false,
  });
  assert(fallback !== null, "Fallback profile found");

  // List scenarios
  const scenarios = db.listScenarios();
  assert(scenarios.length === 1, "1 scenario listed");
  assert(scenarios[0].sampleCount === 7, "Scenario has 7 samples");

  // Metadata
  db.setMeta("test_key", "test_value");
  assert(db.getMeta("test_key") === "test_value", "Metadata stored and retrieved");

  db.close();
  fs.unlinkSync(dbPath);
}

async function testCatalogIngester(): Promise<void> {
  console.log("\n--- Catalog Ingester ---");

  // Test LR_DEFAULTS
  assert(Object.keys(LR_DEFAULTS).length >= 40, "LR_DEFAULTS has 40+ controls");
  assert(LR_DEFAULTS["exposure"] === 0, "Exposure default is 0");
  assert(LR_DEFAULTS["temp"] === 5500, "Temp default is 5500");
  assert(LR_DEFAULTS["grain_amount"] === 0, "Grain default is 0");

  // Test computeEditDelta
  const delta = CatalogIngester.computeEditDelta({
    exposure: 0.5,
    temp: 5800,
    shadows: 30,
    contrast: 0,
  });
  assert(delta["exposure"] === 0.5, "Exposure delta computed");
  assert(delta["temp"] === 300, "Temp delta computed (5800 - 5500)");
  assert(delta["shadows"] === 30, "Shadows delta computed");
  assert(!("contrast" in delta), "Zero delta excluded");
}

async function testIntentParser(): Promise<void> {
  console.log("\n--- Intent Parser ---");

  // Editing commands
  const edit1 = parseIntent("Go edit the Johnson wedding");
  assert(edit1.type === "start_editing", "Parses 'go edit' as start_editing");

  const edit2 = parseIntent("Get it down to 800 images");
  assert(edit2.type === "start_editing", "Parses 'get it down to' as start_editing");
  assert(
    edit2.type === "start_editing" && edit2.params.targetCount === 800,
    "Extracts target count 800",
  );

  const edit3 = parseIntent("Start editing, skip the ceremony shots");
  assert(edit3.type === "start_editing", "Parses 'start editing' with skip");
  assert(
    edit3.type === "start_editing" && edit3.params.skipScenarios?.[0] === "ceremony",
    "Extracts skip scenario 'ceremony'",
  );

  // Session control
  assert(parseIntent("stop").type === "stop_editing", "Parses 'stop'");
  assert(parseIntent("pause").type === "pause_editing", "Parses 'pause'");
  assert(parseIntent("continue").type === "resume_editing", "Parses 'continue'");
  assert(parseIntent("keep going").type === "resume_editing", "Parses 'keep going'");

  // Learning
  assert(parseIntent("learn").type === "start_learning", "Parses 'learn'");
  assert(
    parseIntent("analyze my catalog").type === "start_learning",
    "Parses 'analyze my catalog'",
  );

  // Observation
  const obsOn = parseIntent("watch me edit");
  assert(
    obsOn.type === "toggle_observation" && obsOn.enabled,
    "Parses 'watch me edit' as observation on",
  );
  const obsOff = parseIntent("stop watching");
  assert(
    obsOff.type === "toggle_observation" && !obsOff.enabled,
    "Parses 'stop watching' as observation off",
  );

  // Progress and flagged
  assert(parseIntent("how's it going?").type === "show_progress", "Parses progress query");
  assert(parseIntent("how many done?").type === "show_progress", "Parses 'how many done'");
  assert(parseIntent("show flagged").type === "show_flagged", "Parses 'show flagged'");
  assert(parseIntent("what did you flag?").type === "show_flagged", "Parses 'what did you flag'");

  // Profile
  assert(parseIntent("show my style").type === "show_profile", "Parses 'show my style'");
  assert(
    parseIntent("what have you learned?").type === "show_profile",
    "Parses 'what have you learned'",
  );

  // Style adjustments
  const warm = parseIntent("make it warmer");
  assert(warm.type === "adjust_style", "Parses 'make it warmer' as style adjust");
  assert(
    warm.type === "adjust_style" && warm.params.adjustments["temperature"] === "+",
    "Extracts temperature increase from 'warmer'",
  );

  const shadows = parseIntent("lift the shadows");
  assert(shadows.type === "adjust_style", "Parses 'lift the shadows'");
  assert(
    shadows.type === "adjust_style" && shadows.params.adjustments["shadows"] === "+",
    "Extracts shadows increase from 'lift'",
  );

  const less = parseIntent("less contrast");
  assert(less.type === "adjust_style", "Parses 'less contrast'");
  assert(
    less.type === "adjust_style" && less.params.adjustments["contrast"] === "-",
    "Extracts contrast decrease from 'less'",
  );

  // Greeting
  assert(parseIntent("hey").type === "greeting", "Parses 'hey' as greeting");
  assert(parseIntent("Hello Sophie").type === "greeting", "Parses 'Hello Sophie' as greeting");

  // Questions
  assert(parseIntent("who are you?").type === "question", "Parses question with '?'");

  // Unknown
  assert(parseIntent("xyz").type === "unknown", "Parses gibberish as unknown");
}

async function testSophieBrain(): Promise<void> {
  console.log("\n--- Sophie Brain ---");

  const tmpDir = path.join(os.tmpdir(), `thelab-sophie-test-${Date.now()}`);
  const dbPath = path.join(tmpDir, "style.db");
  fs.mkdirSync(tmpDir, { recursive: true });

  const db = new StyleDatabase(dbPath);
  const brain = new SophieBrain({ styleDb: db });

  // Greeting with empty profile
  const greeting = await brain.processMessage("hey");
  assert(greeting.length > 0, "Sophie responds to greeting");
  assert(greeting[0].role === "sophie", "Response is from Sophie");
  assert(
    greeting[0].content.includes("don't know your style"),
    "Empty profile greeting mentions learning",
  );

  // Add some data to the DB
  const classifier = new SceneClassifier();
  const classification = classifier.classifyFromExif({
    dateTimeOriginal: "2025-06-15T18:30:00",
    focalLength: 85,
    isoSpeedRating: 200,
  });
  db.ensureScenario(classification);
  for (let i = 0; i < 20; i++) {
    db.storePhotoEdit({
      photoHash: `test-${i}`,
      scenarioKey: scenarioKey(classification),
      exifJson: "{}",
      adjustmentsJson: JSON.stringify({
        exposure: 0.3 + Math.random() * 0.2,
        shadows: 35 + Math.random() * 10,
      }),
      editedAt: new Date().toISOString(),
      source: "catalog",
    });
  }
  db.recomputeProfile(scenarioKey(classification));

  // Greeting with data
  const brain2 = new SophieBrain({ styleDb: db });
  const greeting2 = await brain2.processMessage("hey");
  assert(greeting2[0].content.includes("20"), "Data greeting mentions edit count");

  // Progress with no session
  const progress = await brain2.processMessage("how's it going?");
  assert(progress[0].content.includes("No active session"), "No session progress response");

  // Profile query
  const profile = await brain2.processMessage("show my style");
  assert(profile[0].content.includes("scenario"), "Profile response mentions scenarios");

  // Unknown command
  const unknown = await brain2.processMessage("asdfghjkl");
  assert(unknown[0].content.includes("what I can do"), "Unknown shows help");

  // Start editing with low data
  const lowDb = new StyleDatabase(path.join(tmpDir, "low.db"));
  const lowBrain = new SophieBrain({ styleDb: lowDb });
  const lowEdit = await lowBrain.processMessage("go edit");
  assert(lowEdit[0].content.includes("not enough"), "Low data warns about insufficient profile");

  // Message state tracking
  const state = brain2.getState();
  assert(state.messages.length > 0, "State tracks messages");
  assert(state.conversationId.length > 0, "State has conversation ID");

  // Session lifecycle
  brain2.startSession("test-session", 100);
  brain2.updateSession({ completedImages: 50, flaggedImages: 3 });
  const midProgress = await brain2.processMessage("how's it going?");
  assert(midProgress[0].content.includes("50"), "Mid-session progress shows count");

  db.close();
  lowDb.close();
  fs.rmSync(tmpDir, { recursive: true, force: true });
}

async function testCuller(): Promise<void> {
  console.log("\n--- Culler ---");

  const config = resolveConfigPaths({ ...DEFAULT_CONFIG });
  const results: string[] = [];

  const culler = new Culler(config, {
    onProgress: (done, total) => {
      results.push(`progress:${done}/${total}`);
    },
  });

  const testPaths = [
    "/tmp/DSC_0001.NEF",
    "/tmp/DSC_0002.NEF",
    "/tmp/DSC_0003.NEF",
    "/tmp/DSC_0010.NEF",
    "/tmp/DSC_0011.NEF",
  ];

  const cullResults = await culler.cull(testPaths);
  assert(cullResults.length === 5, "Culler returns results for all images");
  assert(results.length === 5, "Progress callback fired for each image");

  for (const result of cullResults) {
    assert(
      ["pick", "reject", "maybe", "review"].includes(result.verdict),
      `Valid verdict for ${result.filePath}: ${result.verdict}`,
    );
    assert(result.confidence >= 0 && result.confidence <= 1, "Confidence in valid range");
    assert(result.imageId.length > 0, "Image ID assigned");
  }

  // Check duplicate detection: DSC_0001-0003 should be grouped, 0010-0011 should be grouped
  const groups = new Set(
    cullResults.filter((r) => r.duplicateGroupId).map((r) => r.duplicateGroupId),
  );
  assert(groups.size === 2, `Detected 2 duplicate groups (got ${groups.size})`);
}

async function main(): Promise<void> {
  console.log("=".repeat(50));
  console.log("  SOPHIE — Integration Smoke Test");
  console.log("=".repeat(50));

  await testQueue();
  await testSession();
  await testGate();
  await testSchemas();
  await testConfig();
  await testSceneClassifier();
  await testStyleDatabase();
  await testCatalogIngester();
  await testIntentParser();
  await testSophieBrain();
  await testCuller();

  console.log("\n" + "=".repeat(50));
  console.log(`  Results: ${passed} passed, ${failed} failed`);
  console.log("=".repeat(50));

  if (failed > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Test runner error:", err);
  process.exit(1);
});
