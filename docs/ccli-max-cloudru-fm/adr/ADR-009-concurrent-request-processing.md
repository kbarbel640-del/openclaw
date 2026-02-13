# ADR-009: Concurrent Request Processing

## Status: PROPOSED (supersedes `serialize: true` in ADR-003)

## Date: 2026-02-13

## Bounded Context: Request Pipeline

## Context

ADR-003 documents that the default `claude-cli` backend uses `serialize: true`
(`cli-backends.ts:52`). This setting causes `cli-runner.ts:177-178` to queue
ALL Claude Code subprocess calls behind a single promise chain:

```typescript
const serialize = backend.serialize ?? true;
const queueKey = serialize ? backendResolved.id : `${backendResolved.id}:${params.runId}`;
```

The `enqueueCliRun()` function in `helpers.ts:152-162` chains promises sequentially:

```typescript
const prior = CLI_RUN_QUEUE.get(key) ?? Promise.resolve();
const chained = prior.catch(() => undefined).then(task);
```

This creates a **global single-request bottleneck**. When 10 Telegram/MAX users
send messages simultaneously, 9 must wait. With GLM-4.7 response times of
10-30 seconds per request, the 10th user waits 90-270 seconds. This is
architecturally incompatible with a multi-user bot deployment.

### Why serialize:true Was Set

The original setting was a safety measure:
1. Prevent concurrent subprocess spawning from overwhelming the host
2. Avoid race conditions in Claude Code session state
3. Limit memory consumption (each Claude Code subprocess uses ~200-400 MB)
4. Respect the cloud.ru FM rate limit of 15 req/s (ADR-001)

These are valid concerns. Simply setting `serialize: false` without a
controlled concurrency model would create new failure modes: OOM kills,
rate limit exhaustion, and session corruption.

### Impact Assessment (from shift-left testing)

| Metric | serialize:true | Target (ADR-009) |
|--------|---------------|------------------|
| Concurrent users served | 1 | 8-16 |
| P95 response time (5 users) | 75-150s | 15-35s |
| Throughput (requests/minute) | 2-4 | 16-32 |
| User-perceived queue wait | (N-1) * avg_response_time | < 5s for acquire |

### DDD Aggregate: RequestPipeline

The RequestPipeline aggregate manages the lifecycle of concurrent user requests
from ingestion through worker assignment, execution, and response delivery. It
enforces global resource limits, per-tenant fairness, and backpressure policies.

```
Message Ingress
  -> TenantQueue (per-user fair scheduling)
    -> WorkerPool (bounded subprocess pool)
      -> Worker (Claude Code CLI subprocess)
        -> Proxy -> cloud.ru FM -> Response
      -> Worker Release
    -> Response Delivery
```

## Decision

Replace the global `serialize: true` lock with a bounded worker pool that
supports controlled concurrent execution of Claude Code CLI subprocesses.

### 1. Concurrency Model

