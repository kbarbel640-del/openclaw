import * as http from "http";
import * as Lark from "@larksuiteoapi/node-sdk";
import {
  type ClawdbotConfig,
  type RuntimeEnv,
  type HistoryEntry,
  installRequestBodyLimitGuard,
} from "openclaw/plugin-sdk";
import { resolveFeishuAccount, listEnabledFeishuAccounts } from "./accounts.js";
import { handleFeishuMessage, type FeishuMessageEvent, type FeishuBotAddedEvent } from "./bot.js";
import { createFeishuWSClient, createEventDispatcher } from "./client.js";
import { probeFeishu } from "./probe.js";
import type { ResolvedFeishuAccount } from "./types.js";

export type MonitorFeishuOpts = {
  config?: ClawdbotConfig;
  runtime?: RuntimeEnv;
  abortSignal?: AbortSignal;
  accountId?: string;
};

// Per-account WebSocket clients, HTTP servers, and bot info
const wsClients = new Map<string, Lark.WSClient>();
const httpServers = new Map<string, http.Server>();
const botOpenIds = new Map<string, string>();
const FEISHU_WEBHOOK_MAX_BODY_BYTES = 1024 * 1024;
const FEISHU_WEBHOOK_BODY_TIMEOUT_MS = 30_000;
const FEISHU_WEBHOOK_RATE_LIMIT_WINDOW_MS = 60_000;
const FEISHU_WEBHOOK_RATE_LIMIT_MAX_REQUESTS = 120;
const FEISHU_WEBHOOK_COUNTER_LOG_EVERY = 25;
const FEISHU_STARTUP_ACCOUNT_STAGGER_MS = 1_500;
const FEISHU_BOT_INFO_RETRY_MAX_ATTEMPTS = 4;
const FEISHU_BOT_INFO_RETRY_BASE_DELAY_MS = 1_000;
const FEISHU_BOT_INFO_RETRY_MAX_DELAY_MS = 20_000;
const feishuWebhookRateLimits = new Map<string, { count: number; windowStartMs: number }>();
const feishuWebhookStatusCounters = new Map<string, number>();
let feishuStartupGate: Promise<void> = Promise.resolve();
let feishuStartupCount = 0;

function isJsonContentType(value: string | string[] | undefined): boolean {
  const first = Array.isArray(value) ? value[0] : value;
  if (!first) {
    return false;
  }
  const mediaType = first.split(";", 1)[0]?.trim().toLowerCase();
  return mediaType === "application/json" || Boolean(mediaType?.endsWith("+json"));
}

function isWebhookRateLimited(key: string, nowMs: number): boolean {
  const state = feishuWebhookRateLimits.get(key);
  if (!state || nowMs - state.windowStartMs >= FEISHU_WEBHOOK_RATE_LIMIT_WINDOW_MS) {
    feishuWebhookRateLimits.set(key, { count: 1, windowStartMs: nowMs });
    return false;
  }

  state.count += 1;
  if (state.count > FEISHU_WEBHOOK_RATE_LIMIT_MAX_REQUESTS) {
    return true;
  }
  return false;
}

function recordWebhookStatus(
  runtime: RuntimeEnv | undefined,
  accountId: string,
  path: string,
  statusCode: number,
): void {
  if (![400, 401, 408, 413, 415, 429].includes(statusCode)) {
    return;
  }
  const key = `${accountId}:${path}:${statusCode}`;
  const next = (feishuWebhookStatusCounters.get(key) ?? 0) + 1;
  feishuWebhookStatusCounters.set(key, next);
  if (next === 1 || next % FEISHU_WEBHOOK_COUNTER_LOG_EVERY === 0) {
    const log = runtime?.log ?? console.log;
    log(`feishu[${accountId}]: webhook anomaly path=${path} status=${statusCode} count=${next}`);
  }
}

