import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { Worker } from "node:worker_threads";
import type { AgentMessage } from "@mariozechner/pi-agent-core";
import type { ExtensionContext } from "@mariozechner/pi-coding-agent";
import { estimateTokens, generateSummary } from "@mariozechner/pi-coding-agent";
import { createSubsystemLogger } from "../logging/subsystem.js";
import { DEFAULT_CONTEXT_TOKENS } from "./defaults.js";
import { repairToolUseResultPairing, stripToolResultDetails } from "./session-transcript-repair.js";

const log = createSubsystemLogger("compaction");

export const BASE_CHUNK_RATIO = 0.4;
export const MIN_CHUNK_RATIO = 0.15;
export const SAFETY_MARGIN = 1.2; // 20% buffer for estimateTokens() inaccuracy
const DEFAULT_SUMMARY_FALLBACK = "No prior history.";
const DEFAULT_PARTS = 2;
const MERGE_SUMMARIES_INSTRUCTIONS =
  "Merge these partial summaries into a single cohesive summary. Preserve decisions," +
  " TODOs, open questions, and any constraints.";

export function estimateMessagesTokens(messages: AgentMessage[]): number {
  // SECURITY: toolResult.details can contain untrusted/verbose payloads; never include in LLM-facing compaction.
  const safe = stripToolResultDetails(messages);
  return safe.reduce((sum, message) => sum + estimateTokens(message), 0);
}

function normalizeParts(parts: number, messageCount: number): number {
  if (!Number.isFinite(parts) || parts <= 1) {
    return 1;
  }
  return Math.min(Math.max(1, Math.floor(parts)), Math.max(1, messageCount));
}

export function splitMessagesByTokenShare(
  messages: AgentMessage[],
  parts = DEFAULT_PARTS,
): AgentMessage[][] {
  if (messages.length === 0) {
    return [];
  }
  const normalizedParts = normalizeParts(parts, messages.length);
  if (normalizedParts <= 1) {
    return [messages];
  }

  const totalTokens = estimateMessagesTokens(messages);
  const targetTokens = totalTokens / normalizedParts;
  const chunks: AgentMessage[][] = [];
  let current: AgentMessage[] = [];
  let currentTokens = 0;

  for (const message of messages) {
    const messageTokens = estimateTokens(message);
    if (
      chunks.length < normalizedParts - 1 &&
      current.length > 0 &&
      currentTokens + messageTokens > targetTokens
    ) {
      chunks.push(current);
      current = [];
      currentTokens = 0;
    }

    current.push(message);
    currentTokens += messageTokens;
  }

  if (current.length > 0) {
    chunks.push(current);
  }

  return chunks;
}

// Overhead reserved for summarization prompt, system prompt, previous summary,
// and serialization wrappers (<conversation> tags, instructions, etc.).
// generateSummary uses reasoning: "high" which also consumes context budget.
export const SUMMARIZATION_OVERHEAD_TOKENS = 4096;

export function chunkMessagesByMaxTokens(
  messages: AgentMessage[],
  maxTokens: number,
): AgentMessage[][] {
  if (messages.length === 0) {
    return [];
  }

  // Apply safety margin to compensate for estimateTokens() underestimation
  // (chars/4 heuristic misses multi-byte chars, special tokens, code tokens, etc.)
  const effectiveMax = Math.max(1, Math.floor(maxTokens / SAFETY_MARGIN));

  const chunks: AgentMessage[][] = [];
  let currentChunk: AgentMessage[] = [];
  let currentTokens = 0;

  for (const message of messages) {
    const messageTokens = estimateTokens(message);
    if (currentChunk.length > 0 && currentTokens + messageTokens > effectiveMax) {
      chunks.push(currentChunk);
      currentChunk = [];
      currentTokens = 0;
    }

    currentChunk.push(message);
    currentTokens += messageTokens;

    if (messageTokens > effectiveMax) {
      // Split oversized messages to avoid unbounded chunk growth.
      chunks.push(currentChunk);
      currentChunk = [];
      currentTokens = 0;
    }
  }

  if (currentChunk.length > 0) {
    chunks.push(currentChunk);
  }

  return chunks;
}

/**
 * Compute adaptive chunk ratio based on average message size.
 * When messages are large, we use smaller chunks to avoid exceeding model limits.
 */
