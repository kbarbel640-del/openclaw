import type { Client } from "@buape/carbon";
import { hasControlCommand } from "../../auto-reply/command-detection.js";
import {
  createInboundDebouncer,
  resolveInboundDebounceMs,
} from "../../auto-reply/inbound-debounce.js";
import { resolveOpenProviderRuntimeGroupPolicy } from "../../config/runtime-group-policy.js";
import { danger } from "../../globals.js";
import { createSubsystemLogger } from "../../logging/subsystem.js";
import type { DiscordMessageEvent, DiscordMessageHandler } from "./listeners.js";
import { preflightDiscordMessage } from "./message-handler.preflight.js";
import type { DiscordMessagePreflightParams } from "./message-handler.preflight.types.js";
import { processDiscordMessage } from "./message-handler.process.js";
import {
  hasDiscordMessageStickers,
  resolveDiscordMessageChannelId,
  resolveDiscordMessageText,
} from "./message-utils.js";

const processingLog = createSubsystemLogger("discord/processing");

// Concurrency gate constants.
// Max concurrent message-processing tasks (each may hold an LLM call).
const DISCORD_MAX_CONCURRENT_PROCESSING = 10;
// Max messages waiting for a processing slot before new ones are dropped.
const DISCORD_MAX_QUEUED_MESSAGES = 50;
// Hard timeout per message: frees the concurrency slot even if the LLM is
// still running, so that one stuck call cannot starve all subsequent messages.
const DISCORD_PROCESSING_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Limits concurrent async operations with a bounded wait queue and
 * per-task timeout.  Prevents unbounded LLM calls from starving the
 * Node.js event loop.
 */
export function createProcessingGate(params: {
  maxConcurrent: number;
  maxQueued: number;
  timeoutMs: number;
  onDrop?: () => void;
  onTimeout?: () => void;
}) {
  let active = 0;
  const waiters: Array<() => void> = [];

  function release() {
    active--;
    const next = waiters.shift();
    if (next) {
      active++;
      next();
    }
  }

  async function run(fn: () => Promise<void>): Promise<void> {
    if (active >= params.maxConcurrent) {
      if (waiters.length >= params.maxQueued) {
        params.onDrop?.();
        return;
      }
      await new Promise<void>((resolve) => {
        waiters.push(resolve);
      });
    } else {
      active++;
    }

    const fnPromise = fn();
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    try {
      const timeoutPromise = new Promise<"timeout">((resolve) => {
        timeoutId = setTimeout(() => resolve("timeout"), params.timeoutMs);
        timeoutId.unref?.();
      });

      const result = await Promise.race([fnPromise.then(() => "ok" as const), timeoutPromise]);

      if (result === "timeout") {
        // Prevent unhandled rejection from the still-running fn.
        fnPromise.catch(() => {});
        params.onTimeout?.();
      }
    } finally {
      if (timeoutId !== undefined) {
        clearTimeout(timeoutId);
      }
      release();
    }
  }

  return {
    run,
    get activeCount() {
      return active;
    },
    get queuedCount() {
      return waiters.length;
    },
  };
}

type DiscordMessageHandlerParams = Omit<
  DiscordMessagePreflightParams,
  "ackReactionScope" | "groupPolicy" | "data" | "client"
>;

