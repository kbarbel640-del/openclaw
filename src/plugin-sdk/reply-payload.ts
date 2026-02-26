/**
 * @description Normalized outbound reply payload used by channel plugins when
 * sending a response. Channels should accept this shape from the gateway and
 * map it to their platform-specific send API.
 */
export type OutboundReplyPayload = {
  /** Optional text body of the reply. */
  text?: string;
  /** Array of media URLs to attach (preferred over the singular `mediaUrl`). */
  mediaUrls?: string[];
  /** Single media URL to attach. Use `mediaUrls` when multiple attachments are needed. */
  mediaUrl?: string;
  /** Platform-specific ID of the message this reply is threading from. */
  replyToId?: string;
};

/**
 * @description Safely coerces an untyped record into a typed
 * {@link OutboundReplyPayload}. Each field is type-checked individually;
 * unexpected types are silently dropped rather than throwing.
 *
 * @param payload - An arbitrary object received from the gateway.
 * @returns A typed `OutboundReplyPayload` with only valid fields included.
 */
export function normalizeOutboundReplyPayload(
  payload: Record<string, unknown>,
): OutboundReplyPayload {
  const text = typeof payload.text === "string" ? payload.text : undefined;
  const mediaUrls = Array.isArray(payload.mediaUrls)
    ? payload.mediaUrls.filter(
        (entry): entry is string => typeof entry === "string" && entry.length > 0,
      )
    : undefined;
  const mediaUrl = typeof payload.mediaUrl === "string" ? payload.mediaUrl : undefined;
  const replyToId = typeof payload.replyToId === "string" ? payload.replyToId : undefined;
  return {
    text,
    mediaUrls,
    mediaUrl,
    replyToId,
  };
}

/**
 * @description Wraps a typed outbound handler so it can accept an `unknown`
 * payload from the gateway, normalizing it via
 * {@link normalizeOutboundReplyPayload} before forwarding.
 *
 * @param handler - Typed async handler that expects a normalized
 *   {@link OutboundReplyPayload}.
 * @returns An async function that accepts `unknown` input, normalizes it, and
 *   delegates to `handler`.
 *
 * @example
 * ```ts
 * const deliver = createNormalizedOutboundDeliverer(async (payload) => {
 *   await sendMessage(payload.text, payload.mediaUrls);
 * });
 * // deliver can now be registered as a raw gateway outbound handler
 * ```
 */
export function createNormalizedOutboundDeliverer(
  handler: (payload: OutboundReplyPayload) => Promise<void>,
): (payload: unknown) => Promise<void> {
  return async (payload: unknown) => {
    const normalized =
      payload && typeof payload === "object"
        ? normalizeOutboundReplyPayload(payload as Record<string, unknown>)
        : {};
    await handler(normalized);
  };
}

/**
 * @description Resolves the effective list of media URLs from an outbound
 * payload, preferring the `mediaUrls` array over the singular `mediaUrl` field.
 *
 * @param payload - Partial outbound payload with optional media fields.
 * @returns An array of media URL strings (may be empty).
 */
export function resolveOutboundMediaUrls(payload: {
  mediaUrls?: string[];
  mediaUrl?: string;
}): string[] {
  if (payload.mediaUrls?.length) {
    return payload.mediaUrls;
  }
  if (payload.mediaUrl) {
    return [payload.mediaUrl];
  }
  return [];
}

/**
 * @description Combines an optional text body with a list of media URL
 * attachment lines. Attachment lines are formatted as `"Attachment: <url>"`,
 * separated from the text by a blank line. Returns an empty string when both
 * `text` and `mediaUrls` are absent.
 *
 * @param text - Optional reply text. Trimmed before use.
 * @param mediaUrls - Array of media URLs to append as attachment lines.
 * @returns The combined string, or `""` when there is nothing to show.
 */
export function formatTextWithAttachmentLinks(
  text: string | undefined,
  mediaUrls: string[],
): string {
  const trimmedText = text?.trim() ?? "";
  if (!trimmedText && mediaUrls.length === 0) {
    return "";
  }
  const mediaBlock = mediaUrls.length
    ? mediaUrls.map((url) => `Attachment: ${url}`).join("\n")
    : "";
  if (!trimmedText) {
    return mediaBlock;
  }
  if (!mediaBlock) {
    return trimmedText;
  }
  return `${trimmedText}\n\n${mediaBlock}`;
}

/**
 * @description Sends a list of media attachments sequentially, attaching the
 * caption to only the first one. Useful for platforms (such as WhatsApp or
 * Telegram) that associate captions with individual media items.
 *
 * @param params.mediaUrls - Ordered list of media URLs to send.
 * @param params.caption - Caption text attached to the first media item only.
 * @param params.send - Platform-specific send function accepting a single
 *   media URL and optional caption.
 * @param params.onError - Optional error callback invoked per failed item
 *   instead of propagating. When absent, the first error is thrown.
 * @returns `true` if at least one media item was sent, `false` when
 *   `mediaUrls` is empty (nothing was sent).
 */
export async function sendMediaWithLeadingCaption(params: {
  mediaUrls: string[];
  caption: string;
  send: (payload: { mediaUrl: string; caption?: string }) => Promise<void>;
  onError?: (error: unknown, mediaUrl: string) => void;
}): Promise<boolean> {
  if (params.mediaUrls.length === 0) {
    return false;
  }

  let first = true;
  for (const mediaUrl of params.mediaUrls) {
    const caption = first ? params.caption : undefined;
    first = false;
    try {
      await params.send({ mediaUrl, caption });
    } catch (error) {
      if (params.onError) {
        params.onError(error, mediaUrl);
        continue;
      }
      throw error;
    }
  }
  return true;
}
