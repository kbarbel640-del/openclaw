/**
 * Claude CLI Workspace Sync
 *
 * Syncs OpenClaw skills as `.claude/commands/*.md` and MCP servers
 * into `.claude/settings.json` so the `claude` CLI natively discovers them.
 *
 * Designed for reuse: each function is independently callable with
 * explicit params — no hidden singletons or global state.
 */

import { promises as fsp } from "node:fs";
import path from "node:path";
import type { McpConfigEntry } from "../../commands/write-mcp-config.js";
import type { OpenClawConfig } from "../../config/config.js";
import type { SkillEligibilityContext, SkillEntry } from "./types.js";
import { createSubsystemLogger } from "../../logging/subsystem.js";
import { serializeByKey } from "./serialize.js";
import { loadWorkspaceSkillEntries, filterWorkspaceSkillEntries } from "./workspace.js";

const log = createSubsystemLogger("claude-sync");

/** Marker placed at the top of synced files so we can identify and clean them. */
export const SYNC_MARKER = "<!-- openclaw-synced -->";

// ---------------------------------------------------------------------------
// Frontmatter stripping (no external YAML dep needed)
// ---------------------------------------------------------------------------

/**
 * Strip YAML frontmatter (`---…---`) from a markdown string.
 * Returns the body without leading blank lines.
 */
export function stripFrontmatter(content: string): string {
  if (!content.startsWith("---")) return content;
  const endIndex = content.indexOf("\n---", 3);
  if (endIndex === -1) return content;
  return content.slice(endIndex + 4).replace(/^\n+/, "");
}

// ---------------------------------------------------------------------------
// Skills → .claude/commands/*.md
// ---------------------------------------------------------------------------

export type SyncSkillsResult = { synced: number; skipped: number };

/**
 * Sync eligible OpenClaw skills to `<workspaceDir>/.claude/commands/` as
 * individual `.md` files that the `claude` CLI discovers as slash commands.
 *
 * - Files are tagged with {@link SYNC_MARKER} so manual commands survive cleanup.
 * - Serialized per-workspace to prevent concurrent writes.
 */
export async function syncSkillsToClaudeCommands(params: {
  workspaceDir: string;
  config?: OpenClawConfig;
  managedSkillsDir?: string;
  bundledSkillsDir?: string;
  eligibility?: SkillEligibilityContext;
}): Promise<SyncSkillsResult> {
  const { workspaceDir, config, managedSkillsDir, bundledSkillsDir, eligibility } = params;

  return serializeByKey(`claudeSync:skills:${workspaceDir}`, async () => {
    const entries = loadWorkspaceSkillEntries(workspaceDir, {
      config,
      managedSkillsDir,
      bundledSkillsDir,
    });
    const eligible = filterWorkspaceSkillEntries(entries, config);
    const filtered = eligibility
      ? eligible.filter(() => true) // eligibility already applied via filterWorkspaceSkillEntries
      : eligible;

    const commandsDir = path.join(workspaceDir, ".claude", "commands");
    await fsp.mkdir(commandsDir, { recursive: true });

    // Build set of expected filenames
    const expectedFiles = new Set<string>();
    for (const entry of filtered) {
      expectedFiles.add(safeFilename(entry.skill.name) + ".md");
    }

    // Clean stale synced files (only those with our marker)
    await cleanStaleSyncedFiles(commandsDir, expectedFiles);

    let synced = 0;
    let skipped = 0;
    for (const entry of filtered) {
      try {
        const written = await writeSkillCommandFile(commandsDir, entry);
        if (written) synced++;
        else skipped++;
      } catch (err) {
        log.warn(`failed to sync skill "${entry.skill.name}": ${String(err)}`);
        skipped++;
      }
    }

    log.debug(`synced ${synced} skills to ${commandsDir} (${skipped} skipped)`);
    return { synced, skipped };
  });
}

// ---------------------------------------------------------------------------
// MCP → .mcp.json + permissions → .claude/settings.json
// ---------------------------------------------------------------------------

/**
 * Convert a {@link McpConfigEntry} (`transport: "sse"`) to the format
 * Claude CLI expects (`type: "sse"`).
 */
function toClaudeMcpEntry(entry: McpConfigEntry): Record<string, unknown> {
  const { transport, ...rest } = entry;
  return { ...rest, type: transport };
}

/**
 * Sync MCP server entries into the Claude CLI workspace:
 *
 * 1. Writes MCP servers to `<workspaceDir>/.mcp.json` (Claude CLI reads
 *    MCP config from this file, **not** `.claude/settings.json`).
 * 2. Writes `permissions.allow` entries to `<workspaceDir>/.claude/settings.json`
 *    so Claude CLI can call MCP tools without interactive prompting.
 *
 * Both writes are additive — existing keys are preserved.
 */
