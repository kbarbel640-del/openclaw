import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { SILENT_REPLY_TOKEN } from "../auto-reply/tokens.js";
import { normalizeChannelId } from "../channels/registry.js";
import { loadConfig } from "../config/config.js";
import {
  loadSessionStore,
  resolveAgentIdFromSessionKey,
  resolveMainSessionKey,
  resolveStorePath,
} from "../config/sessions.js";
import { callGateway } from "../gateway/call.js";
import { INTERNAL_MESSAGE_CHANNEL } from "../utils/message-channel.js";
import { AGENT_LANE_NESTED } from "./lanes.js";
import type { EmbeddedContextFile } from "./pi-embedded-helpers.js";
import { readLatestAssistantReply, runAgentStep } from "./tools/agent-step.js";
import { resolveAnnounceTarget } from "./tools/sessions-announce-target.js";
import { isAnnounceSkip } from "./tools/sessions-send-helpers.js";
import {
  DEFAULT_AGENT_WORKSPACE_DIR,
  DEFAULT_SOUL_FILENAME,
} from "./workspace.js";

function formatDurationShort(valueMs?: number) {
  if (!valueMs || !Number.isFinite(valueMs) || valueMs <= 0) return undefined;
  const totalSeconds = Math.round(valueMs / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) return `${hours}h${minutes}m`;
  if (minutes > 0) return `${minutes}m${seconds}s`;
  return `${seconds}s`;
}

function formatTokenCount(value?: number) {
  if (!value || !Number.isFinite(value)) return "0";
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}m`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}k`;
  return String(Math.round(value));
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
  if (!provider || !model) return undefined;
  const models = params.config.models?.providers?.[provider]?.models ?? [];
  const entry = models.find((candidate) => candidate.id === model);
  return entry?.cost;
}

async function waitForSessionUsage(params: { sessionKey: string }) {
  const cfg = loadConfig();
  const agentId = resolveAgentIdFromSessionKey(params.sessionKey);
  const storePath = resolveStorePath(cfg.session?.store, { agentId });
  let entry = loadSessionStore(storePath)[params.sessionKey];
  if (!entry) return { entry, storePath };
  const hasTokens = () => {
    if (!entry || typeof entry !== "object") return false;
    return (
      typeof entry.totalTokens === "number" ||
      typeof entry.inputTokens === "number" ||
      typeof entry.outputTokens === "number"
    );
  };
  if (hasTokens()) return { entry, storePath };
  for (let attempt = 0; attempt < 4; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 200));
    entry = loadSessionStore(storePath)[params.sessionKey];
    if (hasTokens()) break;
  }
  return { entry, storePath };
}

// Build stats line for internal logging (not sent to users)
export async function buildSubagentStatsLine(params: {
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
    sessionId && storePath
      ? path.join(path.dirname(storePath), `${sessionId}.jsonl`)
      : undefined;

  const input = entry?.inputTokens;
  const output = entry?.outputTokens;
  const total =
    entry?.totalTokens ??
    (typeof input === "number" && typeof output === "number"
      ? input + output
      : undefined);
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
    const inputText =
      typeof input === "number" ? formatTokenCount(input) : "n/a";
    const outputText =
      typeof output === "number" ? formatTokenCount(output) : "n/a";
    const totalText = formatTokenCount(total);
    parts.push(`tokens ${totalText} (in ${inputText} / out ${outputText})`);
  } else {
    parts.push("tokens n/a");
  }
  if (cost !== undefined) parts.push(`est $${cost.toFixed(4)}`);
  parts.push(`sessionKey ${params.sessionKey}`);
  if (sessionId) parts.push(`sessionId ${sessionId}`);
  if (transcriptPath) parts.push(`transcript ${transcriptPath}`);

  return `Stats: ${parts.join(" \u2022 ")}`;
}

function loadSoulContent(workspaceDir?: string): string | undefined {
  const dir = workspaceDir ?? DEFAULT_AGENT_WORKSPACE_DIR;
  const soulPath = path.join(dir, DEFAULT_SOUL_FILENAME);
  try {
    const content = fs.readFileSync(soulPath, "utf-8");
    return content.trim() || undefined;
  } catch {
    return undefined;
  }
}

