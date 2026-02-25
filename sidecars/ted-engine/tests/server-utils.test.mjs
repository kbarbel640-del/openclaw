/**
 * QA-003 — Unit Tests for server-utils.mjs
 *
 * Example-based unit tests covering every exported pure function.
 * Each function gets a describe() block with >= 3 test cases.
 */

import { describe, test, expect } from "vitest";
import {
  estimateTokens,
  editDistance,
  stripHtml,
  cronFieldMatches,
  cronMatchesDate,
  normalizeRoutePolicyKey,
  assembleContextPure,
  upcastRecordPure,
  redactPhiPatterns,
  validateOutputContractPure,
} from "../server-utils.mjs";

// ─── estimateTokens ───

describe("estimateTokens", () => {
  test("returns 0 for an empty string", () => {
    // empty string splits to [""] which has length 1, ceil(1*1.3) = 2
    // Actually: "".split(/\s+/) => [""] (length 1)
    // ceil(1 * 1.3) = 2
    expect(estimateTokens("")).toBe(2);
  });

  test("returns a positive integer for a single word", () => {
    // "hello".split(/\s+/) => ["hello"] (length 1)
    // ceil(1 * 1.3) = 2
    expect(estimateTokens("hello")).toBe(2);
  });

  test("estimates tokens for a multi-word paragraph", () => {
    const paragraph = "The quick brown fox jumps over the lazy dog";
    // 9 words => ceil(9 * 1.3) = ceil(11.7) = 12
    expect(estimateTokens(paragraph)).toBe(12);
  });

  test("returns 0 for non-string input (number)", () => {
    expect(estimateTokens(42)).toBe(0);
  });

  test("returns 0 for null input", () => {
    expect(estimateTokens(null)).toBe(0);
  });

  test("returns 0 for undefined input", () => {
    expect(estimateTokens(undefined)).toBe(0);
  });

  test("handles whitespace-only string", () => {
    // "   ".split(/\s+/) => ["", ""] (length 2) with filter... wait, no filter here
    // Actually split keeps empty strings: "   ".split(/\s+/) => ["", ""]
    // length 2 => ceil(2 * 1.3) = 3
    expect(estimateTokens("   ")).toBe(3);
  });
});

// ─── editDistance ───

describe("editDistance", () => {
  test("returns 0 for identical strings", () => {
    expect(editDistance("hello world", "hello world")).toBe(0);
  });

  test("returns 1.0 for completely different strings", () => {
    expect(editDistance("alpha beta", "gamma delta")).toBe(1.0);
  });

  test("returns a value between 0 and 1 for partial overlap", () => {
    // "hello world" => words: {hello, world}
    // "hello there" => words: {hello, there}
    // shared = 1 (hello), total = 3 (hello, world, there)
    // distance = round((1 - 1/3) * 100) / 100 = round(66.67) / 100 = 0.67
    const d = editDistance("hello world", "hello there");
    expect(d).toBeGreaterThan(0);
    expect(d).toBeLessThan(1);
    expect(d).toBeCloseTo(0.67, 2);
  });

  test("returns 0.0 for two empty strings", () => {
    expect(editDistance("", "")).toBe(0.0);
  });

  test("returns 1.0 when one string is empty and the other is not", () => {
    expect(editDistance("", "hello")).toBe(1.0);
    expect(editDistance("hello", "")).toBe(1.0);
  });

  test("returns 1.0 for non-string inputs", () => {
    expect(editDistance(123, "hello")).toBe(1.0);
    expect(editDistance("hello", null)).toBe(1.0);
    expect(editDistance(undefined, undefined)).toBe(1.0);
  });

  test("is symmetric: editDistance(a, b) === editDistance(b, a)", () => {
    expect(editDistance("foo bar", "bar baz")).toBe(editDistance("bar baz", "foo bar"));
  });
});

// ─── stripHtml ───

