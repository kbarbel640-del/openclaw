import type { OpenClawConfig } from "../../config/config.js";
import type { FinalizedMsgContext, MsgContext } from "../templating.js";
import { resolveSessionAgentId } from "../../agents/agent-scope.js";
import { abortEmbeddedPiRun } from "../../agents/pi-embedded.js";
import { listSubagentRunsForRequester } from "../../agents/subagent-registry.js";
import {
  resolveInternalSessionKey,
  resolveMainSessionAlias,
} from "../../agents/tools/sessions-helpers.js";
import {
  loadSessionStore,
  resolveStorePath,
  type SessionEntry,
  updateSessionStore,
} from "../../config/sessions.js";
import { logVerbose } from "../../globals.js";
import { parseAgentSessionKey } from "../../routing/session-key.js";
import { resolveCommandAuthorization } from "../command-auth.js";
import { normalizeCommandBody } from "../commands-registry.js";
import { stripMentions, stripStructuralPrefixes } from "./mentions.js";
import { clearSessionQueues } from "./queue.js";

const ABORT_TRIGGERS = new Set(["stop", "esc", "abort", "wait", "exit", "interrupt"]);

// Two-word "stop all" variants that stop every active session for the current agent,
// not just the session-spawn-registered subagents.
const STOP_ALL_TRIGGERS = new Set([
  "stop all",
  "abort all",
  "stop everything",
  "cancel all",
  "cancel everything",
]);
const ABORT_MEMORY = new Map<string, boolean>();

export function isAbortTrigger(text?: string): boolean {
  if (!text) {
    return false;
  }
  const normalized = text.trim().toLowerCase();
  return ABORT_TRIGGERS.has(normalized);
}

/**
 * Returns true when the user wants to stop ALL active sessions for the current agent
 * (e.g., "stop all", "abort all").  Unlike a regular abort trigger, this cascades
 * beyond the subagent registry and kills every recently-active session in the agent.
 */
export function isStopAllTrigger(text?: string): boolean {
  if (!text) {
    return false;
  }
  const normalized = text.trim().toLowerCase();
  return STOP_ALL_TRIGGERS.has(normalized);
}

export function getAbortMemory(key: string): boolean | undefined {
  return ABORT_MEMORY.get(key);
}

export function setAbortMemory(key: string, value: boolean): void {
  ABORT_MEMORY.set(key, value);
}

export function formatAbortReplyText(stoppedSubagents?: number): string {
  if (typeof stoppedSubagents !== "number" || stoppedSubagents <= 0) {
    return "⚙️ Agent was aborted.";
  }
  const label = stoppedSubagents === 1 ? "sub-agent" : "sub-agents";
  return `⚙️ Agent was aborted. Stopped ${stoppedSubagents} ${label}.`;
}

function resolveSessionEntryForKey(
  store: Record<string, SessionEntry> | undefined,
  sessionKey: string | undefined,
) {
  if (!store || !sessionKey) {
    return {};
  }
  const direct = store[sessionKey];
  if (direct) {
    return { entry: direct, key: sessionKey };
  }
  return {};
}

function resolveAbortTargetKey(ctx: MsgContext): string | undefined {
  const target = ctx.CommandTargetSessionKey?.trim();
  if (target) {
    return target;
  }
  const sessionKey = ctx.SessionKey?.trim();
  return sessionKey || undefined;
}

function normalizeRequesterSessionKey(
  cfg: OpenClawConfig,
  key: string | undefined,
): string | undefined {
  const cleaned = key?.trim();
  if (!cleaned) {
    return undefined;
  }
  const { mainKey, alias } = resolveMainSessionAlias(cfg);
  return resolveInternalSessionKey({ key: cleaned, alias, mainKey });
}

export function stopSubagentsForRequester(params: {
  cfg: OpenClawConfig;
  requesterSessionKey?: string;
}): { stopped: number } {
  const requesterKey = normalizeRequesterSessionKey(params.cfg, params.requesterSessionKey);
  if (!requesterKey) {
    return { stopped: 0 };
  }
  const runs = listSubagentRunsForRequester(requesterKey);
  if (runs.length === 0) {
    return { stopped: 0 };
  }

  const storeCache = new Map<string, Record<string, SessionEntry>>();
  const seenChildKeys = new Set<string>();
  let stopped = 0;

  for (const run of runs) {
    if (run.endedAt) {
      continue;
    }
    const childKey = run.childSessionKey?.trim();
    if (!childKey || seenChildKeys.has(childKey)) {
      continue;
    }
    seenChildKeys.add(childKey);

    const cleared = clearSessionQueues([childKey]);
    const parsed = parseAgentSessionKey(childKey);
    const storePath = resolveStorePath(params.cfg.session?.store, { agentId: parsed?.agentId });
    let store = storeCache.get(storePath);
    if (!store) {
      store = loadSessionStore(storePath);
      storeCache.set(storePath, store);
    }
    const entry = store[childKey];
    const sessionId = entry?.sessionId;
    const aborted = sessionId ? abortEmbeddedPiRun(sessionId) : false;

    if (aborted || cleared.followupCleared > 0 || cleared.laneCleared > 0) {
      stopped += 1;
    }
  }

  if (stopped > 0) {
    logVerbose(`abort: stopped ${stopped} subagent run(s) for ${requesterKey}`);
  }
  return { stopped };
}

