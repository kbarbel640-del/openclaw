import fs from "node:fs/promises";
import path from "node:path";
import { TOOL_COST_USD } from "./constants.js";
import { parseJsonSafe, readFileIfExists } from "./normalize.js";
import type { UsageLogEntry } from "./types.js";

// In-memory budget tracker to prevent TOCTOU races on concurrent tool calls.
// Key: "workspaceDir::userSlug::dayPrefix", value: running total in USD.
const budgetTracker = new Map<string, number>();
const BUDGET_CACHE_CLEANUP_INTERVAL_MS = 300_000; // 5 minutes
let lastBudgetCleanupMs = Date.now();

function getBudgetKey(workspaceDir: string, userSlug: string, dayPrefix: string): string {
  return `${workspaceDir}::${userSlug}::${dayPrefix}`;
}

export async function getBudgetSpent(workspaceDir: string, userSlug: string, dayPrefix: string): Promise<number> {
  const key = getBudgetKey(workspaceDir, userSlug, dayPrefix);
  const cached = budgetTracker.get(key);
  if (cached !== undefined) {
    return cached;
  }
  // Cold start: read from file
  const fromFile = await readUsageForDay({ workspaceDir, userSlug, dayPrefix });
  budgetTracker.set(key, fromFile);
  return fromFile;
}

export function addBudgetSpent(workspaceDir: string, userSlug: string, dayPrefix: string, amount: number): void {
  const key = getBudgetKey(workspaceDir, userSlug, dayPrefix);
  const current = budgetTracker.get(key) ?? 0;
  budgetTracker.set(key, current + amount);
}

export function cleanupBudgetCache(today: string): void {
  const now = Date.now();
  if (now - lastBudgetCleanupMs > BUDGET_CACHE_CLEANUP_INTERVAL_MS) {
    lastBudgetCleanupMs = now;
    for (const key of budgetTracker.keys()) {
      if (!key.includes(today)) {
        budgetTracker.delete(key);
      }
    }
  }
}

export function estimateToolCostUsd(toolName: string): number {
  return TOOL_COST_USD[toolName] ?? 0.001;
}

const LOG_SENSITIVE_FIELDS = new Set(["content", "newText", "new_string", "text", "body"]);
const LOG_MAX_COMMAND_LENGTH = 500;

export function sanitizeParamsForLog(
  toolName: string,
  params?: Record<string, unknown>,
): Record<string, unknown> | undefined {
  if (!params) {
    return undefined;
  }
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(params)) {
    if (LOG_SENSITIVE_FIELDS.has(key)) {
      out[key] = typeof value === "string" ? `[${value.length} chars]` : "[redacted]";
    } else if (key === "command" && typeof value === "string" && value.length > LOG_MAX_COMMAND_LENGTH) {
      out[key] = value.slice(0, LOG_MAX_COMMAND_LENGTH) + "...[truncated]";
    } else if (key === "path" || key === "file_path") {
      out[key] = value; // keep paths — they are useful for audit
    } else {
      out[key] = value;
    }
  }
  return out;
}

export async function appendUsageLog(workspaceDir: string, payload: UsageLogEntry) {
  const logsDir = path.join(workspaceDir, "logs");
  await fs.mkdir(logsDir, { recursive: true });
  await fs.appendFile(path.join(logsDir, "usage.jsonl"), `${JSON.stringify(payload)}\n`, "utf-8");
}

export function utcDayPrefix(date = new Date()): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

async function readUsageForDay(params: {
  workspaceDir: string;
  userSlug: string;
  dayPrefix: string;
}): Promise<number> {
  const filePath = path.join(params.workspaceDir, "logs", "usage.jsonl");
  const raw = await readFileIfExists(filePath);
  if (!raw) {
    return 0;
  }
  let total = 0;
  for (const line of raw.split(/\r?\n/)) {
    if (!line.trim()) {
      continue;
    }
    const parsed = parseJsonSafe<UsageLogEntry>(line);
    if (!parsed) {
      continue;
    }
    if (parsed.user !== params.userSlug) {
      continue;
    }
    if (!parsed.ts.startsWith(params.dayPrefix)) {
      continue;
    }
    if (typeof parsed.estimatedCostUsd !== "number" || !Number.isFinite(parsed.estimatedCostUsd)) {
      continue;
    }
    total += parsed.estimatedCostUsd;
  }
  return total;
}
