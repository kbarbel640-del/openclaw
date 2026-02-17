import { beforeEach, describe, expect, it, vi } from "vitest";
import type { McpServerConnection, McpToolDefinition } from "./types.js";

// ── helpers ──────────────────────────────────────────────────────────────────

function createMockConnection(
  overrides: Partial<McpServerConnection> = {},
): McpServerConnection {
  return {
    name: "test-server",
    config: { command: "echo", args: [] },
    tools: [],
    status: "connected",
    callTool: vi.fn().mockResolvedValue({
      content: [{ type: "text", text: "ok" }],
    }),
    ping: vi.fn().mockResolvedValue(true),
    reconnect: vi.fn().mockResolvedValue(undefined),
    disconnect: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

function createMockTool(overrides: Partial<McpToolDefinition> = {}): McpToolDefinition {
  return {
    name: "do_thing",
    description: "Does the thing",
    inputSchema: {
      type: "object",
      properties: {
        message: { type: "string", description: "A message" },
        count: { type: "integer", description: "How many" },
      },
      required: ["message"],
    },
    ...overrides,
  };
}

// ── tools.ts ─────────────────────────────────────────────────────────────────

describe("MCP tool bridge", () => {
  // Re-import after potential mocks.
  let createMcpToolsFromConnection: typeof import("./tools.js")["createMcpToolsFromConnection"];
  let createMcpToolsFromConnections: typeof import("./tools.js")["createMcpToolsFromConnections"];

  beforeEach(async () => {
    vi.clearAllMocks();
    const mod = await import("./tools.js");
    createMcpToolsFromConnection = mod.createMcpToolsFromConnection;
    createMcpToolsFromConnections = mod.createMcpToolsFromConnections;
  });

  it("skips tools from non-connected servers", () => {
    const conn = createMockConnection({ status: "error" });
    const tools = createMcpToolsFromConnection(conn);
    expect(tools).toHaveLength(0);
  });

  it("converts MCP tools to AgentTool objects", () => {
    const mcpTool = createMockTool();
    const conn = createMockConnection({ tools: [mcpTool] });
    const tools = createMcpToolsFromConnection(conn);

    expect(tools).toHaveLength(1);
    const tool = tools[0]!;
    expect(tool.name).toBe("mcp_test-server_do_thing");
    expect(tool.description).toBe("Does the thing");
    expect(tool.label).toBe("MCP: test-server/do_thing");
    expect(tool.parameters).toBeDefined();
    expect(tool.execute).toBeTypeOf("function");
  });

  it("prefixes tool names with server name", () => {
    const conn = createMockConnection({
      name: "github",
      tools: [createMockTool({ name: "list_repos" })],
    });
    const tools = createMcpToolsFromConnection(conn);
    expect(tools[0]!.name).toBe("mcp_github_list_repos");
  });

  it("uses explicit toolPrefix from config", () => {
    const conn = createMockConnection({
      name: "my-server",
      config: { command: "echo", toolPrefix: "gh" },
      tools: [createMockTool({ name: "list_repos" })],
    });
    const tools = createMcpToolsFromConnection(conn);
    expect(tools[0]!.name).toBe("mcp_gh_list_repos");
  });

  it("uses empty prefix when toolPrefix is empty string", () => {
    const conn = createMockConnection({
      name: "my-server",
      config: { command: "echo", toolPrefix: "" },
      tools: [createMockTool({ name: "list_repos" })],
    });
    const tools = createMcpToolsFromConnection(conn);
    expect(tools[0]!.name).toBe("list_repos");
  });

  it("detects tool name collisions", () => {
    const conn = createMockConnection({
      tools: [createMockTool({ name: "do_thing" })],
    });
    const existing = new Set(["mcp_test-server_do_thing"]);
    const tools = createMcpToolsFromConnection(conn, existing);
    expect(tools).toHaveLength(0);
  });

  it("proxies tool calls to the MCP connection", async () => {
    const callTool = vi.fn().mockResolvedValue({
      content: [{ type: "text", text: "result data" }],
    });
    const conn = createMockConnection({
      tools: [createMockTool()],
      callTool,
    });
    const tools = createMcpToolsFromConnection(conn);
    const tool = tools[0]!;

    const result = await tool.execute("call-1", { message: "hello" });

    expect(callTool).toHaveBeenCalledWith("do_thing", { message: "hello" }, undefined);
    expect(result.content).toEqual([{ type: "text", text: "result data" }]);
  });

  it("handles MCP error results", async () => {
    const callTool = vi.fn().mockResolvedValue({
      content: [{ type: "text", text: "something went wrong" }],
      isError: true,
    });
    const conn = createMockConnection({ tools: [createMockTool()], callTool });
    const tools = createMcpToolsFromConnection(conn);
    const result = await tools[0]!.execute("call-2", { message: "test" });

    expect(result.content).toEqual([{ type: "text", text: "something went wrong" }]);
    expect((result.details as Record<string, unknown>).isError).toBe(true);
  });

  it("handles MCP image content blocks", async () => {
    const callTool = vi.fn().mockResolvedValue({
      content: [
        { type: "image", data: "base64data==", mimeType: "image/png" },
      ],
    });
    const conn = createMockConnection({ tools: [createMockTool()], callTool });
    const tools = createMcpToolsFromConnection(conn);
    const result = await tools[0]!.execute("call-3", { message: "img" });

    expect(result.content[0]).toEqual({
      type: "image",
      data: "base64data==",
      mimeType: "image/png",
    });
  });

  it("handles empty MCP results", async () => {
    const callTool = vi.fn().mockResolvedValue({
      content: [],
    });
    const conn = createMockConnection({ tools: [createMockTool()], callTool });
    const tools = createMcpToolsFromConnection(conn);
    const result = await tools[0]!.execute("call-4", { message: "empty" });

    expect(result.content).toHaveLength(1);
    expect(result.content[0]).toMatchObject({ type: "text", text: "(empty result)" });
  });

  it("converts JSON Schema properties to TypeBox parameters", () => {
    const tool = createMockTool({
      inputSchema: {
        type: "object",
        properties: {
          name: { type: "string", description: "The name" },
          age: { type: "integer", description: "Age in years" },
          active: { type: "boolean" },
          tags: { type: "array", items: { type: "string" } },
        },
        required: ["name"],
      },
    });
    const conn = createMockConnection({ tools: [tool] });
    const tools = createMcpToolsFromConnection(conn);
    const params = tools[0]!.parameters;

    expect(params).toBeDefined();
    // TypeBox objects should have a properties key.
    expect(params.properties).toBeDefined();
    expect(params.properties.name).toBeDefined();
    expect(params.properties.age).toBeDefined();
    expect(params.properties.active).toBeDefined();
    expect(params.properties.tags).toBeDefined();
  });

  it("handles tools with no inputSchema properties", () => {
    const tool = createMockTool({ inputSchema: {} });
    const conn = createMockConnection({ tools: [tool] });
    const tools = createMcpToolsFromConnection(conn);
    expect(tools).toHaveLength(1);
    expect(tools[0]!.parameters).toBeDefined();
  });

  it("creates tools from multiple connections", () => {
    const conn1 = createMockConnection({
      name: "server-a",
      tools: [createMockTool({ name: "tool_a" })],
    });
    const conn2 = createMockConnection({
      name: "server-b",
      tools: [createMockTool({ name: "tool_b" })],
    });
    const tools = createMcpToolsFromConnections([conn1, conn2]);
    expect(tools).toHaveLength(2);
    expect(tools[0]!.name).toBe("mcp_server-a_tool_a");
    expect(tools[1]!.name).toBe("mcp_server-b_tool_b");
  });

  it("detects cross-server name collisions", () => {
    const conn1 = createMockConnection({
      name: "srv",
      tools: [createMockTool({ name: "run" })],
    });
    const conn2 = createMockConnection({
      name: "srv",
      tools: [createMockTool({ name: "run" })],
    });
    const tools = createMcpToolsFromConnections([conn1, conn2]);
    // Only the first should be registered.
    expect(tools).toHaveLength(1);
  });
});

// ── tool-policy group:mcp ────────────────────────────────────────────────────

describe("tool-policy group:mcp", () => {
  it("expandToolGroups resolves group:mcp to mcp_ prefixed tools", async () => {
    const { expandToolGroups } = await import("../agents/tool-policy.js");
    const available = new Set(["read", "write", "mcp_github_list", "mcp_fs_read", "exec"]);
    const expanded = expandToolGroups(["group:mcp"], available);

    expect(expanded).toContain("mcp_github_list");
    expect(expanded).toContain("mcp_fs_read");
    expect(expanded).not.toContain("read");
    expect(expanded).not.toContain("exec");
  });

  it("expandToolGroups returns empty for group:mcp with no MCP tools", async () => {
    const { expandToolGroups } = await import("../agents/tool-policy.js");
    const available = new Set(["read", "exec"]);
    const expanded = expandToolGroups(["group:mcp"], available);
    expect(expanded).toHaveLength(0);
  });

  it("expandToolGroups works without availableToolNames (backward compat)", async () => {
    const { expandToolGroups } = await import("../agents/tool-policy.js");
    // group:mcp with no available names → resolves to the static empty array.
    const expanded = expandToolGroups(["group:mcp"]);
    expect(expanded).toHaveLength(0);
  });
});

// ── Tool timeout resolution ──────────────────────────────────────────────────

describe("Tool timeout resolution", () => {
  let resolveToolTimeout: typeof import("./tools.js")["resolveToolTimeout"];
  let createMcpToolsFromConnectionLocal: typeof import("./tools.js")["createMcpToolsFromConnection"];

  beforeEach(async () => {
    const mod = await import("./tools.js");
    resolveToolTimeout = mod.resolveToolTimeout;
    createMcpToolsFromConnectionLocal = mod.createMcpToolsFromConnection;
  });

  it("returns per-tool timeout when defined", () => {
    const config = {
      command: "echo",
      args: [],
      toolTimeoutMs: 30000,
      toolTimeouts: { slow_tool: 120000, fast_tool: 5000 },
    };
    expect(resolveToolTimeout(config, "slow_tool")).toBe(120000);
    expect(resolveToolTimeout(config, "fast_tool")).toBe(5000);
  });

  it("returns undefined for tools without specific timeout", () => {
    const config = {
      command: "echo",
      args: [],
      toolTimeoutMs: 30000,
      toolTimeouts: { slow_tool: 120000 },
    };
    expect(resolveToolTimeout(config, "other_tool")).toBeUndefined();
  });

  it("returns undefined when toolTimeouts is not set", () => {
    const config = { command: "echo", args: [] };
    expect(resolveToolTimeout(config, "any_tool")).toBeUndefined();
  });

  it("passes per-tool timeout to callTool", async () => {
    const callToolSpy = vi.fn().mockResolvedValue({
      content: [{ type: "text", text: "done" }],
    });
    const conn = createMockConnection({
      config: {
        command: "echo",
        args: [],
        toolTimeouts: { special_tool: 60000 },
      },
      tools: [
        {
          name: "special_tool",
          description: "A tool with custom timeout",
          inputSchema: { type: "object", properties: {} },
        },
      ],
      callTool: callToolSpy,
    });

    const tools = createMcpToolsFromConnectionLocal(conn);
    expect(tools).toHaveLength(1);

    await tools[0].execute("call-1", {});
    expect(callToolSpy).toHaveBeenCalledWith("special_tool", {}, 60000);
  });
});
