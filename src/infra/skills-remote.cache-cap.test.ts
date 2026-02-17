import { describe, expect, it } from "vitest";
import { getRemoteNodeCount, getRemoteSkillEligibility, recordRemoteNodeInfo } from "./skills-remote.js";

describe("skills-remote node cache cap", () => {
  it("evicts oldest node when cap is exceeded", () => {
    // Record a macOS node with system.run so it appears in eligibility.
    // This will be the oldest entry and must be evicted once cap is hit.
    recordRemoteNodeInfo({
      nodeId: "eviction-target",
      displayName: "Target",
      platform: "darwin",
      commands: ["system.run"],
    });

    // Verify it appears in eligibility before flooding.
    let elig = getRemoteSkillEligibility();
    expect(elig).toBeDefined();
    expect(elig!.note).toContain("Target");

    // Flood with 1 100 distinct non-mac nodes to exceed the 1 000 cap.
    // The eviction-target (oldest) must be evicted when the 1 001st distinct
    // node is inserted.
    for (let i = 0; i < 1_100; i++) {
      recordRemoteNodeInfo({
        nodeId: `flood-${i}`,
        displayName: `Flood ${i}`,
        platform: "linux",
      });
    }

    // Cache must be clamped at the cap — never grow unbounded.
    expect(getRemoteNodeCount()).toBeLessThanOrEqual(1_000);

    // The oldest macOS node must have been evicted: no mac nodes left means
    // getRemoteSkillEligibility() returns undefined.
    elig = getRemoteSkillEligibility();
    expect(elig).toBeUndefined();
  });

  it("upserts an existing node without eviction", () => {
    // Re-recording the same nodeId should not throw regardless of map size.
    const countBefore = getRemoteNodeCount();

    recordRemoteNodeInfo({
      nodeId: "stable-node",
      displayName: "Stable",
      platform: "darwin",
      commands: ["system.run"],
    });
    const countAfterFirst = getRemoteNodeCount();

    recordRemoteNodeInfo({
      nodeId: "stable-node",
      displayName: "Stable Updated",
      platform: "darwin",
      commands: ["system.run"],
    });
    const countAfterUpdate = getRemoteNodeCount();

    // An upsert must not grow the map (reuses the existing slot).
    expect(countAfterUpdate).toBe(countAfterFirst);
    // Map must have grown by exactly one for the initial insert.
    expect(countAfterFirst).toBe(countBefore + 1);

    const elig = getRemoteSkillEligibility();
    expect(elig).toBeDefined();
    expect(elig!.note).toContain("Stable Updated");
  });
});
