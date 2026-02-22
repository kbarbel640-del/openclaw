import {
  createReplyPrefixContext,
  createTypingCallbacks,
  logTypingFailure,
  type ClawdbotConfig,
  type ReplyPayload,
  type RuntimeEnv,
} from "openclaw/plugin-sdk";
import { resolveFeishuAccount } from "./accounts.js";
import { createFeishuClient } from "./client.js";
import type { MentionTarget } from "./mention.js";
import { buildMentionedCardContent } from "./mention.js";
import { getReactionStateManager } from "./reaction-state.js";
import { getFeishuRuntime } from "./runtime.js";
import { sendMarkdownCardFeishu, sendMessageFeishu } from "./send.js";
import { FeishuStreamingSession } from "./streaming-card.js";
import { resolveReceiveIdType } from "./targets.js";
import { addTypingIndicator, removeTypingIndicator, type TypingIndicatorState } from "./typing.js";

/** Detect if text contains markdown elements that benefit from card rendering */
function shouldUseCard(text: string): boolean {
  return /```[\s\S]*?```/.test(text) || /\|.+\|[\r\n]+\|[-:| ]+\|/.test(text);
}

export type CreateFeishuReplyDispatcherParams = {
  cfg: ClawdbotConfig;
  agentId: string;
  runtime: RuntimeEnv;
  chatId: string;
  replyToMessageId?: string;
  mentionTargets?: MentionTarget[];
  accountId?: string;
};

