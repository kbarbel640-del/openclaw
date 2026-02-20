/**
 * Extract email body and metadata from Gmail API message responses.
 */

const MAX_EMAIL_BODY_CHARS = 2000;

/** A single header from a Gmail message payload. */
export type GmailHeader = {
  name: string;
  value: string;
};

/** A MIME part within a Gmail message payload. */
export type GmailMessagePart = {
  partId?: string;
  mimeType?: string;
  headers?: GmailHeader[];
  body?: { size: number; data?: string };
  parts?: GmailMessagePart[];
};

/** Raw Gmail API message object (format=full). */
export type GmailMessage = {
  id: string;
  threadId?: string;
  labelIds?: string[];
  snippet?: string;
  payload?: GmailMessagePart & {
    headers?: GmailHeader[];
  };
  internalDate?: string;
};

/**
 * Walk MIME parts depth-first, collecting text/plain and text/html bodies.
 * Prefers text/plain over text/html.
 */
function walkParts(parts: GmailMessagePart[]): { plain?: string; html?: string } {
  let plain: string | undefined;
  let html: string | undefined;

  for (const part of parts) {
    // Recurse into nested multipart
    if (part.parts && part.parts.length > 0) {
      const nested = walkParts(part.parts);
      if (!plain && nested.plain) plain = nested.plain;
      if (!html && nested.html) html = nested.html;
    }

    if (part.mimeType === "text/plain" && part.body?.data && !plain) {
      plain = decodeBase64Url(part.body.data);
    } else if (part.mimeType === "text/html" && part.body?.data && !html) {
      html = decodeBase64Url(part.body.data);
    }
  }

  return { plain, html };
}

/**
 * Decode a base64url-encoded string, returning empty string on failure.
 */
function decodeBase64Url(data: string): string {
  try {
    return Buffer.from(data, "base64url").toString("utf-8");
  } catch {
    return "";
  }
}

/**
 * Strip HTML tags and convert to readable plain text.
 */
function stripHtml(html: string): string {
  let text = html;

  // Remove <style> blocks
  text = text.replace(/<style[\s\S]*?<\/style>/gi, "");

  // Remove <script> blocks
  text = text.replace(/<script[\s\S]*?<\/script>/gi, "");

  // Replace <br> and </p> with newlines
  text = text.replace(/<br\s*\/?>/gi, "\n");
  text = text.replace(/<\/p>/gi, "\n");

  // Strip remaining HTML tags
  text = text.replace(/<[^>]*>/g, "");

  // Decode basic HTML entities
  text = text.replace(/&amp;/g, "&");
  text = text.replace(/&lt;/g, "<");
  text = text.replace(/&gt;/g, ">");
  text = text.replace(/&nbsp;/g, " ");
  text = text.replace(/&quot;/g, '"');

  return text.trim();
}

/**
 * Truncate text to MAX_EMAIL_BODY_CHARS, appending [...truncated] if needed.
 */
function truncate(text: string): string {
  if (text.length <= MAX_EMAIL_BODY_CHARS) {
    return text;
  }
  return text.slice(0, MAX_EMAIL_BODY_CHARS) + " [...truncated]";
}

/**
 * Extract the email body text from a Gmail API message response.
 *
 * Walks payload.parts recursively (depth-first) preferring text/plain over text/html.
 * Falls back to payload.body.data if no parts exist.
 * Strips HTML tags for HTML-only messages.
 * Truncates to 2000 characters.
 */
export function extractBody(message: GmailMessage): string {
  if (!message.payload) {
    return "";
  }

  const { payload } = message;

  // Try multipart parts first
  if (payload.parts && payload.parts.length > 0) {
    const { plain, html } = walkParts(payload.parts);

    if (plain) {
      return truncate(plain);
    }

    if (html) {
      return truncate(stripHtml(html));
    }
  }

  // Fall back to payload.body.data (single-part message)
  if (payload.body?.data) {
    const decoded = decodeBase64Url(payload.body.data);
    if (!decoded) return "";

    if (payload.mimeType === "text/html") {
      return truncate(stripHtml(decoded));
    }

    return truncate(decoded);
  }

  return "";
}

/**
 * Extract metadata (From, Subject, Date) from Gmail message headers.
 */
export function extractMetadata(message: GmailMessage): {
  from: string;
  subject: string;
  date: string;
} {
  const headers = message.payload?.headers ?? [];

  const getHeader = (name: string): string => {
    const header = headers.find((h) => h.name.toLowerCase() === name.toLowerCase());
    return header?.value ?? "";
  };

  return {
    from: getHeader("From"),
    subject: getHeader("Subject"),
    date: getHeader("Date"),
  };
}
