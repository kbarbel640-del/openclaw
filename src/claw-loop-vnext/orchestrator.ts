import { randomUUID } from "node:crypto";
import path from "node:path";
import type { LoopTransport } from "./transport/types.js";
import type { GoalFile, Signal } from "./types.js";
import { appendEvent, createEvent } from "./event-log.js";
import {
  buildPhasePrompt,
  ensureApprovalGate,
  getCurrentPhase,
  loadGoalFile,
  saveGoalFile,
  updatePhaseStatus,
} from "./goal.js";
import { RuntimeStore } from "./runtime-store.js";
import { extractSignals } from "./signal-parser.js";
import { sendWithRetry } from "./transport/send-with-retry.js";

export type OrchestratorDeps = {
  primaryTransport: LoopTransport;
  fallbackTransport?: LoopTransport;
  goalsDir: string;
};

export type HandleResult = {
  goal: GoalFile;
  delivered: boolean;
  transport: string;
  ackId?: string;
  signals: Signal[];
  outputText: string;
};

function goalIdFromFile(goalFile: string): string {
  return path.basename(goalFile, ".json");
}

function runtimePaths(goalsDir: string, goalId: string) {
  return {
    eventLogFile: path.join(goalsDir, ".runtime", `${goalId}.events.jsonl`),
    stateFile: path.join(goalsDir, ".runtime", `${goalId}.state.json`),
  };
}

async function processSignals(params: {
  goal: GoalFile;
  goalFile: string;
  goalId: string;
  signals: Signal[];
  store: RuntimeStore;
  eventLogFile: string;
}): Promise<GoalFile> {
  let goal = params.goal;

  for (const signal of params.signals) {
    const seen = await params.store.hasSeenSignal(params.goalId, signal.dedupeKey);
    if (seen) {
      await appendEvent(
        params.eventLogFile,
        createEvent(params.goalId, "signal_deduped", {
          dedupeKey: signal.dedupeKey,
          type: signal.type,
        }),
      );
      continue;
    }

    await params.store.markSignalSeen(params.goalId, signal.dedupeKey);
    await appendEvent(
      params.eventLogFile,
      createEvent(params.goalId, "signal_seen", { dedupeKey: signal.dedupeKey, type: signal.type }),
    );

    if (signal.type === "phase_complete") {
      goal = updatePhaseStatus(goal, signal.phaseId, "complete");
      goal = ensureApprovalGate(goal, signal.phaseId);
      await appendEvent(
        params.eventLogFile,
        createEvent(params.goalId, "phase_advanced", {
          phaseId: signal.phaseId,
          status: "complete",
        }),
      );
      continue;
    }

    if (signal.type === "phase_blocked") {
      const current = getCurrentPhase(goal);
      if (current) {
        goal = updatePhaseStatus(goal, current.id, "blocked");
      }
      goal.status = "blocked";
      continue;
    }

    if (signal.type === "goal_complete" || signal.type === "promise_done") {
      goal.status = "complete";
    }
  }

  await saveGoalFile(params.goalFile, goal);
  return goal;
}

export async function sendCurrentPhasePrompt(
  deps: OrchestratorDeps,
  goalFile: string,
  messageOverride?: string,
): Promise<HandleResult> {
  const goalId = goalIdFromFile(goalFile);
  const goal = await loadGoalFile(goalFile);
  const { eventLogFile, stateFile } = runtimePaths(deps.goalsDir, goalId);
  const store = new RuntimeStore(stateFile);

  const current = getCurrentPhase(goal);
  const message = messageOverride ?? (current ? buildPhasePrompt(goal, current) : "");
  if (!message.trim()) {
    return {
      goal,
      delivered: false,
      transport: deps.primaryTransport.kind,
      signals: [],
      outputText: "",
    };
  }

  const idempotencyKey = randomUUID();
  const ackTimeoutMs = goal.orchestration?.ackTimeoutMs ?? 15_000;
  const maxRetries = goal.orchestration?.maxRetries ?? 2;

  const sendResult = await sendWithRetry({
    primary: deps.primaryTransport,
    fallback: deps.fallbackTransport,
    request: {
      goalId,
      workdir: goal.workdir,
      message,
      idempotencyKey,
      ackTimeoutMs,
      sessionName: goal.session,
    },
    maxRetries,
    onEvent: async (event) => appendEvent(eventLogFile, event),
  });

  await store.recordDelivery(goalId, idempotencyKey, sendResult.delivered, sendResult.transport);
  await appendEvent(
    eventLogFile,
    createEvent(goalId, "goal_updated", {
      delivery: sendResult.delivered,
      transport: sendResult.transport,
      ackId: sendResult.ackId,
    }),
  );

  const signals = extractSignals(sendResult.outputText);
  const nextGoal = await processSignals({
    goal,
    goalFile,
    goalId,
    signals,
    store,
    eventLogFile,
  });

  return {
    goal: nextGoal,
    delivered: sendResult.delivered,
    transport: sendResult.transport,
    ackId: sendResult.ackId,
    signals,
    outputText: sendResult.outputText,
  };
}

export async function approveNextPhase(goalFile: string): Promise<GoalFile> {
  const goal = await loadGoalFile(goalFile);
  return {
    ...goal,
    awaitingApproval: undefined,
  };
}