```typescript
// @openclaw/worker-pool — Core concurrency types

/**
 * Priority levels for request scheduling.
 * Admin requests bypass the tenant queue depth limit.
 */
export enum RequestPriority {
  /** System-level requests (health checks, internal) */
  SYSTEM = 0,
  /** Admin user requests */
  ADMIN = 1,
  /** Regular user requests */
  NORMAL = 2,
  /** Low-priority batch/background requests */
  LOW = 3,
}

/**
 * Identifies a tenant (user) for fair scheduling.
 * In Telegram context, tenantId = chatId or userId.
 * In MAX context, tenantId = userId.
 */
export interface TenantId {
  readonly platform: "telegram" | "max" | "web" | "whatsapp";
  readonly userId: string;
  /** Optional group/chat ID for shared contexts */
  readonly chatId?: string;
}

/**
 * A pending request waiting for worker assignment.
 */
export interface PendingRequest {
  readonly id: string;
  readonly tenantId: TenantId;
  readonly priority: RequestPriority;
  readonly enqueuedAt: number;
  readonly timeoutMs: number;
  readonly sessionId: string;
  readonly message: string;
  /** Backend config resolved from mergeBackendConfig() */
  readonly backendConfig: CliBackendConfig;
  /** Callback to reject the request if it times out in queue */
  readonly abortController: AbortController;
}

/**
 * Represents a Claude Code CLI subprocess worker.
 * Each worker is an independent subprocess with its own memory space.
 */
export interface Worker {
  readonly id: string;
  readonly pid: number | null;
  readonly state: WorkerState;
  readonly assignedTenantId: TenantId | null;
  readonly assignedRequestId: string | null;
  readonly startedAt: number;
  readonly lastActiveAt: number;
  /** Cumulative requests processed by this worker */
  readonly requestsProcessed: number;
  /** Cumulative errors encountered by this worker */
  readonly errorsEncountered: number;
}

export enum WorkerState {
  /** Worker slot available, no subprocess running */
  IDLE = "IDLE",
  /** Subprocess is starting (cold start ~2-5s) */
  STARTING = "STARTING",
  /** Subprocess is processing a request */
  BUSY = "BUSY",
  /** Subprocess is being terminated (graceful shutdown) */
  DRAINING = "DRAINING",
  /** Subprocess has exited, slot can be reused */
  TERMINATED = "TERMINATED",
  /** Subprocess is unresponsive, requires forced kill */
  STUCK = "STUCK",
}
```

### 2. Worker Pool Architecture

```typescript
/**
 * Configuration for the worker pool.
 * Loaded from openclaw.json agents.defaults.workerPool or environment.
 */
export interface WorkerPoolConfig {
  /**
   * Maximum number of concurrent Claude Code CLI subprocesses.
   * Each subprocess uses ~200-400 MB RAM.
   * Default: 4 (suitable for 4 GB VM), max recommended: 16.
   */
  maxWorkers: number;

  /**
   * Minimum number of warm workers kept alive (pre-spawned).
   * Eliminates cold-start latency for the first N concurrent requests.
   * Default: 1.
   */
  minWorkers: number;

  /**
   * Maximum time (ms) a request can wait in queue before rejection.
   * Default: 120_000 (2 minutes).
   */
  queueTimeoutMs: number;

  /**
   * Maximum time (ms) a single request can execute in a worker.
   * Includes subprocess startup + model response time.
   * Default: 180_000 (3 minutes).
   */
  executionTimeoutMs: number;

  /**
   * Maximum queue depth per tenant. Requests beyond this are
   * immediately rejected with HTTP 429-equivalent.
   * Default: 3.
   */
  maxQueueDepthPerTenant: number;

  /**
   * Maximum total queue depth across all tenants.
   * Backpressure: new requests rejected when queue is full.
   * Default: 50.
   */
  maxQueueDepthGlobal: number;

  /**
   * Idle timeout (ms) before a warm worker is terminated.
   * Does not apply to minWorkers.
   * Default: 300_000 (5 minutes).
   */
  workerIdleTimeoutMs: number;

  /**
   * Maximum requests a single worker handles before recycling.
   * Prevents memory leaks in long-running subprocesses.
   * Default: 100.
   */
  maxRequestsPerWorker: number;

  /**
   * Time (ms) to wait for graceful subprocess shutdown before SIGKILL.
   * Default: 10_000 (10 seconds).
   */
  gracefulShutdownMs: number;
}

/**
 * Default configuration suitable for a 4 vCPU / 8 GB Cloud.ru VM.
 */
export const DEFAULT_WORKER_POOL_CONFIG: WorkerPoolConfig = {
  maxWorkers: 4,
  minWorkers: 1,
  queueTimeoutMs: 120_000,
  executionTimeoutMs: 180_000,
  maxQueueDepthPerTenant: 3,
  maxQueueDepthGlobal: 50,
  workerIdleTimeoutMs: 300_000,
  maxRequestsPerWorker: 100,
  gracefulShutdownMs: 10_000,
};

/**
 * The WorkerPool manages a bounded set of Claude Code CLI subprocess
 * workers with fair scheduling across tenants.
 *
 * Replaces the serialize:true global lock from cli-runner.ts:177-178
 * with controlled concurrency.
 */
export interface WorkerPool {
  /** Current pool configuration (immutable after init) */
  readonly config: Readonly<WorkerPoolConfig>;

  /** Map of active workers by worker ID */
  readonly activeWorkers: ReadonlyMap<string, Worker>;

  /** Priority queue of pending requests */
  readonly queue: ReadonlyArray<PendingRequest>;

  /**
   * Acquire a worker for the given request.
   * If no worker is available, the request is queued.
   * Rejects if tenant queue depth exceeded or global queue full.
   *
   * @throws TenantQueueFullError if tenant has >= maxQueueDepthPerTenant pending
   * @throws GlobalQueueFullError if total queue >= maxQueueDepthGlobal
   * @throws QueueTimeoutError if request waits longer than queueTimeoutMs
   */
  acquire(request: PendingRequest): Promise<Worker>;

  /**
   * Release a worker back to the pool after request completion.
   * If pending requests exist, the worker is immediately reassigned.
   * If the worker has exceeded maxRequestsPerWorker, it is recycled.
   */
  release(worker: Worker): void;

  /**
   * Force-terminate a stuck worker (SIGKILL).
   * Used when a worker exceeds executionTimeoutMs.
   */
  kill(workerId: string): Promise<void>;

  /**
   * Gracefully shut down all workers and drain the queue.
   * Pending requests are rejected with ShutdownError.
   */
  shutdown(): Promise<void>;

  /**
   * Get pool health metrics for monitoring.
   */
  getMetrics(): WorkerPoolMetrics;
}
```

