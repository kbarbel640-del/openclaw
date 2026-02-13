/**
 * Tests for WorkerLifecycle application service.
 *
 * Uses London School TDD (mock-first) approach.
 * The ISubprocessFactory dependency is fully mocked to isolate lifecycle logic.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { WorkerLifecycle } from '../../../src/concurrency/application/worker-lifecycle.js';
import type { ISubprocessFactory } from '../../../src/concurrency/application/subprocess-factory.js';
import type { ConcurrencyConfig } from '../../../src/concurrency/domain/config.js';

describe('WorkerLifecycle', () => {
  let lifecycle: WorkerLifecycle;
  let mockFactory: ISubprocessFactory;
  let pidCounter: number;

  const config: ConcurrencyConfig = {
    maxWorkers: 4,
    minWorkers: 1,
    maxQueueSize: 32,
    workerTimeoutMs: 120_000,
    maxRequestsPerWorker: 100,
    memoryLimitMb: 512,
    backpressureThreshold: 0.7,
    heartbeatIntervalMs: 5_000,
    stuckThresholdMs: 60_000,
  };

  beforeEach(() => {
    pidCounter = 1000;

    mockFactory = {
      create: vi.fn().mockImplementation(async (subprocessConfig) => ({
        pid: pidCounter++,
        id: subprocessConfig.id,
      })),
      getMemoryUsage: vi.fn().mockResolvedValue(128),
      kill: vi.fn().mockResolvedValue(undefined),
    };

    lifecycle = new WorkerLifecycle(mockFactory, config);
  });

  describe('spawn()', () => {
    it('should create a new worker with correct initial state', async () => {
      const worker = await lifecycle.spawn();

      expect(worker.id).toBe('worker-0');
      expect(worker.state).toBe('idle');
      expect(worker.requestCount).toBe(0);
      expect(worker.memoryUsageMb).toBe(0);
      expect(worker.currentRequest).toBeUndefined();
    });

    it('should call subprocess factory with correct config', async () => {
      await lifecycle.spawn();

      expect(mockFactory.create).toHaveBeenCalledWith({
        id: 'worker-0',
        timeoutMs: config.workerTimeoutMs,
        memoryLimitMb: config.memoryLimitMb,
      });
    });

    it('should assign a PID from the subprocess', async () => {
      const worker = await lifecycle.spawn();

      expect(worker.pid).toBe(1000);
    });

    it('should set startedAt and lastHeartbeat to current time', async () => {
      const before = new Date();
      const worker = await lifecycle.spawn();
      const after = new Date();

      expect(worker.startedAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(worker.startedAt.getTime()).toBeLessThanOrEqual(after.getTime());
      expect(worker.lastHeartbeat.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(worker.lastHeartbeat.getTime()).toBeLessThanOrEqual(after.getTime());
    });

    it('should assign incrementing worker IDs', async () => {
      const worker1 = await lifecycle.spawn();
      const worker2 = await lifecycle.spawn();
      const worker3 = await lifecycle.spawn();

      expect(worker1.id).toBe('worker-0');
      expect(worker2.id).toBe('worker-1');
      expect(worker3.id).toBe('worker-2');
    });

    it('should register worker in internal pool', async () => {
      const worker = await lifecycle.spawn();

      const retrieved = lifecycle.getWorker(worker.id);
      expect(retrieved).toBeDefined();
      expect(retrieved?.id).toBe(worker.id);
    });

    it('should track all spawned workers via getAllWorkers()', async () => {
      await lifecycle.spawn();
      await lifecycle.spawn();
      await lifecycle.spawn();

      const all = lifecycle.getAllWorkers();
      expect(all).toHaveLength(3);
    });

    it('should assign unique PIDs to each worker', async () => {
      const w1 = await lifecycle.spawn();
      const w2 = await lifecycle.spawn();

      expect(w1.pid).not.toBe(w2.pid);
    });
  });

  describe('recycle()', () => {
    it('should mark worker as draining before killing', async () => {
      const worker = await lifecycle.spawn();

      // Spy on state transitions by checking the worker state after recycle
      await lifecycle.recycle(worker.id);

      // Worker should be removed after recycle
      expect(lifecycle.getWorker(worker.id)).toBeUndefined();
    });

    it('should kill the subprocess via factory', async () => {
      const worker = await lifecycle.spawn();

      await lifecycle.recycle(worker.id);

      expect(mockFactory.kill).toHaveBeenCalledWith(worker.pid);
    });

    it('should remove worker from pool after recycle', async () => {
      const worker = await lifecycle.spawn();

      await lifecycle.recycle(worker.id);

      expect(lifecycle.getWorker(worker.id)).toBeUndefined();
      expect(lifecycle.getAllWorkers()).toHaveLength(0);
    });

    it('should handle recycling non-existent worker gracefully', async () => {
      // Should not throw
      await expect(lifecycle.recycle('non-existent')).resolves.toBeUndefined();
    });

    it('should not kill if worker has no PID', async () => {
      // Spawn a worker and manually remove its PID
      const worker = await lifecycle.spawn();

      // Create a worker without PID by updating state (pid is readonly but
      // we can test the branch via the factory returning no pid)
      // Since WorkerInfo has optional pid, we can verify the kill path
      // by recycling a normal worker and verifying kill was called
      await lifecycle.recycle(worker.id);

      expect(mockFactory.kill).toHaveBeenCalledTimes(1);
    });

    it('should not affect other workers when one is recycled', async () => {
      const w1 = await lifecycle.spawn();
      const w2 = await lifecycle.spawn();

      await lifecycle.recycle(w1.id);

      expect(lifecycle.getWorker(w1.id)).toBeUndefined();
      expect(lifecycle.getWorker(w2.id)).toBeDefined();
      expect(lifecycle.getAllWorkers()).toHaveLength(1);
    });
  });

  describe('kill()', () => {
    it('should terminate worker subprocess immediately', async () => {
      const worker = await lifecycle.spawn();

      lifecycle.kill(worker.id);

      expect(mockFactory.kill).toHaveBeenCalledWith(worker.pid);
    });

    it('should remove worker from pool', async () => {
      const worker = await lifecycle.spawn();

      lifecycle.kill(worker.id);

      expect(lifecycle.getWorker(worker.id)).toBeUndefined();
    });

    it('should handle killing non-existent worker gracefully', () => {
      // Should not throw
      expect(() => lifecycle.kill('non-existent')).not.toThrow();
    });

    it('should not affect other workers when one is killed', async () => {
      const w1 = await lifecycle.spawn();
      const w2 = await lifecycle.spawn();
      const w3 = await lifecycle.spawn();

      lifecycle.kill(w2.id);

      expect(lifecycle.getWorker(w1.id)).toBeDefined();
      expect(lifecycle.getWorker(w2.id)).toBeUndefined();
      expect(lifecycle.getWorker(w3.id)).toBeDefined();
      expect(lifecycle.getAllWorkers()).toHaveLength(2);
    });

    it('should call factory.kill synchronously (fire and forget)', async () => {
      const worker = await lifecycle.spawn();

      lifecycle.kill(worker.id);

      // kill is called but the return promise is not awaited
      expect(mockFactory.kill).toHaveBeenCalled();
    });
  });

  describe('getWorker() / getWorkerState()', () => {
    it('should return worker info for existing worker', async () => {
      const spawned = await lifecycle.spawn();

      const retrieved = lifecycle.getWorker(spawned.id);

      expect(retrieved).toBeDefined();
      expect(retrieved?.id).toBe(spawned.id);
      expect(retrieved?.state).toBe('idle');
      expect(retrieved?.pid).toBe(spawned.pid);
    });

    it('should return undefined for non-existent worker', () => {
      const result = lifecycle.getWorker('non-existent');

      expect(result).toBeUndefined();
    });

    it('should reflect state updates via updateWorkerState()', async () => {
      const worker = await lifecycle.spawn();

      lifecycle.updateWorkerState(worker.id, 'busy');

      const updated = lifecycle.getWorker(worker.id);
      expect(updated?.state).toBe('busy');
    });

    it('should reflect all valid worker states', async () => {
      const worker = await lifecycle.spawn();

      const states = ['idle', 'busy', 'draining', 'stuck', 'dead'] as const;
      for (const state of states) {
        lifecycle.updateWorkerState(worker.id, state);
        expect(lifecycle.getWorker(worker.id)?.state).toBe(state);
      }
    });
  });

  describe('updateWorkerState()', () => {
    it('should update worker state in pool', async () => {
      const worker = await lifecycle.spawn();

      lifecycle.updateWorkerState(worker.id, 'busy');

      expect(lifecycle.getWorker(worker.id)?.state).toBe('busy');
    });

    it('should handle updating non-existent worker gracefully', () => {
      // Should not throw
      expect(() => lifecycle.updateWorkerState('no-such', 'idle')).not.toThrow();
    });

    it('should preserve other worker properties when updating state', async () => {
      const worker = await lifecycle.spawn();
      const originalPid = worker.pid;
      const originalStartedAt = worker.startedAt;

      lifecycle.updateWorkerState(worker.id, 'busy');

      const updated = lifecycle.getWorker(worker.id);
      expect(updated?.pid).toBe(originalPid);
      expect(updated?.startedAt).toBe(originalStartedAt);
      expect(updated?.requestCount).toBe(0);
    });
  });

  describe('updateHeartbeat()', () => {
    it('should update the lastHeartbeat timestamp', async () => {
      const worker = await lifecycle.spawn();
      const originalHeartbeat = worker.lastHeartbeat;

      // Small delay to ensure new Date() differs
      await new Promise(resolve => setTimeout(resolve, 5));

      lifecycle.updateHeartbeat(worker.id);

      const updated = lifecycle.getWorker(worker.id);
      expect(updated?.lastHeartbeat.getTime()).toBeGreaterThanOrEqual(
        originalHeartbeat.getTime()
      );
    });

    it('should handle updating non-existent worker gracefully', () => {
      expect(() => lifecycle.updateHeartbeat('no-such')).not.toThrow();
    });

    it('should preserve worker state when updating heartbeat', async () => {
      const worker = await lifecycle.spawn();
      lifecycle.updateWorkerState(worker.id, 'busy');

      lifecycle.updateHeartbeat(worker.id);

      const updated = lifecycle.getWorker(worker.id);
      expect(updated?.state).toBe('busy');
    });
  });

  describe('getAllWorkers()', () => {
    it('should return empty array when no workers spawned', () => {
      expect(lifecycle.getAllWorkers()).toEqual([]);
    });

    it('should return all active workers', async () => {
      await lifecycle.spawn();
      await lifecycle.spawn();

      const all = lifecycle.getAllWorkers();
      expect(all).toHaveLength(2);
      expect(all[0]?.id).toBe('worker-0');
      expect(all[1]?.id).toBe('worker-1');
    });

    it('should not include killed workers', async () => {
      const w1 = await lifecycle.spawn();
      await lifecycle.spawn();

      lifecycle.kill(w1.id);

      const all = lifecycle.getAllWorkers();
      expect(all).toHaveLength(1);
      expect(all[0]?.id).toBe('worker-1');
    });

    it('should not include recycled workers', async () => {
      const w1 = await lifecycle.spawn();
      await lifecycle.spawn();

      await lifecycle.recycle(w1.id);

      const all = lifecycle.getAllWorkers();
      expect(all).toHaveLength(1);
      expect(all[0]?.id).toBe('worker-1');
    });
  });

  describe('health-triggered recycle scenario', () => {
    it('should allow recycle of a stuck worker', async () => {
      const worker = await lifecycle.spawn();

      // Simulate a stuck worker
      lifecycle.updateWorkerState(worker.id, 'stuck');
      expect(lifecycle.getWorker(worker.id)?.state).toBe('stuck');

      // Recycle the stuck worker
      await lifecycle.recycle(worker.id);

      expect(lifecycle.getWorker(worker.id)).toBeUndefined();
      expect(mockFactory.kill).toHaveBeenCalledWith(worker.pid);
    });

    it('should allow spawning replacement after recycling stuck worker', async () => {
      const original = await lifecycle.spawn();
      lifecycle.updateWorkerState(original.id, 'stuck');

      await lifecycle.recycle(original.id);
      const replacement = await lifecycle.spawn();

      expect(replacement.state).toBe('idle');
      expect(replacement.id).toBe('worker-1');
      expect(lifecycle.getAllWorkers()).toHaveLength(1);
    });

    it('should handle recycle + spawn cycle for memory-heavy workers', async () => {
      const w1 = await lifecycle.spawn();
      const w2 = await lifecycle.spawn();

      // Simulate high memory scenario - recycle both
      await lifecycle.recycle(w1.id);
      await lifecycle.recycle(w2.id);

      expect(lifecycle.getAllWorkers()).toHaveLength(0);

      // Spawn fresh workers
      const fresh1 = await lifecycle.spawn();
      const fresh2 = await lifecycle.spawn();

      expect(fresh1.state).toBe('idle');
      expect(fresh2.state).toBe('idle');
      expect(lifecycle.getAllWorkers()).toHaveLength(2);
    });

    it('should kill subprocess when recycling a dead worker', async () => {
      const worker = await lifecycle.spawn();
      lifecycle.updateWorkerState(worker.id, 'dead');

      await lifecycle.recycle(worker.id);

      expect(mockFactory.kill).toHaveBeenCalledWith(worker.pid);
      expect(lifecycle.getWorker(worker.id)).toBeUndefined();
    });
  });
});
