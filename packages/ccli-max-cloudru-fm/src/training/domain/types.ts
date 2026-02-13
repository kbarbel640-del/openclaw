import type { TenantIdString } from '../../core/types/tenant-id.js';

export interface TrainingExample {
  readonly id: string;
  readonly tenantId: TenantIdString;
  readonly input: string;
  readonly expectedOutput: string;
  readonly category: ExampleCategory;
  readonly quality: QualityScore;
  readonly createdAt: Date;
  readonly metadata?: Record<string, unknown>;
}

export type ExampleCategory = 'greeting' | 'faq' | 'task' | 'error_handling' | 'custom';
export type QualityScore = 1 | 2 | 3 | 4 | 5;

export interface FeedbackEntry {
  readonly id: string;
  readonly tenantId: TenantIdString;
  readonly messageId: string;
  readonly rating: 'positive' | 'negative' | 'neutral';
  readonly comment?: string;
  readonly createdAt: Date;
}

export interface TrainingContext {
  readonly tenantId: TenantIdString;
  readonly systemPrompt: string;
  readonly examples: TrainingExample[];
  readonly maxTokens: number;
  readonly temperature: number;
}

export interface ContextBuildConfig {
  readonly maxExamples: number;
  readonly maxSystemPromptTokens: number;
  readonly includeCategories: ExampleCategory[];
  readonly minQuality: QualityScore;
}

export const DEFAULT_CONTEXT_CONFIG: ContextBuildConfig = {
  maxExamples: 10,
  maxSystemPromptTokens: 2000,
  includeCategories: ['greeting', 'faq', 'task', 'error_handling', 'custom'],
  minQuality: 3,
};