### 3. Fair Scheduling Algorithm

The scheduler uses **weighted fair queuing** across tenants to prevent any
single user from monopolizing the worker pool.

```typescript
/**
 * Per-tenant queue state for fair scheduling.
 */
export interface TenantQueueState {
  readonly tenantId: TenantId;
  /** Requests currently queued for this tenant */
  readonly pendingCount: number;
  /** Requests currently being processed for this tenant */
  readonly activeCount: number;
  /** Timestamp of last request completion */
  readonly lastServedAt: number;
  /** Cumulative requests served in current window */
  readonly requestsInWindow: number;
}

/**
 * Scheduling strategy for selecting the next request from the queue.
 *
 * Algorithm:
 * 1. Sort by priority (SYSTEM > ADMIN > NORMAL > LOW)
 * 2. Within same priority, sort by least-recently-served tenant
 * 3. Within same tenant, sort by enqueue time (FIFO)
 *
 * This ensures:
 * - High-priority requests are served first
 * - No tenant starves other tenants
 * - Within a tenant, requests are processed in order
 */
export interface Scheduler {
  /**
   * Select the next request to assign to an available worker.
   * Returns null if the queue is empty.
   */
  next(
    queue: PendingRequest[],
    tenantStates: Map<string, TenantQueueState>,
  ): PendingRequest | null;

  /**
   * Check if a new request from this tenant should be accepted.
   * Returns a rejection reason or null if accepted.
   */
  admissionCheck(
    tenantId: TenantId,
    tenantState: TenantQueueState | undefined,
    globalQueueDepth: number,
    config: WorkerPoolConfig,
  ): AdmissionResult;
}

export type AdmissionResult =
  | { admitted: true }
  | { admitted: false; reason: "tenant_queue_full"; currentDepth: number; maxDepth: number }
  | { admitted: false; reason: "global_queue_full"; currentDepth: number; maxDepth: number }
  | { admitted: false; reason: "rate_limited"; retryAfterMs: number };
```

### 4. Request Lifecycle

