import { EventEmitter } from "node:events";
import { WebSocket } from "ws";
import type { StealthFingerprint } from "./stealth.js";

const GATEWAY_URL = "wss://gateway.discord.gg/?v=10&encoding=json";
const GATEWAY_CAPABILITIES = 16381;

const OP_DISPATCH = 0;
const OP_HEARTBEAT = 1;
const OP_IDENTIFY = 2;
const OP_RESUME = 6;
const OP_RECONNECT = 7;
const OP_INVALID_SESSION = 9;
const OP_HELLO = 10;
const OP_HEARTBEAT_ACK = 11;

const MAX_RECONNECT_ATTEMPTS = 50;
const BASE_RECONNECT_DELAY_MS = 1000;
const MAX_RECONNECT_DELAY_MS = 60_000;
const HELLO_TIMEOUT_MS = 30_000;

export type GatewayPayload = {
  op: number;
  d: unknown;
  s: number | null;
  t: string | null;
};

export type GatewayReadyData = {
  v: number;
  user: { id: string; username: string; discriminator: string };
  session_id: string;
  resume_gateway_url: string;
  guilds: Array<{ id: string; unavailable?: boolean }>;
};

export type DiscordUserGatewayEvents = {
  ready: [data: GatewayReadyData];
  dispatch: [event: string, data: unknown];
  close: [code: number, reason: string];
  error: [error: Error];
};

export class DiscordUserGateway extends EventEmitter<DiscordUserGatewayEvents> {
  private ws: WebSocket | null = null;
  private token: string;
  private fingerprint: StealthFingerprint;
  private heartbeatInterval: ReturnType<typeof setInterval> | null = null;
  private heartbeatTimer: ReturnType<typeof setTimeout> | null = null;
  private helloTimeout: ReturnType<typeof setTimeout> | null = null;
  private seq: number | null = null;
  private sessionId: string | null = null;
  private resumeGatewayUrl: string | null = null;
  private reconnectAttempts = 0;
  private closed = false;
  private lastHeartbeatAck = true;

  constructor(token: string, fingerprint: StealthFingerprint) {
    super();
    this.token = token;
    this.fingerprint = fingerprint;
  }

