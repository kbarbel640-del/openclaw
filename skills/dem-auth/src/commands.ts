import type { Operator } from "./keystore.js";
import type { Session } from "./sessions.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ParsedMessage =
  | { type: "auth" }
  | { type: "auth_response"; payload: string }
  | { type: "signed"; signature: string; message: string }
  | { type: "auth_status" }
  | { type: "auth_revoke" }
  | { type: "regular"; message: string };

// ---------------------------------------------------------------------------
// Parsing
// ---------------------------------------------------------------------------

/**
 * Parse an incoming message into a structured command.
 *
 * Recognised formats:
 *   - `AUTH`                            -> auth
 *   - `AUTH_RESPONSE: <sig>`            -> auth_response
 *   - `SIGNED:<sig>:<message>`          -> signed
 *   - `AUTH STATUS`                     -> auth_status
 *   - `AUTH REVOKE`                     -> auth_revoke
 *   - anything else                     -> regular
 */
export function parseMessage(text: string): ParsedMessage {
  const trimmed = text.trim();

  // Exact matches (case-insensitive)
  if (/^AUTH$/i.test(trimmed)) {
    return { type: "auth" };
  }

  if (/^AUTH\s+STATUS$/i.test(trimmed)) {
    return { type: "auth_status" };
  }

  if (/^AUTH\s+REVOKE$/i.test(trimmed)) {
    return { type: "auth_revoke" };
  }

  // AUTH_RESPONSE: <base64_signature>
  const authResponseMatch = trimmed.match(
    /^AUTH_RESPONSE:\s*(.+)$/i,
  );
  if (authResponseMatch) {
    const payload = authResponseMatch[1]!.trim();
    if (payload.length === 0) {
      return { type: "regular", message: trimmed };
    }
    return { type: "auth_response", payload };
  }

  // SIGNED:<base64_sig>:<message>
  // The signature is everything between the first and second colon.
  // The message is everything after the second colon.
  const signedMatch = trimmed.match(
    /^SIGNED:([^:]+):(.+)$/is,
  );
  if (signedMatch) {
    const signature = signedMatch[1]!.trim();
    const message = signedMatch[2]!;
    if (signature.length === 0 || message.length === 0) {
      return { type: "regular", message: trimmed };
    }
    return { type: "signed", signature, message };
  }

  return { type: "regular", message: trimmed };
}

// ---------------------------------------------------------------------------
// Response formatters
// ---------------------------------------------------------------------------

/**
 * Format the challenge response sent to an operator during the AUTH flow.
 */
export function formatChallenge(nonce: string): string {
  return [
    `CHALLENGE: ${nonce}`,
    "",
    "Sign this nonce with your registered key to authenticate:",
    "",
    `  dem-auth sign ${nonce}`,
    "",
    "Then reply with:",
    "",
    "  AUTH_RESPONSE: <base64_signature>",
    "",
    "This challenge expires in 5 minutes.",
  ].join("\n");
}

/**
 * Format the success message after a verified AUTH_RESPONSE.
 */
export function formatAuthSuccess(
  operator: Operator,
  session: Session,
): string {
  const expiresIn = Math.round(
    (session.expiresAt - session.createdAt) / 60_000,
  );
  return [
    `Authenticated as ${operator.name} (${operator.role}).`,
    `Session valid for ${expiresIn} minutes.`,
  ].join("\n");
}

/**
 * Format an authentication failure message.
 */
export function formatAuthFailure(reason: string): string {
  return `Authentication failed: ${reason}`;
}
