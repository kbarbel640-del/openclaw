/**
 * MCP Config File Writer
 *
 * Generates a `claude-mcp-cloudru.json` file compatible with
 * `claude --mcp-config <path>`. The file contains only MCP server
 * URLs (SSE transport) — the Bearer token is injected via env var
 * in the CLI backend config, NOT stored in the JSON file.
 */

import { promises as fs } from "node:fs";
import path from "node:path";
import type { McpServer } from "../ai-fabric/types.js";

export const CLOUDRU_MCP_CONFIG_FILENAME = "claude-mcp-cloudru.json";
const CLOUDRU_MCP_BASE_URL = "https://ai-agents.api.cloud.ru/mcp";

export type McpConfigEntry = {
  url: string;
  transport: "sse";
};

export type ClaudeMcpConfig = {
  mcpServers: Record<string, McpConfigEntry>;
};

/**
 * Build the claude MCP config object from selected MCP servers.
 */
export function buildMcpConfig(servers: McpServer[]): ClaudeMcpConfig {
  const mcpServers: Record<string, McpConfigEntry> = {};
  for (const server of servers) {
    mcpServers[server.name] = {
      url: `${CLOUDRU_MCP_BASE_URL}/${server.id}`,
      transport: "sse",
    };
  }
  return { mcpServers };
}

/**
 * Write the MCP config file to the workspace directory.
 * Returns the absolute path of the written file.
 */
export async function writeMcpConfigFile(params: {
  workspaceDir: string;
  servers: McpServer[];
}): Promise<string> {
  const config = buildMcpConfig(params.servers);
  const filePath = path.join(params.workspaceDir, CLOUDRU_MCP_CONFIG_FILENAME);
  await fs.writeFile(filePath, `${JSON.stringify(config, null, 2)}\n`, "utf-8");
  return filePath;
}

/**
 * Append `--mcp-config` and `--strict-mcp-config` to CLI backend args.
 * Idempotent: skips if args already contain the flags.
 */
export function appendMcpConfigArgs(
  existingArgs: string[] | undefined,
  mcpConfigPath: string,
): string[] {
  const args = [...(existingArgs ?? [])];
  if (!args.includes("--strict-mcp-config")) {
    args.push("--strict-mcp-config");
  }
  if (!args.includes("--mcp-config")) {
    args.push("--mcp-config", mcpConfigPath);
  }
  return args;
}