export async function syncMcpToClaudeSettings(params: {
  workspaceDir: string;
  mcpServers: Record<string, McpConfigEntry>;
}): Promise<void> {
  const mcpJsonPath = path.join(params.workspaceDir, ".mcp.json");
  const settingsPath = path.join(params.workspaceDir, ".claude", "settings.json");

  await serializeByKey(`claudeSync:mcp:${params.workspaceDir}`, async () => {
    // --- 1. Write MCP servers to .mcp.json ---
    let mcpJson: Record<string, unknown> = {};
    try {
      const raw = await fsp.readFile(mcpJsonPath, "utf-8");
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        mcpJson = parsed as Record<string, unknown>;
      }
    } catch (err) {
      if (isNodeError(err) && err.code === "ENOENT") {
        // File doesn't exist yet — start fresh
      } else {
        log.warn(`failed to parse ${mcpJsonPath}, starting fresh: ${String(err)}`);
      }
    }

    const existingMcp =
      mcpJson.mcpServers && typeof mcpJson.mcpServers === "object"
        ? (mcpJson.mcpServers as Record<string, unknown>)
        : {};

    const convertedServers: Record<string, unknown> = {};
    for (const [name, entry] of Object.entries(params.mcpServers)) {
      convertedServers[name] = toClaudeMcpEntry(entry);
    }
    mcpJson.mcpServers = { ...existingMcp, ...convertedServers };

    await fsp.writeFile(mcpJsonPath, JSON.stringify(mcpJson, null, 2) + "\n", "utf-8");
    log.debug(`merged ${Object.keys(params.mcpServers).length} MCP servers into ${mcpJsonPath}`);

    // --- 2. Write permissions to .claude/settings.json ---
    const serverNames = Object.keys(params.mcpServers);
    if (serverNames.length > 0) {
      await fsp.mkdir(path.dirname(settingsPath), { recursive: true });

      let settings: Record<string, unknown> = {};
      try {
        const raw = await fsp.readFile(settingsPath, "utf-8");
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
          settings = parsed as Record<string, unknown>;
        }
      } catch (err) {
        if (isNodeError(err) && err.code === "ENOENT") {
          // File doesn't exist yet
        } else {
          log.warn(`failed to parse ${settingsPath}, starting fresh: ${String(err)}`);
        }
      }

      const permissions =
        settings.permissions && typeof settings.permissions === "object"
          ? (settings.permissions as Record<string, unknown>)
          : {};
      const existingAllow = Array.isArray(permissions.allow) ? (permissions.allow as string[]) : [];
      const allowSet = new Set(existingAllow);
      for (const name of serverNames) {
        allowSet.add(`mcp__${name}`);
      }
      permissions.allow = [...allowSet];
      settings.permissions = permissions;

      await fsp.writeFile(settingsPath, JSON.stringify(settings, null, 2) + "\n", "utf-8");
      log.debug(`wrote ${serverNames.length} MCP permissions into ${settingsPath}`);
    }
  });
}

// ---------------------------------------------------------------------------
// MCP removal from .mcp.json + permissions from .claude/settings.json
// ---------------------------------------------------------------------------

/**
 * Remove specified MCP server keys from `<workspaceDir>/.mcp.json`
 * and their corresponding `permissions.allow` entries from
 * `<workspaceDir>/.claude/settings.json`.
 *
 * Returns the number of MCP keys actually removed. Safe to call when the
 * files do not exist — returns 0.
 */
