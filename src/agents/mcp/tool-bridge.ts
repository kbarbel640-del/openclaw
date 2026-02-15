/**
 * MCP Tool Bridge.
 *
 * Converts MCP tool definitions into Pi-AI AgentTool format,
 * bridging the two tool systems.
 */

import type { AgentTool, AgentToolResult } from "@mariozechner/pi-agent-core";
import { Type } from "@sinclair/typebox";
import type { AnyAgentTool } from "../tools/common.js";
import type { McpToolDefinition, McpToolCallResult } from "./types.js";

type McpToolCallFn = (
  serverName: string,
  toolName: string,
  params: Record<string, unknown>,
) => Promise<McpToolCallResult>;

/**
 * Convert a JSON Schema object to a TypeBox schema.
 *
 * Uses Type.Unsafe for pass-through since MCP schemas are already
 * JSON Schema and TypeBox just wraps them for the Pi-AI runtime.
 */
function jsonSchemaToTypeBox(schema: Record<string, unknown>) {
  // TypeBox Unsafe wraps a raw JSON Schema — the Pi-AI runtime
  // serializes it as-is for the LLM provider.
  return Type.Unsafe(schema);
}

/**
 * Format MCP tool call result into AgentToolResult text content.
 */
function formatMcpResult(result: McpToolCallResult): AgentToolResult<unknown> {
  const textParts = result.content
    .filter((c): c is { type: "text"; text: string } => c.type === "text")
    .map((c) => c.text);

  const text = textParts.join("\n") || "(no output)";

  if (result.isError) {
    return {
      content: [{ type: "text", text: `Error: ${text}` }],
      details: { isError: true },
    };
  }

  return {
    content: [{ type: "text", text }],
    details: {},
  };
}

/**
 * Convert an MCP tool definition to a Pi-AI AgentTool.
 *
 * @param serverName - The MCP server name (used as namespace prefix)
 * @param tool - The MCP tool definition
 * @param callFn - Function to invoke the tool on the MCP server
 */
export function mcpToolToAgentTool(
  serverName: string,
  tool: McpToolDefinition,
  callFn: McpToolCallFn,
): AnyAgentTool {
  const namespacedName = `mcp_${serverName}_${tool.name}`;
  const description = tool.description || `MCP tool: ${tool.name} (${serverName})`;

  const parameters = jsonSchemaToTypeBox(tool.inputSchema || { type: "object", properties: {} });

  const agentTool: AgentTool<typeof parameters, unknown> = {
    name: namespacedName,
    description,
    parameters,
    label: `MCP: ${serverName}/${tool.name}`,
    execute: async (_toolCallId, params) => {
      const result = await callFn(serverName, tool.name, params as Record<string, unknown>);
      return formatMcpResult(result);
    },
  };

  return agentTool as AnyAgentTool;
}

/**
 * Convert all tools from an MCP server to Pi-AI AgentTools.
 */
export function mcpToolsToAgentTools(
  serverName: string,
  tools: McpToolDefinition[],
  callFn: McpToolCallFn,
): AnyAgentTool[] {
  return tools.map((tool) => mcpToolToAgentTool(serverName, tool, callFn));
}