  connect(): void {
    if (this.closed) {
      return;
    }

    // Clean up any previous WebSocket before creating a new one
    if (this.ws) {
      try {
        this.ws.removeAllListeners();
        if (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING) {
          this.ws.close(1000, "reconnecting");
        }
      } catch {
        // ignore cleanup errors
      }
      this.ws = null;
    }

    const url = this.resumeGatewayUrl ?? GATEWAY_URL;
    this.ws = new WebSocket(url);

    this.helloTimeout = setTimeout(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.ws.close(4000, "HELLO timeout");
      }
    }, HELLO_TIMEOUT_MS);

    this.ws.on("open", () => {
      this.reconnectAttempts = 0;
    });

    this.ws.on("message", (raw) => {
      try {
        const payload = JSON.parse(
          Buffer.isBuffer(raw) ? raw.toString("utf8") : String(raw as unknown),
        ) as GatewayPayload;
        this.handlePayload(payload);
      } catch (err) {
        this.emit("error", err instanceof Error ? err : new Error(String(err)));
      }
    });

    this.ws.on("close", (code, reason) => {
      this.cleanup();
      const reasonStr = reason?.toString() ?? "";
      this.emit("close", code, reasonStr);

      if (!this.closed) {
        // Codes 4004 (auth failed), 4010 (invalid shard), 4011 (sharding required),
        // 4012 (invalid API version), 4013 (invalid intents), 4014 (disallowed intents)
        // are non-recoverable for bots but user accounts rarely see them.
        const nonRecoverable = [4004, 4010, 4011, 4012, 4013, 4014];
        if (nonRecoverable.includes(code)) {
          this.closed = true;
          return;
        }
        this.scheduleReconnect();
      }
    });

    this.ws.on("error", (err) => {
      this.emit("error", err instanceof Error ? err : new Error(String(err)));
    });
  }

  disconnect(): void {
    this.closed = true;
    this.cleanup();
    if (this.ws) {
      this.ws.close(1000, "normal close");
      this.ws = null;
    }
  }

  private handlePayload(payload: GatewayPayload): void {
    switch (payload.op) {
      case OP_DISPATCH:
        this.handleDispatch(payload);
        break;
      case OP_HEARTBEAT:
        this.sendHeartbeat();
        break;
      case OP_RECONNECT:
        this.ws?.close(4000, "reconnect requested");
        break;
      case OP_INVALID_SESSION: {
        const resumable = payload.d === true;
        if (!resumable) {
          this.sessionId = null;
          this.seq = null;
          this.resumeGatewayUrl = null;
        }
        setTimeout(
          () => {
            if (!this.closed) {
              this.ws?.close(4000, "invalid session");
            }
          },
          Math.floor(Math.random() * 4000) + 1000,
        );
        break;
      }
      case OP_HELLO: {
        if (this.helloTimeout) {
          clearTimeout(this.helloTimeout);
          this.helloTimeout = null;
        }
        const { heartbeat_interval } = payload.d as { heartbeat_interval: number };
        this.startHeartbeat(heartbeat_interval);
        if (this.sessionId && this.seq !== null) {
          this.sendResume();
        } else {
          this.sendIdentify();
        }
        break;
      }
      case OP_HEARTBEAT_ACK:
        this.lastHeartbeatAck = true;
        break;
    }
  }

  private handleDispatch(payload: GatewayPayload): void {
    if (payload.s !== null) {
      this.seq = payload.s;
    }

    const event = payload.t;
    if (!event) {
      return;
    }

    if (event === "READY") {
      const data = payload.d as GatewayReadyData;
      this.sessionId = data.session_id;
      this.resumeGatewayUrl = data.resume_gateway_url ?? null;
      this.emit("ready", data);
    }

    this.emit("dispatch", event, payload.d);
  }

  private sendIdentify(): void {
    const identify = {
      op: OP_IDENTIFY,
      d: {
        token: this.token,
        capabilities: GATEWAY_CAPABILITIES,
        properties: this.fingerprint.properties,
        presence: {
          status: "online",
          since: 0,
          activities: [],
          afk: false,
        },
        compress: false,
        client_state: {
          guild_versions: {},
          highest_last_message_id: "0",
          read_state_version: 0,
          user_guild_settings_version: -1,
          user_settings_version: -1,
          private_channels_version: "0",
        },
      },
    };
    this.send(identify);
  }

  private sendResume(): void {
    const resume = {
      op: OP_RESUME,
      d: {
        token: this.token,
        session_id: this.sessionId,
        seq: this.seq,
      },
    };
    this.send(resume);
  }

  private startHeartbeat(intervalMs: number): void {
    this.stopHeartbeat();
    this.lastHeartbeatAck = true;

    // First heartbeat after a random jitter
    const jitter = Math.floor(Math.random() * intervalMs);
    this.heartbeatTimer = setTimeout(() => {
      this.sendHeartbeat();
      this.heartbeatInterval = setInterval(() => {
        if (!this.lastHeartbeatAck) {
          // Zombie connection — reconnect
          this.ws?.close(4000, "heartbeat timeout");
          return;
        }
        this.sendHeartbeat();
      }, intervalMs);
    }, jitter);
  }

  private sendHeartbeat(): void {
    this.lastHeartbeatAck = false;
    this.send({ op: OP_HEARTBEAT, d: this.seq });
  }

  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
    if (this.heartbeatTimer) {
      clearTimeout(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
      this.closed = true;
      this.emit(
        "error",
        new Error(`Gave up reconnecting after ${MAX_RECONNECT_ATTEMPTS} attempts`),
      );
      return;
    }

    const delay = Math.min(
      BASE_RECONNECT_DELAY_MS * 2 ** this.reconnectAttempts + Math.random() * 1000,
      MAX_RECONNECT_DELAY_MS,
    );
    this.reconnectAttempts++;

    setTimeout(() => {
      if (!this.closed) {
        this.connect();
      }
    }, delay);
  }

  private send(data: unknown): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    }
  }

  private cleanup(): void {
    this.stopHeartbeat();
    if (this.helloTimeout) {
      clearTimeout(this.helloTimeout);
      this.helloTimeout = null;
    }
  }
}
