import { describe, expect, it } from "vitest";
import { normalizeToolParameters } from "./pi-tools.schema.js";

describe("normalizeToolParameters: array-format params", () => {
  it("converts array-format parameters to JSON Schema object", () => {
    const tool = {
      name: "run_command",
      description: "Run a shell command",
      parameters: [
        { name: "command", type: "string", description: "The command to run", required: true },
        { name: "timeout", type: "number", description: "Timeout in seconds" },
      ],
    };

    const result = normalizeToolParameters(tool);
    const params = result.parameters as Record<string, unknown>;

    expect(params.type).toBe("object");
    expect(params.properties).toEqual({
      command: { type: "string", description: "The command to run" },
      timeout: { type: "number", description: "Timeout in seconds" },
    });
    expect(params.required).toEqual(["command"]);
  });

  it("defaults array param type to string when omitted", () => {
    const tool = {
      name: "greet",
      parameters: [{ name: "name" }],
    };

    const result = normalizeToolParameters(tool);
    const params = result.parameters as Record<string, unknown>;
    const props = params.properties as Record<string, Record<string, unknown>>;

    expect(props.name.type).toBe("string");
  });

  it("preserves enum values in array-format params", () => {
    const tool = {
      name: "set_mode",
      parameters: [
        { name: "mode", type: "string", enum: ["fast", "slow"], required: true },
      ],
    };

    const result = normalizeToolParameters(tool);
    const params = result.parameters as Record<string, unknown>;
    const props = params.properties as Record<string, Record<string, unknown>>;

    expect(props.mode.enum).toEqual(["fast", "slow"]);
  });

  it("skips array entries without a name", () => {
    const tool = {
      name: "test",
      parameters: [
        { name: "valid", type: "string" },
        { type: "number" },  // missing name
        null,
      ],
    };

    const result = normalizeToolParameters(tool);
    const params = result.parameters as Record<string, unknown>;
    const props = params.properties as Record<string, Record<string, unknown>>;

    expect(Object.keys(props)).toEqual(["valid"]);
  });

  it("omits required array when no params are required", () => {
    const tool = {
      name: "optional_tool",
      parameters: [
        { name: "flag", type: "boolean" },
      ],
    };

    const result = normalizeToolParameters(tool);
    const params = result.parameters as Record<string, unknown>;

    expect(params.required).toBeUndefined();
  });

  it("still handles normal JSON Schema object params", () => {
    const tool = {
      name: "normal_tool",
      parameters: {
        type: "object",
        properties: { x: { type: "string" } },
      },
    };

    const result = normalizeToolParameters(tool);
    const params = result.parameters as Record<string, unknown>;

    expect(params.type).toBe("object");
    expect(params.properties).toEqual({ x: { type: "string" } });
  });
});
