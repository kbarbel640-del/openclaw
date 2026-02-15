import { describe, expect, it } from "vitest";
import { z } from "zod";
import { cleanSchemaForGemini } from "./clean-for-gemini.js";
import { zodToToolJsonSchema } from "./zod-tool-schema.js";

describe("zodToToolJsonSchema", () => {
  describe("primitives", () => {
    it("should produce clean string schema", () => {
      expect(zodToToolJsonSchema(z.string())).toEqual({ type: "string" });
    });

    it("should produce clean number schema", () => {
      expect(zodToToolJsonSchema(z.number())).toEqual({ type: "number" });
    });

    it("should produce clean boolean schema", () => {
      expect(zodToToolJsonSchema(z.boolean())).toEqual({ type: "boolean" });
    });

    it("should produce integer type without sentinel bounds", () => {
      const result = zodToToolJsonSchema(z.number().int());
      expect(result.type).toBe("integer");
      expect(result).not.toHaveProperty("minimum");
      expect(result).not.toHaveProperty("maximum");
    });

    it("should preserve explicit min/max on integers", () => {
      const result = zodToToolJsonSchema(z.number().int().min(0).max(100));
      expect(result).toEqual({ type: "integer", minimum: 0, maximum: 100 });
    });

    it("should preserve description", () => {
      expect(zodToToolJsonSchema(z.string().describe("a test"))).toEqual({
        type: "string",
        description: "a test",
      });
    });

    it("should preserve default value", () => {
      const result = zodToToolJsonSchema(z.string().default("hello"));
      expect(result.default).toBe("hello");
      expect(result.type).toBe("string");
    });
  });

  describe("enums", () => {
    it("should produce flat enum without anyOf", () => {
      expect(zodToToolJsonSchema(z.enum(["a", "b", "c"]))).toEqual({
        type: "string",
        enum: ["a", "b", "c"],
      });
    });

    it("should handle optional enum correctly", () => {
      const result = zodToToolJsonSchema(z.enum(["x", "y"]).optional());
      expect(result.type).toBe("string");
      expect(result.enum).toEqual(["x", "y"]);
      expect(result).not.toHaveProperty("anyOf");
      expect(result).not.toHaveProperty("oneOf");
    });
  });

  describe("nullable flattening", () => {
    it("should flatten nullable string (no anyOf)", () => {
      const result = zodToToolJsonSchema(z.string().nullable());
      expect(result.type).toBe("string");
      expect(result).not.toHaveProperty("anyOf");
    });

    it("should flatten nullable enum", () => {
      const result = zodToToolJsonSchema(z.enum(["a", "b"]).nullable());
      expect(result.type).toBe("string");
      expect(result.enum).toEqual(["a", "b"]);
      expect(result).not.toHaveProperty("anyOf");
    });

    it("should flatten nullable number", () => {
      const result = zodToToolJsonSchema(z.number().nullable());
      expect(result.type).toBe("number");
      expect(result).not.toHaveProperty("anyOf");
    });

    it("should flatten nullable object", () => {
      const result = zodToToolJsonSchema(z.object({ id: z.string() }).nullable());
      expect(result.type).toBe("object");
      expect(result.properties).toEqual({ id: { type: "string" } });
      expect(result).not.toHaveProperty("anyOf");
    });

    it("should preserve description on nullable fields", () => {
      // Zod wraps description at the nullable wrapper level
      const schema = z.string().nullable().describe("test desc");
      const result = zodToToolJsonSchema(schema);
      expect(result.description).toBe("test desc");
      expect(result.type).toBe("string");
    });
  });

  describe("optional", () => {
    it("should handle optional string without anyOf", () => {
      const result = zodToToolJsonSchema(z.string().optional());
      expect(result.type).toBe("string");
      expect(result).not.toHaveProperty("anyOf");
    });

    it("should handle optional number", () => {
      const result = zodToToolJsonSchema(z.number().optional());
      expect(result.type).toBe("number");
      expect(result).not.toHaveProperty("anyOf");
    });
  });

  describe("objects", () => {
    it("should produce clean object schema", () => {
      const result = zodToToolJsonSchema(
        z.object({
          name: z.string(),
          age: z.number().optional(),
        }),
      );
      expect(result).toEqual({
        type: "object",
        properties: {
          name: { type: "string" },
          age: { type: "number" },
        },
        required: ["name"],
      });
    });

    it("should strip additionalProperties", () => {
      const result = zodToToolJsonSchema(z.object({ x: z.string() }));
      expect(result).not.toHaveProperty("additionalProperties");
    });

    it("should handle nested objects", () => {
      const result = zodToToolJsonSchema(
        z.object({
          items: z.array(z.object({ id: z.string() })),
        }),
      );
      expect(result).toEqual({
        type: "object",
        properties: {
          items: {
            type: "array",
            items: {
              type: "object",
              properties: { id: { type: "string" } },
              required: ["id"],
            },
          },
        },
        required: ["items"],
      });
    });

    it("should handle object with enum property", () => {
      const result = zodToToolJsonSchema(
        z.object({
          action: z.enum(["get", "set"]),
          value: z.string().optional(),
        }),
      );
      expect(result.properties).toEqual({
        action: { type: "string", enum: ["get", "set"] },
        value: { type: "string" },
      });
      expect(result.required).toEqual(["action"]);
    });

    it("should handle object with nullable property", () => {
      const result = zodToToolJsonSchema(
        z.object({
          name: z.string(),
          alias: z.string().nullable().optional(),
        }),
      );
      expect(result.type).toBe("object");
      const props = result.properties as Record<string, Record<string, unknown>>;
      expect(props.alias.type).toBe("string");
      expect(props.alias).not.toHaveProperty("anyOf");
    });
  });

  describe("arrays", () => {
    it("should handle string arrays", () => {
      expect(zodToToolJsonSchema(z.array(z.string()))).toEqual({
        type: "array",
        items: { type: "string" },
      });
    });

    it("should handle object arrays", () => {
      const result = zodToToolJsonSchema(z.array(z.object({ id: z.string(), value: z.number() })));
      expect(result).toEqual({
        type: "array",
        items: {
          type: "object",
          properties: { id: { type: "string" }, value: { type: "number" } },
          required: ["id", "value"],
        },
      });
    });
  });

  describe("records", () => {
    it("should strip propertyNames from record schemas", () => {
      const result = zodToToolJsonSchema(z.record(z.string(), z.number()));
      expect(result).not.toHaveProperty("propertyNames");
      expect(result.type).toBe("object");
    });
  });

  describe("unions (non-nullable)", () => {
    it("should preserve genuine unions as anyOf", () => {
      const result = zodToToolJsonSchema(z.union([z.string(), z.number()]));
      expect(result.anyOf).toEqual([{ type: "string" }, { type: "number" }]);
    });
  });

  describe("no $schema metadata", () => {
    it("should never include $schema in output", () => {
      const result = zodToToolJsonSchema(z.object({ x: z.string() }));
      expect(result).not.toHaveProperty("$schema");
    });

    it("should never include $id in output", () => {
      const result = zodToToolJsonSchema(z.string());
      expect(result).not.toHaveProperty("$id");
    });
  });

  describe("compatibility with cleanSchemaForGemini", () => {
    it("should pass through cleanSchemaForGemini without issues", () => {
      const schema = z.object({
        action: z.enum(["status", "list", "add"]),
        target: z.string().optional(),
        count: z.number().int().min(0).optional(),
        tags: z.array(z.string()).optional(),
      });
      const toolSchema = zodToToolJsonSchema(schema);
      const cleaned = cleanSchemaForGemini(toolSchema);
      // Should not introduce anyOf/oneOf
      expect(cleaned).not.toHaveProperty("anyOf");
      expect(cleaned).not.toHaveProperty("oneOf");
      // Object structure preserved
      const c = cleaned as Record<string, unknown>;
      expect(c.type).toBe("object");
      expect(c.required).toEqual(["action"]);
    });

    it("should produce Gemini-compatible enum properties", () => {
      const schema = z.object({
        action: z.enum(["get", "set", "delete"]),
      });
      const toolSchema = zodToToolJsonSchema(schema);
      const cleaned = cleanSchemaForGemini(toolSchema) as Record<string, unknown>;
      const props = cleaned.properties as Record<string, Record<string, unknown>>;
      expect(props.action).toEqual({ type: "string", enum: ["get", "set", "delete"] });
    });
  });

  describe("realistic tool schema", () => {
    it("should handle a CronTool-like schema", () => {
      const CRON_ACTIONS = ["status", "list", "add", "update", "remove", "run"] as const;
      const schema = z.object({
        action: z.enum(CRON_ACTIONS),
        gatewayUrl: z.string().optional(),
        gatewayToken: z.string().optional(),
        timeoutMs: z.number().optional(),
        includeDisabled: z.boolean().optional(),
        job: z.object({}).passthrough().optional(),
        jobId: z.string().optional(),
        id: z.string().optional(),
        patch: z.object({}).passthrough().optional(),
        text: z.string().optional(),
        mode: z.enum(["now", "next-heartbeat"]).optional(),
      });
      const result = zodToToolJsonSchema(schema);
      expect(result.type).toBe("object");
      expect(result.required).toEqual(["action"]);
      const props = result.properties as Record<string, Record<string, unknown>>;
      expect(props.action).toEqual({
        type: "string",
        enum: ["status", "list", "add", "update", "remove", "run"],
      });
      expect(props.mode).toEqual({
        type: "string",
        enum: ["now", "next-heartbeat"],
      });
      expect(result).not.toHaveProperty("$schema");
      expect(result).not.toHaveProperty("additionalProperties");
    });

    it("should handle a MessageTool-like schema with nested arrays", () => {
      const schema = z.object({
        message: z.string().optional(),
        channel: z.string().optional(),
        target: z.string().describe("Target channel/user id or name.").optional(),
        targets: z.array(z.string()).optional(),
        buttons: z
          .array(
            z.array(
              z.object({
                text: z.string(),
                callback_data: z.string(),
              }),
            ),
          )
          .describe("Inline keyboard buttons (array of button rows)")
          .optional(),
        replyTo: z.string().optional(),
        silent: z.boolean().optional(),
      });
      const result = zodToToolJsonSchema(schema);
      expect(result.type).toBe("object");
      const props = result.properties as Record<string, Record<string, unknown>>;
      expect(props.target).toEqual({
        type: "string",
        description: "Target channel/user id or name.",
      });
      expect(props.buttons).toHaveProperty("description");
      expect(props.buttons.type).toBe("array");
    });
  });
});
