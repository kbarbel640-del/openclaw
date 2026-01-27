/**
 * Gateway Chat Message Throughput Test
 *
 * Tests the gateway's ability to handle sustained message throughput.
 * Measures message processing latency and throughput under load.
 */

import { randomUUID } from "node:crypto";
import { WebSocket } from "ws";
import type { LoadTestConfig, LoadTestMetrics } from "./config.js";
import { aggregateErrors, mean, percentile } from "./config.js";

type VirtualUser = {
  id: string;
  ws: WebSocket | null;
  connected: boolean;
  requestsTotal: number;
  requestsSucceeded: number;
  requestsFailed: number;
  requestsTimedOut: number;
  latencies: number[];
  errors: Array<{ message: string; timestamp: number }>;
};

/**
 * Run the chat message throughput test.
 */
export async function runChatTest(config: LoadTestConfig): Promise<LoadTestMetrics> {
  const startTime = Date.now();
  const users: VirtualUser[] = [];
  let rateLimitHits = 0;
  let authFailures = 0;

  const log = config.verbose
    ? (msg: string) => console.log(`[${new Date().toISOString()}] ${msg}`)
    : () => {};

  log(`Starting chat test: ${config.concurrency} users, ${config.rpsPerUser} rps/user`);

  // Create and connect virtual users
  const rampUpDelayMs =
    config.rampUpSeconds > 0 ? (config.rampUpSeconds * 1000) / config.concurrency : 0;

  for (let i = 0; i < config.concurrency; i++) {
    const user = await createAndConnectUser(config, i, log);
    users.push(user);

    if (user.connected) {
      log(`User ${i} connected`);
    } else {
      log(`User ${i} failed to connect`);
      for (const err of user.errors) {
        if (err.message.includes("rate") || err.message.includes("429")) {
          rateLimitHits++;
        }
        if (err.message.includes("auth") || err.message.includes("unauthorized")) {
          authFailures++;
        }
      }
    }

    if (rampUpDelayMs > 0 && i < config.concurrency - 1) {
      await sleep(rampUpDelayMs);
    }
  }

  const connectedUsers = users.filter((u) => u.connected);
  log(`${connectedUsers.length}/${config.concurrency} users connected, starting message load`);

  // Start sending messages at the configured rate
  const testDurationMs = config.durationSeconds * 1000;
  const intervalMs = 1000 / config.rpsPerUser;
  const endTime = startTime + testDurationMs + (config.rampUpSeconds * 1000);

  const messageLoops = connectedUsers.map((user) =>
    runMessageLoop(user, config, intervalMs, endTime, log),
  );

  // Wait for message loops to complete
  await Promise.all(messageLoops);

  // Close all connections
  log("Closing connections...");
  for (const user of users) {
    user.ws?.close();
  }

  const finalTime = Date.now();

  // Aggregate metrics
  const allLatencies = users.flatMap((u) => u.latencies).sort((a, b) => a - b);
  const allErrors = users.flatMap((u) => u.errors);

  // Count rate limit hits and auth failures from errors
  for (const err of allErrors) {
    if (err.message.includes("rate") || err.message.includes("429")) {
      rateLimitHits++;
    }
    if (err.message.includes("auth") || err.message.includes("unauthorized")) {
      authFailures++;
    }
  }

  const metrics: LoadTestMetrics = {
    scenario: "chat",
    startTime,
    endTime: finalTime,
    durationMs: finalTime - startTime,

    connectionsAttempted: config.concurrency,
    connectionsSucceeded: connectedUsers.length,
    connectionsFailed: config.concurrency - connectedUsers.length,
    connectionsPeak: connectedUsers.length,

    requestsTotal: users.reduce((sum, u) => sum + u.requestsTotal, 0),
    requestsSucceeded: users.reduce((sum, u) => sum + u.requestsSucceeded, 0),
    requestsFailed: users.reduce((sum, u) => sum + u.requestsFailed, 0),
    requestsTimedOut: users.reduce((sum, u) => sum + u.requestsTimedOut, 0),

    latencyP50: percentile(allLatencies, 50),
    latencyP95: percentile(allLatencies, 95),
    latencyP99: percentile(allLatencies, 99),
    latencyMin: allLatencies[0] ?? 0,
    latencyMax: allLatencies[allLatencies.length - 1] ?? 0,
    latencyMean: mean(allLatencies),

    rateLimitHits,
    authFailures,
    errors: aggregateErrors(allErrors),
  };

  return metrics;
}

