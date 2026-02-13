/**
 * Tests for ContextBuilder.
 */

import { describe, it, expect } from 'vitest';
import { ContextBuilder } from '../../src/training/application/context-builder.js';
import type { IExampleStore, ExampleFilter } from '../../src/training/application/example-store.js';
import type { TrainingExample, ContextBuildConfig } from '../../src/training/domain/types.js';
import type { TenantIdString } from '../../src/core/types/tenant-id.js';

describe('ContextBuilder', () => {
  const tenantId: TenantIdString = 'telegram:123:456' as TenantIdString;

  const createMockExample = (id: string, category: string, quality: number): TrainingExample => ({
    id,
    tenantId,
    input: `Test input ${id}`,
    expectedOutput: `Test output ${id}`,
    category: category as any,
    quality: quality as any,
    createdAt: new Date(),
  });

  const createMockStore = (examples: TrainingExample[]): IExampleStore => ({
    save: async () => {},
    findById: async () => undefined,
    findByTenant: async (tid: TenantIdString, filter?: ExampleFilter) => {
      let result = examples.filter(ex => ex.tenantId === tid);

      if (filter?.minQuality) {
        result = result.filter(ex => ex.quality >= filter.minQuality!);
      }

      if (filter?.category) {
        result = result.filter(ex => ex.category === filter.category);
      }

      return result;
    },
    delete: async () => {},
    count: async () => examples.length,
  });

  describe('build', () => {
    it('should build context with filtered examples', async () => {
      const examples = [
        createMockExample('1', 'greeting', 5),
        createMockExample('2', 'faq', 4),
        createMockExample('3', 'task', 3),
      ];

      const store = createMockStore(examples);
      const builder = new ContextBuilder(store);

      const result = await builder.build(tenantId, 'System prompt');

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.tenantId).toBe(tenantId);
        expect(result.value.systemPrompt).toBe('System prompt');
        expect(result.value.examples).toHaveLength(3);
      }
    });

    it('should respect maxExamples limit', async () => {
      const examples = [
        createMockExample('1', 'greeting', 5),
        createMockExample('2', 'greeting', 4),
        createMockExample('3', 'greeting', 3),
        createMockExample('4', 'greeting', 2),
        createMockExample('5', 'greeting', 1),
      ];

      const store = createMockStore(examples);
      const builder = new ContextBuilder(store);

      const config: Partial<ContextBuildConfig> = {
        maxExamples: 3,
      };

      const result = await builder.build(tenantId, 'System prompt', config);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.examples).toHaveLength(3);
        // Should select highest quality examples
        expect(result.value.examples[0]?.quality).toBe(5);
        expect(result.value.examples[1]?.quality).toBe(4);
        expect(result.value.examples[2]?.quality).toBe(3);
      }
    });

    it('should filter by minQuality', async () => {
      const examples = [
        createMockExample('1', 'greeting', 5),
        createMockExample('2', 'greeting', 3),
        createMockExample('3', 'greeting', 2),
      ];

      const store = createMockStore(examples);
      const builder = new ContextBuilder(store);

      const config: Partial<ContextBuildConfig> = {
        minQuality: 4,
      };

      const result = await builder.build(tenantId, 'System prompt', config);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.examples).toHaveLength(1);
        expect(result.value.examples[0]?.quality).toBe(5);
      }
    });

    it('should filter by category', async () => {
      const examples = [
        createMockExample('1', 'greeting', 5),
        createMockExample('2', 'faq', 5),
        createMockExample('3', 'task', 5),
      ];

      const store = createMockStore(examples);
      const builder = new ContextBuilder(store);

      const config: Partial<ContextBuildConfig> = {
        includeCategories: ['greeting'],
      };

      const result = await builder.build(tenantId, 'System prompt', config);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.examples).toHaveLength(1);
        expect(result.value.examples[0]?.category).toBe('greeting');
      }
    });

    it('should handle empty examples', async () => {
      const store = createMockStore([]);
      const builder = new ContextBuilder(store);

      const result = await builder.build(tenantId, 'System prompt');

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.examples).toHaveLength(0);
      }
    });

    it('should reject system prompt exceeding token limit', async () => {
      const store = createMockStore([]);
      const builder = new ContextBuilder(store);

      // Create a very large prompt (estimate: 1 token ≈ 4 chars)
      const largePrompt = 'a'.repeat(10000);

      const config: Partial<ContextBuildConfig> = {
        maxSystemPromptTokens: 1000,
      };

      const result = await builder.build(tenantId, largePrompt, config);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.name).toBe('ContextTooLargeError');
      }
    });
  });
});
