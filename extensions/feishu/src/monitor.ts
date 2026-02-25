import * as http from "http";
import { Readable } from "stream";
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

/**
 * Shared webhook servers keyed by "host:port".
 * When multiple accounts are configured on the same host:port, they share a
 * single HTTP server and incoming requests are routed by verification token
 * (header.token) or app_id (header.app_id) extracted from the JSON body.
 */
type SharedWebhookServer = {
  server: http.Server;
  /** Map from verificationToken → per-account webhook handler */
  tokenHandlers: Map<string, (req: http.IncomingMessage, res: http.ServerResponse) => void>;
  /** Map from appId → per-account webhook handler */
  appIdHandlers: Map<string, (req: http.IncomingMessage, res: http.ServerResponse) => void>;
  /** Account IDs registered on this shared server */
  accountIds: Set<string>;
  /** Runtime for logging */
  runtime?: RuntimeEnv;
  /** Abort handling */
  abortCleanups: Array<() => void>;
};
const sharedWebhookServers = new Map<string, SharedWebhookServer>();
const FEISHU_WEBHOOK_MAX_BODY_BYTES = 1024 * 1024;
const FEISHU_WEBHOOK_BODY_TIMEOUT_MS = 30_000;
const FEISHU_WEBHOOK_RATE_LIMIT_WINDOW_MS = 60_000;
const FEISHU_WEBHOOK_RATE_LIMIT_MAX_REQUESTS = 120;
const FEISHU_WEBHOOK_COUNTER_LOG_EVERY = 25;
const feishuWebhookRateLimits = new Map<string, { count: number; windowStartMs: number }>();
const feishuWebhookStatusCounters = new Map<string, number>();

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

