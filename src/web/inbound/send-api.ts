import type { AnyMessageContent, WAPresence } from "@whiskeysockets/baileys";
import { recordChannelActivity } from "../../infra/channel-activity.js";
import { toWhatsappJid } from "../../utils.js";
import type { ActiveWebSendOptions } from "../active-listener.js";

type MentionLidLookup = {
  getLIDForPN?: (pn: string) => Promise<string | null>;
};

const MENTION_TOKEN_REGEX = /@(\+?\d{6,20})(?:@(s\.whatsapp\.net|lid|hosted\.lid|hosted))?/gi;
const MENTION_LEFT_BOUNDARY = /[\s([{"'`<]/;
const MENTION_RIGHT_BOUNDARY = /[\s)\]}"'`>.,!?;:]/;

function hasMentionBoundary(text: string, start: number, end: number): boolean {
  const prev = start > 0 ? text[start - 1] : undefined;
  const next = end < text.length ? text[end] : undefined;
  const leftOk = prev === undefined || MENTION_LEFT_BOUNDARY.test(prev);
  const rightOk = next === undefined || MENTION_RIGHT_BOUNDARY.test(next);
  return leftOk && rightOk;
}

function normalizeMentionDomain(domain: string | undefined): "s.whatsapp.net" | "lid" {
  const normalized = (domain ?? "").toLowerCase();
  if (normalized === "lid" || normalized === "hosted.lid") {
    return "lid";
  }
  return "s.whatsapp.net";
}

function inferMentionDomain(digits: string, explicitDomain?: string): "s.whatsapp.net" | "lid" {
  if (explicitDomain) {
    return normalizeMentionDomain(explicitDomain);
  }
  // WhatsApp LID identifiers are long numeric handles (often 15+ digits).
  // Phone numbers in mentions are usually shorter and map to @s.whatsapp.net.
  return digits.length >= 15 ? "lid" : "s.whatsapp.net";
}

export function extractMentionJids(text: string): string[] {
  if (!text) {
    return [];
  }

  const mentions = new Set<string>();
  MENTION_TOKEN_REGEX.lastIndex = 0;
  for (const match of text.matchAll(MENTION_TOKEN_REGEX)) {
    const token = match[0];
    const rawNumber = match[1] ?? "";
    const rawDomain = match[2];
    const start = match.index ?? -1;
    if (start < 0) {
      continue;
    }
    const end = start + token.length;
    if (!hasMentionBoundary(text, start, end)) {
      continue;
    }

    const digits = rawNumber.replace(/\D/g, "");
    if (!digits) {
      continue;
    }

    const domain = inferMentionDomain(digits, rawDomain);
    mentions.add(`${digits}@${domain}`);
  }

  return [...mentions];
}

function normalizeMentionJid(jid: string): string {
  return jid.replace(/:\d+(?=@)/, "").replace(/@hosted\.lid$/, "@lid");
}

export async function resolveMentionJids(
  text: string,
  options?: { lidLookup?: MentionLidLookup },
): Promise<string[]> {
  const extracted = extractMentionJids(text);
  if (extracted.length === 0) {
    return [];
  }

  const resolved = new Set<string>();
  for (const jid of extracted) {
    let nextJid = normalizeMentionJid(jid);

    if (nextJid.endsWith("@s.whatsapp.net") && options?.lidLookup?.getLIDForPN) {
      try {
        const lidJid = await options.lidLookup.getLIDForPN(nextJid);
        if (lidJid) {
          nextJid = normalizeMentionJid(lidJid);
        }
      } catch {
        // Best-effort lookup only.
      }
    }

    resolved.add(nextJid);
  }

  return [...resolved];
}

function recordWhatsAppOutbound(accountId: string) {
  recordChannelActivity({
    channel: "whatsapp",
    accountId,
    direction: "outbound",
  });
}

function resolveOutboundMessageId(result: unknown): string {
  return typeof result === "object" && result && "key" in result
    ? String((result as { key?: { id?: string } }).key?.id ?? "unknown")
    : "unknown";
}

export function createWebSendApi(params: {
  sock: {
    sendMessage: (jid: string, content: AnyMessageContent) => Promise<unknown>;
    sendPresenceUpdate: (presence: WAPresence, jid?: string) => Promise<unknown>;
  };
  defaultAccountId: string;
  lidLookup?: MentionLidLookup;
}) {
  return {
    sendMessage: async (
      to: string,
      text: string,
      mediaBuffer?: Buffer,
      mediaType?: string,
      sendOptions?: ActiveWebSendOptions,
    ): Promise<{ messageId: string }> => {
      const jid = toWhatsappJid(to);
      const mentionJids = await resolveMentionJids(text, { lidLookup: params.lidLookup });
      const mentionPayload = mentionJids.length > 0 ? { mentions: mentionJids } : undefined;

      let payload: AnyMessageContent;
      if (mediaBuffer && mediaType) {
        if (mediaType.startsWith("image/")) {
          payload = {
            image: mediaBuffer,
            caption: text || undefined,
            mimetype: mediaType,
            ...mentionPayload,
          };
        } else if (mediaType.startsWith("audio/")) {
          payload = { audio: mediaBuffer, ptt: true, mimetype: mediaType };
        } else if (mediaType.startsWith("video/")) {
          const gifPlayback = sendOptions?.gifPlayback;
          payload = {
            video: mediaBuffer,
            caption: text || undefined,
            mimetype: mediaType,
            ...(gifPlayback ? { gifPlayback: true } : {}),
            ...mentionPayload,
          };
        } else {
          const fileName = sendOptions?.fileName?.trim() || "file";
          payload = {
            document: mediaBuffer,
            fileName,
            caption: text || undefined,
            mimetype: mediaType,
            ...mentionPayload,
          };
        }
      } else {
        payload = { text, ...mentionPayload };
      }
      const result = await params.sock.sendMessage(jid, payload);
      const accountId = sendOptions?.accountId ?? params.defaultAccountId;
      recordWhatsAppOutbound(accountId);
      const messageId = resolveOutboundMessageId(result);
      return { messageId };
    },
    sendPoll: async (
      to: string,
      poll: { question: string; options: string[]; maxSelections?: number },
    ): Promise<{ messageId: string }> => {
      const jid = toWhatsappJid(to);
      const result = await params.sock.sendMessage(jid, {
        poll: {
          name: poll.question,
          values: poll.options,
          selectableCount: poll.maxSelections ?? 1,
        },
      } as AnyMessageContent);
      recordWhatsAppOutbound(params.defaultAccountId);
      const messageId = resolveOutboundMessageId(result);
      return { messageId };
    },
    sendReaction: async (
      chatJid: string,
      messageId: string,
      emoji: string,
      fromMe: boolean,
      participant?: string,
    ): Promise<void> => {
      const jid = toWhatsappJid(chatJid);
      await params.sock.sendMessage(jid, {
        react: {
          text: emoji,
          key: {
            remoteJid: jid,
            id: messageId,
            fromMe,
            participant: participant ? toWhatsappJid(participant) : undefined,
          },
        },
      } as AnyMessageContent);
    },
    sendComposingTo: async (to: string): Promise<void> => {
      const jid = toWhatsappJid(to);
      await params.sock.sendPresenceUpdate("composing", jid);
    },
  } as const;
}
