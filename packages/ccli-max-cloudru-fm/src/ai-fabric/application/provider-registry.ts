import type { ModelProvider, ModelDefinition, ModelCapability } from '../domain/types.js';

export class ProviderRegistry {
  private readonly providers = new Map<string, ModelProvider>();
  private readonly modelIndex = new Map<string, { provider: ModelProvider; model: ModelDefinition }>();

  register(provider: ModelProvider): void {
    this.providers.set(provider.id, provider);

    for (const model of provider.models) {
      this.modelIndex.set(model.id, { provider, model });
    }
  }

  unregister(providerId: string): void {
    const provider = this.providers.get(providerId);
    if (!provider) return;

    for (const model of provider.models) {
      this.modelIndex.delete(model.id);
    }

    this.providers.delete(providerId);
  }

  getProvider(providerId: string): ModelProvider | undefined {
    return this.providers.get(providerId);
  }

  findModel(modelId: string): { provider: ModelProvider; model: ModelDefinition } | undefined {
    return this.modelIndex.get(modelId);
  }

  listModels(filter?: { capability?: ModelCapability }): ModelDefinition[] {
    const allModels = Array.from(this.modelIndex.values()).map(entry => entry.model);

    if (!filter?.capability) {
      return allModels;
    }

    return allModels.filter(model =>
      model.capabilities.includes(filter.capability!)
    );
  }

  getAllProviders(): ModelProvider[] {
    return Array.from(this.providers.values());
  }

  clear(): void {
    this.providers.clear();
    this.modelIndex.clear();
  }
}