export function buildSubagentSystemPrompt(params: {
  requesterSessionKey?: string;
  requesterChannel?: string;
  childSessionKey: string;
  label?: string;
  task?: string;
  workspaceDir?: string;
  // Extended params for full context (matching main agent)
  toolNames?: string[];
  toolSummaries?: Record<string, string>;
  contextFiles?: EmbeddedContextFile[];
  modelAliasLines?: string[];
  userTimezone?: string;
  userTime?: string;
  skillsPrompt?: string;
  runtimeInfo?: {
    host?: string;
    os?: string;
    arch?: string;
    node?: string;
    model?: string;
    channel?: string;
    capabilities?: string[];
  };
}) {
  const taskText =
    typeof params.task === "string" && params.task.trim()
      ? params.task.replace(/\s+/g, " ").trim()
      : "{{TASK_DESCRIPTION}}";

  // Build tool summaries section (like main agent)
  const coreToolSummaries: Record<string, string> = {
    read: "Read file contents",
    write: "Create or overwrite files",
    edit: "Make precise edits to files",
    apply_patch: "Apply multi-file patches",
    grep: "Search file contents for patterns",
    find: "Find files by glob pattern",
    ls: "List directory contents",
    exec: "Run shell commands",
    process: "Manage background exec sessions",
    browser: "Control web browser",
    canvas: "Present/eval/snapshot the Canvas",
    nodes: "List/describe/notify/camera/screen on paired nodes",
    agents_list: "List agent ids allowed for sessions_spawn",
    sessions_list: "List other sessions (incl. sub-agents) with filters/last",
    sessions_history: "Fetch history for another session/sub-agent",
    image: "Analyze an image with the configured image model",
    memory_search: "Search memory files for context",
    memory_get: "Get specific lines from memory files",
    report_back: "Report results back to main session",
  };

  const toolOrder = [
    "read",
    "write",
    "edit",
    "apply_patch",
    "grep",
    "find",
    "ls",
    "exec",
    "process",
    "browser",
    "canvas",
    "nodes",
    "agents_list",
    "sessions_list",
    "sessions_history",
    "image",
    "memory_search",
    "memory_get",
    "report_back",
  ];

  const rawToolNames = (params.toolNames ?? []).map((tool) => tool.trim());
  const canonicalToolNames = rawToolNames.filter(Boolean);
  const canonicalByNormalized = new Map<string, string>();
  for (const name of canonicalToolNames) {
    const normalized = name.toLowerCase();
    if (!canonicalByNormalized.has(normalized)) {
      canonicalByNormalized.set(normalized, name);
    }
  }
  const resolveToolName = (normalized: string) =>
    canonicalByNormalized.get(normalized) ?? normalized;

  const normalizedTools = canonicalToolNames.map((tool) => tool.toLowerCase());
  const availableTools = new Set(normalizedTools);
  const externalToolSummaries = new Map<string, string>();
  for (const [key, value] of Object.entries(params.toolSummaries ?? {})) {
    const normalized = key.trim().toLowerCase();
    if (!normalized || !value?.trim()) continue;
    externalToolSummaries.set(normalized, value.trim());
  }
  const extraTools = Array.from(
    new Set(normalizedTools.filter((tool) => !toolOrder.includes(tool))),
  );
  const enabledTools = toolOrder.filter((tool) => availableTools.has(tool));
  const toolLines = enabledTools.map((tool) => {
    const summary = coreToolSummaries[tool] ?? externalToolSummaries.get(tool);
    const name = resolveToolName(tool);
    return summary ? `- ${name}: ${summary}` : `- ${name}`;
  });
  for (const tool of extraTools.sort()) {
    const summary = coreToolSummaries[tool] ?? externalToolSummaries.get(tool);
    const name = resolveToolName(tool);
    toolLines.push(summary ? `- ${name}: ${summary}` : `- ${name}`);
  }

  const readToolName = resolveToolName("read");
  const userTimezone = params.userTimezone?.trim();
  const userTime = params.userTime?.trim();
  const skillsPrompt = params.skillsPrompt?.trim();
  const runtimeInfo = params.runtimeInfo;
  const runtimeChannel = runtimeInfo?.channel?.trim().toLowerCase();
  const runtimeCapabilities = (runtimeInfo?.capabilities ?? [])
    .map((cap) => String(cap).trim())
    .filter(Boolean);
  const lines: (string | undefined)[] = [
    "You are a personal assistant running inside Clawdbot as a **subagent**.",
    "",
    "# Subagent Context",
    "",
    "You are a **subagent** spawned by the main agent for a specific task.",
    "",
    "## Your Role",
    `- You were created to handle: ${taskText}`,
    "- Complete this task and report back. That's your entire purpose.",
    "- You are NOT the main agent. Don't try to be.",
    "",
    "## Subagent Rules",
    "1. **Stay focused** - Do your assigned task, nothing else",
    "2. **Report completion** - When done, use `report_back` to share results",
    "3. **Don't initiate** - No heartbeats, no proactive actions, no side quests",
    "4. **Ask the spawner** - If blocked or confused, report back rather than improvising",
    "5. **Be ephemeral** - You may be terminated after task completion. That's fine.",
    "",
    "## Reporting Results",
    "",
    "You have a `report_back` tool to send results to the main chat.",
    "",
    "**Follow the task's instructions for reporting.** If the task specifies when/how to report (e.g., 'report when started', 'report progress', 'report twice'), do exactly that.",
    "",
    "**Default (no specific instructions):** Call `report_back` once when your task is complete.",
    "",
    "**For silent/internal tasks:**",
    '- If the task says "silent", "quiet", or "internal only" but you still need to report results to the main agent (not the user), use `report_back` with `internalOnly: true`',
    "- This injects your message into the main session transcript WITHOUT sending to messaging channels (Telegram, WhatsApp, etc.)",
    "",
    "**When NOT to report at all:**",
    '- If the task explicitly says "no report" or "skip report_back" entirely',
    "- If the task failed completely with no useful output",
    "",
    "**Message style:**",
    "- Write concise, natural messages",
    "- Match the persona from workspace files if available",
    "",
    "## What Subagents DON'T Do",
    "- NO user conversations (that's main agent's job)",
    "- NO external messages (email, tweets, etc.) unless explicitly tasked",
    "- NO cron jobs or persistent state",
    "- NO pretending to be the main agent",
    "- **NO using the message tool** - you don't have a recipient address; the main agent handles messaging",
    "- **NO gateway operations** - no self-updates, config changes, or restarts",
    "- **NO heartbeats** - main agent handles those",
    "",
    "## Session Context",
    params.label ? `- Label: ${params.label}` : undefined,
    params.requesterSessionKey
      ? `- Requester session: ${params.requesterSessionKey}.`
      : undefined,
    params.requesterChannel
      ? `- Requester channel: ${params.requesterChannel}.`
      : undefined,
    `- Your session: ${params.childSessionKey}.`,
    "",
  ];

  // Tooling section (like main agent)
  if (toolLines.length > 0) {
    lines.push(
      "## Tooling",
      "Tool availability (filtered by policy):",
      "Tool names are case-sensitive. Call tools exactly as listed.",
      toolLines.join("\n"),
      "TOOLS.md does not control tool availability; it is user guidance for how to use external tools.",
      "",
    );
  }

  // Skills section (like main agent)
  if (skillsPrompt) {
    lines.push(
      "## Skills",
      `Skills provide task-specific instructions. Use \`${readToolName}\` to load the SKILL.md at the location listed for that skill.`,
      skillsPrompt,
      "",
    );
  }

  // Memory recall section (like main agent)
  if (availableTools.has("memory_search") || availableTools.has("memory_get")) {
    lines.push(
      "## Memory Recall",
      "Before answering anything about prior work, decisions, dates, people, preferences, or todos: run memory_search on MEMORY.md + memory/*.md; then use memory_get to pull only the needed lines. If low confidence after search, say you checked.",
      "",
    );
  }

  // Model aliases (like main agent)
  if (params.modelAliasLines && params.modelAliasLines.length > 0) {
    lines.push(
      "## Model Aliases",
      "Prefer aliases when specifying model overrides; full provider/model is also accepted.",
      params.modelAliasLines.join("\n"),
      "",
    );
  }

  // Workspace (like main agent)
  lines.push(
    "## Workspace",
    `Your working directory is: ${params.workspaceDir ?? DEFAULT_AGENT_WORKSPACE_DIR}`,
    "Treat this directory as the single global workspace for file operations unless explicitly instructed otherwise.",
    "",
  );

  // User time (like main agent)
  if (userTimezone || userTime) {
    lines.push(
      `Time: assume UTC unless stated. User TZ=${userTimezone ?? "unknown"}. Current user time (converted)=${userTime ?? "unknown"}.`,
      "",
    );
  }

  // Reply tags (like main agent)
  lines.push(
    "## Reply Tags",
    "To request a native reply/quote on supported surfaces, include one tag in your reply:",
    "- [[reply_to_current]] replies to the triggering message.",
    "- [[reply_to:<id>]] replies to a specific message id when you have it.",
    "Whitespace inside the tag is allowed (e.g. [[ reply_to_current ]] / [[ reply_to: 123 ]]).",
    "Tags are stripped before sending; support depends on the current channel config.",
    "",
  );

  // Messaging (like main agent, but note subagents shouldn't use message tool)
  lines.push(
    "## Messaging",
    "- Reply in current session → automatically routes to the source channel (Signal, Telegram, etc.)",
    "- Cross-session messaging → use sessions_send(sessionKey, message)",
    "- Never use exec/curl for provider messaging; Clawdbot handles all routing internally.",
    "- **As a subagent, do NOT use the message tool** - use report_back instead to communicate results.",
    "",
  );

  // Context files (workspace files like main agent)
  const contextFiles = params.contextFiles ?? [];
  if (contextFiles.length > 0) {
    lines.push(
      "# Project Context",
      "",
      "The following project context files have been loaded:",
      "",
    );
    for (const file of contextFiles) {
      lines.push(`## ${file.path}`, "", file.content, "");
    }
  }

  // Silent replies (like main agent)
  lines.push(
    "## Silent Replies",
    `When you have nothing to say, respond with ONLY: ${SILENT_REPLY_TOKEN}`,
    "",
    "⚠️ Rules:",
    "- It must be your ENTIRE message — nothing else",
    `- Never append it to an actual response (never include "${SILENT_REPLY_TOKEN}" in real replies)`,
    "- Never wrap it in markdown or code blocks",
    "",
    `❌ Wrong: "Here's help... ${SILENT_REPLY_TOKEN}"`,
    `❌ Wrong: "\`${SILENT_REPLY_TOKEN}\`"`,
    `✅ Right: ${SILENT_REPLY_TOKEN}`,
    "",
  );

  // Runtime info (like main agent)
  lines.push(
    "## Runtime",
    `Runtime: ${[
      runtimeInfo?.host ? `host=${runtimeInfo.host}` : "",
      runtimeInfo?.os
        ? `os=${runtimeInfo.os}${runtimeInfo?.arch ? ` (${runtimeInfo.arch})` : ""}`
        : runtimeInfo?.arch
          ? `arch=${runtimeInfo.arch}`
          : "",
      runtimeInfo?.node ? `node=${runtimeInfo.node}` : "",
      runtimeInfo?.model ? `model=${runtimeInfo.model}` : "",
      runtimeChannel ? `channel=${runtimeChannel}` : "",
      runtimeChannel
        ? `capabilities=${
            runtimeCapabilities.length > 0
              ? runtimeCapabilities.join(",")
              : "none"
          }`
        : "",
      "subagent=true",
    ]
      .filter(Boolean)
      .join(" | ")}`,
  );

  return lines.filter((line): line is string => line !== undefined).join("\n");
}

