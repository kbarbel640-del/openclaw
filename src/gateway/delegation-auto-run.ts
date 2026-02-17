import type { CliDeps } from "../cli/deps.js";
import { createDefaultDeps } from "../cli/deps.js";
import { agentCommand } from "../commands/agent.js";
import type { AgentCommandOpts } from "../commands/agent/types.js";
import type { OpenClawConfig } from "../config/types.openclaw.js";
import { defaultRuntime, type RuntimeEnv } from "../runtime.js";
import { INTERNAL_MESSAGE_CHANNEL } from "../utils/message-channel.js";

export type DelegationAutoRunItem = {
  delegationId: string;
  direction: "downward" | "upward";
  priority: "critical" | "high" | "normal" | "low";
  fromAgentId: string;
  task: string;
  state: string;
};

type RunAgentParams = {
  agentId: string;
  message: string;
  deps?: CliDeps;
  runtime?: RuntimeEnv;
};

type DelegationAutoRunDeps = {
  now: () => number;
  setTimeout: typeof setTimeout;
  clearTimeout: typeof clearTimeout;
  runAgent: (params: RunAgentParams) => Promise<void>;
};

function clampDebounceMs(raw: unknown): number {
  const v = typeof raw === "number" && Number.isFinite(raw) ? Math.floor(raw) : 1200;
  // Keep it bounded so a bad config doesn't stall the system.
  return Math.min(30_000, Math.max(0, v));
}

function buildAutoRunMessage(items: DelegationAutoRunItem[]): string {
  const lines: string[] = [];
  lines.push(`Delegation auto-run: ${items.length} new delegation(s) to process.`);
  lines.push("");
  for (const it of items) {
    const task = it.task.replace(/\s+/g, " ").trim();
    lines.push(
      `- ${it.delegationId} (${it.direction}, ${it.priority}, state=${it.state}) from ${it.fromAgentId}: ${task}`,
    );
  }
  lines.push("");
  const hasUp = items.some((i) => i.direction === "upward");
  const hasDown = items.some((i) => i.direction === "downward");
  if (hasUp) {
    lines.push("For upward requests:");
    lines.push(
      "- Use the delegation tool to review each request (approve/reject/redirect) with clear reasoning.",
    );
  }
  if (hasDown) {
    lines.push("For downward assignments:");
    lines.push(
      "- Use the delegation tool to accept, do the work, then complete with a concise result summary.",
    );
  }
  lines.push("");
  lines.push(
    "If anything is blocked, complete with status=failed and include the minimum info needed to unblock.",
  );
  return lines.join("\n");
}

function isEnabled(cfg: OpenClawConfig): boolean {
  return cfg.agents?.defaults?.delegation?.autoRun !== false;
}

export class DelegationAutoRunScheduler {
  private readonly pendingByAgentId = new Map<
    string,
    { itemsById: Map<string, DelegationAutoRunItem>; timer: ReturnType<typeof setTimeout> | null }
  >();

  constructor(private readonly deps: DelegationAutoRunDeps) {}

  resetForTests() {
    for (const entry of this.pendingByAgentId.values()) {
      if (entry.timer) {
        this.deps.clearTimeout(entry.timer);
      }
    }
    this.pendingByAgentId.clear();
  }

  schedule(params: {
    cfg: OpenClawConfig;
    targetAgentId: string;
    item: DelegationAutoRunItem;
    deps?: CliDeps;
    runtime?: RuntimeEnv;
  }) {
    const { cfg, targetAgentId, item } = params;
    if (!isEnabled(cfg)) {
      return;
    }
    const agentId = targetAgentId.trim();
    if (!agentId) {
      return;
    }
    const debounceMs = clampDebounceMs(cfg.agents?.defaults?.delegation?.debounceMs);

    const existing =
      this.pendingByAgentId.get(agentId) ??
      ({
        itemsById: new Map<string, DelegationAutoRunItem>(),
        timer: null,
      } as const);

    existing.itemsById.set(item.delegationId, item);
    if (!this.pendingByAgentId.has(agentId)) {
      this.pendingByAgentId.set(agentId, { ...existing });
    }

    const entry = this.pendingByAgentId.get(agentId);
    if (!entry) {
      return;
    }
    if (entry.timer) {
      return; // already scheduled
    }

    entry.timer = this.deps.setTimeout(() => {
      const flushed = this.pendingByAgentId.get(agentId);
      if (!flushed) {
        return;
      }
      const items = [...flushed.itemsById.values()];
      flushed.itemsById.clear();
      flushed.timer = null;
      if (items.length === 0) {
        return;
      }
      const message = buildAutoRunMessage(items);
      void this.deps
        .runAgent({
          agentId,
          message,
          deps: params.deps,
          runtime: params.runtime,
        })
        .catch(() => {
          // Best-effort: don't fail the original RPC on background agent execution.
        });
    }, debounceMs);
  }
}

async function defaultRunAgent({ agentId, message, deps, runtime }: RunAgentParams) {
  const resolvedDeps = deps ?? createDefaultDeps();
  const resolvedRuntime = runtime ?? defaultRuntime;
  const sessionKey = `agent:${agentId}:main`;

  const opts: AgentCommandOpts = {
    message,
    agentId,
    sessionKey,
    deliver: false,
    channel: INTERNAL_MESSAGE_CHANNEL,
    messageChannel: INTERNAL_MESSAGE_CHANNEL,
    lane: "delegation-auto",
  };

  await agentCommand(opts, resolvedRuntime, resolvedDeps);
}

export const delegationAutoRunScheduler = new DelegationAutoRunScheduler({
  now: () => Date.now(),
  setTimeout,
  clearTimeout,
  runAgent: defaultRunAgent,
});