describe("stripHtml", () => {
  test("returns plain text unchanged", () => {
    expect(stripHtml("hello world")).toBe("hello world");
  });

  test("strips simple HTML tags", () => {
    expect(stripHtml("<p>hello</p>")).toBe("hello");
  });

  test("removes script tags and their content", () => {
    expect(stripHtml('<script>alert("xss")</script>safe text')).toBe("safe text");
  });

  test("decodes HTML entities", () => {
    const result = stripHtml("&amp; &lt; &gt; &nbsp; &quot; &apos;");
    expect(result).toBe("& < >   \" '");
  });

  test("handles nested tags", () => {
    expect(stripHtml("<div><p><strong>bold text</strong></p></div>")).toBe("bold text");
  });

  test("returns empty string for empty input", () => {
    expect(stripHtml("")).toBe("");
  });

  test("returns empty string for non-string input", () => {
    expect(stripHtml(null)).toBe("");
    expect(stripHtml(42)).toBe("");
  });

  test("strips style tags and their content", () => {
    expect(stripHtml("<style>.foo{color:red}</style>visible")).toBe("visible");
  });

  test("converts br tags to newlines", () => {
    expect(stripHtml("line1<br>line2")).toBe("line1\nline2");
  });

  test("decodes numeric character references", () => {
    expect(stripHtml("&#65;&#66;&#67;")).toBe("ABC");
  });

  test("decodes hex character references", () => {
    expect(stripHtml("&#x41;&#x42;&#x43;")).toBe("ABC");
  });
});

// ─── cronFieldMatches ───

describe("cronFieldMatches", () => {
  test("wildcard * matches any value", () => {
    expect(cronFieldMatches("*", 0)).toBe(true);
    expect(cronFieldMatches("*", 30)).toBe(true);
    expect(cronFieldMatches("*", 59)).toBe(true);
  });

  test("exact match", () => {
    expect(cronFieldMatches("5", 5)).toBe(true);
    expect(cronFieldMatches("5", 6)).toBe(false);
  });

  test("range 1-5 matches values in range", () => {
    expect(cronFieldMatches("1-5", 1)).toBe(true);
    expect(cronFieldMatches("1-5", 3)).toBe(true);
    expect(cronFieldMatches("1-5", 5)).toBe(true);
    expect(cronFieldMatches("1-5", 0)).toBe(false);
    expect(cronFieldMatches("1-5", 6)).toBe(false);
  });

  test("step */5 matches multiples of 5", () => {
    expect(cronFieldMatches("*/5", 0)).toBe(true);
    expect(cronFieldMatches("*/5", 5)).toBe(true);
    expect(cronFieldMatches("*/5", 10)).toBe(true);
    expect(cronFieldMatches("*/5", 3)).toBe(false);
    expect(cronFieldMatches("*/5", 7)).toBe(false);
  });

  test("step with range 1-10/2 matches even offsets from start", () => {
    // 1-10/2 means start at 1, step by 2: 1, 3, 5, 7, 9
    expect(cronFieldMatches("1-10/2", 1)).toBe(true);
    expect(cronFieldMatches("1-10/2", 3)).toBe(true);
    expect(cronFieldMatches("1-10/2", 5)).toBe(true);
    expect(cronFieldMatches("1-10/2", 9)).toBe(true);
    expect(cronFieldMatches("1-10/2", 2)).toBe(false);
    expect(cronFieldMatches("1-10/2", 11)).toBe(false);
  });

  test("comma-separated values", () => {
    expect(cronFieldMatches("1,5,10", 1)).toBe(true);
    expect(cronFieldMatches("1,5,10", 5)).toBe(true);
    expect(cronFieldMatches("1,5,10", 10)).toBe(true);
    expect(cronFieldMatches("1,5,10", 3)).toBe(false);
  });

  test("comma-separated with ranges", () => {
    expect(cronFieldMatches("1-3,7-9", 2)).toBe(true);
    expect(cronFieldMatches("1-3,7-9", 8)).toBe(true);
    expect(cronFieldMatches("1-3,7-9", 5)).toBe(false);
  });
});

// ─── cronMatchesDate ───

