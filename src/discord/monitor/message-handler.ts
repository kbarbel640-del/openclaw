import type { Client } from "@buape/carbon";
import { abortEmbeddedPiRun } from "../../agents/pi-embedded.js";
import { hasControlCommand } from "../../auto-reply/command-detection.js";
import {
  createInboundDebouncer,
  resolveInboundDebounceMs,
} from "../../auto-reply/inbound-debounce.js";
import { clearSessionQueues } from "../../auto-reply/reply/queue.js";
import { resolveStorePath, loadSessionStore } from "../../config/sessions.js";
import { danger } from "../../globals.js";
import type {
  DiscordMessageDeleteEvent,
  DiscordMessageDeleteHandler,
  DiscordMessageEvent,
  DiscordMessageHandler,
  DiscordMessageUpdateEvent,
  DiscordMessageUpdateHandler,
} from "./listeners.js";
import { preflightDiscordMessage } from "./message-handler.preflight.js";
import type { DiscordMessagePreflightParams } from "./message-handler.preflight.types.js";
import { processDiscordMessage } from "./message-handler.process.js";
import { resolveDiscordMessageChannelId, resolveDiscordMessageText } from "./message-utils.js";

type DiscordMessageHandlerParams = Omit<
  DiscordMessagePreflightParams,
  "ackReactionScope" | "groupPolicy" | "data" | "client"
>;

type DiscordPendingMessage = {
  id: string;
  message: DiscordMessageEvent["message"];
  data: DiscordMessageEvent;
  client: DiscordMessagePreflightParams["client"];
  revisions: string[];
  createdAt: number;
};

type DiscordConversationRun = {
  controller: AbortController;
  batchMessageIds: string[];
  cancelled: boolean;
  sessionKey?: string;
  agentId?: string;
};

type DiscordConversationState = {
  key: string;
  order: string[];
  messages: Map<string, DiscordPendingMessage>;
  timer: ReturnType<typeof setTimeout> | null;
  run: DiscordConversationRun | null;
  needsRun: boolean;
  attempt: number;
};

type DiscordRecentMessage = {
  key: string;
  entry: DiscordPendingMessage;
  expiresAt: number;
};

const DISCORD_RECENT_MESSAGE_TTL_MS = 2 * 60 * 1000;

export type DiscordInterruptMessageHandler = DiscordMessageHandler & {
  handleMessageUpdate: DiscordMessageUpdateHandler;
  handleMessageDelete: DiscordMessageDeleteHandler;
};

const noopMessageUpdateHandler: DiscordMessageUpdateHandler = async () => {};
const noopMessageDeleteHandler: DiscordMessageDeleteHandler = async () => {};

function isAbortLikeError(err: unknown): boolean {
  if (!err || typeof err !== "object") {
    return false;
  }
  const name = (err as { name?: unknown }).name;
  if (name === "AbortError") {
    return true;
  }
  const message = (err as { message?: unknown }).message;
  return typeof message === "string" && message.toLowerCase().includes("abort");
}

