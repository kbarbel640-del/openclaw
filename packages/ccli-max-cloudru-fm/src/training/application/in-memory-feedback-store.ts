import type { TenantIdString } from '../../core/types/tenant-id.js';
import type { FeedbackEntry } from '../domain/types.js';
import type { IFeedbackStore } from './feedback-store.js';

export class InMemoryFeedbackStore implements IFeedbackStore {
  private readonly feedback: Map<string, FeedbackEntry> = new Map();

  async save(feedback: FeedbackEntry): Promise<void> {
    this.feedback.set(feedback.id, feedback);
  }

  async findByTenant(
    tenantId: TenantIdString,
    limit?: number
  ): Promise<FeedbackEntry[]> {
    let results = Array.from(this.feedback.values())
      .filter(fb => fb.tenantId === tenantId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    if (limit !== undefined && limit > 0) {
      results = results.slice(0, limit);
    }

    return results;
  }

  async findByMessage(messageId: string): Promise<FeedbackEntry | undefined> {
    return Array.from(this.feedback.values())
      .find(fb => fb.messageId === messageId);
  }

  // Test helper
  clear(): void {
    this.feedback.clear();
  }
}
