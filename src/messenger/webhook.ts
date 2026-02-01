/**
 * Facebook Messenger webhook handling.
 *
 * Implements:
 * - GET webhook verification (hub.challenge handshake)
 * - POST event handling with X-Hub-Signature-256 verification
 */

import type { IncomingMessage, ServerResponse } from "node:http";
import crypto from "node:crypto";
import type { RuntimeEnv } from "../runtime.js";
import type { MessengerWebhookPayload } from "./types.js";

/**
 * Verify the X-Hub-Signature-256 header from Facebook.
 *
 * Facebook signs webhook payloads using HMAC-SHA256 with your app secret.
 * The signature header format is: "sha256=<hex_digest>"
 */
export function verifyMessengerSignature(
  body: string | Buffer,
  signature: string,
  appSecret: string,
): boolean {
  if (!signature.startsWith("sha256=")) {
    return false;
  }

  const expectedHash = signature.slice("sha256=".length);
  const bodyStr = Buffer.isBuffer(body) ? body.toString("utf-8") : body;
  const computedHash = crypto.createHmac("sha256", appSecret).update(bodyStr).digest("hex");

  // Use constant-time comparison to prevent timing attacks.
  const expectedBuffer = Buffer.from(expectedHash, "hex");
  const computedBuffer = Buffer.from(computedHash, "hex");

  if (expectedBuffer.length !== computedBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(expectedBuffer, computedBuffer);
}

/**
 * Compute the X-Hub-Signature-256 for a payload.
 * Useful for testing webhook handlers.
 */
export function computeMessengerSignature(body: string | Buffer, appSecret: string): string {
  const bodyStr = Buffer.isBuffer(body) ? body.toString("utf-8") : body;
  const hash = crypto.createHmac("sha256", appSecret).update(bodyStr).digest("hex");
  return `sha256=${hash}`;
}

/**
 * Webhook verification query parameters.
 */
export type MessengerVerifyQuery = {
  "hub.mode"?: string;
  "hub.verify_token"?: string;
  "hub.challenge"?: string;
};

/**
 * Verify the webhook subscription request from Facebook.
 *
 * Facebook sends a GET request with:
 * - hub.mode = "subscribe"
 * - hub.verify_token = your configured verify token
 * - hub.challenge = a challenge string to echo back
 *
 * Returns the challenge string if valid, or an error message.
 */
export function verifyWebhookSubscription(
  query: MessengerVerifyQuery,
  verifyToken: string,
): { valid: true; challenge: string } | { valid: false; error: string } {
  const mode = query["hub.mode"];
  const token = query["hub.verify_token"];
  const challenge = query["hub.challenge"];

  if (mode !== "subscribe") {
    return { valid: false, error: "Invalid hub.mode" };
  }

  if (!token) {
    return { valid: false, error: "Missing hub.verify_token" };
  }

  if (token !== verifyToken) {
    return { valid: false, error: "Invalid hub.verify_token" };
  }

  if (!challenge) {
    return { valid: false, error: "Missing hub.challenge" };
  }

  return { valid: true, challenge };
}

/**
 * Parse URL query string into an object.
 */
export function parseQueryString(queryString: string): Record<string, string> {
  const result: Record<string, string> = {};
  if (!queryString) {
    return result;
  }

  const params = new URLSearchParams(queryString);
  for (const [key, value] of params) {
    result[key] = value;
  }
  return result;
}

/**
 * Read the raw body from an incoming HTTP request.
 */
export async function readRequestBody(req: IncomingMessage): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

/**
 * Parse the webhook payload from the request body.
 */
export function parseWebhookPayload(body: string | Buffer): MessengerWebhookPayload | null {
  try {
    const str = Buffer.isBuffer(body) ? body.toString("utf-8") : body;
    const parsed = JSON.parse(str) as unknown;

    // Basic validation
    if (
      typeof parsed !== "object" ||
      parsed === null ||
      !("object" in parsed) ||
      !("entry" in parsed)
    ) {
      return null;
    }

    const payload = parsed as MessengerWebhookPayload;
    if (payload.object !== "page") {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}

/**
 * Options for the Messenger webhook handler.
 */
export type MessengerWebhookOptions = {
  /** App Secret for signature verification. */
  appSecret: string;
  /** Verify Token for subscription verification. */
  verifyToken: string;
  /** Callback for processing webhook events. */
  onEvents: (payload: MessengerWebhookPayload) => Promise<void>;
  /** Optional runtime for logging. */
  runtime?: RuntimeEnv;
};

/**
 * Create a Messenger webhook handler for Node.js HTTP server.
 *
 * Handles both GET (verification) and POST (events) requests.
 */
export function createMessengerWebhookHandler(options: MessengerWebhookOptions): {
  handler: (req: IncomingMessage, res: ServerResponse) => Promise<void>;
} {
  const { appSecret, verifyToken, onEvents, runtime } = options;

  const handler = async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
    try {
      // Handle GET request for webhook verification
      if (req.method === "GET") {
        const url = new URL(req.url ?? "", `http://${req.headers.host ?? "localhost"}`);
        const query = Object.fromEntries(url.searchParams) as MessengerVerifyQuery;

        const result = verifyWebhookSubscription(query, verifyToken);
        if (result.valid) {
          runtime?.log?.("messenger: webhook verification successful");
          res.writeHead(200, { "Content-Type": "text/plain" });
          res.end(result.challenge);
        } else {
          runtime?.log?.(`messenger: webhook verification failed: ${result.error}`);
          res.writeHead(403, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: result.error }));
        }
        return;
      }

      // Handle POST request for events
      if (req.method === "POST") {
        const signature = req.headers["x-hub-signature-256"];

        if (!signature || typeof signature !== "string") {
          runtime?.log?.("messenger: missing X-Hub-Signature-256 header");
          res.writeHead(401, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "Missing signature" }));
          return;
        }

        const body = await readRequestBody(req);

        if (!verifyMessengerSignature(body, signature, appSecret)) {
          runtime?.log?.("messenger: signature verification failed");
          res.writeHead(401, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "Invalid signature" }));
          return;
        }

        const payload = parseWebhookPayload(body);
        if (!payload) {
          runtime?.log?.("messenger: invalid webhook payload");
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "Invalid payload" }));
          return;
        }

        // Respond immediately to avoid Facebook's 20-second timeout
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ status: "ok" }));

        // Process events asynchronously
        const eventCount = payload.entry.reduce((sum, e) => sum + (e.messaging?.length ?? 0), 0);
        if (eventCount > 0) {
          runtime?.log?.(`messenger: received ${eventCount} webhook events`);
          await onEvents(payload).catch((err) => {
            runtime?.error?.(`messenger: webhook handler failed: ${String(err)}`);
          });
        }
        return;
      }

      // Method not allowed
      res.writeHead(405, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Method not allowed" }));
    } catch (err) {
      runtime?.error?.(`messenger: webhook error: ${String(err)}`);
      if (!res.headersSent) {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Internal server error" }));
      }
    }
  };

  return { handler };
}

/**
 * Options for starting the Messenger webhook server.
 */
export type StartMessengerWebhookOptions = MessengerWebhookOptions & {
  /** Webhook path (default: "/messenger/webhook"). */
  path?: string;
  /** Health check path (default: "/healthz"). */
  healthPath?: string;
};

/**
 * Create middleware-style handler info for Messenger webhooks.
 */
export function startMessengerWebhook(options: StartMessengerWebhookOptions): {
  path: string;
  healthPath: string;
  handler: (req: IncomingMessage, res: ServerResponse) => Promise<void>;
} {
  const path = options.path ?? "/messenger/webhook";
  const healthPath = options.healthPath ?? "/healthz";
  const { handler } = createMessengerWebhookHandler(options);

  return { path, healthPath, handler };
}
