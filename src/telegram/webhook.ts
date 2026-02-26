import { createServer } from "node:http";
import { webhookCallback } from "grammy";
import type { OpenClawConfig } from "../config/config.js";
import { isDiagnosticsEnabled } from "../infra/diagnostic-events.js";
import { formatErrorMessage } from "../infra/errors.js";
import { readJsonBodyWithLimit } from "../infra/http-body.js";
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
import { registerTelegramHttpHandler } from "./http/index.js";

const TELEGRAM_WEBHOOK_MAX_BODY_BYTES = 1024 * 1024;
const TELEGRAM_WEBHOOK_BODY_TIMEOUT_MS = 30_000;
const TELEGRAM_WEBHOOK_CALLBACK_TIMEOUT_MS = 10_000;

const TELEGRAM_LEGACY_WEBHOOK_PORT = 8787;
const TELEGRAM_LEGACY_WEBHOOK_HOST = "127.0.0.1";

// ---------------------------------------------------------------------------
// Shared webhook POST handler (used by both legacy and gateway modes)
// ---------------------------------------------------------------------------

function respondText(res: import("node:http").ServerResponse, statusCode: number, text = "") {
  if (res.headersSent || res.writableEnded) {
    return;
  }
  res.writeHead(statusCode, { "Content-Type": "text/plain; charset=utf-8" });
  res.end(text);
}

async function handleWebhookPostRequest(
  req: import("node:http").IncomingMessage,
  res: import("node:http").ServerResponse,
  opts: {
    handler: ReturnType<typeof webhookCallback>;
    runtime?: RuntimeEnv;
    diagnosticsEnabled: boolean;
  },
): Promise<void> {
  const startTime = Date.now();
  if (opts.diagnosticsEnabled) {
    logWebhookReceived({ channel: "telegram", updateType: "telegram-post" });
  }

  try {
    const body = await readJsonBodyWithLimit(req, {
      maxBytes: TELEGRAM_WEBHOOK_MAX_BODY_BYTES,
      timeoutMs: TELEGRAM_WEBHOOK_BODY_TIMEOUT_MS,
      emptyObjectOnEmpty: false,
    });
    if (!body.ok) {
      if (body.code === "PAYLOAD_TOO_LARGE") {
        respondText(res, 413, body.error);
        return;
      }
      if (body.code === "REQUEST_BODY_TIMEOUT") {
        respondText(res, 408, body.error);
        return;
      }
      if (body.code === "CONNECTION_CLOSED") {
        respondText(res, 400, body.error);
        return;
      }
      respondText(res, 400, body.error);
      return;
    }

    let replied = false;
    const reply = async (json: string) => {
      if (replied) {
        return;
      }
      replied = true;
      if (res.headersSent || res.writableEnded) {
        return;
      }
      res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
      res.end(json);
    };
    const unauthorized = async () => {
      if (replied) {
        return;
      }
      replied = true;
      respondText(res, 401, "unauthorized");
    };
    const secretHeaderRaw = req.headers["x-telegram-bot-api-secret-token"];
    const secretHeader = Array.isArray(secretHeaderRaw) ? secretHeaderRaw[0] : secretHeaderRaw;

    await opts.handler(body.value, reply, secretHeader, unauthorized);
    if (!replied) {
      respondText(res, 200);
    }

    if (opts.diagnosticsEnabled) {
      logWebhookProcessed({
        channel: "telegram",
        updateType: "telegram-post",
        durationMs: Date.now() - startTime,
      });
    }
  } catch (err) {
    const errMsg = formatErrorMessage(err);
    if (opts.diagnosticsEnabled) {
      logWebhookError({
        channel: "telegram",
        updateType: "telegram-post",
        error: errMsg,
      });
    }
    opts.runtime?.log?.(`webhook handler failed: ${errMsg}`);
    respondText(res, 500);
  }
}

async function listenHttpServer(params: {
  server: ReturnType<typeof createServer>;
  port: number;
  host: string;
}) {
  await new Promise<void>((resolve, reject) => {
    const onError = (err: Error) => {
      params.server.off("error", onError);
      reject(err);
    };
    params.server.once("error", onError);
    params.server.listen(params.port, params.host, () => {
      params.server.off("error", onError);
      resolve();
    });
  });
}

