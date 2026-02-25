// 001_baseline_schema_versions.mjs — First migration: ensure all configs have _config_version
// This migration is idempotent — if _config_version already exists, it's a no-op for that file.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const id = "001_baseline_schema_versions";
export const description = "Ensure all config files have _config_version: 1";

export const affected_configs = [
  "hard_bans.json",
  "brief_config.json",
  "urgency_rules.json",
  "planning_preferences.json",
  "para_rules.json",
  "output_contracts.json",
  "llm_provider.json",
  "scheduler_config.json",
  "graph.profiles.json",
  "config_interactions.json",
  "style_guide.json",
  "draft_style.json",
  "builder_lane_config.json",
  "autonomy_ladder.json",
  "operator_profile.json",
  "onboarding_ramp.json",
  "notification_budget.json",
  "intake_template.json",
  "event_schema.json",
  "autonomy_per_task.json",
  "ted_agent.json",
  "migration_state.json",
  "capability_maturity.json",
  "feature_maturity.json",
  "ted_technology_radar.json",
  "competitive_landscape.json",
  "research_debt_scores.json",
  "decision_index.json",
];

export function up(configDir) {
  const results = [];
  for (const filename of affected_configs) {
    const filePath = path.join(configDir, filename);
    if (!fs.existsSync(filePath)) {
      results.push({ file: filename, action: "skipped", reason: "not_found" });
      continue;
    }
    try {
      const raw = fs.readFileSync(filePath, "utf8");
      const parsed = JSON.parse(raw);
      if (parsed._config_version !== undefined) {
        results.push({ file: filename, action: "no_op", reason: "already_versioned" });
        continue;
      }
      parsed._config_version = 1;
      // Atomic write: write to .tmp, then rename
      const tmpPath = filePath + ".tmp";
      fs.writeFileSync(tmpPath, JSON.stringify(parsed, null, 2) + "\n", "utf8");
      fs.renameSync(tmpPath, filePath);
      results.push({ file: filename, action: "versioned", version: 1 });
    } catch (err) {
      results.push({ file: filename, action: "error", error: err.message });
    }
  }
  return results;
}
