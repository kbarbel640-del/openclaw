/**
 * Gateway Authentication Stress Test
 *
 * Tests the gateway's rate limiting and auth backoff mechanisms.
 * Verifies that the gateway correctly limits failed auth attempts
 * and applies exponential backoff.
 */

import { randomUUID } from "node:crypto";
import { WebSocket } from "ws";
import type { LoadTestConfig, LoadTestMetrics } from "./config.js";
import { aggregateErrors, mean, percentile } from "./config.js";

type AuthAttempt = {
  startMs: number;
  latencyMs: number;
  success: boolean;
  error?: string;
  rateLimited: boolean;
};

/**
 * Run the authentication stress test.
 */
export async function runAuthStressTest(config: LoadTestConfig): Promise<LoadTestMetrics> {
  const startTime = Date.now();
  const attempts: AuthAttempt[] = [];
  const errors: Array<{ message: string; timestamp: number }> = [];

  let connectionsAttempted = 0;
  let connectionsSucceeded = 0;
  let connectionsFailed = 0;
  let rateLimitHits = 0;
  let authFailures = 0;

  const log = config.verbose
    ? (msg: string) => console.log(`[${new Date().toISOString()}] ${msg}`)
    : () => {};

  log(`Starting auth stress test: ${config.concurrency} concurrent attempts`);

  // Phase 1: Rapid auth attempts with invalid tokens
  log("Phase 1: Testing invalid token rejection...");
  const invalidTokenAttempts = await runAuthAttempts({
    config,
    count: 20,
    concurrency: 5,
    token: "invalid-token-" + randomUUID(),
    log,
  });

  for (const attempt of invalidTokenAttempts) {
    attempts.push(attempt);
    connectionsAttempted++;
    if (attempt.success) {
      connectionsSucceeded++;
    } else {
      connectionsFailed++;
      authFailures++;
      if (attempt.error) {
        errors.push({ message: attempt.error, timestamp: attempt.startMs });
      }
    }
    if (attempt.rateLimited) {
      rateLimitHits++;
    }
  }

  log(`Phase 1 complete: ${authFailures} auth failures, ${rateLimitHits} rate limits`);

  // Phase 2: Verify backoff is applied
  log("Phase 2: Verifying rate limit backoff...");
  await sleep(1000);

  const backoffAttempts = await runAuthAttempts({
    config,
    count: 10,
    concurrency: 1,
    token: "invalid-token-" + randomUUID(),
    log,
  });

  for (const attempt of backoffAttempts) {
    attempts.push(attempt);
    connectionsAttempted++;
    if (attempt.success) {
      connectionsSucceeded++;
    } else {
      connectionsFailed++;
      authFailures++;
      if (attempt.error) {
        errors.push({ message: attempt.error, timestamp: attempt.startMs });
      }
    }
    if (attempt.rateLimited) {
      rateLimitHits++;
    }
  }

  log(`Phase 2 complete: ${rateLimitHits} total rate limits observed`);

  // Phase 3: Valid token should still work (if provided)
  if (config.token) {
    log("Phase 3: Verifying valid token still works...");
    await sleep(2000);

    const validTokenAttempts = await runAuthAttempts({
      config,
      count: 5,
      concurrency: 1,
      token: config.token,
      log,
    });

    for (const attempt of validTokenAttempts) {
      attempts.push(attempt);
      connectionsAttempted++;
      if (attempt.success) {
        connectionsSucceeded++;
        log("Valid token accepted");
      } else {
        connectionsFailed++;
        if (attempt.error) {
          errors.push({ message: attempt.error, timestamp: attempt.startMs });
        }
        if (attempt.rateLimited) {
          rateLimitHits++;
          log("Valid token rate limited (expected during cooldown)");
        } else {
          authFailures++;
        }
      }
    }
  }

  const endTime = Date.now();

  // Calculate latency metrics
  const latencies = attempts.map((a) => a.latencyMs).sort((a, b) => a - b);

  const metrics: LoadTestMetrics = {
    scenario: "auth-stress",
    startTime,
    endTime,
    durationMs: endTime - startTime,

    connectionsAttempted,
    connectionsSucceeded,
    connectionsFailed,
    connectionsPeak: config.concurrency,

    requestsTotal: attempts.length,
    requestsSucceeded: attempts.filter((a) => a.success).length,
    requestsFailed: attempts.filter((a) => !a.success).length,
    requestsTimedOut: attempts.filter((a) => a.error?.includes("timed out")).length,

    latencyP50: percentile(latencies, 50),
    latencyP95: percentile(latencies, 95),
    latencyP99: percentile(latencies, 99),
    latencyMin: latencies[0] ?? 0,
    latencyMax: latencies[latencies.length - 1] ?? 0,
    latencyMean: mean(latencies),

    rateLimitHits,
    authFailures,
    errors: aggregateErrors(errors),
  };

  return metrics;
}