/**
 * Stop ALL recently-active sessions for the current agent — not just those
 * registered via sessions_spawn.  Used by the "stop all" / "abort all" command.
 *
 * Scoping rules (to avoid killing unrelated work):
 *  - Only sessions whose key shares the same agent prefix (e.g. "agent:main").
 *  - Excludes the caller's own session key.
 *  - Excludes sessions that haven't been updated in the last 30 minutes.
 */
export function stopAllAgentSessions(params: {
  cfg: OpenClawConfig;
  currentSessionKey: string;
  sessionStore?: Record<string, SessionEntry>;
}): { stopped: number } {
  const { currentSessionKey, sessionStore } = params;
  if (!sessionStore) {
    return { stopped: 0 };
  }

  // Derive the agent prefix: e.g. "agent:main" from "agent:main:discord:channel:123"
  const parts = currentSessionKey.split(":");
  const agentPrefix = parts.slice(0, 2).join(":"); // "agent:main"
  const cutoff = Date.now() - 30 * 60 * 1000; // 30 minutes

  let stopped = 0;

  for (const [sessionKey, entry] of Object.entries(sessionStore)) {
    if (sessionKey === currentSessionKey) {
      continue; // don't abort yourself
    }
    if (!sessionKey.startsWith(agentPrefix + ":")) {
      continue; // different agent
    }
    if ((entry.updatedAt ?? 0) < cutoff) {
      continue; // idle / stale — skip
    }

    const cleared = clearSessionQueues([sessionKey, entry.sessionId]);
    const aborted = entry.sessionId ? abortEmbeddedPiRun(entry.sessionId) : false;

    if (aborted || cleared.followupCleared > 0 || cleared.laneCleared > 0) {
      stopped += 1;
    }
  }

  if (stopped > 0) {
    logVerbose(`abort: stop-all killed ${stopped} session(s) for agent ${agentPrefix}`);
  }
  return { stopped };
}

export async function tryFastAbortFromMessage(params: {
  ctx: FinalizedMsgContext;
  cfg: OpenClawConfig;
}): Promise<{ handled: boolean; aborted: boolean; stoppedSubagents?: number }> {
  const { ctx, cfg } = params;
  const targetKey = resolveAbortTargetKey(ctx);
  const agentId = resolveSessionAgentId({
    sessionKey: targetKey ?? ctx.SessionKey ?? "",
    config: cfg,
  });
  // Use RawBody/CommandBody for abort detection (clean message without structural context).
  const raw = stripStructuralPrefixes(ctx.CommandBody ?? ctx.RawBody ?? ctx.Body ?? "");
  const isGroup = ctx.ChatType?.trim().toLowerCase() === "group";
  const stripped = isGroup ? stripMentions(raw, ctx, cfg, agentId) : raw;
  const normalized = normalizeCommandBody(stripped);
  const abortRequested = normalized === "/stop" || isAbortTrigger(stripped);
  if (!abortRequested) {
    return { handled: false, aborted: false };
  }

  const commandAuthorized = ctx.CommandAuthorized;
  const auth = resolveCommandAuthorization({
    ctx,
    cfg,
    commandAuthorized,
  });
  if (!auth.isAuthorizedSender) {
    return { handled: false, aborted: false };
  }

  const abortKey = targetKey ?? auth.from ?? auth.to;
  const requesterSessionKey = targetKey ?? ctx.SessionKey ?? abortKey;

  if (targetKey) {
    const storePath = resolveStorePath(cfg.session?.store, { agentId });
    const store = loadSessionStore(storePath);
    const { entry, key } = resolveSessionEntryForKey(store, targetKey);
    const sessionId = entry?.sessionId;
    const aborted = sessionId ? abortEmbeddedPiRun(sessionId) : false;
    const cleared = clearSessionQueues([key ?? targetKey, sessionId]);
    if (cleared.followupCleared > 0 || cleared.laneCleared > 0) {
      logVerbose(
        `abort: cleared followups=${cleared.followupCleared} lane=${cleared.laneCleared} keys=${cleared.keys.join(",")}`,
      );
    }
    if (entry && key) {
      entry.abortedLastRun = true;
      entry.updatedAt = Date.now();
      store[key] = entry;
      await updateSessionStore(storePath, (nextStore) => {
        const nextEntry = nextStore[key] ?? entry;
        if (!nextEntry) {
          return;
        }
        nextEntry.abortedLastRun = true;
        nextEntry.updatedAt = Date.now();
        nextStore[key] = nextEntry;
      });
    } else if (abortKey) {
      setAbortMemory(abortKey, true);
    }
    const { stopped } = stopSubagentsForRequester({ cfg, requesterSessionKey });
    return { handled: true, aborted, stoppedSubagents: stopped };
  }

  if (abortKey) {
    setAbortMemory(abortKey, true);
  }
  const { stopped } = stopSubagentsForRequester({ cfg, requesterSessionKey });
  return { handled: true, aborted: false, stoppedSubagents: stopped };
}
