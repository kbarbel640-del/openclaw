import { describe, expect, it } from "vitest";
import { cleanSchemaForGemini, GEMINI_UNSUPPORTED_SCHEMA_KEYWORDS } from "./clean-for-gemini.js";

describe("cleanSchemaForGemini", () => {
  it("returns primitives unchanged", () => {
    expect(cleanSchemaForGemini(null)).toBe(null);
    expect(cleanSchemaForGemini(undefined)).toBe(undefined);
    expect(cleanSchemaForGemini("string")).toBe("string");
    expect(cleanSchemaForGemini(42)).toBe(42);
    expect(cleanSchemaForGemini(true)).toBe(true);
  });

  it("processes arrays recursively", () => {
    const input = [
      { type: "string", minLength: 1 },
      { type: "number", minimum: 0 },
    ];
    const result = cleanSchemaForGemini(input) as unknown[];
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ type: "string" });
    expect(result[1]).toEqual({ type: "number" });
  });

  it("removes unsupported schema keywords", () => {
    const input = {
      type: "object",
      $schema: "http://json-schema.org/draft-07/schema#",
      $id: "test",
      patternProperties: { "^S_": { type: "string" } },
      additionalProperties: false,
      minLength: 1,
      maxLength: 100,
      minimum: 0,
      maximum: 100,
      pattern: "^[a-z]+$",
      format: "email",
      minItems: 1,
      maxItems: 10,
      uniqueItems: true,
      minProperties: 1,
      maxProperties: 10,
      examples: ["example"],
    };
    const result = cleanSchemaForGemini(input) as Record<string, unknown>;
    expect(result.type).toBe("object");
    for (const keyword of GEMINI_UNSUPPORTED_SCHEMA_KEYWORDS) {
      expect(result[keyword]).toBeUndefined();
    }
  });

  it("converts const to single-element enum", () => {
    const input = { const: "value", type: "string" };
    const result = cleanSchemaForGemini(input) as Record<string, unknown>;
    expect(result.enum).toEqual(["value"]);
    expect(result.const).toBeUndefined();
  });

  it("preserves schema metadata (description, title, default)", () => {
    const input = {
      type: "string",
      description: "A description",
      title: "A title",
      default: "default value",
    };
    const result = cleanSchemaForGemini(input) as Record<string, unknown>;
    expect(result.description).toBe("A description");
    expect(result.title).toBe("A title");
    expect(result.default).toBe("default value");
  });

  it("cleans nested properties recursively", () => {
    const input = {
      type: "object",
      properties: {
        name: { type: "string", minLength: 1, description: "Name" },
        age: { type: "number", minimum: 0 },
      },
    };
    const result = cleanSchemaForGemini(input) as Record<string, unknown>;
    const props = result.properties as Record<string, Record<string, unknown>>;
    expect(props.name).toEqual({ type: "string", description: "Name" });
    expect(props.age).toEqual({ type: "number" });
  });

  it("cleans items schema for arrays", () => {
    const input = {
      type: "array",
      items: { type: "string", minLength: 1 },
    };
    const result = cleanSchemaForGemini(input) as Record<string, unknown>;
    expect(result.items).toEqual({ type: "string" });
  });

  it("handles array items as tuple schemas", () => {
    const input = {
      type: "array",
      items: [
        { type: "string", minLength: 1 },
        { type: "number", minimum: 0 },
      ],
    };
    const result = cleanSchemaForGemini(input) as Record<string, unknown>;
    expect(result.items).toEqual([{ type: "string" }, { type: "number" }]);
  });

  it("flattens anyOf with literal values to enum", () => {
    const input = {
      anyOf: [
        { const: "a", type: "string" },
        { const: "b", type: "string" },
        { const: "c", type: "string" },
      ],
    };
    const result = cleanSchemaForGemini(input) as Record<string, unknown>;
    expect(result.type).toBe("string");
    expect(result.enum).toEqual(["a", "b", "c"]);
    expect(result.anyOf).toBeUndefined();
  });

  it("flattens oneOf with literal values to enum", () => {
    const input = {
      oneOf: [
        { enum: ["x"], type: "string" },
        { enum: ["y"], type: "string" },
      ],
    };
    const result = cleanSchemaForGemini(input) as Record<string, unknown>;
    expect(result.type).toBe("string");
    expect(result.enum).toEqual(["x", "y"]);
    expect(result.oneOf).toBeUndefined();
  });

  it("strips null variants from anyOf and simplifies single remaining variant", () => {
    const input = {
      anyOf: [{ type: "string", description: "A string" }, { type: "null" }],
    };
    const result = cleanSchemaForGemini(input) as Record<string, unknown>;
    expect(result.type).toBe("string");
    expect(result.description).toBe("A string");
    expect(result.anyOf).toBeUndefined();
  });

  it("strips null variants identified by const: null", () => {
    const input = {
      anyOf: [{ type: "number" }, { const: null }],
    };
    const result = cleanSchemaForGemini(input) as Record<string, unknown>;
    expect(result.type).toBe("number");
    expect(result.anyOf).toBeUndefined();
  });

  it("strips null variants identified by enum: [null]", () => {
    const input = {
      anyOf: [{ type: "boolean" }, { enum: [null] }],
    };
    const result = cleanSchemaForGemini(input) as Record<string, unknown>;
    expect(result.type).toBe("boolean");
    expect(result.anyOf).toBeUndefined();
  });

  it("normalizes type arrays by removing null", () => {
    const input = { type: ["string", "null"] };
    const result = cleanSchemaForGemini(input) as Record<string, unknown>;
    expect(result.type).toBe("string");
  });

  it("keeps type as array when multiple non-null types remain", () => {
    const input = { type: ["string", "number", "null"] };
    const result = cleanSchemaForGemini(input) as Record<string, unknown>;
    expect(result.type).toEqual(["string", "number"]);
  });

  it("resolves $ref to local $defs and inlines the definition", () => {
    const input = {
      $defs: {
        MyType: { type: "string", minLength: 1, description: "My type" },
      },
      type: "object",
      properties: {
        field: { $ref: "#/$defs/MyType" },
      },
    };
    const result = cleanSchemaForGemini(input) as Record<string, unknown>;
    const props = result.properties as Record<string, Record<string, unknown>>;
    expect(props.field).toEqual({ type: "string", description: "My type" });
    expect(result.$defs).toBeUndefined();
  });

  it("resolves $ref to legacy definitions and inlines", () => {
    const input = {
      definitions: {
        Item: { type: "number", minimum: 0 },
      },
      type: "array",
      items: { $ref: "#/definitions/Item" },
    };
    const result = cleanSchemaForGemini(input) as Record<string, unknown>;
    expect(result.items).toEqual({ type: "number" });
    expect(result.definitions).toBeUndefined();
  });

  it("handles circular $ref by returning empty object", () => {
    const input = {
      $defs: {
        Node: {
          type: "object",
          properties: {
            value: { type: "string" },
            child: { $ref: "#/$defs/Node" },
          },
        },
      },
      $ref: "#/$defs/Node",
    };
    const result = cleanSchemaForGemini(input) as Record<string, unknown>;
    expect(result.type).toBe("object");
    const props = result.properties as Record<string, Record<string, unknown>>;
    expect(props.value).toEqual({ type: "string" });
    // Circular ref should be empty object
    expect(props.child).toEqual({});
  });

  it("preserves metadata from $ref parent when resolving", () => {
    const input = {
      $defs: {
        Base: { type: "string" },
      },
      $ref: "#/$defs/Base",
      description: "Overridden description",
      title: "Overridden title",
    };
    const result = cleanSchemaForGemini(input) as Record<string, unknown>;
    expect(result.type).toBe("string");
    expect(result.description).toBe("Overridden description");
    expect(result.title).toBe("Overridden title");
  });

  it("handles unresolvable $ref gracefully", () => {
    const input = {
      $ref: "#/$defs/NonExistent",
      description: "Fallback description",
    };
    const result = cleanSchemaForGemini(input) as Record<string, unknown>;
    expect(result.description).toBe("Fallback description");
    expect(result.$ref).toBeUndefined();
  });

  it("cleans allOf variants recursively", () => {
    const input = {
      allOf: [
        { type: "object", minProperties: 1 },
        { properties: { name: { type: "string", minLength: 1 } } },
      ],
    };
    const result = cleanSchemaForGemini(input) as Record<string, unknown>;
    const allOf = result.allOf as Array<Record<string, unknown>>;
    expect(allOf[0]).toEqual({ type: "object" });
    expect(allOf[1]).toEqual({ properties: { name: { type: "string" } } });
  });

  it("flattens remaining anyOf to representative type when simplification fails", () => {
    const input = {
      anyOf: [
        { type: "string", properties: { a: { type: "string" } } },
        { type: "string", properties: { b: { type: "number" } } },
      ],
    };
    const result = cleanSchemaForGemini(input) as Record<string, unknown>;
    // Should flatten to common type since both are "string"
    expect(result.type).toBe("string");
    expect(result.anyOf).toBeUndefined();
  });

  it("handles JSON pointer escaping in $ref paths", () => {
    const input = {
      $defs: {
        "my/type": { type: "boolean" },
      },
      $ref: "#/$defs/my~1type",
    };
    const result = cleanSchemaForGemini(input) as Record<string, unknown>;
    expect(result.type).toBe("boolean");
  });

  it("handles tilde escaping in $ref paths", () => {
    const input = {
      $defs: {
        "my~type": { type: "integer" },
      },
      $ref: "#/$defs/my~0type",
    };
    const result = cleanSchemaForGemini(input) as Record<string, unknown>;
    expect(result.type).toBe("integer");
  });

  it("skips type field when anyOf or oneOf is present", () => {
    const input = {
      type: "string",
      anyOf: [{ type: "object", properties: { a: { type: "string" } } }],
    };
    const result = cleanSchemaForGemini(input) as Record<string, unknown>;
    // Since anyOf has single object variant, it should be simplified
    expect(result.type).toBe("object");
  });
});
