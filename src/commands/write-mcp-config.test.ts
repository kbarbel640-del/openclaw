import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { McpServer } from "../ai-fabric/types.js";
import {
  buildMcpConfig,
  writeMcpConfigFile,
  appendMcpConfigArgs,
  CLOUDRU_MCP_CONFIG_FILENAME,
} from "./write-mcp-config.js";

const SAMPLE_SERVERS: McpServer[] = [
  {
    id: "mcp-abc-123",
    name: "web-search",
    status: "RUNNING",
    tools: [{ name: "search", description: "Web search" }],
    createdAt: "2026-01-01T00:00:00Z",
  },
  {
    id: "mcp-def-456",
    name: "code-runner",
    status: "AVAILABLE",
    tools: [
      { name: "run", description: "Run code" },
      { name: "lint", description: "Lint code" },
    ],
    createdAt: "2026-01-02T00:00:00Z",
  },
];

describe("buildMcpConfig", () => {
  it("builds config with correct MCP server URLs", () => {
    const config = buildMcpConfig(SAMPLE_SERVERS);

    expect(config.mcpServers).toEqual({
      "web-search": {
        url: "https://ai-agents.api.cloud.ru/mcp/mcp-abc-123",
        transport: "sse",
      },
      "code-runner": {
        url: "https://ai-agents.api.cloud.ru/mcp/mcp-def-456",
        transport: "sse",
      },
    });
  });

  it("returns empty mcpServers for empty input", () => {
    const config = buildMcpConfig([]);
    expect(config.mcpServers).toEqual({});
  });
});

describe("writeMcpConfigFile", () => {
  let tmpDir: string;

  afterEach(async () => {
    if (tmpDir) {
      await fs.rm(tmpDir, { recursive: true, force: true });
    }
  });

  it("writes JSON file to workspace", async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "mcp-config-test-"));

    const filePath = await writeMcpConfigFile({
      workspaceDir: tmpDir,
      servers: SAMPLE_SERVERS,
    });

    expect(filePath).toBe(path.join(tmpDir, CLOUDRU_MCP_CONFIG_FILENAME));

    const content = JSON.parse(await fs.readFile(filePath, "utf-8"));
    expect(content.mcpServers["web-search"].url).toBe(
      "https://ai-agents.api.cloud.ru/mcp/mcp-abc-123",
    );
    expect(content.mcpServers["web-search"].transport).toBe("sse");
  });
});

describe("appendMcpConfigArgs", () => {
  it("appends --strict-mcp-config and --mcp-config", () => {
    const args = appendMcpConfigArgs(undefined, "/tmp/mcp.json");
    expect(args).toEqual(["--strict-mcp-config", "--mcp-config", "/tmp/mcp.json"]);
  });

  it("preserves existing args", () => {
    const args = appendMcpConfigArgs(["--verbose"], "/tmp/mcp.json");
    expect(args).toEqual(["--verbose", "--strict-mcp-config", "--mcp-config", "/tmp/mcp.json"]);
  });

  it("does not duplicate flags if already present", () => {
    const args = appendMcpConfigArgs(
      ["--strict-mcp-config", "--mcp-config", "/old.json"],
      "/new.json",
    );
    expect(args).toEqual(["--strict-mcp-config", "--mcp-config", "/old.json"]);
  });
});
