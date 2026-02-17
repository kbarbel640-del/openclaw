import { beforeEach, describe, expect, it, vi } from "vitest";
import type { McpServerConnection, McpToolDefinition, McpServerConfig } from "../mcp/types.js";

// ---------------------------------------------------------------------------
// Helpers — mirror the CLI logic without pulling in Commander
// ---------------------------------------------------------------------------

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
    name: "greet",
    description: "Greets the user",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Name to greet" },
        loud: { type: "boolean", description: "Shout?" },
      },
      required: ["name"],
    },
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// call-tool logic (extracted from mcp-cli.ts)
// ---------------------------------------------------------------------------

type CallToolOpts = {
  params?: string;
  json?: boolean;
  timeout?: string;
};

type CallToolResult = {
  ok: boolean;
  error?: string;
  result?: {
    content: Array<{ type: string; text?: string }>;
    isError?: boolean;
    durationMs?: number;
  };
};

/**
 * Pure-function equivalent of the call-tool command action.
 * Returns a result object instead of printing / exiting.
 */
function callToolLogic(
  connections: McpServerConnection[],
  serverName: string,
  toolName: string,
  opts: CallToolOpts,
): { ok: boolean; error?: string; params?: Record<string, unknown>; timeoutMs?: number; conn?: McpServerConnection } {
  const conn = connections.find((c) => c.name === serverName);
  if (!conn) {
    const available = connections.map((c) => c.name).join(", ") || "none";
    return { ok: false, error: `MCP server "${serverName}" not found. Available: ${available}` };
  }

  if (conn.status !== "connected") {
    return { ok: false, error: `MCP server "${serverName}" is not connected (status: ${conn.status}).` };
  }

  const tool = conn.tools.find((t) => t.name === toolName);
  if (!tool) {
    const available = conn.tools.map((t) => t.name).join(", ") || "none";
    return { ok: false, error: `Tool "${toolName}" not found on server "${serverName}". Available: ${available}` };
  }

  let params: Record<string, unknown>;
  try {
    params = JSON.parse(opts.params ?? "{}") as Record<string, unknown>;
  } catch {
    return { ok: false, error: "Invalid JSON in --params." };
  }

  const timeoutMs = opts.timeout ? parseInt(opts.timeout, 10) : undefined;
  if (timeoutMs !== undefined && (!Number.isFinite(timeoutMs) || timeoutMs <= 0)) {
    return { ok: false, error: "Invalid --timeout value." };
  }

  return { ok: true, params, timeoutMs, conn };
}

// ---------------------------------------------------------------------------
// test-tool logic (extracted from mcp-cli.ts)
// ---------------------------------------------------------------------------

type TestToolResult = {
  ok: boolean;
  error?: string;
  issues?: string[];
  schema?: McpToolDefinition["inputSchema"];
};

function testToolLogic(
  connections: McpServerConnection[],
  serverName: string,
  toolName: string,
  opts: { params?: string },
): TestToolResult {
  const conn = connections.find((c) => c.name === serverName);
  if (!conn) {
    return { ok: false, error: `MCP server "${serverName}" not found.` };
  }

  const tool = conn.tools.find((t) => t.name === toolName);
  if (!tool) {
    return { ok: false, error: `Tool "${toolName}" not found on server "${serverName}".` };
  }

  let params: Record<string, unknown>;
  try {
    params = JSON.parse(opts.params ?? "{}") as Record<string, unknown>;
  } catch {
    return { ok: false, error: "Invalid JSON in --params." };
  }

  const schema = tool.inputSchema;
  const issues: string[] = [];

  if (schema.required) {
    for (const key of schema.required) {
      if (!(key in params)) {
        issues.push(`Missing required parameter: ${key}`);
      }
    }
  }

  if (schema.properties) {
    for (const key of Object.keys(params)) {
      if (!(key in schema.properties)) {
        issues.push(`Unknown parameter: ${key}`);
      }
    }
  }

  return { ok: issues.length === 0, issues, schema };
}

