/**
 * Compaction isolation worker (worker_threads)
 *
 * Each call to summarizeChunks spawns one Worker per chunk. The LLM API call
 * runs on this thread — if it hangs or throws, only this Worker is affected.
 * The gateway main thread stays free. On failure the Worker exits non-zero or
 * posts { ok: false }, which propagates as a throw in generateSummaryInWorker,
 * which triggers the existing static-fallback path in compactionSafeguardExtension.
 *
 * workerData shape matches CompactionWorkerData (defined in compaction.ts).
 * Model<TApi> is all plain primitives (id/name/provider/api/baseUrl etc.) so
 * it survives the structured-clone serialisation across the Worker boundary.
 */
import { workerData, parentPort } from "node:worker_threads";
import type { AgentMessage } from "@mariozechner/pi-agent-core";
import type { ExtensionContext } from "@mariozechner/pi-coding-agent";
import { generateSummary } from "@mariozechner/pi-coding-agent";

interface CompactionWorkerData {
  chunk: AgentMessage[];
  model: NonNullable<ExtensionContext["model"]>;
  reserveTokens: number;
  apiKey: string;
  customInstructions: string | undefined;
  previousSummary: string | undefined;
}

const { chunk, model, reserveTokens, apiKey, customInstructions, previousSummary } =
  workerData as CompactionWorkerData;

try {
  // signal=undefined: the Worker is the isolation boundary; the parent terminates the
  // Worker via worker.terminate() when the AbortSignal fires (see generateSummaryInWorker).
  const summary = await generateSummary(
    chunk,
    model,
    reserveTokens,
    apiKey,
    undefined,
    customInstructions,
    previousSummary,
  );
  parentPort!.postMessage({ ok: true, summary });
} catch (err) {
  // Set exit code BEFORE postMessage so that even if postMessage itself throws
  // (e.g., the parent already terminated us), the process exits non-zero and
  // the parent's onExit handler can detect the failure.
  process.exitCode = 1;
  parentPort!.postMessage({
    ok: false,
    error: err instanceof Error ? err.message : String(err),
  });
}
