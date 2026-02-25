/**
 * QA-009 — Config Schema Validation Tests
 *
 * Validates every JSON config file in sidecars/ted-engine/config/:
 *  1. Is valid JSON
 *  2. Has _config_version
 *  3. File-specific structural validation
 *  4. Cross-config consistency checks
 */

import { readFileSync, readdirSync, existsSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, test, expect } from "vitest";

const __dirname = dirname(fileURLToPath(import.meta.url));
const configDir = resolve(__dirname, "../config");
const sidecarDir = resolve(__dirname, "..");

// Discover all JSON config files
const configFiles = readdirSync(configDir)
  .filter((f) => f.endsWith(".json"))
  .toSorted();

// Pre-load all configs
const configs = new Map();
for (const file of configFiles) {
  const raw = readFileSync(join(configDir, file), "utf-8");
  try {
    configs.set(file, JSON.parse(raw));
  } catch {
    configs.set(file, null); // Will be caught by the valid JSON test
  }
}

// ─────────────────────────────────────────────────────────
// Section 1: Basic JSON Validity
// ─────────────────────────────────────────────────────────

describe("Config files — valid JSON", () => {
  test.each(configFiles)("%s is valid JSON", (file) => {
    const parsed = configs.get(file);
    expect(parsed).not.toBeNull();
    expect(typeof parsed).toBe("object");
  });

  test("config directory has expected number of files (28-40)", () => {
    expect(configFiles.length).toBeGreaterThanOrEqual(28);
    expect(configFiles.length).toBeLessThanOrEqual(40);
  });
});

// ─────────────────────────────────────────────────────────
// Section 2: _config_version on every config
// ─────────────────────────────────────────────────────────

describe("Config files — _config_version present", () => {
  // Example files don't need _config_version
  const versionableFiles = configFiles.filter((f) => !f.includes(".example."));

  test.each(versionableFiles)("%s has _config_version", (file) => {
    const cfg = configs.get(file);
    if (!cfg) {
      return;
    } // Already caught by valid JSON test
    expect(cfg._config_version).toBeDefined();
    expect(typeof cfg._config_version).toBe("number");
    expect(cfg._config_version).toBeGreaterThanOrEqual(1);
  });
});

// ─────────────────────────────────────────────────────────
// Section 3: event_schema.json structural validation
// ─────────────────────────────────────────────────────────

describe("event_schema.json — structure", () => {
  const eventSchema = configs.get("event_schema.json");

  test("has event_envelope with required fields", () => {
    expect(eventSchema).toBeDefined();
    expect(eventSchema.event_envelope).toBeDefined();
    const envelope = eventSchema.event_envelope;
    expect(envelope.event_id).toBeDefined();
    expect(envelope.event_type).toBeDefined();
    expect(envelope.timestamp).toBeDefined();
    expect(envelope.source).toBeDefined();
    expect(envelope.payload).toBeDefined();
  });

  test("has event_types object", () => {
    expect(typeof eventSchema.event_types).toBe("object");
    const namespaces = Object.keys(eventSchema.event_types);
    expect(namespaces.length).toBeGreaterThan(20);
  });

  test("every namespace has at least one event", () => {
    for (const [_ns, events] of Object.entries(eventSchema.event_types)) {
      expect(typeof events).toBe("object");
      expect(Object.keys(events).length).toBeGreaterThan(0);
    }
  });

  test("event type keys use dotted namespace format", () => {
    for (const [_ns, events] of Object.entries(eventSchema.event_types)) {
      for (const eventKey of Object.keys(events)) {
        expect(eventKey).toMatch(/^[a-z_]+\.[a-z_]+/);
      }
    }
  });

  test("event type values are non-empty strings (descriptions)", () => {
    for (const [_ns, events] of Object.entries(eventSchema.event_types)) {
      for (const [_eventKey, desc] of Object.entries(events)) {
        expect(typeof desc).toBe("string");
        expect(desc.length).toBeGreaterThan(0);
      }
    }
  });

  test("total event count is 200+", () => {
    let total = 0;
    for (const events of Object.values(eventSchema.event_types)) {
      total += Object.keys(events).length;
    }
    expect(total).toBeGreaterThanOrEqual(200);
  });
});

// ─────────────────────────────────────────────────────────
// Section 4: output_contracts.json structural validation
// ─────────────────────────────────────────────────────────

