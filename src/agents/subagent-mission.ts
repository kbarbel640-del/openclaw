import crypto from "node:crypto";
import { loadConfig } from "../config/config.js";
import { callGateway } from "../gateway/call.js";
import { parseAgentSessionKey } from "../routing/session-key.js";
import { type DeliveryContext, normalizeDeliveryContext } from "../utils/delivery-context.js";
import { resolveAgentConfig } from "./agent-scope.js";
import { AGENT_LANE_SUBAGENT } from "./lanes.js";
import {
  buildSubagentSystemPrompt,
  maybeQueueSubagentAnnounce,
  type SubagentRunOutcome,
} from "./subagent-announce.js";
import { loadMissionsFromDisk, saveMissionsToDisk } from "./subagent-mission.store.js";
import { registerSubagentRun, setRunCompletionInterceptor } from "./subagent-registry.js";
import {
  extractTranscriptSummary,
  formatTranscriptForRetry,
} from "./subagent-transcript-summary.js";
import { readLatestAssistantReply } from "./tools/agent-step.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type MissionSubtaskInput = {
  id: string;
  agentId: string;
  task: string;
  after?: string[];
};

export type SubtaskStatus = "pending" | "running" | "ok" | "error" | "skipped";

export type SubtaskRecord = {
  id: string;
  agentId: string;
  originalTask: string;
  effectiveTask?: string;
  after: string[];
  status: SubtaskStatus;
  runId?: string;
  childSessionKey?: string;
  result?: string;
  outcome?: SubagentRunOutcome;
  retryCount: number;
  maxRetries: number;
  startedAt?: number;
  endedAt?: number;
};

export type MissionStatus = "running" | "completed" | "partial" | "failed";

export type MissionRecord = {
  missionId: string;
  label: string;
  requesterSessionKey: string;
  requesterOrigin?: DeliveryContext;
  requesterDisplayKey: string;
  subtasks: Map<string, SubtaskRecord>;
  executionOrder: string[];
  status: MissionStatus;
  createdAt: number;
  completedAt?: number;
  totalSpawns: number;
  maxTotalSpawns: number;
  announced: boolean;
  cleanup: "delete" | "keep";
};

// ---------------------------------------------------------------------------
// State stores
// ---------------------------------------------------------------------------

const missions = new Map<string, MissionRecord>();
const runIdToMission = new Map<string, { missionId: string; subtaskId: string }>();

function persistMissions() {
  try {
    saveMissionsToDisk(missions);
  } catch {
    // ignore persistence failures
  }
}

// ---------------------------------------------------------------------------
// DAG validation — Kahn's topological sort
// ---------------------------------------------------------------------------

function validateSubtaskDAG(
  subtasks: MissionSubtaskInput[],
): { ok: true; order: string[] } | { ok: false; error: string } {
  const ids = new Set(subtasks.map((s) => s.id));

  // Check duplicate IDs
  if (ids.size !== subtasks.length) {
    const seen = new Set<string>();
    for (const s of subtasks) {
      if (seen.has(s.id)) {
        return { ok: false, error: `Duplicate subtask id: "${s.id}"` };
      }
      seen.add(s.id);
    }
  }

  // Check unknown references
  for (const s of subtasks) {
    for (const dep of s.after ?? []) {
      if (!ids.has(dep)) {
        return {
          ok: false,
          error: `Subtask "${s.id}" depends on unknown id "${dep}"`,
        };
      }
    }
  }

  // Kahn's algorithm
  const inDegree = new Map<string, number>();
  const adjacency = new Map<string, string[]>();
  for (const s of subtasks) {
    inDegree.set(s.id, 0);
    adjacency.set(s.id, []);
  }
  for (const s of subtasks) {
    for (const dep of s.after ?? []) {
      adjacency.get(dep)!.push(s.id);
      inDegree.set(s.id, (inDegree.get(s.id) ?? 0) + 1);
    }
  }

  const queue: string[] = [];
  for (const [id, deg] of inDegree.entries()) {
    if (deg === 0) queue.push(id);
  }

  const order: string[] = [];
  while (queue.length > 0) {
    const current = queue.shift()!;
    order.push(current);
    for (const neighbor of adjacency.get(current) ?? []) {
      const newDeg = (inDegree.get(neighbor) ?? 1) - 1;
      inDegree.set(neighbor, newDeg);
      if (newDeg === 0) queue.push(neighbor);
    }
  }

  if (order.length !== subtasks.length) {
    return { ok: false, error: "Cycle detected in subtask dependencies" };
  }

  return { ok: true, order };
}

