/**
 * QA-013 — LLM Evaluation Vitest Harness
 *
 * Exercises the multi-grader evaluation pipeline offline:
 *  1. Loads golden fixtures from output_contracts.json
 *  2. Loads grader config from evaluation_graders.json
 *  3. Runs each fixture through runMultiGraderEvaluationPure()
 *  4. Asserts composite scores meet thresholds
 *  5. Reports per-grader breakdown
 */

import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, test, expect } from "vitest";
import {
  gradeSchema,
  gradeKeyword,
  gradeConstraint,
  gradePattern,
  runMultiGraderEvaluationPure,
  validateOutputContractPure,
} from "../server-utils.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const contractsPath = resolve(__dirname, "../config/output_contracts.json");
const gradersPath = resolve(__dirname, "../config/evaluation_graders.json");

const contracts = JSON.parse(readFileSync(contractsPath, "utf-8"));
const gradersConfig = JSON.parse(readFileSync(gradersPath, "utf-8"));
const goldenFixtures = contracts.golden_fixtures || {};

// Build fixture entries for test.each (skip metadata keys like _description)
const fixtureEntries = Object.entries(goldenFixtures)
  .filter(([name, data]) => name !== "_description" && typeof data === "object" && data.fixture)
  .map(([name, data]) => {
    const intent = data.validates_against || name;
    const text = data.fixture || "";
    return [name, intent, text];
  });

// ─────────────────────────────────────────────────────────
// Section 1: Golden Fixture Smoke Tests
// ─────────────────────────────────────────────────────────

