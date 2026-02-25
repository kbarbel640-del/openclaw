import { createServer } from "node:http";
import { webhookCallback } from "grammy";
import type { OpenClawConfig } from "../config/config.js";
import { normalizeRateLimitClientIp } from "../gateway/auth-rate-limit.js";
import { isDiagnosticsEnabled } from "../infra/diagnostic-events.js";
import { formatErrorMessage } from "../infra/errors.js";
import { installRequestBodyLimitGuard } from "../infra/http-body.js";
import {
  logWebhookError,
  logWebhookProcessed,
  logWebhookReceived,
  startDiagnosticHeartbeat,
  stopDiagnosticHeartbeat,
} from "../logging/diagnostic.js";
import type { RuntimeEnv } from "../runtime.js";
import { defaultRuntime } from "../runtime.js";
import { resolveTelegramAllowedUpdates } from "./allowed-updates.js";
import { withTelegramApiErrorLogging } from "./api-logging.js";
import { createTelegramBot } from "./bot.js";

const TELEGRAM_WEBHOOK_MAX_BODY_BYTES = 1024 * 1024;
const TELEGRAM_WEBHOOK_BODY_TIMEOUT_MS = 30_000;
const TELEGRAM_WEBHOOK_CALLBACK_TIMEOUT_MS = 10_000;
const TELEGRAM_WEBHOOK_RATE_LIMIT_WINDOW_MS = 60_000;
const TELEGRAM_WEBHOOK_RATE_LIMIT_MAX_REQUESTS = 120;
const TELEGRAM_WEBHOOK_RATE_LIMIT_MAX_TRACKED_KEYS = 4_096;

type WebhookRateLimitState = { count: number; windowStartMs: number };
const webhookRateLimits = new Map<string, WebhookRateLimitState>();
let lastWebhookRateLimitCleanupMs = 0;

function trimWebhookRateLimitState(): void {
  while (webhookRateLimits.size > TELEGRAM_WEBHOOK_RATE_LIMIT_MAX_TRACKED_KEYS) {
    const oldestKey = webhookRateLimits.keys().next().value;
    if (typeof oldestKey !== "string") {
      break;
    }
    webhookRateLimits.delete(oldestKey);
  }
}

function maybePruneWebhookRateLimitState(nowMs: number): void {
  if (
    webhookRateLimits.size === 0 ||
    nowMs - lastWebhookRateLimitCleanupMs < TELEGRAM_WEBHOOK_RATE_LIMIT_WINDOW_MS
  ) {
    return;
  }
  lastWebhookRateLimitCleanupMs = nowMs;
  for (const [key, state] of webhookRateLimits) {
    if (nowMs - state.windowStartMs >= TELEGRAM_WEBHOOK_RATE_LIMIT_WINDOW_MS) {
      webhookRateLimits.delete(key);
    }
  }
}

export function clearTelegramWebhookRateLimits(): void {
  webhookRateLimits.clear();
  lastWebhookRateLimitCleanupMs = 0;
}

export function getTelegramWebhookRateLimitStateSize(): number {
  return webhookRateLimits.size;
}

export function isTelegramWebhookRateLimited(key: string, nowMs: number): boolean {
  maybePruneWebhookRateLimitState(nowMs);

  const state = webhookRateLimits.get(key);
  if (!state || nowMs - state.windowStartMs >= TELEGRAM_WEBHOOK_RATE_LIMIT_WINDOW_MS) {
    webhookRateLimits.set(key, { count: 1, windowStartMs: nowMs });
    trimWebhookRateLimitState();
    return false;
  }

  state.count += 1;
  if (state.count > TELEGRAM_WEBHOOK_RATE_LIMIT_MAX_REQUESTS) {
    return true;
  }
  return false;
}

export function buildTelegramWebhookRateLimitKey(
  path: string,
  remoteAddress: string | undefined,
): string {
  return `${path}:${normalizeRateLimitClientIp(remoteAddress)}`;
}