// ---------------------------------------------------------------------------
// Tests: call-tool
// ---------------------------------------------------------------------------

describe("mcp call-tool", () => {
  const greetTool = createMockTool();
  let connections: McpServerConnection[];

  beforeEach(() => {
    connections = [createMockConnection({ tools: [greetTool] })];
  });

  it("resolves server and tool successfully", () => {
    const result = callToolLogic(connections, "test-server", "greet", {
      params: '{"name":"world"}',
    });
    expect(result.ok).toBe(true);
    expect(result.params).toEqual({ name: "world" });
    expect(result.conn).toBeDefined();
  });

  it("errors when server not found", () => {
    const result = callToolLogic(connections, "unknown", "greet", {});
    expect(result.ok).toBe(false);
    expect(result.error).toContain("not found");
    expect(result.error).toContain("test-server");
  });

  it("errors when server disconnected", () => {
    connections = [createMockConnection({ status: "error", tools: [greetTool] })];
    const result = callToolLogic(connections, "test-server", "greet", {});
    expect(result.ok).toBe(false);
    expect(result.error).toContain("not connected");
  });

  it("errors when tool not found on server", () => {
    const result = callToolLogic(connections, "test-server", "nonexistent", {});
    expect(result.ok).toBe(false);
    expect(result.error).toContain("not found");
    expect(result.error).toContain("greet");
  });

  it("errors on invalid JSON params", () => {
    const result = callToolLogic(connections, "test-server", "greet", {
      params: "not json",
    });
    expect(result.ok).toBe(false);
    expect(result.error).toContain("Invalid JSON");
  });

  it("defaults params to empty object", () => {
    const result = callToolLogic(connections, "test-server", "greet", {});
    expect(result.ok).toBe(true);
    expect(result.params).toEqual({});
  });

  it("parses timeout option", () => {
    const result = callToolLogic(connections, "test-server", "greet", {
      params: '{"name":"x"}',
      timeout: "5000",
    });
    expect(result.ok).toBe(true);
    expect(result.timeoutMs).toBe(5000);
  });

  it("errors on invalid timeout (zero)", () => {
    const result = callToolLogic(connections, "test-server", "greet", {
      params: "{}",
      timeout: "0",
    });
    expect(result.ok).toBe(false);
    expect(result.error).toContain("timeout");
  });

  it("errors on invalid timeout (non-numeric)", () => {
    const result = callToolLogic(connections, "test-server", "greet", {
      params: "{}",
      timeout: "abc",
    });
    expect(result.ok).toBe(false);
    expect(result.error).toContain("timeout");
  });

  it("errors on negative timeout", () => {
    const result = callToolLogic(connections, "test-server", "greet", {
      params: "{}",
      timeout: "-100",
    });
    expect(result.ok).toBe(false);
    expect(result.error).toContain("timeout");
  });

  it("handles empty connections list", () => {
    const result = callToolLogic([], "test-server", "greet", {});
    expect(result.ok).toBe(false);
    expect(result.error).toContain("not found");
    expect(result.error).toContain("Available: none");
  });

  it("lists available tools when tool not found", () => {
    connections = [
      createMockConnection({
        tools: [
          createMockTool({ name: "alpha" }),
          createMockTool({ name: "beta" }),
        ],
      }),
    ];
    const result = callToolLogic(connections, "test-server", "gamma", {});
    expect(result.ok).toBe(false);
    expect(result.error).toContain("alpha");
    expect(result.error).toContain("beta");
  });
});

// ---------------------------------------------------------------------------
// Tests: test-tool (dry-run)
// ---------------------------------------------------------------------------

