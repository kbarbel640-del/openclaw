import type { Dirent } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import type { SharedContextConfig } from "../config/types.agents.js";

/**
 * Shared context data item stored for multi-agent collaboration.
 */
export type SharedContextItem = {
  /** Unique key for this context item. */
  key: string;
  /** JSON-serializable value stored in this context. */
  value: unknown;
  /** Agent ID that owns this context item. */
  ownerId: string;
  /** Timestamp when this item was created. */
  createdAt: string;
  /** Timestamp when this item was last updated. */
  updatedAt: string;
};

/**
 * Options for accessing shared context.
 */
export type SharedContextOptions = {
  /** Agent ID requesting access. */
  agentId: string;
  /** Session ID for session-scoped context (optional). */
  sessionId?: string;
  /** Context scope: "session" or "global". Defaults to "global". */
  scope?: "session" | "global";
};

/**
 * Check if an agent has permission to access another agent's shared context.
 */
export function canAccessSharedContext(
  requestingAgentId: string,
  ownerConfig: SharedContextConfig | undefined,
): boolean {
  // No config or disabled = no access
  if (!ownerConfig || !ownerConfig.enabled) {
    return false;
  }

  // No allowAgents = no access
  if (!ownerConfig.allowAgents || ownerConfig.allowAgents.length === 0) {
    return false;
  }

  // Wildcard allows any agent
  if (ownerConfig.allowAgents.includes("*")) {
    return true;
  }

  // Explicit agent ID match
  return ownerConfig.allowAgents.includes(requestingAgentId);
}

/**
 * Get the file path for a shared context item.
 */
function getContextFilePath(
  stateDir: string,
  ownerId: string,
  key: string,
  options: SharedContextOptions,
): string {
  const scope = options.scope ?? "global";
  const baseDir = path.join(stateDir, "agents", "shared-context", ownerId);

  if (scope === "session" && options.sessionId) {
    return path.join(baseDir, "session", options.sessionId, `${key}.json`);
  }

  return path.join(baseDir, "global", `${key}.json`);
}

/**
 * Get a shared context item.
 */
export async function getSharedContextItem(
  stateDir: string,
  ownerId: string,
  key: string,
  options: SharedContextOptions,
): Promise<SharedContextItem | null> {
  const filePath = getContextFilePath(stateDir, ownerId, key, options);

  try {
    const data = await fs.readFile(filePath, "utf-8");
    return JSON.parse(data) as SharedContextItem;
  } catch (err) {
    const code = (err as { code?: string }).code;
    if (code === "ENOENT") {
      return null;
    }
    throw err;
  }
}

/**
 * Set a shared context item.
 */
export async function setSharedContextItem(
  stateDir: string,
  ownerId: string,
  key: string,
  value: unknown,
  options: SharedContextOptions,
): Promise<SharedContextItem> {
  const filePath = getContextFilePath(stateDir, ownerId, key, options);
  const now = new Date().toISOString();

  // Check if item exists to determine createdAt
  let createdAt = now;
  const existing = await getSharedContextItem(stateDir, ownerId, key, options);
  if (existing) {
    createdAt = existing.createdAt;
  }

  const item: SharedContextItem = {
    key,
    value,
    ownerId,
    createdAt,
    updatedAt: now,
  };

  // Ensure directory exists
  const dir = path.dirname(filePath);
  await fs.mkdir(dir, { recursive: true });

  // Write item to file
  await fs.writeFile(filePath, JSON.stringify(item, null, 2), "utf-8");

  return item;
}

/**
 * Delete a shared context item.
 */
export async function deleteSharedContextItem(
  stateDir: string,
  ownerId: string,
  key: string,
  options: SharedContextOptions,
): Promise<boolean> {
  const filePath = getContextFilePath(stateDir, ownerId, key, options);

  try {
    await fs.unlink(filePath);
    return true;
  } catch (err) {
    const code = (err as { code?: string }).code;
    if (code === "ENOENT") {
      return false;
    }
    throw err;
  }
}

/**
 * List all shared context keys for an agent.
 */
export async function listSharedContextKeys(
  stateDir: string,
  ownerId: string,
  options: SharedContextOptions,
): Promise<string[]> {
  const scope = options.scope ?? "global";
  const baseDir = path.join(stateDir, "agents", "shared-context", ownerId);

  let dir: string;
  if (scope === "session" && options.sessionId) {
    dir = path.join(baseDir, "session", options.sessionId);
  } else {
    dir = path.join(baseDir, "global");
  }

  let entries: Dirent[] = [];
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch (err) {
    const code = (err as { code?: string }).code;
    if (code === "ENOENT") {
      return [];
    }
    throw err;
  }

  return entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
    .map((entry) => entry.name.replace(/\.json$/, ""))
    .toSorted((a, b) => a.localeCompare(b));
}

/**
 * Clear all shared context for an agent (optionally filtered by scope).
 */
export async function clearSharedContext(
  stateDir: string,
  ownerId: string,
  options?: { scope?: "session" | "global"; sessionId?: string },
): Promise<number> {
  const baseDir = path.join(stateDir, "agents", "shared-context", ownerId);
  let deletedCount = 0;

  // If scope is specified, only clear that scope
  if (options?.scope === "session" && options.sessionId) {
    const sessionDir = path.join(baseDir, "session", options.sessionId);
    try {
      await fs.rm(sessionDir, { recursive: true });
      deletedCount = 1; // Approximation - we don't count individual files
    } catch (err) {
      const code = (err as { code?: string }).code;
      if (code !== "ENOENT") {
        throw err;
      }
    }
  } else if (options?.scope === "global") {
    const globalDir = path.join(baseDir, "global");
    try {
      await fs.rm(globalDir, { recursive: true });
      deletedCount = 1;
    } catch (err) {
      const code = (err as { code?: string }).code;
      if (code !== "ENOENT") {
        throw err;
      }
    }
  } else {
    // Clear all context for the agent
    try {
      await fs.rm(baseDir, { recursive: true });
      deletedCount = 1;
    } catch (err) {
      const code = (err as { code?: string }).code;
      if (code !== "ENOENT") {
        throw err;
      }
    }
  }

  return deletedCount;
}
