import type { AgentEvent, AgentMessage } from "@mariozechner/pi-agent-core";
import type { AssistantMessage } from "@mariozechner/pi-ai";

import { parseReplyDirectives } from "../auto-reply/reply/reply-directives.js";
import { emitAgentEvent } from "../infra/agent-events.js";
import { isMinimaxModel, isMinimaxProvider } from "../utils/provider-utils.js";
import {
  isMessagingToolDuplicateNormalized,
  normalizeTextForComparison,
} from "./pi-embedded-helpers.js";
import {
  hasMinimaxToolCallStart,
  hasMinimaxToolCallEnd,
  parseMinimaxToolCalls,
} from "./minimax-tool-parser.js";
import type { EmbeddedPiSubscribeContext } from "./pi-embedded-subscribe.handlers.types.js";
import { appendRawStream } from "./pi-embedded-subscribe.raw-stream.js";
import {
  extractAssistantText,
  extractAssistantThinking,
  extractThinkingFromTaggedStream,
  extractThinkingFromTaggedText,
  formatReasoningMessage,
  promoteThinkingTagsToBlocks,
} from "./pi-embedded-utils.js";
import { createInlineCodeState } from "../markdown/code-spans.js";

/**
 * Check if the current context is using a MiniMax model.
 */
function isMinimax(ctx: EmbeddedPiSubscribeContext): boolean {
  const provider = ctx.params.provider;
  const modelId = ctx.params.modelId;
  return isMinimaxProvider(provider) || isMinimaxModel(modelId);
}

export function handleMessageStart(
  ctx: EmbeddedPiSubscribeContext,
  evt: AgentEvent & { message: AgentMessage },
) {
  const msg = evt.message;
  if (msg?.role !== "assistant") return;

  // KNOWN: Resetting at `text_end` is unsafe (late/duplicate end events).
  // ASSUME: `message_start` is the only reliable boundary for “new assistant message begins”.
  // Start-of-message is a safer reset point than message_end: some providers
  // may deliver late text_end updates after message_end, which would otherwise
  // re-trigger block replies.
  ctx.resetAssistantMessageState(ctx.state.assistantTexts.length);
  // Use assistant message_start as the earliest "writing" signal for typing.
  void ctx.params.onAssistantMessageStart?.();
}

