/**
 * Gateway WebSocket Connection Stress Test
 *
 * Tests the gateway's ability to handle many concurrent WebSocket connections.
 * Measures connection establishment time, stability, and resource usage.
 */

import { randomUUID } from "node:crypto";
import { WebSocket } from "ws";
import type { LoadTestConfig, LoadTestMetrics } from "./config.js";
import { aggregateErrors, mean, percentile } from "./config.js";

type ConnectionState = {
  id: string;
  ws: WebSocket | null;
  connected: boolean;
  connectStartMs: number;
  connectLatencyMs: number | null;
  error: string | null;
  requestLatencies: number[];
};

type RawError = {
  message: string;
  timestamp: number;
};

/**
 * Run the WebSocket connection stress test.
 */
export async function runConnectionsTest(config: LoadTestConfig): Promise<LoadTestMetrics> {
  const startTime = Date.now();
  const connections: ConnectionState[] = [];
  const errors: RawError[] = [];

  let connectionsAttempted = 0;
  let connectionsSucceeded = 0;
  let connectionsFailed = 0;
  let connectionsPeak = 0;
  let rateLimitHits = 0;
  let authFailures = 0;

  const log = config.verbose
    ? (msg: string) => console.log(`[${new Date().toISOString()}] ${msg}`)
    : () => {};

  log(`Starting connections test: ${config.concurrency} connections over ${config.rampUpSeconds}s`);

  // Calculate ramp-up delay between connections
  const rampUpDelayMs =
    config.rampUpSeconds > 0 ? (config.rampUpSeconds * 1000) / config.concurrency : 0;

  // Create connections with ramp-up
  for (let i = 0; i < config.concurrency; i++) {
    const conn = createConnection(config, i);
    connections.push(conn);
    connectionsAttempted++;

    conn.ws?.on("open", () => {
      conn.connectLatencyMs = Date.now() - conn.connectStartMs;
      log(`Connection ${i} opened in ${conn.connectLatencyMs}ms`);

      // Send connect request
      sendConnectRequest(conn, config)
        .then(() => {
          conn.connected = true;
          connectionsSucceeded++;
          const activeCount = connections.filter((c) => c.connected).length;
          connectionsPeak = Math.max(connectionsPeak, activeCount);
          log(`Connection ${i} authenticated (active: ${activeCount})`);
        })
        .catch((err) => {
          const errMsg = err instanceof Error ? err.message : String(err);
          conn.error = errMsg;
          connectionsFailed++;
          errors.push({ message: errMsg, timestamp: Date.now() });

          if (errMsg.includes("rate") || errMsg.includes("429")) {
            rateLimitHits++;
          }
          if (errMsg.includes("auth") || errMsg.includes("unauthorized")) {
            authFailures++;
          }

          log(`Connection ${i} auth failed: ${errMsg}`);
        });
    });

    conn.ws?.on("error", (err) => {
      const errMsg = err instanceof Error ? err.message : String(err);
      if (!conn.error) {
        conn.error = errMsg;
        connectionsFailed++;
        errors.push({ message: errMsg, timestamp: Date.now() });
      }
      log(`Connection ${i} error: ${errMsg}`);
    });

    conn.ws?.on("close", (code, reason) => {
      if (conn.connected) {
        conn.connected = false;
        log(`Connection ${i} closed: ${code} ${reason.toString()}`);
      }
    });

    if (rampUpDelayMs > 0 && i < config.concurrency - 1) {
      await sleep(rampUpDelayMs);
    }
  }

  // Wait for all connections to establish
  await sleep(3000);

  // Hold connections open for the test duration
  const holdDurationMs = config.durationSeconds * 1000 - (Date.now() - startTime);
  if (holdDurationMs > 0) {
    log(`Holding ${connectionsPeak} connections for ${(holdDurationMs / 1000).toFixed(1)}s`);

    // Periodically send ping requests to verify connections are alive
    const pingInterval = setInterval(() => {
      for (const conn of connections) {
        if (conn.connected && conn.ws?.readyState === WebSocket.OPEN) {
          const pingStart = Date.now();
          sendPingRequest(conn)
            .then(() => {
              conn.requestLatencies.push(Date.now() - pingStart);
            })
            .catch(() => {
              // Connection may have dropped
            });
        }
      }
    }, 5000);

    await sleep(holdDurationMs);
    clearInterval(pingInterval);
  }

  // Close all connections
  log("Closing connections...");
  for (const conn of connections) {
    conn.ws?.close();
  }

  const endTime = Date.now();

  // Calculate latency metrics
  const connectLatencies = connections
    .map((c) => c.connectLatencyMs)
    .filter((l): l is number => l !== null)
    .sort((a, b) => a - b);

  const allRequestLatencies = connections
    .flatMap((c) => c.requestLatencies)
    .sort((a, b) => a - b);

  const metrics: LoadTestMetrics = {
    scenario: "connections",
    startTime,
    endTime,
    durationMs: endTime - startTime,

    connectionsAttempted,
    connectionsSucceeded,
    connectionsFailed,
    connectionsPeak,

    requestsTotal: allRequestLatencies.length,
    requestsSucceeded: allRequestLatencies.length,
    requestsFailed: 0,
    requestsTimedOut: 0,

    latencyP50: percentile(connectLatencies, 50),
    latencyP95: percentile(connectLatencies, 95),
    latencyP99: percentile(connectLatencies, 99),
    latencyMin: connectLatencies[0] ?? 0,
    latencyMax: connectLatencies[connectLatencies.length - 1] ?? 0,
    latencyMean: mean(connectLatencies),

    rateLimitHits,
    authFailures,
    errors: aggregateErrors(errors),
  };

  return metrics;
}

