/**
 * Markdown command definition loader.
 *
 * Reads command definition `.md` files from standard locations
 * and parses them into CommandDefinition objects.
 *
 * Directory layout:
 *   ~/.openclaw/commands/*.md  (global commands)
 *   .openclaw/commands/*.md    (workspace-local commands)
 */

import fs from "node:fs";
import path from "node:path";
import { parseFrontmatterBlock } from "../../markdown/frontmatter.js";
import { parseBooleanValue } from "../../utils/boolean.js";
import type { CommandDefinition, CommandDefinitionLoadResult } from "./types.js";

const MD_EXTENSION = ".md";

function normalizeStringList(raw: string | undefined): string[] {
  if (!raw) {
    return [];
  }
  let trimmed = raw.trim();
  if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
    try {
      const parsed = JSON.parse(trimmed) as unknown;
      if (Array.isArray(parsed)) {
        return parsed.map((v) => String(v).trim()).filter(Boolean);
      }
    } catch {
      // Strip brackets and fall through
    }
    trimmed = trimmed.slice(1, -1);
  }
  return trimmed
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);
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
  const bodyStart = normalized.indexOf("\n", endIndex + 1);
  if (bodyStart === -1) {
    return "";
  }
  return normalized.slice(bodyStart + 1).trim();
}

/**
 * Parse a single command definition markdown file.
 */
export function parseCommandDefinition(
  filePath: string,
  content: string,
): { ok: true; command: CommandDefinition } | { ok: false; error: string } {
  const frontmatter = parseFrontmatterBlock(content);
  const body = extractBody(content);

  // Derive command name from filename
  const basename = path.basename(filePath, MD_EXTENSION);
  const derivedName = basename.toLowerCase().replace(/[^a-z0-9_-]/g, "-");

  const name =
    frontmatter.name
      ?.trim()
      .toLowerCase()
      .replace(/[^a-z0-9_-]/g, "-") || derivedName;

  if (!name) {
    return { ok: false, error: "Could not derive command name from filename" };
  }

  if (!body) {
    return { ok: false, error: "Command definition has no prompt template (empty body)" };
  }

  const description = frontmatter.description?.trim() || `Run /${name}`;

  // Boolean fields
  const userInvocableRaw = parseBooleanValue(frontmatter["user-invocable"]);
  const userInvocable = userInvocableRaw ?? true;

  const acceptsArgsRaw = parseBooleanValue(frontmatter["accepts-args"]);
  const acceptsArgs = acceptsArgsRaw ?? true;

  // Model
  const model = frontmatter.model?.trim() || undefined;

  // Tool allowlist
  const allowedTools = normalizeStringList(frontmatter["allowed-tools"]);

  const command: CommandDefinition = {
    name,
    description,
    userInvocable,
    acceptsArgs,
    promptTemplate: body,
    filePath,
  };

  if (model) {
    command.model = model;
  }
  if (allowedTools.length > 0) {
    command.allowedTools = allowedTools;
  }

  return { ok: true, command };
}

/**
 * Load all command definitions from a directory.
 */
export function loadCommandDefinitionsFromDir(dirPath: string): CommandDefinitionLoadResult {
  const result: CommandDefinitionLoadResult = { commands: [], errors: [] };

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

    const parsed = parseCommandDefinition(filePath, content);
    if (parsed.ok) {
      result.commands.push(parsed.command);
    } else {
      result.errors.push({ filePath, error: parsed.error });
    }
  }

  return result;
}

/**
 * Load command definitions from all standard locations.
 *
 * Lookup order (later entries win on name collision):
 * 1. Global commands: ~/.openclaw/commands/
 * 2. Workspace commands: .openclaw/commands/ (cwd-relative)
 */
export function loadCommandDefinitions(params: {
  stateDir: string;
  workspaceDir?: string;
}): CommandDefinitionLoadResult {
  const { stateDir, workspaceDir } = params;

  const globalDir = path.join(stateDir, "commands");
  const workspaceLocalDir = workspaceDir
    ? path.join(workspaceDir, ".openclaw", "commands")
    : undefined;

  const globalResult = loadCommandDefinitionsFromDir(globalDir);
  const workspaceResult = workspaceLocalDir
    ? loadCommandDefinitionsFromDir(workspaceLocalDir)
    : { commands: [], errors: [] };

  // Merge: workspace-local commands override global ones by name
  const byName = new Map<string, CommandDefinition>();
  for (const cmd of globalResult.commands) {
    byName.set(cmd.name, cmd);
  }
  for (const cmd of workspaceResult.commands) {
    byName.set(cmd.name, cmd);
  }

  return {
    commands: Array.from(byName.values()),
    errors: [...globalResult.errors, ...workspaceResult.errors],
  };
}
