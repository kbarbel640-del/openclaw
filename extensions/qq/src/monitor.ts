import WebSocket from "ws";
import type { QQBotConfig, QQC2CMessageEvent, QQGroupMessageEvent, QQInboundMessage } from "./types.js";
import { getQQAccessToken } from "./token.js";

export type QQMessageHandler = (msg: QQInboundMessage) => Promise<void>;

export type MonitorQQOptions = {
  config: QQBotConfig;
  accountId: string;
  onMessage: QQMessageHandler;
  abortSignal?: AbortSignal;
  log?: { info?: (msg: string) => void; error?: (msg: string) => void; debug?: (msg: string) => void };
};

const BACKOFF_INITIAL_MS = 5_000;
const BACKOFF_MAX_MS = 5 * 60_000;
const BACKOFF_FACTOR = 2;

// QQ WebSocket intents: GROUP_AT_MESSAGE_CREATE (1<<25) + C2C_MESSAGE_CREATE (1<<9)
const INTENTS = (1 << 25) | (1 << 9);

async function getGatewayUrl(config: QQBotConfig): Promise<string> {
  const token = await getQQAccessToken(config.appId, config.clientSecret);
  const res = await fetch("https://api.sgroup.qq.com/gateway/bot", {
    headers: { Authorization: `QQBot ${token}` },
  });
  if (!res.ok) throw new Error(`gateway/bot returned ${res.status}`);
  const data = await res.json() as { url: string };
  if (!data.url) throw new Error("gateway/bot: missing url");
  return data.url;
}

export async function monitorQQProvider(opts: MonitorQQOptions): Promise<void> {
  const { config, accountId, onMessage, abortSignal, log } = opts;

  let stopped = false;
  let reconnectDelay = BACKOFF_INITIAL_MS;

  abortSignal?.addEventListener("abort", () => { stopped = true; }, { once: true });

  while (!stopped) {
    try {
      await runWebSocketSession({ config, accountId, onMessage, log, abortSignal,
        onConnected: () => { reconnectDelay = BACKOFF_INITIAL_MS; },
      });
    } catch (err) {
      if (stopped) break;
      log?.error?.(`[${accountId}] WS session error: ${String(err)}, retrying in ${reconnectDelay / 1000}s`);
    }

    if (stopped) break;

    await sleep(reconnectDelay, abortSignal);
    reconnectDelay = Math.min(reconnectDelay * BACKOFF_FACTOR, BACKOFF_MAX_MS);
  }
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener("abort", () => { clearTimeout(timer); resolve(); }, { once: true });
  });
}

async function runWebSocketSession(opts: {
  config: QQBotConfig;
  accountId: string;
  onMessage: QQMessageHandler;
  log?: MonitorQQOptions["log"];
  abortSignal?: AbortSignal;
  onConnected: () => void;
}): Promise<void> {
  const { config, accountId, onMessage, log, abortSignal, onConnected } = opts;

  const gatewayUrl = await getGatewayUrl(config);
  log?.info?.(`[${accountId}] connecting to QQ WebSocket: ${gatewayUrl}`);

  return new Promise<void>((resolve, reject) => {
    const ws = new WebSocket(gatewayUrl);
    let heartbeatTimer: ReturnType<typeof setInterval> | null = null;
    let seq: number | null = null;
    let identified = false;

    const cleanup = () => {
      if (heartbeatTimer) { clearInterval(heartbeatTimer); heartbeatTimer = null; }
    };

    const close = (err?: Error) => {
      cleanup();
      ws.terminate();
      if (err) reject(err);
      else resolve();
    };

    abortSignal?.addEventListener("abort", () => close(), { once: true });

    ws.on("open", () => {
      log?.info?.(`[${accountId}] QQ WebSocket connected`);
    });

    ws.on("message", async (raw: Buffer) => {
      let payload: { op: number; t?: string; d?: unknown; s?: number };
      try { payload = JSON.parse(raw.toString()); } catch { return; }

      const { op, t, d, s } = payload;
      if (s != null) seq = s;

      // op=10: Hello — start heartbeat + identify
      if (op === 10) {
        const hello = d as { heartbeat_interval: number };
        heartbeatTimer = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ op: 1, d: seq }));
          }
        }, hello.heartbeat_interval);

        if (!identified) {
          identified = true;
          const token = await getQQAccessToken(config.appId, config.clientSecret).catch((err) => {
            log?.error?.(`[${accountId}] failed to get access token: ${String(err)}`);
            ws.close(1008, "token_fetch_failed");
            return null;
          });
          if (!token) return;
          ws.send(JSON.stringify({
            op: 2,
            d: {
              token: `QQBot ${token}`,
              intents: INTENTS,
              shard: [0, 1],
              properties: { os: "linux", browser: "openclaw-qq", device: "openclaw-qq" },
            },
          }));
        }
        return;
      }

      // op=11: Heartbeat ACK
      if (op === 11) return;

      // op=7: Reconnect / op=9: Invalid session
      if (op === 7 || op === 9) {
        log?.info?.(`[${accountId}] received op=${op}, reconnecting`);
        close();
        return;
      }

      // op=0: Dispatch
      if (op === 0) {
        if (t === "READY") {
          const ready = d as { user?: { username?: string } };
          log?.info?.(`[${accountId}] READY, bot: ${ready.user?.username ?? "unknown"}`);
          onConnected();
          return;
        }
        if (t === "C2C_MESSAGE_CREATE" || t === "GROUP_AT_MESSAGE_CREATE") {
          handleDispatchEvent({ eventType: t, data: d, accountId, onMessage, log })
            .catch((err) => log?.error?.(`[${accountId}] dispatch error: ${String(err)}`));
        }
      }
    });

    ws.on("close", (code) => {
      log?.info?.(`[${accountId}] WS closed (code=${code})`);
      cleanup();
      resolve();
    });

    ws.on("error", (err) => {
      log?.error?.(`[${accountId}] WS error: ${err.message}`);
      close(err);
    });
  });
}

async function handleDispatchEvent(params: {
  eventType: string;
  data: unknown;
  accountId: string;
  onMessage: QQMessageHandler;
  log?: MonitorQQOptions["log"];
}): Promise<void> {
  const { eventType, data, onMessage } = params;

  if (eventType === "C2C_MESSAGE_CREATE") {
    const d = data as QQC2CMessageEvent;
    const msg: QQInboundMessage = {
      chatType: "c2c",
      openid: d.author.user_openid ?? d.author.id,
      senderOpenid: d.author.user_openid ?? d.author.id,
      content: d.content?.trim() ?? "",
      msgId: d.id,
      timestamp: d.timestamp,
      attachments: d.attachments,
    };
    await onMessage(msg);
    return;
  }

  if (eventType === "GROUP_AT_MESSAGE_CREATE") {
    const d = data as QQGroupMessageEvent;
    const msg: QQInboundMessage = {
      chatType: "group",
      openid: d.group_openid,
      senderOpenid: d.author.member_openid ?? d.author.id,
      content: d.content?.trim() ?? "",
      msgId: d.id,
      timestamp: d.timestamp,
      attachments: d.attachments,
    };
    await onMessage(msg);
    return;
  }
}
