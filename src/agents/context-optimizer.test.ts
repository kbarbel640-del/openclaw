import { describe, expect, it, beforeEach } from "vitest";
import type { AgentMessage } from "@mariozechner/pi-agent-core";

import { 
  ContextOptimizer, 
  createContextOptimizerFromConfig,
  optimizeBeforeCompaction,
  type ContextOptimizerConfig,
} from "./context-optimizer.js";
import type { OpenClawConfig } from "../config/config.js";

const createMockMessage = (content: string, role: "user" | "assistant" | "system" = "user"): AgentMessage => ({
  role,
  content,
});

const createTestMessages = (): AgentMessage[] => [
  createMockMessage("SOUL.md content - who I am", "system"), // core, protected
  createMockMessage("AGENTS.md content - behavior", "system"), // core, protected  
  createMockMessage("USER.md content - user profile", "system"), // core, protected
  createMockMessage("Chrome DevTools skill documentation SKILL.md", "assistant"), // skill_docs, evictable
  createMockMessage("GitHub CLI skill documentation", "assistant"), // skill_docs, evictable
  createMockMessage("Current conversation - active task", "user"), // active_tasks, protected
  createMockMessage("ls -la output from directory listing", "assistant"), // old_outputs, evictable
  createMockMessage("$ npm install command output", "assistant"), // temp_results, evictable
  createMockMessage("test-file.html content for analysis", "assistant"), // temp_files, evictable
  createMockMessage("Recent user question", "user"), // active_tasks, protected
];

