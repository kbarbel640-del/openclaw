type Permit = {
  agentId: string;
  acquiredAtMs: number;
};

type GovernorConfig = {
  enabled: boolean;

  // Hard limits
  globalMaxInFlight: number;      // e.g., 2
  perAgentMaxInFlight: number;    // e.g., 1

  // Safety / backpressure
  maxQueueDepth: number;          // e.g., 200
  permitTtlMs: number;            // e.g., 120_000
};

type ExecuteParams<T> = {
  agentId: string;
  fn: () => Promise<T>;
};

function nowMs() {
  return Date.now();
}

// In-memory state (process-wide)
const globalInFlight: Permit[] = [];
const perAgentInFlight = new Map<string, number>();

// Simple FIFO queue of waiters
type Waiter = {
  agentId: string;
  createdAtMs: number;
  resolve: () => void;
  reject: (err: Error) => void;
};
const waitQueue: Waiter[] = [];

let cfg: GovernorConfig = {
  enabled: false,
  globalMaxInFlight: 2,
  perAgentMaxInFlight: 1,
  maxQueueDepth: 200,
  permitTtlMs: 120_000,
};

export function configureGovernor(partial: Partial<GovernorConfig>) {
  cfg = { ...cfg, ...partial };
}

function cleanupExpiredPermits() {
  const cutoff = nowMs() - cfg.permitTtlMs;

  // Drop expired global permits
  for (let i = globalInFlight.length - 1; i >= 0; i--) {
    if (globalInFlight[i].acquiredAtMs < cutoff) {
      const p = globalInFlight[i];
      globalInFlight.splice(i, 1);
      const cur = perAgentInFlight.get(p.agentId) || 0;
      perAgentInFlight.set(p.agentId, Math.max(0, cur - 1));
    }
  }
}

function canAcquire(agentId: string) {
  cleanupExpiredPermits();
  const globalOk = globalInFlight.length < cfg.globalMaxInFlight;
  const perAgent = perAgentInFlight.get(agentId) || 0;
  const agentOk = perAgent < cfg.perAgentMaxInFlight;
  return globalOk && agentOk;
}

function acquire(agentId: string) {
  globalInFlight.push({ agentId, acquiredAtMs: nowMs() });
  perAgentInFlight.set(agentId, (perAgentInFlight.get(agentId) || 0) + 1);
}

function release(agentId: string) {
  // remove one permit for agent from global list
  const idx = globalInFlight.findIndex((p) => p.agentId === agentId);
  if (idx >= 0) globalInFlight.splice(idx, 1);

  const cur = perAgentInFlight.get(agentId) || 0;
  const next = Math.max(0, cur - 1);
  if (next === 0) perAgentInFlight.delete(agentId);
  else perAgentInFlight.set(agentId, next);

  // Wake the next eligible waiter (FIFO scan)
  for (let i = 0; i < waitQueue.length; i++) {
    const w = waitQueue[i];
    if (canAcquire(w.agentId)) {
      waitQueue.splice(i, 1);
      w.resolve();
      return;
    }
  }
}

async function waitForPermit(agentId: string) {
  if (waitQueue.length >= cfg.maxQueueDepth) {
    throw new Error("governor_queue_full");
  }
  return await new Promise<void>((resolve, reject) => {
    waitQueue.push({ agentId, createdAtMs: nowMs(), resolve, reject });
  });
}

/**
 * Execute a function under Governor permits.
 * Enforces:
 * - global concurrency limit
 * - per-agent concurrency limit
 */
export async function governorExecute<T>(params: ExecuteParams<T>): Promise<T> {
  if (!cfg.enabled) {
    return await params.fn();
  }

  // Acquire permit (or wait)
  if (!canAcquire(params.agentId)) {
    await waitForPermit(params.agentId);
  }
  acquire(params.agentId);

  try {
    return await params.fn();
  } finally {
    release(params.agentId);
  }
}