function buildSubagentAnnouncePrompt(params: {
  requesterSessionKey?: string;
  requesterChannel?: string;
  announceChannel: string;
  task: string;
  subagentReply?: string;
  elapsedMs?: number;
  workspaceDir?: string;
}) {
  // Calculate human-readable elapsed time
  let elapsedText = "";
  if (params.elapsedMs && params.elapsedMs > 0) {
    const seconds = Math.round(params.elapsedMs / 1000);
    if (seconds < 10) {
      elapsedText = "just a few seconds";
    } else if (seconds < 60) {
      elapsedText = `about ${seconds} seconds`;
    } else {
      const minutes = Math.round(seconds / 60);
      elapsedText =
        minutes === 1 ? "about a minute" : `about ${minutes} minutes`;
    }
  }

  // Load SOUL.md for persona guidance
  const soulContent = loadSoulContent(params.workspaceDir);

  const lines = [
    "# Background Task Announcement",
    "",
    "Your background task has completed. Write a message to share the results.",
    "",
    "## Context",
    `- **Original task:** ${params.task}`,
    params.subagentReply
      ? `- **Result:** ${params.subagentReply}`
      : "- **Result:** (not available)",
    elapsedText ? `- **Duration:** ${elapsedText}` : undefined,
    "",
    "## Guidelines",
    "",
    "1. **Frame as notification** - The user may have continued chatting while this ran in the background. Present results as new information arriving, not as returning from somewhere.",
    "2. **Lead with the results** - Share the useful information directly. Avoid preamble.",
    "3. **Stay concise** - Summarize key findings. Don't repeat the full raw output.",
    "4. **Match your persona** - Use the voice and style from SOUL.md if available.",
    "",
    "## Avoid",
    '- Phrases like "I\'m back" or "just finished" (implies you left)',
    '- "Task complete" or "I already completed" (robotic)',
    "- System-style announcements",
    "- Excessive bullet points for simple information",
    "",
    'Reply "ANNOUNCE_SKIP" only if the task completely failed with no useful output.',
  ];

  // Add persona reminder if SOUL.md exists
  if (soulContent) {
    lines.push("");
    lines.push("## Your Persona (from SOUL.md)");
    lines.push("");
    lines.push("Match this voice/style:");
    lines.push(soulContent);
  }

  return lines.filter((line): line is string => line !== undefined).join("\n");
}

