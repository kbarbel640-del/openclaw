import { describe, it, expect } from "vitest";
import { validateTaskOutput, validateTaskInput, extractStructuredOutput } from "./task-contract.js";
import type { CronTaskContract } from "./types.js";

describe("extractStructuredOutput", () => {
  it("extracts JSON from markdown code blocks", () => {
    const output = 'Here is the result:\n```json\n{"score": 42, "team": "Eagles"}\n```\nDone.';
    const result = extractStructuredOutput(output);
    expect(result).toEqual({ score: 42, team: "Eagles" });
  });

  it("extracts JSON from code blocks without json label", () => {
    const output = '```\n{"key": "value"}\n```';
    const result = extractStructuredOutput(output);
    expect(result).toEqual({ key: "value" });
  });

  it("extracts raw JSON from output", () => {
    const output = 'The data is {"status": "ok", "count": 5} and done.';
    const result = extractStructuredOutput(output);
    expect(result).toEqual({ status: "ok", count: 5 });
  });

  it("extracts key:value pairs", () => {
    const output = "status: active\nscore: 42\nvalid: true\nnull_field: null";
    const result = extractStructuredOutput(output);
    expect(result).toEqual({
      status: "active",
      score: 42,
      valid: true,
      null_field: null,
    });
  });

  it("returns null for empty output", () => {
    expect(extractStructuredOutput("")).toBeNull();
    expect(extractStructuredOutput(null as unknown as string)).toBeNull();
  });

  it("returns null for invalid input with no structure", () => {
    expect(extractStructuredOutput("just some text without any structure")).toBeNull();
  });

  it("handles nested JSON", () => {
    const output = '```json\n{"outer": {"inner": [1, 2, 3]}, "flag": true}\n```';
    const result = extractStructuredOutput(output);
    expect(result).toEqual({ outer: { inner: [1, 2, 3] }, flag: true });
  });

  it("prefers code blocks over raw JSON", () => {
    const output =
      'ignore {"wrong": true} this\n```json\n{"correct": true}\n```\nmore {"wrong": true}';
    const result = extractStructuredOutput(output);
    expect(result).toEqual({ correct: true });
  });

  it("handles very long output with JSON buried inside", () => {
    const padding = "x".repeat(10_000);
    const output = `${padding}\n{"found": true}\n${padding}`;
    const result = extractStructuredOutput(output);
    expect(result).toEqual({ found: true });
  });

  it("handles key = value syntax", () => {
    const output = "name = test\ncount = 7";
    const result = extractStructuredOutput(output);
    expect(result).toEqual({ name: "test", count: 7 });
  });
});

describe("validateTaskOutput", () => {
  const contract: CronTaskContract = {
    name: "odds_capture",
    requiredOutputFields: ["odds", "team"],
    outputSchema: {
      properties: {
        odds: { type: "number" },
        team: { type: "string" },
        confidence: { type: "number" },
      },
      required: ["odds", "team"],
    },
  };

  it("validates correct output", () => {
    const output = '```json\n{"odds": 1.5, "team": "Eagles", "confidence": 0.8}\n```';
    const result = validateTaskOutput(output, contract);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("detects missing required fields", () => {
    const output = '```json\n{"odds": 1.5}\n```';
    const result = validateTaskOutput(output, contract);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("missing required output field: team");
  });

  it("detects type mismatches", () => {
    const output = '```json\n{"odds": "not-a-number", "team": "Eagles"}\n```';
    const result = validateTaskOutput(output, contract);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("expected type number"))).toBe(true);
  });

  it("returns error for empty output with required fields", () => {
    const result = validateTaskOutput("", contract);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("output is empty or not a string");
  });

  it("returns error when structured data cannot be extracted", () => {
    const result = validateTaskOutput("just some random text", contract);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("could not extract structured data from output");
  });

  it("passes with no contract requirements and no structured data", () => {
    const minimal: CronTaskContract = { name: "simple" };
    const result = validateTaskOutput("no structure here", minimal);
    expect(result.valid).toBe(true);
  });

  it("validates schema required fields independently from requiredOutputFields", () => {
    const schemaOnly: CronTaskContract = {
      name: "test",
      outputSchema: {
        required: ["a", "b"],
        properties: {
          a: { type: "string" },
          b: { type: "number" },
        },
      },
    };
    const output = '{"a": "hello"}';
    const result = validateTaskOutput(output, schemaOnly);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("missing required field: b");
  });
});

describe("validateTaskInput", () => {
  const contract: CronTaskContract = {
    name: "downstream",
    inputSchema: {
      required: ["parentResult"],
      properties: {
        parentResult: { type: "object" },
      },
    },
  };

  it("validates correct input", () => {
    const input = '{"parentResult": {"score": 42}}';
    const result = validateTaskInput(input, contract);
    expect(result.valid).toBe(true);
  });

  it("detects schema violations", () => {
    const input = '{"parentResult": "not-an-object"}';
    const result = validateTaskInput(input, contract);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("expected type object"))).toBe(true);
  });

  it("detects missing required fields", () => {
    const input = '{"other": 123}';
    const result = validateTaskInput(input, contract);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("missing required field: parentResult");
  });

  it("returns error for empty input when schema exists", () => {
    const result = validateTaskInput("", contract);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("input is empty or not a string");
  });

  it("passes with no input schema", () => {
    const noSchema: CronTaskContract = { name: "no_input" };
    const result = validateTaskInput("anything", noSchema);
    expect(result.valid).toBe(true);
  });

  it("passes with empty input and no schema", () => {
    const noSchema: CronTaskContract = { name: "no_input" };
    const result = validateTaskInput("", noSchema);
    expect(result.valid).toBe(true);
  });
});
