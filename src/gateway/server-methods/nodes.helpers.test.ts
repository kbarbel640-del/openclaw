import { describe, expect, it, vi } from "vitest";
import { ErrorCodes } from "../protocol/index.js";
import {
  respondInvalidParams,
  respondUnavailableOnThrow,
  safeParseJson,
  uniqueSortedStrings,
} from "./nodes.helpers.js";
import type { RespondFn } from "./types.js";

describe("uniqueSortedStrings", () => {
  it("filters out non-string values", () => {
    expect(uniqueSortedStrings([1, true, null, undefined, {}, [], "hello"])).toEqual(["hello"]);
  });

  it("deduplicates strings", () => {
    expect(uniqueSortedStrings(["apple", "banana", "apple", "banana"])).toEqual([
      "apple",
      "banana",
    ]);
  });

  it("sorts alphabetically", () => {
    expect(uniqueSortedStrings(["cherry", "apple", "banana"])).toEqual([
      "apple",
      "banana",
      "cherry",
    ]);
  });

  it("trims whitespace", () => {
    expect(uniqueSortedStrings(["  hello  ", " world "])).toEqual(["hello", "world"]);
  });

  it("filters out empty and whitespace-only strings", () => {
    expect(uniqueSortedStrings(["", "  ", "   ", "valid"])).toEqual(["valid"]);
  });

  it("returns empty array for empty input", () => {
    expect(uniqueSortedStrings([])).toEqual([]);
  });
});

describe("safeParseJson", () => {
  it("returns undefined for null", () => {
    expect(safeParseJson(null)).toBeUndefined();
  });

  it("returns undefined for undefined", () => {
    expect(safeParseJson(undefined)).toBeUndefined();
  });

  it("returns undefined for empty string", () => {
    expect(safeParseJson("")).toBeUndefined();
  });

  it("returns undefined for whitespace-only string", () => {
    expect(safeParseJson("   ")).toBeUndefined();
  });

  it("parses valid JSON object", () => {
    expect(safeParseJson('{"key": "value"}')).toEqual({ key: "value" });
  });

  it("parses valid JSON array", () => {
    expect(safeParseJson("[1, 2, 3]")).toEqual([1, 2, 3]);
  });

  it("parses valid JSON number", () => {
    expect(safeParseJson("42")).toBe(42);
  });

  it("parses valid JSON string", () => {
    expect(safeParseJson('"hello"')).toBe("hello");
  });

  it("parses valid JSON boolean", () => {
    expect(safeParseJson("true")).toBe(true);
    expect(safeParseJson("false")).toBe(false);
  });

  it("returns { payloadJSON: value } for invalid JSON", () => {
    const invalid = "not valid json at all";
    expect(safeParseJson(invalid)).toEqual({ payloadJSON: invalid });
  });

  it("handles JSON with surrounding whitespace", () => {
    expect(safeParseJson('  {"a": 1}  ')).toEqual({ a: 1 });
  });
});

describe("respondInvalidParams", () => {
  it("calls respond with false and error shape", () => {
    const respond = vi.fn<RespondFn>();
    const validator = Object.assign(() => false, {
      errors: [
        {
          keyword: "required",
          instancePath: "",
          schemaPath: "#/required",
          params: { missingProperty: "name" },
          message: "must have required property 'name'",
        },
      ],
    });

    respondInvalidParams({
      respond,
      method: "node.invoke",
      validator,
    });

    expect(respond).toHaveBeenCalledOnce();

    const [ok, payload, error] = respond.mock.calls[0];
    expect(ok).toBe(false);
    expect(payload).toBeUndefined();
    expect(error).toBeDefined();
    expect(error!.code).toBe(ErrorCodes.INVALID_REQUEST);
    expect(error!.message).toContain("invalid node.invoke params");
  });
});

describe("respondUnavailableOnThrow", () => {
  it("does not call respond when fn succeeds", async () => {
    const respond = vi.fn<RespondFn>();
    await respondUnavailableOnThrow(respond, async () => {
      // success, no throw
    });

    expect(respond).not.toHaveBeenCalled();
  });

  it("calls respond with UNAVAILABLE when fn throws", async () => {
    const respond = vi.fn<RespondFn>();
    await respondUnavailableOnThrow(respond, async () => {
      throw new Error("something broke");
    });

    expect(respond).toHaveBeenCalledOnce();

    const [ok, payload, error] = respond.mock.calls[0];
    expect(ok).toBe(false);
    expect(payload).toBeUndefined();
    expect(error).toBeDefined();
    expect(error!.code).toBe(ErrorCodes.UNAVAILABLE);
    expect(error!.message).toContain("something broke");
  });
});