export function createDiscordMessageHandler(
  params: DiscordMessageHandlerParams,
): DiscordMessageHandler {
  const { groupPolicy } = resolveOpenProviderRuntimeGroupPolicy({
    providerConfigPresent: params.cfg.channels?.discord !== undefined,
    groupPolicy: params.discordConfig?.groupPolicy,
    defaultGroupPolicy: params.cfg.channels?.defaults?.groupPolicy,
  });
  const ackReactionScope = params.cfg.messages?.ackReactionScope ?? "group-mentions";
  const debounceMs = resolveInboundDebounceMs({ cfg: params.cfg, channel: "discord" });

  const gate = createProcessingGate({
    maxConcurrent: DISCORD_MAX_CONCURRENT_PROCESSING,
    maxQueued: DISCORD_MAX_QUEUED_MESSAGES,
    timeoutMs: DISCORD_PROCESSING_TIMEOUT_MS,
    onDrop: () => {
      processingLog.warn("Message dropped — processing queue full", {
        active: gate.activeCount,
        queued: gate.queuedCount,
        consoleMessage: `discord: dropping message (${gate.activeCount} active, ${gate.queuedCount} queued)`,
      });
    },
    onTimeout: () => {
      processingLog.warn("Message processing timed out", {
        timeoutMs: DISCORD_PROCESSING_TIMEOUT_MS,
        consoleMessage: `discord: message processing timed out after ${DISCORD_PROCESSING_TIMEOUT_MS / 1000}s`,
      });
    },
  });

  const processWithGate = async (entries: Array<{ data: DiscordMessageEvent; client: Client }>) => {
    const last = entries.at(-1);
    if (!last) {
      return;
    }

    await gate.run(async () => {
      if (entries.length === 1) {
        const ctx = await preflightDiscordMessage({
          ...params,
          ackReactionScope,
          groupPolicy,
          data: last.data,
          client: last.client,
        });
        if (!ctx) {
          return;
        }
        await processDiscordMessage(ctx);
        return;
      }
      const combinedBaseText = entries
        .map((entry) => resolveDiscordMessageText(entry.data.message, { includeForwarded: false }))
        .filter(Boolean)
        .join("\n");
      const syntheticMessage = {
        ...last.data.message,
        content: combinedBaseText,
        attachments: [],
        message_snapshots: (last.data.message as { message_snapshots?: unknown }).message_snapshots,
        messageSnapshots: (last.data.message as { messageSnapshots?: unknown }).messageSnapshots,
        rawData: {
          ...(last.data.message as { rawData?: Record<string, unknown> }).rawData,
        },
      };
      const syntheticData: DiscordMessageEvent = {
        ...last.data,
        message: syntheticMessage,
      };
      const ctx = await preflightDiscordMessage({
        ...params,
        ackReactionScope,
        groupPolicy,
        data: syntheticData,
        client: last.client,
      });
      if (!ctx) {
        return;
      }
      if (entries.length > 1) {
        const ids = entries.map((entry) => entry.data.message?.id).filter(Boolean) as string[];
        if (ids.length > 0) {
          const ctxBatch = ctx as typeof ctx & {
            MessageSids?: string[];
            MessageSidFirst?: string;
            MessageSidLast?: string;
          };
          ctxBatch.MessageSids = ids;
          ctxBatch.MessageSidFirst = ids[0];
          ctxBatch.MessageSidLast = ids[ids.length - 1];
        }
      }
      await processDiscordMessage(ctx);
    });
  };

  const debouncer = createInboundDebouncer<{ data: DiscordMessageEvent; client: Client }>({
    debounceMs,
    buildKey: (entry) => {
      const message = entry.data.message;
      const authorId = entry.data.author?.id;
      if (!message || !authorId) {
        return null;
      }
      const channelId = resolveDiscordMessageChannelId({
        message,
        eventChannelId: entry.data.channel_id,
      });
      if (!channelId) {
        return null;
      }
      return `discord:${params.accountId}:${channelId}:${authorId}`;
    },
    shouldDebounce: (entry) => {
      const message = entry.data.message;
      if (!message) {
        return false;
      }
      if (message.attachments && message.attachments.length > 0) {
        return false;
      }
      if (hasDiscordMessageStickers(message)) {
        return false;
      }
      const baseText = resolveDiscordMessageText(message, { includeForwarded: false });
      if (!baseText.trim()) {
        return false;
      }
      return !hasControlCommand(baseText, params.cfg);
    },
    onFlush: processWithGate,
    onError: (err) => {
      params.runtime.error?.(danger(`discord debounce flush failed: ${String(err)}`));
    },
  });

  return async (data, client) => {
    try {
      await debouncer.enqueue({ data, client });
    } catch (err) {
      params.runtime.error?.(danger(`handler failed: ${String(err)}`));
    }
  };
}
