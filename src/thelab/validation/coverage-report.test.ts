import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, test } from "vitest";
import { SceneClassifier } from "../learning/scene-classifier.js";
import { StyleDatabase } from "../learning/style-db.js";
import { computeCoverageCoherence } from "./coverage-report.js";

describe("computeCoverageCoherence", () => {
  test("summarizes scenario coverage and flags high-variance scenarios", async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "thelab-style-db-"));
    const dbPath = path.join(tmpDir, "style.db");

    const db = new StyleDatabase(dbPath);
    const classifier = new SceneClassifier();

    // Scenario A: stable profile (20 samples => HIGH confidence)
    const classA = classifier.classifyFromExif({
      dateTimeOriginal: "2026-02-18T18:30:00",
      isoSpeedRating: 100,
      flashFired: false,
      focalLength: 50,
      aperture: 1.8,
    });
    const keyA = db.ensureScenario(classA);

    const editsA = Array.from({ length: 20 }).map((_, i) => ({
      photoHash: `a_${i}`,
      scenarioKey: keyA,
      exifJson: "{}",
      adjustmentsJson: JSON.stringify({
        exposure: 0.3 + (i % 2) * 0.02,
        temp: 200,
        shadows: 25,
      }),
      editedAt: new Date(Date.UTC(2026, 1, 18, 10, 0, i)).toISOString(),
      source: "catalog" as const,
    }));

    // Scenario B: inconsistent profile (variance warning expected)
    const classB = classifier.classifyFromExif({
      dateTimeOriginal: "2026-02-18T22:30:00",
      isoSpeedRating: 6400,
      flashFired: true,
      focalLength: 35,
      aperture: 2.0,
    });
    const keyB = db.ensureScenario(classB);

    const editsB = Array.from({ length: 6 }).map((_, i) => ({
      photoHash: `b_${i}`,
      scenarioKey: keyB,
      exifJson: "{}",
      adjustmentsJson: JSON.stringify({
        exposure: i % 2 === 0 ? -2.0 : 2.0,
        temp: i % 2 === 0 ? -800 : 800,
        shadows: i % 2 === 0 ? -40 : 40,
      }),
      editedAt: new Date(Date.UTC(2026, 1, 18, 11, 0, i)).toISOString(),
      source: "catalog" as const,
    }));

    db.storePhotoEditBatch([...editsA, ...editsB]);
    db.recomputeAllProfiles();

    const report = computeCoverageCoherence(db, { highConfidenceSamples: 20 });

    expect(report.totals.totalEdits).toBe(26);
    expect(report.totals.scenarioCount).toBeGreaterThanOrEqual(2);
    expect(report.totals.highConfidenceScenarioCount).toBeGreaterThanOrEqual(1);

    const a = report.scenarios.find((s) => s.key === keyA);
    expect(a?.confidence).toBe("high");

    const b = report.scenarios.find((s) => s.key === keyB);
    expect(b?.varianceWarnings.length).toBeGreaterThan(0);

    db.close();
  });
});