export async function startTelegramWebhook(opts: {
  token: string;
  accountId?: string;
  config?: OpenClawConfig;
  path?: string;
  port?: number;
  host?: string;
  secret?: string;
  runtime?: RuntimeEnv;
  fetch?: typeof fetch;
  abortSignal?: AbortSignal;
  healthPath?: string;
  publicUrl?: string;
}) {
  const path = opts.path ?? "/telegram-webhook";
  const healthPath = opts.healthPath ?? "/healthz";
  const port = opts.port ?? 8787;
  const host = opts.host ?? "127.0.0.1";
  const secret = typeof opts.secret === "string" ? opts.secret.trim() : "";
  if (!secret) {
    throw new Error(
      "Telegram webhook mode requires a non-empty secret token. " +
        "Set channels.telegram.webhookSecret in your config.",
    );
  }
  const runtime = opts.runtime ?? defaultRuntime;
  const diagnosticsEnabled = isDiagnosticsEnabled(opts.config);
  const bot = createTelegramBot({
    token: opts.token,
    runtime,
    proxyFetch: opts.fetch,
    config: opts.config,
    accountId: opts.accountId,
  });
  const handler = webhookCallback(bot, "http", {
    secretToken: secret,
    onTimeout: "return",
    timeoutMilliseconds: TELEGRAM_WEBHOOK_CALLBACK_TIMEOUT_MS,
  });

  if (diagnosticsEnabled) {
    startDiagnosticHeartbeat();
  }

  const server = createServer((req, res) => {
    if (req.url === healthPath) {
      res.writeHead(200);
      res.end("ok");
      return;
    }
    if (req.url !== path || req.method !== "POST") {
      res.writeHead(404);
      res.end();
      return;
    }
    const rateLimitKey = buildTelegramWebhookRateLimitKey(path, req.socket.remoteAddress);
    if (isTelegramWebhookRateLimited(rateLimitKey, Date.now())) {
      res.writeHead(429);
      res.end("Too Many Requests");
      return;
    }
    const startTime = Date.now();
    if (diagnosticsEnabled) {
      logWebhookReceived({ channel: "telegram", updateType: "telegram-post" });
    }
    const guard = installRequestBodyLimitGuard(req, res, {
      maxBytes: TELEGRAM_WEBHOOK_MAX_BODY_BYTES,
      timeoutMs: TELEGRAM_WEBHOOK_BODY_TIMEOUT_MS,
      responseFormat: "text",
    });
    if (guard.isTripped()) {
      return;
    }
    const handled = handler(req, res);
    if (handled && typeof handled.catch === "function") {
      void handled
        .then(() => {
          if (diagnosticsEnabled) {
            logWebhookProcessed({
              channel: "telegram",
              updateType: "telegram-post",
              durationMs: Date.now() - startTime,
            });
          }
        })
        .catch((err) => {
          if (guard.isTripped()) {
            return;
          }
          const errMsg = formatErrorMessage(err);
          if (diagnosticsEnabled) {
            logWebhookError({
              channel: "telegram",
              updateType: "telegram-post",
              error: errMsg,
            });
          }
          runtime.log?.(`webhook handler failed: ${errMsg}`);
          if (!res.headersSent) {
            res.writeHead(500);
          }
          res.end();
        })
        .finally(() => {
          guard.dispose();
        });
      return;
    }
    guard.dispose();
  });

  const publicUrl =
    opts.publicUrl ?? `http://${host === "0.0.0.0" ? "localhost" : host}:${port}${path}`;

  await withTelegramApiErrorLogging({
    operation: "setWebhook",
    runtime,
    fn: () =>
      bot.api.setWebhook(publicUrl, {
        secret_token: secret,
        allowed_updates: resolveTelegramAllowedUpdates(),
      }),
  });

  await new Promise<void>((resolve) => server.listen(port, host, resolve));
  runtime.log?.(`webhook listening on ${publicUrl}`);

  const shutdown = () => {
    server.close();
    void bot.stop();
    if (diagnosticsEnabled) {
      stopDiagnosticHeartbeat();
    }
  };
  if (opts.abortSignal) {
    opts.abortSignal.addEventListener("abort", shutdown, { once: true });
  }

  return { server, bot, stop: shutdown };
}