function resolveWebhookPublicUrl(params: {
  configuredPublicUrl?: string;
  server: ReturnType<typeof createServer>;
  path: string;
  host: string;
  port: number;
}) {
  if (params.configuredPublicUrl) {
    return params.configuredPublicUrl;
  }
  const address = params.server.address();
  if (address && typeof address !== "string") {
    const resolvedHost =
      params.host === "0.0.0.0" || address.address === "0.0.0.0" || address.address === "::"
        ? "localhost"
        : address.address;
    return `http://${resolvedHost}:${address.port}${params.path}`;
  }
  const fallbackHost = params.host === "0.0.0.0" ? "localhost" : params.host;
  return `http://${fallbackHost}:${params.port}${params.path}`;
}

async function initializeTelegramWebhookBot(params: {
  bot: ReturnType<typeof createTelegramBot>;
  runtime: RuntimeEnv;
  abortSignal?: AbortSignal;
}) {
  const initSignal = params.abortSignal as Parameters<(typeof params.bot)["init"]>[0];
  await withTelegramApiErrorLogging({
    operation: "getMe",
    runtime: params.runtime,
    fn: () => params.bot.init(initSignal),
  });
}

/**
 * Returns true if the user explicitly configured a webhook host or port,
 * signaling they want the legacy dedicated HTTP server instead of gateway
 * HTTP ingress.
 */
export function shouldUseLegacyWebhookServer(opts: { host?: string; port?: number }): boolean {
  return opts.host !== undefined || opts.port !== undefined;
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
  await initializeTelegramWebhookBot({
    bot,
    runtime,
    abortSignal: opts.abortSignal,
  });
  const handler = webhookCallback(bot, "callback", {
    secretToken: secret,
    onTimeout: "return",
    timeoutMilliseconds: TELEGRAM_WEBHOOK_CALLBACK_TIMEOUT_MS,
  });

  if (diagnosticsEnabled) {
    startDiagnosticHeartbeat();
  }

  const useLegacy = shouldUseLegacyWebhookServer({
    host: opts.host,
    port: opts.port,
  });

  if (useLegacy) {
    return startLegacyWebhookServer({
      bot,
      handler,
      path,
      port: opts.port ?? TELEGRAM_LEGACY_WEBHOOK_PORT,
      host: opts.host ?? TELEGRAM_LEGACY_WEBHOOK_HOST,
      healthPath: opts.healthPath ?? "/healthz",
      secret,
      runtime,
      diagnosticsEnabled,
      publicUrl: opts.publicUrl,
      abortSignal: opts.abortSignal,
    });
  }

  return startGatewayWebhook({
    bot,
    handler,
    path,
    secret,
    runtime,
    diagnosticsEnabled,
    publicUrl: opts.publicUrl,
    accountId: opts.accountId,
    abortSignal: opts.abortSignal,
  });
}

// ---------------------------------------------------------------------------
// Legacy dedicated server mode (when webhookHost/webhookPort are explicit)
// ---------------------------------------------------------------------------

