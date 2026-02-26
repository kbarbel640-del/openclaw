/**
 * @description Normalizes an allowlist by converting every entry to a trimmed,
 * lowercase string and optionally stripping a leading prefix pattern. Empty
 * entries are removed from the result.
 *
 * @param params.allowFrom - Raw allowlist entries (strings or numbers).
 * @param params.stripPrefixRe - Optional regex applied to each entry before
 *   lowercasing to remove a leading prefix (e.g. `"discord:"` or `"user:"`).
 * @returns An array of normalized, lowercase allowlist strings.
 *
 * @example
 * ```ts
 * formatAllowFromLowercase({ allowFrom: ["User:Alice", "user:BOB"], stripPrefixRe: /^user:/i });
 * // ["alice", "bob"]
 * ```
 */
export function formatAllowFromLowercase(params: {
  allowFrom: Array<string | number>;
  stripPrefixRe?: RegExp;
}): string[] {
  return params.allowFrom
    .map((entry) => String(entry).trim())
    .filter(Boolean)
    .map((entry) => (params.stripPrefixRe ? entry.replace(params.stripPrefixRe, "") : entry))
    .map((entry) => entry.toLowerCase());
}

/**
 * @description Checks whether a sender ID is present in an allowlist. The
 * allowlist is normalized via {@link formatAllowFromLowercase} before
 * comparison. A wildcard entry (`"*"`) grants access to all senders.
 *
 * @param params.senderId - The sender identifier to check.
 * @param params.allowFrom - The configured allowlist entries.
 * @param params.stripPrefixRe - Optional regex to strip prefixes from
 *   allowlist entries before comparison.
 * @returns `true` if the sender is allowed, `false` otherwise (including when
 *   the allowlist is empty).
 *
 * @example
 * ```ts
 * isNormalizedSenderAllowed({ senderId: "alice", allowFrom: ["alice", "bob"] }); // true
 * isNormalizedSenderAllowed({ senderId: "eve",   allowFrom: ["*"] });            // true
 * isNormalizedSenderAllowed({ senderId: "eve",   allowFrom: [] });               // false
 * ```
 */
export function isNormalizedSenderAllowed(params: {
  senderId: string | number;
  allowFrom: Array<string | number>;
  stripPrefixRe?: RegExp;
}): boolean {
  const normalizedAllow = formatAllowFromLowercase({
    allowFrom: params.allowFrom,
    stripPrefixRe: params.stripPrefixRe,
  });
  if (normalizedAllow.length === 0) {
    return false;
  }
  if (normalizedAllow.includes("*")) {
    return true;
  }
  const sender = String(params.senderId).trim().toLowerCase();
  return normalizedAllow.includes(sender);
}

type ParsedChatAllowTarget =
  | { kind: "chat_id"; chatId: number }
  | { kind: "chat_guid"; chatGuid: string }
  | { kind: "chat_identifier"; chatIdentifier: string }
  | { kind: "handle"; handle: string };

/**
 * @description Checks whether a chat sender is allowed based on a structured
 * allowlist where each entry can be a chat ID, GUID, platform identifier, or
 * handle. Used by iMessage-style channels that distinguish between multiple
 * identity types. A `"*"` entry grants access unconditionally.
 *
 * @param params.allowFrom - Raw allowlist entries to match against.
 * @param params.sender - The sender's raw identifier string.
 * @param params.chatId - Optional numeric chat ID for the conversation.
 * @param params.chatGuid - Optional globally unique chat GUID.
 * @param params.chatIdentifier - Optional platform-level chat identifier.
 * @param params.normalizeSender - Function that normalizes the sender string
 *   for handle-based comparison.
 * @param params.parseAllowTarget - Function that parses a raw allowlist entry
 *   into a typed {@link ParsedChatAllowTarget} discriminated union.
 * @returns `true` if any allowlist entry matches one of the provided
 *   identifiers, `false` otherwise.
 */
export function isAllowedParsedChatSender<TParsed extends ParsedChatAllowTarget>(params: {
  allowFrom: Array<string | number>;
  sender: string;
  chatId?: number | null;
  chatGuid?: string | null;
  chatIdentifier?: string | null;
  normalizeSender: (sender: string) => string;
  parseAllowTarget: (entry: string) => TParsed;
}): boolean {
  const allowFrom = params.allowFrom.map((entry) => String(entry).trim());
  if (allowFrom.length === 0) {
    return false;
  }
  if (allowFrom.includes("*")) {
    return true;
  }

  const senderNormalized = params.normalizeSender(params.sender);
  const chatId = params.chatId ?? undefined;
  const chatGuid = params.chatGuid?.trim();
  const chatIdentifier = params.chatIdentifier?.trim();

  for (const entry of allowFrom) {
    if (!entry) {
      continue;
    }
    const parsed = params.parseAllowTarget(entry);
    if (parsed.kind === "chat_id" && chatId !== undefined) {
      if (parsed.chatId === chatId) {
        return true;
      }
    } else if (parsed.kind === "chat_guid" && chatGuid) {
      if (parsed.chatGuid === chatGuid) {
        return true;
      }
    } else if (parsed.kind === "chat_identifier" && chatIdentifier) {
      if (parsed.chatIdentifier === chatIdentifier) {
        return true;
      }
    } else if (parsed.kind === "handle" && senderNormalized) {
      if (parsed.handle === senderNormalized) {
        return true;
      }
    }
  }
  return false;
}