describe("output_contracts.json — structure", () => {
  const contracts = configs.get("output_contracts.json");

  test("has _config_version", () => {
    expect(contracts._config_version).toBe(1);
  });

  // Keys that are metadata, not intent contracts
  const META_KEYS = new Set(["_config_version", "golden_fixtures"]);

  test("has multiple intent contracts", () => {
    const intents = Object.keys(contracts).filter((k) => !META_KEYS.has(k));
    expect(intents.length).toBeGreaterThanOrEqual(5);
  });

  test("each intent contract has required_sections array", () => {
    for (const [key, value] of Object.entries(contracts)) {
      if (META_KEYS.has(key)) {
        continue;
      }
      expect(Array.isArray(value.required_sections)).toBe(true);
    }
  });

  test("each intent contract has max_length number", () => {
    for (const [key, value] of Object.entries(contracts)) {
      if (META_KEYS.has(key)) {
        continue;
      }
      expect(typeof value.max_length).toBe("number");
      expect(value.max_length).toBeGreaterThan(0);
    }
  });

  test("each intent contract has forbidden_patterns array", () => {
    for (const [key, value] of Object.entries(contracts)) {
      if (META_KEYS.has(key)) {
        continue;
      }
      expect(Array.isArray(value.forbidden_patterns)).toBe(true);
    }
  });

  test("critical intents have non-empty required_sections", () => {
    const critical = ["morning_brief", "eod_digest", "improvement_proposal"];
    for (const intent of critical) {
      if (contracts[intent]) {
        expect(contracts[intent].required_sections.length).toBeGreaterThan(0);
      }
    }
  });
});

// ─────────────────────────────────────────────────────────
// Section 5: prompt_registry.json structural validation
// ─────────────────────────────────────────────────────────

describe("prompt_registry.json — structure", () => {
  const registry = configs.get("prompt_registry.json");

  test("has _config_version", () => {
    expect(registry._config_version).toBe(1);
  });

  test("has multiple prompt intents", () => {
    const intents = Object.keys(registry).filter((k) => k !== "_config_version");
    expect(intents.length).toBeGreaterThanOrEqual(3);
  });

  test("each intent has production version string", () => {
    for (const [key, value] of Object.entries(registry)) {
      if (key === "_config_version") {
        continue;
      }
      expect(typeof value.production).toBe("string");
      expect(value.production.length).toBeGreaterThan(0);
    }
  });

  test("each intent has versions object", () => {
    for (const [key, value] of Object.entries(registry)) {
      if (key === "_config_version") {
        continue;
      }
      expect(typeof value.versions).toBe("object");
      expect(Object.keys(value.versions).length).toBeGreaterThan(0);
    }
  });

  test("production version exists in versions", () => {
    for (const [key, value] of Object.entries(registry)) {
      if (key === "_config_version") {
        continue;
      }
      expect(value.versions[value.production]).toBeDefined();
    }
  });

  test("each version has template_file", () => {
    for (const [key, value] of Object.entries(registry)) {
      if (key === "_config_version") {
        continue;
      }
      for (const [_ver, vCfg] of Object.entries(value.versions)) {
        expect(typeof vCfg.template_file).toBe("string");
        expect(vCfg.template_file.length).toBeGreaterThan(0);
      }
    }
  });

  test("template files exist on disk", () => {
    for (const [key, value] of Object.entries(registry)) {
      if (key === "_config_version") {
        continue;
      }
      for (const [_ver, vCfg] of Object.entries(value.versions)) {
        const templatePath = resolve(sidecarDir, vCfg.template_file);
        const exists = existsSync(templatePath);
        expect(exists).toBe(true);
      }
    }
  });
});

// ─────────────────────────────────────────────────────────
// Section 6: evaluation_graders.json structural validation
// ─────────────────────────────────────────────────────────