describe("Golden fixtures — basic properties", () => {
  test("at least 10 golden fixtures exist", () => {
    expect(fixtureEntries.length).toBeGreaterThanOrEqual(10);
  });

  test.each(fixtureEntries)("%s fixture is non-empty", (name, _intent, text) => {
    expect(text.length).toBeGreaterThan(10);
  });

  test.each(fixtureEntries)("%s has a validates_against intent", (name, intent) => {
    expect(intent.length).toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────────────────────
// Section 2: Legacy Contract Validation (all fixtures pass)
// ─────────────────────────────────────────────────────────

describe("Golden fixtures — legacy contract validation", () => {
  test.each(fixtureEntries)("%s passes output contract validation", (name, intent, text) => {
    const contract = contracts[intent] || {};
    const result = validateOutputContractPure(intent, text, contract);
    expect(result.valid).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────
// Section 3: Multi-Grader Evaluation (per-fixture)
// ─────────────────────────────────────────────────────────

describe("Golden fixtures — multi-grader evaluation", () => {
  test.each(fixtureEntries)("%s passes multi-grader pipeline", (name, intent, text) => {
    const result = runMultiGraderEvaluationPure(text, intent, gradersConfig);
    expect(result.pass).toBe(true);
    expect(result.composite_score).toBeGreaterThanOrEqual(0.7);
  });

  test.each(fixtureEntries)("%s has no early exits", (name, intent, text) => {
    const result = runMultiGraderEvaluationPure(text, intent, gradersConfig);
    expect(result.early_exit).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────
// Section 4: Per-Grader Tests
// ─────────────────────────────────────────────────────────

describe("Schema grader", () => {
  test("passes when all required fields present", () => {
    const result = gradeSchema("classification: high, urgency: critical, reason: deadline", {
      required_fields: ["classification", "urgency", "reason"],
    });
    expect(result.score).toBe(1);
    expect(result.details.missing).toEqual([]);
  });

  test("fails when fields missing", () => {
    const result = gradeSchema("classification: high", {
      required_fields: ["classification", "urgency", "reason"],
    });
    expect(result.score).toBe(0);
    expect(result.details.missing).toContain("urgency");
    expect(result.details.missing).toContain("reason");
  });

  test("passes with empty required_fields", () => {
    const result = gradeSchema("anything", { required_fields: [] });
    expect(result.score).toBe(1);
  });
});

describe("Keyword grader", () => {
  test("passes must_contain_one_of", () => {
    const result = gradeKeyword("urgency is high today", {
      must_contain_one_of: ["low", "medium", "high", "critical"],
    });
    expect(result.score).toBe(1);
    expect(result.details.has_one_of).toBe(true);
  });

  test("fails must_contain_one_of when none present", () => {
    const result = gradeKeyword("nothing matches", {
      must_contain_one_of: ["low", "medium", "high", "critical"],
    });
    expect(result.score).toBe(0);
    expect(result.details.has_one_of).toBe(false);
  });

  test("passes must_contain_all", () => {
    const result = gradeKeyword("Hi Clint, here is the draft", {
      must_contain_all: ["Clint"],
    });
    expect(result.score).toBe(1);
  });

  test("fails must_not_contain", () => {
    const result = gradeKeyword("TODO: fix this later", {
      must_not_contain: ["TODO"],
    });
    expect(result.score).toBe(0);
    expect(result.details.forbidden_found).toContain("TODO");
  });
});

describe("Constraint grader", () => {
  test("passes within token limit", () => {
    const result = gradeConstraint("a short text", { max_tokens: 500 });
    expect(result.score).toBe(1);
    expect(result.details.token_ok).toBe(true);
  });

  test("fails when exceeding token limit", () => {
    const longText = Array(500).fill("word").join(" ");
    const result = gradeConstraint(longText, { max_tokens: 100 });
    expect(result.score).toBe(0);
    expect(result.details.token_ok).toBe(false);
  });

  test("fails on banned phrase", () => {
    const result = gradeConstraint("This is a TODO: placeholder", {
      max_tokens: 1000,
      banned_phrases: ["TODO:"],
    });
    expect(result.score).toBe(0);
    expect(result.details.banned_found).toContain("TODO:");
  });
});

describe("Pattern grader", () => {
  test("passes must_match regex", () => {
    const result = gradePattern("deal-id-2024-abc", {
      must_match: ["deal-[a-z]+-\\d{4}"],
    });
    expect(result.score).toBe(1);
  });

  test("fails must_match regex", () => {
    const result = gradePattern("no match here", {
      must_match: ["^\\d{4}-\\d{2}-\\d{2}$"],
    });
    expect(result.score).toBe(0);
  });

  test("fails must_not_match regex", () => {
    const result = gradePattern("Password: 12345", {
      must_not_match: ["[Pp]assword"],
    });
    expect(result.score).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────
// Section 5: Multi-Grader Composition
// ─────────────────────────────────────────────────────────

describe("Multi-grader composition", () => {
  test("early-exits on schema hard failure", () => {
    const config = {
      intents: {
        test_intent: {
          graders: ["schema", "keyword"],
          schema: { required_fields: ["missing_field"] },
          keyword: { must_contain_one_of: ["anything"] },
        },
      },
      thresholds: { default_pass_score: 0.7 },
    };
    const result = runMultiGraderEvaluationPure("no fields here", "test_intent", config);
    expect(result.pass).toBe(false);
    expect(result.early_exit).toBe("schema");
    expect(result.grader_scores.keyword).toBeUndefined();
  });

  test("early-exits on constraint hard failure", () => {
    const config = {
      intents: {
        test_intent: {
          graders: ["constraint"],
          constraint: { max_tokens: 1, banned_phrases: [] },
        },
      },
      thresholds: { default_pass_score: 0.7 },
    };
    const result = runMultiGraderEvaluationPure("way too many words here", "test_intent", config);
    expect(result.pass).toBe(false);
    expect(result.early_exit).toBe("constraint");
  });

  test("returns pass=true when all graders pass", () => {
    const config = {
      intents: {
        test_intent: {
          graders: ["schema", "keyword"],
          schema: { required_fields: ["hello"] },
          keyword: { must_contain_one_of: ["world"] },
        },
      },
      thresholds: { default_pass_score: 0.7 },
    };
    const result = runMultiGraderEvaluationPure("hello world", "test_intent", config);
    expect(result.pass).toBe(true);
    expect(result.composite_score).toBe(1);
    expect(result.early_exit).toBeNull();
  });

  test("uses critical threshold for critical intents", () => {
    const config = {
      intents: {
        draft_email: {
          graders: ["keyword"],
          keyword: { must_contain_one_of: ["missing"] },
        },
      },
      thresholds: {
        default_pass_score: 0.7,
        critical_intents: ["draft_email"],
        critical_pass_score: 0.85,
      },
    };
    const result = runMultiGraderEvaluationPure("no match", "draft_email", config);
    expect(result.pass).toBe(false);
  });

  test("skips unknown graders gracefully", () => {
    const config = {
      intents: {
        test_intent: {
          graders: ["semantic", "llm_judge"],
        },
      },
      thresholds: { default_pass_score: 0.7 },
    };
    const result = runMultiGraderEvaluationPure("some text", "test_intent", config);
    expect(result.pass).toBe(true);
    expect(result.grader_scores.semantic.details.skipped).toBe(true);
    expect(result.grader_scores.llm_judge.details.skipped).toBe(true);
  });

  test("returns pass=true for unknown intent (no config)", () => {
    const result = runMultiGraderEvaluationPure("anything", "unknown_intent", gradersConfig);
    expect(result.pass).toBe(true);
    expect(result.composite_score).toBe(1);
  });
});

// ─────────────────────────────────────────────────────────
// Section 6: Aggregate Quality Metrics
// ─────────────────────────────────────────────────────────

describe("Golden fixtures — aggregate quality", () => {
  test("overall pass rate is 100% for golden fixtures", () => {
    let passCount = 0;
    for (const [_name, intent, text] of fixtureEntries) {
      const result = runMultiGraderEvaluationPure(text, intent, gradersConfig);
      if (result.pass) {
        passCount++;
      }
    }
    const passRate = fixtureEntries.length > 0 ? passCount / fixtureEntries.length : 0;
    expect(passRate).toBe(1);
  });

  test("average composite score is >= 0.9", () => {
    let totalScore = 0;
    for (const [_name, intent, text] of fixtureEntries) {
      const result = runMultiGraderEvaluationPure(text, intent, gradersConfig);
      totalScore += result.composite_score;
    }
    const avgScore = fixtureEntries.length > 0 ? totalScore / fixtureEntries.length : 0;
    expect(avgScore).toBeGreaterThanOrEqual(0.9);
  });
});