```
1. MESSAGE INGRESS
   User sends message on Telegram/MAX/Web
   -> OpenClaw gateway receives message
   -> agent-runner.ts:378 routes to runCliAgent()

2. ADMISSION CHECK
   -> WorkerPool.admissionCheck(tenantId, ...)
   -> IF tenant_queue_full: reject with "Too many pending requests"
   -> IF global_queue_full: reject with "System is busy, try again later"
   -> IF rate_limited: reject with "Rate limited, retry in {N}s"
   -> IF admitted: proceed to step 3

3. ENQUEUE
   -> Create PendingRequest with priority, timeout, abort controller
   -> Add to priority queue
   -> Start queue timeout timer

4. WORKER ACQUISITION
   -> IF idle worker available: assign immediately
   -> IF pool not full: spawn new subprocess worker
   -> ELSE: wait in queue (fair scheduling order)
   -> On timeout: reject with QueueTimeoutError

5. EXECUTION
   -> Worker spawns Claude Code CLI subprocess:
      claude -p --output-format json --dangerously-skip-permissions \
        --model opus --session-id <session-id> \
        --append-system-prompt "<prompt>" "<message>"
   -> Environment: ANTHROPIC_BASE_URL, ANTHROPIC_API_KEY (from ADR-001)
   -> Start execution timeout timer
   -> On timeout: SIGTERM -> wait gracefulShutdownMs -> SIGKILL

6. RESPONSE
   -> Parse JSON response from subprocess stdout
   -> Deliver to user via platform adapter (Telegram/MAX/Web)
   -> Record metrics (latency, success/failure)

7. WORKER RELEASE
   -> If worker.requestsProcessed >= maxRequestsPerWorker: recycle
   -> If pending requests in queue: assign next (fair scheduling)
   -> Else: mark IDLE, start idle timeout timer
   -> On idle timeout (and worker count > minWorkers): terminate
```

### 5. Resource Limits

```typescript
/**
 * Per-tenant resource limits.
 * Can be overridden per-tenant in openclaw.json for premium users.
 */
export interface TenantResourceLimits {
  /** Max concurrent requests being processed for this tenant. Default: 2 */
  maxConcurrentRequests: number;
  /** Max requests queued (waiting for worker). Default: 3 */
  maxQueuedRequests: number;
  /** Max response time before forced termination. Default: 180_000ms */
  maxResponseTimeMs: number;
  /** Rate limit: max requests per window. Default: 20 req / 60s */
  rateLimitRequests: number;
  /** Rate limit window in ms. Default: 60_000 (1 minute) */
  rateLimitWindowMs: number;
}

/**
 * Global resource limits enforced by the worker pool.
 * These are hard ceilings that cannot be overridden per-tenant.
 */
export interface GlobalResourceLimits {
  /** Max total workers (subprocesses). Hard limit. */
  maxWorkers: number;
  /** Max total memory across all workers. Monitored, not enforced by pool. */
  maxTotalMemoryMB: number;
  /** Max requests per second to cloud.ru FM API (ADR-001: 15 req/s). */
  upstreamRateLimitRps: number;
  /** Max total queue depth. Hard limit. */
  maxQueueDepth: number;
}

export const DEFAULT_TENANT_LIMITS: TenantResourceLimits = {
  maxConcurrentRequests: 2,
  maxQueuedRequests: 3,
  maxResponseTimeMs: 180_000,
  rateLimitRequests: 20,
  rateLimitWindowMs: 60_000,
};

export const DEFAULT_GLOBAL_LIMITS: GlobalResourceLimits = {
  maxWorkers: 4,
  maxTotalMemoryMB: 4096,
  upstreamRateLimitRps: 15,
  maxQueueDepth: 50,
};
```

### 6. Monitoring and Observability

