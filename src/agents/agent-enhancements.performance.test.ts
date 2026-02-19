/**
 * Agent 能力增强方案 - 性能基准测试
 */

import { describe, it, expect } from "vitest";
import { createTaskDecomposeTool } from "./tools/task-decompose-tool.js";
import { createErrorHealer } from "./error-healing.js";
import { validateServerName, validateToolName } from "./mcp-auto-discovery.js";

describe("Agent Enhancements Performance Benchmarks", () => {
  describe("Task Decomposition Tool Performance", () => {
    it("should decompose simple task in <100ms", async () => {
      const tool = createTaskDecomposeTool({});
      expect(tool).toBeDefined();

      const start = performance.now();
      const result = await tool.execute(
        "test-id",
        { task: "Write hello world" },
        undefined,
        undefined,
      );
      const end = performance.now();

      const latency = end - start;
      console.log(`✓ Simple task decomposition: ${latency.toFixed(2)}ms`);

      expect(latency).toBeLessThan(100);
      expect(result).toBeDefined();
    });

    it("should decompose complex task in <500ms", async () => {
      const tool = createTaskDecomposeTool({});
      expect(tool).toBeDefined();

      const start = performance.now();
      const result = await tool.execute(
        "test-id",
        {
          task: "Build complete REST API with authentication, database, and tests",
          maxSteps: 10,
          strategy: "mixed",
        },
        undefined,
        undefined,
      );
      const end = performance.now();

      const latency = end - start;
      console.log(`✓ Complex task decomposition: ${latency.toFixed(2)}ms`);

      expect(latency).toBeLessThan(500);
      expect(result).toBeDefined();
    });
  });

  describe("Error Healing System Performance", () => {
    it("should categorize error in <10ms", () => {
      const healer = createErrorHealer();

      const start = performance.now();
      const category = healer.categorize({
        errorMessage: "ECONNRESET: Connection reset",
      });
      const end = performance.now();

      const latency = end - start;
      console.log(`✓ Error categorization: ${latency.toFixed(2)}ms`);

      expect(latency).toBeLessThan(10);
      expect(category).toBe("network");
    });

    it("should provide healing strategy in <20ms", async () => {
      const healer = createErrorHealer();

      const start = performance.now();
      const result = await healer.heal({
        errorMessage: "Rate limit exceeded",
        retryCount: 0,
      });
      const end = performance.now();

      const latency = end - start;
      console.log(`✓ Healing strategy: ${latency.toFixed(2)}ms`);

      expect(latency).toBeLessThan(20);
      expect(result.success).toBe(true);
    });

    it("should handle 100 errors/sec", async () => {
      const healer = createErrorHealer();
      const errors = Array(100).fill(null).map((_, i) => ({
        errorMessage: `Error ${i}`,
        retryCount: i % 3,
      }));

      const start = performance.now();

      for (const error of errors) {
        await healer.heal(error);
      }

      const end = performance.now();
      const avgLatency = (end - start) / errors.length;

      console.log(`✓ Error healing throughput: ${avgLatency.toFixed(2)}ms/error`);

      expect(avgLatency).toBeLessThan(50);
    });
  });

  describe("MCP Input Validation Performance", () => {
    it("should validate server name in <1ms", () => {
      const validNames = ["github", "filesystem", "my-server-123"];

      const start = performance.now();

      validNames.forEach((name) => {
        const result = validateServerName(name);
        expect(result).toBe(true);
      });

      const end = performance.now();
      const avgLatency = (end - start) / validNames.length;

      console.log(`✓ Server name validation: ${avgLatency.toFixed(2)}ms`);

      expect(avgLatency).toBeLessThan(1);
    });

    it("should reject malicious inputs", () => {
      const maliciousInputs = [
        "server; rm -rf /",
        "tool`rm -rf /`",
        "server$(rm -rf /)",
      ];

      const start = performance.now();

      maliciousInputs.forEach((input) => {
        const validServer = validateServerName(input);
        expect(validServer).toBe(false);
      });

      const end = performance.now();
      const avgLatency = (end - start) / maliciousInputs.length;

      console.log(`✓ Malicious input rejection: ${avgLatency.toFixed(2)}ms`);

      expect(avgLatency).toBeLessThan(1);
    });

    it("should handle 1000 validations/sec", () => {
      const inputs = Array(1000).fill(null).map((_, i) => `server-${i}`);

      const start = performance.now();

      inputs.forEach((input) => {
        validateServerName(input);
        validateToolName(input);
      });

      const end = performance.now();
      const totalLatency = end - start;

      console.log(`✓ Validation throughput: ${(1000 / (totalLatency / 1000)).toFixed(0)} validations/sec`);

      expect(totalLatency).toBeLessThan(1000);
    });
  });
});
