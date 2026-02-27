import type { OpenClawConfig } from "../config/config.js";
import { onAgentEvent } from "../infra/agent-events.js";
import {
  incrementMappedByRunContextUsage,
  incrementMappedByStaticDispatchUsage,
  incrementUnmappedToolUsage,
  incrementMappedToolUsage,
  incrementSkillCommandUsage,
  registerSkillsUsageEntries,
} from "./skills-usage-store.js";
import { buildWorkspaceSkillCommandSpecs } from "./skills.js";

const toolToSkills = new Map<string, Set<string>>();
const runToolCalls = new Map<string, { seenToolCallIds: Set<string>; updatedAtMs: number }>();
const runContext = new Map<string, { skillName: string; updatedAtMs: number }>();
const pendingSessionContext = new Map<string, { skillName: string; updatedAtMs: number }>();
let trackerUnsubscribe: (() => void) | null = null;
const DEFAULT_TRACKER_TTL_MS = 30 * 60 * 1000;
const DEFAULT_TRACKER_MAX_RUNS = 2000;
let trackerTtlMs = DEFAULT_TRACKER_TTL_MS;
let trackerMaxRuns = DEFAULT_TRACKER_MAX_RUNS;

function normalizeToolName(value: string): string {
  return value.trim().toLowerCase();
}

function nowMs(): number {
  return Date.now();
}

function pruneRunCache(now: number) {
  const ttlThreshold = now - Math.max(0, trackerTtlMs);
  for (const [runId, entry] of runToolCalls) {
    if (entry.updatedAtMs < ttlThreshold) {
      runToolCalls.delete(runId);
      runContext.delete(runId);
    }
  }
  for (const [sessionKey, entry] of pendingSessionContext) {
    if (entry.updatedAtMs < ttlThreshold) {
      pendingSessionContext.delete(sessionKey);
    }
  }
  if (runToolCalls.size <= trackerMaxRuns) {
    return;
  }
  const sortedOldestFirst = Array.from(runToolCalls.entries()).toSorted(
    (a, b) => a[1].updatedAtMs - b[1].updatedAtMs,
  );
  const overflowCount = runToolCalls.size - trackerMaxRuns;
  for (let index = 0; index < overflowCount; index += 1) {
    const runId = sortedOldestFirst[index]?.[0];
    if (runId) {
      runToolCalls.delete(runId);
      runContext.delete(runId);
    }
  }
}

function registerToolDispatchMappings(
  workspaceDir: string,
  config: OpenClawConfig,
  skillFilter?: string[],
) {
  const commands = buildWorkspaceSkillCommandSpecs(workspaceDir, {
    config,
    skillFilter,
  });
  const discoveredSkills = new Set<string>();
  for (const command of commands) {
    discoveredSkills.add(command.skillName);
    if (command.dispatch?.kind !== "tool") {
      continue;
    }
    const toolName = normalizeToolName(command.dispatch.toolName);
    if (!toolName) {
      continue;
    }
    const mapped = toolToSkills.get(toolName) ?? new Set<string>();
    mapped.add(command.skillName);
    toolToSkills.set(toolName, mapped);
  }
  if (discoveredSkills.size > 0) {
    void registerSkillsUsageEntries(Array.from(discoveredSkills));
  }
  pruneRunCache(nowMs());
}

function registerRunContext(params: { runId?: string; sessionKey?: string; skillName: string }) {
  const skillName = params.skillName.trim();
  if (!skillName) {
    return;
  }
  const now = nowMs();
  if (params.runId?.trim()) {
    runContext.set(params.runId.trim(), { skillName, updatedAtMs: now });
  }
  if (params.sessionKey?.trim()) {
    pendingSessionContext.set(params.sessionKey.trim(), { skillName, updatedAtMs: now });
  }
}