```typescript
/**
 * Real-time metrics exposed by the worker pool.
 * Used for Prometheus/Grafana monitoring and auto-scaling decisions.
 */
export interface WorkerPoolMetrics {
  /** Timestamp of metrics snapshot */
  readonly timestamp: number;

  /** --- Worker metrics --- */
  readonly workersTotal: number;
  readonly workersIdle: number;
  readonly workersBusy: number;
  readonly workersStarting: number;
  readonly workersDraining: number;
  readonly workersStuck: number;

  /** --- Queue metrics --- */
  readonly queueDepth: number;
  readonly queueDepthByPriority: Record<RequestPriority, number>;

  /** --- Throughput metrics (last 60s window) --- */
  readonly requestsCompleted: number;
  readonly requestsFailed: number;
  readonly requestsTimedOut: number;
  readonly requestsRejected: number;

  /** --- Latency metrics (last 60s window) --- */
  readonly queueWaitP50Ms: number;
  readonly queueWaitP95Ms: number;
  readonly queueWaitP99Ms: number;
  readonly executionTimeP50Ms: number;
  readonly executionTimeP95Ms: number;
  readonly executionTimeP99Ms: number;
  readonly totalLatencyP50Ms: number;
  readonly totalLatencyP95Ms: number;
  readonly totalLatencyP99Ms: number;

  /** --- Tenant metrics --- */
  readonly activeTenants: number;
  readonly tenantQueueDepths: Map<string, number>;

  /** --- Resource metrics --- */
  readonly estimatedMemoryMB: number;
  readonly cpuUtilizationPercent: number;
}

/**
 * Domain events emitted by the worker pool for observability.
 */
export type WorkerPoolEvent =
  | { type: "worker.spawned"; workerId: string; timestamp: number }
  | { type: "worker.assigned"; workerId: string; requestId: string; tenantId: TenantId; timestamp: number }
  | { type: "worker.released"; workerId: string; requestId: string; durationMs: number; timestamp: number }
  | { type: "worker.recycled"; workerId: string; reason: "max_requests" | "idle_timeout" | "error_threshold"; timestamp: number }
  | { type: "worker.stuck"; workerId: string; stuckDurationMs: number; timestamp: number }
  | { type: "worker.killed"; workerId: string; signal: string; timestamp: number }
  | { type: "request.enqueued"; requestId: string; tenantId: TenantId; priority: RequestPriority; queueDepth: number; timestamp: number }
  | { type: "request.dequeued"; requestId: string; queueWaitMs: number; timestamp: number }
  | { type: "request.completed"; requestId: string; totalMs: number; executionMs: number; timestamp: number }
  | { type: "request.failed"; requestId: string; error: string; timestamp: number }
  | { type: "request.rejected"; tenantId: TenantId; reason: string; timestamp: number }
  | { type: "request.timeout"; requestId: string; phase: "queue" | "execution"; timestamp: number }
  | { type: "pool.backpressure"; queueDepth: number; maxDepth: number; timestamp: number }
  | { type: "pool.shutdown"; pendingDrained: number; timestamp: number };
```

### 7. Performance Model

```
Assumptions:
  - GLM-4.7 average response time: 15s (range: 5-30s)
  - Claude Code cold start: 3s
  - Claude Code warm (--resume): 1s
  - Worker memory: ~300 MB per subprocess
  - cloud.ru rate limit: 15 req/s (ADR-001)
  - Proxy overhead: <100ms per request

Performance by worker count (steady state, warm workers):

| Workers | Max Concurrent | Throughput (req/min) | P95 Queue Wait | RAM Required |
|---------|---------------|---------------------|----------------|-------------|
| 1       | 1             | 4                   | 15s            | 300 MB      |
| 2       | 2             | 8                   | 7.5s           | 600 MB      |
| 4       | 4             | 16                  | ~0s*           | 1.2 GB      |
| 8       | 8             | 32                  | ~0s*           | 2.4 GB      |
| 16      | 16            | 64**               | ~0s*           | 4.8 GB      |

* With fewer users than workers, queue wait approaches 0.
  With more users than workers, queue wait = (overflow / workers) * avg_response.
** Exceeds cloud.ru 15 req/s limit. Rate limiter throttles to ~60 req/min.

Break-even analysis:
  - 1-3 concurrent users: 2 workers sufficient (600 MB)
  - 4-8 concurrent users: 4 workers recommended (1.2 GB)
  - 8-16 concurrent users: 8 workers recommended (2.4 GB)
  - 16+ concurrent users: requires horizontal scaling (multiple OpenClaw instances)
```

### 8. Cloud.ru VM Sizing Recommendations

