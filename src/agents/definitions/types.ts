/**
 * Markdown-based agent definition types.
 *
 * Allows defining agent types via `.md` files with YAML frontmatter,
 * following the same pattern as the skill system.
 */

import type { AgentRole } from "../../config/types.agents.js";

/**
 * Parsed agent definition from a markdown file.
 *
 * Frontmatter fields map to the existing AgentConfig system:
 * ```yaml
 * ---
 * name: researcher
 * description: Deep research specialist
 * model: claude-sonnet-4-5
 * role: specialist
 * tools: [web-search, web-fetch, memory]
 * reasoning: true
 * capabilities: [research, analysis]
 * expertise: [academic papers, technical docs]
 * ---
 * You are a deep research specialist...
 * ```
 */
export type AgentDefinition = {
  /** Unique identifier derived from filename (e.g., "researcher" from "researcher.md"). */
  id: string;
  /** Display name from frontmatter (falls back to id). */
  name: string;
  /** Description of what this agent type does. */
  description?: string;
  /** Preferred model (provider/model-id). */
  model?: string;
  /** Hierarchy role. Default: "specialist". */
  role: AgentRole;
  /** Allowed tool names for this agent type. */
  tools?: string[];
  /** Whether this agent type benefits from extended reasoning. */
  reasoning?: boolean;
  /** Capability tags for routing. */
  capabilities?: string[];
  /** Domain expertise descriptions. */
  expertise?: string[];
  /** Skill names this agent should have access to. */
  skills?: string[];
  /** The markdown body (system prompt). */
  systemPrompt: string;
  /** Source file path for debugging/logging. */
  filePath: string;
};

/**
 * Result of loading agent definitions from disk.
 */
export type AgentDefinitionLoadResult = {
  definitions: AgentDefinition[];
  errors: Array<{ filePath: string; error: string }>;
};
