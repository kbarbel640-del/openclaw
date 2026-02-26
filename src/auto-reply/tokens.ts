import { escapeRegExp } from "../utils.js";

export const HEARTBEAT_TOKEN = "HEARTBEAT_OK";
export const SILENT_REPLY_TOKEN = "NO_REPLY";

export function isSilentReplyText(
  text: string | undefined,
  token: string = SILENT_REPLY_TOKEN,
): boolean {
  if (!text) {
    return false;
  }
  const escaped = escapeRegExp(token);
  // Only treat as silent if the token appears at the start (with optional leading whitespace)
  // followed by end-of-string or ASCII non-word char (not CJK/unicode content).
  const prefix = new RegExp(`^\\s*${escaped}(?=$|[\\s\\p{P}])`, "u");
  if (prefix.test(text)) {
    return true;
  }
  // Only treat as silent if the token appears at the end, followed only by
  // whitespace or ASCII punctuation — NOT CJK or other unicode content.
  // Previous regex used \W*$ which incorrectly matched CJK characters as non-word,
  // causing false positives for messages discussing the token in non-Latin scripts.
  const suffix = new RegExp(`\\b${escaped}\\b[\\s.!?,;:…]*$`);
  return suffix.test(text);
}

export function isSilentReplyPrefixText(
  text: string | undefined,
  token: string = SILENT_REPLY_TOKEN,
): boolean {
  if (!text) {
    return false;
  }
  const normalized = text.trimStart().toUpperCase();
  if (!normalized) {
    return false;
  }
  if (!normalized.includes("_")) {
    return false;
  }
  if (/[^A-Z_]/.test(normalized)) {
    return false;
  }
  return token.toUpperCase().startsWith(normalized);
}
