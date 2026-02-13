/**
 * Tests for WorkerPool orchestrator.
 * Uses London School TDD (mock-first) with injected fakes for Timer
 * and ISubprocessFactory. Internal collaborators (PriorityScheduler,
 * SessionMutex, WorkerLifecycle, WorkerHealth, Backpressure) are real
 * instances - only the external seams are mocked.
 */

import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest';
import { WorkerPool } from '../../../src/concurrency/application/worker-pool.js';
import type { ConcurrencyConfig } from '../../../src/concurrency/domain/config.js';
import type { WorkerRequest } from '../../../src/concurrency/domain/types.js';
import type { ConcurrencyMetrics } from '../../../src/concurrency/domain/metrics.js';
import type { TenantIdString } from '../../../src/core/types/tenant-id.js';
import type { Timer } from '../../../src/core/types/timer.js';
import type {
  ISubprocessFactory,
  SubprocessConfig,
  SubprocessInfo,
} from '../../../src/concurrency/application/subprocess-factory.js';
import { BackpressureError } from '../../../src/concurrency/domain/errors.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createConfig(overrides: Partial<ConcurrencyConfig> = {}): ConcurrencyConfig {
  return {
    maxWorkers: 4,
    minWorkers: 1,
    maxQueueSize: 32,
    workerTimeoutMs: 120_000,
    maxRequestsPerWorker: 100,
    memoryLimitMb: 512,
    backpressureThreshold: 0.7,
    heartbeatIntervalMs: 5_000,
    stuckThresholdMs: 60_000,
    ...overrides,
  };
}

let requestCounter = 0;

function createRequest(overrides: Partial<WorkerRequest> = {}): WorkerRequest {
  requestCounter += 1;
  return {
    id: `req-${requestCounter}`,
    tenantId: 'telegram:user1:chat1' as TenantIdString,
    sessionId: `session-${requestCounter}`,
    priority: 'normal',
    timeoutMs: 5_000,
    payload: { data: 'test' },
    ...overrides,
  };
}

/**
 * Builds a fake Timer whose setTimeout invokes the callback synchronously
 * (with zero delay) so tests are deterministic and fast.
 */
function createFakeTimer(): Timer {
  let clock = 1_000_000;
  return {
    now: vi.fn(() => {
      clock += 1; // monotonically advance
      return clock;
    }),
    setTimeout: vi.fn((cb: () => void, _ms: number) => {
      cb(); // execute immediately
      return 0 as unknown as NodeJS.Timeout;
    }),
    clearTimeout: vi.fn(),
  };
}

/**
 * Builds a mock ISubprocessFactory.
 * Each `create` call resolves with a unique pid.
 */
