import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { loadMcpConfig, hasMcpConfig } from "./config.js";
import { mcpToolToAgentTool, mcpToolsToAgentTools } from "./tool-bridge.js";
import type { McpToolDefinition, McpToolCallResult } from "./types.js";

function makeTmpDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "mcp-test-"));
}

function cleanup(dir: string): void {
  fs.rmSync(dir, { recursive: true, force: true });
}

describe("loadMcpConfig", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = makeTmpDir();
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  it("should load a valid mcp.json", () => {
    const config = {
      servers: {
        filesystem: {
          command: "npx",
          args: ["-y", "@modelcontextprotocol/server-filesystem", "/tmp"],
        },
        github: {
          command: "npx",
          args: ["-y", "@modelcontextprotocol/server-github"],
          env: { GITHUB_TOKEN: "test-token" },
        },
      },
    };
    fs.writeFileSync(path.join(tmpDir, "mcp.json"), JSON.stringify(config));

    const result = loadMcpConfig(tmpDir);
    expect(result).not.toBeNull();
    expect(result?.servers.filesystem.command).toBe("npx");
    expect(result?.servers.filesystem.args).toEqual([
      "-y",
      "@modelcontextprotocol/server-filesystem",
      "/tmp",
    ]);
    expect(result?.servers.github.env?.GITHUB_TOKEN).toBe("test-token");
  });

  it("should return null for missing mcp.json", () => {
    const result = loadMcpConfig(tmpDir);
    expect(result).toBeNull();
  });

  it("should return null for invalid JSON", () => {
    fs.writeFileSync(path.join(tmpDir, "mcp.json"), "not json");
    const result = loadMcpConfig(tmpDir);
    expect(result).toBeNull();
  });

  it("should skip server entries without command", () => {
    const config = {
      servers: {
        valid: { command: "echo", args: ["test"] },
        invalid: { args: ["missing-command"] },
      },
    };
    fs.writeFileSync(path.join(tmpDir, "mcp.json"), JSON.stringify(config));

    const result = loadMcpConfig(tmpDir);
    expect(result).not.toBeNull();
    expect(Object.keys(result?.servers ?? {})).toEqual(["valid"]);
  });

  it("should resolve ${VAR} references in env", () => {
    const originalToken = process.env.TEST_MCP_TOKEN;
    process.env.TEST_MCP_TOKEN = "resolved-value";

    const config = {
      servers: {
        test: {
          command: "echo",
          env: { TOKEN: "${TEST_MCP_TOKEN}" },
        },
      },
    };
    fs.writeFileSync(path.join(tmpDir, "mcp.json"), JSON.stringify(config));

    const result = loadMcpConfig(tmpDir);
    expect(result?.servers.test.env?.TOKEN).toBe("resolved-value");

    // Cleanup
    if (originalToken === undefined) {
      delete process.env.TEST_MCP_TOKEN;
    } else {
      process.env.TEST_MCP_TOKEN = originalToken;
    }
  });

  it("should resolve undefined ${VAR} to empty string", () => {
    const config = {
      servers: {
        test: {
          command: "echo",
          env: { TOKEN: "${NONEXISTENT_VAR_12345}" },
        },
      },
    };
    fs.writeFileSync(path.join(tmpDir, "mcp.json"), JSON.stringify(config));

    const result = loadMcpConfig(tmpDir);
    expect(result?.servers.test.env?.TOKEN).toBe("");
  });

  it("should parse transport type from config", () => {
    const config = {
      servers: {
        stdio: { command: "echo", type: "stdio" },
        sse: { command: "echo", type: "sse" },
      },
    };
    fs.writeFileSync(path.join(tmpDir, "mcp.json"), JSON.stringify(config));

    const result = loadMcpConfig(tmpDir);
    expect(result?.servers.stdio.type).toBe("stdio");
    expect(result?.servers.sse.type).toBe("sse");
  });

  it("should default transport type to stdio", () => {
    const config = {
      servers: {
        test: { command: "echo" },
      },
    };
    fs.writeFileSync(path.join(tmpDir, "mcp.json"), JSON.stringify(config));

    const result = loadMcpConfig(tmpDir);
    expect(result?.servers.test.type).toBe("stdio");
  });

  it("should fall back to stdio for unknown transport type", () => {
    const config = {
      servers: {
        test: { command: "echo", type: "unknown-transport" },
      },
    };
    fs.writeFileSync(path.join(tmpDir, "mcp.json"), JSON.stringify(config));

    const result = loadMcpConfig(tmpDir);
    expect(result?.servers.test.type).toBe("stdio");
  });
});

