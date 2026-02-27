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
  // Use explicit ASCII whitespace [ \t\r\n] instead of \s to avoid false-positives
  // with non-ASCII characters. JavaScript's \s matches all Unicode whitespace
  // (including U+3000 ideographic space and other CJK-adjacent whitespace), and
  // older versions of this regex used \W/\b which match all non-ASCII characters —
  // causing CJK messages containing the token to be silently dropped (#24773).
  // This ensures only the bare token (with optional ASCII spacing) is treated as silent.
  return new RegExp(`^[ \\t\\r\\n]*${escaped}[ \\t\\r\\n]*$`).test(text);
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