// ---------------------------------------------------------------------------
// Result injection
// ---------------------------------------------------------------------------

function buildTaskWithInjectedResults(mission: MissionRecord, subtask: SubtaskRecord): string {
  const deps = subtask.after;
  if (deps.length === 0) {
    return subtask.originalTask;
  }

  const sections: string[] = [];
  for (const depId of deps) {
    const dep = mission.subtasks.get(depId);
    if (!dep || dep.status !== "ok" || !dep.result) continue;
    sections.push(`## Results from "${depId}" (${dep.agentId})\n${dep.result}`);
  }

  if (sections.length === 0) {
    return subtask.originalTask;
  }

  return [
    "# Context: Results from prerequisite tasks",
    "",
    ...sections,
    "",
    "---",
    "",
    "# Your Task",
    subtask.originalTask,
  ].join("\n");
}

// ---------------------------------------------------------------------------
// Subtask spawning
// ---------------------------------------------------------------------------

async function spawnSubtask(mission: MissionRecord, subtask: SubtaskRecord): Promise<void> {
  const cfg = loadConfig();
  const targetAgentConfig = resolveAgentConfig(cfg, subtask.agentId);
  const directive = targetAgentConfig?.taskDirective?.trim();

  const taskWithResults = buildTaskWithInjectedResults(mission, subtask);
  subtask.effectiveTask = taskWithResults;

  const effectiveTask = directive ? `${taskWithResults}\n\n---\n\n${directive}` : taskWithResults;

  const childSessionKey = `agent:${subtask.agentId}:subagent:${crypto.randomUUID()}`;
  subtask.childSessionKey = childSessionKey;

  const requesterOrigin = normalizeDeliveryContext(mission.requesterOrigin);

  const subtaskLabel = `${mission.label}/${subtask.id}`;
  const childSystemPrompt = buildSubagentSystemPrompt({
    requesterSessionKey: mission.requesterSessionKey,
    requesterOrigin,
    childSessionKey,
    label: subtaskLabel,
    task: taskWithResults,
  });

  const childIdem = crypto.randomUUID();
  let childRunId = childIdem;
  try {
    const response = await callGateway<{ runId: string }>({
      method: "agent",
      params: {
        message: effectiveTask,
        sessionKey: childSessionKey,
        idempotencyKey: childIdem,
        deliver: false,
        lane: AGENT_LANE_SUBAGENT,
        extraSystemPrompt: childSystemPrompt,
      },
      timeoutMs: 10_000,
    });
    if (typeof response?.runId === "string" && response.runId) {
      childRunId = response.runId;
    }
  } catch {
    subtask.status = "error";
    subtask.outcome = { status: "error", error: "spawn failed" };
    subtask.endedAt = Date.now();
    skipDependentSubtasks(mission, subtask.id);
    persistMissions();
    return;
  }

  subtask.runId = childRunId;
  subtask.status = "running";
  subtask.startedAt = Date.now();
  mission.totalSpawns++;

  // Register in the subagent registry with maxRetries=0 — mission handles retries
  registerSubagentRun({
    runId: childRunId,
    childSessionKey,
    requesterSessionKey: mission.requesterSessionKey,
    requesterOrigin: mission.requesterOrigin,
    requesterDisplayKey: mission.requesterDisplayKey,
    task: taskWithResults,
    cleanup: mission.cleanup,
    label: subtaskLabel,
    maxRetries: 0,
    originalTask: subtask.originalTask,
  });

  // Index for interceptor lookup
  runIdToMission.set(childRunId, {
    missionId: mission.missionId,
    subtaskId: subtask.id,
  });

  persistMissions();
}

// ---------------------------------------------------------------------------
// Retry
// ---------------------------------------------------------------------------

function shouldRetrySubtask(mission: MissionRecord, subtask: SubtaskRecord): boolean {
  return subtask.retryCount < subtask.maxRetries && mission.totalSpawns < mission.maxTotalSpawns;
}