function isRateLimitedProbeError(message: string | undefined): boolean {
  const text = (message ?? "").toLowerCase();
  return text.includes("429") || text.includes("too many requests") || text.includes("rate limit");
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchBotOpenIdWithRetry(
  account: ResolvedFeishuAccount,
  runtime?: RuntimeEnv,
): Promise<string | undefined> {
  const log = runtime?.log ?? console.log;
  for (let attempt = 1; attempt <= FEISHU_BOT_INFO_RETRY_MAX_ATTEMPTS; attempt++) {
    const result = await probeFeishu(account);
    if (result.ok) {
      return result.botOpenId;
    }
    if (!isRateLimitedProbeError(result.error)) {
      return undefined;
    }
    if (attempt >= FEISHU_BOT_INFO_RETRY_MAX_ATTEMPTS) {
      return undefined;
    }
    const delayMs = Math.min(
      FEISHU_BOT_INFO_RETRY_BASE_DELAY_MS * 2 ** (attempt - 1),
      FEISHU_BOT_INFO_RETRY_MAX_DELAY_MS,
    );
    log(
      `feishu[${account.accountId}]: bot info probe rate-limited, retrying in ${delayMs}ms (attempt ${attempt}/${FEISHU_BOT_INFO_RETRY_MAX_ATTEMPTS})`,
    );
    await sleep(delayMs);
  }
  return undefined;
}

async function acquireStartupSlot(runtime?: RuntimeEnv, accountId?: string): Promise<void> {
  let release!: () => void;
  const nextGate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const prevGate = feishuStartupGate;
  feishuStartupGate = nextGate;
  await prevGate;
  try {
    if (feishuStartupCount > 0) {
      const log = runtime?.log ?? console.log;
      log(
        `feishu[${accountId ?? "unknown"}]: startup stagger ${FEISHU_STARTUP_ACCOUNT_STAGGER_MS}ms`,
      );
      await sleep(FEISHU_STARTUP_ACCOUNT_STAGGER_MS);
    }
    feishuStartupCount += 1;
  } finally {
    release();
  }
}

/**
 * Register common event handlers on an EventDispatcher.
 * When fireAndForget is true (webhook mode), message handling is not awaited
 * to avoid blocking the HTTP response (Lark requires <3s response).
 */
function registerEventHandlers(
  eventDispatcher: Lark.EventDispatcher,
  context: {
    cfg: ClawdbotConfig;
    accountId: string;
    runtime?: RuntimeEnv;
    chatHistories: Map<string, HistoryEntry[]>;
    fireAndForget?: boolean;
  },
) {
  const { cfg, accountId, runtime, chatHistories, fireAndForget } = context;
  const log = runtime?.log ?? console.log;
  const error = runtime?.error ?? console.error;

  eventDispatcher.register({
    "im.message.receive_v1": async (data) => {
      try {
        const event = data as unknown as FeishuMessageEvent;
        const promise = handleFeishuMessage({
          cfg,
          event,
          botOpenId: botOpenIds.get(accountId),
          runtime,
          chatHistories,
          accountId,
        });
        if (fireAndForget) {
          promise.catch((err) => {
            error(`feishu[${accountId}]: error handling message: ${String(err)}`);
          });
        } else {
          await promise;
        }
      } catch (err) {
        error(`feishu[${accountId}]: error handling message: ${String(err)}`);
      }
    },
    "im.message.message_read_v1": async () => {
      // Ignore read receipts
    },
    "im.chat.member.bot.added_v1": async (data) => {
      try {
        const event = data as unknown as FeishuBotAddedEvent;
        log(`feishu[${accountId}]: bot added to chat ${event.chat_id}`);
      } catch (err) {
        error(`feishu[${accountId}]: error handling bot added event: ${String(err)}`);
      }
    },
    "im.chat.member.bot.deleted_v1": async (data) => {
      try {
        const event = data as unknown as { chat_id: string };
        log(`feishu[${accountId}]: bot removed from chat ${event.chat_id}`);
      } catch (err) {
        error(`feishu[${accountId}]: error handling bot removed event: ${String(err)}`);
      }
    },
  });
}

type MonitorAccountParams = {
  cfg: ClawdbotConfig;
  account: ResolvedFeishuAccount;
  runtime?: RuntimeEnv;
  abortSignal?: AbortSignal;
};

/**
 * Monitor a single Feishu account.
 */
async function monitorSingleAccount(params: MonitorAccountParams): Promise<void> {
  const { cfg, account, runtime, abortSignal } = params;
  const { accountId } = account;
  const log = runtime?.log ?? console.log;

  await acquireStartupSlot(runtime, accountId);

  const shouldProbeBotInfo = account.config?.probeBotInfoOnStartup === true;
  const botOpenId = shouldProbeBotInfo ? await fetchBotOpenIdWithRetry(account, runtime) : undefined;
  botOpenIds.set(accountId, botOpenId ?? "");
  if (shouldProbeBotInfo) {
    log(`feishu[${accountId}]: bot open_id resolved: ${botOpenId ?? "unknown"}`);
  } else {
    log(`feishu[${accountId}]: bot info probe skipped on startup`);
  }

  const connectionMode = account.config.connectionMode ?? "websocket";
  if (connectionMode === "webhook" && !account.verificationToken?.trim()) {
    throw new Error(`Feishu account "${accountId}" webhook mode requires verificationToken`);
  }
  const eventDispatcher = createEventDispatcher(account);
  const chatHistories = new Map<string, HistoryEntry[]>();

  registerEventHandlers(eventDispatcher, {
    cfg,
    accountId,
    runtime,
    chatHistories,
    fireAndForget: connectionMode === "webhook",
  });

  if (connectionMode === "webhook") {
    return monitorWebhook({ params, accountId, eventDispatcher });
  }

  return monitorWebSocket({ params, accountId, eventDispatcher });
}

type ConnectionParams = {
  params: MonitorAccountParams;
  accountId: string;
  eventDispatcher: Lark.EventDispatcher;
};

async function monitorWebSocket({
  params,
  accountId,
  eventDispatcher,
}: ConnectionParams): Promise<void> {
  const { account, runtime, abortSignal } = params;
  const log = runtime?.log ?? console.log;
  const error = runtime?.error ?? console.error;

  log(`feishu[${accountId}]: starting WebSocket connection...`);

  const wsClient = createFeishuWSClient(account);
  wsClients.set(accountId, wsClient);

  return new Promise((resolve, reject) => {
    const cleanup = () => {
      wsClients.delete(accountId);
      botOpenIds.delete(accountId);
    };

    const handleAbort = () => {
      log(`feishu[${accountId}]: abort signal received, stopping`);
      cleanup();
      resolve();
    };

    if (abortSignal?.aborted) {
      cleanup();
      resolve();
      return;
    }

    abortSignal?.addEventListener("abort", handleAbort, { once: true });

    try {
      wsClient.start({ eventDispatcher });
      log(`feishu[${accountId}]: WebSocket client started`);
    } catch (err) {
      cleanup();
      abortSignal?.removeEventListener("abort", handleAbort);
      reject(err);
    }
  });
}

async function monitorWebhook({
  params,
  accountId,
  eventDispatcher,
}: ConnectionParams): Promise<void> {
  const { account, runtime, abortSignal } = params;
  const log = runtime?.log ?? console.log;
  const error = runtime?.error ?? console.error;

  const port = account.config.webhookPort ?? 3000;
  const path = account.config.webhookPath ?? "/feishu/events";
  const host = account.config.webhookHost ?? "127.0.0.1";

  log(`feishu[${accountId}]: starting Webhook server on ${host}:${port}, path ${path}...`);

  const server = http.createServer();
  const webhookHandler = Lark.adaptDefault(path, eventDispatcher, { autoChallenge: true });
  server.on("request", (req, res) => {
    res.on("finish", () => {
      recordWebhookStatus(runtime, accountId, path, res.statusCode);
    });

    const rateLimitKey = `${accountId}:${path}:${req.socket.remoteAddress ?? "unknown"}`;
    if (isWebhookRateLimited(rateLimitKey, Date.now())) {
      res.statusCode = 429;
      res.end("Too Many Requests");
      return;
    }

    if (req.method === "POST" && !isJsonContentType(req.headers["content-type"])) {
      res.statusCode = 415;
      res.end("Unsupported Media Type");
      return;
    }

    const guard = installRequestBodyLimitGuard(req, res, {
      maxBytes: FEISHU_WEBHOOK_MAX_BODY_BYTES,
      timeoutMs: FEISHU_WEBHOOK_BODY_TIMEOUT_MS,
      responseFormat: "text",
    });
    if (guard.isTripped()) {
      return;
    }
    void Promise.resolve(webhookHandler(req, res))
      .catch((err) => {
        if (!guard.isTripped()) {
          error(`feishu[${accountId}]: webhook handler error: ${String(err)}`);
        }
      })
      .finally(() => {
        guard.dispose();
      });
  });
  httpServers.set(accountId, server);

  return new Promise((resolve, reject) => {
    const cleanup = () => {
      server.close();
      httpServers.delete(accountId);
      botOpenIds.delete(accountId);
    };

    const handleAbort = () => {
      log(`feishu[${accountId}]: abort signal received, stopping Webhook server`);
      cleanup();
      resolve();
    };

    if (abortSignal?.aborted) {
      cleanup();
      resolve();
      return;
    }

    abortSignal?.addEventListener("abort", handleAbort, { once: true });

    server.listen(port, host, () => {
      log(`feishu[${accountId}]: Webhook server listening on ${host}:${port}`);
    });

    server.on("error", (err) => {
      error(`feishu[${accountId}]: Webhook server error: ${err}`);
      abortSignal?.removeEventListener("abort", handleAbort);
      reject(err);
    });
  });
}

/**
 * Main entry: start monitoring for all enabled accounts.
 */
export async function monitorFeishuProvider(opts: MonitorFeishuOpts = {}): Promise<void> {
  const cfg = opts.config;
  if (!cfg) {
    throw new Error("Config is required for Feishu monitor");
  }

  const log = opts.runtime?.log ?? console.log;

  // If accountId is specified, only monitor that account
  if (opts.accountId) {
    const account = resolveFeishuAccount({ cfg, accountId: opts.accountId });
    if (!account.enabled || !account.configured) {
      throw new Error(`Feishu account "${opts.accountId}" not configured or disabled`);
    }
    return monitorSingleAccount({
      cfg,
      account,
      runtime: opts.runtime,
      abortSignal: opts.abortSignal,
    });
  }

  // Otherwise, start all enabled accounts
  const accounts = listEnabledFeishuAccounts(cfg);
  if (accounts.length === 0) {
    throw new Error("No enabled Feishu accounts configured");
  }

  log(
    `feishu: starting ${accounts.length} account(s): ${accounts.map((a) => a.accountId).join(", ")}`,
  );

  // Start accounts with deterministic stagger to avoid bot-info probe bursts.
  for (let i = 0; i < accounts.length; i++) {
    const account = accounts[i];
    if (i > 0) {
      await sleep(FEISHU_STARTUP_ACCOUNT_STAGGER_MS);
    }
    await monitorSingleAccount({
      cfg,
      account,
      runtime: opts.runtime,
      abortSignal: opts.abortSignal,
    });
  }
}

/**
 * Stop monitoring for a specific account or all accounts.
 */
export function stopFeishuMonitor(accountId?: string): void {
  if (accountId) {
    wsClients.delete(accountId);
    const server = httpServers.get(accountId);
    if (server) {
      server.close();
      httpServers.delete(accountId);
    }
    botOpenIds.delete(accountId);
  } else {
    wsClients.clear();
    for (const server of httpServers.values()) {
      server.close();
    }
    httpServers.clear();
    botOpenIds.clear();
  }
}
