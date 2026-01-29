import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Type } from "@sinclair/typebox";

import type { AgentToolResult } from "@mariozechner/pi-agent-core";

// Mock dependencies
vi.mock("../../logging/subsystem.js", () => ({
  createSubsystemLogger: vi.fn(() => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  })),
}));

vi.mock("../tool-policy.js", () => ({
  normalizeToolName: vi.fn((name: string) => name.toLowerCase().replace(/-/g, "_")),
}));

import {
  extractJsonSchema,
  extractZodCompatibleSchema,
  createZodCompatibleSchema,
  convertToolResult,
  wrapToolHandler,
  mcpToolName,
  buildMcpAllowedTools,
  bridgeMoltbotToolsSync,
  resetMcpServerCache,
} from "./tool-bridge.js";
import type { AnyAgentTool } from "../tools/common.js";

describe("tool-bridge", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetMcpServerCache();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe("extractJsonSchema", () => {
    it("extracts JSON Schema from TypeBox schema", () => {
      const tool = {
        name: "test_tool",
        parameters: {
          type: "object",
          properties: {
            input: { type: "string" },
          },
          required: ["input"],
        },
      } as unknown as AnyAgentTool;

      const schema = extractJsonSchema(tool);

      expect(schema).toEqual({
        type: "object",
        properties: {
          input: { type: "string" },
        },
        required: ["input"],
      });
    });

    it("returns empty object schema when no parameters defined", () => {
      const tool = {
        name: "no_params_tool",
        parameters: undefined,
      } as unknown as AnyAgentTool;

      const schema = extractJsonSchema(tool);

      expect(schema).toEqual({ type: "object", properties: {} });
    });

    it("returns empty object schema for null parameters", () => {
      const tool = {
        name: "null_params_tool",
        parameters: null,
      } as unknown as AnyAgentTool;

      const schema = extractJsonSchema(tool);

      expect(schema).toEqual({ type: "object", properties: {} });
    });

    it("strips non-serializable properties from schema", () => {
      const symbolKey = Symbol("internal");
      const tool = {
        name: "symbol_tool",
        parameters: {
          type: "object",
          [symbolKey]: "should be stripped",
          properties: {},
        },
      } as unknown as AnyAgentTool;

      const schema = extractJsonSchema(tool);

      expect(schema).toEqual({ type: "object", properties: {} });
      expect(Object.getOwnPropertySymbols(schema)).toHaveLength(0);
    });
  });

  describe("createZodCompatibleSchema", () => {
    it("creates schema with parse/safeParse methods", () => {
      const typeboxSchema = {
        type: "object",
        properties: {
          name: { type: "string" },
        },
        required: ["name"],
      };

      const zodSchema = createZodCompatibleSchema(typeboxSchema as any);

      expect(typeof zodSchema.parse).toBe("function");
      expect(typeof zodSchema.safeParse).toBe("function");
      expect(typeof zodSchema.safeParseAsync).toBe("function");
      // Zod v4 Mini uses _zod instead of _def
      expect((zodSchema as any)._zod).toBeDefined();
    });

    it("parse returns data for valid input", () => {
      const typeboxSchema = Type.Object({
        count: Type.Number(),
      });

      const zodSchema = createZodCompatibleSchema(typeboxSchema);
      const result = zodSchema.parse({ count: 42 });

      expect(result).toEqual({ count: 42 });
    });

    it("safeParse returns success for valid input", () => {
      const typeboxSchema = Type.Object({
        active: Type.Boolean(),
      });

      const zodSchema = createZodCompatibleSchema(typeboxSchema);
      const result = zodSchema.safeParse({ active: true });

      expect(result.success).toBe(true);
      expect(result.data).toEqual({ active: true });
    });

    it("safeParse returns error for invalid input", () => {
      const typeboxSchema = Type.Object({
        value: Type.String(),
      });

      const zodSchema = createZodCompatibleSchema(typeboxSchema);
      // Missing required 'value' property
      const result = zodSchema.safeParse({});

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it("safeParseAsync returns promise", async () => {
      const typeboxSchema = Type.Object({});

      const zodSchema = createZodCompatibleSchema(typeboxSchema);
      const result = await zodSchema.safeParseAsync({});

      expect(result.success).toBe(true);
    });
  });

  describe("extractZodCompatibleSchema", () => {
    it("returns Zod-compatible schema for tool with parameters", () => {
      const tool = {
        name: "test_tool",
        parameters: {
          type: "object",
          properties: {
            query: { type: "string" },
          },
        },
      } as unknown as AnyAgentTool;

      const schema = extractZodCompatibleSchema(tool);

      expect(schema).toBeDefined();
      expect(typeof schema?.parse).toBe("function");
      expect(typeof schema?.safeParse).toBe("function");
    });

    it("returns undefined for tool without parameters", () => {
      const tool = {
        name: "no_params_tool",
        parameters: undefined,
      } as unknown as AnyAgentTool;

      const schema = extractZodCompatibleSchema(tool);

      expect(schema).toBeUndefined();
    });

    it("returns undefined for tool with null parameters", () => {
      const tool = {
        name: "null_params_tool",
        parameters: null,
      } as unknown as AnyAgentTool;

      const schema = extractZodCompatibleSchema(tool);

      expect(schema).toBeUndefined();
    });
  });

  describe("convertToolResult", () => {
    it("converts text content blocks", () => {
      const result: AgentToolResult<unknown> = {
        content: [{ type: "text", text: "Hello world" }],
      };

      const mcpResult = convertToolResult(result);

      expect(mcpResult.content).toEqual([{ type: "text", text: "Hello world" }]);
      expect(mcpResult.isError).toBeUndefined();
    });

    it("converts image content blocks", () => {
      const result: AgentToolResult<unknown> = {
        content: [{ type: "image", data: "base64data", mimeType: "image/png" }],
      };

      const mcpResult = convertToolResult(result);

      expect(mcpResult.content).toEqual([
        { type: "image", data: "base64data", mimeType: "image/png" },
      ]);
    });

    it("converts tool_error blocks with isError flag", () => {
      const result: AgentToolResult<unknown> = {
        content: [{ type: "tool_error", error: "Something went wrong" }],
      };

      const mcpResult = convertToolResult(result);

      expect(mcpResult.content).toEqual([{ type: "text", text: "Something went wrong" }]);
      expect(mcpResult.isError).toBe(true);
    });

    it("converts blocks with error field to isError", () => {
      const result: AgentToolResult<unknown> = {
        content: [{ type: "custom", error: "Custom error message" }],
      };

      const mcpResult = convertToolResult(result);

      expect(mcpResult.isError).toBe(true);
      expect(mcpResult.content[0]).toEqual({ type: "text", text: "Custom error message" });
    });

    it("returns (no output) for empty content", () => {
      const result: AgentToolResult<unknown> = {
        content: [],
      };

      const mcpResult = convertToolResult(result);

      expect(mcpResult.content).toEqual([{ type: "text", text: "(no output)" }]);
    });

    it("serializes details as tool-details text block", () => {
      const result: AgentToolResult<unknown> = {
        content: [{ type: "text", text: "Output" }],
        details: { key: "value", count: 42 },
      };

      const mcpResult = convertToolResult(result);

      expect(mcpResult.content.length).toBe(2);
      expect(mcpResult.content[1]).toMatchObject({
        type: "text",
        text: expect.stringContaining("<tool-details>"),
      });
      expect(mcpResult.content[1]).toMatchObject({
        text: expect.stringContaining('"key": "value"'),
      });
    });

    it("handles null details gracefully", () => {
      const result: AgentToolResult<unknown> = {
        content: [{ type: "text", text: "Output" }],
        details: null,
      };

      const mcpResult = convertToolResult(result);

      // Should not add a details block for null
      expect(mcpResult.content.length).toBe(1);
    });

    it("handles multiple content blocks", () => {
      const result: AgentToolResult<unknown> = {
        content: [
          { type: "text", text: "Line 1" },
          { type: "text", text: "Line 2" },
          { type: "image", data: "abc", mimeType: "image/jpeg" },
        ],
      };

      const mcpResult = convertToolResult(result);

      expect(mcpResult.content.length).toBe(3);
    });
  });

  describe("wrapToolHandler", () => {
    // Mock extra object that MCP SDK passes to handlers
    const mockExtra = { signal: new AbortController().signal };

    it("executes tool and converts result", async () => {
      const mockExecute = vi.fn().mockResolvedValue({
        content: [{ type: "text", text: "Tool output" }],
      });

      const tool = {
        name: "test-tool",
        execute: mockExecute,
      } as unknown as AnyAgentTool;

      const handler = wrapToolHandler(tool);
      const result = await handler({ input: "test" }, mockExtra);

      expect(mockExecute).toHaveBeenCalledWith(
        expect.stringContaining("mcp-bridge-test_tool"),
        { input: "test" },
        mockExtra.signal,
        undefined,
      );
      expect(result.content).toEqual([{ type: "text", text: "Tool output" }]);
    });

    it("uses signal from extra when provided", async () => {
      const mockExecute = vi.fn().mockResolvedValue({
        content: [{ type: "text", text: "Done" }],
      });

      const tool = {
        name: "abort-aware-tool",
        execute: mockExecute,
      } as unknown as AnyAgentTool;

      const extraController = new AbortController();
      const handler = wrapToolHandler(tool);
      await handler({}, { signal: extraController.signal });

      expect(mockExecute).toHaveBeenCalledWith(
        expect.any(String),
        {},
        extraController.signal,
        undefined,
      );
    });

    it("falls back to shared abortSignal when extra.signal is undefined", async () => {
      const mockExecute = vi.fn().mockResolvedValue({
        content: [{ type: "text", text: "Done" }],
      });

      const tool = {
        name: "fallback-signal-tool",
        execute: mockExecute,
      } as unknown as AnyAgentTool;

      const sharedController = new AbortController();
      const handler = wrapToolHandler(tool, sharedController.signal);
      await handler({}, {} as any);

      expect(mockExecute).toHaveBeenCalledWith(
        expect.any(String),
        {},
        sharedController.signal,
        undefined,
      );
    });

    it("handles tool execution errors gracefully", async () => {
      const mockExecute = vi.fn().mockRejectedValue(new Error("Tool crashed"));

      const tool = {
        name: "crashing-tool",
        execute: mockExecute,
      } as unknown as AnyAgentTool;

      const handler = wrapToolHandler(tool);
      const result = await handler({}, mockExtra);

      expect(result.isError).toBe(true);
      expect(result.content[0]).toMatchObject({
        type: "text",
        text: expect.stringContaining("Tool error"),
      });
    });

    it("returns abort message for AbortError", async () => {
      const abortError = new Error("Aborted");
      abortError.name = "AbortError";
      const mockExecute = vi.fn().mockRejectedValue(abortError);

      const tool = {
        name: "abortable-tool",
        execute: mockExecute,
      } as unknown as AnyAgentTool;

      const handler = wrapToolHandler(tool);
      const result = await handler({}, mockExtra);

      expect(result.isError).toBe(true);
      expect(result.content[0]).toMatchObject({
        type: "text",
        text: expect.stringContaining("was aborted"),
      });
    });

    it("calls onToolUpdate callback with update data", async () => {
      const mockExecute = vi.fn().mockImplementation(async (_id, _args, _signal, onUpdate) => {
        onUpdate?.({ progress: 50 });
        return { content: [{ type: "text", text: "Done" }] };
      });

      const tool = {
        name: "updating-tool",
        execute: mockExecute,
      } as unknown as AnyAgentTool;

      const onToolUpdate = vi.fn();
      const handler = wrapToolHandler(tool, undefined, onToolUpdate);
      await handler({}, mockExtra);

      expect(onToolUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          toolName: "updating_tool",
          update: { progress: 50 },
        }),
      );
    });

    it("does not break execution when onToolUpdate callback throws", async () => {
      const mockExecute = vi.fn().mockImplementation(async (_id, _args, _signal, onUpdate) => {
        onUpdate?.({ progress: 100 });
        return { content: [{ type: "text", text: "Success" }] };
      });

      const tool = {
        name: "callback-error-tool",
        execute: mockExecute,
      } as unknown as AnyAgentTool;

      const onToolUpdate = vi.fn().mockRejectedValue(new Error("Callback failed"));
      const handler = wrapToolHandler(tool, undefined, onToolUpdate);

      // Should not throw even if callback fails
      const result = await handler({}, mockExtra);

      expect(result.content[0]).toMatchObject({
        type: "text",
        text: "Success",
      });
    });

    it("generates unique tool call IDs for each invocation", async () => {
      const toolCallIds: string[] = [];
      const mockExecute = vi.fn().mockImplementation(async (id) => {
        toolCallIds.push(id);
        return { content: [{ type: "text", text: "Done" }] };
      });

      const tool = {
        name: "unique-id-tool",
        execute: mockExecute,
      } as unknown as AnyAgentTool;

      const handler = wrapToolHandler(tool);
      await handler({}, mockExtra);
      await handler({}, mockExtra);

      expect(toolCallIds[0]).not.toBe(toolCallIds[1]);
      expect(toolCallIds[0]).toContain("mcp-bridge-unique_id_tool");
      expect(toolCallIds[1]).toContain("mcp-bridge-unique_id_tool");
    });
  });

  describe("mcpToolName", () => {
    it("formats tool name with server prefix", () => {
      expect(mcpToolName("moltbot", "bash")).toBe("mcp__moltbot__bash");
    });

    it("handles multi-part tool names", () => {
      expect(mcpToolName("my-server", "my_tool_name")).toBe("mcp__my-server__my_tool_name");
    });
  });

  describe("buildMcpAllowedTools", () => {
    it("builds allowed tools list from tool array", () => {
      const tools = [{ name: "tool_a" }, { name: "tool_b" }] as AnyAgentTool[];

      const allowed = buildMcpAllowedTools("moltbot", tools);

      expect(allowed).toEqual(["mcp__moltbot__tool_a", "mcp__moltbot__tool_b"]);
    });

    it("returns empty array for empty tools list", () => {
      const allowed = buildMcpAllowedTools("moltbot", []);

      expect(allowed).toEqual([]);
    });
  });

  describe("bridgeMoltbotToolsSync", () => {
    // Helper to create a class-like McpServer mock (required because implementation uses `new`)
    function createMockMcpServerClass(registerToolFn: ReturnType<typeof vi.fn>) {
      return class MockMcpServer {
        registerTool = registerToolFn;
        constructor(_opts: { name: string; version: string }) {
          // Constructor receives options
        }
      };
    }

    it("registers tools with MCP server using registerTool", () => {
      const registeredTools: string[] = [];
      const registerToolFn = vi.fn((name: string) => {
        registeredTools.push(name);
      });
      const MockMcpServer = createMockMcpServerClass(registerToolFn);

      const tools = [
        {
          name: "tool_one",
          description: "First tool",
          parameters: { type: "object", properties: {} },
          execute: vi.fn(),
        },
        {
          name: "tool_two",
          description: "Second tool",
          parameters: { type: "object", properties: {} },
          execute: vi.fn(),
        },
      ] as unknown as AnyAgentTool[];

      const result = bridgeMoltbotToolsSync({
        name: "test-server",
        tools,
        McpServer: MockMcpServer as any,
      });

      expect(result.toolCount).toBe(2);
      expect(result.registeredTools).toEqual(["tool_one", "tool_two"]);
      expect(result.skippedTools).toEqual([]);
      expect(registerToolFn).toHaveBeenCalledTimes(2);
    });

    it("passes config with inputSchema to registerTool", () => {
      const registerToolFn = vi.fn();
      const MockMcpServer = createMockMcpServerClass(registerToolFn);

      const tools = [
        {
          name: "schema_tool",
          description: "Tool with schema",
          parameters: { type: "object", properties: { query: { type: "string" } } },
          execute: vi.fn(),
        },
      ] as unknown as AnyAgentTool[];

      bridgeMoltbotToolsSync({
        name: "test-server",
        tools,
        McpServer: MockMcpServer as any,
      });

      expect(registerToolFn).toHaveBeenCalledWith(
        "schema_tool",
        expect.objectContaining({
          description: "Tool with schema",
          inputSchema: expect.objectContaining({
            parse: expect.any(Function),
            safeParse: expect.any(Function),
          }),
        }),
        expect.any(Function),
      );
    });

    it("skips tools with empty names", () => {
      const MockMcpServer = createMockMcpServerClass(vi.fn());

      const tools = [
        { name: "", execute: vi.fn() },
        { name: "   ", execute: vi.fn() },
        { name: "valid_tool", execute: vi.fn() },
      ] as unknown as AnyAgentTool[];

      const result = bridgeMoltbotToolsSync({
        name: "test-server",
        tools,
        McpServer: MockMcpServer as any,
      });

      expect(result.toolCount).toBe(1);
      expect(result.registeredTools).toEqual(["valid_tool"]);
      expect(result.skippedTools).toContain("(unnamed)");
    });

    it("returns correct server config structure", () => {
      const MockMcpServer = createMockMcpServerClass(vi.fn());

      const result = bridgeMoltbotToolsSync({
        name: "my-server",
        tools: [],
        McpServer: MockMcpServer as any,
      });

      expect(result.serverConfig.type).toBe("sdk");
      expect(result.serverConfig.name).toBe("my-server");
      expect(result.serverConfig.instance).toBeInstanceOf(MockMcpServer);
    });

    it("handles tool registration errors gracefully", () => {
      const registerToolFn = vi.fn((name: string) => {
        if (name === "bad_tool") throw new Error("Registration failed");
      });
      const MockMcpServer = createMockMcpServerClass(registerToolFn);

      const tools = [
        { name: "good_tool", execute: vi.fn() },
        { name: "bad_tool", execute: vi.fn() },
      ] as unknown as AnyAgentTool[];

      const result = bridgeMoltbotToolsSync({
        name: "test-server",
        tools,
        McpServer: MockMcpServer as any,
      });

      expect(result.registeredTools).toEqual(["good_tool"]);
      expect(result.skippedTools).toContain("bad_tool");
    });
  });

  describe("tool call error handling", () => {
    const mockExtra = { signal: new AbortController().signal };

    it("includes tool name in error message when tool throws", async () => {
      const mockExecute = vi.fn().mockRejectedValue(new Error("Database connection failed"));

      const tool = {
        name: "database-query",
        execute: mockExecute,
      } as unknown as AnyAgentTool;

      const handler = wrapToolHandler(tool);
      const result = await handler({ query: "SELECT *" }, mockExtra);

      expect(result.isError).toBe(true);
      expect(result.content[0].type).toBe("text");
      expect((result.content[0] as { text: string }).text).toContain("database_query");
      expect((result.content[0] as { text: string }).text).toContain("Database connection failed");
    });

    it("handles non-Error thrown values", async () => {
      const mockExecute = vi.fn().mockRejectedValue("string error message");

      const tool = {
        name: "string-error-tool",
        execute: mockExecute,
      } as unknown as AnyAgentTool;

      const handler = wrapToolHandler(tool);
      const result = await handler({}, mockExtra);

      expect(result.isError).toBe(true);
      expect((result.content[0] as { text: string }).text).toContain("string error message");
    });

    it("handles undefined/null thrown values", async () => {
      const mockExecute = vi.fn().mockRejectedValue(undefined);

      const tool = {
        name: "undefined-error-tool",
        execute: mockExecute,
      } as unknown as AnyAgentTool;

      const handler = wrapToolHandler(tool);
      const result = await handler({}, mockExtra);

      expect(result.isError).toBe(true);
      expect(result.content.length).toBeGreaterThan(0);
    });

    it("converts tool_error blocks from result to MCP error format", () => {
      const result: AgentToolResult<unknown> = {
        content: [
          { type: "tool_error", error: "Validation failed: missing required field 'name'" },
        ],
      };

      const mcpResult = convertToolResult(result);

      expect(mcpResult.isError).toBe(true);
      expect(mcpResult.content).toHaveLength(1);
      expect((mcpResult.content[0] as { text: string }).text).toBe(
        "Validation failed: missing required field 'name'",
      );
    });

    it("preserves error details from multiple error blocks", () => {
      const result: AgentToolResult<unknown> = {
        content: [
          { type: "tool_error", error: "Error 1: Invalid input" },
          { type: "tool_error", error: "Error 2: Permission denied" },
        ],
      };

      const mcpResult = convertToolResult(result);

      expect(mcpResult.isError).toBe(true);
      expect(mcpResult.content).toHaveLength(2);
    });

    it("marks result as error when any block has error field", () => {
      const result: AgentToolResult<unknown> = {
        content: [
          { type: "text", text: "Partial success" },
          { type: "warning", error: "But something went wrong" },
        ],
      };

      const mcpResult = convertToolResult(result);

      expect(mcpResult.isError).toBe(true);
    });
  });

  describe("Zod schema conversion", () => {
    it("converts TypeBox string property to Zod string", () => {
      const typeboxSchema = Type.Object({
        name: Type.String(),
      });

      const zodSchema = createZodCompatibleSchema(typeboxSchema);

      // Should successfully parse valid input
      const parseResult = zodSchema.safeParse({ name: "test" });
      expect(parseResult.success).toBe(true);
    });

    it("converts TypeBox number property to Zod number", () => {
      const typeboxSchema = Type.Object({
        count: Type.Number(),
      });

      const zodSchema = createZodCompatibleSchema(typeboxSchema);

      const parseResult = zodSchema.safeParse({ count: 42 });
      expect(parseResult.success).toBe(true);
    });

    it("converts TypeBox boolean property to Zod boolean", () => {
      const typeboxSchema = Type.Object({
        active: Type.Boolean(),
      });

      const zodSchema = createZodCompatibleSchema(typeboxSchema);

      const parseResult = zodSchema.safeParse({ active: true });
      expect(parseResult.success).toBe(true);
    });

    it("converts TypeBox array property to Zod array", () => {
      const typeboxSchema = Type.Object({
        items: Type.Array(Type.String()),
      });

      const zodSchema = createZodCompatibleSchema(typeboxSchema);

      const parseResult = zodSchema.safeParse({ items: ["a", "b", "c"] });
      expect(parseResult.success).toBe(true);
    });

    it("converts TypeBox optional property to Zod optional", () => {
      const typeboxSchema = Type.Object({
        required: Type.String(),
        optional: Type.Optional(Type.String()),
      });

      const zodSchema = createZodCompatibleSchema(typeboxSchema);

      // Should work without optional field
      const parseResult = zodSchema.safeParse({ required: "value" });
      expect(parseResult.success).toBe(true);
    });

    it("rejects invalid input with Zod validation errors", () => {
      const typeboxSchema = Type.Object({
        name: Type.String(),
        count: Type.Number(),
      });

      const zodSchema = createZodCompatibleSchema(typeboxSchema);

      // Pass wrong types
      const parseResult = zodSchema.safeParse({ name: 123, count: "not a number" });
      expect(parseResult.success).toBe(false);
    });

    it("has _zod property for MCP SDK compatibility", () => {
      const typeboxSchema = Type.Object({
        value: Type.String(),
      });

      const zodSchema = createZodCompatibleSchema(typeboxSchema);

      // Zod v4 Mini schemas have _zod property that MCP SDK checks
      expect((zodSchema as any)._zod).toBeDefined();
    });
  });
});