async function createAndConnectUser(
  config: LoadTestConfig,
  index: number,
  log: (msg: string) => void,
): Promise<VirtualUser> {
  const user: VirtualUser = {
    id: randomUUID(),
    ws: null,
    connected: false,
    requestsTotal: 0,
    requestsSucceeded: 0,
    requestsFailed: 0,
    requestsTimedOut: 0,
    latencies: [],
    errors: [],
  };

  try {
    user.ws = new WebSocket(config.gatewayUrl, {
      maxPayload: 10 * 1024 * 1024,
    });

    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error("Connection timeout"));
      }, 10000);

      user.ws?.once("open", () => {
        clearTimeout(timeout);
        resolve();
      });

      user.ws?.once("error", (err) => {
        clearTimeout(timeout);
        reject(err);
      });
    });

    // Send connect request
    await sendConnectRequest(user, config);
    user.connected = true;
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    user.errors.push({ message: errMsg, timestamp: Date.now() });
    log(`User ${index} connection error: ${errMsg}`);
  }

  return user;
}

async function sendConnectRequest(user: VirtualUser, config: LoadTestConfig): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!user.ws || user.ws.readyState !== WebSocket.OPEN) {
      reject(new Error("WebSocket not open"));
      return;
    }

    const requestId = randomUUID();
    const timeout = setTimeout(() => {
      user.ws?.off("message", handler);
      reject(new Error("Connect request timed out"));
    }, 10000);

    const handler = (data: Buffer) => {
      try {
        const msg = JSON.parse(data.toString());
        if (msg.type === "res" && msg.id === requestId) {
          clearTimeout(timeout);
          user.ws?.off("message", handler);
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

    user.ws.on("message", handler);

    user.ws.send(
      JSON.stringify({
        type: "req",
        id: requestId,
        method: "connect",
        params: {
          minProtocol: 1,
          maxProtocol: 1,
          client: {
            id: "load-test-chat",
            version: "1.0.0",
            platform: "test",
            mode: "test",
            instanceId: user.id,
          },
          caps: [],
          role: "operator",
          auth: config.token ? { token: config.token } : undefined,
        },
      }),
    );
  });
}

async function runMessageLoop(
  user: VirtualUser,
  config: LoadTestConfig,
  intervalMs: number,
  endTime: number,
  _log: (msg: string) => void,
): Promise<void> {
  while (Date.now() < endTime && user.connected && user.ws?.readyState === WebSocket.OPEN) {
    const startMs = Date.now();
    user.requestsTotal++;

    try {
      await sendChatMessage(user, config);
      const latency = Date.now() - startMs;
      user.requestsSucceeded++;
      user.latencies.push(latency);
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      user.errors.push({ message: errMsg, timestamp: Date.now() });

      if (errMsg.includes("timed out")) {
        user.requestsTimedOut++;
      } else {
        user.requestsFailed++;
      }
    }

    // Wait for next interval
    const elapsed = Date.now() - startMs;
    const waitMs = Math.max(0, intervalMs - elapsed);
    if (waitMs > 0) {
      await sleep(waitMs);
    }
  }
}

async function sendChatMessage(user: VirtualUser, _config: LoadTestConfig): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!user.ws || user.ws.readyState !== WebSocket.OPEN) {
      reject(new Error("WebSocket not open"));
      return;
    }

    const requestId = randomUUID();
    const timeout = setTimeout(() => {
      user.ws?.off("message", handler);
      reject(new Error("Chat message timed out"));
    }, 30000);

    const handler = (data: Buffer) => {
      try {
        const msg = JSON.parse(data.toString());
        if (msg.type === "res" && msg.id === requestId) {
          clearTimeout(timeout);
          user.ws?.off("message", handler);
          if (msg.ok) {
            resolve();
          } else {
            reject(new Error(msg.error?.message ?? "Chat message failed"));
          }
        }
      } catch {
        // Ignore parse errors
      }
    };

    user.ws.on("message", handler);

    // Send a simple echo-style message via the sessions.list RPC
    // (a lightweight operation that exercises the request path)
    user.ws.send(
      JSON.stringify({
        type: "req",
        id: requestId,
        method: "sessions.list",
        params: {},
      }),
    );
  });
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