async function retrySubtask(mission: MissionRecord, subtask: SubtaskRecord): Promise<void> {
  subtask.retryCount++;

  // Extract transcript from failed session
  const summary = subtask.childSessionKey
    ? await extractTranscriptSummary({ sessionKey: subtask.childSessionKey })
    : { toolCalls: [], toolErrorCount: 0, lastAssistantText: undefined, totalMessages: 0 };

  const retryTask = formatTranscriptForRetry({
    originalTask: subtask.originalTask,
    summary,
    retryNumber: subtask.retryCount,
    maxRetries: subtask.maxRetries,
    failureReason: subtask.outcome?.error,
  });

  // Inject dependency results into retry task too
  const deps = subtask.after;
  let taskWithContext = retryTask;
  if (deps.length > 0) {
    const sections: string[] = [];
    for (const depId of deps) {
      const dep = mission.subtasks.get(depId);
      if (!dep || dep.status !== "ok" || !dep.result) continue;
      sections.push(`## Results from "${depId}" (${dep.agentId})\n${dep.result}`);
    }
    if (sections.length > 0) {
      taskWithContext = [
        "# Context: Results from prerequisite tasks",
        "",
        ...sections,
        "",
        "---",
        "",
        retryTask,
      ].join("\n");
    }
  }

  const cfg = loadConfig();
  const targetAgentConfig = resolveAgentConfig(cfg, subtask.agentId);
  const directive = targetAgentConfig?.taskDirective?.trim();
  const effectiveTask = directive ? `${taskWithContext}\n\n---\n\n${directive}` : taskWithContext;

  const childSessionKey = `agent:${subtask.agentId}:subagent:${crypto.randomUUID()}`;
  subtask.childSessionKey = childSessionKey;

  const requesterOrigin = normalizeDeliveryContext(mission.requesterOrigin);
  const retryLabel = `${mission.label}/${subtask.id} (retry ${subtask.retryCount})`;
  const childSystemPrompt = buildSubagentSystemPrompt({
    requesterSessionKey: mission.requesterSessionKey,
    requesterOrigin,
    childSessionKey,
    label: retryLabel,
    task: taskWithContext,
  });

  const childIdem = crypto.randomUUID();
  let childRunId = childIdem;
  try {
    const response = await callGateway<{ runId: string }>({
      method: "agent",
      params: {
        message: effectiveTask,
        sessionKey: childSessionKey,
        idempotencyKey: childIdem,
        deliver: false,
        lane: AGENT_LANE_SUBAGENT,
        extraSystemPrompt: childSystemPrompt,
      },
      timeoutMs: 10_000,
    });
    if (typeof response?.runId === "string" && response.runId) {
      childRunId = response.runId;
    }
  } catch {
    subtask.status = "error";
    subtask.outcome = { status: "error", error: "retry spawn failed" };
    subtask.endedAt = Date.now();
    skipDependentSubtasks(mission, subtask.id);
    persistMissions();
    return;
  }

  // Unindex old runId
  if (subtask.runId) {
    runIdToMission.delete(subtask.runId);
  }

  subtask.runId = childRunId;
  subtask.status = "running";
  subtask.startedAt = Date.now();
  subtask.endedAt = undefined;
  subtask.outcome = undefined;
  subtask.result = undefined;
  mission.totalSpawns++;

  registerSubagentRun({
    runId: childRunId,
    childSessionKey,
    requesterSessionKey: mission.requesterSessionKey,
    requesterOrigin: mission.requesterOrigin,
    requesterDisplayKey: mission.requesterDisplayKey,
    task: taskWithContext,
    cleanup: mission.cleanup,
    label: `${mission.label}/${subtask.id}`,
    maxRetries: 0,
    originalTask: subtask.originalTask,
  });

  runIdToMission.set(childRunId, {
    missionId: mission.missionId,
    subtaskId: subtask.id,
  });

  persistMissions();
}

// ---------------------------------------------------------------------------
// Skip dependents
// ---------------------------------------------------------------------------

function skipDependentSubtasks(mission: MissionRecord, failedId: string) {
  // Transitively mark all dependents as skipped
  const toSkip = new Set<string>();
  const queue = [failedId];
  while (queue.length > 0) {
    const current = queue.shift()!;
    for (const [, subtask] of mission.subtasks) {
      if (
        subtask.after.includes(current) &&
        subtask.status === "pending" &&
        !toSkip.has(subtask.id)
      ) {
        toSkip.add(subtask.id);
        queue.push(subtask.id);
      }
    }
  }
  for (const id of toSkip) {
    const subtask = mission.subtasks.get(id);
    if (subtask) {
      subtask.status = "skipped";
      subtask.endedAt = Date.now();
    }
  }
}