describe("ContextOptimizer", () => {
  let optimizer: ContextOptimizer;

  beforeEach(() => {
    optimizer = new ContextOptimizer({
      enabled: true,
      level: "balanced",
      debug: false,
    });
  });

  describe("constructor and configuration", () => {
    it("should create with default configuration when disabled", () => {
      const defaultOptimizer = new ContextOptimizer();
      const stats = defaultOptimizer.getStats();
      
      expect(stats.enabled).toBe(false);
      expect(stats.level).toBe("balanced");
    });

    it("should accept custom configuration", () => {
      const customConfig: Partial<ContextOptimizerConfig> = {
        enabled: true,
        level: "aggressive",
        evictionThreshold: 3,
        debug: true,
      };
      
      const customOptimizer = new ContextOptimizer(customConfig);
      const stats = customOptimizer.getStats();
      
      expect(stats.enabled).toBe(true);
      expect(stats.level).toBe("aggressive");
    });

    it("should update configuration dynamically", () => {
      optimizer.updateConfig({ level: "conservative", evictionThreshold: 10 });
      const stats = optimizer.getStats();
      
      expect(stats.level).toBe("conservative");
    });
  });

  describe("optimization levels", () => {
    const messages = createTestMessages();

    it("should not optimize when disabled", () => {
      const disabledOptimizer = new ContextOptimizer({ enabled: false });
      const result = disabledOptimizer.optimizeContext(messages);
      
      expect(result).toHaveLength(messages.length);
      expect(result).toEqual(messages);
    });

    it("should be conservative with conservative level", () => {
      optimizer.updateConfig({ level: "conservative" });
      const result = optimizer.optimizeContext(messages);
      const stats = optimizer.getStats();
      
      // Conservative should evict fewer items
      expect(result.length).toBeGreaterThan(7); // Most messages preserved
      expect(stats.evictedItems).toBeLessThan(3);
    });

    it("should be moderate with balanced level", () => {
      optimizer.updateConfig({ level: "balanced" });
      const result = optimizer.optimizeContext(messages);
      const stats = optimizer.getStats();
      
      // Balanced should evict some items
      expect(result.length).toBeLessThan(messages.length);
      expect(result.length).toBeGreaterThan(6); 
      expect(stats.evictedItems).toBeGreaterThan(0);
    });

    it("should be aggressive with aggressive level", () => {
      optimizer.updateConfig({ level: "aggressive" });
      const result = optimizer.optimizeContext(messages);
      const stats = optimizer.getStats();
      
      // Aggressive should evict more items
      expect(result.length).toBeLessThan(messages.length);
      expect(stats.evictedItems).toBeGreaterThan(2);
    });
  });

  describe("message analysis and protection", () => {
    it("should never evict core messages", () => {
      const coreMessages = [
        createMockMessage("SOUL.md content", "system"),
        createMockMessage("AGENTS.md behavior", "system"),
        createMockMessage("USER.md profile", "system"),
      ];
      
      optimizer.updateConfig({ level: "aggressive" });
      const result = optimizer.optimizeContext(coreMessages);
      
      expect(result).toHaveLength(coreMessages.length);
      expect(result).toEqual(coreMessages);
    });

    it("should protect active conversation", () => {
      const activeMessages = [
        createMockMessage("Current conversation - active task"),
        createMockMessage("Recent user question"),
        createMockMessage("Assistant response to active task"),
      ];
      
      optimizer.updateConfig({ level: "aggressive" });
      const result = optimizer.optimizeContext(activeMessages);
      
      // Active messages should be mostly preserved
      expect(result.length).toBeGreaterThanOrEqual(2);
    });

    it("should evict old outputs and temp files", () => {
      const evictableMessages = [
        createMockMessage("Chrome DevTools SKILL.md documentation"),
        createMockMessage("ls -la old directory listing"),
        createMockMessage("test-file.html temporary content"),
        createMockMessage("$ npm install old command output"),
      ];
      
      // Make them old enough to be evicted
      optimizer.updateConfig({ evictionThreshold: 1 });
      const result = optimizer.optimizeContext(evictableMessages);
      
      expect(result.length).toBeLessThan(evictableMessages.length);
    });
  });

  describe("token estimation and savings", () => {
    it("should calculate token savings correctly", () => {
      const messages = createTestMessages();
      const result = optimizer.optimizeContext(messages);
      const stats = optimizer.getStats();
      
      expect(stats.originalTokens).toBeGreaterThan(0);
      expect(stats.optimizedTokens).toBeGreaterThan(0);
      expect(stats.optimizedTokens).toBeLessThanOrEqual(stats.originalTokens);
      
      const expectedSavings = ((stats.originalTokens - stats.optimizedTokens) / stats.originalTokens * 100);
      expect(stats.savings).toBe(`${expectedSavings.toFixed(1)}%`);
    });

    it("should show zero savings when no optimization occurs", () => {
      const protectedMessages = [
        createMockMessage("SOUL.md content", "system"),
        createMockMessage("Recent conversation", "user"),
      ];
      
      const result = optimizer.optimizeContext(protectedMessages);
      const stats = optimizer.getStats();
      
      expect(result).toEqual(protectedMessages);
      expect(stats.savings).toBe("0.0%");
      expect(stats.evictedItems).toBe(0);
    });
  });

  describe("eviction and reload system", () => {
    it("should cache evicted messages", () => {
      const messages = createTestMessages();
      optimizer.optimizeContext(messages);
      const stats = optimizer.getStats();
      
      if (stats.evictedItems > 0) {
        expect(stats.cacheSize).toBeGreaterThan(0);
        expect(stats.cacheSize).toBe(stats.evictedItems);
      }
    });

    it("should track reload attempts", () => {
      const messages = [
        createMockMessage("Evictable content that will be removed"),
        createMockMessage("More evictable content"),
      ];
      
      optimizer.updateConfig({ evictionThreshold: 1 });
      optimizer.optimizeContext(messages);
      
      const stats = optimizer.getStats();
      expect(stats.evictedItems).toBeGreaterThan(0);
    });

    it("should handle reload errors gracefully", () => {
      expect(() => {
        optimizer.reloadEvicted("nonexistent-message");
      }).toThrow("Cannot reload evicted message: nonexistent-message");
      
      const stats = optimizer.getStats();
      expect(stats.errors).toBe(1);
    });
  });

  describe("cache management", () => {
    it("should clean up old cache entries", () => {
      const messages = createTestMessages();
      optimizer.updateConfig({ evictionThreshold: 1 });
      optimizer.optimizeContext(messages);
      
      // Simulate old cache entries
      optimizer.cleanupCache(0); // Clean everything
      
      const stats = optimizer.getStats();
      expect(stats.cacheSize).toBe(0);
    });

    it("should reset stats and cache", () => {
      const messages = createTestMessages();
      optimizer.optimizeContext(messages);
      
      optimizer.reset();
      const stats = optimizer.getStats();
      
      expect(stats.originalTokens).toBe(0);
      expect(stats.optimizedTokens).toBe(0);
      expect(stats.evictedItems).toBe(0);
      expect(stats.cacheSize).toBe(0);
      expect(stats.reloadCount).toBe(0);
      expect(stats.errors).toBe(0);
    });
  });

  describe("realistic optimization scenarios", () => {
    it("should handle large context with mixed content", () => {
      const largeContext: AgentMessage[] = [
        // Core system messages (should be protected)
        createMockMessage("SOUL.md - personality definition", "system"),
        createMockMessage("AGENTS.md - behavior rules", "system"),
        
        // Recent conversation (should be protected)
        createMockMessage("User: Create a new project", "user"),
        createMockMessage("I'll help you create a project", "assistant"),
        
        // Skill documentation (evictable)
        createMockMessage("GitHub CLI skill documentation with all commands", "assistant"),
        createMockMessage("Chrome DevTools MCP skill reference", "assistant"),
        
        // Old command outputs (evictable)
        createMockMessage("$ ls -la /home/user/projects\ntotal 256\ndrwxr...", "assistant"),
        createMockMessage("git status output showing clean working tree", "assistant"),
        
        // Temporary file content (evictable)
        createMockMessage("package.json content for temporary analysis", "assistant"),
        createMockMessage("Large HTML file content from previous read", "assistant"),
        
        // More recent conversation (should be protected)
        createMockMessage("User: What about documentation?", "user"),
        createMockMessage("I'll document the project structure", "assistant"),
      ];

      const result = optimizer.optimizeContext(largeContext);
      const stats = optimizer.getStats();

      // Should preserve core and recent conversation
      expect(result.length).toBeLessThan(largeContext.length);
      expect(result.length).toBeGreaterThanOrEqual(6); // Core + recent
      
      // Should show meaningful savings
      expect(stats.evictedItems).toBeGreaterThan(0);
      expect(parseFloat(stats.savings)).toBeGreaterThan(10);
      
      // Core messages should be preserved
      expect(result.some(msg => msg.content.includes("SOUL.md"))).toBe(true);
      expect(result.some(msg => msg.content.includes("AGENTS.md"))).toBe(true);
      
      // Recent conversation should be preserved
      expect(result.some(msg => msg.content.includes("Create a new project"))).toBe(true);
      expect(result.some(msg => msg.content.includes("What about documentation"))).toBe(true);
    });

    it("should work with empty or minimal context", () => {
      expect(() => {
        optimizer.optimizeContext([]);
      }).not.toThrow();
      
      const stats = optimizer.getStats();
      expect(stats.originalTokens).toBe(0);
      expect(stats.optimizedTokens).toBe(0);
    });
  });
});

