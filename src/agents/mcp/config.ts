/**
 * MCP configuration loader.
 *
 * Reads mcp.json from the agent directory to determine
 * which MCP servers should be started.
 */

import fs from "node:fs";
import path from "node:path";
import type { McpConfig, McpServerConfig } from "./types.js";

const MCP_CONFIG_FILENAME = "mcp.json";

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function resolveEnvValue(value: string): string {
  // Replace ${VAR} references with environment variable values
  return value.replace(/\$\{([^}]+)\}/g, (_, varName: string) => {
    return process.env[varName] ?? "";
  });
}

function resolveServerEnv(
  env: Record<string, string> | undefined,
): Record<string, string> | undefined {
  if (!env) {
    return undefined;
  }
  const resolved: Record<string, string> = {};
  for (const [key, value] of Object.entries(env)) {
    resolved[key] = resolveEnvValue(value);
  }
  return resolved;
}

function parseServerConfig(raw: unknown): McpServerConfig | null {
  if (!isRecord(raw)) {
    return null;
  }

  const command = typeof raw.command === "string" ? raw.command.trim() : "";
  if (!command) {
    return null;
  }

  const args = Array.isArray(raw.args)
    ? raw.args.filter((a): a is string => typeof a === "string")
    : undefined;

  let env: Record<string, string> | undefined;
  if (isRecord(raw.env)) {
    env = {};
    for (const [key, value] of Object.entries(raw.env)) {
      if (typeof value === "string") {
        env[key] = value;
      }
    }
  }

  return { command, args, env };
}

/**
 * Load MCP configuration from an agent directory.
 *
 * Returns null if no mcp.json exists.
 */
export function loadMcpConfig(agentDir: string): McpConfig | null {
  const configPath = path.join(agentDir, MCP_CONFIG_FILENAME);
  if (!fs.existsSync(configPath)) {
    return null;
  }

  let raw: unknown;
  try {
    raw = JSON.parse(fs.readFileSync(configPath, "utf-8")) as unknown;
  } catch {
    return null;
  }

  if (!isRecord(raw) || !isRecord(raw.servers)) {
    return null;
  }

  const servers: Record<string, McpServerConfig> = {};
  for (const [name, serverRaw] of Object.entries(raw.servers)) {
    const config = parseServerConfig(serverRaw);
    if (config) {
      // Resolve env variable references
      config.env = resolveServerEnv(config.env);
      servers[name] = config;
    }
  }

  return { servers };
}

/**
 * Check if an agent has MCP configuration.
 */
export function hasMcpConfig(agentDir: string): boolean {
  return fs.existsSync(path.join(agentDir, MCP_CONFIG_FILENAME));
}
