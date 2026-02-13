import type { ReplyPayload } from "openclaw/plugin-sdk";
import crypto from "node:crypto";
import type { ResolvedSaintEmailAccount, SaintEmailChannelData } from "./types.js";
import { gmailSendMessage } from "./gmail-api.js";

/** Strip CR/LF to prevent MIME header injection. */
function sanitizeHeaderValue(value: string): string {
  return value.replace(/[\r\n]/g, "");
}

/** Sanitize MIME type to prevent header injection via Content-Type. */
function sanitizeMimeType(value: string): string {
  const cleaned = sanitizeHeaderValue(value);
  return /^[a-zA-Z0-9][a-zA-Z0-9!#$&\-^_.+]*\/[a-zA-Z0-9][a-zA-Z0-9!#$&\-^_.+]*/.test(cleaned)
    ? cleaned
    : "application/octet-stream";
}

/** Sanitize attachment filename for use in Content-Disposition. */
function sanitizeFilename(value: string): string {
  return sanitizeHeaderValue(value).replace(/"/g, "'");
}

function toBase64UrlUtf8(value: string): string {
  return Buffer.from(value, "utf-8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function normalizeList(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .filter((entry): entry is string => typeof entry === "string")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function resolveChannelData(payload: ReplyPayload): SaintEmailChannelData {
  const raw = payload.channelData;
  if (!raw || typeof raw !== "object") {
    return {};
  }
  const record = raw as Record<string, unknown>;
  const attachmentsRaw = Array.isArray(record.attachments) ? record.attachments : [];
  const attachments = attachmentsRaw
    .filter((entry): entry is Record<string, unknown> =>
      Boolean(entry && typeof entry === "object"),
    )
    .map((entry) => ({
      filename: typeof entry.filename === "string" ? entry.filename : "attachment.bin",
      mimeType: typeof entry.mimeType === "string" ? entry.mimeType : "application/octet-stream",
      contentBase64: typeof entry.contentBase64 === "string" ? entry.contentBase64 : "",
    }))
    .filter((entry) => entry.contentBase64.length > 0);

  return {
    subject: typeof record.subject === "string" ? record.subject : undefined,
    cc: normalizeList(record.cc),
    bcc: normalizeList(record.bcc),
    threadId: typeof record.threadId === "string" ? record.threadId : undefined,
    references: typeof record.references === "string" ? record.references : undefined,
    inReplyTo: typeof record.inReplyTo === "string" ? record.inReplyTo : undefined,
    attachments,
  };
}

function buildSubject(params: {
  payload: ReplyPayload;
  channelData: SaintEmailChannelData;
}): string {
  const explicit = params.channelData.subject?.trim();
  if (explicit) {
    return explicit;
  }
  const text = params.payload.text?.trim() ?? "";
  if (!text) {
    return "Saint update";
  }
  const first = text.split(/\r?\n/)[0] ?? "Saint update";
  return first.slice(0, 120);
}

function buildMime(params: {
  from: string;
  to: string;
  payload: ReplyPayload;
  channelData: SaintEmailChannelData;
}): string {
  const subject = sanitizeHeaderValue(
    buildSubject({ payload: params.payload, channelData: params.channelData }),
  );
  const cc = sanitizeHeaderValue(params.channelData.cc?.join(", ") ?? "");
  const bcc = sanitizeHeaderValue(params.channelData.bcc?.join(", ") ?? "");
  const references = sanitizeHeaderValue(params.channelData.references?.trim() ?? "");
  const inReplyTo = sanitizeHeaderValue(params.channelData.inReplyTo?.trim() ?? "");

  const text = params.payload.text?.trim() ?? "";
  const mediaLines = params.payload.mediaUrls?.length
    ? params.payload.mediaUrls
    : params.payload.mediaUrl
      ? [params.payload.mediaUrl]
      : [];
  const bodyText =
    mediaLines.length > 0
      ? `${text}\n\n${mediaLines.map((url) => `Attachment: ${url}`).join("\n")}`
      : text;

  const attachments = params.channelData.attachments ?? [];
  const headers = [
    `From: ${sanitizeHeaderValue(params.from)}`,
    `To: ${sanitizeHeaderValue(params.to)}`,
    ...(cc ? [`Cc: ${cc}`] : []),
    ...(bcc ? [`Bcc: ${bcc}`] : []),
    `Subject: ${subject}`,
    "MIME-Version: 1.0",
    ...(references ? [`References: ${references}`] : []),
    ...(inReplyTo ? [`In-Reply-To: ${inReplyTo}`] : []),
  ];

  if (attachments.length === 0) {
    return `${headers.join("\r\n")}\r\nContent-Type: text/plain; charset=UTF-8\r\n\r\n${bodyText}\r\n`;
  }

  const boundary = `email-boundary-${crypto.randomUUID()}`;
  const parts: string[] = [];
  parts.push(`--${boundary}`);
  parts.push("Content-Type: text/plain; charset=UTF-8");
  parts.push("");
  parts.push(bodyText);

  for (const attachment of attachments) {
    parts.push(`--${boundary}`);
    parts.push(
      `Content-Type: ${sanitizeMimeType(attachment.mimeType || "application/octet-stream")}`,
    );
    parts.push("Content-Transfer-Encoding: base64");
    parts.push(
      `Content-Disposition: attachment; filename="${sanitizeFilename(attachment.filename)}"`,
    );
    parts.push("");
    parts.push(attachment.contentBase64);
  }

  parts.push(`--${boundary}--`);
  parts.push("");

  return `${headers.join("\r\n")}\r\nContent-Type: multipart/mixed; boundary=\"${boundary}\"\r\n\r\n${parts.join("\r\n")}`;
}

export async function sendSaintEmail(params: {
  account: ResolvedSaintEmailAccount;
  to: string;
  payload: ReplyPayload;
}) {
  const channelData = resolveChannelData(params.payload);
  const mime = buildMime({
    from: params.account.address,
    to: params.to,
    payload: params.payload,
    channelData,
  });
  const raw = toBase64UrlUtf8(mime);

  const sent = await gmailSendMessage({
    account: params.account,
    raw,
    threadId: channelData.threadId,
  });

  return {
    channel: "email",
    messageId: sent.id,
    meta: {
      threadId: sent.threadId,
    },
  };
}

export const __testing = {
  buildMime,
  buildSubject,
  resolveChannelData,
  sanitizeHeaderValue,
  sanitizeMimeType,
  sanitizeFilename,
};
