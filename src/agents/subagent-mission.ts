import { spawn } from "node:child_process";
import crypto from "node:crypto";
import { existsSync } from "node:fs";
import { appendFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { loadConfig } from "../config/config.js";
import { callGateway } from "../gateway/call.js";
import { createSubsystemLogger } from "../logging/subsystem.js";
import { createBrainMcpClient, type BrainMcpClient } from "../memory/brain-mcp-client.js";
import { parseAgentSessionKey } from "../routing/session-key.js";
import { type DeliveryContext, normalizeDeliveryContext } from "../utils/delivery-context.js";
import { resolveAgentConfig, resolveAgentWorkspaceDir } from "./agent-scope.js";
import { AGENT_LANE_SUBAGENT } from "./lanes.js";
import {
  buildSubagentSystemPrompt,
  maybeQueueSubagentAnnounce,
  type SubagentRunOutcome,
} from "./subagent-announce.js";
import { loadMissionsFromDisk, saveMissionsToDisk } from "./subagent-mission.store.js";
import {
  getSubagentRun,
  registerSubagentRun,
  setRunCompletionInterceptor,
} from "./subagent-registry.js";
import {
  extractTranscriptSummary,
  formatTranscriptForRetry,
} from "./subagent-transcript-summary.js";
import { markTaskByMission, parseMissionLabelForListId, startTaskByMission } from "./task-list.js";
import { readLatestAssistantReply } from "./tools/agent-step.js";

const log = createSubsystemLogger("mission");

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type MissionSubtaskInput = {
  id: string;
  agentId: string;
  task: string;
  after?: string[];
  maxLoops?: number;
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
  loopCount: number;
  maxLoops?: number;
  loopHistory: string[];
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

/** Resolve psql path once at import time — gateway's PATH may not include ~/bin. */
const PSQL_PATH =
  [
    `${process.env.HOME}/bin/psql`,
    "/Applications/Postgres.app/Contents/Versions/14/bin/psql",
    "/opt/homebrew/bin/psql",
    "/usr/local/bin/psql",
    "psql",
  ].find((p) => p === "psql" || existsSync(p)) ?? "psql";

// ---------------------------------------------------------------------------
// Triumph Learning Loop
// ---------------------------------------------------------------------------

/** Shared cross-agent knowledge store workspace ID */
const TRIUMPH_WORKSPACE_ID = "abe073d0-642f-4911-999d-18a5b8b24a5e";

/** Lazily-created Brain MCP client for triumph reads/writes */
let _missionBrainClient: BrainMcpClient | null = null;
function getMissionBrainClient(): BrainMcpClient {
  if (!_missionBrainClient) {
    const cfg = loadConfig();
    const mcporterPath = cfg.memory?.brainTiered?.mcporterPath ?? "mcporter";
    _missionBrainClient = createBrainMcpClient({ mcporterPath, timeoutMs: 5000 });
  }
  return _missionBrainClient;
}

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

  // Search triumph shared workspace for cross-agent knowledge (5s budget)
  // Uses smart_search (~200ms Brain-side, ~1s via mcporter) — vector + graph + rerank, no LLM rewrite.
  // Agent's own workspace is already covered by the existing Recalled Memory system.
  let memorySection = "";
  try {
    const brainClient = getMissionBrainClient();
    const queryText = subtask.originalTask.slice(0, 200);

    const triumphResults = await Promise.race([
      brainClient
        .smartSearch({ query: queryText, workspaceId: TRIUMPH_WORKSPACE_ID, limit: 3 })
        .then((r) => r.results.map((x) => `- ${x.content.slice(0, 200)}`))
        .catch(() => null),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 5000)),
    ]);

    if (triumphResults && triumphResults.length > 0) {
      memorySection = `## Team Knowledge\n\nThe following lessons were learned from previous missions. Apply any relevant insights to your current task — when making decisions, reference which lesson informed your choice.\n\n${triumphResults.join("\n")}\n\n---\n\n`;
    }
    log.info(
      `[triumph-inject] agent=${subtask.agentId} results=${triumphResults?.length ?? 0} memoryLen=${memorySection.length}`,
    );
  } catch (err) {
    log.warn(`[triumph-inject] failed for agent=${subtask.agentId}: ${err}`);
  }

  const effectiveTask = directive
    ? `${memorySection}${taskWithResults}\n\n---\n\n${directive}`
    : `${memorySection}${taskWithResults}`;

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

  // Auto-track: mark linked task list task as in_progress
  startTaskByMission(mission.missionId, subtask.id, subtask.agentId);

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

  // If mid-loop, reconstruct the loop-formatted task so the retry preserves loop context.
  // Otherwise use the bare originalTask.
  let effectiveOriginalTask = subtask.originalTask;
  if (subtask.loopCount > 0 && subtask.loopHistory.length > 0) {
    const lastResult = subtask.loopHistory[subtask.loopHistory.length - 1];
    effectiveOriginalTask = [
      `# Loop Iteration ${subtask.loopCount}/${subtask.maxLoops} (retrying after failure)`,
      "",
      "## Most Recent Iteration Result:",
      lastResult,
      "",
      "---",
      "",
      "# Original Task",
      subtask.originalTask,
      "",
      "---",
      "",
      "# Instructions",
      "You are retrying an iterative task after a failure. The previous result is shown above.",
      "CRITICAL: Do NOT assume the previous failure reason is correct. The previous iteration may have used wrong tool parameters or given up prematurely.",
      "ALWAYS verify by trying the action yourself — open the browser, navigate to the page, and attempt the task directly.",
      "Try a DIFFERENT approach — do not repeat steps that already failed.",
      "Focus on DOING the task (using tools, browser, etc.), not on reading files or searching memory.",
      "When the task is fully complete, end your response with: LOOP_DONE",
    ].join("\n");
  }

  const retryTask = formatTranscriptForRetry({
    originalTask: effectiveOriginalTask,
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
// Ralph Wiggum Loop — loop-until-done for iterative agent tasks
// ---------------------------------------------------------------------------

function shouldLoopSubtask(mission: MissionRecord, subtask: SubtaskRecord): boolean {
  // maxLoops semantics: undefined = no looping, 0 = unlimited (LOOP_DONE only), >0 = cap
  if (subtask.maxLoops == null) return false;
  if (subtask.maxLoops > 0 && subtask.loopCount >= subtask.maxLoops) return false;
  if (mission.totalSpawns >= mission.maxTotalSpawns) return false;
  // Early-exit sentinel: agent signals completion.
  // Anchor to last 200 chars to avoid false positives from mid-output mentions
  // like "I will not output LOOP_DONE yet".
  const tail = (subtask.result ?? "").slice(-200);
  if (/LOOP_DONE[^a-zA-Z0-9]*$/i.test(tail)) return false;
  return true;
}

async function loopSubtask(mission: MissionRecord, subtask: SubtaskRecord): Promise<void> {
  // Accumulate history from current iteration before clearing
  if (subtask.result) subtask.loopHistory.push(subtask.result);
  subtask.loopCount++;

  // Build loop context — only inject the LAST iteration's result to prevent context bloat.
  // Earlier iterations are stored in loopHistory but the agent should use Brain MCP for full history.
  const lastResult = subtask.loopHistory[subtask.loopHistory.length - 1];
  const priorCount = subtask.loopHistory.length - 1; // iterations before the last one

  const loopLabel =
    subtask.maxLoops != null && subtask.maxLoops > 0
      ? `${subtask.loopCount}/${subtask.maxLoops}`
      : `${subtask.loopCount}`;
  const contextLines: string[] = [`# Loop Iteration ${loopLabel}`, ""];

  if (priorCount > 0) {
    contextLines.push(`*${priorCount} earlier iteration(s) completed.*`, "");
  }

  if (lastResult) {
    contextLines.push("## Most Recent Iteration Result:", lastResult, "", "---", "");
  }

  contextLines.push(
    "# Original Task",
    subtask.originalTask,
    "",
    "---",
    "",
    "# Instructions",
    "You are continuing an iterative task. The previous iteration result is shown above.",
    "CRITICAL: Do NOT blindly trust the previous iteration's conclusions about what is 'blocked' or 'impossible'.",
    "Previous iterations may have used wrong tool parameters or given up too early.",
    "ALWAYS verify by trying the action yourself — open the browser, navigate to the page, and attempt the task directly.",
    "If the previous iteration did NOT complete the task, try a DIFFERENT approach — do not repeat the same steps.",
    "Focus on DOING the task (using tools, browser, etc.), not on reading files or searching memory.",
    "IMPORTANT: Once you have completed the main objective, say LOOP_DONE immediately. Do NOT start a verification step or re-check — just report what you did and end with LOOP_DONE.",
    "When the task is fully complete, end your response with: LOOP_DONE",
  );

  const isFinalIteration =
    subtask.maxLoops != null && subtask.maxLoops > 0 && subtask.loopCount >= subtask.maxLoops;
  if (isFinalIteration) {
    contextLines.push(
      "",
      "⚠️ **THIS IS YOUR FINAL ITERATION — NO MORE LOOPS AFTER THIS.**",
      "You MUST wrap up all remaining work NOW. Produce a comprehensive summary of ALL accumulated work from every iteration.",
      "End your response with: LOOP_DONE",
    );
  } else {
    contextLines.push(
      "Once you accomplish the main objective, summarize what you did and end with LOOP_DONE. Do NOT loop again just to verify — report your results and stop.",
      "If you need another iteration, continue working and the next iteration will start automatically.",
    );
  }

  const loopTask = contextLines.join("\n");

  // Re-inject dependency results (same pattern as retrySubtask)
  const deps = subtask.after;
  let taskWithContext = loopTask;
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
        loopTask,
      ].join("\n");
    }
  }

  // Apply taskDirective if configured
  const cfg = loadConfig();
  const targetAgentConfig = resolveAgentConfig(cfg, subtask.agentId);
  const directive = targetAgentConfig?.taskDirective?.trim();
  const effectiveTask = directive ? `${taskWithContext}\n\n---\n\n${directive}` : taskWithContext;

  // Spawn fresh session
  const childSessionKey = `agent:${subtask.agentId}:subagent:${crypto.randomUUID()}`;

  // Unindex old runId before reassigning
  if (subtask.runId) {
    runIdToMission.delete(subtask.runId);
  }

  subtask.childSessionKey = childSessionKey;
  subtask.outcome = undefined;
  subtask.result = undefined;
  subtask.status = "running";
  subtask.startedAt = Date.now();
  subtask.endedAt = undefined;
  mission.totalSpawns++;

  const requesterOrigin = normalizeDeliveryContext(mission.requesterOrigin);
  const spawnLabel = `${mission.label}/${subtask.id} (loop ${loopLabel})`;
  const childSystemPrompt = buildSubagentSystemPrompt({
    requesterSessionKey: mission.requesterSessionKey,
    requesterOrigin,
    childSessionKey,
    label: spawnLabel,
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
    subtask.outcome = { status: "error", error: "loop spawn failed" };
    subtask.endedAt = Date.now();
    skipDependentSubtasks(mission, subtask.id);
    persistMissions();
    return;
  }

  subtask.runId = childRunId;
  persistMissions();

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

  console.log(
    `[RALPH-WIGGUM-LOOP] 🔁 Loop ${loopLabel} for subtask "${subtask.id}" (agent: ${subtask.agentId}) in mission ${mission.missionId.slice(0, 8)}...`,
  );
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
// OMS status update
// ---------------------------------------------------------------------------

/**
 * Log a completed subtask spawn to oms.agent_work_log for productivity tracking.
 * Fire-and-forget — best-effort, never blocks mission flow.
 */
/**
 * Log Luna's orchestration time for a completed mission.
 * Duration = first subtask start → last subtask end (the window Luna was actively managing).
 */
function logMissionOrchestration(mission: MissionRecord): void {
  let earliest = Infinity;
  let latest = 0;
  let subtaskCount = 0;

  for (const subtask of mission.subtasks.values()) {
    if (subtask.startedAt && subtask.endedAt) {
      earliest = Math.min(earliest, subtask.startedAt);
      latest = Math.max(latest, subtask.endedAt);
      subtaskCount++;
    }
  }

  if (subtaskCount === 0 || earliest >= latest) return;
  const durationMs = latest - earliest;

  const startIso = new Date(earliest).toISOString();
  const endIso = new Date(latest).toISOString();
  const desc = `Orchestrated ${subtaskCount} subtask(s): ${mission.label}`
    .slice(0, 500)
    .replace(/'/g, "''");

  const sql =
    `INSERT INTO oms.agent_work_log (agent_id, work_type, source_id, duration_ms, started_at, ended_at, status, description, mission_id) ` +
    `VALUES ('luna', 'mission_orchestration', '${mission.missionId}', ${durationMs}, ` +
    `'${startIso}', '${endIso}', '${mission.status}', '${desc}', '${mission.missionId}') ` +
    `ON CONFLICT (work_type, source_id) DO NOTHING;\n`;
  const proc = spawn(PSQL_PATH, ["-d", "brain"], { stdio: ["pipe", "ignore", "ignore"] });
  proc.stdin?.write(sql);
  proc.stdin?.end();
}

function logSubtaskWork(missionId: string, subtask: SubtaskRecord): void {
  if (!subtask.startedAt || !subtask.endedAt) return;
  const durationMs = subtask.endedAt - subtask.startedAt;
  if (durationMs <= 0) return;

  const sourceId = `${missionId}:${subtask.id}`;
  const startIso = new Date(subtask.startedAt).toISOString();
  const endIso = new Date(subtask.endedAt).toISOString();
  const desc = (subtask.originalTask ?? "").slice(0, 500).replace(/'/g, "''");
  const status = subtask.status ?? "unknown";

  const sql =
    `INSERT INTO oms.agent_work_log (agent_id, work_type, source_id, duration_ms, started_at, ended_at, status, description, mission_id) ` +
    `VALUES ('${subtask.agentId}', 'mission_subtask', '${sourceId}', ${durationMs}, ` +
    `'${startIso}', '${endIso}', '${status}', '${desc}', '${missionId}') ` +
    `ON CONFLICT (work_type, source_id) DO UPDATE SET ` +
    `duration_ms = EXCLUDED.duration_ms, ended_at = EXCLUDED.ended_at, status = EXCLUDED.status;\n`;
  const proc = spawn(PSQL_PATH, ["-d", "brain"], { stdio: ["pipe", "ignore", "ignore"] });
  proc.stdin?.write(sql);
  proc.stdin?.end();
}

/**
 * Update OMS backlog rows for this mission to reflect final status.
 * Fire-and-forget — OMS logging is best-effort.
 */
function updateMissionStatusInOms(missionId: string, status: string): void {
  const omsStatus = status === "completed" ? "completed" : "failed";
  const sql =
    `UPDATE oms.backlog SET status='${omsStatus}' ` +
    `WHERE description LIKE '%mission ${missionId}%' ` +
    `AND status='in_progress';\n`;
  const proc = spawn(PSQL_PATH, ["-d", "brain"], { stdio: ["pipe", "ignore", "ignore"] });
  proc.stdin?.write(sql);
  proc.stdin?.end();
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

  // Auto-track: mark linked task list tasks based on mission outcome
  markTaskByMission(mission.missionId, mission.status);

  updateMissionStatusInOms(mission.missionId, mission.status);

  // Log Luna's orchestration time for this mission (fire-and-forget)
  logMissionOrchestration(mission);

  // Append mission summary to requester agent's tier 0 daily note
  void (async () => {
    try {
      const cfg = loadConfig();
      const parsed = parseAgentSessionKey(mission.requesterSessionKey);
      const requesterId = parsed?.agentId ?? "main";
      const workspaceDir = resolveAgentWorkspaceDir(cfg, requesterId);
      const today = new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Singapore" }); // YYYY-MM-DD in SGT
      const memoryDir = path.join(workspaceDir, "memory");
      await mkdir(memoryDir, { recursive: true });
      const memoryPath = path.join(memoryDir, `${today}.md`);
      const time = new Date().toLocaleTimeString("en-SG", {
        timeZone: "Asia/Singapore",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      });
      const statusIcon =
        mission.status === "completed"
          ? "[OK]"
          : mission.status === "partial"
            ? "[PARTIAL]"
            : "[FAIL]";
      const subtaskLines: string[] = [];
      for (const id of mission.executionOrder) {
        const st = mission.subtasks.get(id);
        if (!st) continue;
        const stIcon = st.status === "ok" ? "OK" : st.status === "error" ? "FAIL" : "SKIP";
        const preview = (st.result ?? st.outcome?.error ?? "").slice(0, 150).replace(/\n/g, " ");
        subtaskLines.push(`- ${stIcon} **${id}** (${st.agentId}): ${preview || "(no output)"}`);
      }
      const memEntry = [
        `\n## ${time} — ${statusIcon} Mission: ${mission.label}`,
        "",
        `**Mission:** ${mission.missionId.slice(0, 8)}`,
        "",
        ...subtaskLines,
        "",
      ].join("\n");
      await appendFile(memoryPath, memEntry, "utf-8");
    } catch {
      // Never block mission completion on memory write
    }
  })();

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

  // Log spawn duration to work_log for productivity tracking (fire-and-forget)
  logSubtaskWork(missionId, subtask);

  if (entry.outcome?.status === "ok") {
    // Read the result
    try {
      subtask.result = await readLatestAssistantReply({
        sessionKey: entry.childSessionKey,
      });
    } catch {
      // Proceed without result text
    }

    // Append result to agent's tier 0 daily memory note (real-time, no LLM).
    // Capture values synchronously before the first await — loopSubtask() clears
    // subtask.result after pushing it to loopHistory, so reading it after an
    // await would race and produce "(no result captured)".
    {
      const capturedResult = subtask.result ?? "(no result captured)";
      const capturedAgentId = subtask.agentId;
      const capturedSubtaskId = subtask.id;
      const capturedLabel = mission.label;
      void (async () => {
        try {
          const cfg = loadConfig();
          const workspaceDir = resolveAgentWorkspaceDir(cfg, capturedAgentId);
          const today = new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Singapore" }); // YYYY-MM-DD in SGT
          const memoryDir = path.join(workspaceDir, "memory");
          await mkdir(memoryDir, { recursive: true });
          const memoryPath = path.join(memoryDir, `${today}.md`);
          const time = new Date().toLocaleTimeString("en-SG", {
            timeZone: "Asia/Singapore",
            hour: "2-digit",
            minute: "2-digit",
            hour12: false,
          });
          const memEntry = [
            `\n## ${time} — ${capturedLabel}`,
            "",
            `**Subtask:** ${capturedSubtaskId}`,
            "",
            capturedResult,
            "",
          ].join("\n");
          await appendFile(memoryPath, memEntry, "utf-8");
        } catch {
          // Never block mission completion on memory write
        }
      })();
    }

    // Write result to triumph workspace for cross-agent learning (fire-and-forget)
    {
      const triumphResult = subtask.result;
      const triumphLabel = mission.label;
      const triumphAgentId = subtask.agentId;
      void (async () => {
        try {
          const content = `[${triumphAgentId}] ${triumphLabel} — ${(triumphResult ?? "").slice(0, 400)}`;
          await getMissionBrainClient().createMemory({
            content,
            workspaceId: TRIUMPH_WORKSPACE_ID,
            metadata: {
              type: "agent_result",
              agentId: triumphAgentId,
              missionLabel: triumphLabel,
              date: new Date().toISOString().slice(0, 10),
            },
          });
        } catch {
          // Never block mission completion on triumph write
        }
      })();
    }

    // Ralph Wiggum loop check: if looping is enabled and not done, spawn next iteration
    if (shouldLoopSubtask(mission, subtask)) {
      await loopSubtask(mission, subtask);
      return; // Not terminal yet — new iteration is running
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
      loopCount: 0,
      maxLoops: input.maxLoops,
      loopHistory: [],
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
    maxTotalSpawns:
      params.maxTotalSpawns ??
      (() => {
        const hasUnlimited = params.subtasks.some((s) => s.maxLoops === 0);
        if (hasUnlimited) return 999; // Unlimited loops — generous budget, LOOP_DONE is the real exit
        const loopSlots = params.subtasks.reduce((sum, s) => sum + (s.maxLoops ?? 0), 0);
        return (params.subtasks.length + loopSlots) * 3;
      })(),
    announced: false,
    cleanup: params.cleanup ?? "keep",
  };

  missions.set(missionId, mission);
  persistMissions();

  // Auto-link to task list if mission label contains listId:<uuid>: prefix
  parseMissionLabelForListId(params.label, missionId);

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
    const missionsNeedingRecovery: MissionRecord[] = [];

    for (const [id, mission] of restored.entries()) {
      if (missions.has(id)) continue;
      missions.set(id, mission);

      if (mission.status !== "running") continue;

      let needsRecovery = false;

      for (const [subtaskId, subtask] of mission.subtasks) {
        if (subtask.status !== "running") continue;

        // Check if the underlying run completed while gateway was down
        const run = subtask.runId ? getSubagentRun(subtask.runId) : undefined;
        if (run && typeof run.endedAt === "number" && run.endedAt > 0) {
          // Run completed — update subtask status inline so advanceMission can proceed
          subtask.endedAt = run.endedAt;
          subtask.outcome = run.outcome;
          if (run.outcome?.status === "ok") {
            subtask.status = "ok";
          } else {
            subtask.status = "error";
            skipDependentSubtasks(mission, subtask.id);
          }
          needsRecovery = true;
        } else if (!run) {
          // No registry entry — session was lost in the crash. Mark as error.
          subtask.status = "error";
          subtask.endedAt = Date.now();
          subtask.outcome = { status: "error", error: "session lost during gateway restart" };
          skipDependentSubtasks(mission, subtask.id);
          needsRecovery = true;
        } else {
          // Run exists in registry but hasn't ended. If the subtask started
          // before this gateway boot, the underlying LLM session is gone — the
          // registry entry is a stale leftover from disk restore. Mark as error.
          const bootTime = Date.now();
          const startedAt = subtask.startedAt ?? run.startedAt ?? run.createdAt;
          if (typeof startedAt === "number" && startedAt < bootTime - 30_000) {
            subtask.status = "error";
            subtask.endedAt = bootTime;
            subtask.outcome = { status: "error", error: "session lost during gateway restart" };
            skipDependentSubtasks(mission, subtask.id);
            needsRecovery = true;
          } else {
            // Genuinely still in progress — re-index for interceptor
            runIdToMission.set(subtask.runId!, { missionId: id, subtaskId });
          }
        }
      }

      // Mark any un-spawned pending subtasks as error too — they were never
      // going to run since the gateway restarted and the mission is stale.
      if (needsRecovery) {
        for (const [, sub] of mission.subtasks) {
          if (sub.status === "pending") {
            sub.status = "skipped";
            sub.endedAt = Date.now();
          }
        }
      }

      // Always check running missions — subtasks may have been recovered in
      // a previous restart but mission status never transitioned to terminal.
      missionsNeedingRecovery.push(mission);
    }

    // Finalize recovered missions
    for (const mission of missionsNeedingRecovery) {
      checkMissionCompletion(mission);
    }
  } catch {
    // ignore restore failures
  }

  // Register the interceptor — delete atomically to prevent double-fire from
  // dual completion paths (ensureListener + waitForSubagentCompletion).
  setRunCompletionInterceptor((runId, entry) => {
    const match = runIdToMission.get(runId);
    if (!match) return false;
    runIdToMission.delete(runId);

    void handleSubtaskCompletion(match.missionId, match.subtaskId, entry);
    return true;
  });
}

export function resetMissionSystemForTests() {
  missions.clear();
  runIdToMission.clear();
  setRunCompletionInterceptor(null);
}

/**
 * Look up a subtask by its child session key.
 * Used by the write-tool hook to detect if the current session is a mission
 * subtask, so it can auto-prepend existing file content (append mode).
 */
export function findSubtaskBySessionKey(childSessionKey: string): SubtaskRecord | undefined {
  for (const mission of missions.values()) {
    for (const subtask of mission.subtasks.values()) {
      if (subtask.childSessionKey === childSessionKey) {
        return subtask;
      }
    }
  }
  return undefined;
}
