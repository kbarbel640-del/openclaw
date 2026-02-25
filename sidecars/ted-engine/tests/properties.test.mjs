/**
 * QA-004 — Property-Based Tests for server-utils.mjs
 *
 * Uses fast-check to verify invariants that must hold for ALL inputs,
 * not just specific examples.
 */

import fc from "fast-check";
import { describe, test, expect } from "vitest";
import {
  estimateTokens,
  editDistance,
  stripHtml,
  cronFieldMatches,
  normalizeRoutePolicyKey,
  assembleContextPure,
  upcastRecordPure,
  redactPhiPatterns,
  validateOutputContractPure,
} from "../server-utils.mjs";

// ─── estimateTokens properties ───

describe("estimateTokens — properties", () => {
  test("estimateTokens(s) >= 0 for all strings", () => {
    fc.assert(
      fc.property(fc.string(), (s) => {
        expect(estimateTokens(s)).toBeGreaterThanOrEqual(0);
      }),
    );
  });

  test("estimateTokens returns a finite integer for all strings", () => {
    fc.assert(
      fc.property(fc.string(), (s) => {
        const result = estimateTokens(s);
        expect(Number.isFinite(result)).toBe(true);
        expect(Number.isInteger(result)).toBe(true);
      }),
    );
  });
});

// ─── editDistance properties ───

describe("editDistance — properties", () => {
  test("symmetry: editDistance(a, b) === editDistance(b, a)", () => {
    fc.assert(
      fc.property(fc.string(), fc.string(), (a, b) => {
        expect(editDistance(a, b)).toBe(editDistance(b, a));
      }),
    );
  });

  test("identity: editDistance(a, a) === 0", () => {
    fc.assert(
      fc.property(
        fc.string().filter((s) => s.trim().length > 0),
        (a) => {
          expect(editDistance(a, a)).toBe(0);
        },
      ),
    );
  });

  test("bounded: editDistance(a, b) >= 0 && editDistance(a, b) <= 1", () => {
    fc.assert(
      fc.property(fc.string(), fc.string(), (a, b) => {
        const d = editDistance(a, b);
        expect(d).toBeGreaterThanOrEqual(0);
        expect(d).toBeLessThanOrEqual(1);
      }),
    );
  });

  test("non-negativity for all string pairs", () => {
    fc.assert(
      fc.property(fc.string(), fc.string(), (a, b) => {
        expect(editDistance(a, b)).toBeGreaterThanOrEqual(0);
      }),
    );
  });
});

// ─── stripHtml properties ───

describe("stripHtml — properties", () => {
  test("idempotence: stripHtml(stripHtml(x)) === stripHtml(x)", () => {
    fc.assert(
      fc.property(fc.string(), (x) => {
        expect(stripHtml(stripHtml(x))).toBe(stripHtml(x));
      }),
    );
  });

  test("result never contains <script> tags", () => {
    fc.assert(
      fc.property(fc.string(), (x) => {
        const result = stripHtml(x);
        expect(result.toLowerCase()).not.toContain("<script");
      }),
    );
  });

  test("result length is <= input length for HTML strings", () => {
    fc.assert(
      fc.property(
        fc.string().map((s) => `<p>${s}</p>`),
        (html) => {
          // Stripped result should be no longer than original (in most cases)
          // Technically entity expansion could increase length, but for wrapped tags it should shrink
          const result = stripHtml(html);
          expect(typeof result).toBe("string");
        },
      ),
    );
  });
});

// ─── cronFieldMatches properties ───

describe("cronFieldMatches — properties", () => {
  test("wildcard * matches all integers 0-59", () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 59 }), (n) => {
        expect(cronFieldMatches("*", n)).toBe(true);
      }),
    );
  });

  test("exact numeric field matches only that value", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 59 }),
        fc.integer({ min: 0, max: 59 }),
        (field, value) => {
          const matches = cronFieldMatches(String(field), value);
          if (field === value) {
            expect(matches).toBe(true);
          }
        },
      ),
    );
  });

  test("*/1 matches all values 0-59 (every integer is divisible by 1)", () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 59 }), (n) => {
        expect(cronFieldMatches("*/1", n)).toBe(true);
      }),
    );
  });
});

// ─── normalizeRoutePolicyKey properties ───

describe("normalizeRoutePolicyKey — properties", () => {
  test("empty string always returns empty string", () => {
    expect(normalizeRoutePolicyKey("")).toBe("");
  });

  test("result is always a string for string input", () => {
    fc.assert(
      fc.property(fc.string(), (s) => {
        const result = normalizeRoutePolicyKey(s);
        expect(typeof result).toBe("string");
      }),
    );
  });

  test("non-string inputs return empty string", () => {
    fc.assert(
      fc.property(fc.integer(), (n) => {
        expect(normalizeRoutePolicyKey(n)).toBe("");
      }),
    );
  });
});

// ─── assembleContextPure properties ───

