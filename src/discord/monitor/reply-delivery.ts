import { serializePayload, type RequestClient } from "@buape/carbon";
import { Routes } from "discord-api-types/v10";
import { resolveAgentAvatar } from "../../agents/identity-avatar.js";
import type { ChunkMode } from "../../auto-reply/chunk.js";
import type { ReplyPayload } from "../../auto-reply/types.js";
import { loadConfig } from "../../config/config.js";
import type { MarkdownTableMode, ReplyToMode } from "../../config/types.base.js";
import { logVerbose } from "../../globals.js";
import { splitMarkdownTables } from "../../markdown/table-split.js";
import { convertMarkdownTables } from "../../markdown/tables.js";
import { renderTableImage } from "../../media/table-image.js";
import type { RuntimeEnv } from "../../runtime.js";
import { chunkDiscordTextWithMode } from "../chunk.js";
import { sendMessageDiscord, sendVoiceMessageDiscord, sendWebhookMessageDiscord } from "../send.js";
import { buildDiscordMessagePayload, stripUndefinedFields } from "../send.shared.js";
import type { ThreadBindingManager, ThreadBindingRecord } from "./thread-bindings.js";

function resolveTargetChannelId(target: string): string | undefined {
  if (!target.startsWith("channel:")) {
    return undefined;
  }
  const channelId = target.slice("channel:".length).trim();
  return channelId || undefined;
}

function resolveBoundThreadBinding(params: {
  threadBindings?: ThreadBindingManager;
  sessionKey?: string;
  target: string;
}): ThreadBindingRecord | undefined {
  const sessionKey = params.sessionKey?.trim();
  if (!params.threadBindings || !sessionKey) {
    return undefined;
  }
  const bindings = params.threadBindings.listBySessionKey(sessionKey);
  if (bindings.length === 0) {
    return undefined;
  }
  const targetChannelId = resolveTargetChannelId(params.target);
  if (!targetChannelId) {
    return undefined;
  }
  return bindings.find((entry) => entry.threadId === targetChannelId);
}

function resolveBindingPersona(binding: ThreadBindingRecord | undefined): {
  username?: string;
  avatarUrl?: string;
} {
  if (!binding) {
    return {};
  }
  const baseLabel = binding.label?.trim() || binding.agentId;
  const username = (`🤖 ${baseLabel}`.trim() || "🤖 agent").slice(0, 80);

  let avatarUrl: string | undefined;
  try {
    const avatar = resolveAgentAvatar(loadConfig(), binding.agentId);
    if (avatar.kind === "remote") {
      avatarUrl = avatar.url;
    }
  } catch {
    avatarUrl = undefined;
  }
  return { username, avatarUrl };
}

async function sendDiscordChunkWithFallback(params: {
  target: string;
  text: string;
  token: string;
  accountId?: string;
  rest?: RequestClient;
  replyTo?: string;
  binding?: ThreadBindingRecord;
  username?: string;
  avatarUrl?: string;
}) {
  const text = params.text.trim();
  if (!text) {
    return;
  }
  const binding = params.binding;
  if (binding?.webhookId && binding?.webhookToken) {
    try {
      await sendWebhookMessageDiscord(text, {
        webhookId: binding.webhookId,
        webhookToken: binding.webhookToken,
        accountId: binding.accountId,
        threadId: binding.threadId,
        replyTo: params.replyTo,
        username: params.username,
        avatarUrl: params.avatarUrl,
      });
      return;
    } catch {
      // Fall through to the standard bot sender path.
    }
  }
  await sendMessageDiscord(params.target, text, {
    token: params.token,
    rest: params.rest,
    accountId: params.accountId,
    replyTo: params.replyTo,
  });
}

// ---------------------------------------------------------------------------
// Table image helpers
// ---------------------------------------------------------------------------

/** Resolve a routed target like `channel:123456` or `discord:channel:123456` to a raw snowflake. */
function resolveRawChannelId(target: string): string {
  if (target.startsWith("discord:channel:")) {
    return target.slice("discord:channel:".length);
  }
  if (target.startsWith("channel:")) {
    return target.slice("channel:".length);
  }
  return target;
}

/**
 * Post a raw buffer as a file attachment (bypasses loadWebMedia JPEG recompression).
 * Uses rest.post directly — transient failures fall through to the text fallback
 * in the caller, which is faster than retrying a file upload.
 */
