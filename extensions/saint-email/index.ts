import type { OpenClawPluginApi } from "openclaw/plugin-sdk";
import { timingSafeEqual } from "node:crypto";
import { emptyPluginConfigSchema } from "openclaw/plugin-sdk";
import { saintEmailPlugin } from "./src/channel.js";
import { setSaintEmailRuntime, wakeAllSaintEmailMonitors } from "./src/runtime.js";

// Basic rate limiter: allow at most 1 push per MIN_INTERVAL_MS
const PUSH_MIN_INTERVAL_MS = 10_000;
const PUSH_MAX_BODY_BYTES = 65_536;
let lastPushTime = 0;

function readBody(req: import("node:http").IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    const MAX_BODY = PUSH_MAX_BODY_BYTES;
    req.on("data", (chunk: Buffer) => {
      size += chunk.length;
      if (size > MAX_BODY) {
        req.destroy();
        reject(new Error("body too large"));
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf-8")));
    req.on("error", reject);
  });
}

function extractPushVerificationToken(config: unknown): string | undefined {
  if (!config || typeof config !== "object") {
    return undefined;
  }
  const cfg = config as {
    channels?: { email?: { pushVerificationToken?: unknown } };
  };
  const token = cfg.channels?.email?.pushVerificationToken;
  if (typeof token !== "string") {
    return undefined;
  }
  const trimmed = token.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function extractPushMessageToken(body: string): string | undefined {
  if (!body.trim()) {
    return undefined;
  }
  try {
    const parsed = JSON.parse(body) as {
      message?: { attributes?: { token?: unknown } };
      token?: unknown;
    };
    const token = parsed?.message?.attributes?.token ?? parsed?.token;
    if (typeof token !== "string") {
      return undefined;
    }
    const trimmed = token.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  } catch {
    return undefined;
  }
}

function extractPushQueryToken(rawUrl?: string): string | undefined {
  if (!rawUrl) {
    return undefined;
  }
  try {
    const url = new URL(rawUrl, "http://localhost");
    const token = url.searchParams.get("token") ?? url.searchParams.get("verificationToken");
    if (!token) {
      return undefined;
    }
    const trimmed = token.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  } catch {
    return undefined;
  }
}

function timingSafeTokenEquals(left: string, right: string): boolean {
  const lhs = Buffer.from(left);
  const rhs = Buffer.from(right);
  if (lhs.length !== rhs.length) {
    return false;
  }
  return timingSafeEqual(lhs, rhs);
}

const plugin = {
  id: "saint-email",
  name: "Saint Email",
  description: "Email channel plugin using Gmail API push/poll",
  configSchema: emptyPluginConfigSchema(),
  register(api: OpenClawPluginApi) {
    setSaintEmailRuntime(api.runtime);
    api.registerChannel({ plugin: saintEmailPlugin });

    api.registerHttpRoute({
      path: "/saint-email/push",
      handler: async (req, res) => {
        if ((req.method ?? "POST").toUpperCase() !== "POST") {
          res.writeHead(405, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "method not allowed" }));
          return;
        }

        // Read fresh config for every request because plugins can update config at runtime.
        const expectedPushToken = extractPushVerificationToken(api.runtime.config.loadConfig());
        let body = "";
        try {
          body = await readBody(req);

          // Validate push origin if a verification token is configured
          if (expectedPushToken) {
            // Google Pub/Sub push messages include the token in message.attributes
            // or as a query parameter.
            const messageToken = extractPushMessageToken(body);
            const queryToken = extractPushQueryToken(req.url);
            const candidateTokens = [messageToken, queryToken].filter(
              (entry): entry is string => typeof entry === "string" && entry.length > 0,
            );
            const hasMatch = candidateTokens.some((entry) =>
              timingSafeTokenEquals(entry, expectedPushToken),
            );
            if (!hasMatch) {
              res.writeHead(403, { "Content-Type": "application/json" });
              res.end(JSON.stringify({ error: "invalid push token" }));
              return;
            }
          }
        } catch (err) {
          if (err instanceof Error && err.message === "body too large") {
            res.writeHead(413, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: "payload too large" }));
            return;
          }
          if (expectedPushToken) {
            // Body parse failed and token validation is required — reject
            res.writeHead(403, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: "invalid push payload" }));
            return;
          }
          // No token configured — proceed with rate-limited wake
        }

        const now = Date.now();
        if (now - lastPushTime < PUSH_MIN_INTERVAL_MS) {
          res.writeHead(429, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "rate limited" }));
          return;
        }
        lastPushTime = now;

        wakeAllSaintEmailMonitors();
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ ok: true }));
      },
    });
  },
};

export default plugin;

export const __testing = {
  extractPushVerificationToken,
  extractPushMessageToken,
  extractPushQueryToken,
  timingSafeTokenEquals,
};
