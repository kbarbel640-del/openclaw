import fs from "node:fs/promises";
import path from "node:path";
import type { PlannerSessionState, PlannerStoreFile } from "./types.js";

const STORE_RELATIVE_PATH = ["plugins", "evening-planner", "sessions.json"] as const;
const STORE_VERSION = 1;

function resolveStorePath(stateDir: string): string {
  return path.join(stateDir, ...STORE_RELATIVE_PATH);
}

function normalizeSession(entry: unknown): PlannerSessionState | null {
  if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
    return null;
  }
  const candidate = entry as PlannerSessionState;
  if (!candidate.id || !candidate.conversationId) {
    return null;
  }
  return candidate;
}

export async function readPlannerSessions(stateDir: string): Promise<Map<string, PlannerSessionState>> {
  const target = resolveStorePath(stateDir);
  try {
    const raw = await fs.readFile(target, "utf8");
    const parsed = JSON.parse(raw) as PlannerStoreFile;
    if (parsed.version !== STORE_VERSION || !Array.isArray(parsed.sessions)) {
      return new Map();
    }
    const map = new Map<string, PlannerSessionState>();
    for (const session of parsed.sessions) {
      const normalized = normalizeSession(session);
      if (normalized) {
        map.set(normalized.id, normalized);
      }
    }
    return map;
  } catch {
    return new Map();
  }
}

export async function writePlannerSessions(
  stateDir: string,
  sessions: Iterable<PlannerSessionState>,
): Promise<void> {
  const target = resolveStorePath(stateDir);
  await fs.mkdir(path.dirname(target), { recursive: true });
  const payload: PlannerStoreFile = {
    version: STORE_VERSION,
    sessions: Array.from(sessions),
  };
  await fs.writeFile(target, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
}