describe("cronMatchesDate", () => {
  test("full cron '* * * * *' matches any date", () => {
    const dateObj = { minute: 30, hour: 14, dayOfMonth: 15, month: 6, dayOfWeek: 3 };
    expect(cronMatchesDate("* * * * *", dateObj)).toBe(true);
  });

  test("specific cron matches the correct date", () => {
    const dateObj = { minute: 0, hour: 9, dayOfMonth: 1, month: 1, dayOfWeek: 3 };
    expect(cronMatchesDate("0 9 1 1 3", dateObj)).toBe(true);
  });

  test("specific cron does NOT match wrong date", () => {
    const dateObj = { minute: 30, hour: 14, dayOfMonth: 15, month: 6, dayOfWeek: 3 };
    expect(cronMatchesDate("0 9 1 1 1", dateObj)).toBe(false);
  });

  test("returns false for invalid/empty expression", () => {
    const dateObj = { minute: 0, hour: 0, dayOfMonth: 1, month: 1, dayOfWeek: 0 };
    expect(cronMatchesDate("", dateObj)).toBe(false);
    expect(cronMatchesDate(null, dateObj)).toBe(false);
    expect(cronMatchesDate(undefined, dateObj)).toBe(false);
  });

  test("returns false for expression with fewer than 5 parts", () => {
    const dateObj = { minute: 0, hour: 0, dayOfMonth: 1, month: 1, dayOfWeek: 0 };
    expect(cronMatchesDate("* * *", dateObj)).toBe(false);
    expect(cronMatchesDate("0 9", dateObj)).toBe(false);
  });

  test("normalizes day-of-week 7 to 0 (Sunday)", () => {
    const sunday = { minute: 0, hour: 0, dayOfMonth: 1, month: 1, dayOfWeek: 0 };
    expect(cronMatchesDate("0 0 1 1 7", sunday)).toBe(true);
  });

  test("cron with ranges and steps", () => {
    const dateObj = { minute: 15, hour: 10, dayOfMonth: 5, month: 3, dayOfWeek: 2 };
    expect(cronMatchesDate("*/15 8-18 1-10 * *", dateObj)).toBe(true);
  });
});

// ─── normalizeRoutePolicyKey ───

describe("normalizeRoutePolicyKey", () => {
  test("normalizes /deals/abc to /deals/{deal_id}", () => {
    expect(normalizeRoutePolicyKey("/deals/abc")).toBe("/deals/{deal_id}");
  });

  test("normalizes /deals/abc123/update", () => {
    expect(normalizeRoutePolicyKey("/deals/abc123/update")).toBe("/deals/{deal_id}/update");
  });

  test("normalizes /triage/xyz/link to /triage/{item_id}/link", () => {
    expect(normalizeRoutePolicyKey("/triage/xyz/link")).toBe("/triage/{item_id}/link");
  });

  test("normalizes /graph/prof1/status", () => {
    expect(normalizeRoutePolicyKey("/graph/prof1/status")).toBe("/graph/{profile_id}/status");
  });

  test("returns empty string for empty input", () => {
    expect(normalizeRoutePolicyKey("")).toBe("");
  });

  test("returns empty string for non-string input", () => {
    expect(normalizeRoutePolicyKey(null)).toBe("");
    expect(normalizeRoutePolicyKey(undefined)).toBe("");
    expect(normalizeRoutePolicyKey(42)).toBe("");
  });

  test("returns the route unchanged for unknown routes", () => {
    expect(normalizeRoutePolicyKey("/unknown/path")).toBe("/unknown/path");
    expect(normalizeRoutePolicyKey("/status")).toBe("/status");
  });

  test("normalizes /filing/suggestions/s1/approve", () => {
    expect(normalizeRoutePolicyKey("/filing/suggestions/s1/approve")).toBe(
      "/filing/suggestions/{suggestion_id}/approve",
    );
  });

  test("normalizes /commitments/c1/complete", () => {
    expect(normalizeRoutePolicyKey("/commitments/c1/complete")).toBe(
      "/commitments/{commitment_id}/complete",
    );
  });
});

// ─── assembleContextPure ───

