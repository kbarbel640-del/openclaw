/**
 * Prometheus metrics registry for observability.
 *
 * This module provides a shared metrics registry that mirrors the OTel metrics
 * defined in the diagnostics-otel extension. The metrics are updated by
 * subscribing to diagnostic events.
 */

import { Counter, Gauge, Histogram, Registry, collectDefaultMetrics } from "prom-client";
import { onDiagnosticEvent, type DiagnosticEventPayload } from "../infra/diagnostic-events.js";
import { VERSION } from "../version.js";

const registry = new Registry();

// Set default labels
registry.setDefaultLabels({
  app: "clawdbot",
  version: VERSION,
});

// Collect default Node.js metrics (memory, CPU, event loop, etc.)
collectDefaultMetrics({ register: registry });

// Gateway uptime gauge
const gatewayUptime = new Gauge({
  name: "clawdbot_gateway_uptime_seconds",
  help: "Gateway uptime in seconds",
  registers: [registry],
});

const startTime = Date.now();
gatewayUptime.set(0);

// Token usage counter
const tokensTotal = new Counter({
  name: "clawdbot_tokens_total",
  help: "Total token usage by type",
  labelNames: ["type", "channel", "provider", "model"],
  registers: [registry],
});

// Cost counter
const costTotal = new Counter({
  name: "clawdbot_cost_usd_total",
  help: "Total estimated model cost in USD",
  labelNames: ["channel", "provider", "model"],
  registers: [registry],
});

// Run duration histogram
const runDuration = new Histogram({
  name: "clawdbot_run_duration_seconds",
  help: "Agent run duration in seconds",
  labelNames: ["channel", "provider", "model"],
  buckets: [0.1, 0.5, 1, 2, 5, 10, 30, 60, 120],
  registers: [registry],
});

// Context window histogram
const contextTokens = new Histogram({
  name: "clawdbot_context_tokens",
  help: "Context window token usage",
  labelNames: ["type", "channel", "provider", "model"],
  buckets: [1000, 5000, 10000, 25000, 50000, 100000, 200000],
  registers: [registry],
});

// Webhook counters
const webhookReceived = new Counter({
  name: "clawdbot_webhook_received_total",
  help: "Total webhook requests received",
  labelNames: ["channel", "update_type"],
  registers: [registry],
});

const webhookError = new Counter({
  name: "clawdbot_webhook_error_total",
  help: "Total webhook processing errors",
  labelNames: ["channel", "update_type"],
  registers: [registry],
});

const webhookDuration = new Histogram({
  name: "clawdbot_webhook_duration_seconds",
  help: "Webhook processing duration in seconds",
  labelNames: ["channel", "update_type"],
  buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5],
  registers: [registry],
});

// Message processing counters
const messageQueued = new Counter({
  name: "clawdbot_message_queued_total",
  help: "Total messages queued for processing",
  labelNames: ["channel", "source"],
  registers: [registry],
});

const messageProcessed = new Counter({
  name: "clawdbot_message_processed_total",
  help: "Total messages processed",
  labelNames: ["channel", "outcome"],
  registers: [registry],
});

const messageDuration = new Histogram({
  name: "clawdbot_message_duration_seconds",
  help: "Message processing duration in seconds",
  labelNames: ["channel", "outcome"],
  buckets: [0.1, 0.5, 1, 2, 5, 10, 30, 60],
  registers: [registry],
});

// Queue metrics
const queueDepth = new Gauge({
  name: "clawdbot_queue_depth",
  help: "Current queue depth",
  labelNames: ["lane"],
  registers: [registry],
});

const queueWait = new Histogram({
  name: "clawdbot_queue_wait_seconds",
  help: "Queue wait time before execution in seconds",
  labelNames: ["lane"],
  buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5, 10],
  registers: [registry],
});

// Session state gauge
const sessionState = new Gauge({
  name: "clawdbot_session_state",
  help: "Current session state count",
  labelNames: ["state"],
  registers: [registry],
});

// Session stuck counter
const sessionStuck = new Counter({
  name: "clawdbot_session_stuck_total",
  help: "Total sessions stuck in processing",
  labelNames: ["state"],
  registers: [registry],
});

// Run attempt counter
const runAttempt = new Counter({
  name: "clawdbot_run_attempt_total",
  help: "Total run attempts",
  labelNames: ["attempt"],
  registers: [registry],
});

// Track session state counts
const sessionStateCounts = new Map<string, number>();

/**
 * Handle diagnostic events and update metrics.
 */