async function startLegacyWebhookServer(opts: {
  bot: ReturnType<typeof createTelegramBot>;
  handler: ReturnType<typeof webhookCallback>;
  path: string;
  port: number;
  host: string;
  healthPath: string;
  secret: string;
  runtime: RuntimeEnv;
  diagnosticsEnabled: boolean;
  publicUrl?: string;
  abortSignal?: AbortSignal;
}) {
  const { bot, handler, path, port, host, healthPath, secret, runtime, diagnosticsEnabled } = opts;

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
    void handleWebhookPostRequest(req, res, { handler, runtime, diagnosticsEnabled });
  });

  await listenHttpServer({ server, port, host });
  const boundAddress = server.address();
  const boundPort = boundAddress && typeof boundAddress !== "string" ? boundAddress.port : port;

  const publicUrl = resolveWebhookPublicUrl({
    configuredPublicUrl: opts.publicUrl,
    server,
    path,
    host,
    port,
  });

  try {
    await withTelegramApiErrorLogging({
      operation: "setWebhook",
      runtime,
      fn: () =>
        bot.api.setWebhook(publicUrl, {
          secret_token: secret,
          allowed_updates: resolveTelegramAllowedUpdates(),
        }),
    });
  } catch (err) {
    server.close();
    void bot.stop();
    if (diagnosticsEnabled) {
      stopDiagnosticHeartbeat();
    }
    throw err;
  }

  runtime.log?.(`webhook local listener on http://${host}:${boundPort}${path}`);
  runtime.log?.(`webhook advertised to telegram on ${publicUrl}`);

  let shutDown = false;
  const shutdown = () => {
    if (shutDown) {
      return;
    }
    shutDown = true;
    void withTelegramApiErrorLogging({
      operation: "deleteWebhook",
      runtime,
      fn: () => bot.api.deleteWebhook({ drop_pending_updates: false }),
    }).catch(() => {
      // withTelegramApiErrorLogging has already emitted the failure.
    });
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

// ---------------------------------------------------------------------------
// Gateway HTTP ingress mode (default — no dedicated server)
// ---------------------------------------------------------------------------

async function startGatewayWebhook(opts: {
  bot: ReturnType<typeof createTelegramBot>;
  handler: ReturnType<typeof webhookCallback>;
  path: string;
  secret: string;
  runtime: RuntimeEnv;
  diagnosticsEnabled: boolean;
  publicUrl?: string;
  accountId?: string;
  abortSignal?: AbortSignal;
}) {
  const { bot, handler, path, secret, runtime, diagnosticsEnabled } = opts;

  const publicUrl = opts.publicUrl;
  if (!publicUrl) {
    throw new Error(
      "Telegram gateway webhook mode requires a webhookUrl (publicUrl). " +
        "Set channels.telegram.webhookUrl in your config to the externally-reachable URL.",
    );
  }

  // Register webhook handler on the gateway HTTP server
  const unregister = registerTelegramHttpHandler({
    path,
    accountId: opts.accountId,
    log: runtime.log,
    handler: (req, res) => {
      if (req.method !== "POST") {
        res.writeHead(404);
        res.end();
        return;
      }
      void handleWebhookPostRequest(req, res, { handler, runtime, diagnosticsEnabled });
    },
  });

  // Set webhook with Telegram
  try {
    await withTelegramApiErrorLogging({
      operation: "setWebhook",
      runtime,
      fn: () =>
        bot.api.setWebhook(publicUrl, {
          secret_token: secret,
          allowed_updates: resolveTelegramAllowedUpdates(),
        }),
    });
  } catch (err) {
    unregister();
    void bot.stop();
    if (diagnosticsEnabled) {
      stopDiagnosticHeartbeat();
    }
    throw err;
  }

  runtime.log?.(`webhook registered on gateway HTTP at path ${path}`);
  runtime.log?.(`webhook advertised to telegram on ${publicUrl}`);

  let shutDown = false;
  const shutdown = () => {
    if (shutDown) {
      return;
    }
    shutDown = true;
    void withTelegramApiErrorLogging({
      operation: "deleteWebhook",
      runtime,
      fn: () => bot.api.deleteWebhook({ drop_pending_updates: false }),
    }).catch(() => {
      // withTelegramApiErrorLogging has already emitted the failure.
    });
    unregister();
    void bot.stop();
    if (diagnosticsEnabled) {
      stopDiagnosticHeartbeat();
    }
  };

  if (opts.abortSignal) {
    opts.abortSignal.addEventListener("abort", shutdown, { once: true });
  }

  // In gateway mode, wait for abort signal since there's no dedicated server
  if (opts.abortSignal) {
    await new Promise<void>((resolve) => {
      if (opts.abortSignal!.aborted) {
        resolve();
        return;
      }
      opts.abortSignal!.addEventListener("abort", () => resolve(), { once: true });
    });
  }

  return { bot, stop: shutdown };
}