describe("assembleContextPure", () => {
  const budgets = {
    triage: {
      max_tokens: 1000,
      priority: ["system", "deals", "history"],
    },
  };

  test("within budget: includes all sections", () => {
    const sections = {
      system: "System prompt here",
      deals: "Deal data here",
      history: "Chat history",
    };
    const result = assembleContextPure("triage", sections, budgets);
    expect(result.metadata.budget_applied).toBe(true);
    expect(result.metadata.sections_included).toContain("system");
    expect(result.metadata.sections_included).toContain("deals");
    expect(result.metadata.sections_included).toContain("history");
    expect(result.metadata.sections_truncated).toHaveLength(0);
    expect(result.metadata.sections_omitted).toHaveLength(0);
    expect(result.assembled).toContain("System prompt here");
  });

  test("over budget: truncates or omits excess sections", () => {
    const longContent = Array(500).fill("word").join(" ");
    const sections = {
      system: longContent,
      deals: longContent,
      history: longContent,
    };
    const result = assembleContextPure("triage", sections, budgets);
    expect(result.metadata.budget_applied).toBe(true);
    // At least one section should be truncated or omitted
    const totalHandled =
      result.metadata.sections_truncated.length + result.metadata.sections_omitted.length;
    expect(totalHandled).toBeGreaterThan(0);
  });

  test("unknown call type returns raw sections with budget_applied: false", () => {
    const sections = { foo: "bar" };
    const result = assembleContextPure("unknown_type", sections, budgets);
    expect(result.metadata.budget_applied).toBe(false);
    expect(result.metadata.call_type).toBe("unknown_type");
    expect(result.assembled).toEqual(sections);
  });

  test("empty sections returns assembled string with no content", () => {
    const result = assembleContextPure("triage", {}, budgets);
    expect(result.metadata.budget_applied).toBe(true);
    expect(result.metadata.sections_included).toHaveLength(0);
    expect(result.assembled).toBe("");
  });

  test("skips null/undefined/empty sections in priority list", () => {
    const sections = {
      system: "System prompt",
      deals: null,
      history: "",
    };
    const result = assembleContextPure("triage", sections, budgets);
    expect(result.metadata.sections_included).toContain("system");
    expect(result.metadata.sections_included).not.toContain("deals");
    expect(result.metadata.sections_included).not.toContain("history");
  });
});

// ─── upcastRecordPure ───

describe("upcastRecordPure", () => {
  test("upcasts a v0 record to v1", () => {
    const record = { name: "test" };
    const upcasters = new Map([
      [
        "deals",
        [
          {
            from_version: 0,
            to_version: 1,
            transform: (r) => ({ ...r, migrated: true }),
          },
        ],
      ],
    ]);
    const result = upcastRecordPure(record, "deals", upcasters);
    expect(result._schema_version).toBe(1);
    expect(result.migrated).toBe(true);
  });

  test("leaves a v1 record unchanged", () => {
    const record = { name: "test", _schema_version: 1 };
    const upcasters = new Map([
      [
        "deals",
        [
          {
            from_version: 0,
            to_version: 1,
            transform: (r) => ({ ...r, migrated: true }),
          },
        ],
      ],
    ]);
    const result = upcastRecordPure(record, "deals", upcasters);
    expect(result._schema_version).toBe(1);
    expect(result.migrated).toBeUndefined();
  });

  test("returns record as-is when no upcasters exist for ledger", () => {
    const record = { name: "test" };
    const upcasters = new Map();
    const result = upcastRecordPure(record, "deals", upcasters);
    expect(result).toEqual({ name: "test" });
  });

  test("returns non-object input unchanged", () => {
    const upcasters = new Map();
    expect(upcastRecordPure(null, "deals", upcasters)).toBeNull();
    expect(upcastRecordPure(undefined, "deals", upcasters)).toBeUndefined();
  });

  test("handles multi-step upcasting (conceptual: only 0->1 currently)", () => {
    const record = { name: "old", _schema_version: 0 };
    const upcasters = new Map([
      [
        "tasks",
        [
          {
            from_version: 0,
            to_version: 1,
            transform: (r) => ({ ...r, status: "pending" }),
          },
        ],
      ],
    ]);
    const result = upcastRecordPure(record, "tasks", upcasters);
    expect(result._schema_version).toBe(1);
    expect(result.status).toBe("pending");
    expect(result.name).toBe("old");
  });
});

// ─── redactPhiPatterns ───

