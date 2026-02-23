import type { IncomingMessage, ServerResponse } from "node:http";
import { webhookCallback } from "grammy";
import type { OpenClawConfig } from "../config/config.js";
import { formatErrorMessage } from "../infra/errors.js";
import { installRequestBodyLimitGuard } from "../infra/http-body.js";
import type { RuntimeEnv } from "../runtime.js";
import { resolveTelegramAllowedUpdates } from "./allowed-updates.js";
import { withTelegramApiErrorLogging } from "./api-logging.js";
import { createTelegramBot } from "./bot.js";
import { registerTelegramHttpHandler } from "./http/index.js";

const TELEGRAM_WEBHOOK_MAX_BODY_BYTES = 1024 * 1024;
const TELEGRAM_WEBHOOK_BODY_TIMEOUT_MS = 30_000;
const TELEGRAM_WEBHOOK_CALLBACK_TIMEOUT_MS = 10_000;

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
  const secret = typeof opts.secret === "string" ? opts.secret.trim() : "";
  if (!secret) {
    throw new Error(
      "Telegram webhook mode requires a non-empty secret token. " +
        "Set channels.telegram.webhookSecret in your config.",
    );
  }
  const runtime = opts.runtime;

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

  const webhookHandler = (req: IncomingMessage, res: ServerResponse) => {
    if (req.method !== "POST") {
      res.writeHead(405);
      res.end();
      return;
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
        .catch((err: unknown) => {
          if (guard.isTripped()) {
            return;
          }
          runtime?.error?.(`telegram webhook handler failed: ${formatErrorMessage(err)}`);
          if (!res.headersSent) {
            res.writeHead(500);
          }
          res.end();
        })
        .finally(() => guard.dispose());
    } else {
      guard.dispose();
    }
  };

  const unregister = registerTelegramHttpHandler({
    path,
    handler: webhookHandler,
    log: runtime?.log,
    accountId: opts.accountId,
  });

  try {
    await withTelegramApiErrorLogging({
      operation: "setWebhook",
      runtime,
      fn: () =>
        bot.api.setWebhook(opts.publicUrl!, {
          secret_token: secret,
          allowed_updates: resolveTelegramAllowedUpdates(),
        }),
    });

    runtime?.log?.(`telegram webhook registered at ${path}`);

    if (opts.abortSignal && !opts.abortSignal.aborted) {
      await new Promise<void>((resolve) => {
        opts.abortSignal!.addEventListener("abort", () => resolve(), { once: true });
      });
    }
  } finally {
    unregister();
  }

  await bot.stop();
  return { bot, stop: unregister };
}
