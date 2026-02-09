/**
 * Brain Tiered Manager Tests
 *
 * TDD: These tests use REAL Brain MCP via mcporter - no mocks.
 * Requires mcporter and Brain MCP configured.
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { ResolvedBrainTieredConfig } from "../config/types.brain-tiered.js";
import { BrainTieredManager } from "./brain-tiered-manager.js";

// Test workspace - use a dedicated Brain workspace for testing
const TEST_WORKSPACE_ID = "00000000-0000-0000-0000-000000000001";
const TEST_TRIUMPH_WORKSPACE_ID = "00000000-0000-0000-0000-000000000002";

describe("BrainTieredManager", () => {
  let tempDir: string;
  let memoryMdPath: string;
  let manager: BrainTieredManager;

  beforeAll(async () => {
    // Create temp directory for test files
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "brain-tiered-test-"));
    memoryMdPath = path.join(tempDir, "memory.md");

    // Create test memory.md with content
    const testContent = `# Test Memory

## Important Facts

- The sky is blue
- Water is wet
- OpenClaw integrates with Brain MCP

## Project Notes

- Testing the 4-tier memory system
- Tier 0 is local memory.md
- Brain MCP provides Tiers 1-3

## Technical Details

- BGE-M3 embeddings are 1024 dimensions
- RRF fusion improves search accuracy
- Quick search targets <100ms latency
`;
    fs.writeFileSync(memoryMdPath, testContent);

    // Create daily notes directory
    const dailyNotesPath = path.join(tempDir, "memory");
    fs.mkdirSync(dailyNotesPath, { recursive: true });

    // Create a daily note
    const today = new Date().toISOString().split("T")[0];
    fs.writeFileSync(
      path.join(dailyNotesPath, `${today}.md`),
      `# Daily Note ${today}\n\n- Test entry for today\n- Brain tiered integration test\n`,
    );

    // Create manager config
    const config: ResolvedBrainTieredConfig = {
      workspaceId: TEST_WORKSPACE_ID,
      triumphWorkspaceId: TEST_TRIUMPH_WORKSPACE_ID,
      memoryMdPath,
      dailyNotesPath,
      mcporterPath: "mcporter",
      tiers: {
        escalationThreshold: 0.8,
        minTier0Results: 3,
        maxTier: 3,
        timeoutMs: 5000,
        enabled: {
          tier1: true,
          tier2: true,
          tier3: true,
        },
      },
    };

    manager = await BrainTieredManager.create(config);
  });

  afterAll(async () => {
    // Cleanup
    await manager?.close?.();
    if (tempDir) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  describe("Tier 0 - Local Memory Search", () => {
    it("searches memory.md first for all queries", async () => {
      const results = await manager.search("sky is blue");

      // Should have results from Tier 0
      expect(results.length).toBeGreaterThan(0);

      // Verify at least one result is from memory.md
      const tier0Results = results.filter((r) => r.source === "memory");
      expect(tier0Results.length).toBeGreaterThan(0);
    });

    it("finds exact matches in memory.md", async () => {
      const results = await manager.search("BGE-M3 embeddings");

      expect(results.length).toBeGreaterThan(0);
      // Should find the technical details section
      const hasMatch = results.some((r) => r.snippet.includes("1024"));
      expect(hasMatch).toBe(true);
    });

    it("searches daily notes directory", async () => {
      const results = await manager.search("Daily Note");

      expect(results.length).toBeGreaterThan(0);
      const hasDailyNote = results.some((r) => r.snippet.includes("Test entry"));
      expect(hasDailyNote).toBe(true);
    });
  });

  describe("Tier Escalation", () => {
    it("escalates to Brain MCP when Tier 0 results insufficient", async () => {
      // Query something not in local memory.md
      // This should trigger escalation to Brain MCP
      const results = await manager.search("machine learning algorithms");

      // May or may not have results depending on Brain content
      // But the manager should not throw
      expect(Array.isArray(results)).toBe(true);
    });

    it("returns Tier 0 results even when Brain MCP has no matches", async () => {
      const results = await manager.search("OpenClaw integrates with Brain MCP");

      // Should definitely have Tier 0 match
      expect(results.length).toBeGreaterThan(0);
      const hasLocalMatch = results.some((r) => r.snippet.includes("Brain MCP"));
      expect(hasLocalMatch).toBe(true);
    });
  });

  describe("Triumph (Shared) Workspace Search", () => {
    it("includes triumphWorkspaceId in config when provided", async () => {
      const status = manager.status();
      expect(status.custom?.triumphWorkspaceId).toBe(TEST_TRIUMPH_WORKSPACE_ID);
    });

    it("creates manager without triumphWorkspaceId", async () => {
      const config: ResolvedBrainTieredConfig = {
        workspaceId: TEST_WORKSPACE_ID,
        // No triumphWorkspaceId
        memoryMdPath,
        dailyNotesPath: path.join(tempDir, "memory"),
        mcporterPath: "mcporter",
        tiers: {
          escalationThreshold: 0.8,
          minTier0Results: 3,
          maxTier: 3,
          timeoutMs: 1000,
          enabled: { tier1: true, tier2: true, tier3: true },
        },
      };

      const noTriumphManager = await BrainTieredManager.create(config);
      const status = noTriumphManager.status();
      expect(status.custom?.triumphWorkspaceId).toBeUndefined();

      // Should still search without triumph workspace
      const results = await noTriumphManager.search("sky is blue");
      expect(results.length).toBeGreaterThan(0);
      await noTriumphManager.close?.();
    });

    it("searches triumph workspace when Tier 0 and private workspace insufficient", async () => {
      // Query something not in local memory
      // This should trigger escalation to private workspace, then triumph
      const results = await manager.search("cross-agent shared knowledge pattern");

      // Should not throw - graceful handling regardless of Brain availability
      expect(Array.isArray(results)).toBe(true);
    });
  });

  describe("Result Deduplication", () => {
    it("deduplicates results with same content across tiers", async () => {
      // Search for something in local memory
      const results = await manager.search("sky is blue");

      // Verify no duplicate snippets (first 100 chars)
      const fingerprints = new Set<string>();
      for (const result of results) {
        const fp = result.snippet.slice(0, 100).toLowerCase().replace(/\s+/g, " ");
        expect(fingerprints.has(fp)).toBe(false);
        fingerprints.add(fp);
      }
    });
  });

  describe("Graceful Degradation", () => {
    it("returns Tier 0 results when Brain MCP is unavailable", async () => {
      // Create a manager with invalid mcporter path
      const badConfig: ResolvedBrainTieredConfig = {
        workspaceId: TEST_WORKSPACE_ID,
        triumphWorkspaceId: TEST_TRIUMPH_WORKSPACE_ID,
        memoryMdPath,
        dailyNotesPath: path.join(tempDir, "memory"),
        mcporterPath: "/nonexistent/mcporter", // Invalid path
        tiers: {
          escalationThreshold: 0.8,
          minTier0Results: 3,
          maxTier: 3,
          timeoutMs: 1000, // Short timeout
          enabled: { tier1: true, tier2: true, tier3: true },
        },
      };

      const badManager = await BrainTieredManager.create(badConfig);

      // Should still return Tier 0 results
      const results = await badManager.search("sky is blue");
      expect(results.length).toBeGreaterThan(0);

      await badManager.close?.();
    });

    it("returns Tier 0 results even when both private and triumph workspaces fail", async () => {
      // Both workspaces use invalid mcporter
      const badConfig: ResolvedBrainTieredConfig = {
        workspaceId: TEST_WORKSPACE_ID,
        triumphWorkspaceId: TEST_TRIUMPH_WORKSPACE_ID,
        memoryMdPath,
        dailyNotesPath: path.join(tempDir, "memory"),
        mcporterPath: "/nonexistent/mcporter",
        tiers: {
          escalationThreshold: 0.8,
          minTier0Results: 3,
          maxTier: 3,
          timeoutMs: 1000,
          enabled: { tier1: true, tier2: true, tier3: true },
        },
      };

      const badManager = await BrainTieredManager.create(badConfig);
      const results = await badManager.search("OpenClaw integrates with Brain MCP");
      expect(results.length).toBeGreaterThan(0);
      expect(results.some((r) => r.snippet.includes("Brain MCP"))).toBe(true);
      await badManager.close?.();
    });
  });

  describe("MemorySearchManager Interface", () => {
    it("implements search() method", async () => {
      const results = await manager.search("test query");
      expect(Array.isArray(results)).toBe(true);
    });

    it("implements readFile() method", async () => {
      const result = await manager.readFile({ relPath: "memory.md" });
      expect(result.text).toContain("Test Memory");
    });

    it("implements status() method", () => {
      const status = manager.status();
      expect(status.backend).toBe("brain-tiered");
    });

    it("implements probeEmbeddingAvailability() method", async () => {
      const probe = await manager.probeEmbeddingAvailability();
      expect(typeof probe.ok).toBe("boolean");
    });

    it("implements probeVectorAvailability() method", async () => {
      const available = await manager.probeVectorAvailability();
      expect(typeof available).toBe("boolean");
    });
  });

  describe("Result Format", () => {
    it("returns results with correct structure", async () => {
      const results = await manager.search("memory");

      if (results.length > 0) {
        const result = results[0];
        expect(result).toHaveProperty("path");
        expect(result).toHaveProperty("startLine");
        expect(result).toHaveProperty("endLine");
        expect(result).toHaveProperty("score");
        expect(result).toHaveProperty("snippet");
        expect(result).toHaveProperty("source");
      }
    });

    it("returns results sorted by score descending", async () => {
      const results = await manager.search("test");

      if (results.length > 1) {
        for (let i = 1; i < results.length; i++) {
          expect(results[i - 1].score).toBeGreaterThanOrEqual(results[i].score);
        }
      }
    });

    it("does not expose internal tierSource field", async () => {
      const results = await manager.search("sky is blue");

      for (const result of results) {
        expect(result).not.toHaveProperty("tierSource");
      }
    });
  });

  describe("Backward Compatibility", () => {
    it("works with config that has no brainTiered settings", async () => {
      // This tests the search-manager.ts flow indirectly:
      // When backend is "builtin" or unset, brain-tiered manager is never instantiated
      // Verified by the existing backend-config.test.ts

      // For brain-tiered manager itself, ensure it works without triumph
      const config: ResolvedBrainTieredConfig = {
        workspaceId: TEST_WORKSPACE_ID,
        memoryMdPath,
        dailyNotesPath: path.join(tempDir, "memory"),
        mcporterPath: "mcporter",
        tiers: {
          escalationThreshold: 0.8,
          minTier0Results: 3,
          maxTier: 3,
          timeoutMs: 5000,
          enabled: { tier1: true, tier2: true, tier3: true },
        },
      };

      const backwardsManager = await BrainTieredManager.create(config);
      const results = await backwardsManager.search("sky is blue");
      expect(results.length).toBeGreaterThan(0);
      await backwardsManager.close?.();
    });
  });
});

describe("BrainTieredManager with Real Brain MCP", () => {
  // Skip these tests if Brain MCP is not available
  const brainAvailable = process.env.TEST_BRAIN_MCP === "true";

  it.skipIf(!brainAvailable)("connects to real Brain MCP via mcporter", async () => {
    const config: ResolvedBrainTieredConfig = {
      workspaceId: "00000000-0000-0000-0000-000000000000", // DEFAULT workspace
      triumphWorkspaceId: "abe073d0-642f-4911-999d-18a5b8b24a5e", // Triumph
      memoryMdPath: "/tmp/test-memory.md",
      dailyNotesPath: "/tmp/test-memory/",
      mcporterPath: "mcporter",
      tiers: {
        escalationThreshold: 0.8,
        minTier0Results: 3,
        maxTier: 3,
        timeoutMs: 5000,
        enabled: { tier1: true, tier2: true, tier3: true },
      },
    };

    // Create temp file
    fs.writeFileSync("/tmp/test-memory.md", "# Test\nLocal content for testing.");
    fs.mkdirSync("/tmp/test-memory/", { recursive: true });

    const manager = await BrainTieredManager.create(config);

    // Test quick_search (Tier 1)
    const results = await manager.search("test query for brain mcp");

    // Should not throw
    expect(Array.isArray(results)).toBe(true);

    await manager.close?.();

    // Cleanup
    fs.unlinkSync("/tmp/test-memory.md");
    fs.rmdirSync("/tmp/test-memory/", { recursive: true });
  });

  it.skipIf(!brainAvailable)("performs tiered search with real data", async () => {
    const config: ResolvedBrainTieredConfig = {
      workspaceId: "00000000-0000-0000-0000-000000000000",
      triumphWorkspaceId: "abe073d0-642f-4911-999d-18a5b8b24a5e",
      memoryMdPath: "/tmp/test-tiered-memory.md",
      dailyNotesPath: "/tmp/test-tiered-memory/",
      mcporterPath: "mcporter",
      tiers: {
        escalationThreshold: 0.8,
        minTier0Results: 3,
        maxTier: 3,
        timeoutMs: 5000,
        enabled: { tier1: true, tier2: true, tier3: true },
      },
    };

    // Create local content that WON'T match the query
    // This forces escalation to Brain MCP
    fs.writeFileSync(
      "/tmp/test-tiered-memory.md",
      "# Unrelated\nThis has nothing to do with the search.",
    );
    fs.mkdirSync("/tmp/test-tiered-memory/", { recursive: true });

    const manager = await BrainTieredManager.create(config);

    // Search for something that should be in Brain but not local
    const results = await manager.search("RRF fusion algorithm");

    // Results may come from Brain MCP (if it has relevant content)
    expect(Array.isArray(results)).toBe(true);

    await manager.close?.();

    // Cleanup
    fs.unlinkSync("/tmp/test-tiered-memory.md");
    fs.rmdirSync("/tmp/test-tiered-memory/", { recursive: true });
  });

  it.skipIf(!brainAvailable)("searches triumph workspace after private workspace", async () => {
    const config: ResolvedBrainTieredConfig = {
      workspaceId: "00000000-0000-0000-0000-000000000000",
      triumphWorkspaceId: "abe073d0-642f-4911-999d-18a5b8b24a5e",
      memoryMdPath: "/tmp/test-triumph-memory.md",
      dailyNotesPath: "/tmp/test-triumph-memory/",
      mcporterPath: "mcporter",
      tiers: {
        escalationThreshold: 0.8,
        minTier0Results: 3,
        maxTier: 1, // Only Tier 1 - to test triumph quick_search
        timeoutMs: 5000,
        enabled: { tier1: true, tier2: false, tier3: false },
      },
    };

    fs.writeFileSync("/tmp/test-triumph-memory.md", "# Empty\nNothing relevant.");
    fs.mkdirSync("/tmp/test-triumph-memory/", { recursive: true });

    const manager = await BrainTieredManager.create(config);
    const results = await manager.search("cross-agent feedback pattern");

    // Should not throw, may or may not find results in triumph
    expect(Array.isArray(results)).toBe(true);

    await manager.close?.();
    fs.unlinkSync("/tmp/test-triumph-memory.md");
    fs.rmdirSync("/tmp/test-triumph-memory/", { recursive: true });
  });
});
