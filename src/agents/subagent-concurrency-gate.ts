/**
 * ENGN-5609: Gateway-level concurrency cap for API calls.
 *
 * Provides a semaphore that limits total concurrent subagent spawns across
 * all agents. Requests exceeding the cap are queued with backpressure.
 * Per-agent fair-share enforcement ensures no single agent monopolizes slots.
 */

import { defaultRuntime } from "../runtime.js";

export type ConcurrencyGateConfig = {
  maxGlobalConcurrent: number;
};

type QueueEntry = {
  agentId: string;
  resolve: () => void;
  reject: (err: Error) => void;
  enqueuedAt: number;
};

const DEFAULT_MAX_GLOBAL_CONCURRENT = 10;
const QUEUE_TIMEOUT_MS = 30_000;

let maxSlots = DEFAULT_MAX_GLOBAL_CONCURRENT;
let activeCount = 0;
const activeByAgent = new Map<string, number>();
const queue: QueueEntry[] = [];

export function configureConcurrencyGate(config: Partial<ConcurrencyGateConfig>): void {
  if (typeof config.maxGlobalConcurrent === "number" && config.maxGlobalConcurrent >= 1) {
    maxSlots = Math.floor(config.maxGlobalConcurrent);
  }
}

export function getConcurrencyStats(): {
  active: number;
  max: number;
  queued: number;
  activeByAgent: Record<string, number>;
} {
  const byAgent: Record<string, number> = {};
  for (const [agentId, count] of activeByAgent.entries()) {
    byAgent[agentId] = count;
  }
  return {
    active: activeCount,
    max: maxSlots,
    queued: queue.length,
    activeByAgent: byAgent,
  };
}

function computeFairShare(): number {
  const uniqueAgents = new Set([...activeByAgent.keys(), ...queue.map((e) => e.agentId)]);
  const agentCount = Math.max(1, uniqueAgents.size);
  return Math.max(1, Math.floor(maxSlots / agentCount));
}

function isAgentOverFairShare(agentId: string): boolean {
  const current = activeByAgent.get(agentId) ?? 0;
  return current >= computeFairShare();
}

function tryDrainQueue(): void {
  const now = Date.now();
  while (queue.length > 0 && activeCount < maxSlots) {
    // Prefer agents that are under their fair share
    let idx = queue.findIndex((e) => !isAgentOverFairShare(e.agentId));
    if (idx === -1) {
      idx = 0; // Fall back to FIFO if all are over fair share
    }
    const entry = queue.splice(idx, 1)[0];
    if (now - entry.enqueuedAt > QUEUE_TIMEOUT_MS) {
      entry.reject(new Error("Concurrency gate queue timeout exceeded"));
      continue;
    }
    activeCount++;
    activeByAgent.set(entry.agentId, (activeByAgent.get(entry.agentId) ?? 0) + 1);
    entry.resolve();
  }
  // Expire remaining timed-out entries
  for (let i = queue.length - 1; i >= 0; i--) {
    if (now - queue[i].enqueuedAt > QUEUE_TIMEOUT_MS) {
      const expired = queue.splice(i, 1)[0];
      expired.reject(new Error("Concurrency gate queue timeout exceeded"));
    }
  }
}

export async function acquireConcurrencySlot(agentId: string): Promise<void> {
  if (activeCount < maxSlots && !isAgentOverFairShare(agentId)) {
    activeCount++;
    activeByAgent.set(agentId, (activeByAgent.get(agentId) ?? 0) + 1);
    defaultRuntime.log(
      `[concurrency-gate] Slot acquired agent=${agentId} active=${activeCount}/${maxSlots}`,
    );
    return;
  }

  return new Promise<void>((resolve, reject) => {
    queue.push({ agentId, resolve, reject, enqueuedAt: Date.now() });
    defaultRuntime.log(
      `[concurrency-gate] Queued agent=${agentId} active=${activeCount}/${maxSlots} queued=${queue.length}`,
    );
  });
}

export function releaseConcurrencySlot(agentId: string): void {
  if (activeCount > 0) {
    activeCount--;
  }
  const current = activeByAgent.get(agentId) ?? 0;
  if (current <= 1) {
    activeByAgent.delete(agentId);
  } else {
    activeByAgent.set(agentId, current - 1);
  }
  defaultRuntime.log(
    `[concurrency-gate] Slot released agent=${agentId} active=${activeCount}/${maxSlots}`,
  );
  tryDrainQueue();
}

export function resetConcurrencyGateForTests(): void {
  activeCount = 0;
  activeByAgent.clear();
  queue.length = 0;
  maxSlots = DEFAULT_MAX_GLOBAL_CONCURRENT;
}
