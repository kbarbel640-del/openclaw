import { randomUUID } from "node:crypto";
import { DEFAULT_GATEWAY_PORT, loadConfig, resolveGatewayPort } from "../config/config.js";
import { GatewayClient } from "../gateway/client.js";
import {
  type HelloOk,
  PROTOCOL_VERSION,
  type SessionsListParams,
  type SessionsPatchParams,
} from "../gateway/protocol/index.js";
import { resolveGatewayPassword, resolveGatewayToken } from "../gateway/token-resolution.js";
import { GATEWAY_CLIENT_MODES, GATEWAY_CLIENT_NAMES } from "../utils/message-channel.js";
import { VERSION } from "../version.js";

// Dev gateway port - kept module-local to avoid drift with paths.ts
const DEV_GATEWAY_PORT = 19001;

export type GatewayConnectionOptions = {
  url?: string;
  token?: string;
  password?: string;
};

/** Resolved gateway connection with metadata for fallback logic */
export type ResolvedGatewayConnection = {
  url: string;
  token?: string;
  password?: string;
  /** True if user explicitly provided URL via CLI, env, or config remote.url */
  isExplicitUrl: boolean;
};

/** Result of connection attempt with fallback metadata */
export type ConnectionResult = {
  client: GatewayChatClient;
  url: string;
  didFallback: boolean;
  fallbackFromUrl?: string;
};

// ─────────────────────────────────────────────────────────────────────────────
// URL parsing utilities
// ─────────────────────────────────────────────────────────────────────────────

/** Parse a gateway URL into host and port components */
export function parseGatewayUrl(url: string): { host: string; port: number } | null {
  try {
    const parsed = new URL(url);
    const defaultPort = parsed.protocol === "wss:" ? 443 : 80;
    const port = parsed.port ? parseInt(parsed.port, 10) : defaultPort;
    return { host: parsed.hostname, port };
  } catch {
    return null;
  }
}

/** Check if a host is a loopback address (127.0.0.1, localhost, ::1, [::1]) */
export function isLoopbackHost(host: string): boolean {
  const normalized = host.toLowerCase().replace(/^\[|\]$/g, ""); // strip IPv6 brackets
  return normalized === "127.0.0.1" || normalized === "localhost" || normalized === "::1";
}

export type ChatSendOptions = {
  sessionKey: string;
  message: string;
  thinking?: string;
  deliver?: boolean;
  timeoutMs?: number;
};

export type GatewayEvent = {
  event: string;
  payload?: unknown;
  seq?: number;
};

export type GatewaySessionList = {
  ts: number;
  path: string;
  count: number;
  defaults?: {
    model?: string | null;
    modelProvider?: string | null;
    contextTokens?: number | null;
  };
  sessions: Array<{
    key: string;
    sessionId?: string;
    updatedAt?: number | null;
    thinkingLevel?: string;
    verboseLevel?: string;
    reasoningLevel?: string;
    sendPolicy?: string;
    model?: string;
    contextTokens?: number | null;
    inputTokens?: number | null;
    outputTokens?: number | null;
    totalTokens?: number | null;
    responseUsage?: "on" | "off" | "tokens" | "full";
    modelProvider?: string;
    label?: string;
    displayName?: string;
    provider?: string;
    groupChannel?: string;
    space?: string;
    subject?: string;
    chatType?: string;
    lastProvider?: string;
    lastTo?: string;
    lastAccountId?: string;
    derivedTitle?: string;
    lastMessagePreview?: string;
  }>;
};

export type GatewayAgentsList = {
  defaultId: string;
  mainKey: string;
  scope: "per-sender" | "global";
  agents: Array<{
    id: string;
    name?: string;
  }>;
};

export type GatewayModelChoice = {
  id: string;
  name: string;
  provider: string;
  contextWindow?: number;
  reasoning?: boolean;
};

export class GatewayChatClient {
  private client: GatewayClient;
  private readyPromise: Promise<void>;
  private resolveReady?: () => void;
  readonly connection: { url: string; token?: string; password?: string };
  hello?: HelloOk;

  onEvent?: (evt: GatewayEvent) => void;
  onConnected?: () => void;
  onDisconnected?: (reason: string) => void;
  onGap?: (info: { expected: number; received: number }) => void;

