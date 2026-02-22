import { AcpRuntimeError, toAcpRuntimeError } from "../../acp/runtime/errors.js";
import { requireAcpRuntimeBackend } from "../../acp/runtime/registry.js";
import { readAcpSessionEntry, upsertAcpSessionMeta } from "../../acp/runtime/session-meta.js";
import type { AcpRuntime, AcpRuntimeHandle } from "../../acp/runtime/types.js";
import { resolveSessionAgentId } from "../../agents/agent-scope.js";
import type { OpenClawConfig } from "../../config/config.js";
import { loadSessionStore, resolveStorePath } from "../../config/sessions.js";
import type { SessionAcpMeta } from "../../config/sessions/types.js";
import { logVerbose } from "../../globals.js";
import { createInternalHookEvent, triggerInternalHook } from "../../hooks/internal-hooks.js";
import { isDiagnosticsEnabled } from "../../infra/diagnostic-events.js";
import {
  logMessageProcessed,
  logMessageQueued,
  logSessionStateChange,
} from "../../logging/diagnostic.js";
import { getGlobalHookRunner } from "../../plugins/hook-runner-global.js";
import { resolveAgentIdFromSessionKey } from "../../routing/session-key.js";
import { maybeApplyTtsToPayload, normalizeTtsAutoMode, resolveTtsConfig } from "../../tts/tts.js";
import { getReplyFromConfig } from "../reply.js";
import type { FinalizedMsgContext } from "../templating.js";
import type { GetReplyOptions, ReplyPayload } from "../types.js";
import { formatAbortReplyText, tryFastAbortFromMessage } from "./abort.js";
import { shouldSkipDuplicateInbound } from "./inbound-dedupe.js";
import type { ReplyDispatcher, ReplyDispatchKind } from "./reply-dispatcher.js";
import { shouldSuppressReasoningPayload } from "./reply-payloads.js";
import { isRoutableChannel, routeReply } from "./route-reply.js";

const AUDIO_PLACEHOLDER_RE = /^<media:audio>(\s*\([^)]*\))?$/i;
const AUDIO_HEADER_RE = /^\[Audio\b/i;
const DEFAULT_ACP_STREAM_BATCH_MS = 350;
const DEFAULT_ACP_STREAM_MAX_CHUNK_CHARS = 1800;
const ACP_DISPATCH_DISABLED_MESSAGE =
  "ACP dispatch is disabled by policy. Ask an admin to enable `acp.dispatch.enabled`.";

const normalizeMediaType = (value: string): string => value.split(";")[0]?.trim().toLowerCase();

const isInboundAudioContext = (ctx: FinalizedMsgContext): boolean => {
  const rawTypes = [
    typeof ctx.MediaType === "string" ? ctx.MediaType : undefined,
    ...(Array.isArray(ctx.MediaTypes) ? ctx.MediaTypes : []),
  ].filter(Boolean) as string[];
  const types = rawTypes.map((type) => normalizeMediaType(type));
  if (types.some((type) => type === "audio" || type.startsWith("audio/"))) {
    return true;
  }

  const body =
    typeof ctx.BodyForCommands === "string"
      ? ctx.BodyForCommands
      : typeof ctx.CommandBody === "string"
        ? ctx.CommandBody
        : typeof ctx.RawBody === "string"
          ? ctx.RawBody
          : typeof ctx.Body === "string"
            ? ctx.Body
            : "";
  const trimmed = body.trim();
  if (!trimmed) {
    return false;
  }
  if (AUDIO_PLACEHOLDER_RE.test(trimmed)) {
    return true;
  }
  return AUDIO_HEADER_RE.test(trimmed);
};

const resolveSessionTtsAuto = (
  ctx: FinalizedMsgContext,
  cfg: OpenClawConfig,
): string | undefined => {
  const targetSessionKey =
    ctx.CommandSource === "native" ? ctx.CommandTargetSessionKey?.trim() : undefined;
  const sessionKey = (targetSessionKey ?? ctx.SessionKey)?.trim();
  if (!sessionKey) {
    return undefined;
  }
  const agentId = resolveSessionAgentId({ sessionKey, config: cfg });
  const storePath = resolveStorePath(cfg.session?.store, { agentId });
  try {
    const store = loadSessionStore(storePath);
    const entry = store[sessionKey.toLowerCase()] ?? store[sessionKey];
    return normalizeTtsAutoMode(entry?.ttsAuto);
  } catch {
    return undefined;
  }
};

const clampPositiveInteger = (
  value: unknown,
  fallback: number,
  bounds: { min: number; max: number },
): number => {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return fallback;
  }
  const rounded = Math.round(value);
  if (rounded < bounds.min) {
    return bounds.min;
  }
  if (rounded > bounds.max) {
    return bounds.max;
  }
  return rounded;
};