async function fetchBotOpenId(account: ResolvedFeishuAccount): Promise<string | undefined> {
  try {
    const result = await probeFeishu(account);
    return result.ok ? result.botOpenId : undefined;
  } catch {
    return undefined;
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

  // Fetch bot open_id
  const botOpenId = await fetchBotOpenId(account);
  botOpenIds.set(accountId, botOpenId ?? "");
  log(`feishu[${accountId}]: bot open_id resolved: ${botOpenId ?? "unknown"}`);

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

/**
 * Parse the Feishu webhook request body to extract routing identifiers.
 * Returns { token, appId } from the JSON body's header field.
 */
function parseWebhookRoutingInfo(rawBody: Buffer): {
  token?: string;
  appId?: string;
  type?: string;
} {
  try {
    const body = JSON.parse(rawBody.toString("utf-8"));
    // Schema 2.0: { header: { token, app_id }, event: ... }
    if (body.header) {
      return { token: body.header.token, appId: body.header.app_id, type: body.type };
    }
    // Schema 1.0 / URL verification: { token, type, ... }
    return { token: body.token, appId: body.event?.app_id, type: body.type };
  } catch {
    return {};
  }
}

/**
 * Create the shared request handler for a multi-account webhook server.
 * Routes requests by verification token or app_id to the correct account handler.
 */
function createSharedWebhookRequestHandler(shared: SharedWebhookServer) {
  return (req: http.IncomingMessage, res: http.ServerResponse) => {
    const log = shared.runtime?.log ?? console.log;
    const error = shared.runtime?.error ?? console.error;

    // Rate limit by remote address (shared across all accounts)
    const rateLimitKey = `shared:${req.socket.remoteAddress ?? "unknown"}`;
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

    // Read the full body to extract routing info, then delegate to the correct handler
    const chunks: Buffer[] = [];
    let bodySize = 0;
    let timedOut = false;

    const bodyTimeout = setTimeout(() => {
      timedOut = true;
      res.statusCode = 408;
      res.end("Request Timeout");
      req.destroy();
    }, FEISHU_WEBHOOK_BODY_TIMEOUT_MS);

    req.on("data", (chunk: Buffer) => {
      bodySize += chunk.length;
      if (bodySize > FEISHU_WEBHOOK_MAX_BODY_BYTES) {
        clearTimeout(bodyTimeout);
        res.statusCode = 413;
        res.end("Payload Too Large");
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });

    req.on("end", () => {
      clearTimeout(bodyTimeout);
      if (timedOut) return;

      const rawBody = Buffer.concat(chunks);
      const { token, appId, type } = parseWebhookRoutingInfo(rawBody);

      // Route by verification token first (most reliable)
      let handler = token ? shared.tokenHandlers.get(token) : undefined;
      // Fallback: route by app_id
      if (!handler && appId) {
        handler = shared.appIdHandlers.get(appId);
      }

      if (!handler) {
        // URL verification challenge: forward to first handler (all accounts
        // should respond identically for url_verification)
        if (type === "url_verification") {
          const firstHandler = shared.tokenHandlers.values().next().value;
          if (firstHandler) {
            handler = firstHandler;
          }
        }
      }

      if (!handler) {
        log(
          `feishu[shared]: no handler for token=${token ? token.slice(0, 8) + "..." : "none"} ` +
            `appId=${appId ?? "none"}, registered tokens=${shared.tokenHandlers.size}, ` +
            `appIds=${shared.appIdHandlers.size}`,
        );
        res.statusCode = 404;
        res.end("Not Found");
        return;
      }

      // Re-create a readable stream from the already-consumed body so the Lark SDK
      // handler can consume it normally via req.on("data")/req.on("end").
      const bodyStream = new Readable({ read() {} });
      bodyStream.push(rawBody);
      bodyStream.push(null);

      // Proxy: copy original request properties onto the new stream
      Object.assign(bodyStream, {
        method: req.method,
        url: req.url,
        headers: req.headers,
        httpVersion: req.httpVersion,
        socket: req.socket,
        connection: req.connection,
      });

      handler(bodyStream as unknown as http.IncomingMessage, res);
    });

    req.on("error", (err) => {
      clearTimeout(bodyTimeout);
      if (!timedOut) {
        error(`feishu[shared]: request body read error: ${String(err)}`);
        if (!res.headersSent) {
          res.statusCode = 400;
          res.end("Bad Request");
        }
      }
    });
  };
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
  const serverKey = `${host}:${port}`;

  const webhookHandler = Lark.adaptDefault(path, eventDispatcher, { autoChallenge: true });

  // Check if a shared server already exists on this host:port
  const existingShared = sharedWebhookServers.get(serverKey);
  if (existingShared) {
    // Register this account's handler on the existing shared server
    if (account.verificationToken?.trim()) {
      existingShared.tokenHandlers.set(account.verificationToken.trim(), webhookHandler);
    }
    if (account.appId?.trim()) {
      existingShared.appIdHandlers.set(account.appId.trim(), webhookHandler);
    }
    existingShared.accountIds.add(accountId);
    httpServers.set(accountId, existingShared.server);

    log(
      `feishu[${accountId}]: joined shared Webhook server on ${serverKey} ` +
        `(${existingShared.accountIds.size} accounts)`,
    );

    return new Promise<void>((resolve) => {
      const handleAbort = () => {
        log(`feishu[${accountId}]: abort signal received, leaving shared server`);
        existingShared.tokenHandlers.delete(account.verificationToken?.trim() ?? "");
        existingShared.appIdHandlers.delete(account.appId?.trim() ?? "");
        existingShared.accountIds.delete(accountId);
        httpServers.delete(accountId);
        botOpenIds.delete(accountId);
        // If no more accounts, close the shared server
        if (existingShared.accountIds.size === 0) {
          existingShared.server.close();
          sharedWebhookServers.delete(serverKey);
        }
        resolve();
      };

      if (abortSignal?.aborted) {
        handleAbort();
        return;
      }

      abortSignal?.addEventListener("abort", handleAbort, { once: true });
      existingShared.abortCleanups.push(handleAbort);
    });
  }

  // First account on this host:port — create the shared server
  log(`feishu[${accountId}]: creating Webhook server on ${serverKey}, path ${path}...`);

  const shared: SharedWebhookServer = {
    server: http.createServer(),
    tokenHandlers: new Map(),
    appIdHandlers: new Map(),
    accountIds: new Set([accountId]),
    runtime,
    abortCleanups: [],
  };

  if (account.verificationToken?.trim()) {
    shared.tokenHandlers.set(account.verificationToken.trim(), webhookHandler);
  }
  if (account.appId?.trim()) {
    shared.appIdHandlers.set(account.appId.trim(), webhookHandler);
  }

  shared.server.on("request", createSharedWebhookRequestHandler(shared));
  sharedWebhookServers.set(serverKey, shared);
  httpServers.set(accountId, shared.server);

  return new Promise((resolve, reject) => {
    const cleanup = () => {
      shared.server.close();
      sharedWebhookServers.delete(serverKey);
      for (const aid of shared.accountIds) {
        httpServers.delete(aid);
        botOpenIds.delete(aid);
      }
    };

    const handleAbort = () => {
      log(`feishu[${accountId}]: abort signal received, stopping shared Webhook server`);
      cleanup();
      resolve();
    };

    if (abortSignal?.aborted) {
      cleanup();
      resolve();
      return;
    }

    abortSignal?.addEventListener("abort", handleAbort, { once: true });
    shared.abortCleanups.push(handleAbort);

    shared.server.listen(port, host, () => {
      log(`feishu[${accountId}]: Webhook server listening on ${host}:${port}`);
    });

    shared.server.on("error", (err) => {
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

  // Start all accounts in parallel
  await Promise.all(
    accounts.map((account) =>
      monitorSingleAccount({
        cfg,
        account,
        runtime: opts.runtime,
        abortSignal: opts.abortSignal,
      }),
    ),
  );
}

/**
 * Stop monitoring for a specific account or all accounts.
 */
export function stopFeishuMonitor(accountId?: string): void {
  if (accountId) {
    wsClients.delete(accountId);
    // Remove from shared servers if applicable
    for (const [serverKey, shared] of sharedWebhookServers) {
      if (shared.accountIds.has(accountId)) {
        shared.accountIds.delete(accountId);
        if (shared.accountIds.size === 0) {
          shared.server.close();
          sharedWebhookServers.delete(serverKey);
        }
      }
    }
    const server = httpServers.get(accountId);
    if (server && !isSharedServer(server)) {
      server.close();
    }
    httpServers.delete(accountId);
    botOpenIds.delete(accountId);
  } else {
    wsClients.clear();
    // Close shared servers
    for (const shared of sharedWebhookServers.values()) {
      shared.server.close();
    }
    sharedWebhookServers.clear();
    // Close any remaining non-shared servers
    for (const server of httpServers.values()) {
      server.close();
    }
    httpServers.clear();
    botOpenIds.clear();
  }
}

function isSharedServer(server: http.Server): boolean {
  for (const shared of sharedWebhookServers.values()) {
    if (shared.server === server) return true;
  }
  return false;
}