function ensureTrackerSubscribed() {
  if (trackerUnsubscribe) {
    return;
  }
  trackerUnsubscribe = onAgentEvent((evt) => {
    const now = nowMs();
    pruneRunCache(now);

    if (evt.stream === "lifecycle") {
      const phase = typeof evt.data.phase === "string" ? evt.data.phase : "";
      const sessionKey = typeof evt.sessionKey === "string" ? evt.sessionKey.trim() : "";
      if (phase === "start" && sessionKey) {
        const pending = pendingSessionContext.get(sessionKey);
        if (pending) {
          runContext.set(evt.runId, { skillName: pending.skillName, updatedAtMs: now });
          pendingSessionContext.delete(sessionKey);
        }
      }
      if (phase === "end" || phase === "error") {
        runToolCalls.delete(evt.runId);
        runContext.delete(evt.runId);
      }
      return;
    }

    if (evt.stream === "tool") {
      const phase = typeof evt.data.phase === "string" ? evt.data.phase : "";
      if (phase !== "result") {
        return;
      }
      const toolCallId = typeof evt.data.toolCallId === "string" ? evt.data.toolCallId.trim() : "";
      const toolNameRaw = typeof evt.data.name === "string" ? evt.data.name : "";
      const toolName = normalizeToolName(toolNameRaw);
      if (!toolCallId || !toolName) {
        return;
      }
      const cacheEntry = runToolCalls.get(evt.runId) ?? {
        seenToolCallIds: new Set<string>(),
        updatedAtMs: now,
      };
      if (cacheEntry.seenToolCallIds.has(toolCallId)) {
        cacheEntry.updatedAtMs = now;
        runToolCalls.set(evt.runId, cacheEntry);
        return;
      }
      cacheEntry.seenToolCallIds.add(toolCallId);
      cacheEntry.updatedAtMs = now;
      runToolCalls.set(evt.runId, cacheEntry);
      const context = runContext.get(evt.runId);
      if (context?.skillName) {
        context.updatedAtMs = now;
        runContext.set(evt.runId, context);
        void incrementMappedByRunContextUsage(1);
        void incrementMappedToolUsage([context.skillName]);
        return;
      }
      const mappedSkills = toolToSkills.get(toolName);
      if (!mappedSkills || mappedSkills.size === 0) {
        void incrementUnmappedToolUsage(1);
        return;
      }
      void incrementMappedByStaticDispatchUsage(1);
      void incrementMappedToolUsage(Array.from(mappedSkills));
      return;
    }
  });
}

export function trackSkillCommandInvocation(
  skillName: string,
  context?: { runId?: string; sessionKey?: string },
) {
  const name = skillName.trim();
  if (!name) {
    return;
  }
  registerRunContext({ skillName: name, runId: context?.runId, sessionKey: context?.sessionKey });
  void incrementSkillCommandUsage(name);
}

export function registerSkillsUsageTracking(params: {
  workspaceDir: string;
  config: OpenClawConfig;
  skillFilter?: string[];
}) {
  ensureTrackerSubscribed();
  registerToolDispatchMappings(params.workspaceDir, params.config, params.skillFilter);
}

export function getSkillsUsageTrackerDiagnostics() {
  return {
    mappedTools: toolToSkills.size,
    runCacheEntries: runToolCalls.size,
    runContextEntries: runContext.size,
    pendingSessionContextEntries: pendingSessionContext.size,
    ttlMs: trackerTtlMs,
    maxRuns: trackerMaxRuns,
  };
}

export function __resetSkillsUsageTrackerForTest() {
  if (trackerUnsubscribe) {
    trackerUnsubscribe();
    trackerUnsubscribe = null;
  }
  toolToSkills.clear();
  runToolCalls.clear();
  runContext.clear();
  pendingSessionContext.clear();
  trackerTtlMs = DEFAULT_TRACKER_TTL_MS;
  trackerMaxRuns = DEFAULT_TRACKER_MAX_RUNS;
}

export function __configureSkillsUsageTrackerForTest(config: { ttlMs?: number; maxRuns?: number }) {
  if (typeof config.ttlMs === "number" && Number.isFinite(config.ttlMs) && config.ttlMs >= 0) {
    trackerTtlMs = config.ttlMs;
  }
  if (typeof config.maxRuns === "number" && Number.isFinite(config.maxRuns) && config.maxRuns > 0) {
    trackerMaxRuns = Math.floor(config.maxRuns);
  }
}
