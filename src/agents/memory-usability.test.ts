// oxlint-disable-file typescript/no-explicit-any
import { describe, expect, it, vi } from "vitest";

vi.mock("../../memory/index.js", () => ({
  getMemorySearchManager: vi.fn().mockResolvedValue({
    manager: {
      status: vi.fn().mockReturnValue({
        files: [{ path: "/test/memory.md" }],
        totalChunks: 100,
        sessionFiles: [{ path: "/test/session.jsonl" }],
      }),
      flushOlderThan: vi.fn().mockResolvedValue(undefined),
      compact: vi.fn().mockResolvedValue(undefined),
      cleanupOrphans: vi.fn().mockResolvedValue(5),
      importData: vi.fn().mockResolvedValue(undefined),
    },
    error: undefined,
  }),
}));

vi.mock("../agent-scope.js", () => ({
  resolveSessionAgentId: vi.fn().mockReturnValue("main"),
}));

describe("memory-usability", () => {
  describe("createMemoryUsabilityEnhancer", () => {
    it("should create enhancer instance", async () => {
      const { createMemoryUsabilityEnhancer } = await import("./memory-usability.js");
      const enhancer = createMemoryUsabilityEnhancer({ agents: { list: [{ id: "main" }] } } as any); // eslint-disable-line @typescript-eslint/no-explicit-any
      expect(enhancer).toBeDefined();
    });

    it("should get usage stats", async () => {
      const { MemoryUsabilityEnhancer } = await import("./memory-usability.js");
      const enhancer = new MemoryUsabilityEnhancer({ agents: { list: [{ id: "main" }] } } as any, "main"); // eslint-disable-line @typescript-eslint/no-explicit-any
      const stats = await enhancer.getUsageStats();
      expect(stats.totalFiles).toBeGreaterThanOrEqual(0);
    });

    it("should perform dry run flush", async () => {
      const { MemoryUsabilityEnhancer } = await import("./memory-usability.js");
      const enhancer = new MemoryUsabilityEnhancer({ agents: { list: [{ id: "main" }] } } as any, "main");
      const result = await enhancer.flush({ dryRun: true });
      expect(result.success).toBe(true);
      expect(result.message).toContain("Dry run");
    });

    it("should compact memory", async () => {
      const { MemoryUsabilityEnhancer } = await import("./memory-usability.js");
      const enhancer = new MemoryUsabilityEnhancer({ agents: { list: [{ id: "main" }] } } as any, "main");
      const result = await enhancer.compact();
      expect(result.success).toBe(true);
      expect(result.action).toBe("compact");
    });

    it("should export memory", async () => {
      const { MemoryUsabilityEnhancer } = await import("./memory-usability.js");
      const enhancer = new MemoryUsabilityEnhancer({ agents: { list: [{ id: "main" }] } } as any, "main");
      const result = await enhancer.export();
      expect(result.success).toBe(true);
      expect(result.action).toBe("export");
    });

    it("should reject import without source path", async () => {
      const { MemoryUsabilityEnhancer } = await import("./memory-usability.js");
      const enhancer = new MemoryUsabilityEnhancer({ agents: { list: [{ id: "main" }] } } as any, "main");
      const result = await enhancer.import();
      expect(result.success).toBe(false);
      expect(result.message).toContain("Source path required");
    });

    it("should cleanup orphaned data", async () => {
      const { MemoryUsabilityEnhancer } = await import("./memory-usability.js");
      const enhancer = new MemoryUsabilityEnhancer({ agents: { list: [{ id: "main" }] } } as any, "main");
      const result = await enhancer.cleanup();
      expect(result.success).toBe(true);
      expect(result.action).toBe("cleanup");
    });

    it("should optimize memory", async () => {
      const { MemoryUsabilityEnhancer } = await import("./memory-usability.js");
      const enhancer = new MemoryUsabilityEnhancer({ agents: { list: [{ id: "main" }] } } as any, "main");
      const result = await enhancer.optimize();
      expect(result.success).toBe(true);
      expect(result.action).toBe("optimize");
    });

    it("should provide recommendations", async () => {
      const { MemoryUsabilityEnhancer } = await import("./memory-usability.js");
      const enhancer = new MemoryUsabilityEnhancer({ agents: { list: [{ id: "main" }] } } as any, "main");
      const recommendations = enhancer.getRecommendations();
      expect(Array.isArray(recommendations)).toBe(true);
      expect(recommendations.length).toBeGreaterThan(0);
    });
  });

  describe("formatBytes helper", () => {
    it("should format bytes correctly", async () => {
      const { MemoryUsabilityEnhancer } = await import("./memory-usability.js");
      const enhancer = new MemoryUsabilityEnhancer({ agents: { list: [{ id: "main" }] } } as any, "main");
      expect((enhancer as unknown as { formatBytes: (n: number) => string }).formatBytes(500)).toBe("500 B");
      expect((enhancer as unknown as { formatBytes: (n: number) => string }).formatBytes(1500)).toBe("1.5 KB");
      expect((enhancer as unknown as { formatBytes: (n: number) => string }).formatBytes(1500000)).toBe("1.4 MB");
    });
  });
});
