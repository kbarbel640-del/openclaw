/**
 * Ollama performance metrics extraction and formatting.
 *
 * Ollama's final `done: true` chunk includes nanosecond-precision timing fields.
 * This module parses them into a useful metrics object.
 */

export interface OllamaPerformanceMetrics {
  totalDurationMs: number;
  loadDurationMs: number;
  promptEvalDurationMs: number;
  evalDurationMs: number;
  promptTokens: number;
  evalTokens: number;
  tokensPerSecond: number;
  promptTokensPerSecond: number;
  timeToFirstToken: number; // ms
}

/** Shape of the timing fields on Ollama's final response chunk. */
interface OllamaDoneChunk {
  total_duration?: number;
  load_duration?: number;
  prompt_eval_count?: number;
  prompt_eval_duration?: number;
  eval_count?: number;
  eval_duration?: number;
}

const NS_TO_MS = 1e-6;

export function extractMetrics(response: OllamaDoneChunk): OllamaPerformanceMetrics | null {
  // Need at least eval fields to produce meaningful metrics
  if (response.eval_count == null && response.eval_duration == null) {
    return null;
  }

  const totalDurationMs = (response.total_duration ?? 0) * NS_TO_MS;
  const loadDurationMs = (response.load_duration ?? 0) * NS_TO_MS;
  const promptEvalDurationMs = (response.prompt_eval_duration ?? 0) * NS_TO_MS;
  const evalDurationMs = (response.eval_duration ?? 0) * NS_TO_MS;
  const promptTokens = response.prompt_eval_count ?? 0;
  const evalTokens = response.eval_count ?? 0;

  const evalDurationSec = evalDurationMs / 1000;
  const promptEvalDurationSec = promptEvalDurationMs / 1000;

  return {
    totalDurationMs,
    loadDurationMs,
    promptEvalDurationMs,
    evalDurationMs,
    promptTokens,
    evalTokens,
    tokensPerSecond: evalDurationSec > 0 ? evalTokens / evalDurationSec : 0,
    promptTokensPerSecond: promptEvalDurationSec > 0 ? promptTokens / promptEvalDurationSec : 0,
    timeToFirstToken: loadDurationMs + promptEvalDurationMs,
  };
}

function fmtNum(n: number, decimals = 1): string {
  return n.toFixed(decimals);
}

function fmtMs(ms: number): string {
  if (ms >= 1000) {
    return `${fmtNum(ms / 1000)}s`;
  }
  return `${Math.round(ms)}ms`;
}

export function formatMetrics(metrics: OllamaPerformanceMetrics): string {
  return `${fmtNum(metrics.tokensPerSecond)} tok/s • ${fmtMs(metrics.timeToFirstToken)} to first token • ${metrics.evalTokens} tokens generated`;
}

export function formatMetricsCompact(metrics: OllamaPerformanceMetrics): string {
  return `${fmtNum(metrics.tokensPerSecond)} t/s • ${fmtMs(metrics.timeToFirstToken)} TTFT`;
}