export function handleMessageUpdate(
  ctx: EmbeddedPiSubscribeContext,
  evt: AgentEvent & { message: AgentMessage; assistantMessageEvent?: unknown },
) {
  const msg = evt.message;
  if (msg?.role !== "assistant") return;

  const assistantEvent = evt.assistantMessageEvent;
  const assistantRecord =
    assistantEvent && typeof assistantEvent === "object"
      ? (assistantEvent as Record<string, unknown>)
      : undefined;
  const evtType = typeof assistantRecord?.type === "string" ? assistantRecord.type : "";

  if (evtType !== "text_delta" && evtType !== "text_start" && evtType !== "text_end") {
    return;
  }

  const delta = typeof assistantRecord?.delta === "string" ? assistantRecord.delta : "";
  const content = typeof assistantRecord?.content === "string" ? assistantRecord.content : "";

  appendRawStream({
    ts: Date.now(),
    event: "assistant_text_stream",
    runId: ctx.params.runId,
    sessionId: (ctx.params.session as { id?: string }).id,
    evtType,
    delta,
    content,
  });

  let chunk = "";
  if (evtType === "text_delta") {
    chunk = delta;
  } else if (evtType === "text_start" || evtType === "text_end") {
    if (delta) {
      chunk = delta;
    } else if (content) {
      // KNOWN: Some providers resend full content on `text_end`.
      // We only append a suffix (or nothing) to keep output monotonic.
      if (content.startsWith(ctx.state.deltaBuffer)) {
        chunk = content.slice(ctx.state.deltaBuffer.length);
      } else if (ctx.state.deltaBuffer.startsWith(content)) {
        chunk = "";
      } else if (!ctx.state.deltaBuffer.includes(content)) {
        chunk = content;
      }
    }
  }

  if (chunk) {
    ctx.state.deltaBuffer += chunk;
    if (ctx.blockChunker) {
      ctx.blockChunker.append(chunk);
    } else {
      ctx.state.blockBuffer += chunk;
    }
  }

  if (ctx.state.streamReasoning) {
    // Handle partial <think> tags: stream whatever reasoning is visible so far.
    ctx.emitReasoningStream(extractThinkingFromTaggedStream(ctx.state.deltaBuffer));
  }

  // MiniMax tool call detection: buffer XML tool calls for parsing
  if (isMinimax(ctx)) {
    const buffer = ctx.state.deltaBuffer;
    if (hasMinimaxToolCallStart(buffer)) {
      ctx.state.minimaxToolBuffering = true;
    }
    if (ctx.state.minimaxToolBuffering) {
      ctx.state.minimaxToolBuffer = buffer;
      // Check if we have a complete tool call block
      if (hasMinimaxToolCallEnd(buffer)) {
        ctx.state.minimaxToolBuffering = false;
        // Parse and store detected tool calls for logging at message end
        const toolCalls = parseMinimaxToolCalls(buffer);
        if (toolCalls.length > 0) {
          ctx.state.minimaxDetectedToolCalls.push(...toolCalls);
          ctx.log.debug(
            `MiniMax tool calls detected during streaming: ${toolCalls.map((t) => t.name).join(", ")}`,
          );
        }
      }
    }
  }

  const next = ctx
    .stripBlockTags(ctx.state.deltaBuffer, {
      thinking: false,
      final: false,
      inlineCode: createInlineCodeState(),
    })
    .trim();
  if (next && next !== ctx.state.lastStreamedAssistant) {
    const previousText = ctx.state.lastStreamedAssistant ?? "";
    const { text: cleanedText, mediaUrls } = parseReplyDirectives(next);
    const { text: previousCleanedText } = parseReplyDirectives(previousText);
    if (cleanedText.startsWith(previousCleanedText)) {
      const deltaText = cleanedText.slice(previousCleanedText.length);
      ctx.state.lastStreamedAssistant = next;
      emitAgentEvent({
        runId: ctx.params.runId,
        stream: "assistant",
        data: {
          text: cleanedText,
          delta: deltaText,
          mediaUrls: mediaUrls?.length ? mediaUrls : undefined,
        },
      });
      void ctx.params.onAgentEvent?.({
        stream: "assistant",
        data: {
          text: cleanedText,
          delta: deltaText,
          mediaUrls: mediaUrls?.length ? mediaUrls : undefined,
        },
      });
      if (ctx.params.onPartialReply && ctx.state.shouldEmitPartialReplies) {
        void ctx.params.onPartialReply({
          text: cleanedText,
          mediaUrls: mediaUrls?.length ? mediaUrls : undefined,
        });
      }
    }
  }

  if (ctx.params.onBlockReply && ctx.blockChunking && ctx.state.blockReplyBreak === "text_end") {
    ctx.blockChunker?.drain({ force: false, emit: ctx.emitBlockChunk });
  }

  if (evtType === "text_end" && ctx.state.blockReplyBreak === "text_end") {
    if (ctx.blockChunker?.hasBuffered()) {
      ctx.blockChunker.drain({ force: true, emit: ctx.emitBlockChunk });
      ctx.blockChunker.reset();
    } else if (ctx.state.blockBuffer.length > 0) {
      ctx.emitBlockChunk(ctx.state.blockBuffer);
      ctx.state.blockBuffer = "";
    }
  }
}

