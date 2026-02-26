import type { Span, Trace } from "opik";

/** Active trace state for a single agent run, keyed by sessionKey. */
export type ActiveTrace = {
  trace: Trace;
  llmSpan: Span | null;
  toolSpans: Map<string, Span>;
  startedAt: number;
  lastActivityAt: number;
  /** Cost metadata accumulated from model.usage diagnostic events. */
  costMeta: {
    costUsd?: number;
    contextLimit?: number;
    contextUsed?: number;
    model?: string;
    provider?: string;
    durationMs?: number;
    usageInput?: number;
    usageOutput?: number;
    usageCacheRead?: number;
    usageCacheWrite?: number;
    usageTotal?: number;
  };
  /** Accumulated usage from llm_output events. */
  usage: {
    input?: number;
    output?: number;
    cacheRead?: number;
    cacheWrite?: number;
    total?: number;
  };
  /** Last known model name from hooks or diagnostics. */
  model?: string;
  /** Last known provider from hooks or diagnostics. */
  provider?: string;
  /** Output accumulated from llm_output. */
  output?: { output: string; lastAssistant?: unknown };
  /** Data stored by agent_end for deferred finalization. */
  agentEnd?: {
    success: boolean;
    error?: string;
    durationMs?: number;
    messages: unknown[];
  };
};