async function sendDiscordFileBuffer(params: {
  rest: RequestClient;
  channelId: string;
  fileName: string;
  contentType: string;
  data: Buffer;
  replyTo?: string;
}) {
  const rawChannelId = resolveRawChannelId(params.channelId);
  const arrayBuffer = new ArrayBuffer(params.data.byteLength);
  new Uint8Array(arrayBuffer).set(params.data);
  const blob = new Blob([arrayBuffer], { type: params.contentType });
  const payload = buildDiscordMessagePayload({
    text: "",
    files: [{ data: blob, name: params.fileName }],
  });
  const messageReference = params.replyTo
    ? { message_id: params.replyTo, fail_if_not_exists: false }
    : undefined;

  await params.rest.post(Routes.channelMessages(rawChannelId), {
    body: stripUndefinedFields({
      ...serializePayload(payload),
      ...(messageReference ? { message_reference: messageReference } : {}),
    }),
  });
}

/** Send chunked text respecting webhooks/persona. */
async function sendChunkedTextWithFallback(
  text: string,
  params: {
    target: string;
    token: string;
    accountId?: string;
    rest?: RequestClient;
    replyTo?: string;
    chunkLimit: number;
    maxLinesPerMessage?: number;
    chunkMode: ChunkMode;
    binding?: ThreadBindingRecord;
    username?: string;
    avatarUrl?: string;
  },
) {
  const chunks = chunkDiscordTextWithMode(text, {
    maxChars: params.chunkLimit,
    maxLines: params.maxLinesPerMessage,
    chunkMode: params.chunkMode,
  });
  if (!chunks.length && text) {
    chunks.push(text);
  }
  for (const chunk of chunks) {
    const trimmed = chunk.trim();
    if (!trimmed) {
      continue;
    }
    await sendDiscordChunkWithFallback({
      target: params.target,
      text: trimmed,
      token: params.token,
      rest: params.rest,
      accountId: params.accountId,
      replyTo: params.replyTo,
      binding: params.binding,
      username: params.username,
      avatarUrl: params.avatarUrl,
    });
  }
}

async function deliverWithTableImages(params: {
  rawText: string;
  target: string;
  token: string;
  accountId?: string;
  rest?: RequestClient;
  runtime: RuntimeEnv;
  chunkLimit: number;
  maxLinesPerMessage?: number;
  replyTo?: string;
  chunkMode: ChunkMode;
  binding?: ThreadBindingRecord;
  username?: string;
  avatarUrl?: string;
}): Promise<boolean> {
  const { rawText, rest } = params;
  if (!rest) {
    return false;
  }

  const segments = splitMarkdownTables(rawText);
  if (!segments.some((s) => s.kind === "table")) {
    return false;
  }

  for (const segment of segments) {
    if (segment.kind === "text") {
      const text = convertMarkdownTables(segment.markdown, "code");
      await sendChunkedTextWithFallback(text, params);
    } else {
      const png = await renderTableImage(segment.markdown);
      if (png) {
        try {
          await sendDiscordFileBuffer({
            rest,
            channelId: params.target,
            fileName: `table-${segment.index + 1}.png`,
            contentType: "image/png",
            data: png,
            replyTo: params.replyTo,
          });
        } catch (err) {
          logVerbose(
            `discord: table image send failed, falling back to text: ${err instanceof Error ? err.message : String(err)}`,
          );
          const fallback = convertMarkdownTables(segment.markdown, "code");
          if (fallback.trim()) {
            await sendChunkedTextWithFallback(fallback, params);
          }
        }
      } else {
        const fallback = convertMarkdownTables(segment.markdown, "code");
        if (fallback.trim()) {
          await sendChunkedTextWithFallback(fallback, params);
        }
      }
    }
  }

  return true;
}

// ---------------------------------------------------------------------------
// Main delivery function
// ---------------------------------------------------------------------------

