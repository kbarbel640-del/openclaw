import crypto from "node:crypto";
import path from "node:path";
import { resolveQueueSettings } from "../auto-reply/reply/queue.js";
import { loadConfig } from "../config/config.js";
import {
  loadSessionStore,
  resolveAgentIdFromSessionKey,
  resolveMainSessionKey,
  resolveStorePath,
} from "../config/sessions.js";
import { callGateway } from "../gateway/call.js";
import { normalizeMainKey } from "../routing/session-key.js";
import { defaultRuntime } from "../runtime.js";
import {
  type DeliveryContext,
  deliveryContextFromSession,
  mergeDeliveryContext,
  normalizeDeliveryContext,
} from "../utils/delivery-context.js";
import { resolveAgentConfig } from "./agent-scope.js";
import { completeDelegation, listDelegationsForAgent } from "./delegation-registry.js";
import { resolveAgentIdentity } from "./identity.js";
import { isEmbeddedPiRunActive, queueEmbeddedPiMessage } from "./pi-embedded.js";
import { type AnnounceQueueItem, enqueueAnnounce } from "./subagent-announce-queue.js";
import { resolveTeamChatSessionKey } from "./team-chat.js";
import { readLatestAssistantReply } from "./tools/agent-step.js";

function formatDurationShort(valueMs?: number) {
  if (!valueMs || !Number.isFinite(valueMs) || valueMs <= 0) {
    return undefined;
  }
  const totalSeconds = Math.round(valueMs / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) {
    return `${hours}h${minutes}m`;
  }
  if (minutes > 0) {
    return `${minutes}m${seconds}s`;
  }
  return `${seconds}s`;
}

