import { describe, expect, it } from "vitest";
import {
  ensurePromptCachePartition,
  resolvePromptCachePartition,
} from "./prompt-cache-partition.js";

describe("resolvePromptCachePartition", () => {
  it("returns trimmed configured value", () => {
    const result = resolvePromptCachePartition({
      agents: { defaults: { promptCachePartition: "  abc123  " } },
    });
    expect(result).toBe("abc123");
  });
});

describe("ensurePromptCachePartition", () => {
  it("generates key when missing", () => {
    const result = ensurePromptCachePartition({}, () => "generated-partition-key");
    expect(result.generatedKey).toBe("generated-partition-key");
    expect(result.config.agents?.defaults?.promptCachePartition).toBe("generated-partition-key");
  });

  it("keeps existing key", () => {
    const config = { agents: { defaults: { promptCachePartition: "existing-key" } } };
    const result = ensurePromptCachePartition(config, () => "generated-partition-key");
    expect(result.generatedKey).toBeUndefined();
    expect(result.config).toBe(config);
    expect(result.config.agents?.defaults?.promptCachePartition).toBe("existing-key");
  });
});