describe("mcp test-tool", () => {
  const greetTool = createMockTool();
  let connections: McpServerConnection[];

  beforeEach(() => {
    connections = [createMockConnection({ tools: [greetTool] })];
  });

  it("validates valid params", () => {
    const result = testToolLogic(connections, "test-server", "greet", {
      params: '{"name":"world"}',
    });
    expect(result.ok).toBe(true);
    expect(result.issues).toEqual([]);
  });

  it("detects missing required parameters", () => {
    const result = testToolLogic(connections, "test-server", "greet", {
      params: "{}",
    });
    expect(result.ok).toBe(false);
    expect(result.issues).toContain("Missing required parameter: name");
  });

  it("detects unknown parameters", () => {
    const result = testToolLogic(connections, "test-server", "greet", {
      params: '{"name":"x","unknown_field":true}',
    });
    expect(result.ok).toBe(false);
    expect(result.issues).toContain("Unknown parameter: unknown_field");
  });

  it("detects both missing and unknown at once", () => {
    const result = testToolLogic(connections, "test-server", "greet", {
      params: '{"bogus":1}',
    });
    expect(result.ok).toBe(false);
    expect(result.issues).toHaveLength(2);
    expect(result.issues).toContain("Missing required parameter: name");
    expect(result.issues).toContain("Unknown parameter: bogus");
  });

  it("errors when server not found", () => {
    const result = testToolLogic(connections, "unknown", "greet", {});
    expect(result.ok).toBe(false);
    expect(result.error).toContain("not found");
  });

  it("errors when tool not found", () => {
    const result = testToolLogic(connections, "test-server", "missing", {});
    expect(result.ok).toBe(false);
    expect(result.error).toContain("not found");
  });

  it("errors on invalid JSON", () => {
    const result = testToolLogic(connections, "test-server", "greet", {
      params: "{bad",
    });
    expect(result.ok).toBe(false);
    expect(result.error).toContain("Invalid JSON");
  });

  it("returns schema for tool inspection", () => {
    const result = testToolLogic(connections, "test-server", "greet", {
      params: '{"name":"x"}',
    });
    expect(result.schema?.properties).toHaveProperty("name");
    expect(result.schema?.properties).toHaveProperty("loud");
    expect(result.schema?.required).toContain("name");
  });

  it("optional params pass validation", () => {
    const result = testToolLogic(connections, "test-server", "greet", {
      params: '{"name":"x","loud":true}',
    });
    expect(result.ok).toBe(true);
    expect(result.issues).toEqual([]);
  });

  it("tool with no required params accepts empty input", () => {
    const noReqTool = createMockTool({
      name: "ping",
      inputSchema: { type: "object", properties: { message: { type: "string" } } },
    });
    const conns = [createMockConnection({ tools: [noReqTool] })];
    const result = testToolLogic(conns, "test-server", "ping", {});
    expect(result.ok).toBe(true);
    expect(result.issues).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Tests: URL credential redaction
// ---------------------------------------------------------------------------

describe("redactUrlCredentials", () => {
  // Reimplement the logic here (same as mcp-cli.ts) to test in isolation
  function redactUrlCredentials(raw: string): string {
    try {
      const url = new URL(raw);
      if (url.password) {
        url.password = "***";
      }
      return url.href;
    } catch {
      return raw;
    }
  }

  it("redacts password from URL", () => {
    const result = redactUrlCredentials("https://user:secret-token@example.com/mcp");
    expect(result).toContain("***");
    expect(result).not.toContain("secret-token");
    expect(result).toContain("user");
    expect(result).toContain("example.com");
  });

  it("leaves URL without credentials unchanged", () => {
    const url = "https://example.com/mcp";
    expect(redactUrlCredentials(url)).toBe(url);
  });

  it("handles invalid URLs gracefully", () => {
    const raw = "not-a-url";
    expect(redactUrlCredentials(raw)).toBe(raw);
  });

  it("preserves path and query params", () => {
    const result = redactUrlCredentials("https://user:pass@host.com/path?key=value");
    expect(result).toContain("/path?key=value");
    expect(result).not.toContain("pass");
  });
});
