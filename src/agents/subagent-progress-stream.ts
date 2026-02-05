import type { DeliveryContext } from "../utils/delivery-context.js";
import { createThreadDiscord } from "../discord/send.messages.js";
import { sendMessageDiscord } from "../discord/send.outbound.js";
import { defaultRuntime } from "../runtime.js";
import { sendMessageSlack, createSlackThread } from "../slack/send.js";

// Batching configuration
const DEBOUNCE_MS = 3000;
const MAX_TOOLS_PER_DIGEST = 5;
const NON_THREADED_DEBOUNCE_MS = 5000;

export type ProgressState = {
  runId: string;
  label: string;
  threadId?: string;
  channelId?: string;
  channel?: string;
  accountId?: string;
  to?: string;
  pendingTools: Array<{ name: string; phase: "start" | "result"; timestamp: number }>;
  lastFlushAt: number;
  startedAt: number;
  flushTimer?: ReturnType<typeof setTimeout>;
  supportsThreads: boolean;
};

const progressStates = new Map<string, ProgressState>();

// Channels that support threading
const THREADED_CHANNELS = new Set(["discord", "slack"]);

function supportsThreads(channel?: string): boolean {
  if (!channel) {
    return false;
  }
  return THREADED_CHANNELS.has(channel.toLowerCase());
}

export function getProgressState(runId: string): ProgressState | undefined {
  return progressStates.get(runId);
}

export function initProgressState(params: {
  runId: string;
  label: string;
  origin?: DeliveryContext;
}): ProgressState {
  const existing = progressStates.get(params.runId);
  if (existing) {
    return existing;
  }

  const channel = params.origin?.channel?.toLowerCase();
  const state: ProgressState = {
    runId: params.runId,
    label: params.label,
    channel,
    accountId: params.origin?.accountId,
    to: params.origin?.to,
    pendingTools: [],
    lastFlushAt: 0,
    startedAt: Date.now(),
    supportsThreads: supportsThreads(channel),
  };
  progressStates.set(params.runId, state);
  return state;
}

export function cleanupProgressState(runId: string): void {
  const state = progressStates.get(runId);
  if (state?.flushTimer) {
    clearTimeout(state.flushTimer);
  }
  progressStates.delete(runId);
}

export async function createSubagentProgressThread(params: {
  runId: string;
  channel: string;
  to: string;
  accountId?: string;
  label: string;
}): Promise<{ threadId?: string; channelId?: string }> {
  const state = progressStates.get(params.runId);
  if (!state) {
    return {};
  }

  // Already has a thread
  if (state.threadId) {
    return { threadId: state.threadId, channelId: state.channelId };
  }

  const channelLower = params.channel.toLowerCase();

  try {
    if (channelLower === "discord") {
      // For Discord, we need to first send a message, then create a thread from it
      const initialMessage = `🔄 **Task: ${params.label}**\nProgress updates will appear below...`;
      const sendResult = await sendMessageDiscord(params.to, initialMessage, {
        accountId: params.accountId,
      });

      if (sendResult.messageId && sendResult.messageId !== "unknown") {
        // Create thread from the message
        await createThreadDiscord(
          sendResult.channelId,
          {
            messageId: sendResult.messageId,
            name: `Progress: ${params.label.slice(0, 90)}`,
            autoArchiveMinutes: 60,
          },
          { accountId: params.accountId },
        );

        // The thread ID is the same as the message ID in Discord
        state.threadId = sendResult.messageId;
        state.channelId = sendResult.channelId;

        return { threadId: sendResult.messageId, channelId: sendResult.channelId };
      }
    } else if (channelLower === "slack") {
      // For Slack, post initial message and use its ts as thread_ts
      const result = await createSlackThread({
        to: params.to,
        accountId: params.accountId,
        initialMessage: `🔄 *Task: ${params.label}*\nProgress updates will appear in this thread...`,
      });

      if (result.threadTs) {
        state.threadId = result.threadTs;
        state.channelId = result.channelId;
        return { threadId: result.threadTs, channelId: result.channelId };
      }
    }
  } catch (err) {
    defaultRuntime.error?.(`Failed to create progress thread: ${String(err)}`);
    // Fall back to prefixed messages
    state.supportsThreads = false;
  }

  return {};
}

