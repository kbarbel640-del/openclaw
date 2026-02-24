import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, test } from "vitest";
import type { ScenarioProfile } from "../learning/style-db.js";
import { writeProfileTargetFile } from "./profile-target.js";

describe("writeProfileTargetFile", () => {
  test("writes a json target file for the vision analyzer", async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "thelab-profile-target-"));

    const profile: ScenarioProfile = {
      scenarioKey: "golden_hour::outdoor::natural_bright::portrait",
      scenarioLabel: "Golden hour / Outdoor / Natural / Portrait",
      sampleCount: 20,
      lastUpdated: "2026-02-19T00:00:00.000Z",
      adjustments: {
        exposure: {
          control: "exposure",
          mean: 0.3,
          median: 0.3,
          stdDev: 0.1,
          min: -0.2,
          max: 0.8,
          sampleCount: 20,
        },
        temp: {
          control: "temp",
          mean: 200,
          median: 200,
          stdDev: 50,
          min: -100,
          max: 500,
          sampleCount: 20,
        },
      },
      correlations: [],
    };

    const outPath = await writeProfileTargetFile(tmpDir, profile);
    const raw = await fs.readFile(outPath, "utf-8");
    const json = JSON.parse(raw) as {
      name: string;
      target_ranges: Record<string, { typical: number }>;
    };

    expect(json.name).toContain("Golden hour");
    expect(json.target_ranges.exposure.typical).toBe(0.3);
    expect(json.target_ranges.temp.typical).toBe(200);
  });
});
