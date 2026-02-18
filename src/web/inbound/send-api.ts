import type { AnyMessageContent, WAPresence } from "@whiskeysockets/baileys";
import { recordChannelActivity } from "../../infra/channel-activity.js";
import { toWhatsappJid } from "../../utils.js";
import type { ActiveWebSendOptions } from "../active-listener.js";

type MentionLidLookup = {
  getLIDForPN?: (pn: string) => Promise<string | null>;
  getPNForLID?: (lid: string) => Promise<string | null>;
};

export type ParticipantMentionInfo = {
  jid: string;
  name?: string;
  notify?: string;
  phoneNumber?: string;
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
  void digits;
  return "s.whatsapp.net";
}

function normalizeTextForMatch(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[\u200b-\u200d\ufeff]/g, "")
    .trim();
}

function extractDigits(text: string): string {
  return text.replace(/\D/g, "");
}

function isWordChar(ch: string | undefined): boolean {
  return Boolean(ch && /[a-z0-9_]/i.test(ch));
}

function includesName(text: string, name: string): boolean {
  const hay = text.toLowerCase();
  const needle = name.trim().toLowerCase();
  if (!needle) {
    return false;
  }
  let idx = hay.indexOf(needle);
  while (idx >= 0) {
    const prev = idx > 0 ? hay[idx - 1] : undefined;
    const next = idx + needle.length < hay.length ? hay[idx + needle.length] : undefined;
    if (!isWordChar(prev) && !isWordChar(next)) {
      return true;
    }
    idx = hay.indexOf(needle, idx + 1);
  }
  return false;
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

    const digits = extractDigits(rawNumber);
    if (!digits) {
      continue;
    }

    const domain = inferMentionDomain(digits, rawDomain);
    mentions.add(`${digits}@${domain}`);
  }

  return [...mentions];
}

export function extractNameMentions(text: string): string[] {
  if (!text) {
    return [];
  }
  const namePattern = /@([A-Za-z][A-Za-z0-9_\s]{1,30}?)(?=[\s)\]}"'`>.,!?;:]|$)/g;
  const names = new Set<string>();
  for (const match of text.matchAll(namePattern)) {
    const name = match[1]?.trim();
    if (name && name.length >= 2) {
      names.add(name);
    }
  }
  return [...names];
}

function normalizeMentionJid(jid: string): string {
  return jid.replace(/:\d+(?=@)/, "").replace(/@hosted\.lid$/, "@lid");
}