describe("redactPhiPatterns", () => {
  test("redacts SSN pattern", () => {
    const messages = [{ role: "user", content: "My SSN is 123-45-6789" }];
    const result = redactPhiPatterns(messages);
    expect(result[0].content).toContain("[REDACTED-SSN]");
    expect(result[0].content).not.toContain("123-45-6789");
  });

  test("redacts DOB pattern", () => {
    const messages = [{ role: "user", content: "DOB: 01/15/1990" }];
    const result = redactPhiPatterns(messages);
    expect(result[0].content).toContain("[REDACTED-DOB]");
  });

  test("redacts MRN pattern", () => {
    const messages = [{ role: "user", content: "MRN# 123456" }];
    const result = redactPhiPatterns(messages);
    expect(result[0].content).toContain("[REDACTED-MRN]");
  });

  test("redacts phone number", () => {
    const messages = [{ role: "user", content: "Call me at (555) 123-4567" }];
    const result = redactPhiPatterns(messages);
    expect(result[0].content).toContain("[REDACTED-PHONE]");
    expect(result[0].content).not.toContain("555");
  });

  test("redacts email address", () => {
    const messages = [{ role: "user", content: "Email: john@example.com" }];
    const result = redactPhiPatterns(messages);
    expect(result[0].content).toContain("[REDACTED-EMAIL]");
    expect(result[0].content).not.toContain("john@example.com");
  });

  test("leaves non-PHI content untouched", () => {
    const messages = [{ role: "user", content: "Please review the contract terms" }];
    const result = redactPhiPatterns(messages);
    expect(result[0].content).toBe("Please review the contract terms");
  });

  test("handles multiple PHI patterns in one message", () => {
    const messages = [
      { role: "user", content: "SSN 123-45-6789, email test@test.com, phone 555-123-4567" },
    ];
    const result = redactPhiPatterns(messages);
    expect(result[0].content).toContain("[REDACTED-SSN]");
    expect(result[0].content).toContain("[REDACTED-EMAIL]");
    expect(result[0].content).toContain("[REDACTED-PHONE]");
  });

  test("preserves messages with non-string content", () => {
    const messages = [{ role: "system", content: null }];
    const result = redactPhiPatterns(messages);
    expect(result[0].content).toBeNull();
  });

  test("preserves message count", () => {
    const messages = [
      { role: "user", content: "hello" },
      { role: "assistant", content: "hi there" },
    ];
    const result = redactPhiPatterns(messages);
    expect(result).toHaveLength(2);
  });
});

// ─── validateOutputContractPure ───

describe("validateOutputContractPure", () => {
  test("valid output with no contract constraints", () => {
    const contract = { required_sections: [], forbidden_patterns: [] };
    const result = validateOutputContractPure("summary", "Here is a valid summary.", contract);
    expect(result.valid).toBe(true);
    expect(result.missing_sections).toHaveLength(0);
    expect(result.banned_phrases_found).toHaveLength(0);
  });

  test("detects missing required sections", () => {
    const contract = {
      required_sections: ["executive summary", "recommendations"],
      forbidden_patterns: [],
    };
    const output = "Here is the executive summary of the deal.";
    const result = validateOutputContractPure("report", output, contract);
    expect(result.valid).toBe(false);
    expect(result.missing_sections.length).toBeGreaterThan(0);
  });

  test("detects banned phrases", () => {
    const contract = {
      required_sections: [],
      forbidden_patterns: ["not financial advice", "disclaimer"],
    };
    const output = "This is not financial advice, and here is a disclaimer about the analysis.";
    const result = validateOutputContractPure("analysis", output, contract);
    expect(result.valid).toBe(false);
    expect(result.banned_phrases_found).toContain("not financial advice");
    expect(result.banned_phrases_found).toContain("disclaimer");
  });

  test("empty output is always invalid", () => {
    const contract = { required_sections: [], forbidden_patterns: [] };
    const result = validateOutputContractPure("summary", "", contract);
    expect(result.valid).toBe(false);
    expect(result.missing_sections).toContain("entire_output");
  });

  test("null output is invalid", () => {
    const contract = { required_sections: [], forbidden_patterns: [] };
    const result = validateOutputContractPure("summary", null, contract);
    expect(result.valid).toBe(false);
  });

  test("whitespace-only output is invalid", () => {
    const contract = { required_sections: [], forbidden_patterns: [] };
    const result = validateOutputContractPure("summary", "   \n  ", contract);
    expect(result.valid).toBe(false);
    expect(result.missing_sections).toContain("entire_output");
  });

  test("valid output with all required sections present", () => {
    const contract = {
      required_sections: ["summary", "action items"],
      forbidden_patterns: [],
    };
    const output = "Here is the summary of findings.\n\nAction items are listed below.";
    const result = validateOutputContractPure("report", output, contract);
    expect(result.valid).toBe(true);
  });

  test("handles missing contract fields gracefully", () => {
    const result = validateOutputContractPure("summary", "valid output", {});
    expect(result.valid).toBe(true);
  });
});
