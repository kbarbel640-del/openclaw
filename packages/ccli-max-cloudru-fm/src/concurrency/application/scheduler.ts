/**
 * Priority scheduler with weighted fair queuing.
 * Ensures high-priority requests are processed first while maintaining
 * fairness across tenants at the same priority level.
 */

import type { Result } from '../../core/types/result.js';
import { ok, err } from '../../core/types/result.js';
import type { QueueEntry, Priority } from '../domain/types.js';
import { QueueFullError } from '../domain/errors.js';
import type { TenantIdString } from '../../core/types/tenant-id.js';

/**
 * Priority-based scheduler that implements weighted fair queuing.
 * Maintains separate queues per priority level with round-robin
 * tenant fairness within each priority.
 */
export class PriorityScheduler {
  private queues: Map<Priority, QueueEntry[]>;
  private tenantCursors: Map<string, number>;

  constructor(private readonly maxQueueSize: number) {
    this.queues = new Map([
      ['critical', []],
      ['high', []],
      ['normal', []],
      ['low', []],
    ]);
    this.tenantCursors = new Map();
  }

  /**
   * Adds a request to the appropriate priority queue.
   * @returns Error if queue is full, otherwise success.
   */
  enqueue(entry: QueueEntry): Result<void, QueueFullError> {
    const totalSize = this.getTotalSize();

    if (totalSize >= this.maxQueueSize) {
      return err(new QueueFullError('Request queue is at capacity'));
    }

    const queue = this.queues.get(entry.priority);
    if (!queue) {
      return err(new QueueFullError(`Invalid priority: ${entry.priority}`));
    }

    queue.push(entry);
    return ok(undefined);
  }

  /**
   * Removes and returns the next request based on priority and fairness.
   * Higher priority requests are always served first.
   * Within same priority, round-robin between tenants.
   */
  dequeue(): QueueEntry | undefined {
    // Try each priority level from highest to lowest
    for (const priority of ['critical', 'high', 'normal', 'low'] as const) {
      const queue = this.queues.get(priority);
      if (!queue || queue.length === 0) continue;

      // Implement tenant fairness with round-robin
      const entry = this.selectWithFairness(queue, priority);
      if (entry) return entry;
    }

    return undefined;
  }

  /**
   * Returns the current depth of all queues combined.
   */
  getQueueDepth(): number {
    return this.getTotalSize();
  }

  private getTotalSize(): number {
    let total = 0;
    for (const queue of this.queues.values()) {
      total += queue.length;
    }
    return total;
  }

  private selectWithFairness(queue: QueueEntry[], priority: Priority): QueueEntry | undefined {
    if (queue.length === 0) return undefined;

    // Group by tenant
    const byTenant = this.groupByTenant(queue);
    const tenants = Array.from(byTenant.keys());

    if (tenants.length === 0) return undefined;

    // Get cursor for this priority level
    const cursorKey = `${priority}`;
    const cursor = this.tenantCursors.get(cursorKey) ?? 0;

    // Round-robin tenant selection
    const selectedTenant = tenants[cursor % tenants.length];
    if (!selectedTenant) return undefined;

    this.tenantCursors.set(cursorKey, cursor + 1);

    // Take first entry from selected tenant
    const tenantEntries = byTenant.get(selectedTenant);
    if (!tenantEntries || tenantEntries.length === 0) return undefined;

    const selected = tenantEntries[0];
    if (!selected) return undefined;

    // Remove from queue
    const index = queue.findIndex(e => e.id === selected.id);
    if (index >= 0) {
      queue.splice(index, 1);
    }

    return selected;
  }

  private groupByTenant(entries: QueueEntry[]): Map<TenantIdString, QueueEntry[]> {
    const groups = new Map<TenantIdString, QueueEntry[]>();

    for (const entry of entries) {
      const existing = groups.get(entry.tenantId) ?? [];
      existing.push(entry);
      groups.set(entry.tenantId, existing);
    }

    return groups;
  }
}
