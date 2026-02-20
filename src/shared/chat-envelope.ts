const ENVELOPE_PREFIX = /^\[([^\]]+)\]\s*/;
const ENVELOPE_CHANNELS = [
  "WebChat",
  "WhatsApp",
  "Telegram",
  "Signal",
  "Slack",
  "Discord",
  "Google Chat",
  "iMessage",
  "Teams",
  "Matrix",
  "Zalo",
  "Zalo Personal",
  "BlueBubbles",
];

const MESSAGE_ID_LINE = /^\s*\[message_id:\s*[^\]]+\]\s*$/i;

function looksLikeEnvelopeHeader(header: string): boolean {
  if (/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}Z\b/.test(header)) {
    return true;
  }
  if (/\d{4}-\d{2}-\d{2} \d{2}:\d{2}\b/.test(header)) {
    return true;
  }
  return ENVELOPE_CHANNELS.some((label) => header.startsWith(`${label} `));
}

export function stripEnvelope(text: string): string {
  const match = text.match(ENVELOPE_PREFIX);
  if (!match) {
    return text;
  }
  const header = match[1] ?? "";
  if (!looksLikeEnvelopeHeader(header)) {
    return text;
  }
  return text.slice(match[0].length);
}

/**
 * Strip the inbound metadata preamble injected by the gateway for agent context.
 * This block is not intended for display in chat UIs.
 *
 * Matches patterns like:
 *   Conversation info (untrusted metadata):
 *   ```json
 *   { ... }
 *   ```
 *
 * Also strips other gateway-injected blocks: Sender, Forwarded message context,
 * Thread starter, Replied message, and Chat history since last reply.
 */
const INBOUND_META_BLOCK =
  /(?:^|\n)\s*(?:Conversation info|Sender|Forwarded message context|Thread starter|Replied message|Chat history since last reply)\s*\(untrusted[^)]*\):?\s*\n```(?:json)?\n[\s\S]*?\n```/g;

export function stripInboundMeta(text: string): string {
  if (!text.includes("(untrusted")) {
    return text;
  }
  return text.replace(INBOUND_META_BLOCK, "").trim();
}

export function stripMessageIdHints(text: string): string {
  if (!text.includes("[message_id:")) {
    return text;
  }
  const lines = text.split(/\r?\n/);
  const filtered = lines.filter((line) => !MESSAGE_ID_LINE.test(line));
  return filtered.length === lines.length ? text : filtered.join("\n");
}
