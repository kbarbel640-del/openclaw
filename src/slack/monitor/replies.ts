import type { ChunkMode } from "../../auto-reply/chunk.js";
import { chunkMarkdownTextWithMode } from "../../auto-reply/chunk.js";
import { createReplyReferencePlanner } from "../../auto-reply/reply/reply-reference.js";
import { isSilentReplyText, SILENT_REPLY_TOKEN } from "../../auto-reply/tokens.js";
import type { ReplyPayload } from "../../auto-reply/types.js";
import type { MarkdownTableMode } from "../../config/types.base.js";
import type { RuntimeEnv } from "../../runtime.js";
import { markdownToSlackMrkdwn, markdownToSlackMrkdwnChunks } from "../format.js";
import { sendMessageSlack } from "../send.js";

const REASONING_PREFIX = "Reasoning:\n";

/**
 * Detect whether a reply payload contains reasoning/thinking content
 * produced by {@link formatReasoningMessage}.
 */
export function isReasoningReply(text: string): boolean {
  return text.startsWith(REASONING_PREFIX);
}

/**
 * Extract the reasoning body (without the "Reasoning:" prefix and italic
 * markdown wrappers added by {@link formatReasoningMessage}).
 */
export function extractReasoningBody(text: string): string {
  const body = text.slice(REASONING_PREFIX.length);
  // Strip per-line italic wrappers (_..._) added by formatReasoningMessage
  return body
    .split("\n")
    .map((line) =>
      line.length >= 3 && line.startsWith("_") && line.endsWith("_") ? line.slice(1, -1) : line,
    )
    .join("\n");
}

/**
 * Build a short summary line for collapsed reasoning display.
 * Shows a truncated preview so users know what the model considered.
 */
function buildReasoningSummary(body: string, maxLen = 80): string {
  const firstLine =
    body
      .split("\n")
      .find((l) => l.trim())
      ?.trim() ?? "";
  if (firstLine.length <= maxLen) {
    return firstLine;
  }
  return `${firstLine.slice(0, maxLen - 1)}…`;
}

export async function deliverReplies(params: {
  replies: ReplyPayload[];
  target: string;
  token: string;
  accountId?: string;
  runtime: RuntimeEnv;
  textLimit: number;
  replyThreadTs?: string;
  reasoningDisplay?: "inline" | "collapsed" | "hidden";
}) {
  for (const payload of params.replies) {
    const threadTs = payload.replyToId ?? params.replyThreadTs;
    const mediaList = payload.mediaUrls ?? (payload.mediaUrl ? [payload.mediaUrl] : []);
    const text = payload.text ?? "";
    if (!text && mediaList.length === 0) {
      continue;
    }

    if (mediaList.length === 0) {
      const trimmed = text.trim();
      if (!trimmed || isSilentReplyText(trimmed, SILENT_REPLY_TOKEN)) {
        continue;
      }

      // Render reasoning/thinking blocks as collapsed Slack attachments
      // when configured via channels.slack.reasoningDisplay = "collapsed".
      // Default is "inline" (current behavior, no change).
      const reasoningDisplay = params.reasoningDisplay ?? "inline";
      if (reasoningDisplay === "hidden" && isReasoningReply(trimmed)) {
        continue;
      }
      if (reasoningDisplay === "collapsed" && isReasoningReply(trimmed)) {
        const body = extractReasoningBody(trimmed);
        const summary = buildReasoningSummary(body);
        const mrkdwnBody = markdownToSlackMrkdwn(body);
        await sendMessageSlack(params.target, `💭 Thinking: ${summary}`, {
          token: params.token,
          threadTs,
          accountId: params.accountId,
          attachments: [
            {
              color: "#d0d0d0",
              fallback: `Reasoning: ${summary}`,
              text: mrkdwnBody,
              mrkdwn_in: ["text"],
            },
          ],
        });
        continue;
      }

      await sendMessageSlack(params.target, trimmed, {
        token: params.token,
        threadTs,
        accountId: params.accountId,
      });
    } else {
      let first = true;
      for (const mediaUrl of mediaList) {
        const caption = first ? text : "";
        first = false;
        await sendMessageSlack(params.target, caption, {
          token: params.token,
          mediaUrl,
          threadTs,
          accountId: params.accountId,
        });
      }
    }
    params.runtime.log?.(`delivered reply to ${params.target}`);
  }
}