async function runAuthAttempts(params: {
  config: LoadTestConfig;
  count: number;
  concurrency: number;
  token: string;
  log: (msg: string) => void;
}): Promise<AuthAttempt[]> {
  const { config, count, concurrency, token, log } = params;
  const attempts: AuthAttempt[] = [];
  const pending: Promise<AuthAttempt>[] = [];

  for (let i = 0; i < count; i++) {
    const attemptPromise = runSingleAuthAttempt(config, token, log);
    pending.push(attemptPromise);

    if (pending.length >= concurrency) {
      const completed = await Promise.race(pending.map((p, idx) => p.then((r) => ({ idx, result: r }))));
      void pending.splice(completed.idx, 1);
      attempts.push(completed.result);
    }
  }

  // Wait for remaining
  const remaining = await Promise.all(pending);
  attempts.push(...remaining);

  return attempts;
}

async function runSingleAuthAttempt(
  config: LoadTestConfig,
  token: string,
  _log: (msg: string) => void,
): Promise<AuthAttempt> {
  const startMs = Date.now();
  let ws: WebSocket | null = null;

  try {
    ws = new WebSocket(config.gatewayUrl, {
      maxPayload: 10 * 1024 * 1024,
    });

    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error("Connection timeout"));
      }, 10000);

      ws?.once("open", () => {
        clearTimeout(timeout);
        resolve();
      });

      ws?.once("error", (err) => {
        clearTimeout(timeout);
        reject(err);
      });
    });

    // Send connect request
    const result = await sendAuthRequest(ws, token);
    const latencyMs = Date.now() - startMs;

    if (result.success) {
      return { startMs, latencyMs, success: true, rateLimited: false };
    } else {
      const isRateLimited =
        result.error?.includes("rate") ||
        result.error?.includes("429") ||
        result.error?.includes("backoff") ||
        result.error?.includes("too many");

      return {
        startMs,
        latencyMs,
        success: false,
        error: result.error,
        rateLimited: isRateLimited,
      };
    }
  } catch (err) {
    const latencyMs = Date.now() - startMs;
    const errMsg = err instanceof Error ? err.message : String(err);
    const isRateLimited =
      errMsg.includes("rate") ||
      errMsg.includes("429") ||
      errMsg.includes("backoff") ||
      errMsg.includes("too many");

    return {
      startMs,
      latencyMs,
      success: false,
      error: errMsg,
      rateLimited: isRateLimited,
    };
  } finally {
    ws?.close();
  }
}

async function sendAuthRequest(
  ws: WebSocket,
  token: string,
): Promise<{ success: boolean; error?: string }> {
  return new Promise((resolve) => {
    if (ws.readyState !== WebSocket.OPEN) {
      resolve({ success: false, error: "WebSocket not open" });
      return;
    }

    const requestId = randomUUID();
    const timeout = setTimeout(() => {
      ws.off("message", handler);
      resolve({ success: false, error: "Auth request timed out" });
    }, 10000);

    const handler = (data: Buffer) => {
      try {
        const msg = JSON.parse(data.toString());
        if (msg.type === "res" && msg.id === requestId) {
          clearTimeout(timeout);
          ws.off("message", handler);
          if (msg.ok) {
            resolve({ success: true });
          } else {
            resolve({ success: false, error: msg.error?.message ?? "Auth failed" });
          }
        }
      } catch {
        // Ignore parse errors
      }
    };

    ws.on("message", handler);

    ws.send(
      JSON.stringify({
        type: "req",
        id: requestId,
        method: "connect",
        params: {
          minProtocol: 1,
          maxProtocol: 1,
          client: {
            id: "load-test-auth",
            version: "1.0.0",
            platform: "test",
            mode: "test",
            instanceId: randomUUID(),
          },
          caps: [],
          role: "operator",
          auth: { token },
        },
      }),
    );
  });
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