export async function removeFabricMcpFromClaudeSettings(params: {
  workspaceDir: string;
  serverNames: string[];
}): Promise<number> {
  const mcpJsonPath = path.join(params.workspaceDir, ".mcp.json");
  const settingsPath = path.join(params.workspaceDir, ".claude", "settings.json");

  return serializeByKey(`claudeSync:mcp:${params.workspaceDir}`, async () => {
    // --- 1. Remove servers from .mcp.json ---
    let mcpJson: Record<string, unknown> = {};
    try {
      const raw = await fsp.readFile(mcpJsonPath, "utf-8");
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        mcpJson = parsed as Record<string, unknown>;
      }
    } catch (err) {
      if (isNodeError(err) && err.code === "ENOENT") {
        return 0;
      }
      log.warn(`failed to parse ${mcpJsonPath}: ${String(err)}`);
      return 0;
    }

    const existingMcp =
      mcpJson.mcpServers && typeof mcpJson.mcpServers === "object"
        ? (mcpJson.mcpServers as Record<string, unknown>)
        : {};

    let removed = 0;
    for (const name of params.serverNames) {
      if (name in existingMcp) {
        delete existingMcp[name];
        removed++;
      }
    }

    if (removed > 0) {
      mcpJson.mcpServers = existingMcp;
      await fsp.writeFile(mcpJsonPath, JSON.stringify(mcpJson, null, 2) + "\n", "utf-8");
      log.debug(`removed ${removed} MCP servers from ${mcpJsonPath}`);

      // --- 2. Remove permissions from .claude/settings.json ---
      try {
        const raw = await fsp.readFile(settingsPath, "utf-8");
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
          const settings = parsed as Record<string, unknown>;
          const permissions =
            settings.permissions && typeof settings.permissions === "object"
              ? (settings.permissions as Record<string, unknown>)
              : {};
          if (Array.isArray(permissions.allow)) {
            const removePrefixes = params.serverNames.map((n) => `mcp__${n}`);
            permissions.allow = (permissions.allow as string[]).filter(
              (rule) =>
                !removePrefixes.some((prefix) => rule === prefix || rule.startsWith(prefix + "__")),
            );
            settings.permissions = permissions;
            await fsp.writeFile(settingsPath, JSON.stringify(settings, null, 2) + "\n", "utf-8");
            log.debug(`removed MCP permissions from ${settingsPath}`);
          }
        }
      } catch {
        // settings.json may not exist — that's fine
      }
    }

    return removed;
  });
}

// ---------------------------------------------------------------------------
// Combined entry point
// ---------------------------------------------------------------------------

/**
 * Sync both skills and MCP servers to the Claude CLI workspace.
 * Fire-and-forget safe — errors are logged, not thrown.
 */
export async function syncClaudeWorkspaceIntegrations(params: {
  workspaceDir: string;
  config?: OpenClawConfig;
}): Promise<void> {
  const { workspaceDir, config } = params;

  try {
    await syncSkillsToClaudeCommands({ workspaceDir, config });
  } catch (err) {
    log.warn(`skills sync failed: ${String(err)}`);
  }

  try {
    const mcpConfigPath = config?.aiFabric?.mcpConfigPath;
    if (mcpConfigPath) {
      const raw = await fsp.readFile(mcpConfigPath, "utf-8");
      const parsed = JSON.parse(raw) as { mcpServers?: Record<string, McpConfigEntry> };
      if (parsed.mcpServers && Object.keys(parsed.mcpServers).length > 0) {
        await syncMcpToClaudeSettings({ workspaceDir, mcpServers: parsed.mcpServers });
      }
    }
  } catch (err) {
    log.warn(`MCP sync failed: ${String(err)}`);
  }
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Sanitize a skill name into a safe filename (no path traversal).
 * Keeps kebab-case, strips anything suspicious.
 */
export function safeFilename(name: string): string {
  return path.basename(name).replace(/[^a-zA-Z0-9_-]/g, "_");
}

async function writeSkillCommandFile(commandsDir: string, entry: SkillEntry): Promise<boolean> {
  const filename = safeFilename(entry.skill.name) + ".md";
  const destPath = path.join(commandsDir, filename);

  let rawContent: string;
  try {
    rawContent = await fsp.readFile(entry.skill.filePath, "utf-8");
  } catch {
    return false;
  }

  const body = stripFrontmatter(rawContent);
  const description = entry.skill.description?.trim() || entry.skill.name;
  const content = `${SYNC_MARKER}\n${description}\n\n${body}`;

  await fsp.writeFile(destPath, content, "utf-8");
  return true;
}

async function cleanStaleSyncedFiles(
  commandsDir: string,
  expectedFiles: Set<string>,
): Promise<void> {
  let existing: string[];
  try {
    existing = await fsp.readdir(commandsDir);
  } catch {
    return; // directory doesn't exist yet
  }

  for (const file of existing) {
    if (!file.endsWith(".md")) continue;
    if (expectedFiles.has(file)) continue;

    const filePath = path.join(commandsDir, file);
    try {
      const head = await readFileHead(filePath, SYNC_MARKER.length + 1);
      if (head.startsWith(SYNC_MARKER)) {
        await fsp.unlink(filePath);
        log.debug(`removed stale synced command: ${file}`);
      }
    } catch {
      // ignore unreadable files
    }
  }
}

async function readFileHead(filePath: string, bytes: number): Promise<string> {
  const fd = await fsp.open(filePath, "r");
  try {
    const buf = Buffer.alloc(bytes);
    const { bytesRead } = await fd.read(buf, 0, bytes, 0);
    return buf.toString("utf-8", 0, bytesRead);
  } finally {
    await fd.close();
  }
}

function isNodeError(err: unknown): err is NodeJS.ErrnoException {
  return err instanceof Error && "code" in err;
}