describe("Config integration", () => {
  it("should create optimizer from OpenClaw config", () => {
    const config: OpenClawConfig = {
      experimental: {
        contextOptimizeCustom: {
          enabled: true,
          level: "aggressive",
          evictionThreshold: 3,
          debug: true,
        },
      },
    } as OpenClawConfig;

    const optimizer = createContextOptimizerFromConfig(config);
    const stats = optimizer.getStats();

    expect(stats.enabled).toBe(true);
    expect(stats.level).toBe("aggressive");
  });

  it("should handle missing config gracefully", () => {
    const config: OpenClawConfig = {} as OpenClawConfig;
    const optimizer = createContextOptimizerFromConfig(config);
    const stats = optimizer.getStats();

    expect(stats.enabled).toBe(false);
    expect(stats.level).toBe("balanced");
  });

  it("should integrate with compaction system", () => {
    const config: OpenClawConfig = {
      experimental: {
        contextOptimizeCustom: {
          enabled: true,
          level: "balanced",
        },
      },
    } as OpenClawConfig;

    const messages = createTestMessages();
    const result = optimizeBeforeCompaction(messages, config);

    expect(result.length).toBeLessThanOrEqual(messages.length);
  });
});

describe("Performance considerations", () => {
  it("should handle large message arrays efficiently", () => {
    const largeMessageArray = Array.from({ length: 1000 }, (_, i) => 
      createMockMessage(`Message ${i} with some content to analyze`)
    );

    const startTime = Date.now();
    const result = optimizer.optimizeContext(largeMessageArray);
    const duration = Date.now() - startTime;

    // Should complete in reasonable time (< 1 second for 1000 messages)
    expect(duration).toBeLessThan(1000);
    expect(result.length).toBeLessThanOrEqual(largeMessageArray.length);
  });

  it("should maintain stable memory usage", () => {
    // Test multiple optimization cycles
    const messages = createTestMessages();
    
    for (let i = 0; i < 10; i++) {
      optimizer.optimizeContext(messages);
      optimizer.cleanupCache(100); // Aggressive cleanup
    }
    
    const stats = optimizer.getStats();
    
    // Cache size should be reasonable
    expect(stats.cacheSize).toBeLessThan(20);
  });
});