export function computeAdaptiveChunkRatio(messages: AgentMessage[], contextWindow: number): number {
  if (messages.length === 0) {
    return BASE_CHUNK_RATIO;
  }

  const totalTokens = estimateMessagesTokens(messages);
  const avgTokens = totalTokens / messages.length;

  // Apply safety margin to account for estimation inaccuracy
  const safeAvgTokens = avgTokens * SAFETY_MARGIN;
  const avgRatio = safeAvgTokens / contextWindow;

  // If average message is > 10% of context, reduce chunk ratio
  if (avgRatio > 0.1) {
    const reduction = Math.min(avgRatio * 2, BASE_CHUNK_RATIO - MIN_CHUNK_RATIO);
    return Math.max(MIN_CHUNK_RATIO, BASE_CHUNK_RATIO - reduction);
  }

  return BASE_CHUNK_RATIO;
}

/**
 * Check if a single message is too large to summarize.
 * If single message > 50% of context, it can't be summarized safely.
 */
export function isOversizedForSummary(msg: AgentMessage, contextWindow: number): boolean {
  const tokens = estimateTokens(msg) * SAFETY_MARGIN;
  return tokens > contextWindow * 0.5;
}

/**
 * Shared type for data passed into the compaction Worker.
 * All fields must be structured-clone-serialisable (plain primitives / arrays / objects).
 * Model<TApi> satisfies this — it carries no methods, only data fields.
 */
interface CompactionWorkerData {
  chunk: AgentMessage[];
  model: NonNullable<ExtensionContext["model"]>;
  reserveTokens: number;
  apiKey: string;
  customInstructions: string | undefined;
  previousSummary: string | undefined;
}

/**
 * Resolved once at module load. Both the main bundle and compaction-worker.js
 * land in dist/, so the sibling-relative URL is stable across installs.
 */
const COMPACTION_WORKER_URL = new URL("./compaction-worker.js", import.meta.url);

/**
 * True when the compiled worker bundle is present on disk (production / installed dist).
 * False when running tests directly from TypeScript source, where compaction-worker.js
 * has not been built yet. The fallback path calls generateSummary inline so that
 * vi.mock("@mariozechner/pi-coding-agent") intercepts work in unit tests.
 */
const COMPACTION_WORKER_EXISTS = existsSync(fileURLToPath(COMPACTION_WORKER_URL));

/**
 * Spawn a worker_threads.Worker for a single chunk summarisation call.
 *
 * Isolation guarantees:
 *   - Hanging LLM HTTP call → only the Worker thread stalls; gateway event loop stays free.
 *   - Worker OOM → only the Worker dies; gateway process unaffected.
 *   - Worker crash → rejected Promise → throw propagates to summarizeWithFallback →
 *     compactionSafeguardExtension catch → static truncation fallback (no LLM needed).
 *
 * Resource management:
 *   - A `settled` flag + `cleanup()` ensures all three event listeners (message, error,
 *     exit) are removed as soon as any one fires, preventing handle leaks over time.
 *   - `signal` forwarded from the caller: if the session/request is aborted, the Worker
 *     is terminated immediately and the Promise rejects with AbortError.
 *
 * Exit-code correctness:
 *   - `onExit` rejects on ANY exit (not just code !== 0) when the Promise hasn't
 *     already been settled by a message. This covers the edge case where the Worker
 *     crashes or `postMessage` fails and exits silently with code 0.
 *   - The Worker itself sets `process.exitCode = 1` in its catch block so that crash
 *     exits produce a non-zero code as a secondary diagnostic signal.
 *
 * The outer compactWithSafetyTimeout (300 s) remains as a belt-and-suspenders guard
 * for the full session.compact() call.
 */
