import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, test } from "vitest";
import { SceneClassifier } from "../learning/scene-classifier.js";
import { StyleDatabase } from "../learning/style-db.js";
import { generateCoverageArtifacts } from "./toolkit.js";

describe("generateCoverageArtifacts", () => {
  test("returns report json, markdown, and canvas html", async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "thelab-style-db-"));
    const dbPath = path.join(tmpDir, "style.db");

    const db = new StyleDatabase(dbPath);
    const classifier = new SceneClassifier();

    const classA = classifier.classifyFromExif({
      dateTimeOriginal: "2026-02-18T18:30:00",
      isoSpeedRating: 100,
      flashFired: false,
      focalLength: 50,
      aperture: 1.8,
    });
    const keyA = db.ensureScenario(classA);

    db.storePhotoEditBatch(
      Array.from({ length: 20 }).map((_, i) => ({
        photoHash: `a_${i}`,
        scenarioKey: keyA,
        exifJson: "{}",
        adjustmentsJson: JSON.stringify({ exposure: 0.3, temp: 200, shadows: 25 }),
        editedAt: new Date(Date.UTC(2026, 1, 18, 10, 0, i)).toISOString(),
        source: "catalog" as const,
      })),
    );

    db.recomputeAllProfiles();
    db.close();

    const artifacts = generateCoverageArtifacts(dbPath);
    expect(artifacts.report.totals.totalEdits).toBe(20);
    expect(artifacts.markdown).toContain("Validation A — Coverage + Coherence");
    expect(artifacts.canvas.html).toContain("Sophie — Accuracy Sheet");
  });
});