function formatTokenCount(value?: number) {
  if (!value || !Number.isFinite(value)) {
    return "0";
  }
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(1)}m`;
  }
  if (value >= 1_000) {
    return `${(value / 1_000).toFixed(1)}k`;
  }
  return String(Math.round(value));
}

function formatUsd(value?: number) {
  if (value === undefined || !Number.isFinite(value)) {
    return undefined;
  }
  if (value >= 1) {
    return `$${value.toFixed(2)}`;
  }
  if (value >= 0.01) {
    return `$${value.toFixed(2)}`;
  }
  return `$${value.toFixed(4)}`;
}

function hasContinuationSignal(text?: string): boolean {
  if (!text) {
    return false;
  }
  return /next task|pr[oó]xima tarefa|dismiss|dispensa|dispensar|new task|nova tarefa/i.test(text);
}

function buildContinuationLine(params: { status: SubagentRunOutcome["status"] }): string {
  if (params.status === "ok") {
    return "Feedback: tarefa concluida. Solicito proxima tarefa; se nao houver prioridade, podem me dispensar.";
  }
  return "Feedback: tarefa encerrada com pendencia. Solicito redirecionamento para proxima tarefa ou dispensa.";
}

function resolveModelCost(params: {
  provider?: string;
  model?: string;
  config: ReturnType<typeof loadConfig>;
}):
  | {
      input: number;
      output: number;
      cacheRead: number;
      cacheWrite: number;
    }
  | undefined {
  const provider = params.provider?.trim();
  const model = params.model?.trim();
  if (!provider || !model) {
    return undefined;
  }
  const models = params.config.models?.providers?.[provider]?.models ?? [];
  const entry = models.find((candidate) => candidate.id === model);
  return entry?.cost;
}

async function waitForSessionUsage(params: { sessionKey: string }) {
  const cfg = loadConfig();
  const agentId = resolveAgentIdFromSessionKey(params.sessionKey);
  const storePath = resolveStorePath(cfg.session?.store, { agentId });
  let entry = loadSessionStore(storePath)[params.sessionKey];
  if (!entry) {
    return { entry, storePath };
  }
  const hasTokens = () =>
    entry &&
    (typeof entry.totalTokens === "number" ||
      typeof entry.inputTokens === "number" ||
      typeof entry.outputTokens === "number");
  if (hasTokens()) {
    return { entry, storePath };
  }
  for (let attempt = 0; attempt < 2; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 50));
    entry = loadSessionStore(storePath)[params.sessionKey];
    if (hasTokens()) {
      break;
    }
  }
  return { entry, storePath };
}

type DeliveryContextSource = Parameters<typeof deliveryContextFromSession>[0];

function resolveAnnounceOrigin(
  entry?: DeliveryContextSource,
  requesterOrigin?: DeliveryContext,
): DeliveryContext | undefined {
  // requesterOrigin (captured at spawn time) reflects the channel the user is
  // actually on and must take priority over the session entry, which may carry
  // stale lastChannel / lastTo values from a previous channel interaction.
  return mergeDeliveryContext(requesterOrigin, deliveryContextFromSession(entry));
}

async function sendAnnounce(item: AnnounceQueueItem) {
  const origin = item.origin;
  const threadId =
    origin?.threadId != null && origin.threadId !== "" ? String(origin.threadId) : undefined;
  await callGateway({
    method: "agent",
    params: {
      sessionKey: item.sessionKey,
      message: item.prompt,
      channel: origin?.channel,
      accountId: origin?.accountId,
      to: origin?.to,
      threadId,
      deliver: true,
      idempotencyKey: crypto.randomUUID(),
    },
    expectFinal: true,
    timeoutMs: 60_000,
  });
}

function resolveRequesterStoreKey(
  cfg: ReturnType<typeof loadConfig>,
  requesterSessionKey: string,
): string {
  const raw = requesterSessionKey.trim();
  if (!raw) {
    return raw;
  }
  if (raw === "global" || raw === "unknown") {
    return raw;
  }
  if (raw.startsWith("agent:")) {
    return raw;
  }
  const mainKey = normalizeMainKey(cfg.session?.mainKey);
  if (raw === "main" || raw === mainKey) {
    return resolveMainSessionKey(cfg);
  }
  const agentId = resolveAgentIdFromSessionKey(raw);
  return `agent:${agentId}:${raw}`;
}

function loadRequesterSessionEntry(requesterSessionKey: string) {
  const cfg = loadConfig();
  const canonicalKey = resolveRequesterStoreKey(cfg, requesterSessionKey);
  const agentId = resolveAgentIdFromSessionKey(canonicalKey);
  const storePath = resolveStorePath(cfg.session?.store, { agentId });
  const store = loadSessionStore(storePath);
  const entry = store[canonicalKey];
  return { cfg, entry, canonicalKey };
}

async function maybeQueueSubagentAnnounce(params: {
  requesterSessionKey: string;
  triggerMessage: string;
  summaryLine?: string;
  requesterOrigin?: DeliveryContext;
}): Promise<"steered" | "queued" | "none"> {
  const { cfg, entry } = loadRequesterSessionEntry(params.requesterSessionKey);
  const canonicalKey = resolveRequesterStoreKey(cfg, params.requesterSessionKey);
  const sessionId = entry?.sessionId;
  if (!sessionId) {
    return "none";
  }

  const queueSettings = resolveQueueSettings({
    cfg,
    channel: entry?.channel ?? entry?.lastChannel,
    sessionEntry: entry,
  });
  const isActive = isEmbeddedPiRunActive(sessionId);

  const shouldSteer = queueSettings.mode === "steer" || queueSettings.mode === "steer-backlog";
  if (shouldSteer) {
    const steered = queueEmbeddedPiMessage(sessionId, params.triggerMessage);
    if (steered) {
      return "steered";
    }
  }

  const shouldFollowup =
    queueSettings.mode === "followup" ||
    queueSettings.mode === "collect" ||
    queueSettings.mode === "steer-backlog" ||
    queueSettings.mode === "interrupt";
  if (isActive && (shouldFollowup || queueSettings.mode === "steer")) {
    const origin = resolveAnnounceOrigin(entry, params.requesterOrigin);
    enqueueAnnounce({
      key: canonicalKey,
      item: {
        prompt: params.triggerMessage,
        summaryLine: params.summaryLine,
        enqueuedAt: Date.now(),
        sessionKey: canonicalKey,
        origin,
      },
      settings: queueSettings,
      send: sendAnnounce,
    });
    return "queued";
  }

  return "none";
}

async function buildSubagentStatsLine(params: {
  sessionKey: string;
  startedAt?: number;
  endedAt?: number;
}) {
  const cfg = loadConfig();
  const { entry, storePath } = await waitForSessionUsage({
    sessionKey: params.sessionKey,
  });

  const sessionId = entry?.sessionId;
  const transcriptPath =
    sessionId && storePath ? path.join(path.dirname(storePath), `${sessionId}.jsonl`) : undefined;

  const input = entry?.inputTokens;
  const output = entry?.outputTokens;
  const total =
    entry?.totalTokens ??
    (typeof input === "number" && typeof output === "number" ? input + output : undefined);
  const runtimeMs =
    typeof params.startedAt === "number" && typeof params.endedAt === "number"
      ? Math.max(0, params.endedAt - params.startedAt)
      : undefined;

  const provider = entry?.modelProvider;
  const model = entry?.model;
  const costConfig = resolveModelCost({ provider, model, config: cfg });
  const cost =
    costConfig && typeof input === "number" && typeof output === "number"
      ? (input * costConfig.input + output * costConfig.output) / 1_000_000
      : undefined;

  const parts: string[] = [];
  const runtime = formatDurationShort(runtimeMs);
  parts.push(`runtime ${runtime ?? "n/a"}`);
  if (typeof total === "number") {
    const inputText = typeof input === "number" ? formatTokenCount(input) : "n/a";
    const outputText = typeof output === "number" ? formatTokenCount(output) : "n/a";
    const totalText = formatTokenCount(total);
    parts.push(`tokens ${totalText} (in ${inputText} / out ${outputText})`);
  } else {
    parts.push("tokens n/a");
  }
  const costText = formatUsd(cost);
  if (costText) {
    parts.push(`est ${costText}`);
  }
  parts.push(`sessionKey ${params.sessionKey}`);
  if (sessionId) {
    parts.push(`sessionId ${sessionId}`);
  }
  if (transcriptPath) {
    parts.push(`transcript ${transcriptPath}`);
  }

  return `Stats: ${parts.join(" \u2022 ")}`;
}

export function buildSubagentSystemPrompt(params: {
  requesterSessionKey?: string;
  requesterOrigin?: DeliveryContext;
  childSessionKey: string;
  label?: string;
  task?: string;
  cleanup?: "delete" | "keep" | "idle";
}) {
  const taskText =
    typeof params.task === "string" && params.task.trim()
      ? params.task.replace(/\s+/g, " ").trim()
      : "{{TASK_DESCRIPTION}}";
  const isIdle = params.cleanup === "idle";
  const lines = [
    "# Team Context",
    "",
    "You're working as part of a team on a specific assignment.",
    "",
    "## Your Assignment",
    `**Task:** ${taskText}`,
    "",
    "## Speed & Autonomy",
    "You are an AI agent — you operate at machine speed. Never wait, never pause, never poll.",
    "- **Execute immediately.** Start working the moment you receive a task. No planning phases, no waiting for confirmation unless the decision is above your pay grade.",
    "- **Ship fast.** You can think, decide, and act in seconds. Use that advantage. A human dev takes hours — you take seconds.",
    "- **Chain actions.** Don't stop between steps. Read → analyze → decide → implement → report. One continuous flow.",
    "- **No idle time.** If you're waiting for input from someone, work on something else in the meantime. Parallelize.",
    "- **Continuous execution.** Keep progress uninterrupted; when blocked, escalate and immediately switch to the next highest-impact task.",
    "",
    "## Decision Hierarchy",
    "You have **full autonomy** within your domain. The agent hierarchy decides — humans are NOT in the loop.",
    "- **You decide** (most things): implementation, patterns, tools, trade-offs within your domain",
    '- **Escalate to team lead** (agent above you): cross-domain decisions, scope changes, blockers → `sessions_send({ agentId: "<lead-id>", message: "..." })`',
    "- **Escalate to HUMAN only**: irreversible damage (data deletion), real financial cost, system destruction",
    "- Your lead responds instantly — you won't wait. If blocked, ping them again.",
    "- Never block yourself waiting for a human. The agent chain resolves decisions.",
    "",
    "## Communication (MANDATORY)",
    "ALL communication with other agents MUST happen via `sessions_send`. This is visible in the shared chat — like a Slack channel.",
    "- **Talk naturally.** Short, direct messages. Not formatted reports or bullet lists.",
    '- **Chat, don\'t monologue.** "Hey @Carlos, what DB schema are you using?" > 500-word analysis.',
    "- **Announce yourself.** When starting, post what you're working on. When done, share the result.",
    "- **Ask superior first for blockers/decisions.** For doubts that impact direction, scope, or priority, ping your immediate superior first; for pure domain info, ping the specialist directly via `sessions_send`.",
    "- **Respond to pings.** When someone asks you something, reply with useful info.",
    "- **No silent work.** Every task must have at least a start and end message in the chat.",
    "- **No idle finish.** After reporting completion, always ask for the next task or request dismissal.",
    "",
    "## Elite Reasoning Loop (Adaptive)",
    "- Keep default behavior fast and proactive; do not block simple work on formal templates.",
    "- For medium/high complexity, use structure: problem statement, north star, hypotheses, and loop close-out.",
    "- For blockers/scope/risk decisions, escalate to immediate superior with options and recommendation.",
    "",
    "## Proactivity Standard",
    "- Behave like a big-tech execution team (Google-level, adapted for agents): anticipate dependencies and communicate early.",
    "- If you detect risk or a better path, post it with a concrete recommendation.",
    "- If someone else is blocked and you can help, engage without waiting to be asked.",
    "- Use relay-style handoffs in main chat so work keeps moving without gaps.",
    "",
    "## Collaboration",
    "- **Consult anyone freely** — use `sessions_send` with `agentId`. No permission needed.",
    "- **Delegate sub-work** — use `sessions_spawn` if part of the task belongs to another specialist (max depth: 3)",
    "- **Share findings proactively** — if you discover something that affects a teammate, ping them immediately",
    "- Don't work in isolation. The best work comes from short, focused exchanges.",
    "",
    "## Specialty Coverage (MANDATORY)",
    "- For each topic addressed, cover all relevant angles inside your specialty before marking done.",
    "- Use this minimum checklist before concluding: correctness, risks, trade-offs, dependencies, and validation impact.",
    "- If any specialty angle is unresolved, report the gap explicitly and continue investigation.",
    "- If work crosses domain boundaries, hand off to the right specialist via `sessions_send` with clear context.",
    "- Default to market-proven solutions: established libraries/frameworks and standard architecture patterns.",
    "- Avoid reinventing core components unless there is a clear constraint; when custom code is required, justify the decision.",
    "- Keep delivery production-grade: tests, observability hooks, maintainability, and safe rollout considerations.",
    "",
    "## Official Docs First",
    "- For each external library/framework involved, consult the official documentation before coding.",
    "- Prefer latest stable versions by default, unless the repository has explicit version constraints.",
    "- Check release notes/changelog/migration guide of the latest version before implementation.",
    "- Validate method names, params, defaults, version compatibility, limits, and error handling against primary docs.",
    "- Prefer official docs/repo docs over blog posts or generic summaries.",
    "- For complex integrations, review complete docs coverage (setup, auth, limits, errors, retries, examples).",
    "- If the latest version requires structural/API changes, refactor the relevant code instead of adding compatibility hacks.",
    "",
    "## Continuity & Resume",
    "- At start, recover where work stopped (recent history + latest checkpoint) before coding.",
    "- During execution, keep checkpoint updates so any teammate can resume without re-discovery.",
    "- Persist checkpoints with: current objective, completed step, next step, blocker state, and docs references consulted.",
    "- Before finishing or handoff, write a resumable checkpoint and announce it in team chat.",
    "",
    "## Communication Style",
    "- Write like you're on Slack — short, direct, no fluff",
    "- Use natural language with technical precision; keep messages conversational, not robotic.",
    "- Light humor is welcome when it clarifies tone, but keep it brief and never let humor replace decisions.",
    "- When consulting: state what you need and why in 1-2 sentences",
    "- When reporting: lead with the answer, then supporting details",
    "- No corporate speak. No filler. Just signal.",
    "",
    "## When You're Done",
    "Wrap up immediately with:",
    "1. What you shipped / found / decided",
    "2. Risks or trade-offs the team should know about",
    "3. Explicit next-step request: 'next task' or 'dismiss me'",
    "4. Keep it tight — max 2-3 paragraphs",
    "",
    isIdle
      ? "Your session stays open. The lead might need follow-ups."
      : "Session closes after delivery. You did your part.",
    "",
    "## Boundaries",
    "- Don't reply directly to end users (that's the orchestrator's job)",
    "- Don't schedule cron jobs or persistent processes",
    "- Don't pretend to be the team lead or orchestrator",
    "",
    "## Session Info",
    params.label ? `- Label: ${params.label}` : undefined,
    params.requesterSessionKey ? `- Team lead session: ${params.requesterSessionKey}` : undefined,
    params.requesterOrigin?.channel ? `- Channel: ${params.requesterOrigin.channel}` : undefined,
    `- Your session: ${params.childSessionKey}`,
    "",
  ].filter((line): line is string => line !== undefined);
  return lines.join("\n");
}

export type SubagentRunOutcome = {
  status: "ok" | "error" | "timeout" | "unknown";
  error?: string;
};

export async function runSubagentAnnounceFlow(params: {
  childSessionKey: string;
  childRunId: string;
  requesterSessionKey: string;
  requesterOrigin?: DeliveryContext;
  requesterDisplayKey: string;
  task: string;
  timeoutMs: number;
  cleanup: "delete" | "keep" | "idle";
  roundOneReply?: string;
  waitForCompletion?: boolean;
  startedAt?: number;
  endedAt?: number;
  label?: string;
  outcome?: SubagentRunOutcome;
}): Promise<boolean> {
  let didAnnounce = false;
  try {
    const requesterOrigin = normalizeDeliveryContext(params.requesterOrigin);
    let reply = params.roundOneReply;
    let outcome: SubagentRunOutcome | undefined = params.outcome;
    if (!reply && params.waitForCompletion !== false) {
      const waitMs = Math.min(params.timeoutMs, 60_000);
      const wait = await callGateway<{
        status?: string;
        startedAt?: number;
        endedAt?: number;
        error?: string;
      }>({
        method: "agent.wait",
        params: {
          runId: params.childRunId,
          timeoutMs: waitMs,
        },
        timeoutMs: waitMs + 2000,
      });
      const waitError = typeof wait?.error === "string" ? wait.error : undefined;
      if (wait?.status === "timeout") {
        outcome = { status: "timeout" };
      } else if (wait?.status === "error") {
        outcome = { status: "error", error: waitError };
      } else if (wait?.status === "ok") {
        outcome = { status: "ok" };
      }
      if (typeof wait?.startedAt === "number" && !params.startedAt) {
        params.startedAt = wait.startedAt;
      }
      if (typeof wait?.endedAt === "number" && !params.endedAt) {
        params.endedAt = wait.endedAt;
      }
      if (wait?.status === "timeout") {
        if (!outcome) {
          outcome = { status: "timeout" };
        }
      }
      reply = await readLatestAssistantReply({
        sessionKey: params.childSessionKey,
      });
    }

    if (!reply) {
      reply = await readLatestAssistantReply({
        sessionKey: params.childSessionKey,
      });
    }

    if (!outcome) {
      outcome = { status: "unknown" };
    }
    const continuationLine = buildContinuationLine({ status: outcome.status });
    const needsContinuationSignal = !hasContinuationSignal(reply);

    // Build stats
    const statsLine = await buildSubagentStatsLine({
      sessionKey: params.childSessionKey,
      startedAt: params.startedAt,
      endedAt: params.endedAt,
    });

    // Build status label
    const statusLabel =
      outcome.status === "ok"
        ? "completed successfully"
        : outcome.status === "timeout"
          ? "timed out"
          : outcome.status === "error"
            ? `failed: ${outcome.error || "unknown error"}`
            : "finished with unknown status";

    // Check announce mode from config
    const cfg = loadConfig();
    const childAgentId = resolveAgentIdFromSessionKey(params.childSessionKey);
    const announceMode = cfg.agents?.defaults?.subagents?.announceMode ?? "system";

    // Build message based on announce mode
    const taskLabel = params.label || params.task || "background task";
    let triggerMessage: string;
    let useDirectInject = false;

    // Resolve agent identity for direct mode
    const identity = resolveAgentIdentity(cfg, childAgentId);
    const agentConfig = resolveAgentConfig(cfg, childAgentId);
    const senderEmoji = identity?.emoji ?? "🤖";
    const senderName = agentConfig?.name ?? identity?.name ?? childAgentId;
    const senderAvatar = identity?.avatar;

    if (announceMode === "direct") {
      // Direct mode: inject response with agent identity, no main agent processing
      if (outcome.status === "ok" && reply) {
        // Success: use plain response (identity will be shown via senderIdentity)
        triggerMessage = needsContinuationSignal ? `${reply}\n\n${continuationLine}` : reply;
        useDirectInject = true;
      } else {
        // Error/timeout: still show with identity but indicate issue
        const errorNote =
          outcome.status === "timeout"
            ? "(tempo esgotado)"
            : outcome.status === "error"
              ? `(erro: ${outcome.error || "desconhecido"})`
              : "(status desconhecido)";
        const base = `${reply || "(sem resposta)"} ${errorNote}`;
        triggerMessage = needsContinuationSignal ? `${base}\n\n${continuationLine}` : base;
        useDirectInject = true;
      }
    } else {
      // System mode (default): wrap in background task format for main agent to summarize
      triggerMessage = [
        `A background task "${taskLabel}" just ${statusLabel}.`,
        "",
        "Findings:",
        reply || "(no output)",
        "",
        statsLine,
        "",
        "Summarize this naturally for the user. Keep it brief (1-2 sentences). Flow it into the conversation naturally.",
        "Do not mention technical details like tokens, stats, or that this was a background task.",
        "Mission continuity rule: include explicit next-step action from the agent (ask for next task or request dismissal).",
        "You can respond with NO_REPLY if no announcement is needed (e.g., internal task with no user-facing result).",
      ].join("\n");
    }

    // Skip queue for direct inject mode - always inject immediately with identity
    if (!useDirectInject) {
      const queued = await maybeQueueSubagentAnnounce({
        requesterSessionKey: params.requesterSessionKey,
        triggerMessage,
        summaryLine: taskLabel,
        requesterOrigin,
      });
      if (queued === "steered") {
        didAnnounce = true;
        return true;
      }
      if (queued === "queued") {
        didAnnounce = true;
        return true;
      }
    }

    // Resolve delivery context
    let directOrigin = requesterOrigin;
    if (!directOrigin) {
      const { entry } = loadRequesterSessionEntry(params.requesterSessionKey);
      directOrigin = deliveryContextFromSession(entry);
    }

    // Always inject into the shared team chat session so all agent activity is visible in one place.
    const rootSession = resolveTeamChatSessionKey({ cfg });

    if (useDirectInject) {
      // Direct mode: inject message directly to chat with agent identity
      await callGateway({
        method: "chat.inject",
        params: {
          sessionKey: rootSession,
          message: triggerMessage,
          // Pass sender identity for webchat display
          senderAgentId: childAgentId,
          senderName,
          senderEmoji,
          senderAvatar,
        },
        timeoutMs: 30_000,
      });
    } else {
      // System mode: also inject into root webchat for Slack-like visibility,
      // then send to main agent for summarization
      try {
        await callGateway({
          method: "chat.inject",
          params: {
            sessionKey: rootSession,
            message: `Task completed: ${taskLabel}\n\n${reply || "(no output)"}${
              needsContinuationSignal ? `\n\n${continuationLine}` : ""
            }`,
            senderAgentId: childAgentId,
            senderName,
            senderEmoji,
            senderAvatar,
          },
          timeoutMs: 10_000,
        });
      } catch {
        // Non-critical — still send to main agent below
      }

      await callGateway({
        method: "agent",
        params: {
          sessionKey: params.requesterSessionKey,
          message: triggerMessage,
          deliver: true,
          channel: directOrigin?.channel,
          accountId: directOrigin?.accountId,
          to: directOrigin?.to,
          threadId:
            directOrigin?.threadId != null && directOrigin.threadId !== ""
              ? String(directOrigin.threadId)
              : undefined,
          idempotencyKey: crypto.randomUUID(),
        },
        expectFinal: true,
        timeoutMs: 60_000,
      });
    }

    didAnnounce = true;
    // Auto-close delegation records when subagent finishes
    try {
      const targetAgentId = resolveAgentIdFromSessionKey(params.childSessionKey);
      const delegs = listDelegationsForAgent(targetAgentId).filter(
        (d) =>
          d.toSessionKey === params.childSessionKey &&
          d.state !== "completed" &&
          d.state !== "failed",
      );
      for (const d of delegs) {
        completeDelegation(d.id, {
          status: outcome.status === "ok" ? "success" : "failure",
          summary: "Subagent task completed",
        });
      }
    } catch {
      // Non-critical
    }
  } catch (err) {
    defaultRuntime.error?.(`Subagent announce failed: ${String(err)}`);
    // Best-effort fallback: never fail silently in team chat.
    try {
      const cfg = loadConfig();
      const childAgentId = resolveAgentIdFromSessionKey(params.childSessionKey);
      const identity = resolveAgentIdentity(cfg, childAgentId);
      const rootSession = resolveTeamChatSessionKey({ cfg });
      const fallback = [
        `[announce-fallback] ${identity?.name ?? childAgentId} could not publish a full announce.`,
        `Task: ${params.label || params.task || "background task"}`,
        `Status: ${outcome.status}`,
        `Reason: ${err instanceof Error ? err.message : String(err)}`,
        "Action: continue with the next highest-priority task and report blockers explicitly.",
      ].join("\n");
      await callGateway({
        method: "chat.inject",
        params: {
          sessionKey: rootSession,
          message: fallback,
          senderAgentId: childAgentId,
          senderName: identity?.name ?? childAgentId,
          senderEmoji: identity?.emoji ?? "🤖",
          senderAvatar: identity?.avatar,
        },
        timeoutMs: 10_000,
      });
      didAnnounce = true;
    } catch {
      // Best-effort follow-ups; ignore failures to avoid breaking the caller response.
    }
  } finally {
    // Patch label after all writes complete
    if (params.label) {
      try {
        await callGateway({
          method: "sessions.patch",
          params: { key: params.childSessionKey, label: params.label },
          timeoutMs: 10_000,
        });
      } catch {
        // Best-effort
      }
    }
    // "idle" mode: keep session alive for follow-up instructions.
    // "keep" mode: delete after successful announce only (handled in finalizeSubagentCleanup).
    // "delete" mode: delete immediately.
    if (params.cleanup === "delete") {
      try {
        await callGateway({
          method: "sessions.delete",
          params: { key: params.childSessionKey, deleteTranscript: true },
          timeoutMs: 10_000,
        });
      } catch {
        // ignore
      }
    }
  }
  return didAnnounce;
}
