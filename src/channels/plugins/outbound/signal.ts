import type { ChannelOutboundAdapter } from "../types.js";
import { chunkText } from "../../../auto-reply/chunk.js";
import { sendMessageSignal } from "../../../signal/send.js";
import { resolveChannelMediaMaxBytes } from "../media-limits.js";

function resolveSignalMaxBytes(params: {
  cfg: Parameters<typeof resolveChannelMediaMaxBytes>[0]["cfg"];
  accountId?: string | null;
}) {
  return resolveChannelMediaMaxBytes({
    cfg: params.cfg,
    resolveChannelLimitMb: ({ cfg, accountId }) =>
      cfg.channels?.signal?.accounts?.[accountId]?.mediaMaxMb ?? cfg.channels?.signal?.mediaMaxMb,
    accountId: params.accountId,
  });
}

function parseQuoteTimestamp(replyToId?: string | null): number | undefined {
  if (!replyToId) {
    return undefined;
  }
  const ts = Number.parseInt(replyToId, 10);
  return Number.isFinite(ts) && ts > 0 ? ts : undefined;
}

export const signalOutbound: ChannelOutboundAdapter = {
  deliveryMode: "direct",
  chunker: chunkText,
  chunkerMode: "text",
  textChunkLimit: 4000,
  sendText: async ({ cfg, to, text, accountId, replyToId, replyToAuthor, deps }) => {
    const send = deps?.sendSignal ?? sendMessageSignal;
    const maxBytes = resolveSignalMaxBytes({ cfg, accountId });
    const result = await send(to, text, {
      maxBytes,
      accountId: accountId ?? undefined,
      quoteTimestamp: parseQuoteTimestamp(replyToId),
      quoteAuthor: replyToAuthor?.trim() || undefined,
    });
    return { channel: "signal", ...result };
  },
  sendMedia: async ({
    cfg,
    to,
    text,
    mediaUrl,
    mediaLocalRoots,
    accountId,
    replyToId,
    replyToAuthor,
    deps,
  }) => {
    const send = deps?.sendSignal ?? sendMessageSignal;
    const maxBytes = resolveSignalMaxBytes({ cfg, accountId });
    const result = await send(to, text, {
      mediaUrl,
      maxBytes,
      accountId: accountId ?? undefined,
      mediaLocalRoots,
      quoteTimestamp: parseQuoteTimestamp(replyToId),
      quoteAuthor: replyToAuthor?.trim() || undefined,
    });
    return { channel: "signal", ...result };
  },
};
