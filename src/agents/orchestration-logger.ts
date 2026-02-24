export type OrchestrationEventType =
  | "handoff"
  | "delegate"
  | "collaborate"
  | "sequential"
  | "context_share"
  | "intent_route"
  | (string & {});

export type OrchestrationEventPayload = {
  runId: string;
  seq: number;
  ts: number;
  type: OrchestrationEventType;
  fromAgent: string;
  toAgent?: string;
  data: Record<string, unknown>;
  sessionKey?: string;
};

export type OrchestrationContext = {
  sessionKey?: string;
  userId?: string;
  channelId?: string;
};

// Keep per-run counters so event streams stay strictly monotonic per runId.
const seqByRun = new Map<string, number>();
const listeners = new Set<(evt: OrchestrationEventPayload) => void>();
const contextById = new Map<string, OrchestrationContext>();

export function registerOrchestrationContext(runId: string, context: OrchestrationContext) {
  if (!runId) {
    return;
  }
  const existing = contextById.get(runId);
  if (!existing) {
    contextById.set(runId, { ...context });
    return;
  }
  if (context.sessionKey && existing.sessionKey !== context.sessionKey) {
    existing.sessionKey = context.sessionKey;
  }
  if (context.userId && existing.userId !== context.userId) {
    existing.userId = context.userId;
  }
  if (context.channelId && existing.channelId !== context.channelId) {
    existing.channelId = context.channelId;
  }
}

export function getOrchestrationContext(runId: string) {
  return contextById.get(runId);
}

export function clearOrchestrationContext(runId: string) {
  contextById.delete(runId);
  seqByRun.delete(runId);
}

export function resetOrchestrationLoggerForTest() {
  contextById.clear();
  seqByRun.clear();
  listeners.clear();
}

export function emitOrchestrationEvent(
  event: Omit<OrchestrationEventPayload, "seq" | "ts">,
) {
  const nextSeq = (seqByRun.get(event.runId) ?? 0) + 1;
  seqByRun.set(event.runId, nextSeq);
  const context = contextById.get(event.runId);
  const sessionKey =
    typeof event.sessionKey === "string" && event.sessionKey.trim()
      ? event.sessionKey
      : context?.sessionKey;
  const enriched: OrchestrationEventPayload = {
    ...event,
    sessionKey,
    seq: nextSeq,
    ts: Date.now(),
  };
  for (const listener of listeners) {
    try {
      listener(enriched);
    } catch {
      /* ignore */
    }
  }
}

export function onOrchestrationEvent(listener: (evt: OrchestrationEventPayload) => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

// Helper functions for common orchestration events

export function logHandoff(opts: {
  runId: string;
  fromAgent: string;
  toAgent: string;
  reason?: string;
  contextTransferred?: boolean;
  sessionKey?: string;
}) {
  emitOrchestrationEvent({
    runId: opts.runId,
    type: "handoff",
    fromAgent: opts.fromAgent,
    toAgent: opts.toAgent,
    sessionKey: opts.sessionKey,
    data: {
      reason: opts.reason,
      contextTransferred: opts.contextTransferred ?? false,
    },
  });
}

export function logDelegation(opts: {
  runId: string;
  fromAgent: string;
  toAgent: string;
  intent?: string;
  confidence?: number;
  sessionKey?: string;
}) {
  emitOrchestrationEvent({
    runId: opts.runId,
    type: "delegate",
    fromAgent: opts.fromAgent,
    toAgent: opts.toAgent,
    sessionKey: opts.sessionKey,
    data: {
      intent: opts.intent,
      confidence: opts.confidence,
    },
  });
}

export function logContextShare(opts: {
  runId: string;
  fromAgent: string;
  toAgent: string;
  scope: "session" | "global";
  key: string;
  sessionKey?: string;
}) {
  emitOrchestrationEvent({
    runId: opts.runId,
    type: "context_share",
    fromAgent: opts.fromAgent,
    toAgent: opts.toAgent,
    sessionKey: opts.sessionKey,
    data: {
      scope: opts.scope,
      key: opts.key,
    },
  });
}

export function logIntentRoute(opts: {
  runId: string;
  fromAgent: string;
  toAgent: string;
  intent: string;
  confidence: number;
  sessionKey?: string;
}) {
  emitOrchestrationEvent({
    runId: opts.runId,
    type: "intent_route",
    fromAgent: opts.fromAgent,
    toAgent: opts.toAgent,
    sessionKey: opts.sessionKey,
    data: {
      intent: opts.intent,
      confidence: opts.confidence,
    },
  });
}
