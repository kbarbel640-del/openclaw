import crypto from "node:crypto";
import type { OpenClawConfig } from "../config/config.js";

export type PromptCachePartitionResolution = {
  config: OpenClawConfig;
  generatedKey?: string;
};

function trimToUndefined(value?: string): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

export function resolvePromptCachePartition(config?: OpenClawConfig): string | undefined {
  return trimToUndefined(config?.agents?.defaults?.promptCachePartition);
}

/**
 * Ensure every install has a stable cache partition key.
 * This partitions shared provider prompt caches per install instead of globally.
 */
export function ensurePromptCachePartition(
  config: OpenClawConfig,
  generateKey: () => string = () => crypto.randomBytes(16).toString("hex"),
): PromptCachePartitionResolution {
  const existing = resolvePromptCachePartition(config);
  if (existing) {
    return { config };
  }
  const generatedKey = generateKey();
  return {
    config: {
      ...config,
      agents: {
        ...config.agents,
        defaults: {
          ...config.agents?.defaults,
          promptCachePartition: generatedKey,
        },
      },
    },
    generatedKey,
  };
}
