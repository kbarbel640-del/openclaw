import { describe, it, expect } from "vitest";
import { normalizeToolParameters } from "./pi-tools.schema.js";

describe("normalizeToolParameters – array-format parameters", () => {
  it("converts array-format parameters to JSON Schema object", () => {
    const tool = {
      name: "my_tool",
      description: "Example tool",
      parameters: [
        { name: "command", type: "string", description: "Command to run", required: true },
        { name: "target", type: "string", description: "Target", required: false },
      ],
    };

    const result = normalizeToolParameters(tool as any);
    const params = result.parameters as Record<string, unknown>;

    expect(params.type).toBe("object");
    expect(params.properties).toBeDefined();

    const props = params.properties as Record<string, Record<string, unknown>>;
    expect(props.command).toEqual({ type: "string", description: "Command to run" });
    expect(props.target).toEqual({ type: "string", description: "Target" });
    expect(params.required).toEqual(["command"]);
  });

  it("handles array params with enum fields", () => {
    const tool = {
      name: "select_tool",
      description: "Select something",
      parameters: [{ name: "mode", type: "string", enum: ["fast", "slow"], required: true }],
    };

    const result = normalizeToolParameters(tool as any);
    const params = result.parameters as Record<string, unknown>;
    const props = params.properties as Record<string, Record<string, unknown>>;

    expect(props.mode.enum).toEqual(["fast", "slow"]);
  });

  it("returns tool unchanged when parameters is a valid JSON Schema object", () => {
    const tool = {
      name: "normal_tool",
      description: "Normal tool",
      parameters: {
        type: "object",
        properties: { foo: { type: "string" } },
      },
    };

    const result = normalizeToolParameters(tool as any);
    const params = result.parameters as Record<string, unknown>;
    expect(params.type).toBe("object");
    expect((params.properties as any).foo.type).toBe("string");
  });

  it("skips array entries without a name", () => {
    const tool = {
      name: "bad_tool",
      description: "Tool with nameless param",
      parameters: [
        { type: "string", description: "no name" },
        { name: "valid", type: "string" },
      ],
    };

    const result = normalizeToolParameters(tool as any);
    const params = result.parameters as Record<string, unknown>;
    const props = params.properties as Record<string, unknown>;

    expect(Object.keys(props)).toEqual(["valid"]);
  });
});
