/**
 * Event Store — NATS JetStream integration for OpenClaw
 * Publishes agent events for audit, replay, and multi-agent sharing.
 *
 * The `nats` package is an optional peer dependency. When not installed,
 * initEventStore() logs a warning and returns without error so CI/builds
 * that don't need event-store still pass type-checking.
 */

import { randomUUID } from "node:crypto";
import type { AgentEventPayload } from "./agent-events.js";
import { onAgentEvent } from "./agent-events.js";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type EventStoreConfig = {
  enabled: boolean;
  natsUrl: string;
  streamName: string;
  subjectPrefix: string;
  retention?: {
    maxMessages?: number;
    maxBytes?: number;
    maxAgeHours?: number;
  };
};

export type EventType =
  | "msg.in"
  | "msg.out"
  | "tool.call"
  | "tool.result"
  | "run.start"
  | "run.end"
  | "run.error";

export type ClawEvent = {
  id: string;
  ts: number;
  agent: string;
  session: string;
  type: EventType;
  payload: AgentEventPayload;
};

// ─────────────────────────────────────────────────────────────────────────────
// Lazy NATS import (optional peer dependency)
// ─────────────────────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type NatsModule = any;
let natsModule: NatsModule | null = null;

async function loadNats(): Promise<NatsModule | null> {
  if (natsModule) {
    return natsModule;
  }
  try {
    natsModule = await import("nats");
    return natsModule;
  } catch {
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// State (encapsulated — use resetForTest() in tests)
// ─────────────────────────────────────────────────────────────────────────────

type State = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  nc: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  js: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  sc: any;
  config: EventStoreConfig;
  unsub: () => void;
};

let state: State | null = null;

/** Counters tracked separately to avoid TS narrowing issues in async closures */
const counters = { disconnects: 0, publishFailures: 0 };

/** Maximum consecutive publish failures before logging a warning */
const MAX_PUBLISH_FAILURES_BEFORE_WARN = 10;

/** Maximum consecutive disconnects before logging a critical warning */
const MAX_DISCONNECTS_BEFORE_WARN = 5;

/** Drain timeout in milliseconds for graceful shutdown */
const DRAIN_TIMEOUT_MS = 5_000;

// ─────────────────────────────────────────────────────────────────────────────
// Helpers (minimal)
// ─────────────────────────────────────────────────────────────────────────────

const EVENT_TYPE_MAP: Record<string, EventType> = {
  user: "msg.in",
  assistant: "msg.out",
  error: "run.error",
};

/** Map event stream + payload data to the concrete event type. */
export function toEventType(stream: string, data: Record<string, unknown>): EventType {
  if (stream === "tool") {
    return "result" in data || "output" in data ? "tool.result" : "tool.call";
  }
  if (stream === "lifecycle") {
    const phase = data?.phase;
    if (phase === "end") {
      return "run.end";
    }
    if (phase === "error") {
      return "run.error";
    }
    return "run.start";
  }
  return EVENT_TYPE_MAP[stream] ?? "msg.out";
}

export function getAgent(sessionKey?: string): string {
  if (!sessionKey || sessionKey === "main") {
    return "main";
  }
  return sessionKey.split(":")[0] ?? "unknown";
}

function log(msg: string, err?: unknown): void {
  const prefix = "[event-store]";
  if (err) {
    console.error(prefix, msg, err);
  } else {
    console.log(prefix, msg);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Core
// ─────────────────────────────────────────────────────────────────────────────

async function publish(evt: AgentEventPayload): Promise<void> {
  if (!state) {
    return;
  }

  const event: ClawEvent = {
    id: randomUUID(),
    ts: evt.ts,
    agent: getAgent(evt.sessionKey),
    session: evt.sessionKey ?? "unknown",
    type: toEventType(evt.stream, evt.data),
    payload: evt,
  };

  const subject = `${state.config.subjectPrefix}.${event.agent}.${event.type.replace(".", "_")}`;
  try {
    await state.js.publish(subject, state.sc.encode(JSON.stringify(event)));
    counters.publishFailures = 0;
  } catch (err) {
    counters.publishFailures++;
    if (
      counters.publishFailures === 1 ||
      counters.publishFailures % MAX_PUBLISH_FAILURES_BEFORE_WARN === 0
    ) {
      log(`Publish failed (${counters.publishFailures} consecutive failures)`, err);
    }
    throw err;
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function ensureStream(nc: any, cfg: EventStoreConfig, nats: NatsModule): Promise<void> {
  const jsm = await nc.jetstreamManager();
  try {
    await jsm.streams.info(cfg.streamName);
  } catch {
    await jsm.streams.add({
      name: cfg.streamName,
      subjects: [`${cfg.subjectPrefix}.>`],
      retention: nats.RetentionPolicy.Limits,
      storage: nats.StorageType.File,
      max_age: cfg.retention?.maxAgeHours ? cfg.retention.maxAgeHours * 3_600_000_000_000 : 0,
      max_msgs: cfg.retention?.maxMessages ?? -1,
      max_bytes: cfg.retention?.maxBytes ?? -1,
      num_replicas: 1,
    });
    log(`Created stream: ${cfg.streamName}`);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────

export async function initEventStore(config: EventStoreConfig): Promise<void> {
  if (!config.enabled) {
    log("Disabled");
    return;
  }

  if (state) {
    log("Already initialized");
    return;
  }

  const nats = await loadNats();
  if (!nats) {
    log("nats package not installed — event store disabled (install with: pnpm add nats)");
    return;
  }

  try {
    // Parse URL
    const url = config.natsUrl.startsWith("nats://") ? new URL(config.natsUrl) : null;

    const nc = await nats.connect({
      servers: url ? `${url.hostname}:${url.port || 4222}` : config.natsUrl,
      user: url?.username ? decodeURIComponent(url.username) : undefined,
      pass: url?.password ? decodeURIComponent(url.password) : undefined,
      reconnect: true,
      maxReconnectAttempts: -1,
      timeout: 5_000,
    });

    // Log without credentials
    const safeUrl = url ? `${url.protocol}//${url.hostname}:${url.port || 4222}` : config.natsUrl;
    log(`Connected to ${safeUrl}`);

    // Reconnection handler with disconnect tracking
    (async () => {
      for await (const s of nc.status()) {
        if (!state) {
          break;
        }
        if (s.type === "reconnect") {
          counters.disconnects = 0;
          log("Reconnected");
        } else if (s.type === "disconnect") {
          counters.disconnects++;
          if (counters.disconnects <= MAX_DISCONNECTS_BEFORE_WARN) {
            log(`Disconnected (attempt ${counters.disconnects}), reconnecting...`);
          } else if (counters.disconnects % MAX_DISCONNECTS_BEFORE_WARN === 0) {
            log(
              `Persistent disconnect — ${counters.disconnects} consecutive failures, still reconnecting...`,
            );
          }
        }
      }
    })().catch((err: unknown) => {
      log("Status monitor exited unexpectedly", err);
    });

    const js = nc.jetstream();
    const sc = nats.StringCodec();
    await ensureStream(nc, config, nats);

    const unsub = onAgentEvent((evt: AgentEventPayload) => {
      publish(evt).catch(() => {
        // Error already logged inside publish() with failure count tracking
      });
    });

    counters.disconnects = 0;
    counters.publishFailures = 0;
    state = { nc, js, sc, config, unsub };
    log("Ready");
  } catch (err) {
    log("Init failed", err);
  }
}

export async function shutdownEventStore(): Promise<void> {
  if (!state) {
    return;
  }
  state.unsub();

  // Drain with timeout to avoid hanging on shutdown
  try {
    await Promise.race([
      state.nc.drain(),
      new Promise<void>((_, reject) =>
        setTimeout(() => reject(new Error("Drain timeout")), DRAIN_TIMEOUT_MS),
      ),
    ]);
  } catch (err) {
    log("Drain timed out, forcing close", err);
    try {
      await state.nc.close();
    } catch {
      // Best-effort close
    }
  }

  state = null;
  log("Shutdown");
}

export function isEventStoreConnected(): boolean {
  return state !== null && !state.nc.isClosed();
}

export function getEventStoreStatus(): {
  connected: boolean;
  stream: string | null;
  disconnectCount: number;
  publishFailures: number;
} {
  return {
    connected: isEventStoreConnected(),
    stream: state?.config.streamName ?? null,
    disconnectCount: counters.disconnects,
    publishFailures: counters.publishFailures,
  };
}

/**
 * Reset internal state for testing. Do not use in production.
 * This allows tests to start clean without module reload tricks.
 */
export function resetForTest(): void {
  if (state) {
    state.unsub();
  }
  state = null;
  counters.disconnects = 0;
  counters.publishFailures = 0;
}
