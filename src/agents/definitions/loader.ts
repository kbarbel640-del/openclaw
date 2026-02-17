/**
 * Markdown agent definition loader.
 *
 * Reads agent definition `.md` files from the agent definitions directory
 * and parses them into AgentDefinition objects.
 *
 * Directory layout:
 *   ~/.openclaw/agents/<agentId>/agent/definitions/*.md
 *   ~/.openclaw/definitions/*.md  (global, shared across agents)
 */

import fs from "node:fs";
import path from "node:path";
import type { AgentRole } from "../../config/types.agents.js";
import { parseFrontmatterBlock } from "../../markdown/frontmatter.js";
import type { AgentDefinition, AgentDefinitionLoadResult } from "./types.js";

const VALID_ROLES: Set<string> = new Set(["orchestrator", "lead", "specialist", "worker"]);
const MD_EXTENSION = ".md";

function normalizeStringList(raw: string | undefined): string[] {
  if (!raw) {
    return [];
  }
  let trimmed = raw.trim();
  // Strip surrounding brackets: [a, b, c] → a, b, c
  if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
    // Try JSON parse first for properly quoted arrays
    try {
      const parsed = JSON.parse(trimmed) as unknown;
      if (Array.isArray(parsed)) {
        return parsed.map((v) => String(v).trim()).filter(Boolean);
      }
    } catch {
      // Not valid JSON — strip brackets and fall through to comma split
    }
    trimmed = trimmed.slice(1, -1);
  }
  return trimmed
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);
}

function parseBooleanField(raw: string | undefined): boolean | undefined {
  if (!raw) {
    return undefined;
  }
  const lower = raw.trim().toLowerCase();
  if (lower === "true" || lower === "yes" || lower === "1") {
    return true;
  }
  if (lower === "false" || lower === "no" || lower === "0") {
    return false;
  }
  return undefined;
}

function extractBody(content: string): string {
  const normalized = content.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  if (!normalized.startsWith("---")) {
    return normalized.trim();
  }
  const endIndex = normalized.indexOf("\n---", 3);
  if (endIndex === -1) {
    return normalized.trim();
  }
  // Skip past the closing --- and any trailing newline
  const bodyStart = normalized.indexOf("\n", endIndex + 1);
  if (bodyStart === -1) {
    return "";
  }
  return normalized.slice(bodyStart + 1).trim();
}

/**
 * Parse a single agent definition markdown file.
 */
export function parseAgentDefinition(
  filePath: string,
  content: string,
): { ok: true; definition: AgentDefinition } | { ok: false; error: string } {
  const frontmatter = parseFrontmatterBlock(content);
  const body = extractBody(content);

  // id from filename
  const basename = path.basename(filePath, MD_EXTENSION);
  const id = basename.toLowerCase().replace(/[^a-z0-9_-]/g, "-");

  if (!id) {
    return { ok: false, error: "Could not derive agent id from filename" };
  }

  // name: explicit or derived from id
  const name = frontmatter.name?.trim() || id;

  // role: validated against known roles
  const roleRaw = frontmatter.role?.trim().toLowerCase();
  const role: AgentRole =
    roleRaw && VALID_ROLES.has(roleRaw) ? (roleRaw as AgentRole) : "specialist";

  // model
  const model = frontmatter.model?.trim() || undefined;

  // description
  const description = frontmatter.description?.trim() || undefined;

  // boolean fields
  const reasoning = parseBooleanField(frontmatter.reasoning);

  // list fields
  const tools = normalizeStringList(frontmatter.tools);
  const capabilities = normalizeStringList(frontmatter.capabilities);
  const expertise = normalizeStringList(frontmatter.expertise);
  const skills = normalizeStringList(frontmatter.skills);

  const definition: AgentDefinition = {
    id,
    name,
    description,
    model,
    role,
    systemPrompt: body,
    filePath,
  };

  if (tools.length > 0) {
    definition.tools = tools;
  }
  if (reasoning !== undefined) {
    definition.reasoning = reasoning;
  }
  if (capabilities.length > 0) {
    definition.capabilities = capabilities;
  }
  if (expertise.length > 0) {
    definition.expertise = expertise;
  }
  if (skills.length > 0) {
    definition.skills = skills;
  }

  return { ok: true, definition };
}

/**
 * Load all agent definitions from a directory.
 */
export function loadAgentDefinitionsFromDir(dirPath: string): AgentDefinitionLoadResult {
  const result: AgentDefinitionLoadResult = { definitions: [], errors: [] };

  if (!fs.existsSync(dirPath)) {
    return result;
  }

  let entries: string[];
  try {
    entries = fs.readdirSync(dirPath);
  } catch {
    return result;
  }

  for (const entry of entries) {
    if (!entry.endsWith(MD_EXTENSION)) {
      continue;
    }

    const filePath = path.join(dirPath, entry);

    // Skip directories
    try {
      const stat = fs.statSync(filePath);
      if (!stat.isFile()) {
        continue;
      }
    } catch {
      continue;
    }

    let content: string;
    try {
      content = fs.readFileSync(filePath, "utf-8");
    } catch (err) {
      result.errors.push({
        filePath,
        error: `Failed to read: ${err instanceof Error ? err.message : String(err)}`,
      });
      continue;
    }

    const parsed = parseAgentDefinition(filePath, content);
    if (parsed.ok) {
      result.definitions.push(parsed.definition);
    } else {
      result.errors.push({ filePath, error: parsed.error });
    }
  }

  return result;
}

/**
 * Load agent definitions from all standard locations for a given agent.
 *
 * Lookup order (later entries win on id collision):
 * 1. Global definitions: ~/.openclaw/definitions/
 * 2. Per-agent definitions: <agentDir>/definitions/
 */
export function loadAgentDefinitions(params: {
  stateDir: string;
  agentDir: string;
}): AgentDefinitionLoadResult {
  const { stateDir, agentDir } = params;

  const globalDir = path.join(stateDir, "definitions");
  const agentLocalDir = path.join(agentDir, "definitions");

  const globalResult = loadAgentDefinitionsFromDir(globalDir);
  const agentResult = loadAgentDefinitionsFromDir(agentLocalDir);

  // Merge: agent-local definitions override global ones by id
  const byId = new Map<string, AgentDefinition>();
  for (const def of globalResult.definitions) {
    byId.set(def.id, def);
  }
  for (const def of agentResult.definitions) {
    byId.set(def.id, def);
  }

  return {
    definitions: Array.from(byId.values()),
    errors: [...globalResult.errors, ...agentResult.errors],
  };
}