function resolveMessageTimestampMs(message: DiscordMessageEvent["message"]): number {
  const raw = (message as { timestamp?: unknown }).timestamp;
  if (typeof raw === "number" && Number.isFinite(raw)) {
    return raw;
  }
  if (typeof raw === "string") {
    const parsed = Date.parse(raw);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return Date.now();
}

function normalizeRevisionText(text: string): string {
  return text.replace(/\r\n?/g, "\n").trim();
}

function resolveRevisionText(
  message: DiscordMessageEvent["message"],
  fallbackText?: string,
): string {
  if (!message || typeof message !== "object") {
    return normalizeRevisionText(fallbackText ?? "");
  }
  return normalizeRevisionText(
    resolveDiscordMessageText(message, {
      includeForwarded: false,
      fallbackText,
    }),
  );
}

function appendRevisionIfChanged(entry: DiscordPendingMessage, nextText: string) {
  const normalized = normalizeRevisionText(nextText);
  if (!normalized && entry.revisions.length === 0) {
    return;
  }
  const previous = entry.revisions.at(-1);
  if (previous === normalized) {
    return;
  }
  entry.revisions.push(normalized);
}

function formatPendingMessageText(entry: DiscordPendingMessage): string {
  // Always use the latest revision as the effective prompt so edits replace intent
  // instead of leaking prior text back into model input.
  return entry.revisions.at(-1) ?? "";
}

function buildConversationKey(params: {
  accountId: string;
  data: DiscordMessageEvent;
}): string | null {
  const message = params.data.message;
  const authorId = params.data.author?.id;
  if (!message || !authorId) {
    return null;
  }
  const channelId = resolveDiscordMessageChannelId({
    message,
    eventChannelId: params.data.channel_id,
  });
  if (!channelId) {
    return null;
  }
  return `discord:${params.accountId}:${channelId}:${authorId}`;
}

function resolveMessageIdFromUpdate(data: DiscordMessageUpdateEvent): string | null {
  const id = data.message?.id;
  if (!id) {
    return null;
  }
  return String(id);
}

function resolveMessageIdFromDelete(data: DiscordMessageDeleteEvent): string | null {
  const id = data.message?.id;
  if (!id) {
    return null;
  }
  return String(id);
}

function shouldDebounceMessage(
  message: DiscordMessageEvent["message"],
  cfg: DiscordMessageHandlerParams["cfg"],
): boolean {
  if (!message) {
    return false;
  }
  if (message.attachments && message.attachments.length > 0) {
    return false;
  }
  const baseText = resolveDiscordMessageText(message, { includeForwarded: false });
  if (!baseText.trim()) {
    return false;
  }
  return !hasControlCommand(baseText, cfg);
}

function getPendingSnapshot(state: DiscordConversationState): DiscordPendingMessage[] {
  return state.order
    .map((id) => state.messages.get(id))
    .filter((entry): entry is DiscordPendingMessage => Boolean(entry));
}

function clonePendingMessage(entry: DiscordPendingMessage): DiscordPendingMessage {
  return {
    id: entry.id,
    message: entry.message,
    data: entry.data,
    client: entry.client,
    revisions: [...entry.revisions],
    createdAt: entry.createdAt,
  };
}

function createLegacyMessageHandler(
  params: DiscordMessageHandlerParams,
): DiscordInterruptMessageHandler {
  const groupPolicy = params.discordConfig?.groupPolicy ?? "open";
  const ackReactionScope = params.cfg.messages?.ackReactionScope ?? "group-mentions";
  const debounceMs = resolveInboundDebounceMs({ cfg: params.cfg, channel: "discord" });

  const debouncer = createInboundDebouncer<{ data: DiscordMessageEvent; client: Client }>({
    debounceMs,
    buildKey: (entry) => {
      const key = buildConversationKey({
        accountId: params.accountId,
        data: entry.data,
      });
      return key;
    },
    shouldDebounce: (entry) => shouldDebounceMessage(entry.data.message, params.cfg),
    onFlush: async (entries) => {
      const last = entries.at(-1);
      if (!last) {
        return;
      }
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
      const ids = entries.map((entry) => entry.data.message?.id).filter(Boolean) as string[];
      if (ids.length > 0) {
        ctx.messageSids = ids;
        ctx.messageSidFirst = ids[0];
        ctx.messageSidLast = ids[ids.length - 1];
      }
      await processDiscordMessage(ctx);
    },
    onError: (err) => {
      params.runtime.error?.(danger(`discord debounce flush failed: ${String(err)}`));
    },
  });

  const handler: DiscordMessageHandler = async (data, client) => {
    try {
      await debouncer.enqueue({ data, client });
    } catch (err) {
      params.runtime.error?.(danger(`handler failed: ${String(err)}`));
    }
  };

  return Object.assign(handler, {
    handleMessageUpdate: noopMessageUpdateHandler,
    handleMessageDelete: noopMessageDeleteHandler,
  });
}

function createInterruptMessageHandler(
  params: DiscordMessageHandlerParams,
): DiscordInterruptMessageHandler {
  const groupPolicy = params.discordConfig?.groupPolicy ?? "open";
  const ackReactionScope = params.cfg.messages?.ackReactionScope ?? "group-mentions";
  const debounceMs = resolveInboundDebounceMs({ cfg: params.cfg, channel: "discord" });
  const conversations = new Map<string, DiscordConversationState>();
  const messageToConversationKey = new Map<string, string>();
  const recentMessages = new Map<string, DiscordRecentMessage>();

  const getConversationState = (key: string): DiscordConversationState => {
    const existing = conversations.get(key);
    if (existing) {
      return existing;
    }
    const created: DiscordConversationState = {
      key,
      order: [],
      messages: new Map(),
      timer: null,
      run: null,
      needsRun: false,
      attempt: 0,
    };
    conversations.set(key, created);
    return created;
  };

  const pruneRecentMessages = () => {
    const now = Date.now();
    for (const [messageId, cached] of recentMessages) {
      if (cached.expiresAt <= now) {
        recentMessages.delete(messageId);
      }
    }
  };

  const resolveRecentMessage = (messageId: string): DiscordRecentMessage | null => {
    pruneRecentMessages();
    const cached = recentMessages.get(messageId);
    if (!cached) {
      return null;
    }
    if (cached.expiresAt <= Date.now()) {
      recentMessages.delete(messageId);
      return null;
    }
    return cached;
  };

  const pruneConversation = (state: DiscordConversationState) => {
    if (state.order.length > 0 || state.timer || state.run || state.needsRun) {
      return;
    }
    conversations.delete(state.key);
  };

  const removePendingMessage = (
    state: DiscordConversationState,
    messageId: string,
    options?: { rememberRecent?: boolean },
  ) => {
    const existing = state.messages.get(messageId);
    if (!existing) {
      return;
    }
    if (options?.rememberRecent) {
      recentMessages.set(messageId, {
        key: state.key,
        entry: clonePendingMessage(existing),
        expiresAt: Date.now() + DISCORD_RECENT_MESSAGE_TTL_MS,
      });
    } else {
      recentMessages.delete(messageId);
    }
    state.messages.delete(messageId);
    state.order = state.order.filter((id) => id !== messageId);
    messageToConversationKey.delete(messageId);
  };

  const interruptRun = (state: DiscordConversationState, reason: string) => {
    const run = state.run;
    if (!run || run.cancelled) {
      return;
    }
    run.cancelled = true;
    run.controller.abort(new Error(reason));

    if (run.sessionKey && run.agentId) {
      try {
        const storePath = resolveStorePath(params.cfg.session?.store, {
          agentId: run.agentId,
        });
        const store = loadSessionStore(storePath);
        const sessionEntry = store[run.sessionKey] ?? store[run.sessionKey.toLowerCase()];
        const sessionId = sessionEntry?.sessionId;
        clearSessionQueues([run.sessionKey, sessionId]);
        if (sessionId) {
          abortEmbeddedPiRun(sessionId);
        }
      } catch (err) {
        params.runtime.error?.(danger(`discord interrupt failed: ${String(err)}`));
      }
    }
  };

  const scheduleRun = (state: DiscordConversationState, options?: { immediate?: boolean }) => {
    if (!state.needsRun || state.order.length === 0) {
      return;
    }
    const delay = options?.immediate ? 0 : debounceMs;
    if (state.timer) {
      clearTimeout(state.timer);
      state.timer = null;
    }
    state.timer = setTimeout(
      () => {
        state.timer = null;
        startRun(state);
      },
      Math.max(0, delay),
    );
    state.timer.unref?.();
  };

  const runConversation = async (
    state: DiscordConversationState,
    run: DiscordConversationRun,
    snapshot: DiscordPendingMessage[],
  ) => {
    const last = snapshot.at(-1);
    if (!last) {
      return;
    }
    const combinedText = snapshot.map(formatPendingMessageText).filter(Boolean).join("\n\n");
    const combinedAttachments = snapshot.flatMap((entry) => entry.message.attachments ?? []);
    const syntheticMessage = {
      ...last.message,
      content: combinedText,
      attachments: combinedAttachments,
      message_snapshots: (last.message as { message_snapshots?: unknown }).message_snapshots,
      messageSnapshots: (last.message as { messageSnapshots?: unknown }).messageSnapshots,
      rawData: {
        ...(last.message as { rawData?: Record<string, unknown> }).rawData,
      },
    };
    const syntheticData: DiscordMessageEvent = {
      ...last.data,
      message: syntheticMessage,
    };

    try {
      const ctx = await preflightDiscordMessage({
        ...params,
        ackReactionScope,
        groupPolicy,
        data: syntheticData,
        client: last.client,
      });
      if (!ctx || run.cancelled || run.controller.signal.aborted) {
        return;
      }

      run.sessionKey = ctx.route.sessionKey;
      run.agentId = ctx.route.agentId;

      const ids = snapshot.map((entry) => entry.id);
      const requiresSyntheticSid =
        state.attempt > 1 || ids.length > 1 || snapshot.some((entry) => entry.revisions.length > 1);
      const messageSidOverride = requiresSyntheticSid
        ? `${ids[ids.length - 1] ?? syntheticMessage.id}:rebuild:${state.attempt}`
        : undefined;

      ctx.messageSids = ids;
      ctx.messageSidFirst = ids[0];
      ctx.messageSidLast = ids[ids.length - 1];
      ctx.messageSidOverride = messageSidOverride;
      ctx.abortSignal = run.controller.signal;

      await processDiscordMessage(ctx);
    } catch (err) {
      if (run.cancelled || run.controller.signal.aborted || isAbortLikeError(err)) {
        return;
      }
      params.runtime.error?.(danger(`discord debounce flush failed: ${String(err)}`));
    }
  };

  const onRunSettled = (state: DiscordConversationState, run: DiscordConversationRun) => {
    if (state.run === run) {
      state.run = null;
    }
    if (!run.cancelled && !run.controller.signal.aborted) {
      for (const messageId of run.batchMessageIds) {
        removePendingMessage(state, messageId, { rememberRecent: true });
      }
    }
    if (state.order.length === 0) {
      state.attempt = 0;
      state.needsRun = false;
      pruneConversation(state);
      return;
    }
    state.needsRun = true;
    scheduleRun(state, { immediate: true });
  };

  const startRun = (state: DiscordConversationState) => {
    if (!state.needsRun || state.run || state.order.length === 0) {
      pruneConversation(state);
      return;
    }
    const snapshot = getPendingSnapshot(state);
    if (snapshot.length === 0) {
      state.needsRun = false;
      pruneConversation(state);
      return;
    }
    state.needsRun = false;
    state.attempt += 1;
    const run: DiscordConversationRun = {
      controller: new AbortController(),
      batchMessageIds: snapshot.map((entry) => entry.id),
      cancelled: false,
    };
    state.run = run;
    void runConversation(state, run, snapshot).finally(() => {
      onRunSettled(state, run);
    });
  };

  const handleMessageCreate: DiscordMessageHandler = async (data, client) => {
    const key = buildConversationKey({ accountId: params.accountId, data });
    if (!key) {
      return;
    }
    const message = data.message;
    const messageId = message?.id ? String(message.id) : "";
    if (!message || !messageId) {
      return;
    }
    recentMessages.delete(messageId);
    const state = getConversationState(key);
    const existing = state.messages.get(messageId);
    if (existing) {
      existing.message = message;
      existing.data = data;
      existing.client = client;
      appendRevisionIfChanged(existing, resolveRevisionText(message));
    } else {
      const entry: DiscordPendingMessage = {
        id: messageId,
        message,
        data,
        client,
        revisions: [],
        createdAt: resolveMessageTimestampMs(message),
      };
      appendRevisionIfChanged(entry, resolveRevisionText(message));
      state.messages.set(messageId, entry);
      state.order.push(messageId);
    }
    messageToConversationKey.set(messageId, key);
    state.order.sort((a, b) => {
      const left = state.messages.get(a)?.createdAt ?? 0;
      const right = state.messages.get(b)?.createdAt ?? 0;
      return left - right;
    });

    // New inbound messages supersede all older pending prompts.
    // This avoids mixing stale intent when users send follow-up messages quickly
    // or while a run is already in-flight.
    const pendingIds = state.order.slice();
    for (const pendingId of pendingIds) {
      if (pendingId === messageId) {
        continue;
      }
      removePendingMessage(state, pendingId);
    }

    state.needsRun = true;
    interruptRun(state, "discord message replaced by new inbound message");
    const immediate = !shouldDebounceMessage(message, params.cfg);
    scheduleRun(state, { immediate });
  };

  const handleMessageUpdate: DiscordMessageUpdateHandler = async (data, client) => {
    const messageId = resolveMessageIdFromUpdate(data);
    if (!messageId) {
      return;
    }
    const liveKey = messageToConversationKey.get(messageId);
    const recent = resolveRecentMessage(messageId);
    const key = liveKey ?? recent?.key;
    if (!key) {
      return;
    }
    let state = conversations.get(key);
    if (!state && recent) {
      state = getConversationState(key);
    }
    if (!state) {
      if (liveKey) {
        messageToConversationKey.delete(messageId);
      }
      return;
    }
    let existing = state.messages.get(messageId);
    if (!existing && recent) {
      existing = clonePendingMessage(recent.entry);
      state.messages.set(messageId, existing);
      if (!state.order.includes(messageId)) {
        state.order.push(messageId);
      }
      messageToConversationKey.set(messageId, key);
      recentMessages.delete(messageId);
    }
    if (!existing) {
      return;
    }

    const previousRevision = existing.revisions.at(-1);
    const newText = resolveRevisionText(data.message, previousRevision);
    if (!newText || newText === previousRevision) {
      return;
    }
    existing.revisions = [];
    appendRevisionIfChanged(existing, newText);
    existing.message = {
      ...existing.message,
      content: newText,
      attachments: data.message.attachments ?? existing.message.attachments ?? [],
      message_snapshots:
        (data.message as { message_snapshots?: unknown }).message_snapshots ??
        (existing.message as { message_snapshots?: unknown }).message_snapshots,
      messageSnapshots:
        (data.message as { messageSnapshots?: unknown }).messageSnapshots ??
        (existing.message as { messageSnapshots?: unknown }).messageSnapshots,
      rawData: {
        ...(existing.message as { rawData?: Record<string, unknown> }).rawData,
        ...(data.message as { rawData?: Record<string, unknown> }).rawData,
      },
    } as DiscordMessageEvent["message"];
    existing.data = {
      ...existing.data,
      message: existing.message,
    };
    existing.client = client;
    state.order.sort((a, b) => {
      const left = state.messages.get(a)?.createdAt ?? 0;
      const right = state.messages.get(b)?.createdAt ?? 0;
      return left - right;
    });

    for (const pendingId of state.order.slice()) {
      if (pendingId === messageId) {
        continue;
      }
      removePendingMessage(state, pendingId);
    }

    state.needsRun = true;
    interruptRun(state, "discord message edited");
    const immediate = !shouldDebounceMessage(existing.message, params.cfg);
    scheduleRun(state, { immediate });
  };

  const handleMessageDelete: DiscordMessageDeleteHandler = async (data) => {
    const messageId = resolveMessageIdFromDelete(data);
    if (!messageId) {
      return;
    }
    const key = messageToConversationKey.get(messageId);
    if (!key) {
      recentMessages.delete(messageId);
      return;
    }
    const state = conversations.get(key);
    if (!state) {
      messageToConversationKey.delete(messageId);
      recentMessages.delete(messageId);
      return;
    }

    removePendingMessage(state, messageId);
    if (state.timer) {
      clearTimeout(state.timer);
      state.timer = null;
    }

    if (state.run) {
      interruptRun(state, "discord message deleted");
    }

    if (state.order.length === 0) {
      state.needsRun = false;
      pruneConversation(state);
      return;
    }

    state.needsRun = true;
    scheduleRun(state, { immediate: true });
  };

  const handler = async (
    data: DiscordMessageEvent,
    client: DiscordMessagePreflightParams["client"],
  ) => {
    try {
      await handleMessageCreate(data, client);
    } catch (err) {
      params.runtime.error?.(danger(`handler failed: ${String(err)}`));
    }
  };

  return Object.assign(handler, {
    handleMessageUpdate: async (
      data: DiscordMessageUpdateEvent,
      client: DiscordMessagePreflightParams["client"],
    ) => {
      try {
        await handleMessageUpdate(data, client);
      } catch (err) {
        params.runtime.error?.(danger(`discord update handler failed: ${String(err)}`));
      }
    },
    handleMessageDelete: async (
      data: DiscordMessageDeleteEvent,
      client: DiscordMessagePreflightParams["client"],
    ) => {
      try {
        await handleMessageDelete(data, client);
      } catch (err) {
        params.runtime.error?.(danger(`discord delete handler failed: ${String(err)}`));
      }
    },
  });
}

export function createDiscordMessageHandler(
  params: DiscordMessageHandlerParams,
): DiscordInterruptMessageHandler {
  if (params.discordConfig?.interruptOnMessageMutations !== false) {
    return createInterruptMessageHandler(params);
  }
  return createLegacyMessageHandler(params);
}