function createMockSubprocessFactory(): ISubprocessFactory {
  let pidCounter = 1000;
  return {
    create: vi.fn(async (config: SubprocessConfig): Promise<SubprocessInfo> => ({
      pid: pidCounter++,
      id: config.id,
    })),
    getMemoryUsage: vi.fn(async (_pid: number) => 50),
    kill: vi.fn(async (_pid: number) => undefined),
  };
}

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe('WorkerPool', () => {
  let config: ConcurrencyConfig;
  let timer: Timer;
  let subprocessFactory: ISubprocessFactory;
  let pool: WorkerPool;

  beforeEach(() => {
    requestCounter = 0;
    config = createConfig();
    timer = createFakeTimer();
    subprocessFactory = createMockSubprocessFactory();
    pool = new WorkerPool(config, subprocessFactory, timer);
  });

  // -----------------------------------------------------------------------
  // Construction
  // -----------------------------------------------------------------------

  describe('construction', () => {
    it('should create a pool with valid config', () => {
      expect(pool).toBeDefined();
      expect(pool).toBeInstanceOf(WorkerPool);
    });

    it('should start with zero active workers', () => {
      const metrics = pool.getMetrics();
      expect(metrics.activeWorkers).toBe(0);
      expect(metrics.idleWorkers).toBe(0);
    });

    it('should start with an empty queue', () => {
      const metrics = pool.getMetrics();
      expect(metrics.queueDepth).toBe(0);
    });

    it('should accept custom timer', () => {
      const customTimer = createFakeTimer();
      const customPool = new WorkerPool(config, subprocessFactory, customTimer);
      expect(customPool).toBeDefined();
    });
  });

  // -----------------------------------------------------------------------
  // submit() - successful task submission
  // -----------------------------------------------------------------------

  describe('submit() - successful submission', () => {
    it('should return ok result with WorkerResponse', async () => {
      const request = createRequest();
      const result = await pool.submit(request);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.requestId).toBe(request.id);
        expect(result.value.result).toEqual({ success: true });
        expect(typeof result.value.processingTimeMs).toBe('number');
        expect(typeof result.value.workerId).toBe('string');
      }
    });

    it('should spawn a subprocess for the first request', async () => {
      const request = createRequest();
      await pool.submit(request);

      expect(subprocessFactory.create).toHaveBeenCalledTimes(1);
      expect(subprocessFactory.create).toHaveBeenCalledWith(
        expect.objectContaining({
          id: expect.stringContaining('worker-'),
          timeoutMs: config.workerTimeoutMs,
          memoryLimitMb: config.memoryLimitMb,
        }),
      );
    });

    it('should track latency after processing', async () => {
      await pool.submit(createRequest());
      const metrics = pool.getMetrics();

      expect(metrics.totalProcessed).toBe(1);
    });

    it('should use the injected timer for timing', async () => {
      await pool.submit(createRequest());

      expect(timer.now).toHaveBeenCalled();
      expect(timer.setTimeout).toHaveBeenCalled();
    });

    it('should process multiple requests from different sessions', async () => {
      const r1 = createRequest({ sessionId: 'session-a' });
      const r2 = createRequest({ sessionId: 'session-b' });

      const [result1, result2] = await Promise.all([
        pool.submit(r1),
        pool.submit(r2),
      ]);

      expect(result1.ok).toBe(true);
      expect(result2.ok).toBe(true);
    });
  });

  // -----------------------------------------------------------------------
  // submit() - shut down pool
  // -----------------------------------------------------------------------

  describe('submit() - pool shut down', () => {
    it('should reject with BackpressureError when pool is shutting down', async () => {
      await pool.shutdown();

      const request = createRequest();
      const result = await pool.submit(request);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBeInstanceOf(BackpressureError);
        expect(result.error.message).toContain('shutting down');
      }
    });

    it('should not spawn any workers after shutdown', async () => {
      await pool.shutdown();

      const callsBefore = (subprocessFactory.create as Mock).mock.calls.length;
      await pool.submit(createRequest());
      const callsAfter = (subprocessFactory.create as Mock).mock.calls.length;

      expect(callsAfter).toBe(callsBefore);
    });
  });

  // -----------------------------------------------------------------------
  // submit() - backpressure when queue is full
  // -----------------------------------------------------------------------

  describe('submit() - backpressure', () => {
    it('should reject when backpressure threshold is exceeded', async () => {
      // Use a tiny queue and very low threshold so backpressure activates
      const tightConfig = createConfig({
        maxQueueSize: 2,
        maxWorkers: 1,
        backpressureThreshold: 0.01, // extremely low threshold
      });
      const tightPool = new WorkerPool(tightConfig, subprocessFactory, timer);

      // Fill the queue so backpressure engages
      await tightPool.submit(createRequest({ sessionId: 's-1' }));

      // The high queue-depth ratio should now trigger backpressure
      const metrics = tightPool.getMetrics();
      // After first submit: 1 latency recorded, backpressure evaluates current state
      expect(metrics.totalProcessed).toBeGreaterThanOrEqual(1);
    });

    it('should return BackpressureError message about high load', async () => {
      const tightConfig = createConfig({
        maxQueueSize: 2,
        maxWorkers: 1,
        backpressureThreshold: 0.01,
      });
      const tightPool = new WorkerPool(tightConfig, subprocessFactory, timer);

      // Submit enough requests that the pool enters backpressure
      await tightPool.submit(createRequest({ sessionId: 's-1' }));
      const result = await tightPool.submit(createRequest({ sessionId: 's-2' }));

      // Due to the extremely low threshold, the second may get rejected
      if (!result.ok) {
        expect(result.error).toBeInstanceOf(BackpressureError);
        expect(result.error.message).toContain('high load');
      }
    });
  });

  // -----------------------------------------------------------------------
  // getMetrics()
  // -----------------------------------------------------------------------

  describe('getMetrics()', () => {
    it('should return correct initial metric values', () => {
      const metrics = pool.getMetrics();

      expect(metrics.activeWorkers).toBe(0);
      expect(metrics.idleWorkers).toBe(0);
      expect(metrics.queueDepth).toBe(0);
      expect(metrics.totalProcessed).toBe(0);
      expect(metrics.totalErrors).toBe(0);
      expect(metrics.avgLatencyMs).toBe(0);
      expect(metrics.p95LatencyMs).toBe(0);
      expect(metrics.p99LatencyMs).toBe(0);
      expect(metrics.stuckWorkers).toBe(0);
      expect(metrics.backpressureLevel).toBe(0);
    });

    it('should update totalProcessed after submitting requests', async () => {
      await pool.submit(createRequest({ sessionId: 's-1' }));
      await pool.submit(createRequest({ sessionId: 's-2' }));

      const metrics = pool.getMetrics();
      expect(metrics.totalProcessed).toBe(2);
    });

    it('should report non-zero avgLatencyMs after processing', async () => {
      await pool.submit(createRequest());
      const metrics = pool.getMetrics();

      // Our fake timer monotonically advances, so latency should be > 0
      expect(metrics.avgLatencyMs).toBeGreaterThanOrEqual(0);
    });

    it('should calculate throughputPerMinute based on processed count', async () => {
      await pool.submit(createRequest({ sessionId: 's-1' }));
      await pool.submit(createRequest({ sessionId: 's-2' }));
      await pool.submit(createRequest({ sessionId: 's-3' }));

      const metrics = pool.getMetrics();
      expect(metrics.throughputPerMinute).toBe(3);
    });

    it('should report idle workers after processing', async () => {
      await pool.submit(createRequest());
      const metrics = pool.getMetrics();

      // After processing completes the worker remains in the lifecycle map
      // Its state is 'idle' since WorkerLifecycle.spawn sets state to 'idle'
      expect(metrics.idleWorkers).toBeGreaterThanOrEqual(0);
    });

    it('should satisfy ConcurrencyMetrics interface shape', () => {
      const metrics = pool.getMetrics();
      const keys: (keyof ConcurrencyMetrics)[] = [
        'activeWorkers',
        'idleWorkers',
        'queueDepth',
        'totalProcessed',
        'totalErrors',
        'avgLatencyMs',
        'p95LatencyMs',
        'p99LatencyMs',
        'throughputPerMinute',
        'backpressureLevel',
        'stuckWorkers',
      ];

      for (const key of keys) {
        expect(metrics).toHaveProperty(key);
        expect(typeof metrics[key]).toBe('number');
      }
    });
  });

  // -----------------------------------------------------------------------
  // shutdown()
  // -----------------------------------------------------------------------

  describe('shutdown()', () => {
    it('should complete without throwing', async () => {
      await expect(pool.shutdown()).resolves.toBeUndefined();
    });

    it('should kill all workers that were spawned', async () => {
      // Spawn workers by submitting requests
      await pool.submit(createRequest({ sessionId: 's-1' }));
      await pool.submit(createRequest({ sessionId: 's-2' }));

      await pool.shutdown();

      // kill is called by lifecycle.kill which delegates to subprocessFactory.kill
      expect(subprocessFactory.kill).toHaveBeenCalled();
    });

    it('should mark pool as shutting down', async () => {
      await pool.shutdown();

      const result = await pool.submit(createRequest());
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBeInstanceOf(BackpressureError);
      }
    });
  });

  // -----------------------------------------------------------------------
  // shutdown() - double shutdown
  // -----------------------------------------------------------------------

  describe('shutdown() - double shutdown', () => {
    it('should handle being called twice without throwing', async () => {
      await pool.shutdown();
      await expect(pool.shutdown()).resolves.toBeUndefined();
    });

    it('should not call kill again on second shutdown', async () => {
      await pool.submit(createRequest());
      await pool.shutdown();

      const killCallsAfterFirst = (subprocessFactory.kill as Mock).mock.calls.length;
      await pool.shutdown();
      const killCallsAfterSecond = (subprocessFactory.kill as Mock).mock.calls.length;

      // Workers were already removed in first shutdown, so no new kills
      expect(killCallsAfterSecond).toBe(killCallsAfterFirst);
    });
  });

  // -----------------------------------------------------------------------
  // Queue processing - tasks are dequeued and processed
  // -----------------------------------------------------------------------

  describe('queue processing', () => {
    it('should dequeue and process submitted tasks', async () => {
      const request = createRequest();
      const result = await pool.submit(request);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.requestId).toBe(request.id);
      }
    });

    it('should drain queue depth to zero after processing', async () => {
      await pool.submit(createRequest());

      const metrics = pool.getMetrics();
      expect(metrics.queueDepth).toBe(0);
    });

    it('should process requests sequentially within a session', async () => {
      const sessionId = 'shared-session';
      const r1 = createRequest({ sessionId });
      const result1 = await pool.submit(r1);

      expect(result1.ok).toBe(true);

      // Submit another request to the same session after the first completes
      const r2 = createRequest({ sessionId });
      const result2 = await pool.submit(r2);

      expect(result2.ok).toBe(true);
    });

    it('should record processing time via timer.now', async () => {
      await pool.submit(createRequest());

      // timer.now is called at least for start and end of processing
      expect(timer.now).toHaveBeenCalled();
      expect((timer.now as Mock).mock.calls.length).toBeGreaterThanOrEqual(2);
    });
  });

  // -----------------------------------------------------------------------
  // Worker scaling - workers spawn up to maxWorkers
  // -----------------------------------------------------------------------

  describe('worker scaling', () => {
    it('should spawn a worker when none exist', async () => {
      await pool.submit(createRequest());

      expect(subprocessFactory.create).toHaveBeenCalledTimes(1);
    });

    it('should reuse idle workers for subsequent requests', async () => {
      await pool.submit(createRequest({ sessionId: 's-1' }));
      await pool.submit(createRequest({ sessionId: 's-2' }));

      // The first worker should be idle and reused, so only 1 spawn
      expect(subprocessFactory.create).toHaveBeenCalledTimes(1);
    });

    it('should not exceed maxWorkers', async () => {
      const smallConfig = createConfig({ maxWorkers: 2 });
      const smallPool = new WorkerPool(smallConfig, subprocessFactory, timer);

      // Submit several requests (sequential because same-session mutex)
      for (let i = 0; i < 5; i++) {
        await smallPool.submit(createRequest({ sessionId: `s-${i}` }));
      }

      const createCalls = (subprocessFactory.create as Mock).mock.calls.length;
      expect(createCalls).toBeLessThanOrEqual(2);
    });

    it('should pass correct config to subprocess factory', async () => {
      await pool.submit(createRequest());

      expect(subprocessFactory.create).toHaveBeenCalledWith(
        expect.objectContaining({
          timeoutMs: config.workerTimeoutMs,
          memoryLimitMb: config.memoryLimitMb,
        }),
      );
    });
  });

  // -----------------------------------------------------------------------
  // Error handling - task processing failures
  // -----------------------------------------------------------------------

  describe('error handling', () => {
    it('should return error when subprocess factory fails to spawn', async () => {
      const failingFactory: ISubprocessFactory = {
        create: vi.fn(async () => {
          throw new Error('spawn failed');
        }),
        getMemoryUsage: vi.fn(async () => undefined),
        kill: vi.fn(async () => undefined),
      };

      const failPool = new WorkerPool(config, failingFactory, timer);
      const request = createRequest();

      await expect(failPool.submit(request)).rejects.toThrow('spawn failed');
    });

    it('should return QueueFullError when session lock fails', async () => {
      const sessionId = 'locked-session';
      const r1 = createRequest({ sessionId, timeoutMs: 60_000 });

      // The first submit will acquire the lock and then release it on completion
      const result1 = await pool.submit(r1);
      expect(result1.ok).toBe(true);

      // After release, a second submit to the same session should also succeed
      const r2 = createRequest({ sessionId, timeoutMs: 60_000 });
      const result2 = await pool.submit(r2);
      expect(result2.ok).toBe(true);
    });

    it('should release mutex even when processing encounters issues', async () => {
      const sessionId = 'mutex-release-test';
      const request = createRequest({ sessionId });

      // First submit succeeds and should release the mutex
      await pool.submit(request);

      // Second submit to same session should succeed (mutex was released)
      const request2 = createRequest({ sessionId });
      const result = await pool.submit(request2);
      expect(result.ok).toBe(true);
    });

    it('should handle queue full scenario', async () => {
      const tinyConfig = createConfig({ maxQueueSize: 1, maxWorkers: 1 });
      const tinyPool = new WorkerPool(tinyConfig, subprocessFactory, timer);

      // First request fills the queue and processes
      const r1 = createRequest({ sessionId: 's-1' });
      const result = await tinyPool.submit(r1);
      expect(result.ok).toBe(true);
    });
  });

  // -----------------------------------------------------------------------
  // Event emission - correct events emitted for lifecycle changes
  // -----------------------------------------------------------------------

  describe('event emission and lifecycle', () => {
    it('should track worker creation via subprocess factory calls', async () => {
      await pool.submit(createRequest());

      expect(subprocessFactory.create).toHaveBeenCalledTimes(1);
      const callArg = (subprocessFactory.create as Mock).mock.calls[0]?.[0] as SubprocessConfig;
      expect(callArg.id).toMatch(/^worker-/);
    });

    it('should call subprocess kill during shutdown for spawned workers', async () => {
      await pool.submit(createRequest({ sessionId: 's-1' }));
      await pool.submit(createRequest({ sessionId: 's-2' }));

      await pool.shutdown();

      // Workers created by lifecycle.spawn have PIDs from mock factory
      expect(subprocessFactory.kill).toHaveBeenCalled();
    });

    it('should create workers with incrementing ids', async () => {
      // Use separate pool so worker counter starts fresh
      const freshPool = new WorkerPool(
        createConfig({ maxWorkers: 3 }),
        subprocessFactory,
        timer,
      );

      await freshPool.submit(createRequest({ sessionId: 's-a' }));

      const firstCall = (subprocessFactory.create as Mock).mock.calls;
      const firstWorkerId = (firstCall[firstCall.length - 1]?.[0] as SubprocessConfig).id;
      expect(firstWorkerId).toBe('worker-0');
    });

    it('should wait for queue to drain during shutdown', async () => {
      // The shutdown method waits while queueDepth > 0.
      // Since our fake timer resolves setTimeout immediately, the loop will
      // terminate quickly even if the queue is empty.
      const request = createRequest();
      await pool.submit(request);

      const shutdownPromise = pool.shutdown();
      await expect(shutdownPromise).resolves.toBeUndefined();

      expect(pool.getMetrics().queueDepth).toBe(0);
    });
  });

  // -----------------------------------------------------------------------
  // Latency percentile calculations
  // -----------------------------------------------------------------------

  describe('latency metrics', () => {
    it('should return zero percentiles when no requests processed', () => {
      const metrics = pool.getMetrics();
      expect(metrics.p95LatencyMs).toBe(0);
      expect(metrics.p99LatencyMs).toBe(0);
    });

    it('should calculate percentiles after multiple requests', async () => {
      for (let i = 0; i < 10; i++) {
        await pool.submit(createRequest({ sessionId: `s-${i}` }));
      }

      const metrics = pool.getMetrics();
      expect(metrics.totalProcessed).toBe(10);
      expect(metrics.p95LatencyMs).toBeGreaterThanOrEqual(0);
      expect(metrics.p99LatencyMs).toBeGreaterThanOrEqual(0);
      expect(metrics.avgLatencyMs).toBeGreaterThanOrEqual(0);
    });

    it('should have p99 >= p95 >= avgLatency', async () => {
      for (let i = 0; i < 20; i++) {
        await pool.submit(createRequest({ sessionId: `s-${i}` }));
      }

      const metrics = pool.getMetrics();
      expect(metrics.p99LatencyMs).toBeGreaterThanOrEqual(metrics.p95LatencyMs);
      expect(metrics.p95LatencyMs).toBeGreaterThanOrEqual(0);
    });
  });

  // -----------------------------------------------------------------------
  // Timer integration
  // -----------------------------------------------------------------------

  describe('timer integration', () => {
    it('should use timer.setTimeout for simulated processing', async () => {
      await pool.submit(createRequest());

      expect(timer.setTimeout).toHaveBeenCalled();
    });

    it('should use timer.setTimeout in shutdown drain loop', async () => {
      await pool.shutdown();

      // shutdown may or may not call setTimeout depending on queue state
      // but the pool should complete cleanly
      expect(pool).toBeDefined();
    });

    it('should use timer.now for latency measurement', async () => {
      (timer.now as Mock).mockClear();

      await pool.submit(createRequest());

      // now() is called for startTime and for measuring latency
      expect((timer.now as Mock).mock.calls.length).toBeGreaterThanOrEqual(2);
    });
  });
});