describe("evaluation_graders.json — structure", () => {
  const graders = configs.get("evaluation_graders.json");

  test("has grader_types object", () => {
    expect(typeof graders.grader_types).toBe("object");
    expect(Object.keys(graders.grader_types).length).toBeGreaterThanOrEqual(4);
  });

  test("each grader type has description and cost", () => {
    for (const [_name, def] of Object.entries(graders.grader_types)) {
      expect(typeof def.description).toBe("string");
      expect(typeof def.cost).toBe("string");
    }
  });

  test("has intents object with multiple entries", () => {
    expect(typeof graders.intents).toBe("object");
    expect(Object.keys(graders.intents).length).toBeGreaterThanOrEqual(10);
  });

  test("each intent has graders array with valid grader types", () => {
    const validTypes = Object.keys(graders.grader_types);
    for (const [_intent, cfg] of Object.entries(graders.intents)) {
      expect(Array.isArray(cfg.graders)).toBe(true);
      expect(cfg.graders.length).toBeGreaterThan(0);
      for (const g of cfg.graders) {
        expect(validTypes).toContain(g);
      }
    }
  });

  test("has thresholds with default_pass_score", () => {
    expect(typeof graders.thresholds).toBe("object");
    expect(typeof graders.thresholds.default_pass_score).toBe("number");
    expect(graders.thresholds.default_pass_score).toBeGreaterThan(0);
    expect(graders.thresholds.default_pass_score).toBeLessThanOrEqual(1);
  });
});

// ─────────────────────────────────────────────────────────
// Section 7: route_contracts.json structural validation
// ─────────────────────────────────────────────────────────

describe("route_contracts.json — structure", () => {
  const routeContracts = configs.get("route_contracts.json");

  test("has routes object with 155+ entries", () => {
    expect(typeof routeContracts.routes).toBe("object");
    expect(Object.keys(routeContracts.routes).length).toBeGreaterThanOrEqual(155);
  });
});

// ─────────────────────────────────────────────────────────
// Section 8: Key config files exist
// ─────────────────────────────────────────────────────────

describe("Required config files exist", () => {
  const requiredConfigs = [
    "event_schema.json",
    "output_contracts.json",
    "prompt_registry.json",
    "evaluation_graders.json",
    "route_contracts.json",
    "operator_profile.json",
    "hard_bans.json",
    "style_guide.json",
    "scheduler_config.json",
    "notification_budget.json",
    "llm_provider.json",
    "graph.profiles.json",
    "autonomy_ladder.json",
    "builder_lane_config.json",
    "migration_state.json",
    "ted_constitution.json",
    "ted_agent.json",
  ];

  test.each(requiredConfigs)("%s exists in config directory", (file) => {
    expect(configFiles).toContain(file);
  });
});

// ─────────────────────────────────────────────────────────
// Section 9: Cross-config consistency
// ─────────────────────────────────────────────────────────

describe("Cross-config consistency", () => {
  test("evaluation_graders intents overlap with output_contracts intents", () => {
    const graders = configs.get("evaluation_graders.json");
    const contracts = configs.get("output_contracts.json");
    if (!graders || !contracts) {
      return;
    }

    const graderIntents = Object.keys(graders.intents);
    const contractIntents = new Set(Object.keys(contracts).filter((k) => k !== "_config_version"));

    // At least some intents should be in both
    const overlap = graderIntents.filter((i) => contractIntents.has(i));
    expect(overlap.length).toBeGreaterThan(0);
  });

  test("prompt_registry intents overlap with output_contracts intents", () => {
    const registry = configs.get("prompt_registry.json");
    const contracts = configs.get("output_contracts.json");
    if (!registry || !contracts) {
      return;
    }

    const registryIntents = Object.keys(registry).filter((k) => k !== "_config_version");
    const contractIntents = new Set(Object.keys(contracts).filter((k) => k !== "_config_version"));

    const overlap = registryIntents.filter((i) => contractIntents.has(i));
    expect(overlap.length).toBeGreaterThan(0);
  });

  test("evaluation_graders critical intents match thresholds list", () => {
    const graders = configs.get("evaluation_graders.json");
    if (!graders) {
      return;
    }

    for (const critIntent of graders.thresholds.critical_intents || []) {
      expect(graders.intents[critIntent]).toBeDefined();
    }
  });
});

// ─────────────────────────────────────────────────────────
// Section 10: No config file exceeds size limits
// ─────────────────────────────────────────────────────────

describe("Config files — size sanity", () => {
  test.each(configFiles)("%s is under 500KB", (file) => {
    const raw = readFileSync(join(configDir, file), "utf-8");
    expect(raw.length).toBeLessThan(500_000);
  });

  test("no empty config files", () => {
    for (const file of configFiles) {
      const raw = readFileSync(join(configDir, file), "utf-8");
      expect(raw.trim().length).toBeGreaterThan(2);
    }
  });
});