export type SlackRespondFn = (payload: {
  text: string;
  response_type?: "ephemeral" | "in_channel";
}) => Promise<unknown>;

/**
 * Compute effective threadTs for a Slack reply based on replyToMode.
 * - "off": stay in thread if already in one, otherwise main channel
 * - "first": first reply goes to thread, subsequent replies to main channel
 * - "all": all replies go to thread
 */
export function resolveSlackThreadTs(params: {
  replyToMode: "off" | "first" | "all";
  incomingThreadTs: string | undefined;
  messageTs: string | undefined;
  hasReplied: boolean;
}): string | undefined {
  const planner = createSlackReplyReferencePlanner({
    replyToMode: params.replyToMode,
    incomingThreadTs: params.incomingThreadTs,
    messageTs: params.messageTs,
    hasReplied: params.hasReplied,
  });
  return planner.use();
}

type SlackReplyDeliveryPlan = {
  nextThreadTs: () => string | undefined;
  markSent: () => void;
};

function createSlackReplyReferencePlanner(params: {
  replyToMode: "off" | "first" | "all";
  incomingThreadTs: string | undefined;
  messageTs: string | undefined;
  hasReplied?: boolean;
}) {
  // When already inside a Slack thread, always stay in it regardless of
  // replyToMode — thread_ts is required to keep messages in the thread.
  const effectiveMode = params.incomingThreadTs ? "all" : params.replyToMode;
  return createReplyReferencePlanner({
    replyToMode: effectiveMode,
    existingId: params.incomingThreadTs,
    startId: params.messageTs,
    hasReplied: params.hasReplied,
  });
}

export function createSlackReplyDeliveryPlan(params: {
  replyToMode: "off" | "first" | "all";
  incomingThreadTs: string | undefined;
  messageTs: string | undefined;
  hasRepliedRef: { value: boolean };
}): SlackReplyDeliveryPlan {
  const replyReference = createSlackReplyReferencePlanner({
    replyToMode: params.replyToMode,
    incomingThreadTs: params.incomingThreadTs,
    messageTs: params.messageTs,
    hasReplied: params.hasRepliedRef.value,
  });
  return {
    nextThreadTs: () => replyReference.use(),
    markSent: () => {
      replyReference.markSent();
      params.hasRepliedRef.value = replyReference.hasReplied();
    },
  };
}

export async function deliverSlackSlashReplies(params: {
  replies: ReplyPayload[];
  respond: SlackRespondFn;
  ephemeral: boolean;
  textLimit: number;
  tableMode?: MarkdownTableMode;
  chunkMode?: ChunkMode;
}) {
  const messages: string[] = [];
  const chunkLimit = Math.min(params.textLimit, 4000);
  for (const payload of params.replies) {
    const textRaw = payload.text?.trim() ?? "";
    const text = textRaw && !isSilentReplyText(textRaw, SILENT_REPLY_TOKEN) ? textRaw : undefined;
    const mediaList = payload.mediaUrls ?? (payload.mediaUrl ? [payload.mediaUrl] : []);
    const combined = [text ?? "", ...mediaList.map((url) => url.trim()).filter(Boolean)]
      .filter(Boolean)
      .join("\n");
    if (!combined) {
      continue;
    }
    const chunkMode = params.chunkMode ?? "length";
    const markdownChunks =
      chunkMode === "newline"
        ? chunkMarkdownTextWithMode(combined, chunkLimit, chunkMode)
        : [combined];
    const chunks = markdownChunks.flatMap((markdown) =>
      markdownToSlackMrkdwnChunks(markdown, chunkLimit, { tableMode: params.tableMode }),
    );
    if (!chunks.length && combined) {
      chunks.push(combined);
    }
    for (const chunk of chunks) {
      messages.push(chunk);
    }
  }

  if (messages.length === 0) {
    return;
  }

  // Slack slash command responses can be multi-part by sending follow-ups via response_url.
  const responseType = params.ephemeral ? "ephemeral" : "in_channel";
  for (const text of messages) {
    await params.respond({ text, response_type: responseType });
  }
}