// ---------------------------------------------------------------------------
// Mission advancement
// ---------------------------------------------------------------------------

function advanceMission(mission: MissionRecord) {
  for (const id of mission.executionOrder) {
    const subtask = mission.subtasks.get(id);
    if (!subtask || subtask.status !== "pending") continue;

    const deps = subtask.after;
    const allOk = deps.every((depId) => {
      const dep = mission.subtasks.get(depId);
      return dep?.status === "ok";
    });
    const anyFailed = deps.some((depId) => {
      const dep = mission.subtasks.get(depId);
      return dep?.status === "error" || dep?.status === "skipped";
    });

    if (anyFailed) {
      subtask.status = "skipped";
      subtask.endedAt = Date.now();
      skipDependentSubtasks(mission, subtask.id);
      continue;
    }

    if (allOk) {
      void spawnSubtask(mission, subtask);
    }
  }
  persistMissions();
}

// ---------------------------------------------------------------------------
// Mission completion check
// ---------------------------------------------------------------------------

function checkMissionCompletion(mission: MissionRecord) {
  const statuses = [...mission.subtasks.values()].map((s) => s.status);
  const allTerminal = statuses.every((s) => s === "ok" || s === "error" || s === "skipped");
  if (!allTerminal) return;

  const allOk = statuses.every((s) => s === "ok");
  const allFailed = statuses.every((s) => s === "error" || s === "skipped");

  if (allOk) {
    mission.status = "completed";
  } else if (allFailed) {
    mission.status = "failed";
  } else {
    mission.status = "partial";
  }
  mission.completedAt = Date.now();
  persistMissions();

  if (!mission.announced) {
    void announceMissionResult(mission);
  }
}

// ---------------------------------------------------------------------------
// Announce
// ---------------------------------------------------------------------------

async function announceMissionResult(mission: MissionRecord) {
  mission.announced = true;
  persistMissions();

  const statusLabel =
    mission.status === "completed"
      ? "completed successfully"
      : mission.status === "partial"
        ? "partially completed (some subtasks failed)"
        : "failed";

  const sections: string[] = [`Mission "${mission.label}" ${statusLabel}.`, ""];

  for (const id of mission.executionOrder) {
    const subtask = mission.subtasks.get(id);
    if (!subtask) continue;

    const statusEmoji =
      subtask.status === "ok"
        ? "[OK]"
        : subtask.status === "error"
          ? "[FAIL]"
          : subtask.status === "skipped"
            ? "[SKIP]"
            : "[?]";

    sections.push(`## ${statusEmoji} ${id} (${subtask.agentId})`);
    if (subtask.result) {
      sections.push(subtask.result);
    } else if (subtask.status === "error") {
      sections.push(`Error: ${subtask.outcome?.error ?? "unknown"}`);
    } else if (subtask.status === "skipped") {
      sections.push("Skipped due to failed dependency.");
    }
    sections.push("");
  }

  sections.push(
    "Synthesize these results for the user. Keep it concise.",
    "Do not mention technical details like tokens, stats, or that these were background tasks.",
    "You can respond with NO_REPLY if no announcement is needed.",
  );

  const triggerMessage = sections.join("\n");

  const queued = await maybeQueueSubagentAnnounce({
    requesterSessionKey: mission.requesterSessionKey,
    triggerMessage,
    summaryLine: mission.label,
    requesterOrigin: mission.requesterOrigin,
  });

  if (queued !== "none") return;

  // Direct send
  const requesterOrigin = normalizeDeliveryContext(mission.requesterOrigin);
  try {
    await callGateway({
      method: "agent",
      params: {
        sessionKey: mission.requesterSessionKey,
        message: triggerMessage,
        deliver: true,
        channel: requesterOrigin?.channel,
        accountId: requesterOrigin?.accountId,
        to: requesterOrigin?.to,
        threadId:
          requesterOrigin?.threadId != null && requesterOrigin.threadId !== ""
            ? String(requesterOrigin.threadId)
            : undefined,
        idempotencyKey: crypto.randomUUID(),
      },
      expectFinal: true,
      timeoutMs: 60_000,
    });
  } catch {
    // Best-effort announce
  }
}