function handleDiagnosticEvent(evt: DiagnosticEventPayload): void {
  switch (evt.type) {
    case "model.usage": {
      const labels = {
        channel: evt.channel ?? "unknown",
        provider: evt.provider ?? "unknown",
        model: evt.model ?? "unknown",
      };

      if (evt.usage.input) {
        tokensTotal.inc({ ...labels, type: "input" }, evt.usage.input);
      }
      if (evt.usage.output) {
        tokensTotal.inc({ ...labels, type: "output" }, evt.usage.output);
      }
      if (evt.usage.cacheRead) {
        tokensTotal.inc({ ...labels, type: "cache_read" }, evt.usage.cacheRead);
      }
      if (evt.usage.cacheWrite) {
        tokensTotal.inc({ ...labels, type: "cache_write" }, evt.usage.cacheWrite);
      }
      if (evt.usage.total) {
        tokensTotal.inc({ ...labels, type: "total" }, evt.usage.total);
      }

      if (evt.costUsd) {
        costTotal.inc(labels, evt.costUsd);
      }
      if (evt.durationMs) {
        runDuration.observe(labels, evt.durationMs / 1000);
      }
      if (evt.context?.limit) {
        contextTokens.observe({ ...labels, type: "limit" }, evt.context.limit);
      }
      if (evt.context?.used) {
        contextTokens.observe({ ...labels, type: "used" }, evt.context.used);
      }
      break;
    }

    case "webhook.received": {
      webhookReceived.inc({
        channel: evt.channel ?? "unknown",
        update_type: evt.updateType ?? "unknown",
      });
      break;
    }

    case "webhook.processed": {
      if (typeof evt.durationMs === "number") {
        webhookDuration.observe(
          {
            channel: evt.channel ?? "unknown",
            update_type: evt.updateType ?? "unknown",
          },
          evt.durationMs / 1000,
        );
      }
      break;
    }

    case "webhook.error": {
      webhookError.inc({
        channel: evt.channel ?? "unknown",
        update_type: evt.updateType ?? "unknown",
      });
      break;
    }

    case "message.queued": {
      messageQueued.inc({
        channel: evt.channel ?? "unknown",
        source: evt.source ?? "unknown",
      });
      break;
    }

    case "message.processed": {
      const labels = {
        channel: evt.channel ?? "unknown",
        outcome: evt.outcome ?? "unknown",
      };
      messageProcessed.inc(labels);
      if (typeof evt.durationMs === "number") {
        messageDuration.observe(labels, evt.durationMs / 1000);
      }
      break;
    }

    case "queue.lane.enqueue": {
      queueDepth.set({ lane: evt.lane }, evt.queueSize);
      break;
    }

    case "queue.lane.dequeue": {
      queueDepth.set({ lane: evt.lane }, evt.queueSize);
      if (typeof evt.waitMs === "number") {
        queueWait.observe({ lane: evt.lane }, evt.waitMs / 1000);
      }
      break;
    }

    case "session.state": {
      // Decrement previous state count
      if (evt.prevState) {
        const prevCount = sessionStateCounts.get(evt.prevState) ?? 0;
        if (prevCount > 0) {
          sessionStateCounts.set(evt.prevState, prevCount - 1);
          sessionState.set({ state: evt.prevState }, prevCount - 1);
        }
      }
      // Increment new state count
      const newCount = (sessionStateCounts.get(evt.state) ?? 0) + 1;
      sessionStateCounts.set(evt.state, newCount);
      sessionState.set({ state: evt.state }, newCount);
      break;
    }

    case "session.stuck": {
      sessionStuck.inc({ state: evt.state });
      break;
    }

    case "run.attempt": {
      runAttempt.inc({ attempt: String(evt.attempt) });
      break;
    }

    case "diagnostic.heartbeat": {
      // Update queue depth from heartbeat
      queueDepth.set({ lane: "global" }, evt.queued);
      break;
    }
  }
}

let unsubscribe: (() => void) | null = null;
let uptimeInterval: ReturnType<typeof setInterval> | null = null;

/**
 * Start the metrics collection by subscribing to diagnostic events.
 */
export function startMetricsCollection(): void {
  if (unsubscribe) return;
  unsubscribe = onDiagnosticEvent(handleDiagnosticEvent);

  // Update uptime every second
  uptimeInterval = setInterval(() => {
    gatewayUptime.set((Date.now() - startTime) / 1000);
  }, 1000);
}

/**
 * Stop the metrics collection.
 */
export function stopMetricsCollection(): void {
  if (unsubscribe) {
    unsubscribe();
    unsubscribe = null;
  }
  if (uptimeInterval) {
    clearInterval(uptimeInterval);
    uptimeInterval = null;
  }
}

/**
 * Get the metrics registry.
 */
export function getMetricsRegistry(): Registry {
  return registry;
}

/**
 * Get metrics in Prometheus exposition format.
 */
export async function getMetricsText(): Promise<string> {
  // Update uptime before returning
  gatewayUptime.set((Date.now() - startTime) / 1000);
  return registry.metrics();
}

/**
 * Get the content type for Prometheus metrics.
 */
export function getMetricsContentType(): string {
  return registry.contentType;
}
