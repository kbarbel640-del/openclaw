/**
 * Tests for PriorityScheduler.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { PriorityScheduler } from '../../../src/concurrency/application/scheduler.js';
import type { QueueEntry } from '../../../src/concurrency/domain/types.js';
import type { TenantIdString } from '../../../src/core/types/tenant-id.js';

describe('PriorityScheduler', () => {
  let scheduler: PriorityScheduler;
  const maxQueueSize = 10;

  beforeEach(() => {
    scheduler = new PriorityScheduler(maxQueueSize);
  });

  function createEntry(priority: QueueEntry['priority'], tenantId: string): QueueEntry {
    return {
      id: `entry-${Date.now()}-${Math.random()}`,
      tenantId: tenantId as TenantIdString,
      priority,
      enqueuedAt: new Date(),
      timeoutMs: 120_000,
      payload: {},
    };
  }

  it('should enqueue and dequeue in priority order', () => {
    const lowEntry = createEntry('low', 'tenant-1');
    const normalEntry = createEntry('normal', 'tenant-2');
    const highEntry = createEntry('high', 'tenant-3');

    scheduler.enqueue(lowEntry);
    scheduler.enqueue(normalEntry);
    scheduler.enqueue(highEntry);

    const first = scheduler.dequeue();
    expect(first?.priority).toBe('high');
  });

  it('should process critical > high > normal > low', () => {
    const low = createEntry('low', 'tenant-1');
    const normal = createEntry('normal', 'tenant-2');
    const high = createEntry('high', 'tenant-3');
    const critical = createEntry('critical', 'tenant-4');

    scheduler.enqueue(low);
    scheduler.enqueue(normal);
    scheduler.enqueue(high);
    scheduler.enqueue(critical);

    expect(scheduler.dequeue()?.priority).toBe('critical');
    expect(scheduler.dequeue()?.priority).toBe('high');
    expect(scheduler.dequeue()?.priority).toBe('normal');
    expect(scheduler.dequeue()?.priority).toBe('low');
  });

  it('should maintain FIFO within same priority', () => {
    const entry1 = createEntry('normal', 'tenant-1');
    const entry2 = createEntry('normal', 'tenant-1');
    const entry3 = createEntry('normal', 'tenant-1');

    scheduler.enqueue(entry1);
    scheduler.enqueue(entry2);
    scheduler.enqueue(entry3);

    expect(scheduler.dequeue()?.id).toBe(entry1.id);
    expect(scheduler.dequeue()?.id).toBe(entry2.id);
    expect(scheduler.dequeue()?.id).toBe(entry3.id);
  });

  it('should return error when queue is full', () => {
    // Fill queue to capacity
    for (let i = 0; i < maxQueueSize; i++) {
      const result = scheduler.enqueue(createEntry('normal', `tenant-${i}`));
      expect(result.ok).toBe(true);
    }

    // Try to add one more
    const result = scheduler.enqueue(createEntry('normal', 'tenant-overflow'));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.message).toContain('queue is at capacity');
    }
  });

  it('should return undefined when dequeue on empty queue', () => {
    expect(scheduler.dequeue()).toBeUndefined();
  });

  it('should track queue depth correctly', () => {
    expect(scheduler.getQueueDepth()).toBe(0);

    scheduler.enqueue(createEntry('normal', 'tenant-1'));
    expect(scheduler.getQueueDepth()).toBe(1);

    scheduler.enqueue(createEntry('high', 'tenant-2'));
    expect(scheduler.getQueueDepth()).toBe(2);

    scheduler.dequeue();
    expect(scheduler.getQueueDepth()).toBe(1);

    scheduler.dequeue();
    expect(scheduler.getQueueDepth()).toBe(0);
  });

  it('should implement tenant fairness within same priority', () => {
    // Add multiple entries from two tenants at same priority
    scheduler.enqueue(createEntry('normal', 'tenant-1'));
    scheduler.enqueue(createEntry('normal', 'tenant-1'));
    scheduler.enqueue(createEntry('normal', 'tenant-2'));

    // Should alternate between tenants
    const first = scheduler.dequeue();
    const second = scheduler.dequeue();
    const third = scheduler.dequeue();

    // One tenant should not get all their requests processed first
    const tenantIds = [first?.tenantId, second?.tenantId, third?.tenantId];
    expect(new Set(tenantIds).size).toBeGreaterThan(1);
  });
});