// ---------------------------------------------------------------------------
// Interceptor callback — handles subtask completion from registry
// ---------------------------------------------------------------------------

async function handleSubtaskCompletion(
  missionId: string,
  subtaskId: string,
  entry: {
    outcome?: SubagentRunOutcome;
    startedAt?: number;
    endedAt?: number;
    childSessionKey: string;
  },
) {
  const mission = missions.get(missionId);
  if (!mission) return;

  const subtask = mission.subtasks.get(subtaskId);
  if (!subtask) return;

  subtask.endedAt = entry.endedAt ?? Date.now();
  subtask.outcome = entry.outcome;

  if (entry.outcome?.status === "ok") {
    // Read the result
    try {
      subtask.result = await readLatestAssistantReply({
        sessionKey: entry.childSessionKey,
      });
    } catch {
      // Proceed without result text
    }
    subtask.status = "ok";
    persistMissions();
    advanceMission(mission);
    checkMissionCompletion(mission);
  } else {
    // Failure — retry or mark error
    if (shouldRetrySubtask(mission, subtask)) {
      await retrySubtask(mission, subtask);
    } else {
      subtask.status = "error";
      skipDependentSubtasks(mission, subtask.id);
      persistMissions();
      advanceMission(mission);
      checkMissionCompletion(mission);
    }
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function createMission(params: {
  label: string;
  subtasks: MissionSubtaskInput[];
  requesterSessionKey: string;
  requesterOrigin?: DeliveryContext;
  requesterDisplayKey: string;
  cleanup?: "delete" | "keep";
  maxTotalSpawns?: number;
}): { missionId: string } | { error: string } {
  const dagResult = validateSubtaskDAG(params.subtasks);
  if (!dagResult.ok) {
    return { error: dagResult.error };
  }

  const cfg = loadConfig();
  const missionId = crypto.randomUUID();
  const subtaskMap = new Map<string, SubtaskRecord>();

  for (const input of params.subtasks) {
    const agentConfig = resolveAgentConfig(cfg, input.agentId);
    subtaskMap.set(input.id, {
      id: input.id,
      agentId: input.agentId,
      originalTask: input.task,
      after: input.after ?? [],
      status: "pending",
      retryCount: 0,
      maxRetries: agentConfig?.maxRetries ?? 0,
    });
  }

  const mission: MissionRecord = {
    missionId,
    label: params.label,
    requesterSessionKey: params.requesterSessionKey,
    requesterOrigin: normalizeDeliveryContext(params.requesterOrigin),
    requesterDisplayKey: params.requesterDisplayKey,
    subtasks: subtaskMap,
    executionOrder: dagResult.order,
    status: "running",
    createdAt: Date.now(),
    totalSpawns: 0,
    maxTotalSpawns: params.maxTotalSpawns ?? params.subtasks.length * 3,
    announced: false,
    cleanup: params.cleanup ?? "keep",
  };

  missions.set(missionId, mission);
  persistMissions();

  // Spawn root subtasks (no dependencies)
  advanceMission(mission);

  return { missionId };
}

export function findMissionByRunId(
  runId: string,
): { missionId: string; subtaskId: string } | undefined {
  return runIdToMission.get(runId);
}

export function getMission(missionId: string): MissionRecord | undefined {
  return missions.get(missionId);
}

export function initMissionSystem() {
  // Restore persisted missions
  try {
    const restored = loadMissionsFromDisk();
    for (const [id, mission] of restored.entries()) {
      if (!missions.has(id)) {
        missions.set(id, mission);
        // Rebuild runId index
        for (const [subtaskId, subtask] of mission.subtasks) {
          if (subtask.runId && subtask.status === "running") {
            runIdToMission.set(subtask.runId, {
              missionId: id,
              subtaskId,
            });
          }
        }
      }
    }
  } catch {
    // ignore restore failures
  }

  // Register the interceptor
  setRunCompletionInterceptor((runId, entry) => {
    const match = runIdToMission.get(runId);
    if (!match) return false;

    void handleSubtaskCompletion(match.missionId, match.subtaskId, entry);
    return true;
  });
}

export function resetMissionSystemForTests() {
  missions.clear();
  runIdToMission.clear();
  setRunCompletionInterceptor(null);
}