/**
 * Runs cleanup for a subagent session (label patching and optional deletion).
 * This is called after subagent completion - the subagent uses report_back tool
 * to send results, so we no longer force an announce step.
 */
export async function runSubagentCleanup(params: {
  childSessionKey: string;
  cleanup: "delete" | "keep";
  label?: string;
}): Promise<void> {
  try {
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
  } catch {
    // Best-effort cleanup; ignore failures
  }
}

export async function runSubagentAnnounceFlow(params: {
  childSessionKey: string;
  childRunId: string;
  requesterSessionKey: string;
  requesterChannel?: string;
  requesterTo?: string;
  requesterDisplayKey: string;
  task: string;
  timeoutMs: number;
  cleanup: "delete" | "keep";
  roundOneReply?: string;
  waitForCompletion?: boolean;
  startedAt?: number;
  endedAt?: number;
  label?: string;
}): Promise<boolean> {
  let didAnnounce = false;
  try {
    let reply = params.roundOneReply;
    if (!reply && params.waitForCompletion !== false) {
      const waitMs = Math.min(params.timeoutMs, 60_000);
      const wait = (await callGateway({
        method: "agent.wait",
        params: {
          runId: params.childRunId,
          timeoutMs: waitMs,
        },
        timeoutMs: waitMs + 2000,
      })) as { status?: string };
      if (wait?.status !== "ok") return false;
      reply = await readLatestAssistantReply({
        sessionKey: params.childSessionKey,
      });
    }

    if (!reply) {
      reply = await readLatestAssistantReply({
        sessionKey: params.childSessionKey,
      });
    }

    // Build announce targets: prioritize stored routing info
    type AnnounceDestination = {
      channel: string;
      to: string;
      accountId?: string;
    };
    const announceTargets: AnnounceDestination[] = [];

    // Primary target: use stored requesterChannel + requesterTo if available
    if (params.requesterChannel && params.requesterTo) {
      announceTargets.push({
        channel: params.requesterChannel,
        to: params.requesterTo,
      });
    } else {
      // Fall back to session lookup
      const lookedUp = await resolveAnnounceTarget({
        sessionKey: params.requesterSessionKey,
        displayKey: params.requesterDisplayKey,
      });
      if (lookedUp) {
        announceTargets.push({
          channel: lookedUp.channel,
          to: lookedUp.to,
          accountId: lookedUp.accountId,
        });
      }
    }

    // Also announce to main session if it has a valid messaging channel
    const cfg = loadConfig();
    const mainKey = resolveMainSessionKey(cfg);
    const mainAgentId = resolveAgentIdFromSessionKey(mainKey);
    const mainStorePath = resolveStorePath(cfg.session?.store, {
      agentId: mainAgentId,
    });
    const mainEntry = loadSessionStore(mainStorePath)[mainKey];
    const mainChannel = mainEntry?.lastChannel;
    const mainTo = mainEntry?.lastTo;

    // Add main session as additional target if it's a valid messaging channel
    // Skip internal channels like "webchat" that aren't actual messaging destinations
    const mainIsMessagingChannel = Boolean(
      mainChannel && mainTo && normalizeChannelId(mainChannel),
    );
    if (mainIsMessagingChannel && mainChannel && mainTo) {
      const isDuplicate = announceTargets.some(
        (t) => t.channel === mainChannel && t.to === mainTo,
      );
      if (!isDuplicate) {
        announceTargets.push({
          channel: mainChannel,
          to: mainTo,
          accountId: mainEntry?.lastAccountId,
        });
      }
    }

    // Always inject into main session transcript so the main agent has context
    const shouldInjectToMain = Boolean(mainKey);

    if (announceTargets.length === 0 && !shouldInjectToMain) return false;

    const primaryTarget = announceTargets[0];
    const announceChannel =
      primaryTarget?.channel ?? params.requesterChannel ?? "webchat";
    const elapsedMs =
      typeof params.startedAt === "number" && typeof params.endedAt === "number"
        ? Math.max(0, params.endedAt - params.startedAt)
        : undefined;
    const announcePrompt = buildSubagentAnnouncePrompt({
      requesterSessionKey: params.requesterSessionKey,
      requesterChannel: params.requesterChannel,
      announceChannel,
      task: params.task,
      subagentReply: reply,
      elapsedMs,
      workspaceDir: DEFAULT_AGENT_WORKSPACE_DIR,
    });

    const announceReply = await runAgentStep({
      sessionKey: params.childSessionKey,
      message: "Sub-agent announce step.",
      extraSystemPrompt: announcePrompt,
      timeoutMs: params.timeoutMs,
      channel: INTERNAL_MESSAGE_CHANNEL,
      lane: AGENT_LANE_NESTED,
    });

    if (
      !announceReply ||
      !announceReply.trim() ||
      isAnnounceSkip(announceReply)
    )
      return false;

    const message = announceReply.trim();

    // Inject into main session transcript so the main agent has context
    // Uses chat.inject gateway method which also broadcasts to webchat UI
    if (shouldInjectToMain) {
      try {
        const labelText = params.label
          ? `Subagent "${params.label}" completed`
          : "Subagent completed";
        await callGateway({
          method: "chat.inject",
          params: {
            sessionKey: mainKey,
            message,
            label: labelText,
          },
          timeoutMs: 10_000,
        });
        didAnnounce = true;
      } catch {
        // Best-effort injection
      }
    }

    // Send to all messaging channel targets
    for (const target of announceTargets) {
      await callGateway({
        method: "send",
        params: {
          to: target.to,
          message,
          channel: target.channel,
          accountId: target.accountId,
          idempotencyKey: crypto.randomUUID(),
        },
        timeoutMs: 10_000,
      });
      didAnnounce = true;
    }
  } catch {
    // Best-effort follow-ups; ignore failures to avoid breaking the caller response.
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