describe("hasMcpConfig", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = makeTmpDir();
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  it("should return true when mcp.json exists", () => {
    fs.writeFileSync(path.join(tmpDir, "mcp.json"), "{}");
    expect(hasMcpConfig(tmpDir)).toBe(true);
  });

  it("should return false when mcp.json does not exist", () => {
    expect(hasMcpConfig(tmpDir)).toBe(false);
  });
});

describe("mcpToolToAgentTool", () => {
  it("should convert an MCP tool to an AgentTool", () => {
    const tool: McpToolDefinition = {
      name: "read_file",
      description: "Read a file from disk",
      inputSchema: {
        type: "object",
        properties: {
          path: { type: "string", description: "File path" },
        },
        required: ["path"],
      },
    };

    const callFn = async () => ({
      content: [{ type: "text" as const, text: "file content" }],
    });

    const agentTool = mcpToolToAgentTool("filesystem", tool, callFn);

    expect(agentTool.name).toBe("mcp_filesystem_read_file");
    expect(agentTool.description).toBe("Read a file from disk");
    expect(agentTool.label).toBe("MCP: filesystem/read_file");
  });

  it("should execute tool calls via the call function", async () => {
    const tool: McpToolDefinition = {
      name: "echo",
      description: "Echo input",
      inputSchema: { type: "object", properties: {} },
    };

    const callFn = async (_server: string, _tool: string, params: Record<string, unknown>) => ({
      content: [{ type: "text" as const, text: `echoed: ${JSON.stringify(params)}` }],
    });

    const agentTool = mcpToolToAgentTool("test", tool, callFn);
    const result = await agentTool.execute("call-1", { message: "hello" });

    expect(result.content).toHaveLength(1);
    expect(result.content[0].type).toBe("text");
    expect((result.content[0] as { type: "text"; text: string }).text).toContain("echoed");
  });

  it("should handle error results from MCP", async () => {
    const tool: McpToolDefinition = {
      name: "fail",
      description: "Always fails",
      inputSchema: { type: "object", properties: {} },
    };

    const callFn = async (): Promise<McpToolCallResult> => ({
      content: [{ type: "text", text: "something broke" }],
      isError: true,
    });

    const agentTool = mcpToolToAgentTool("test", tool, callFn);
    const result = await agentTool.execute("call-2", {});

    expect(result.content[0].type).toBe("text");
    expect((result.content[0] as { type: "text"; text: string }).text).toContain("Error");
  });
});

describe("mcpToolsToAgentTools", () => {
  it("should convert multiple MCP tools", () => {
    const tools: McpToolDefinition[] = [
      { name: "read", description: "Read", inputSchema: { type: "object", properties: {} } },
      { name: "write", description: "Write", inputSchema: { type: "object", properties: {} } },
    ];

    const callFn = async () => ({
      content: [{ type: "text" as const, text: "ok" }],
    });

    const agentTools = mcpToolsToAgentTools("fs", tools, callFn);
    expect(agentTools).toHaveLength(2);
    expect(agentTools[0].name).toBe("mcp_fs_read");
    expect(agentTools[1].name).toBe("mcp_fs_write");
  });

  it("should handle empty tool list", () => {
    const callFn = async () => ({
      content: [{ type: "text" as const, text: "ok" }],
    });

    const agentTools = mcpToolsToAgentTools("empty", [], callFn);
    expect(agentTools).toHaveLength(0);
  });
});