  constructor(opts: GatewayConnectionOptions) {
    const resolved = resolveGatewayConnection(opts);
    this.connection = resolved;

    this.readyPromise = new Promise((resolve) => {
      this.resolveReady = resolve;
    });

    this.client = new GatewayClient({
      url: resolved.url,
      token: resolved.token,
      password: resolved.password,
      clientName: GATEWAY_CLIENT_NAMES.GATEWAY_CLIENT,
      clientDisplayName: "moltbot-tui",
      clientVersion: VERSION,
      platform: process.platform,
      mode: GATEWAY_CLIENT_MODES.UI,
      instanceId: randomUUID(),
      minProtocol: PROTOCOL_VERSION,
      maxProtocol: PROTOCOL_VERSION,
      onHelloOk: (hello) => {
        this.hello = hello;
        this.resolveReady?.();
        this.onConnected?.();
      },
      onEvent: (evt) => {
        this.onEvent?.({
          event: evt.event,
          payload: evt.payload,
          seq: evt.seq,
        });
      },
      onClose: (_code, reason) => {
        this.onDisconnected?.(reason);
      },
      onGap: (info) => {
        this.onGap?.(info);
      },
    });
  }

  start() {
    this.client.start();
  }

  stop() {
    this.client.stop();
  }

  async waitForReady() {
    await this.readyPromise;
  }

  async sendChat(opts: ChatSendOptions): Promise<{ runId: string }> {
    const runId = randomUUID();
    await this.client.request("chat.send", {
      sessionKey: opts.sessionKey,
      message: opts.message,
      thinking: opts.thinking,
      deliver: opts.deliver,
      timeoutMs: opts.timeoutMs,
      idempotencyKey: runId,
    });
    return { runId };
  }

  async abortChat(opts: { sessionKey: string; runId: string }) {
    return await this.client.request<{ ok: boolean; aborted: boolean }>("chat.abort", {
      sessionKey: opts.sessionKey,
      runId: opts.runId,
    });
  }

  async loadHistory(opts: { sessionKey: string; limit?: number }) {
    return await this.client.request("chat.history", {
      sessionKey: opts.sessionKey,
      limit: opts.limit,
    });
  }

  async listSessions(opts?: SessionsListParams) {
    return await this.client.request<GatewaySessionList>("sessions.list", {
      limit: opts?.limit,
      activeMinutes: opts?.activeMinutes,
      includeGlobal: opts?.includeGlobal,
      includeUnknown: opts?.includeUnknown,
      includeDerivedTitles: opts?.includeDerivedTitles,
      includeLastMessage: opts?.includeLastMessage,
      agentId: opts?.agentId,
    });
  }

  async listAgents() {
    return await this.client.request<GatewayAgentsList>("agents.list", {});
  }

  async patchSession(opts: SessionsPatchParams) {
    return await this.client.request("sessions.patch", opts);
  }

  async resetSession(key: string) {
    return await this.client.request("sessions.reset", { key });
  }

  async getStatus() {
    return await this.client.request("status");
  }

  async listModels(): Promise<GatewayModelChoice[]> {
    const res = await this.client.request<{ models?: GatewayModelChoice[] }>("models.list");
    return Array.isArray(res?.models) ? res.models : [];
  }
}

/**
 * Resolve gateway connection parameters with proper precedence.
 *
 * URL precedence:
 *   1. opts.url (CLI --url or --gateway)
 *   2. CLAWDBOT_GATEWAY_URL env var
 *   3. MOLTBOT_GATEWAY_URL env var (backward compat)
 *   4. CLAWDBOT_GATEWAY_PORT env var (port-only override for local URL)
 *   5. config gateway.remote.url (when in remote mode)
 *   6. config gateway.port (local mode default port)
 *   7. Default: ws://127.0.0.1:18789
 */