```
Target: Multi-user Telegram/MAX bot deployment

Tier 1: Small (1-5 users, development/testing)
  - VM: 2 vCPU / 4 GB RAM
  - Workers: 2
  - Estimated cost: ~2000 RUB/month
  - Effective throughput: 8 req/min

Tier 2: Medium (5-15 users, small team)
  - VM: 4 vCPU / 8 GB RAM
  - Workers: 4-6
  - Estimated cost: ~4000 RUB/month
  - Effective throughput: 16-24 req/min

Tier 3: Large (15-50 users, department)
  - VM: 8 vCPU / 16 GB RAM
  - Workers: 8-12
  - Estimated cost: ~8000 RUB/month
  - Effective throughput: 32-48 req/min
  - Note: may hit cloud.ru 15 req/s rate limit under burst

Tier 4: Scale-out (50+ users)
  - Multiple VMs behind load balancer
  - 2-3 OpenClaw instances, each with 4-8 workers
  - Shared session store (Redis) for session affinity
  - Estimated cost: ~20000+ RUB/month
  - Requires ADR for session sharing (not in scope)
```

### 9. Integration with Existing Codebase

The change is isolated to the request pipeline layer. The core modification
is in how `cli-runner.ts:177-178` resolves the queue key:

```typescript
// BEFORE (ADR-003, current):
const serialize = backend.serialize ?? true;
const queueKey = serialize ? backendResolved.id : `${backendResolved.id}:${params.runId}`;
// -> All requests serialized behind one key

// AFTER (ADR-009):
// serialize: true is ignored when workerPool is configured.
// The WorkerPool replaces the CLI_RUN_QUEUE promise chain entirely.
if (workerPool) {
  return workerPool.acquire(pendingRequest).then((worker) => {
    return executeOnWorker(worker, params).finally(() => {
      workerPool.release(worker);
    });
  });
} else {
  // Fallback: legacy serialize behavior for non-pooled deployments
  const serialize = backend.serialize ?? true;
  const queueKey = serialize
    ? backendResolved.id
    : `${backendResolved.id}:${params.runId}`;
  return enqueueCliRun(queueKey, () => spawnCliProcess(params));
}
```

### 10. Configuration in openclaw.json

```json
{
  "agents": {
    "defaults": {
      "workerPool": {
        "enabled": true,
        "maxWorkers": 4,
        "minWorkers": 1,
        "queueTimeoutMs": 120000,
        "executionTimeoutMs": 180000,
        "maxQueueDepthPerTenant": 3,
        "maxQueueDepthGlobal": 50,
        "workerIdleTimeoutMs": 300000,
        "maxRequestsPerWorker": 100
      },
      "cliBackends": {
        "claude-cli": {
          "serialize": false,
          "env": {
            "ANTHROPIC_BASE_URL": "http://localhost:8082",
            "ANTHROPIC_API_KEY": "cloudru-proxy-key"
          }
        }
      }
    }
  }
}
```

When `workerPool.enabled` is `true`, the pool takes over concurrency
management regardless of the `serialize` flag. When `workerPool.enabled`
is `false` or absent, the legacy `serialize` behavior from ADR-003 applies.
This provides a safe migration path.

### 11. Error Handling

