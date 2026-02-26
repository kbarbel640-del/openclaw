import { describe, expect, it } from "vitest";
import { normalizeToolParameters } from "./pi-tools.schema.js";

describe("normalizeToolParameters — array-format parameters", () => {
  it("converts array-format parameters to JSON Schema object", () => {
    const tool = {
      name: "my_tool",
      description: "Example tool",
      parameters: [
        { name: "command", type: "string", description: "Command to run", required: true },
        { name: "target", type: "string", description: "Target", required: false },
      ],
    };

    const result = normalizeToolParameters(tool as never);
    const params = result.parameters as Record<string, unknown>;

    expect(params.type).toBe("object");
    const props = params.properties as Record<string, Record<string, unknown>>;
    expect(props.command).toMatchObject({ type: "string", description: "Command to run" });
    expect(props.target).toMatchObject({ type: "string", description: "Target" });
    // Only required=true params end up in required
    expect(params.required).toEqual(["command"]);
  });

  it("handles array parameters with no required fields", () => {
    const tool = {
      name: "no_required",
      parameters: [
        { name: "opt1", type: "string" },
        { name: "opt2", type: "number" },
      ],
    };

    const result = normalizeToolParameters(tool as never);
    const params = result.parameters as Record<string, unknown>;

    expect(params.type).toBe("object");
    expect(params.required).toBeUndefined();
  });

  it("passes array parameters through Gemini cleaning when provider is google", () => {
    const tool = {
      name: "gemini_tool",
      parameters: [{ name: "prompt", type: "string", description: "The prompt", required: true }],
    };

    const result = normalizeToolParameters(tool as never, { modelProvider: "google" });
    const params = result.parameters as Record<string, unknown>;

    // After array conversion + Gemini cleaning: should be a valid object schema
    expect(params.type).toBe("object");
    const props = params.properties as Record<string, Record<string, unknown>>;
    expect(props.prompt).toBeDefined();
    expect(params.required).toEqual(["prompt"]);
  });

  it("ignores array entries missing a name field", () => {
    const tool = {
      name: "partial_tool",
      parameters: [
        { name: "valid", type: "string" },
        { type: "string" }, // no name — should be skipped
      ],
    };

    const result = normalizeToolParameters(tool as never);
    const params = result.parameters as Record<string, unknown>;
    const props = params.properties as Record<string, unknown>;

    expect(Object.keys(props)).toEqual(["valid"]);
  });

  it("does not modify tools with well-formed JSON Schema parameters", () => {
    const schema = {
      type: "object",
      properties: { q: { type: "string" } },
      required: ["q"],
    };
    const tool = { name: "already_schema", parameters: schema };

    const result = normalizeToolParameters(tool as never);
    expect(result.parameters).toEqual(schema);
  });

  it("handles empty array parameters gracefully", () => {
    const tool = { name: "empty_params", parameters: [] };

    const result = normalizeToolParameters(tool as never);
    const params = result.parameters as Record<string, unknown>;

    expect(params.type).toBe("object");
    expect(params.properties).toEqual({});
    expect(params.required).toBeUndefined();
  });
});
