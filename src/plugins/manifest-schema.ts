/**
 * Enhanced plugin manifest schema with Zod validation.
 *
 * Extends the existing plugin manifest with standardized fields
 * for commands, agents, hooks, skills, and MCP servers.
 */

import { z } from "zod";

/**
 * MCP server configuration within a plugin manifest.
 */
export const McpServerConfigSchema = z.object({
  command: z.string().describe("Executable command to start the MCP server"),
  args: z.array(z.string()).optional().describe("Arguments passed to the command"),
  env: z
    .record(z.string(), z.string())
    .optional()
    .describe("Environment variables (supports ${VAR} references)"),
});

export type McpServerConfig = z.infer<typeof McpServerConfigSchema>;

/**
 * Enhanced plugin manifest schema.
 *
 * All fields except `id` are optional for backward compatibility.
 * The `configSchema` field is required by the existing system.
 */
export const PluginManifestSchema = z.object({
  id: z.string().min(1).describe("Unique plugin identifier"),
  name: z.string().optional().describe("Display name"),
  description: z.string().optional().describe("Plugin description"),
  version: z.string().optional().describe("Semver version string"),
  kind: z.string().optional().describe("Plugin kind (e.g., 'memory')"),

  // Existing fields (preserved)
  configSchema: z
    .record(z.string(), z.unknown())
    .optional()
    .describe("JSON Schema for plugin config"),
  channels: z.array(z.string()).optional().describe("Channel IDs this plugin provides"),
  providers: z.array(z.string()).optional().describe("Provider IDs"),
  skills: z.array(z.string()).optional().describe("Skill directories (relative to plugin root)"),

  // New declarative fields
  commands: z.string().optional().describe("Commands directory (relative to plugin root)"),
  agents: z.string().optional().describe("Agent definitions directory (relative to plugin root)"),
  hooks: z
    .string()
    .optional()
    .describe("Hooks directory or hooks.json path (relative to plugin root)"),

  // MCP server declarations
  mcpServers: z
    .record(z.string(), McpServerConfigSchema)
    .optional()
    .describe("Named MCP server configurations"),

  // UI hints (existing)
  uiHints: z.record(z.string(), z.unknown()).optional().describe("UI hints for config fields"),
});

export type EnhancedPluginManifest = z.infer<typeof PluginManifestSchema>;

/**
 * Validate and parse a raw plugin manifest object.
 *
 * Returns the parsed manifest or an error message.
 */
export function validatePluginManifest(
  raw: unknown,
): { ok: true; manifest: EnhancedPluginManifest } | { ok: false; error: string } {
  const result = PluginManifestSchema.safeParse(raw);
  if (result.success) {
    return { ok: true, manifest: result.data };
  }
  const issues = result.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
  return { ok: false, error: `Invalid plugin manifest: ${issues}` };
}