async function generateSummaryInWorker(
  chunk: AgentMessage[],
  model: NonNullable<ExtensionContext["model"]>,
  reserveTokens: number,
  apiKey: string,
  customInstructions: string | undefined,
  previousSummary: string | undefined,
  signal: AbortSignal | null,
): Promise<string> {
  // Fast-path: avoid spawning a Worker for an already-aborted signal.
  if (signal?.aborted) {
    return Promise.reject(Object.assign(new Error("AbortError"), { name: "AbortError" }));
  }

  // When running tests from TypeScript source the compiled worker bundle does not exist.
  // Fall back to calling generateSummary directly so vi.mock() intercepts are honoured.
  if (!COMPACTION_WORKER_EXISTS) {
    return generateSummary(
      chunk,
      model,
      reserveTokens,
      apiKey,
      signal ?? undefined,
      customInstructions,
      previousSummary,
    );
  }

  return new Promise<string>((resolve, reject) => {
    const workerData: CompactionWorkerData = {
      chunk,
      model,
      reserveTokens,
      apiKey,
      customInstructions,
      previousSummary,
    };
    const worker = new Worker(COMPACTION_WORKER_URL, { workerData });

    let settled = false;

    /** Call exactly once; subsequent calls are no-ops. */
    const settle = (fn: () => void): void => {
      if (settled) {
        return;
      }
      settled = true;
      cleanup();
      fn();
    };

    /** Remove all listeners so the Worker handle can be GC'd. */
    const cleanup = (): void => {
      worker.off("message", onMessage);
      worker.off("error", onError);
      worker.off("exit", onExit);
      signal?.removeEventListener("abort", onAbort);
    };

    const onMessage = (msg: { ok: boolean; summary?: string; error?: string }): void => {
      if (msg.ok && msg.summary != null) {
        settle(() => resolve(msg.summary!));
      } else {
        settle(() => reject(new Error(`compaction worker: ${msg.error ?? "unknown error"}`)));
      }
    };

    const onError = (err: Error): void => settle(() => reject(err));

    // Reject on ANY exit when not already settled — covers both non-zero exits (crash)
    // and code-0 exits where the Worker died before postMessage completed.
    const onExit = (code: number): void => {
      settle(() =>
        reject(new Error(`compaction worker exited (code ${code}) without posting a result`)),
      );
    };

    const onAbort = (): void => {
      // terminate() causes the Worker to exit; onExit will fire but settle() no-ops.
      worker.terminate().catch(() => undefined);
      settle(() => reject(Object.assign(new Error("Compaction aborted"), { name: "AbortError" })));
    };

    worker.on("message", onMessage);
    worker.on("error", onError);
    worker.on("exit", onExit);
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

async function summarizeChunks(params: {
  messages: AgentMessage[];
  model: NonNullable<ExtensionContext["model"]>;
  apiKey: string;
  signal: AbortSignal;
  reserveTokens: number;
  maxChunkTokens: number;
  customInstructions?: string;
  previousSummary?: string;
}): Promise<string> {
  if (params.messages.length === 0) {
    return params.previousSummary ?? DEFAULT_SUMMARY_FALLBACK;
  }

  // SECURITY: never feed toolResult.details into summarization prompts.
  const safeMessages = stripToolResultDetails(params.messages);
  const chunks = chunkMessagesByMaxTokens(safeMessages, params.maxChunkTokens);
  let summary = params.previousSummary;

  for (const chunk of chunks) {
    // Single attempt per chunk, no retry backoff.
    // Worker is the isolation boundary; signal forwarded so abort cancels the Worker.
    summary = await generateSummaryInWorker(
      chunk,
      params.model,
      params.reserveTokens,
      params.apiKey,
      params.customInstructions,
      summary,
      params.signal,
    );
  }

  return summary ?? DEFAULT_SUMMARY_FALLBACK;
}

/**
 * Summarize with progressive fallback for handling oversized messages.
 * If full summarization fails, tries partial summarization excluding oversized messages.
 */
export async function summarizeWithFallback(params: {
  messages: AgentMessage[];
  model: NonNullable<ExtensionContext["model"]>;
  apiKey: string;
  signal: AbortSignal;
  reserveTokens: number;
  maxChunkTokens: number;
  contextWindow: number;
  customInstructions?: string;
  previousSummary?: string;
}): Promise<string> {
  const { messages, contextWindow } = params;

  if (messages.length === 0) {
    return params.previousSummary ?? DEFAULT_SUMMARY_FALLBACK;
  }

  // Try full summarization first
  try {
    return await summarizeChunks(params);
  } catch (fullError) {
    log.warn(
      `Full summarization failed, trying partial: ${
        fullError instanceof Error ? fullError.message : String(fullError)
      }`,
    );
  }

  // Fallback 1: Summarize only small messages, note oversized ones
  const smallMessages: AgentMessage[] = [];
  const oversizedNotes: string[] = [];

  for (const msg of messages) {
    if (isOversizedForSummary(msg, contextWindow)) {
      const role = (msg as { role?: string }).role ?? "message";
      const tokens = estimateTokens(msg);
      oversizedNotes.push(
        `[Large ${role} (~${Math.round(tokens / 1000)}K tokens) omitted from summary]`,
      );
    } else {
      smallMessages.push(msg);
    }
  }

  if (smallMessages.length > 0) {
    try {
      const partialSummary = await summarizeChunks({
        ...params,
        messages: smallMessages,
      });
      const notes = oversizedNotes.length > 0 ? `\n\n${oversizedNotes.join("\n")}` : "";
      return partialSummary + notes;
    } catch (partialError) {
      log.warn(
        `Partial summarization also failed: ${
          partialError instanceof Error ? partialError.message : String(partialError)
        }`,
      );
    }
  }

  // Final fallback: Just note what was there
  return (
    `Context contained ${messages.length} messages (${oversizedNotes.length} oversized). ` +
    `Summary unavailable due to size limits.`
  );
}

export async function summarizeInStages(params: {
  messages: AgentMessage[];
  model: NonNullable<ExtensionContext["model"]>;
  apiKey: string;
  signal: AbortSignal;
  reserveTokens: number;
  maxChunkTokens: number;
  contextWindow: number;
  customInstructions?: string;
  previousSummary?: string;
  parts?: number;
  minMessagesForSplit?: number;
}): Promise<string> {
  const { messages } = params;
  if (messages.length === 0) {
    return params.previousSummary ?? DEFAULT_SUMMARY_FALLBACK;
  }

  const minMessagesForSplit = Math.max(2, params.minMessagesForSplit ?? 4);
  const parts = normalizeParts(params.parts ?? DEFAULT_PARTS, messages.length);
  const totalTokens = estimateMessagesTokens(messages);

  if (parts <= 1 || messages.length < minMessagesForSplit || totalTokens <= params.maxChunkTokens) {
    return summarizeWithFallback(params);
  }

  const splits = splitMessagesByTokenShare(messages, parts).filter((chunk) => chunk.length > 0);
  if (splits.length <= 1) {
    return summarizeWithFallback(params);
  }

  const partialSummaries: string[] = [];
  for (const chunk of splits) {
    partialSummaries.push(
      await summarizeWithFallback({
        ...params,
        messages: chunk,
        previousSummary: undefined,
      }),
    );
  }

  if (partialSummaries.length === 1) {
    return partialSummaries[0];
  }

  const summaryMessages: AgentMessage[] = partialSummaries.map((summary) => ({
    role: "user",
    content: summary,
    timestamp: Date.now(),
  }));

  const mergeInstructions = params.customInstructions
    ? `${MERGE_SUMMARIES_INSTRUCTIONS}\n\nAdditional focus:\n${params.customInstructions}`
    : MERGE_SUMMARIES_INSTRUCTIONS;

  return summarizeWithFallback({
    ...params,
    messages: summaryMessages,
    customInstructions: mergeInstructions,
  });
}

export function pruneHistoryForContextShare(params: {
  messages: AgentMessage[];
  maxContextTokens: number;
  maxHistoryShare?: number;
  parts?: number;
}): {
  messages: AgentMessage[];
  droppedMessagesList: AgentMessage[];
  droppedChunks: number;
  droppedMessages: number;
  droppedTokens: number;
  keptTokens: number;
  budgetTokens: number;
} {
  const maxHistoryShare = params.maxHistoryShare ?? 0.5;
  const budgetTokens = Math.max(1, Math.floor(params.maxContextTokens * maxHistoryShare));
  let keptMessages = params.messages;
  const allDroppedMessages: AgentMessage[] = [];
  let droppedChunks = 0;
  let droppedMessages = 0;
  let droppedTokens = 0;

  const parts = normalizeParts(params.parts ?? DEFAULT_PARTS, keptMessages.length);

  while (keptMessages.length > 0 && estimateMessagesTokens(keptMessages) > budgetTokens) {
    const chunks = splitMessagesByTokenShare(keptMessages, parts);
    if (chunks.length <= 1) {
      break;
    }
    const [dropped, ...rest] = chunks;
    const flatRest = rest.flat();

    // After dropping a chunk, repair tool_use/tool_result pairing to handle
    // orphaned tool_results (whose tool_use was in the dropped chunk).
    // repairToolUseResultPairing drops orphaned tool_results, preventing
    // "unexpected tool_use_id" errors from Anthropic's API.
    const repairReport = repairToolUseResultPairing(flatRest);
    const repairedKept = repairReport.messages;

    // Track orphaned tool_results as dropped (they were in kept but their tool_use was dropped)
    const orphanedCount = repairReport.droppedOrphanCount;

    droppedChunks += 1;
    droppedMessages += dropped.length + orphanedCount;
    droppedTokens += estimateMessagesTokens(dropped);
    // Note: We don't have the actual orphaned messages to add to droppedMessagesList
    // since repairToolUseResultPairing doesn't return them. This is acceptable since
    // the dropped messages are used for summarization, and orphaned tool_results
    // without their tool_use context aren't useful for summarization anyway.
    allDroppedMessages.push(...dropped);
    keptMessages = repairedKept;
  }

  return {
    messages: keptMessages,
    droppedMessagesList: allDroppedMessages,
    droppedChunks,
    droppedMessages,
    droppedTokens,
    keptTokens: estimateMessagesTokens(keptMessages),
    budgetTokens,
  };
}

export function resolveContextWindowTokens(model?: ExtensionContext["model"]): number {
  return Math.max(1, Math.floor(model?.contextWindow ?? DEFAULT_CONTEXT_TOKENS));
}