export async function deliverDiscordReply(params: {
  replies: ReplyPayload[];
  target: string;
  token: string;
  accountId?: string;
  rest?: RequestClient;
  runtime: RuntimeEnv;
  textLimit: number;
  maxLinesPerMessage?: number;
  replyToId?: string;
  replyToMode?: ReplyToMode;
  tableMode?: MarkdownTableMode;
  chunkMode?: ChunkMode;
  sessionKey?: string;
  threadBindings?: ThreadBindingManager;
}) {
  const chunkLimit = Math.min(params.textLimit, 2000);
  const replyTo = params.replyToId?.trim() || undefined;
  const replyToMode = params.replyToMode ?? "all";
  // replyToMode=first should only apply to the first physical send.
  const replyOnce = replyToMode === "first";
  let replyUsed = false;
  const resolveReplyTo = () => {
    if (!replyTo) {
      return undefined;
    }
    if (!replyOnce) {
      return replyTo;
    }
    if (replyUsed) {
      return undefined;
    }
    replyUsed = true;
    return replyTo;
  };
  const binding = resolveBoundThreadBinding({
    threadBindings: params.threadBindings,
    sessionKey: params.sessionKey,
    target: params.target,
  });
  const persona = resolveBindingPersona(binding);
  for (const payload of params.replies) {
    const mediaList = payload.mediaUrls ?? (payload.mediaUrl ? [payload.mediaUrl] : []);
    const rawText = payload.text ?? "";
    const tableMode = params.tableMode ?? "code";

    // Image table path: segment text, render tables as PNG, send text normally.
    if (tableMode === "image" && mediaList.length === 0) {
      const delivered = await deliverWithTableImages({
        rawText,
        target: params.target,
        token: params.token,
        accountId: params.accountId,
        rest: params.rest,
        runtime: params.runtime,
        chunkLimit,
        maxLinesPerMessage: params.maxLinesPerMessage,
        replyTo: resolveReplyTo(),
        chunkMode: params.chunkMode ?? "length",
        binding,
        username: persona.username,
        avatarUrl: persona.avatarUrl,
      });
      if (delivered) {
        continue;
      }
      // Fall through to standard text delivery if renderer unavailable
    }

    const effectiveTableMode = tableMode === "image" ? "code" : tableMode;
    const text = convertMarkdownTables(rawText, effectiveTableMode);
    if (!text && mediaList.length === 0) {
      continue;
    }
    if (mediaList.length === 0) {
      const mode = params.chunkMode ?? "length";
      const chunks = chunkDiscordTextWithMode(text, {
        maxChars: chunkLimit,
        maxLines: params.maxLinesPerMessage,
        chunkMode: mode,
      });
      if (!chunks.length && text) {
        chunks.push(text);
      }
      for (const chunk of chunks) {
        if (!chunk.trim()) {
          continue;
        }
        const replyTo = resolveReplyTo();
        await sendDiscordChunkWithFallback({
          target: params.target,
          text: chunk,
          token: params.token,
          rest: params.rest,
          accountId: params.accountId,
          replyTo,
          binding,
          username: persona.username,
          avatarUrl: persona.avatarUrl,
        });
      }
      continue;
    }

    const firstMedia = mediaList[0];
    if (!firstMedia) {
      continue;
    }

    // Voice message path: audioAsVoice flag routes through sendVoiceMessageDiscord.
    if (payload.audioAsVoice) {
      const replyTo = resolveReplyTo();
      await sendVoiceMessageDiscord(params.target, firstMedia, {
        token: params.token,
        rest: params.rest,
        accountId: params.accountId,
        replyTo,
      });
      // Voice messages cannot include text; send remaining text separately if present.
      await sendDiscordChunkWithFallback({
        target: params.target,
        text,
        token: params.token,
        rest: params.rest,
        accountId: params.accountId,
        replyTo: resolveReplyTo(),
        binding,
        username: persona.username,
        avatarUrl: persona.avatarUrl,
      });
      // Additional media items are sent as regular attachments (voice is single-file only).
      for (const extra of mediaList.slice(1)) {
        const replyTo = resolveReplyTo();
        await sendMessageDiscord(params.target, "", {
          token: params.token,
          rest: params.rest,
          mediaUrl: extra,
          accountId: params.accountId,
          replyTo,
        });
      }
      continue;
    }

    const replyTo = resolveReplyTo();
    await sendMessageDiscord(params.target, text, {
      token: params.token,
      rest: params.rest,
      mediaUrl: firstMedia,
      accountId: params.accountId,
      replyTo,
    });
    for (const extra of mediaList.slice(1)) {
      const replyTo = resolveReplyTo();
      await sendMessageDiscord(params.target, "", {
        token: params.token,
        rest: params.rest,
        mediaUrl: extra,
        accountId: params.accountId,
        replyTo,
      });
    }
  }
}
