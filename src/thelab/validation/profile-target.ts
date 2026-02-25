import fs from "node:fs/promises";
import path from "node:path";
import type { ScenarioProfile } from "../learning/style-db.js";

/**
 * Write a temporary JSON "target" file for the vision analyzer.
 *
 * This mirrors the format used in `EditingLoop.buildProfileTargetPath()`:
 * - `target_ranges[control]` includes min/max/typical.
 */
export async function writeProfileTargetFile(
  outputDir: string,
  profile: ScenarioProfile,
): Promise<string> {
  const target = {
    name: profile.scenarioLabel,
    description: `Learned editing profile: ${profile.scenarioLabel} (${profile.sampleCount} samples)`,
    target_ranges: {} as Record<string, { min: number; max: number; typical: number }>,
  };

  for (const [control, stats] of Object.entries(profile.adjustments)) {
    target.target_ranges[control] = {
      min: stats.min,
      max: stats.max,
      typical: stats.median,
    };
  }

  await fs.mkdir(outputDir, { recursive: true });
  const filename = `profile_target_${profile.scenarioKey.replace(/::/g, "_")}.json`;
  const outPath = path.join(outputDir, filename);
  await fs.writeFile(outPath, JSON.stringify(target, null, 2), "utf-8");
  return outPath;
}
