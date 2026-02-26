import { describe, expect, it } from "vitest";
import { normalizeToolParameters } from "./pi-tools.schema.js";
import type { AnyAgentTool } from "./pi-tools.types.js";

describe("normalizeToolParameters - Issue #27652 reproduction", () => {
  it("should handle the exact schema from the issue", () => {
    // Exact schema from the bug report
    const tool: AnyAgentTool = {
      name: "apple-pim-cli",
      description: "Apple PIM CLI tool",
      parameters: {
        type: "object",
        properties: {
          location: {
            description: "Location-based alarm",
            oneOf: [
              { type: "object", properties: {}, additionalProperties: false },
              { type: "object", properties: { name: { type: "string" } }, required: ["name"] },
            ],
          },
        },
      },
    };

    // Should not throw "Cannot read properties of undefined (reading 'properties')"
    const result = normalizeToolParameters(tool);
    expect(result).toBeDefined();
    expect(result.parameters).toBeDefined();
  });

  it("should handle provider-specific processing with nested oneOf", () => {
    const tool: AnyAgentTool = {
      name: "testTool",
      description: "Test tool",
      parameters: {
        type: "object",
        properties: {
          config: {
            oneOf: [
              { type: "object", properties: { mode: { type: "string" } } },
              { type: "object", properties: { enabled: { type: "boolean" } } },
            ],
          },
        },
      },
    };

    // Test with different providers
    const providers = [undefined, "openai", "google", "gemini", "anthropic"];

    for (const provider of providers) {
      expect(() => normalizeToolParameters(tool, { modelProvider: provider })).not.toThrow();

      const result = normalizeToolParameters(tool, { modelProvider: provider });
      expect(result).toBeDefined();
      expect(result.parameters).toBeDefined();
    }
  });

  it("should handle top-level oneOf that could be misinterpreted", () => {
    // Schema where the top-level has oneOf but no type/properties
    const tool: AnyAgentTool = {
      name: "testTool",
      description: "Test tool",
      parameters: {
        oneOf: [
          {
            type: "object",
            properties: {
              action: { type: "string" },
              // Nested oneOf inside a property
              data: {
                oneOf: [
                  { type: "string" },
                  { type: "object", properties: { id: { type: "number" } } },
                ],
              },
            },
          },
        ],
      },
    };

    expect(() => normalizeToolParameters(tool)).not.toThrow();

    const result = normalizeToolParameters(tool);
    expect(result).toBeDefined();
  });
});
