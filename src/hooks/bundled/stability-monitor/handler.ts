/**
 * Stability Monitor hook handler
 *
 * Tracks per-session metadata only:
 * - exchange count
 * - session duration
 */

import {
  DEFAULT_MEMORY_ALT_FILENAME,
  type WorkspaceBootstrapFile,
} from "../../../agents/workspace.js";
import { createSubsystemLogger } from "../../../logging/subsystem.js";
import { isAgentBootstrapEvent, type HookHandler } from "../../hooks.js";

const MAX_SESSION_STATES = 1000;
const log = createSubsystemLogger("hooks/stability-monitor");

interface SessionState {
  sessionStartTs: number;
  exchangeCount: number;
}

const sessionStates = new Map<string, SessionState>();
const sessionLastTouched = new Map<string, number>();

function evictOldestSessionState(): void {
  if (sessionStates.size <= MAX_SESSION_STATES) {
    return;
  }

  let oldestKey: string | undefined;
  let oldestTs = Number.POSITIVE_INFINITY;

  for (const [key, ts] of sessionLastTouched) {
    if (ts < oldestTs) {
      oldestTs = ts;
      oldestKey = key;
    }
  }

  if (!oldestKey) {
    return;
  }

  sessionStates.delete(oldestKey);
  sessionLastTouched.delete(oldestKey);
}

function getOrCreateSessionState(sessionKey: string, now: number): SessionState {
  let state = sessionStates.get(sessionKey);
  if (!state) {
    state = {
      sessionStartTs: now,
      exchangeCount: 0,
    };
    sessionStates.set(sessionKey, state);
  }

  sessionLastTouched.set(sessionKey, now);
  evictOldestSessionState();
  return state;
}

function formatDuration(ms: number): string {
  const minutes = Math.floor(ms / 60000);
  if (minutes < 60) return `${minutes}m`;

  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
}

export const handler: HookHandler = async (event) => {
  if (!isAgentBootstrapEvent(event)) {
    return;
  }

  const context = event.context;
  const sessionKey = context.sessionKey || event.sessionKey || "unknown";
  const now = Date.now();
  const state = getOrCreateSessionState(sessionKey, now);

  state.exchangeCount += 1;

  const stabilityContextFile: WorkspaceBootstrapFile = {
    name: DEFAULT_MEMORY_ALT_FILENAME,
    path: "_stability_context.memory.md",
    content: `Session: ${state.exchangeCount} exchanges | Duration: ${formatDuration(now - state.sessionStartTs)}`,
    missing: false,
  };

  context.bootstrapFiles.push(stabilityContextFile);

  log.debug("Injected stability context", {
    sessionKey,
    exchangeCount: state.exchangeCount,
  });
};

export default handler;
