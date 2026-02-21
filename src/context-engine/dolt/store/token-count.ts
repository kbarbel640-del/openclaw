import type { AgentMessage } from "@mariozechner/pi-agent-core";
import { estimateTokens } from "@mariozechner/pi-coding-agent";
import type { DoltTokenCountMethod } from "./types.js";

export type DoltTokenCountEstimate = {
  tokenCount: number;
  tokenCountMethod: DoltTokenCountMethod;
};

/**
 * Deterministically estimate token count for persisted Dolt payloads.
 */
export function estimateDoltTokenCount(params: {
  payload: unknown;
  estimateTokensFn?: (message: AgentMessage) => number;
}): DoltTokenCountEstimate {
  const text = renderPayloadForTokenEstimation(params.payload);
  const primaryEstimator = params.estimateTokensFn ?? estimateTokens;
  try {
    const estimated = primaryEstimator({ role: "user", content: text, timestamp: 0 });
    if (typeof estimated === "number" && Number.isFinite(estimated) && estimated >= 0) {
      return {
        tokenCount: Math.floor(estimated),
        tokenCountMethod: "estimateTokens",
      };
    }
  } catch {
    // Fall through to deterministic byte heuristic.
  }

  const utf8Bytes = Buffer.byteLength(text, "utf8");
  return {
    tokenCount: utf8Bytes === 0 ? 0 : Math.ceil(utf8Bytes / 4),
    tokenCountMethod: "fallback",
  };
}

/**
 * Serialize payloads deterministically so token estimation is stable.
 */
export function renderPayloadForTokenEstimation(payload: unknown): string {
  if (payload === null || payload === undefined) {
    return "";
  }
  if (typeof payload === "string") {
    return payload;
  }

  const payloadRecord = toRecord(payload);
  const summary = payloadRecord ? payloadRecord.summary : undefined;
  if (typeof summary === "string") {
    return summary;
  }

  if (typeof payload === "number" || typeof payload === "boolean") {
    return String(payload);
  }

  if (typeof payload === "bigint") {
    return payload.toString();
  }

  return stableSerialize(payload);
}

function stableSerialize(value: unknown): string {
  try {
    return serializeStableJson(value, new Set<unknown>());
  } catch {
    return String(value);
  }
}

function serializeStableJson(value: unknown, seen: Set<unknown>): string {
  if (value === null) {
    return "null";
  }

  if (typeof value === "string") {
    return JSON.stringify(value);
  }

  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      return "null";
    }
    return JSON.stringify(value);
  }

  if (typeof value === "boolean") {
    return value ? "true" : "false";
  }

  if (typeof value === "bigint") {
    return JSON.stringify(value.toString());
  }

  if (Array.isArray(value)) {
    const entries = value.map((entry) => serializeStableJson(entry, seen));
    return `[${entries.join(",")}]`;
  }

  if (typeof value === "object") {
    if (seen.has(value)) {
      throw new Error("Cannot stable-serialize circular payload.");
    }
    seen.add(value);
    const record = value as Record<string, unknown>;
    const keys = Object.keys(record).toSorted();
    const entries: string[] = [];
    for (const key of keys) {
      const entry = record[key];
      if (entry === undefined || typeof entry === "function" || typeof entry === "symbol") {
        continue;
      }
      entries.push(`${JSON.stringify(key)}:${serializeStableJson(entry, seen)}`);
    }
    seen.delete(value);
    return `{${entries.join(",")}}`;
  }

  if (typeof value === "function" || typeof value === "symbol" || value === undefined) {
    return "null";
  }

  return "null";
}

function toRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}
