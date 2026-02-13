import { err, ok, type Result } from '../../core/types/result.js';
import { ModelNotFoundError } from '../domain/errors.js';
import type { ModelDefinition, ModelRequest, ModelCapability } from '../domain/types.js';

export class ModelSelector {
  select(request: ModelRequest, availableModels: ModelDefinition[]): Result<ModelDefinition, ModelNotFoundError> {
    if (availableModels.length === 0) {
      return err(new ModelNotFoundError(request.modelId));
    }

    const requiredCapabilities = this.getRequiredCapabilities(request);
    const compatibleModels = availableModels.filter(model =>
      this.hasRequiredCapabilities(model, requiredCapabilities)
    );

    if (compatibleModels.length === 0) {
      return err(new ModelNotFoundError(request.modelId));
    }

    const bestModel = this.selectBestModel(compatibleModels, request);
    return ok(bestModel);
  }

  private getRequiredCapabilities(request: ModelRequest): ModelCapability[] {
    const capabilities: ModelCapability[] = ['chat'];

    if (request.tools && request.tools.length > 0) {
      capabilities.push('tool_use', 'function_calling');
    }

    if (request.stream) {
      capabilities.push('streaming');
    }

    return capabilities;
  }

  private hasRequiredCapabilities(model: ModelDefinition, required: ModelCapability[]): boolean {
    return required.every(cap => model.capabilities.includes(cap));
  }

  private selectBestModel(models: ModelDefinition[], request: ModelRequest): ModelDefinition {
    const scored = models.map(model => ({
      model,
      score: this.scoreModel(model, request)
    }));

    scored.sort((a, b) => b.score - a.score);

    // Should never happen since we check models.length > 0 before calling
    const best = scored[0];
    if (!best) {
      throw new Error('No models available for selection');
    }

    return best.model;
  }

  private scoreModel(model: ModelDefinition, request: ModelRequest): number {
    let score = 0;

    // Prefer cheaper models for simple tasks
    const estimatedTokens = this.estimateTokens(request);
    const estimatedCost = (estimatedTokens / 1000) * (model.costPer1kInput + model.costPer1kOutput);
    score -= estimatedCost * 100; // Lower cost = higher score

    // Penalize models with insufficient context window
    const requiredContext = estimatedTokens + (request.maxTokens ?? 1000);
    if (model.contextWindow < requiredContext) {
      score -= 1000; // Heavy penalty
    }

    // Prefer models with more capabilities
    score += model.capabilities.length * 10;

    return score;
  }

  private estimateTokens(request: ModelRequest): number {
    const messageLength = request.messages.reduce((sum, msg) => sum + msg.content.length, 0);
    return Math.ceil(messageLength / 4); // Rough estimate: 1 token ≈ 4 chars
  }
}