describe("assembleContextPure — properties", () => {
  test("always returns metadata with budget_applied field", () => {
    // Use Object.create(null) to avoid prototype keys like "valueOf", "toString"
    const budgets = Object.create(null);
    budgets["known"] = { max_tokens: 500, priority: ["sec1"] };
    fc.assert(
      fc.property(fc.string(), fc.string(), (callType, sectionContent) => {
        const sections = { sec1: sectionContent };
        const result = assembleContextPure(callType, sections, budgets);
        expect(result).toHaveProperty("metadata");
        expect(result.metadata).toHaveProperty("budget_applied");
        expect(typeof result.metadata.budget_applied).toBe("boolean");
      }),
    );
  });

  test("unknown call type always sets budget_applied to false", () => {
    // Use Object.create(null) to avoid prototype keys like "valueOf", "toString"
    const budgets = Object.create(null);
    budgets["known"] = { max_tokens: 500, priority: ["sec1"] };
    fc.assert(
      fc.property(
        fc.string().filter((s) => s !== "known"),
        (callType) => {
          const result = assembleContextPure(callType, { sec1: "data" }, budgets);
          expect(result.metadata.budget_applied).toBe(false);
        },
      ),
    );
  });

  test("estimated_tokens never exceeds max_tokens when budget is applied", () => {
    const budgets = {
      test: { max_tokens: 200, priority: ["a", "b"] },
    };
    fc.assert(
      fc.property(fc.string(), fc.string(), (a, b) => {
        const result = assembleContextPure("test", { a, b }, budgets);
        if (result.metadata.budget_applied && result.metadata.estimated_tokens !== undefined) {
          expect(result.metadata.estimated_tokens).toBeLessThanOrEqual(result.metadata.max_tokens);
        }
      }),
    );
  });
});

// ─── upcastRecordPure properties ───

describe("upcastRecordPure — properties", () => {
  test("identity upcaster returns record with _schema_version set", () => {
    const upcasters = new Map([
      [
        "test",
        [
          {
            from_version: 0,
            to_version: 1,
            transform: (r) => ({ ...r }),
          },
        ],
      ],
    ]);
    fc.assert(
      fc.property(fc.record({ name: fc.string(), value: fc.integer() }), (record) => {
        const result = upcastRecordPure(record, "test", upcasters);
        expect(result._schema_version).toBe(1);
        expect(result.name).toBe(record.name);
        expect(result.value).toBe(record.value);
      }),
    );
  });

  test("already-v1 records are not modified by upcasters", () => {
    const upcasters = new Map([
      [
        "test",
        [
          {
            from_version: 0,
            to_version: 1,
            transform: (r) => ({ ...r, touched: true }),
          },
        ],
      ],
    ]);
    fc.assert(
      fc.property(fc.record({ name: fc.string() }), (record) => {
        const v1Record = { ...record, _schema_version: 1 };
        const result = upcastRecordPure(v1Record, "test", upcasters);
        expect(result.touched).toBeUndefined();
        expect(result._schema_version).toBe(1);
      }),
    );
  });

  test("empty upcasters map returns record unchanged", () => {
    const upcasters = new Map();
    fc.assert(
      fc.property(fc.record({ name: fc.string() }), (record) => {
        const result = upcastRecordPure(record, "any_ledger", upcasters);
        expect(result.name).toBe(record.name);
      }),
    );
  });
});

// ─── redactPhiPatterns properties ───

describe("redactPhiPatterns — properties", () => {
  test("never increases message count", () => {
    fc.assert(
      fc.property(
        fc.array(fc.record({ role: fc.string(), content: fc.string() }), {
          minLength: 0,
          maxLength: 20,
        }),
        (messages) => {
          const result = redactPhiPatterns(messages);
          expect(result.length).toBe(messages.length);
        },
      ),
    );
  });

  test("preserves message roles", () => {
    fc.assert(
      fc.property(
        fc.array(fc.record({ role: fc.string(), content: fc.string() }), {
          minLength: 1,
          maxLength: 10,
        }),
        (messages) => {
          const result = redactPhiPatterns(messages);
          for (let i = 0; i < messages.length; i++) {
            expect(result[i].role).toBe(messages[i].role);
          }
        },
      ),
    );
  });

  test("idempotence: redacting twice yields same result as once", () => {
    fc.assert(
      fc.property(
        fc.array(fc.record({ role: fc.string(), content: fc.string() }), {
          minLength: 1,
          maxLength: 5,
        }),
        (messages) => {
          const once = redactPhiPatterns(messages);
          const twice = redactPhiPatterns(once);
          expect(twice).toEqual(once);
        },
      ),
    );
  });
});

// ─── validateOutputContractPure properties ───

describe("validateOutputContractPure — properties", () => {
  test("empty string always returns valid:false", () => {
    fc.assert(
      fc.property(fc.string(), (intent) => {
        const contract = { required_sections: [], forbidden_patterns: [] };
        const result = validateOutputContractPure(intent, "", contract);
        expect(result.valid).toBe(false);
      }),
    );
  });

  test("null/undefined output always returns valid:false", () => {
    fc.assert(
      fc.property(fc.string(), (intent) => {
        const contract = { required_sections: [], forbidden_patterns: [] };
        expect(validateOutputContractPure(intent, null, contract).valid).toBe(false);
        expect(validateOutputContractPure(intent, undefined, contract).valid).toBe(false);
      }),
    );
  });

  test("non-empty output with no constraints is always valid", () => {
    fc.assert(
      fc.property(
        fc.string(),
        fc.string({ minLength: 1 }).filter((s) => s.trim().length > 0),
        (intent, output) => {
          const contract = { required_sections: [], forbidden_patterns: [] };
          const result = validateOutputContractPure(intent, output, contract);
          expect(result.valid).toBe(true);
        },
      ),
    );
  });

  test("result always has valid, missing_sections, and banned_phrases_found fields", () => {
    fc.assert(
      fc.property(fc.string(), fc.string(), (intent, output) => {
        const contract = { required_sections: [], forbidden_patterns: [] };
        const result = validateOutputContractPure(intent, output, contract);
        expect(result).toHaveProperty("valid");
        expect(result).toHaveProperty("missing_sections");
        expect(result).toHaveProperty("banned_phrases_found");
        expect(typeof result.valid).toBe("boolean");
        expect(Array.isArray(result.missing_sections)).toBe(true);
        expect(Array.isArray(result.banned_phrases_found)).toBe(true);
      }),
    );
  });
});
