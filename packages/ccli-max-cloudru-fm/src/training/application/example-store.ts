import type { TenantIdString } from '../../core/types/tenant-id.js';
import type { TrainingExample, ExampleCategory, QualityScore } from '../domain/types.js';

export interface ExampleFilter {
  readonly category?: ExampleCategory;
  readonly minQuality?: QualityScore;
}

export interface IExampleStore {
  save(example: TrainingExample): Promise<void>;
  findById(id: string): Promise<TrainingExample | undefined>;
  findByTenant(
    tenantId: TenantIdString,
    filter?: ExampleFilter
  ): Promise<TrainingExample[]>;
  delete(id: string): Promise<void>;
  count(tenantId: TenantIdString): Promise<number>;
}
