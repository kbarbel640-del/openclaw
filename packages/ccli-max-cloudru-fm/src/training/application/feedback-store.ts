import type { TenantIdString } from '../../core/types/tenant-id.js';
import type { FeedbackEntry } from '../domain/types.js';

export interface IFeedbackStore {
  save(feedback: FeedbackEntry): Promise<void>;
  findByTenant(
    tenantId: TenantIdString,
    limit?: number
  ): Promise<FeedbackEntry[]>;
  findByMessage(messageId: string): Promise<FeedbackEntry | undefined>;
}
