import type { TenantIdString } from '../../core/types/tenant-id.js';
import type { Result } from '../../core/types/result.js';
import { ok, err } from '../../core/types/result.js';
import type { TrainingContext, ContextBuildConfig } from '../domain/types.js';
import { DEFAULT_CONTEXT_CONFIG } from '../domain/types.js';
import { TrainingContextError, ContextTooLargeError } from '../domain/errors.js';
import type { IExampleStore } from './example-store.js';

export type TokenEstimator = (text: string) => number;

const defaultTokenEstimator: TokenEstimator = (text: string) => {
  // Rough estimate: 1 token ≈ 4 characters
  return Math.ceil(text.length / 4);
};

export class ContextBuilder {
  constructor(
    private readonly exampleStore: IExampleStore,
    private readonly estimateTokens: TokenEstimator = defaultTokenEstimator
  ) {}

  async build(
    tenantId: TenantIdString,
    systemPrompt: string,
    config: Partial<ContextBuildConfig> = {}
  ): Promise<Result<TrainingContext, TrainingContextError>> {
    const fullConfig: ContextBuildConfig = {
      ...DEFAULT_CONTEXT_CONFIG,
      ...config,
    };

    // Validate system prompt size
    const systemPromptTokens = this.estimateTokens(systemPrompt);
    if (systemPromptTokens > fullConfig.maxSystemPromptTokens) {
      return err(
        new ContextTooLargeError(
          systemPromptTokens,
          fullConfig.maxSystemPromptTokens
        )
      );
    }

    // Fetch examples
    const allExamples = await this.exampleStore.findByTenant(tenantId, {
      minQuality: fullConfig.minQuality,
    });

    // Filter by category
    const filteredExamples = allExamples.filter(ex =>
      fullConfig.includeCategories.includes(ex.category)
    );

    // Sort by quality descending
    const sortedExamples = filteredExamples.sort((a, b) => b.quality - a.quality);

    // Take top N
    const selectedExamples = sortedExamples.slice(0, fullConfig.maxExamples);

    // Estimate total tokens
    const examplesText = selectedExamples
      .map(ex => `${ex.input}\n${ex.expectedOutput}`)
      .join('\n\n');
    const examplesTokens = this.estimateTokens(examplesText);
    const totalTokens = systemPromptTokens + examplesTokens;

    const context: TrainingContext = {
      tenantId,
      systemPrompt,
      examples: selectedExamples,
      maxTokens: totalTokens,
      temperature: 0.7,
    };

    return ok(context);
  }
}