```typescript
/**
 * Error types specific to the worker pool.
 * All extend the base Error and include structured metadata.
 */

export class TenantQueueFullError extends Error {
  constructor(
    readonly tenantId: TenantId,
    readonly currentDepth: number,
    readonly maxDepth: number,
  ) {
    super(
      `Tenant ${tenantId.userId} queue full: ${currentDepth}/${maxDepth} pending requests`,
    );
    this.name = "TenantQueueFullError";
  }
}

export class GlobalQueueFullError extends Error {
  constructor(
    readonly currentDepth: number,
    readonly maxDepth: number,
  ) {
    super(
      `Global queue full: ${currentDepth}/${maxDepth} pending requests`,
    );
    this.name = "GlobalQueueFullError";
  }
}

export class QueueTimeoutError extends Error {
  constructor(
    readonly requestId: string,
    readonly waitedMs: number,
    readonly timeoutMs: number,
  ) {
    super(
      `Request ${requestId} timed out in queue after ${waitedMs}ms (limit: ${timeoutMs}ms)`,
    );
    this.name = "QueueTimeoutError";
  }
}

export class ExecutionTimeoutError extends Error {
  constructor(
    readonly requestId: string,
    readonly workerId: string,
    readonly elapsedMs: number,
    readonly timeoutMs: number,
  ) {
    super(
      `Request ${requestId} execution timed out on worker ${workerId} after ${elapsedMs}ms (limit: ${timeoutMs}ms)`,
    );
    this.name = "ExecutionTimeoutError";
  }
}

export class WorkerCrashError extends Error {
  constructor(
    readonly workerId: string,
    readonly exitCode: number | null,
    readonly signal: string | null,
    readonly stderr: string,
  ) {
    super(
      `Worker ${workerId} crashed: exit=${exitCode}, signal=${signal}`,
    );
    this.name = "WorkerCrashError";
  }
}

/**
 * Maps worker pool errors to user-facing messages.
 * These are delivered via the platform adapter (Telegram/MAX/Web).
 */
export function toUserMessage(error: Error): string {
  if (error instanceof TenantQueueFullError) {
    return "You have too many pending requests. Please wait for a response before sending more messages.";
  }
  if (error instanceof GlobalQueueFullError) {
    return "The system is currently busy. Please try again in a moment.";
  }
  if (error instanceof QueueTimeoutError) {
    return "Your request waited too long in the queue. Please try again.";
  }
  if (error instanceof ExecutionTimeoutError) {
    return "The response took too long to generate. Please try a simpler request.";
  }
  if (error instanceof WorkerCrashError) {
    return "An internal error occurred. Please try again.";
  }
  return "An unexpected error occurred. Please try again later.";
}
```

### 12. Upstream Rate Limit Integration

The cloud.ru FM API enforces a 15 req/s rate limit (ADR-001). With multiple
concurrent workers, the pool must enforce this limit to prevent 429 errors
from propagating as model failures through the fallback chain (ADR-005).

```typescript
/**
 * Token-bucket rate limiter for upstream API calls.
 * Shared across all workers to respect cloud.ru's 15 req/s limit.
 *
 * When a worker is about to spawn a Claude Code subprocess, it must
 * acquire a token. If no token is available, the request waits
 * (not rejected) until a token becomes available.
 */
export interface UpstreamRateLimiter {
  /** Maximum tokens (requests) per second. From ADR-001: 15. */
  readonly maxTokensPerSecond: number;

  /**
   * Acquire a token. Resolves when a token is available.
   * Does not reject; waits until capacity is available.
   * Respects abort signal for cancellation.
   */
  acquire(signal?: AbortSignal): Promise<void>;

  /**
   * Current available tokens (0 to maxTokensPerSecond).
   */
  available(): number;
}
```

## Consequences

### Positive

- Multiple users served concurrently (target: 4-16 depending on VM size)
- Fair scheduling prevents any single user from starving others
- Backpressure mechanism provides graceful degradation under load
- Per-tenant queue limits prevent abuse
- Priority lanes allow admin bypass during congestion
- Rate limiter prevents cloud.ru 429 cascades
- Monitoring metrics enable capacity planning and auto-scaling
- Backward compatible: legacy serialize mode preserved as fallback
- Configuration-driven: worker count tunable without code changes

### Negative

- Increased memory consumption (300 MB per worker vs 300 MB total with serialize:true)
- More complex failure modes (stuck workers, pool exhaustion, race conditions)
- Requires careful testing of subprocess lifecycle management
- Worker recycling adds occasional cold-start latency
- Session state isolation between workers must be verified (Claude Code sessions
  are file-based per `--session-id`, so concurrent workers with different sessions
  should not conflict, but this requires validation)

### Risks

| Risk | Probability | Impact | Mitigation |
|------|:-----------:|:------:|-----------|
| OOM on small VMs | Medium | High | Default maxWorkers=4, memory monitoring, VM sizing guide |
| Claude Code session corruption | Low | High | Each session has unique `--session-id`, file-level isolation |
| cloud.ru rate limit exceeded | Medium | Medium | Token-bucket rate limiter, 15 req/s cap |
| Stuck workers accumulate | Low | High | Execution timeout + SIGKILL, stuck detection, worker recycling |
| Queue starvation for low-priority | Low | Low | Fair scheduling algorithm, minimum service guarantee |
| Cold-start latency on scale-up | Medium | Low | minWorkers warm pool, pre-warming on startup |

