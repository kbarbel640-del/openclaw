import { exec } from "node:child_process";
import { promisify } from "node:util";
import { logVerbose } from "../globals.js";
import type { AnyAgentTool } from "./tools/common.js";

const execAsync = promisify(exec);

/**
 * Validate MCP server name to prevent command injection
 */
export function validateServerName(name: string): boolean {
  return /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,63}$/.test(name);
}

/**
 * Validate MCP tool name to prevent command injection
 */
export function validateToolName(name: string): boolean {
  return /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,63}$/.test(name);
}

/**
 * Escape shell argument to prevent command injection (internal use)
 */
function escapeShellArg(arg: string): string {
  return arg.replace(/['"\\$`!]/g, '');
}

export type McpToolDefinition = {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
};

export type McpServerInfo = {
  name: string;
  description?: string;
  tools: Array<{
    name: string;
    description?: string;
    schema?: Record<string, unknown>;
  }>;
};

export type DiscoverMcpToolsResult = {
  success: boolean;
  count: number;
  servers: McpServerInfo[];
  tools: McpToolDefinition[];
  error?: string;
};

/**
 * Format tool parameters for mcporter CLI
 * Converts { limit: 5, team: 'ENG' } to "limit=5 team=ENG"
 */
function formatParamsForCli(params: Record<string, unknown>): string {
  return Object.entries(params)
    .map(([key, value]) => {
      const stringValue = typeof value === "string" ? value : JSON.stringify(value);
      return `${key}=${stringValue}`;
    })
    .join(" ");
}

/**
 * Discover MCP servers via mcporter list command
 */
export async function discoverMcpServers(): Promise<{
  success: boolean;
  servers: McpServerInfo[];
  error?: string;
}> {
  try {
    const { stdout, stderr } = await execAsync("mcporter list --json", {
      timeout: 30000, // 30s timeout
    });

    if (stderr && !stderr.includes("Downloading")) {
      logVerbose(`mcporter list stderr: ${stderr}`);
    }

    const servers = JSON.parse(stdout.trim()) as McpServerInfo[];
    
    // Validate server names
    const validatedServers = servers.filter(s => validateServerName(s.name));
    if (validatedServers.length !== servers.length) {
      logVerbose(`Filtered out ${servers.length - validatedServers.length} servers with invalid names`);
    }
    
    return {
      success: true,
      servers: Array.isArray(validatedServers) ? validatedServers : [],
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      servers: [],
      error: message,
    };
  }
}

/**
 * Get detailed schema for a specific MCP server
 */
export async function getMcpServerSchema(serverName: string): Promise<{
  success: boolean;
  schema?: Record<string, unknown>;
  error?: string;
}> {
  try {
    const { stdout } = await execAsync(`mcporter list ${serverName} --schema --json`, {
      timeout: 30000,
    });

    const schema = JSON.parse(stdout.trim());
    return {
      success: true,
      schema,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      error: message,
    };
  }
}

/**
 * Call an MCP tool via mcporter
 */
export async function callMcpTool(
  serverName: string,
  toolName: string,
  params: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  // Validate inputs to prevent command injection
  if (!validateServerName(serverName)) {
    throw new Error(`Invalid server name: ${serverName}`, { cause: 'invalid_input' });
  }
  if (!validateToolName(toolName)) {
    throw new Error(`Invalid tool name: ${toolName}`, { cause: 'invalid_input' });
  }
  
  // Escape parameters
  const safeParams: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(params)) {
    const safeKey = escapeShellArg(key);
    const safeValue = typeof value === 'string' ? escapeShellArg(value) : value;
    safeParams[safeKey] = safeValue;
  }
  
  const args = formatParamsForCli(safeParams);
  const command = `mcporter call ${serverName}.${toolName} ${args} --output json`;

  try {
    const { stdout, stderr } = await execAsync(command, {
      timeout: 60000, // 60s timeout for tool calls
    });

    if (stderr && !stderr.includes("Downloading")) {
      logVerbose(`mcporter call stderr: ${stderr}`);
    }

    return JSON.parse(stdout.trim());
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`MCP tool call failed (${serverName}.${toolName}): ${message}`, {
      cause: error,
    });
  }
}

/**
 * Discover MCP tools and register them to an agent
 */
export async function discoverAndRegisterMcpTools(
  registerTool: (tool: AnyAgentTool) => Promise<void>,
): Promise<DiscoverMcpToolsResult> {
  // Step 1: Discover MCP servers
  const discoverResult = await discoverMcpServers();

  if (!discoverResult.success) {
    return {
      success: false,
      count: 0,
      servers: [],
      tools: [],
      error: discoverResult.error,
    };
  }

  const registeredTools: McpToolDefinition[] = [];
  const allServers: McpServerInfo[] = [];

  // Step 2: Register tools from each server
  for (const server of discoverResult.servers) {
    const tools = server.tools || [];
    if (tools.length === 0) {
      logVerbose(`MCP server ${server.name} has no tools, skipping`);
      continue;
    }

    allServers.push(server);

    for (const toolDef of tools) {
      try {
        // Create agent tool wrapper
        const agentTool: AnyAgentTool = {
          label: `MCP: ${server.name}`,
          name: `${server.name}.${toolDef.name}`,
          description: toolDef.description || `MCP tool from ${server.name}`,
          parameters: toolDef.schema || {},
          execute: async (_toolCallId, params) => {
            try {
              const result = await callMcpTool(server.name, toolDef.name, params);
              return {
                content: [{ type: "text" as const, text: JSON.stringify(result) }],
                details: result,
              } as any;
            } catch (error) {
              const message = error instanceof Error ? error.message : String(error);
              return {
                content: [{ type: "text" as const, text: `Error: ${message}` }],
                details: { error: message },
              } as any;
            }
          },
        };

        // Register to agent
        await registerTool(agentTool);
        registeredTools.push({
          name: agentTool.name,
          description: agentTool.description,
          parameters: agentTool.parameters as Record<string, unknown>,
        });

        logVerbose(`Registered MCP tool: ${server.name}.${toolDef.name}`);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        logVerbose(`Failed to register MCP tool ${server.name}.${toolDef.name}: ${message}`);
        // Continue with other tools even if one fails
      }
    }
  }

  return {
    success: true,
    count: registeredTools.length,
    servers: allServers,
    tools: registeredTools,
  };
}

/**
 * Get MCP status for CLI output
 */
export async function getMcpStatus(): Promise<{
  available: boolean;
  serverCount: number;
  toolCount: number;
  servers: McpServerInfo[];
  error?: string;
}> {
  const result = await discoverMcpServers();

  if (!result.success) {
    return {
      available: false,
      serverCount: 0,
      toolCount: 0,
      servers: [],
      error: result.error,
    };
  }

  const toolCount = result.servers.reduce((sum, server) => sum + (server.tools?.length || 0), 0);

  return {
    available: true,
    serverCount: result.servers.length,
    toolCount,
    servers: result.servers,
  };
}