function createConnection(config: LoadTestConfig, _index: number): ConnectionState {
  const id = randomUUID();
  const ws = new WebSocket(config.gatewayUrl, {
    maxPayload: 10 * 1024 * 1024,
  });

  return {
    id,
    ws,
    connected: false,
    connectStartMs: Date.now(),
    connectLatencyMs: null,
    error: null,
    requestLatencies: [],
  };
}

async function sendConnectRequest(conn: ConnectionState, config: LoadTestConfig): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!conn.ws || conn.ws.readyState !== WebSocket.OPEN) {
      reject(new Error("WebSocket not open"));
      return;
    }

    const requestId = randomUUID();
    const timeout = setTimeout(() => {
      conn.ws?.off("message", handler);
      reject(new Error("Connect request timed out"));
    }, 10000);

    const handler = (data: Buffer) => {
      try {
        const msg = JSON.parse(data.toString());
        if (msg.type === "res" && msg.id === requestId) {
          clearTimeout(timeout);
          conn.ws?.off("message", handler);
          if (msg.ok) {
            resolve();
          } else {
            reject(new Error(msg.error?.message ?? "Connect failed"));
          }
        }
      } catch {
        // Ignore parse errors
      }
    };

    conn.ws.on("message", handler);

    conn.ws.send(
      JSON.stringify({
        type: "req",
        id: requestId,
        method: "connect",
        params: {
          minProtocol: 1,
          maxProtocol: 1,
          client: {
            id: "load-test",
            version: "1.0.0",
            platform: "test",
            mode: "test",
            instanceId: conn.id,
          },
          caps: [],
          role: "operator",
          auth: config.token ? { token: config.token } : undefined,
        },
      }),
    );
  });
}

async function sendPingRequest(conn: ConnectionState): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!conn.ws || conn.ws.readyState !== WebSocket.OPEN) {
      reject(new Error("WebSocket not open"));
      return;
    }

    const requestId = randomUUID();
    const timeout = setTimeout(() => {
      conn.ws?.off("message", handler);
      reject(new Error("Ping request timed out"));
    }, 5000);

    const handler = (data: Buffer) => {
      try {
        const msg = JSON.parse(data.toString());
        if (msg.type === "res" && msg.id === requestId) {
          clearTimeout(timeout);
          conn.ws?.off("message", handler);
          if (msg.ok) {
            resolve();
          } else {
            reject(new Error(msg.error?.message ?? "Ping failed"));
          }
        }
      } catch {
        // Ignore parse errors
      }
    };

    conn.ws.on("message", handler);

    conn.ws.send(
      JSON.stringify({
        type: "req",
        id: requestId,
        method: "ping",
        params: {},
      }),
    );
  });
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