function mentionUserPart(jid: string): string {
  return jid.split("@")[0] ?? "";
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function buildMentionAliasPattern(alias: string): RegExp {
  const tokens = alias
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((token) => escapeRegExp(token));
  const aliasPattern = tokens.join("\\s+");
  return new RegExp(`@${aliasPattern}(?=[\\s)\\]}"'\`>.,!?;:]|$)`, "i");
}

function toPreferredParticipantMentionJid(participant: ParticipantMentionInfo): string | null {
  const phoneDigits = extractDigits(participant.phoneNumber ?? "");
  if (phoneDigits.length >= 6) {
    return `${phoneDigits}@s.whatsapp.net`;
  }
  const normalized = normalizeMentionJid(participant.jid);
  if (normalized.endsWith("@s.whatsapp.net") || normalized.endsWith("@lid")) {
    return normalized;
  }
  return null;
}

function findParticipantByName(
  name: string,
  participants: ParticipantMentionInfo[],
): ParticipantMentionInfo | undefined {
  const normalizedSearch = normalizeTextForMatch(name);
  for (const p of participants) {
    if (p.name && normalizeTextForMatch(p.name) === normalizedSearch) {
      return p;
    }
    if (p.notify && normalizeTextForMatch(p.notify) === normalizedSearch) {
      return p;
    }
    const nameParts = (p.name ?? p.notify ?? "").split(/\s+/);
    for (const part of nameParts) {
      if (normalizeTextForMatch(part) === normalizedSearch) {
        return p;
      }
    }
  }
  for (const p of participants) {
    const pName = normalizeTextForMatch(p.name ?? p.notify ?? "");
    if (pName.startsWith(normalizedSearch) || normalizedSearch.startsWith(pName)) {
      if (pName.length >= 3 && normalizedSearch.length >= 3) {
        return p;
      }
    }
  }
  return undefined;
}

function resolveNameToJid(name: string, participants: ParticipantMentionInfo[]): string | null {
  const participant = findParticipantByName(name, participants);
  if (participant) {
    return toPreferredParticipantMentionJid(participant);
  }
  const digits = extractDigits(name);
  if (digits.length >= 6) {
    const domain = inferMentionDomain(digits);
    return `${digits}@${domain}`;
  }
  return null;
}

function collectNameAliases(value: string | undefined): string[] {
  const trimmed = (value ?? "").trim();
  if (!trimmed) {
    return [];
  }
  const aliases = new Set<string>([trimmed]);
  for (const part of trimmed.split(/\s+/)) {
    if (part.length >= 3) {
      aliases.add(part);
    }
  }
  return [...aliases];
}

function buildSelfMentionAliasCandidates(params: {
  selfMentionJid?: string;
  participants?: ParticipantMentionInfo[];
  configuredAliases?: string[];
}): string[] {
  const aliases = new Set<string>();
  for (const alias of params.configuredAliases ?? []) {
    const trimmed = alias.trim();
    if (trimmed) {
      aliases.add(trimmed);
    }
  }
  aliases.add("bot");
  aliases.add("self");
  aliases.add("yourself");

  const selfJid = params.selfMentionJid ? normalizeMentionJid(params.selfMentionJid) : "";
  const selfUser = selfJid ? mentionUserPart(selfJid) : "";
  if (!selfUser || !params.participants?.length) {
    return [...aliases];
  }

  for (const participant of params.participants) {
    const candidateUsers = new Set<string>();
    const participantJid = normalizeMentionJid(participant.jid);
    candidateUsers.add(mentionUserPart(participantJid));
    const preferredJid = toPreferredParticipantMentionJid(participant);
    if (preferredJid) {
      candidateUsers.add(mentionUserPart(preferredJid));
    }
    const phoneDigits = extractDigits(participant.phoneNumber ?? "");
    if (phoneDigits.length >= 6) {
      candidateUsers.add(phoneDigits);
    }
    if (!candidateUsers.has(selfUser)) {
      continue;
    }

    for (const name of [participant.name, participant.notify]) {
      const trimmed = (name ?? "").trim();
      if (!trimmed) {
        continue;
      }
      aliases.add(trimmed);
      for (const part of trimmed.split(/\s+/)) {
        if (part.length >= 3) {
          aliases.add(part);
        }
      }
    }
  }

  return [...aliases];
}

function buildResolvedAliasMap(params: {
  resolvedUsers: string[];
  participants?: ParticipantMentionInfo[];
  selfMentionJid?: string;
  selfMentionAliases?: string[];
  mentionAliasHintsByUser?: Map<string, string[]>;
}): Map<string, string[]> {
  const userSet = new Set(params.resolvedUsers);
  const aliasMap = new Map<string, Set<string>>();
  const addAlias = (user: string, alias: string) => {
    if (!userSet.has(user)) {
      return;
    }
    const trimmed = alias.trim();
    if (!trimmed) {
      return;
    }
    const bucket = aliasMap.get(user) ?? new Set<string>();
    bucket.add(trimmed);
    aliasMap.set(user, bucket);
  };

  for (const participant of params.participants ?? []) {
    const preferredJid = toPreferredParticipantMentionJid(participant);
    if (!preferredJid) {
      continue;
    }
    const user = mentionUserPart(preferredJid);
    for (const alias of collectNameAliases(participant.name)) {
      addAlias(user, alias);
    }
    for (const alias of collectNameAliases(participant.notify)) {
      addAlias(user, alias);
    }
  }

  const selfMentionUser = params.selfMentionJid
    ? mentionUserPart(normalizeMentionJid(params.selfMentionJid))
    : "";
  if (selfMentionUser) {
    for (const alias of params.selfMentionAliases ?? []) {
      addAlias(selfMentionUser, alias);
    }
  }
  for (const [user, aliases] of params.mentionAliasHintsByUser ?? []) {
    for (const alias of aliases) {
      addAlias(user, alias);
    }
  }

  const result = new Map<string, string[]>();
  for (const [user, aliases] of aliasMap.entries()) {
    result.set(
      user,
      [...aliases].toSorted((left, right) => right.length - left.length),
    );
  }
  return result;
}

export function injectMentionTokens(
  text: string,
  mentionJids: string[],
  participants?: ParticipantMentionInfo[],
  options?: {
    selfMentionJid?: string;
    selfMentionAliases?: string[];
    mentionAliasHintsByUser?: Map<string, string[]>;
  },
): string {
  if (!mentionJids.length) {
    return text;
  }
  let outgoingText = text;
  const resolvedUsers = Array.from(
    new Set(
      mentionJids
        .map((jid) => mentionUserPart(jid))
        .filter((user): user is string => Boolean(user)),
    ),
  );

  for (const user of resolvedUsers) {
    const escapedUser = escapeRegExp(user);
    const plusTokenPattern = new RegExp(
      `@\\+${escapedUser}(?=[\\s)\\]}"'\`>.,!?;:]|$|@(s\\.whatsapp\\.net|lid|hosted\\.lid|hosted))`,
      "gi",
    );
    outgoingText = outgoingText.replace(plusTokenPattern, `@${user}`);
  }

  const missingUsers: string[] = [];
  const selfMentionUser = options?.selfMentionJid
    ? mentionUserPart(normalizeMentionJid(options.selfMentionJid))
    : "";
  const selfMentionAliases = buildSelfMentionAliasCandidates({
    selfMentionJid: options?.selfMentionJid,
    participants,
    configuredAliases: options?.selfMentionAliases,
  })
    .map((alias) => alias.trim())
    .filter((alias) => alias.length > 0);
  const resolvedAliasMap = buildResolvedAliasMap({
    resolvedUsers,
    participants,
    selfMentionJid: options?.selfMentionJid,
    selfMentionAliases,
    mentionAliasHintsByUser: options?.mentionAliasHintsByUser,
  });
  for (const user of resolvedUsers) {
    const escapedUser = escapeRegExp(user);
    const canonicalTokenPattern = new RegExp(
      `@${escapedUser}(?=[\\s)\\]}"'\`>.,!?;:]|$|@(s\\.whatsapp\\.net|lid|hosted\\.lid|hosted))`,
      "i",
    );
    if (canonicalTokenPattern.test(outgoingText)) {
      continue;
    }

    for (const alias of resolvedAliasMap.get(user) ?? []) {
      const aliasPattern = buildMentionAliasPattern(alias);
      if (!aliasPattern.test(outgoingText)) {
        continue;
      }
      outgoingText = outgoingText.replace(aliasPattern, `@${user}`);
      break;
    }

    if (canonicalTokenPattern.test(outgoingText)) {
      continue;
    }

    if (selfMentionUser && user === selfMentionUser && selfMentionAliases.length > 0) {
      const hasSelfAliasMention = selfMentionAliases.some((alias) => {
        const aliasPattern = buildMentionAliasPattern(alias);
        return aliasPattern.test(outgoingText);
      });
      if (hasSelfAliasMention) {
        continue;
      }
    }

    missingUsers.push(user);
  }
  if (!missingUsers.length) {
    return outgoingText;
  }
  const suffix = missingUsers.map((user) => `@${user}`).join(" ");
  if (!outgoingText.trim()) {
    return suffix;
  }
  return `${outgoingText}\n${suffix}`;
}

export async function resolveMentionJids(
  text: string,
  options?: {
    lidLookup?: MentionLidLookup;
    participants?: ParticipantMentionInfo[];
    selfMentionJid?: string;
    selfMentionAliases?: string[];
  },
): Promise<string[]> {
  const preferredParticipantJidByUser = new Map<string, string>();
  if (options?.participants) {
    for (const participant of options.participants) {
      const preferredJid = toPreferredParticipantMentionJid(participant);
      if (!preferredJid) {
        continue;
      }
      const participantUser = mentionUserPart(participant.jid);
      const phoneDigits = extractDigits(participant.phoneNumber ?? "");
      if (participantUser) {
        preferredParticipantJidByUser.set(participantUser, preferredJid);
      }
      if (phoneDigits.length >= 6) {
        preferredParticipantJidByUser.set(phoneDigits, preferredJid);
      }
    }
  }

  const resolved = new Set<string>();
  const selfMentionJid = options?.selfMentionJid
    ? normalizeMentionJid(options.selfMentionJid)
    : null;
  const selfMentionAliases = buildSelfMentionAliasCandidates({
    selfMentionJid: options?.selfMentionJid,
    participants: options?.participants,
    configuredAliases: options?.selfMentionAliases,
  })
    .map((alias) => normalizeTextForMatch(alias))
    .filter(Boolean);

  const numericJids = extractMentionJids(text);
  for (const jid of numericJids) {
    let nextJid = normalizeMentionJid(jid);
    const participantPreferredJid = preferredParticipantJidByUser.get(mentionUserPart(nextJid));
    if (participantPreferredJid) {
      nextJid = participantPreferredJid;
    }

    if (!participantPreferredJid && nextJid.endsWith("@lid") && options?.lidLookup?.getPNForLID) {
      try {
        const pnJid = await options.lidLookup.getPNForLID(nextJid);
        if (pnJid) {
          const normalizedPnJid = normalizeMentionJid(pnJid);
          const mappedParticipantJid = preferredParticipantJidByUser.get(
            mentionUserPart(normalizedPnJid),
          );
          nextJid = mappedParticipantJid ?? normalizedPnJid;
        }
      } catch {
        // Best-effort lookup only.
      }
    }

    // Bare @<digits> tokens may actually be LIDs (without @lid suffix).
    // Try a fallback LID lookup for long IDs when no participant mapping matched.
    if (
      !participantPreferredJid &&
      !nextJid.endsWith("@lid") &&
      options?.lidLookup?.getPNForLID &&
      mentionUserPart(nextJid).length >= 15
    ) {
      const candidateLid = `${mentionUserPart(nextJid)}@lid`;
      try {
        const pnJid = await options.lidLookup.getPNForLID(candidateLid);
        if (pnJid) {
          const normalizedPnJid = normalizeMentionJid(pnJid);
          const mappedParticipantJid = preferredParticipantJidByUser.get(
            mentionUserPart(normalizedPnJid),
          );
          nextJid = mappedParticipantJid ?? normalizedPnJid;
        }
      } catch {
        // Best-effort lookup only.
      }
    }

    if (nextJid.endsWith("@lid") && options?.lidLookup?.getPNForLID) {
      try {
        const pnJid = await options.lidLookup.getPNForLID(nextJid);
        if (pnJid) {
          const normalizedPnJid = normalizeMentionJid(pnJid);
          const mappedParticipantJid = preferredParticipantJidByUser.get(
            mentionUserPart(normalizedPnJid),
          );
          nextJid = mappedParticipantJid ?? normalizedPnJid;
        }
      } catch {
        // Best-effort lookup only.
      }
    }

    resolved.add(nextJid);
  }

  const nameMentions = extractNameMentions(text);
  if (selfMentionJid && selfMentionAliases.length > 0 && nameMentions.length > 0) {
    const hasSelfAliasMention = nameMentions.some((token) => {
      const normalizedToken = normalizeTextForMatch(token);
      return selfMentionAliases.some(
        (alias) =>
          normalizedToken === alias ||
          normalizedToken.includes(alias) ||
          alias.includes(normalizedToken),
      );
    });
    if (hasSelfAliasMention) {
      resolved.add(selfMentionJid);
    }
  }

  if (options?.participants && options.participants.length > 0) {
    for (const name of nameMentions) {
      const jid = resolveNameToJid(name, options.participants);
      if (jid) {
        resolved.add(normalizeMentionJid(jid));
      }
    }

    for (const participant of options.participants) {
      const candidateNames = [participant.name, participant.notify].filter(
        (value): value is string => Boolean(value && value.trim().length >= 3),
      );
      for (const candidateName of candidateNames) {
        if (includesName(text, candidateName)) {
          const preferredJid = toPreferredParticipantMentionJid(participant);
          if (preferredJid) {
            resolved.add(preferredJid);
          }
          break;
        }
      }
    }
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
  getParticipants?: (jid: string) => ParticipantMentionInfo[] | Promise<ParticipantMentionInfo[]>;
  selfMentionJid?: string;
  selfMentionAliases?: string[];
}) {
  const resolveMentions = async (jid: string, text: string) => {
    const participantSource = params.getParticipants ? params.getParticipants(jid) : [];
    const participants = (await Promise.resolve(participantSource)) ?? [];
    const mentionJids = await resolveMentionJids(text, {
      lidLookup: params.lidLookup,
      participants,
      selfMentionJid: params.selfMentionJid,
      selfMentionAliases: params.selfMentionAliases,
    });
    return { mentionJids, participants };
  };

  return {
    sendMessage: async (
      to: string,
      text: string,
      mediaBuffer?: Buffer,
      mediaType?: string,
      sendOptions?: ActiveWebSendOptions,
    ): Promise<{ messageId: string }> => {
      const jid = toWhatsappJid(to);
      const { mentionJids, participants } = await resolveMentions(jid, text);
      const outgoingText = injectMentionTokens(text, mentionJids, participants, {
        selfMentionJid: params.selfMentionJid,
        selfMentionAliases: params.selfMentionAliases,
      });
      const mentionPayload = mentionJids.length > 0 ? { mentions: mentionJids } : undefined;

      let payload: AnyMessageContent;
      if (mediaBuffer && mediaType) {
        if (mediaType.startsWith("image/")) {
          payload = {
            image: mediaBuffer,
            caption: outgoingText || undefined,
            mimetype: mediaType,
            ...mentionPayload,
          };
        } else if (mediaType.startsWith("audio/")) {
          payload = { audio: mediaBuffer, ptt: true, mimetype: mediaType };
        } else if (mediaType.startsWith("video/")) {
          const gifPlayback = sendOptions?.gifPlayback;
          payload = {
            video: mediaBuffer,
            caption: outgoingText || undefined,
            mimetype: mediaType,
            ...(gifPlayback ? { gifPlayback: true } : {}),
            ...mentionPayload,
          };
        } else {
          const fileName = sendOptions?.fileName?.trim() || "file";
          payload = {
            document: mediaBuffer,
            fileName,
            caption: outgoingText || undefined,
            mimetype: mediaType,
            ...mentionPayload,
          };
        }
      } else {
        payload = { text: outgoingText, ...mentionPayload };
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
