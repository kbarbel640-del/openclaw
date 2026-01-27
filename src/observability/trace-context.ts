/**
 * W3C Trace Context utilities for distributed tracing.
 *
 * Implements the W3C Trace Context specification for trace propagation:
 * https://www.w3.org/TR/trace-context/
 *
 * Format: 00-<trace-id>-<span-id>-<trace-flags>
 * - version: 00 (fixed)
 * - trace-id: 32 hex chars (16 bytes)
 * - span-id: 16 hex chars (8 bytes)
 * - trace-flags: 2 hex chars (1 byte, 01 = sampled)
 */

import { AsyncLocalStorage } from "node:async_hooks";
import { randomBytes } from "node:crypto";

export type TraceContext = {
  traceId: string;
  spanId: string;
  sampled: boolean;
  parentSpanId?: string;
};

const TRACEPARENT_REGEX = /^00-([a-f0-9]{32})-([a-f0-9]{16})-([a-f0-9]{2})$/;
const INVALID_TRACE_ID = "00000000000000000000000000000000";
const INVALID_SPAN_ID = "0000000000000000";

const traceStore = new AsyncLocalStorage<TraceContext>();

/**
 * Generate a new random trace ID (32 hex chars).
 */
export function generateTraceId(): string {
  return randomBytes(16).toString("hex");
}

/**
 * Generate a new random span ID (16 hex chars).
 */
export function generateSpanId(): string {
  return randomBytes(8).toString("hex");
}

/**
 * Parse a W3C traceparent header value.
 * Returns null if the header is invalid or missing.
 */
export function parseTraceparent(header: string | undefined): TraceContext | null {
  if (!header) return null;

  const match = header.trim().toLowerCase().match(TRACEPARENT_REGEX);
  if (!match) return null;

  const [, traceId, spanId, flags] = match;

  // Reject all-zero trace ID or span ID
  if (traceId === INVALID_TRACE_ID || spanId === INVALID_SPAN_ID) {
    return null;
  }

  return {
    traceId,
    spanId,
    sampled: (Number.parseInt(flags, 16) & 0x01) === 0x01,
    parentSpanId: spanId, // The incoming span becomes our parent
  };
}

/**
 * Format a TraceContext into a W3C traceparent header value.
 */
export function formatTraceparent(ctx: TraceContext): string {
  const flags = ctx.sampled ? "01" : "00";
  return `00-${ctx.traceId}-${ctx.spanId}-${flags}`;
}

/**
 * Create a new TraceContext, optionally inheriting from a parent.
 */
export function createTraceContext(parent?: TraceContext | null): TraceContext {
  if (parent) {
    return {
      traceId: parent.traceId,
      spanId: generateSpanId(),
      sampled: parent.sampled,
      parentSpanId: parent.spanId,
    };
  }
  return {
    traceId: generateTraceId(),
    spanId: generateSpanId(),
    sampled: true, // Default to sampled
  };
}

/**
 * Get the current trace context from AsyncLocalStorage.
 * Returns null if not in a traced context.
 */
export function getCurrentTraceContext(): TraceContext | null {
  return traceStore.getStore() ?? null;
}

/**
 * Get the current trace ID or a short placeholder.
 * Useful for logging when you need a trace ID but may not be in a traced context.
 */
export function getCurrentTraceId(): string {
  const ctx = getCurrentTraceContext();
  return ctx?.traceId ?? "no-trace";
}

/**
 * Get a short trace ID for logging (first 8 chars).
 */
export function getShortTraceId(): string {
  const ctx = getCurrentTraceContext();
  return ctx?.traceId.slice(0, 8) ?? "no-trace";
}

/**
 * Run a function within a trace context.
 * The context is available via getCurrentTraceContext() within the function.
 */
export function withTraceContext<T>(ctx: TraceContext, fn: () => T): T {
  return traceStore.run(ctx, fn);
}

/**
 * Run an async function within a trace context.
 */
export async function withTraceContextAsync<T>(
  ctx: TraceContext,
  fn: () => Promise<T>,
): Promise<T> {
  return traceStore.run(ctx, fn);
}

/**
 * Extract or create a trace context from an HTTP request.
 * If the request has a valid traceparent header, it's used to create a child span.
 * Otherwise, a new trace is started.
 */
export function extractOrCreateTraceContext(headers: {
  traceparent?: string;
  [key: string]: unknown;
}): TraceContext {
  const traceparent = headers.traceparent;
  const parentHeader = typeof traceparent === "string" ? traceparent : undefined;
  const parent = parseTraceparent(parentHeader);
  return createTraceContext(parent);
}

/**
 * Create a W3C traceparent header for outgoing requests.
 * Uses the current trace context if available, otherwise creates a new one.
 */
export function createOutgoingTraceparent(): string {
  let ctx = getCurrentTraceContext();
  if (!ctx) {
    ctx = createTraceContext();
  } else {
    // Create a new span for the outgoing request
    ctx = createTraceContext(ctx);
  }
  return formatTraceparent(ctx);
}

/**
 * Utility to add trace context to log metadata.
 */
export function traceLogMeta(): Record<string, string> {
  const ctx = getCurrentTraceContext();
  if (!ctx) return {};
  return {
    traceId: ctx.traceId,
    spanId: ctx.spanId,
    ...(ctx.parentSpanId ? { parentSpanId: ctx.parentSpanId } : {}),
  };
}