const isAcpDispatchEnabled = (cfg: OpenClawConfig): boolean => {
  if (cfg.acp?.enabled === false) {
    return false;
  }
  return cfg.acp?.dispatch?.enabled === true;
};

const resolveAcpStreamBatchMs = (cfg: OpenClawConfig): number =>
  clampPositiveInteger(cfg.acp?.stream?.batchMs, DEFAULT_ACP_STREAM_BATCH_MS, {
    min: 0,
    max: 5_000,
  });

const resolveAcpStreamMaxChunkChars = (cfg: OpenClawConfig): number =>
  clampPositiveInteger(cfg.acp?.stream?.maxChunkChars, DEFAULT_ACP_STREAM_MAX_CHUNK_CHARS, {
    min: 50,
    max: 4_000,
  });

const resolveAcpPromptText = (ctx: FinalizedMsgContext): string =>
  (typeof ctx.BodyForAgent === "string"
    ? ctx.BodyForAgent
    : typeof ctx.BodyForCommands === "string"
      ? ctx.BodyForCommands
      : typeof ctx.CommandBody === "string"
        ? ctx.CommandBody
        : typeof ctx.RawBody === "string"
          ? ctx.RawBody
          : typeof ctx.Body === "string"
            ? ctx.Body
            : ""
  ).trim();

const resolveAcpRequestId = (ctx: FinalizedMsgContext): string => {
  const id = ctx.MessageSidFull ?? ctx.MessageSid ?? ctx.MessageSidFirst ?? ctx.MessageSidLast;
  if (typeof id === "string" && id.trim()) {
    return id.trim();
  }
  if (typeof id === "number" || typeof id === "bigint") {
    return String(id);
  }
  return `${Date.now()}:${Math.random().toString(16).slice(2)}`;
};

const formatAcpErrorReply = (err: AcpRuntimeError): string =>
  `ACP error (${err.code}): ${err.message}`;

export type DispatchFromConfigResult = {
  queuedFinal: boolean;
  counts: Record<ReplyDispatchKind, number>;
};