export function queueProgressUpdate(
  runId: string,
  toolName: string,
  phase: "start" | "result",
): void {
  const state = progressStates.get(runId);
  if (!state) {
    return;
  }

  state.pendingTools.push({
    name: toolName,
    phase,
    timestamp: Date.now(),
  });

  // Clear existing timer
  if (state.flushTimer) {
    clearTimeout(state.flushTimer);
    state.flushTimer = undefined;
  }

  // Flush immediately if we hit max tools
  if (state.pendingTools.length >= MAX_TOOLS_PER_DIGEST) {
    void flushProgressDigest(runId);
    return;
  }

  // Schedule debounced flush
  const debounceMs = state.supportsThreads ? DEBOUNCE_MS : NON_THREADED_DEBOUNCE_MS;
  state.flushTimer = setTimeout(() => {
    void flushProgressDigest(runId);
  }, debounceMs);
}

export async function flushProgressDigest(runId: string): Promise<void> {
  const state = progressStates.get(runId);
  if (!state || state.pendingTools.length === 0) {
    return;
  }

  // Clear timer if exists
  if (state.flushTimer) {
    clearTimeout(state.flushTimer);
    state.flushTimer = undefined;
  }

  // Collect pending tools and clear
  const tools = state.pendingTools.splice(0);
  const now = Date.now();
  state.lastFlushAt = now;

  // Build digest message
  const elapsedSec = Math.round((now - state.startedAt) / 1000);
  const toolNames = [...new Set(tools.map((t) => t.name))];
  const toolList = toolNames.slice(0, 8).join(", ");
  const moreCount = toolNames.length > 8 ? ` +${toolNames.length - 8}` : "";

  const digestMessage = state.supportsThreads
    ? `Progress (${elapsedSec}s): ${toolList}${moreCount}`
    : `[${state.label}] Progress (${elapsedSec}s): ${toolList}${moreCount}`;

  // Send to appropriate destination
  try {
    if (state.channel === "discord" && state.to) {
      // If we have a thread, post to the thread (channelId is the thread)
      const targetChannel = state.threadId || state.to;
      await sendMessageDiscord(targetChannel, digestMessage, {
        accountId: state.accountId,
      });
    } else if (state.channel === "slack" && state.to) {
      await sendMessageSlack(state.to, digestMessage, {
        accountId: state.accountId,
        threadTs: state.threadId,
      });
    }
    // For other channels, we could add support here, but they'll use prefixed inline format
  } catch (err) {
    defaultRuntime.error?.(`Failed to send progress digest: ${String(err)}`);
  }
}

export function buildBriefSummary(fullReply: string | undefined, maxChars = 300): string {
  if (!fullReply || !fullReply.trim()) {
    return "(no output)";
  }

  const trimmed = fullReply.trim();
  if (trimmed.length <= maxChars) {
    return trimmed;
  }

  // Find a good break point (sentence end, newline, or word boundary)
  let breakPoint = maxChars;

  // Try to find sentence end
  const sentenceEnd = trimmed.lastIndexOf(".", maxChars - 1);
  if (sentenceEnd > maxChars * 0.5) {
    breakPoint = sentenceEnd + 1;
  } else {
    // Try newline
    const newline = trimmed.lastIndexOf("\n", maxChars - 1);
    if (newline > maxChars * 0.5) {
      breakPoint = newline;
    } else {
      // Try word boundary
      const space = trimmed.lastIndexOf(" ", maxChars - 1);
      if (space > maxChars * 0.7) {
        breakPoint = space;
      }
    }
  }

  return trimmed.slice(0, breakPoint).trim() + "...";
}

export function buildCompletionMessage(params: {
  label: string;
  briefSummary: string;
  hasProgressThread: boolean;
  statusLabel: string;
}): string {
  const threadRef = params.hasProgressThread ? " See progress thread for details." : "";

  // Keep it brief - 1-2 sentences
  if (params.statusLabel.includes("completed")) {
    return `Task "${params.label}" completed. ${params.briefSummary}${threadRef}`;
  } else if (params.statusLabel.includes("timed out")) {
    return `Task "${params.label}" timed out.${threadRef}`;
  } else if (params.statusLabel.includes("failed")) {
    return `Task "${params.label}" failed: ${params.statusLabel.replace("failed: ", "")}.${threadRef}`;
  }

  return `Task "${params.label}" finished. ${params.briefSummary}${threadRef}`;
}

// For testing
export function resetProgressStatesForTests(): void {
  for (const state of progressStates.values()) {
    if (state.flushTimer) {
      clearTimeout(state.flushTimer);
    }
  }
  progressStates.clear();
}

export function getProgressStatesForTests(): Map<string, ProgressState> {
  return progressStates;
}
