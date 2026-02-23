/**
 * Idempotency — deterministic key generation for replay-safe dispatch.
 */

import crypto from "node:crypto";

function sha256Hex32(input: string): string {
  return crypto.createHash("sha256").update(input).digest("hex").slice(0, 32);
}

/** Generate an idempotency key for a scheduled job execution. */
export function generateScheduleKey(jobId: string, scheduledTimeMs: number): string {
  return sha256Hex32(`schedule:${jobId}:${scheduledTimeMs}`);
}

/** Generate an idempotency key for a chain-triggered execution. */
export function generateChainKey(parentRunId: string, childJobId: string): string {
  return sha256Hex32(`chain:${parentRunId}:${childJobId}`);
}

/** Generate a unique key for a manual run-now trigger. */
export function generateRunNowKey(jobId: string): string {
  const nonce = crypto.randomUUID();
  return sha256Hex32(`run-now:${jobId}:${nonce}`);
}