### Invariants (DDD)

1. **Worker Count Bounded**: `activeWorkers.size <= config.maxWorkers` at all times.
   Violation is a fatal error that triggers pool shutdown.
2. **Tenant Queue Bounded**: No tenant may have more than `maxQueueDepthPerTenant`
   pending requests. Enforced at admission.
3. **Global Queue Bounded**: Total queue depth never exceeds `maxQueueDepthGlobal`.
   Enforced at admission.
4. **Request Monotonicity**: Within a single tenant, requests are processed in
   FIFO order (no reordering within same priority level).
5. **Worker Exclusivity**: Each worker processes exactly one request at a time.
   A worker in BUSY state is never assigned a second request.
6. **Upstream Rate Invariant**: Effective request rate to cloud.ru FM API never
   exceeds `upstreamRateLimitRps` (15 req/s from ADR-001).
7. **Graceful Degradation**: When the pool is at capacity, new requests are
   queued (not dropped) until queue limits are reached. Only then are requests
   rejected with structured error messages.

### Module Boundary: `@openclaw/worker-pool`

```
@openclaw/worker-pool/
  src/
    index.ts                   -- Public API exports
    types.ts                   -- All interfaces and types from this ADR
    worker-pool.ts             -- WorkerPool implementation
    scheduler.ts               -- Fair scheduling algorithm
    rate-limiter.ts            -- Token-bucket upstream rate limiter
    worker.ts                  -- Worker lifecycle (spawn/kill/recycle)
    metrics.ts                 -- Prometheus-compatible metrics collector
    errors.ts                  -- Error classes and user-message mapping
    config.ts                  -- Config loading and validation
  tests/
    worker-pool.test.ts        -- Pool lifecycle and concurrency tests
    scheduler.test.ts          -- Fair scheduling algorithm tests
    rate-limiter.test.ts       -- Rate limiter token bucket tests
    worker.test.ts             -- Worker spawn/kill/recycle tests
    integration.test.ts        -- End-to-end with mock subprocess
```

**Dependency Direction**: `@openclaw/worker-pool` depends on nothing from
OpenClaw core. OpenClaw's `cli-runner.ts` imports from `@openclaw/worker-pool`.
This is a leaf module with no circular dependencies.

**Integration Surface**: The only integration point is `cli-runner.ts:177-178`
where the current `enqueueCliRun()` call is replaced with
`workerPool.acquire()` / `workerPool.release()`. All other OpenClaw code
(agent-runner, platform adapters, session management) is unchanged.

## Alternatives Considered

1. **`serialize: false` without pool** -- Simply removing serialization
   allows unlimited concurrent subprocesses. This was rejected because it
   provides no backpressure, no rate limiting, no fair scheduling, and risks
   OOM kills.

2. **Process-per-user model** -- One long-running Claude Code subprocess
   per registered user. Rejected because memory grows linearly with user
   count regardless of activity, and idle processes waste resources.

3. **Horizontal scaling only** -- Multiple OpenClaw instances behind a load
   balancer, each with `serialize: true`. Rejected as the first step because
   it requires shared session storage and does not solve the single-instance
   bottleneck for small deployments.

4. **Direct API integration (bypass Claude Code)** -- Call cloud.ru FM API
   directly without Claude Code subprocess overhead. Rejected because it
   loses the agentic architecture benefits documented in ADR-003 (multi-step
   reasoning, session persistence, CLAUDE.md instructions).

## References

- `src/agents/cli-backends.ts:52` -- `serialize: true` (current setting)
- `src/agents/cli-runner.ts:177-178` -- Queue key resolution
- `src/agents/helpers.ts:152-162` -- `enqueueCliRun()` promise chaining
- ADR-001: cloud.ru FM rate limit (15 req/s)
- ADR-003: Claude Code subprocess execution model
- ADR-005: Model fallback chain (affected by concurrent 429 errors)
- Risk Register R004: `serialize:true` bottleneck
- Shift-Left WARNING-002: `serialize:true` queueing impact
- QCSD MQ-13: Global single-request bottleneck finding