export function resolveGatewayConnection(
  opts: GatewayConnectionOptions,
  env: NodeJS.ProcessEnv = process.env,
): ResolvedGatewayConnection {
  const config = loadConfig();
  const isRemoteMode = config.gateway?.mode === "remote";
  const remote = isRemoteMode ? config.gateway?.remote : undefined;
  const authToken = config.gateway?.auth?.token;

  // Extract sources in precedence order
  const cliUrl = opts.url?.trim() || undefined;
  const envUrl = env.CLAWDBOT_GATEWAY_URL?.trim() || env.MOLTBOT_GATEWAY_URL?.trim() || undefined;
  const envPort = env.CLAWDBOT_GATEWAY_PORT?.trim() || undefined;
  const remoteUrl = remote?.url?.trim() || undefined;

  // Determine URL and whether it's explicit (user-provided)
  let url: string;
  let isExplicitUrl: boolean;

  if (cliUrl) {
    // 1. CLI url takes highest priority
    url = cliUrl;
    isExplicitUrl = true;
  } else if (envUrl) {
    // 2. Env URL (CLAWDBOT_GATEWAY_URL or MOLTBOT_GATEWAY_URL)
    url = envUrl;
    isExplicitUrl = true;
  } else if (envPort) {
    // 3. Env port builds local URL (explicit because user set the port)
    const port = parseInt(envPort, 10);
    url = `ws://127.0.0.1:${Number.isNaN(port) || port <= 0 ? DEFAULT_GATEWAY_PORT : port}`;
    isExplicitUrl = true;
  } else if (remoteUrl) {
    // 4. Config remote.url (when in remote mode)
    url = remoteUrl;
    isExplicitUrl = true;
  } else {
    // 5-7. Default local URL using config port or default
    const localPort = resolveGatewayPort(config, env);
    url = `ws://127.0.0.1:${localPort}`;
    isExplicitUrl = false;
  }

  // Use shared token resolution with precedence: CLI > config > env
  // For remote mode, remote.token acts as the config token
  const { token } = resolveGatewayToken({
    cliToken: opts.token,
    configToken: isRemoteMode ? remote?.token : authToken,
    env,
  });

  // Use shared password resolution with precedence: CLI > config > env
  const authPassword = config.gateway?.auth?.password;
  const { password } = resolveGatewayPassword({
    cliPassword: opts.password,
    configPassword: isRemoteMode ? remote?.password : authPassword,
    env,
  });

  return { url, token, password, isExplicitUrl };
}

// ─────────────────────────────────────────────────────────────────────────────
// Connection with fallback
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Mockable connection function - tests can spy/mock this.
 * Creates a GatewayChatClient and waits for connection or timeout.
 */
export async function dialGateway(
  url: string,
  opts: Omit<GatewayConnectionOptions, "url">,
  timeoutMs = 5000,
): Promise<GatewayChatClient> {
  const client = new GatewayChatClient({ ...opts, url });
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      client.stop();
      reject(new Error(`Connection timeout after ${timeoutMs}ms`));
    }, timeoutMs);

    client.onConnected = () => {
      clearTimeout(timeout);
      resolve(client);
    };
    client.onDisconnected = (reason) => {
      clearTimeout(timeout);
      reject(new Error(reason || "Connection closed"));
    };
    client.start();
  });
}

/**
 * Connect to gateway with intelligent fallback.
 *
 * Fallback from 18789 → 19001 triggers ONLY when:
 *   1. No explicit URL (CLI, env URL, or config remote.url)
 *   2. Target is loopback address (127.0.0.1, localhost, ::1)
 *   3. Target port is DEFAULT_GATEWAY_PORT (18789)
 */
export async function connectWithFallback(
  opts: GatewayConnectionOptions,
  dial: typeof dialGateway = dialGateway,
  env: NodeJS.ProcessEnv = process.env,
): Promise<ConnectionResult> {
  const resolved = resolveGatewayConnection(opts, env);
  const parsed = parseGatewayUrl(resolved.url);

  // Determine if fallback is eligible: implicit default loopback URL on default port
  const fallbackEligible =
    !resolved.isExplicitUrl &&
    parsed !== null &&
    isLoopbackHost(parsed.host) &&
    parsed.port === DEFAULT_GATEWAY_PORT;

  // Extract only token/password for dial calls (not url or isExplicitUrl)
  const dialOpts = { token: resolved.token, password: resolved.password };

  try {
    const client = await dial(resolved.url, dialOpts);
    return { client, url: resolved.url, didFallback: false };
  } catch (primaryError) {
    if (!fallbackEligible) throw primaryError;

    // Try dev port fallback
    const devUrl = `ws://127.0.0.1:${DEV_GATEWAY_PORT}`;
    try {
      const client = await dial(devUrl, dialOpts);
      return {
        client,
        url: devUrl,
        didFallback: true,
        fallbackFromUrl: resolved.url,
      };
    } catch {
      // Fallback also failed - throw original error
      throw primaryError;
    }
  }
}