export function createFeishuReplyDispatcher(params: CreateFeishuReplyDispatcherParams) {
  const core = getFeishuRuntime();
  const { cfg, agentId, chatId, replyToMessageId, mentionTargets, accountId } = params;
  const account = resolveFeishuAccount({ cfg, accountId });
  const prefixContext = createReplyPrefixContext({ cfg, agentId });

  const typingCallbacks = createTypingCallbacks({
    start: async () => {
      // NOTE: onProcessingStart is handled in onReplyStart via processingTransitionPromise.
      // Do NOT call it here — the SDK calls start() periodically to refresh typing state,
      // which would produce redundant API calls and "not in QUEUED status" log spam.
    },
    stop: async () => {
      // Cleanup is properly handled inside deliver() and closeStreaming() for accurate timing
      // when the message is fully sent, avoiding premature disappearance.
    },
    onStartError: (err) =>
      logTypingFailure({
        log: (message) => params.runtime.log?.(message),
        channel: "feishu",
        action: "start",
        error: err,
      }),
    onStopError: (err) =>
      logTypingFailure({
        log: (message) => params.runtime.log?.(message),
        channel: "feishu",
        action: "stop",
        error: err,
      }),
  });

  const textChunkLimit = core.channel.text.resolveTextChunkLimit(cfg, "feishu", accountId, {
    fallbackLimit: 4000,
  });
  const chunkMode = core.channel.text.resolveChunkMode(cfg, "feishu");
  const tableMode = core.channel.text.resolveMarkdownTableMode({ cfg, channel: "feishu" });
  const renderMode = account.config?.renderMode ?? "auto";
  const streamingEnabled = account.config?.streaming !== false && renderMode !== "raw";

  let streaming: FeishuStreamingSession | null = null;
  let streamText = "";
  let lastPartial = "";
  let partialUpdateQueue: Promise<void> = Promise.resolve();
  let streamingStartPromise: Promise<void> | null = null;
  // Promise for the QUEUED→PROCESSING transition (onProcessingStart API calls).
  // Saved here so deliver() can await it before sending content.
  let processingTransitionPromise: Promise<void> | null = null;

  const startStreaming = () => {
    if (!streamingEnabled || streamingStartPromise || streaming) {
      return;
    }
    streamingStartPromise = (async () => {
      const creds =
        account.appId && account.appSecret
          ? { appId: account.appId, appSecret: account.appSecret, domain: account.domain }
          : null;
      if (!creds) {
        return;
      }

      streaming = new FeishuStreamingSession(createFeishuClient(account), creds, (message) =>
        params.runtime.log?.(`feishu[${account.accountId}] ${message}`),
      );
      try {
        await streaming.start(chatId, resolveReceiveIdType(chatId));
      } catch (error) {
        params.runtime.error?.(`feishu: streaming start failed: ${String(error)}`);
        streaming = null;
      }
    })();
  };

  // Track whether onCompleted has already been called for this dispatcher lifecycle.
  // Prevents double-cleanup from both deliver() and closeStreaming()/onIdle paths.
  let reactionCompleted = false;

  const completeReaction = () => {
    if (reactionCompleted || !replyToMessageId) return;
    reactionCompleted = true;
    const mgr = getReactionStateManager();
    // Clean up THIS message's reaction.
    mgr.onCompleted(replyToMessageId).catch(() => {});
    // Clean up ALL remaining reactions in this chat (merged messages).
    // Merged messages may be in QUEUED or PROCESSING state. Either way, they were
    // absorbed into the main message's context and will never get their own reply.
    mgr.clearForChat(chatId).catch(() => {});
  };

  const closeStreaming = async () => {
    if (streamingStartPromise) {
      await streamingStartPromise;
    }
    await partialUpdateQueue;
    const hadActiveStream = streaming?.isActive() ?? false;
    if (hadActiveStream) {
      let text = streamText;
      if (mentionTargets?.length) {
        text = buildMentionedCardContent(mentionTargets, text);
      }
      await streaming!.close(text);
    }
    streaming = null;
    streamingStartPromise = null;
    streamText = "";
    lastPartial = "";

    // FR-001: "分发完成 → onCompleted()" — streaming reply fully delivered.
    // ONLY fire when there was a real active stream that just closed (= content was delivered).
    // Do NOT fire when closeStreaming is called from onIdle for a queued-but-not-yet-processed message.
    if (hadActiveStream) {
      completeReaction();
    }
  };

  const { dispatcher, replyOptions, markDispatchIdle } =
    core.channel.reply.createReplyDispatcherWithTyping({
      responsePrefix: prefixContext.responsePrefix,
      responsePrefixContextProvider: prefixContext.responsePrefixContextProvider,
      humanDelay: core.channel.reply.resolveHumanDelayConfig(cfg, agentId),
      onReplyStart: () => {
        if (streamingEnabled && renderMode === "card") {
          startStreaming();
        }
        // Save the processing transition promise so deliver() can await it.
        // onReplyStart must return void (SDK contract), so we fire-and-forget here,
        // but capture the promise for synchronization in deliver().
        if (replyToMessageId && !processingTransitionPromise) {
          processingTransitionPromise = getReactionStateManager()
            .onProcessingStart(replyToMessageId)
            .catch((err) => {
              params.runtime.log?.(
                `Failed to transition reaction state for ${replyToMessageId}: ${err}`,
              );
            });
        }
        void typingCallbacks.onReplyStart?.();
      },
      deliver: async (payload: ReplyPayload, info) => {
        // FR-001: Ensure the QUEUED→PROCESSING emoji transition completes BEFORE
        // we deliver any content. Without this await, deliver() races ahead of
        // onProcessingStart()'s API calls and completeReaction() removes the emoji
        // before Typing ever appears.
        if (processingTransitionPromise) {
          await processingTransitionPromise;
          processingTransitionPromise = null;
        }

        const text = payload.text ?? "";
        if (!text.trim()) {
          return;
        }

        const useCard = renderMode === "card" || (renderMode === "auto" && shouldUseCard(text));

        if ((info?.kind === "block" || info?.kind === "final") && streamingEnabled && useCard) {
          startStreaming();
          if (streamingStartPromise) {
            await streamingStartPromise;
          }
        }

        if (streaming?.isActive()) {
          if (info?.kind === "final") {
            streamText = text;
            await closeStreaming();
          }
          return;
        }

        let first = true;
        if (useCard) {
          for (const chunk of core.channel.text.chunkTextWithMode(
            text,
            textChunkLimit,
            chunkMode,
          )) {
            await sendMarkdownCardFeishu({
              cfg,
              to: chatId,
              text: chunk,
              replyToMessageId,
              mentions: first ? mentionTargets : undefined,
              accountId,
            });
            first = false;
          }
        } else {
          const converted = core.channel.text.convertMarkdownTables(text, tableMode);
          for (const chunk of core.channel.text.chunkTextWithMode(
            converted,
            textChunkLimit,
            chunkMode,
          )) {
            await sendMessageFeishu({
              cfg,
              to: chatId,
              text: chunk,
              replyToMessageId,
              mentions: first ? mentionTargets : undefined,
              accountId,
            });
            first = false;
          }
        }

        // FR-001: "分发完成 → onCompleted()" — non-streaming reply fully delivered
        completeReaction();
      },
      onError: async (error, info) => {
        params.runtime.error?.(
          `feishu[${account.accountId}] ${info.kind} reply failed: ${String(error)}`,
        );
        await closeStreaming();
        // FR-001: "异常处理 → onCompleted() (确保清理)" — design spec requires cleanup on error
        completeReaction();
        typingCallbacks.onIdle?.();
      },
      onIdle: async () => {
        await closeStreaming();
        typingCallbacks.onIdle?.();
      },
      onCleanup: () => {
        typingCallbacks.onCleanup?.();
        // FR-001 Fallback: call completeReaction only if reactionCompleted hasn't been
        // called yet (i.e. deliver() was never invoked - e.g. message tool bypass path).
        // This handles the case where the agent sends no textual reply through dispatcher.
        // Guard: only clean up if processingTransitionPromise was actually started,
        // meaning onProcessingStart was called (the agent did begin processing).
        // Without this guard, completeReaction fires during markDispatchIdle for debounced
        // messages that are still waiting in the queue (queuedFinal=true scenarios).
        if (processingTransitionPromise !== null) {
          completeReaction();
        }
      },
    });

  return {
    dispatcher,
    replyOptions: {
      ...replyOptions,
      onModelSelected: prefixContext.onModelSelected,
      onPartialReply: streamingEnabled
        ? (payload: ReplyPayload) => {
            if (!payload.text || payload.text === lastPartial) {
              return;
            }
            lastPartial = payload.text;
            streamText = payload.text;
            partialUpdateQueue = partialUpdateQueue.then(async () => {
              if (streamingStartPromise) {
                await streamingStartPromise;
              }
              if (streaming?.isActive()) {
                await streaming.update(streamText);
              }
            });
          }
        : undefined,
    },
    markDispatchIdle,
  };
}