export function handleMessageEnd(
  ctx: EmbeddedPiSubscribeContext,
  evt: AgentEvent & { message: AgentMessage },
) {
  const msg = evt.message;
  if (msg?.role !== "assistant") return;

  const assistantMessage = msg as AssistantMessage;
  promoteThinkingTagsToBlocks(assistantMessage);

  const rawText = extractAssistantText(assistantMessage);
  appendRawStream({
    ts: Date.now(),
    event: "assistant_message_end",
    runId: ctx.params.runId,
    sessionId: (ctx.params.session as { id?: string }).id,
    rawText,
    rawThinking: extractAssistantThinking(assistantMessage),
  });

  const text = ctx.stripBlockTags(rawText, { thinking: false, final: false });
  const rawThinking =
    ctx.state.includeReasoning || ctx.state.streamReasoning
      ? extractAssistantThinking(assistantMessage) || extractThinkingFromTaggedText(rawText)
      : "";
  const formattedReasoning = rawThinking ? formatReasoningMessage(rawThinking) : "";

  const addedDuringMessage = ctx.state.assistantTexts.length > ctx.state.assistantTextBaseline;
  const chunkerHasBuffered = ctx.blockChunker?.hasBuffered() ?? false;
  ctx.finalizeAssistantTexts({ text, addedDuringMessage, chunkerHasBuffered });

  const onBlockReply = ctx.params.onBlockReply;
  const shouldEmitReasoning = Boolean(
    ctx.state.includeReasoning &&
    formattedReasoning &&
    onBlockReply &&
    formattedReasoning !== ctx.state.lastReasoningSent,
  );
  const shouldEmitReasoningBeforeAnswer =
    shouldEmitReasoning && ctx.state.blockReplyBreak === "message_end" && !addedDuringMessage;
  const maybeEmitReasoning = () => {
    if (!shouldEmitReasoning || !formattedReasoning) return;
    ctx.state.lastReasoningSent = formattedReasoning;
    void onBlockReply?.({ text: formattedReasoning });
  };

  if (shouldEmitReasoningBeforeAnswer) maybeEmitReasoning();

  if (
    (ctx.state.blockReplyBreak === "message_end" ||
      (ctx.blockChunker ? ctx.blockChunker.hasBuffered() : ctx.state.blockBuffer.length > 0)) &&
    text &&
    onBlockReply
  ) {
    if (ctx.blockChunker?.hasBuffered()) {
      ctx.blockChunker.drain({ force: true, emit: ctx.emitBlockChunk });
      ctx.blockChunker.reset();
    } else if (text !== ctx.state.lastBlockReplyText) {
      // Check for duplicates before emitting (same logic as emitBlockChunk).
      const normalizedText = normalizeTextForComparison(text);
      if (
        isMessagingToolDuplicateNormalized(
          normalizedText,
          ctx.state.messagingToolSentTextsNormalized,
        )
      ) {
        ctx.log.debug(
          `Skipping message_end block reply - already sent via messaging tool: ${text.slice(0, 50)}...`,
        );
      } else {
        ctx.state.lastBlockReplyText = text;
        const splitResult = ctx.consumeReplyDirectives(text, { final: true });
        if (splitResult) {
          const {
            text: cleanedText,
            mediaUrls,
            audioAsVoice,
            replyToId,
            replyToTag,
            replyToCurrent,
          } = splitResult;
          // Emit if there's content OR audioAsVoice flag (to propagate the flag).
          if (cleanedText || (mediaUrls && mediaUrls.length > 0) || audioAsVoice) {
            void onBlockReply({
              text: cleanedText,
              mediaUrls: mediaUrls?.length ? mediaUrls : undefined,
              audioAsVoice,
              replyToId,
              replyToTag,
              replyToCurrent,
            });
          }
        }
      }
    }
  }

  if (!shouldEmitReasoningBeforeAnswer) maybeEmitReasoning();
  if (ctx.state.streamReasoning && rawThinking) {
    ctx.emitReasoningStream(rawThinking);
  }

  if (ctx.state.blockReplyBreak === "text_end" && onBlockReply) {
    const tailResult = ctx.consumeReplyDirectives("", { final: true });
    if (tailResult) {
      const {
        text: cleanedText,
        mediaUrls,
        audioAsVoice,
        replyToId,
        replyToTag,
        replyToCurrent,
      } = tailResult;
      if (cleanedText || (mediaUrls && mediaUrls.length > 0) || audioAsVoice) {
        void onBlockReply({
          text: cleanedText,
          mediaUrls: mediaUrls?.length ? mediaUrls : undefined,
          audioAsVoice,
          replyToId,
          replyToTag,
          replyToCurrent,
        });
      }
    }
  }

  // Final MiniMax tool call detection at message end
  if (isMinimax(ctx)) {
    // Parse any remaining tool calls from the final text
    const finalToolCalls = parseMinimaxToolCalls(rawText);
    const allToolCalls = [...ctx.state.minimaxDetectedToolCalls];

    // Add any newly detected calls that weren't caught during streaming
    for (const call of finalToolCalls) {
      const alreadyDetected = allToolCalls.some(
        (existing) =>
          existing.name === call.name &&
          JSON.stringify(existing.arguments) === JSON.stringify(call.arguments),
      );
      if (!alreadyDetected) {
        allToolCalls.push(call);
      }
    }

    if (allToolCalls.length > 0) {
      ctx.log.warn(
        `MiniMax XML tool calls detected but not executed (${allToolCalls.length}): ${allToolCalls.map((t) => t.name).join(", ")}. ` +
          `MiniMax tool execution requires the minimax-tool-parser integration.`,
      );

      // Emit event for observability
      emitAgentEvent({
        runId: ctx.params.runId,
        stream: "minimax",
        data: {
          phase: "tool_calls_detected",
          toolCalls: allToolCalls.map((t) => ({
            name: t.name,
            argumentKeys: Object.keys(t.arguments),
          })),
          count: allToolCalls.length,
          warning: "Tool calls detected but not executed - MiniMax uses XML format",
        },
      });

      void ctx.params.onAgentEvent?.({
        stream: "minimax",
        data: {
          phase: "tool_calls_detected",
          toolCalls: allToolCalls.map((t) => ({ name: t.name })),
          count: allToolCalls.length,
        },
      });
    }

    // Reset MiniMax state
    ctx.state.minimaxToolBuffer = "";
    ctx.state.minimaxToolBuffering = false;
    ctx.state.minimaxDetectedToolCalls = [];
  }

  ctx.state.deltaBuffer = "";
  ctx.state.blockBuffer = "";
  ctx.blockChunker?.reset();
  ctx.state.blockState.thinking = false;
  ctx.state.blockState.final = false;
  ctx.state.blockState.inlineCode = createInlineCodeState();
  ctx.state.lastStreamedAssistant = undefined;
}
