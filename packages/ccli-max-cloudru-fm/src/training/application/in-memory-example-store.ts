import type { TenantIdString } from '../../core/types/tenant-id.js';
import type { TrainingExample } from '../domain/types.js';
import type { IExampleStore, ExampleFilter } from './example-store.js';

export class InMemoryExampleStore implements IExampleStore {
  private readonly examples: Map<string, TrainingExample> = new Map();

  async save(example: TrainingExample): Promise<void> {
    this.examples.set(example.id, example);
  }

  async findById(id: string): Promise<TrainingExample | undefined> {
    return this.examples.get(id);
  }

  async findByTenant(
    tenantId: TenantIdString,
    filter?: ExampleFilter
  ): Promise<TrainingExample[]> {
    let results = Array.from(this.examples.values())
      .filter(ex => ex.tenantId === tenantId);

    if (filter?.category) {
      results = results.filter(ex => ex.category === filter.category);
    }

    if (filter?.minQuality !== undefined) {
      results = results.filter(ex => ex.quality >= filter.minQuality!);
    }

    return results;
  }

  async delete(id: string): Promise<void> {
    this.examples.delete(id);
  }

  async count(tenantId: TenantIdString): Promise<number> {
    return Array.from(this.examples.values())
      .filter(ex => ex.tenantId === tenantId)
      .length;
  }

  // Test helper
  clear(): void {
    this.examples.clear();
  }
}
