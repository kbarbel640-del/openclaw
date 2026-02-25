import { describe, it, expect } from "vitest";
import { fetchMorpheusUsage } from "./provider-usage.fetch.morpheus.js";
import { PROVIDER_LABELS, usageProviders } from "./provider-usage.shared.js";

describe("Morpheus Provider", () => {
  it("should have morpheus in UsageProviderId type", () => {
    expect(usageProviders).toContain("morpheus");
  });

  it("should have morpheus label", () => {
    expect(PROVIDER_LABELS.morpheus).toBe("Morpheus");
  });

  it("should return empty windows (free inference)", async () => {
    const snapshot = await fetchMorpheusUsage();
    expect(snapshot.provider).toBe("morpheus");
    expect(snapshot.displayName).toBe("Morpheus");
    expect(snapshot.windows).toEqual([]);
    expect(snapshot.error).toBeUndefined();
  });
});