export async function dispatchReplyFromConfig(params: {
  ctx: FinalizedMsgContext;
  cfg: OpenClawConfig;
  dispatcher: ReplyDispatcher;
  replyOptions?: Omit<GetReplyOptions, "onToolResult" | "onBlockReply">;
  replyResolver?: typeof getReplyFromConfig;
}): Promise<DispatchFromConfigResult> {
  const { ctx, cfg, dispatcher } = params;
  const diagnosticsEnabled = isDiagnosticsEnabled(cfg);
  const channel = String(ctx.Surface ?? ctx.Provider ?? "unknown").toLowerCase();
  const chatId = ctx.To ?? ctx.From;
  const messageId = ctx.MessageSid ?? ctx.MessageSidFirst ?? ctx.MessageSidLast;
  const sessionKey = ctx.SessionKey;
  const startTime = diagnosticsEnabled ? Date.now() : 0;
  const canTrackSession = diagnosticsEnabled && Boolean(sessionKey);

  const recordProcessed = (
    outcome: "completed" | "skipped" | "error",
    opts?: {
      reason?: string;
      error?: string;
    },
  ) => {
    if (!diagnosticsEnabled) {
      return;
    }
    logMessageProcessed({
      channel,
      chatId,
      messageId,
      sessionKey,
      durationMs: Date.now() - startTime,
      outcome,
      reason: opts?.reason,
      error: opts?.error,
    });
  };

  const markProcessing = () => {
    if (!canTrackSession || !sessionKey) {
      return;
    }
    logMessageQueued({ sessionKey, channel, source: "dispatch" });
    logSessionStateChange({
      sessionKey,
      state: "processing",
      reason: "message_start",
    });
  };

  const markIdle = (reason: string) => {
    if (!canTrackSession || !sessionKey) {
      return;
    }
    logSessionStateChange({
      sessionKey,
      state: "idle",
      reason,
    });
  };

  if (shouldSkipDuplicateInbound(ctx)) {
    recordProcessed("skipped", { reason: "duplicate" });
    return { queuedFinal: false, counts: dispatcher.getQueuedCounts() };
  }

  const inboundAudio = isInboundAudioContext(ctx);
  const sessionTtsAuto = resolveSessionTtsAuto(ctx, cfg);
  const hookRunner = getGlobalHookRunner();

  // Extract message context for hooks (plugin and internal)
  const timestamp =
    typeof ctx.Timestamp === "number" && Number.isFinite(ctx.Timestamp) ? ctx.Timestamp : undefined;
  const messageIdForHook =
    ctx.MessageSidFull ?? ctx.MessageSid ?? ctx.MessageSidFirst ?? ctx.MessageSidLast;
  const content =
    typeof ctx.BodyForCommands === "string"
      ? ctx.BodyForCommands
      : typeof ctx.RawBody === "string"
        ? ctx.RawBody
        : typeof ctx.Body === "string"
          ? ctx.Body
          : "";
  const channelId = (ctx.OriginatingChannel ?? ctx.Surface ?? ctx.Provider ?? "").toLowerCase();
  const conversationId = ctx.OriginatingTo ?? ctx.To ?? ctx.From ?? undefined;

  // Trigger plugin hooks (fire-and-forget)
  if (hookRunner?.hasHooks("message_received")) {
    void hookRunner
      .runMessageReceived(
        {
          from: ctx.From ?? "",
          content,
          timestamp,
          metadata: {
            to: ctx.To,
            provider: ctx.Provider,
            surface: ctx.Surface,
            threadId: ctx.MessageThreadId,
            originatingChannel: ctx.OriginatingChannel,
            originatingTo: ctx.OriginatingTo,
            messageId: messageIdForHook,
            senderId: ctx.SenderId,
            senderName: ctx.SenderName,
            senderUsername: ctx.SenderUsername,
            senderE164: ctx.SenderE164,
            guildId: ctx.GroupSpace,
            channelName: ctx.GroupChannel,
          },
        },
        {
          channelId,
          accountId: ctx.AccountId,
          conversationId,
        },
      )
      .catch((err) => {
        logVerbose(`dispatch-from-config: message_received plugin hook failed: ${String(err)}`);
      });
  }

  // Bridge to internal hooks (HOOK.md discovery system) - refs #8807
  if (sessionKey) {
    void triggerInternalHook(
      createInternalHookEvent("message", "received", sessionKey, {
        from: ctx.From ?? "",
        content,
        timestamp,
        channelId,
        accountId: ctx.AccountId,
        conversationId,
        messageId: messageIdForHook,
        metadata: {
          to: ctx.To,
          provider: ctx.Provider,
          surface: ctx.Surface,
          threadId: ctx.MessageThreadId,
          senderId: ctx.SenderId,
          senderName: ctx.SenderName,
          senderUsername: ctx.SenderUsername,
          senderE164: ctx.SenderE164,
          guildId: ctx.GroupSpace,
          channelName: ctx.GroupChannel,
        },
      }),
    ).catch((err) => {
      logVerbose(`dispatch-from-config: message_received internal hook failed: ${String(err)}`);
    });
  }

  // Check if we should route replies to originating channel instead of dispatcher.
  // Only route when the originating channel is DIFFERENT from the current surface.
  // This handles cross-provider routing (e.g., message from Telegram being processed
  // by a shared session that's currently on Slack) while preserving normal dispatcher
  // flow when the provider handles its own messages.
  //
  // Debug: `pnpm test src/auto-reply/reply/dispatch-from-config.test.ts`
  const originatingChannel = ctx.OriginatingChannel;
  const originatingTo = ctx.OriginatingTo;
  const currentSurface = (ctx.Surface ?? ctx.Provider)?.toLowerCase();
  const shouldRouteToOriginating =
    isRoutableChannel(originatingChannel) && originatingTo && originatingChannel !== currentSurface;
  const ttsChannel = shouldRouteToOriginating ? originatingChannel : currentSurface;

  /**
   * Helper to send a payload via route-reply (async).
   * Only used when actually routing to a different provider.
   * Note: Only called when shouldRouteToOriginating is true, so
   * originatingChannel and originatingTo are guaranteed to be defined.
   */
  const sendPayloadAsync = async (
    payload: ReplyPayload,
    abortSignal?: AbortSignal,
    mirror?: boolean,
  ): Promise<void> => {
    // TypeScript doesn't narrow these from the shouldRouteToOriginating check,
    // but they're guaranteed non-null when this function is called.
    if (!originatingChannel || !originatingTo) {
      return;
    }
    if (abortSignal?.aborted) {
      return;
    }
    const result = await routeReply({
      payload,
      channel: originatingChannel,
      to: originatingTo,
      sessionKey: ctx.SessionKey,
      accountId: ctx.AccountId,
      threadId: ctx.MessageThreadId,
      cfg,
      abortSignal,
      mirror,
    });
    if (!result.ok) {
      logVerbose(`dispatch-from-config: route-reply failed: ${result.error ?? "unknown error"}`);
    }
  };

  markProcessing();

  try {
    const fastAbort = await tryFastAbortFromMessage({ ctx, cfg });
    if (fastAbort.handled) {
      const payload = {
        text: formatAbortReplyText(fastAbort.stoppedSubagents),
      } satisfies ReplyPayload;
      let queuedFinal = false;
      let routedFinalCount = 0;
      if (shouldRouteToOriginating && originatingChannel && originatingTo) {
        const result = await routeReply({
          payload,
          channel: originatingChannel,
          to: originatingTo,
          sessionKey: ctx.SessionKey,
          accountId: ctx.AccountId,
          threadId: ctx.MessageThreadId,
          cfg,
        });
        queuedFinal = result.ok;
        if (result.ok) {
          routedFinalCount += 1;
        }
        if (!result.ok) {
          logVerbose(
            `dispatch-from-config: route-reply (abort) failed: ${result.error ?? "unknown error"}`,
          );
        }
      } else {
        queuedFinal = dispatcher.sendFinalReply(payload);
      }
      const counts = dispatcher.getQueuedCounts();
      counts.final += routedFinalCount;
      recordProcessed("completed", { reason: "fast_abort" });
      markIdle("message_completed");
      return { queuedFinal, counts };
    }

    const shouldSendToolSummaries = ctx.ChatType !== "group" && ctx.CommandSource !== "native";

    let acpSessionMeta: SessionAcpMeta | undefined;
    if (sessionKey) {
      try {
        acpSessionMeta = readAcpSessionEntry({ sessionKey, cfg })?.acp;
      } catch (err) {
        logVerbose(
          `dispatch-from-config: failed reading ACP session metadata for ${sessionKey}: ${String(err)}`,
        );
      }
    }

    if (acpSessionMeta && sessionKey) {
      const routedCounts: Record<ReplyDispatchKind, number> = {
        tool: 0,
        block: 0,
        final: 0,
      };
      let queuedFinal = false;
      const updateAcpMeta = async (
        patch: Partial<SessionAcpMeta> & Pick<SessionAcpMeta, "state">,
        opts?: { clearLastError?: boolean },
      ) => {
        try {
          await upsertAcpSessionMeta({
            sessionKey,
            cfg,
            mutate: (current, entry) => {
              if (!entry) {
                return undefined;
              }
              const base = current ?? acpSessionMeta;
              if (!base) {
                return undefined;
              }
              const next: SessionAcpMeta = {
                ...base,
                ...patch,
                state: patch.state,
                lastActivityAt: Date.now(),
              };
              if (opts?.clearLastError) {
                delete next.lastError;
              }
              return next;
            },
          });
        } catch (err) {
          logVerbose(
            `dispatch-from-config: failed updating ACP session metadata for ${sessionKey}: ${String(err)}`,
          );
        }
      };

      const deliverAcpPayload = async (
        kind: ReplyDispatchKind,
        payload: ReplyPayload,
      ): Promise<boolean> => {
        const ttsPayload = await maybeApplyTtsToPayload({
          payload,
          cfg,
          channel: ttsChannel,
          kind,
          inboundAudio,
          ttsAuto: sessionTtsAuto,
        });
        if (shouldRouteToOriginating && originatingChannel && originatingTo) {
          const result = await routeReply({
            payload: ttsPayload,
            channel: originatingChannel,
            to: originatingTo,
            sessionKey: ctx.SessionKey,
            accountId: ctx.AccountId,
            threadId: ctx.MessageThreadId,
            cfg,
          });
          if (!result.ok) {
            logVerbose(
              `dispatch-from-config: route-reply (acp/${kind}) failed: ${result.error ?? "unknown error"}`,
            );
            return false;
          }
          routedCounts[kind] += 1;
          return true;
        }
        if (kind === "tool") {
          return dispatcher.sendToolResult(ttsPayload);
        }
        if (kind === "block") {
          return dispatcher.sendBlockReply(ttsPayload);
        }
        return dispatcher.sendFinalReply(ttsPayload);
      };

      const promptText = resolveAcpPromptText(ctx);
      if (!promptText) {
        const counts = dispatcher.getQueuedCounts();
        counts.tool += routedCounts.tool;
        counts.block += routedCounts.block;
        counts.final += routedCounts.final;
        recordProcessed("completed", { reason: "acp_empty_prompt" });
        markIdle("message_completed");
        return { queuedFinal: false, counts };
      }

      const sessionMode = acpSessionMeta.mode ?? "persistent";
      let acpHandle: AcpRuntimeHandle | null = null;
      let runtime: AcpRuntime | null = null;
      try {
        if (!isAcpDispatchEnabled(cfg)) {
          throw new AcpRuntimeError("ACP_DISPATCH_DISABLED", ACP_DISPATCH_DISABLED_MESSAGE);
        }

        const backend = requireAcpRuntimeBackend(acpSessionMeta.backend || cfg.acp?.backend);
        runtime = backend.runtime;

        const configuredAgent = acpSessionMeta.agent?.trim() || cfg.acp?.defaultAgent?.trim() || "";
        const requestedAgent = configuredAgent || resolveAgentIdFromSessionKey(sessionKey);
        const normalizedAllowedAgents = (cfg.acp?.allowedAgents ?? [])
          .map((entry) => entry.trim().toLowerCase())
          .filter(Boolean);
        if (
          normalizedAllowedAgents.length > 0 &&
          !normalizedAllowedAgents.includes(requestedAgent.toLowerCase())
        ) {
          throw new AcpRuntimeError(
            "ACP_SESSION_INIT_FAILED",
            `ACP agent "${requestedAgent}" is not allowed by policy.`,
          );
        }

        try {
          acpHandle = await runtime.ensureSession({
            sessionKey,
            agent: requestedAgent,
            mode: sessionMode,
            cwd: acpSessionMeta.cwd,
          });
        } catch (err) {
          throw toAcpRuntimeError({
            error: err,
            fallbackCode: "ACP_SESSION_INIT_FAILED",
            fallbackMessage: "Could not initialize ACP session runtime.",
          });
        }

        await updateAcpMeta(
          {
            backend: acpHandle.backend,
            agent: requestedAgent,
            runtimeSessionName: acpHandle.runtimeSessionName,
            mode: sessionMode,
            state: "running",
          },
          { clearLastError: true },
        );

        const batchMs = resolveAcpStreamBatchMs(cfg);
        const maxChunkChars = resolveAcpStreamMaxChunkChars(cfg);
        let streamBuffer = "";
        let lastFlushAt = 0;
        let streamErrorMessage: string | null = null;

        const flushBufferedAcpText = async (force: boolean): Promise<void> => {
          while (streamBuffer.length > 0) {
            const now = Date.now();
            if (!force && streamBuffer.length < maxChunkChars && now - lastFlushAt < batchMs) {
              return;
            }
            const chunk = streamBuffer.slice(0, maxChunkChars);
            streamBuffer = streamBuffer.slice(chunk.length);
            const didDeliver = await deliverAcpPayload("block", { text: chunk });
            if (didDeliver) {
              lastFlushAt = Date.now();
            }
            if (!force && streamBuffer.length < maxChunkChars) {
              return;
            }
          }
        };

        for await (const event of runtime.runTurn({
          handle: acpHandle,
          text: promptText,
          mode: "prompt",
          requestId: resolveAcpRequestId(ctx),
        })) {
          if (event.type === "text_delta") {
            if (event.stream && event.stream !== "output") {
              continue;
            }
            if (event.text) {
              streamBuffer += event.text;
              await flushBufferedAcpText(false);
            }
            continue;
          }

          if (event.type === "status") {
            if (shouldSendToolSummaries && event.text) {
              await deliverAcpPayload("tool", { text: `⚙️ ${event.text}` });
            }
            continue;
          }

          if (event.type === "tool_call") {
            if (shouldSendToolSummaries && event.text) {
              await deliverAcpPayload("tool", { text: `🧰 ${event.text}` });
            }
            continue;
          }

          if (event.type === "error") {
            streamErrorMessage = event.message?.trim() || "ACP turn failed before completion.";
            break;
          }

          if (event.type === "done") {
            break;
          }
        }

        await flushBufferedAcpText(true);

        if (streamErrorMessage) {
          throw new AcpRuntimeError("ACP_TURN_FAILED", streamErrorMessage);
        }

        await updateAcpMeta({ state: "idle" }, { clearLastError: true });

        const counts = dispatcher.getQueuedCounts();
        counts.tool += routedCounts.tool;
        counts.block += routedCounts.block;
        counts.final += routedCounts.final;
        recordProcessed("completed", { reason: "acp_dispatch" });
        markIdle("message_completed");
        return { queuedFinal, counts };
      } catch (err) {
        const acpError = toAcpRuntimeError({
          error: err,
          fallbackCode: "ACP_TURN_FAILED",
          fallbackMessage: "ACP turn failed before completion.",
        });
        await updateAcpMeta({
          state: "error",
          lastError: acpError.message,
        });
        const delivered = await deliverAcpPayload("final", {
          text: formatAcpErrorReply(acpError),
          isError: true,
        });
        queuedFinal = queuedFinal || delivered;
        const counts = dispatcher.getQueuedCounts();
        counts.tool += routedCounts.tool;
        counts.block += routedCounts.block;
        counts.final += routedCounts.final;
        recordProcessed("completed", {
          reason: `acp_error:${acpError.code.toLowerCase()}`,
        });
        markIdle("message_completed");
        return { queuedFinal, counts };
      } finally {
        if (sessionMode === "oneshot" && runtime && acpHandle) {
          try {
            await runtime.close({
              handle: acpHandle,
              reason: "oneshot-complete",
            });
          } catch (err) {
            logVerbose(`dispatch-from-config: ACP oneshot close failed: ${String(err)}`);
          }
        }
      }
    }

    // Track accumulated block text for TTS generation after streaming completes.
    // When block streaming succeeds, there's no final reply, so we need to generate
    // TTS audio separately from the accumulated block content.
    let accumulatedBlockText = "";
    let blockCount = 0;

    const resolveToolDeliveryPayload = (payload: ReplyPayload): ReplyPayload | null => {
      if (shouldSendToolSummaries) {
        return payload;
      }
      // Group/native flows intentionally suppress tool summary text, but media-only
      // tool results (for example TTS audio) must still be delivered.
      const hasMedia = Boolean(payload.mediaUrl) || (payload.mediaUrls?.length ?? 0) > 0;
      if (!hasMedia) {
        return null;
      }
      return { ...payload, text: undefined };
    };

    const replyResult = await (params.replyResolver ?? getReplyFromConfig)(
      ctx,
      {
        ...params.replyOptions,
        onToolResult: (payload: ReplyPayload) => {
          const run = async () => {
            const ttsPayload = await maybeApplyTtsToPayload({
              payload,
              cfg,
              channel: ttsChannel,
              kind: "tool",
              inboundAudio,
              ttsAuto: sessionTtsAuto,
            });
            const deliveryPayload = resolveToolDeliveryPayload(ttsPayload);
            if (!deliveryPayload) {
              return;
            }
            if (shouldRouteToOriginating) {
              await sendPayloadAsync(deliveryPayload, undefined, false);
            } else {
              dispatcher.sendToolResult(deliveryPayload);
            }
          };
          return run();
        },
        onBlockReply: (payload: ReplyPayload, context) => {
          const run = async () => {
            // Suppress reasoning payloads — channels using this generic dispatch
            // path (WhatsApp, web, etc.) do not have a dedicated reasoning lane.
            // Telegram has its own dispatch path that handles reasoning splitting.
            if (shouldSuppressReasoningPayload(payload)) {
              return;
            }
            // Accumulate block text for TTS generation after streaming
            if (payload.text) {
              if (accumulatedBlockText.length > 0) {
                accumulatedBlockText += "\n";
              }
              accumulatedBlockText += payload.text;
              blockCount++;
            }
            const ttsPayload = await maybeApplyTtsToPayload({
              payload,
              cfg,
              channel: ttsChannel,
              kind: "block",
              inboundAudio,
              ttsAuto: sessionTtsAuto,
            });
            if (shouldRouteToOriginating) {
              await sendPayloadAsync(ttsPayload, context?.abortSignal, false);
            } else {
              dispatcher.sendBlockReply(ttsPayload);
            }
          };
          return run();
        },
      },
      cfg,
    );

    const replies = replyResult ? (Array.isArray(replyResult) ? replyResult : [replyResult]) : [];

    let queuedFinal = false;
    let routedFinalCount = 0;
    for (const reply of replies) {
      // Suppress reasoning payloads from channel delivery — channels using this
      // generic dispatch path do not have a dedicated reasoning lane.
      if (shouldSuppressReasoningPayload(reply)) {
        continue;
      }
      const ttsReply = await maybeApplyTtsToPayload({
        payload: reply,
        cfg,
        channel: ttsChannel,
        kind: "final",
        inboundAudio,
        ttsAuto: sessionTtsAuto,
      });
      if (shouldRouteToOriginating && originatingChannel && originatingTo) {
        // Route final reply to originating channel.
        const result = await routeReply({
          payload: ttsReply,
          channel: originatingChannel,
          to: originatingTo,
          sessionKey: ctx.SessionKey,
          accountId: ctx.AccountId,
          threadId: ctx.MessageThreadId,
          cfg,
        });
        if (!result.ok) {
          logVerbose(
            `dispatch-from-config: route-reply (final) failed: ${result.error ?? "unknown error"}`,
          );
        }
        queuedFinal = result.ok || queuedFinal;
        if (result.ok) {
          routedFinalCount += 1;
        }
      } else {
        queuedFinal = dispatcher.sendFinalReply(ttsReply) || queuedFinal;
      }
    }

    const ttsMode = resolveTtsConfig(cfg).mode ?? "final";
    // Generate TTS-only reply after block streaming completes (when there's no final reply).
    // This handles the case where block streaming succeeds and drops final payloads,
    // but we still want TTS audio to be generated from the accumulated block content.
    if (
      ttsMode === "final" &&
      replies.length === 0 &&
      blockCount > 0 &&
      accumulatedBlockText.trim()
    ) {
      try {
        const ttsSyntheticReply = await maybeApplyTtsToPayload({
          payload: { text: accumulatedBlockText },
          cfg,
          channel: ttsChannel,
          kind: "final",
          inboundAudio,
          ttsAuto: sessionTtsAuto,
        });
        // Only send if TTS was actually applied (mediaUrl exists)
        if (ttsSyntheticReply.mediaUrl) {
          // Send TTS-only payload (no text, just audio) so it doesn't duplicate the block content
          const ttsOnlyPayload: ReplyPayload = {
            mediaUrl: ttsSyntheticReply.mediaUrl,
            audioAsVoice: ttsSyntheticReply.audioAsVoice,
          };
          if (shouldRouteToOriginating && originatingChannel && originatingTo) {
            const result = await routeReply({
              payload: ttsOnlyPayload,
              channel: originatingChannel,
              to: originatingTo,
              sessionKey: ctx.SessionKey,
              accountId: ctx.AccountId,
              threadId: ctx.MessageThreadId,
              cfg,
            });
            queuedFinal = result.ok || queuedFinal;
            if (result.ok) {
              routedFinalCount += 1;
            }
            if (!result.ok) {
              logVerbose(
                `dispatch-from-config: route-reply (tts-only) failed: ${result.error ?? "unknown error"}`,
              );
            }
          } else {
            const didQueue = dispatcher.sendFinalReply(ttsOnlyPayload);
            queuedFinal = didQueue || queuedFinal;
          }
        }
      } catch (err) {
        logVerbose(
          `dispatch-from-config: accumulated block TTS failed: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }

    const counts = dispatcher.getQueuedCounts();
    counts.final += routedFinalCount;
    recordProcessed("completed");
    markIdle("message_completed");
    return { queuedFinal, counts };
  } catch (err) {
    recordProcessed("error", { error: String(err) });
    markIdle("message_error");
    throw err;
  }
}
