import { describe, expect, it } from "vitest";
import { createTaskDecomposeTool } from "./task-decompose-tool.js";

describe("task-decompose-tool", () => {
  describe("createTaskDecomposeTool", () => {
    it("should create tool with correct metadata", () => {
      const tool = createTaskDecomposeTool({});
      
      expect(tool).not.toBeNull();
      expect(tool?.name).toBe("task_decompose");
      expect(tool?.label).toBe("Task Decomposition");
      expect(tool?.description).toContain("Break down complex tasks");
    });

    it("should handle simple tasks with sequential strategy", async () => {
      const tool = createTaskDecomposeTool({});
      expect(tool).not.toBeNull();
      
      const result = await tool!.execute("call-1", {
        task: "Fix typo in README",
        maxSteps: 5,
      });

      expect(result.details).toBeDefined();
      const data = result.details as Record<string, unknown>;
      expect(data.strategy).toBe("sequential");
      expect(Array.isArray(data.steps)).toBe(true);
      expect(data.steps.length).toBeLessThanOrEqual(5);
    });

    it("should handle complex tasks with mixed strategy", async () => {
      const tool = createTaskDecomposeTool({});
      expect(tool).not.toBeNull();
      
      const result = await tool!.execute("call-2", {
        task: "Implement a new authentication system with OAuth2 integration and database migration",
        maxSteps: 15,
      });

      expect(result.details).toBeDefined();
      const data = result.details as Record<string, unknown>;
      expect(data.strategy).toBe("mixed");
      expect(Array.isArray(data.steps)).toBe(true);
      expect(data.criticalPath).toBeDefined();
      expect(Array.isArray(data.suggestions)).toBe(true);
    });

    it("should respect maxSteps parameter", async () => {
      const tool = createTaskDecomposeTool({});
      expect(tool).not.toBeNull();
      
      const maxSteps = 3;
      const result = await tool!.execute("call-3", {
        task: "Build a complete web application with frontend and backend",
        maxSteps,
      });

      const data = result.details as Record<string, unknown>;
      expect((data.steps as Array<unknown>).length).toBeLessThanOrEqual(maxSteps);
    });

    it("should include estimates when requested", async () => {
      const tool = createTaskDecomposeTool({});
      expect(tool).not.toBeNull();
      
      const result = await tool!.execute("call-4", {
        task: "Add logging to the application",
        includeEstimates: true,
      });

      const data = result.details as Record<string, unknown>;
      expect(data.totalEstimatedTokens).toBeDefined();
      expect(typeof data.totalEstimatedTokens).toBe("number");
      
      const steps = data.steps as Array<Record<string, unknown>>;
      expect(steps[0].estimatedTokens).toBeDefined();
    });

    it("should exclude estimates when not requested", async () => {
      const tool = createTaskDecomposeTool({});
      expect(tool).not.toBeNull();
      
      const result = await tool!.execute("call-5", {
        task: "Add logging to the application",
        includeEstimates: false,
      });

      const data = result.details as Record<string, unknown>;
      const steps = data.steps as Array<Record<string, unknown>>;
      expect(steps[0].estimatedTokens).toBeUndefined();
    });

    it("should handle parallel strategy", async () => {
      const tool = createTaskDecomposeTool({});
      expect(tool).not.toBeNull();
      
      const result = await tool!.execute("call-6", {
        task: "Research and implement performance optimization",
        strategy: "parallel",
      });

      const data = result.details as Record<string, unknown>;
      expect(data.strategy).toBe("parallel");
    });

    it("should generate critical path", async () => {
      const tool = createTaskDecomposeTool({});
      expect(tool).not.toBeNull();
      
      const result = await tool!.execute("call-7", {
        task: "Create a new feature",
      });

      const data = result.details as Record<string, unknown>;
      const criticalPath = data.criticalPath as string[];
      expect(Array.isArray(criticalPath)).toBe(true);
      expect(criticalPath.length).toBeGreaterThan(0);
    });

    it("should provide suggestions for improvement", async () => {
      const tool = createTaskDecomposeTool({});
      expect(tool).not.toBeNull();
      
      const result = await tool!.execute("call-8", {
        task: "Quick fix",
      });

      const data = result.details as Record<string, unknown>;
      expect(Array.isArray(data.suggestions)).toBe(true);
    });

    it("should handle task with context", async () => {
      const tool = createTaskDecomposeTool({});
      expect(tool).not.toBeNull();
      
      const result = await tool!.execute("call-9", {
        task: "Update database schema",
        context: "PostgreSQL database with existing user table",
      });

      const data = result.details as Record<string, unknown>;
      expect(data.originalTask).toBe("Update database schema");
    });

    it("should handle missing required task parameter", async () => {
      const tool = createTaskDecomposeTool({});
      expect(tool).not.toBeNull();
      
      await expect(
        tool!.execute("call-10", { task: "" }),
      ).rejects.toThrow();
    });

    it("should compute dependencies correctly", async () => {
      const tool = createTaskDecomposeTool({});
      expect(tool).not.toBeNull();
      
      const result = await tool!.execute("call-11", {
        task: "Implement user authentication flow",
      });

      const data = result.details as Record<string, unknown>;
      const steps = data.steps as Array<{
        id: string;
        dependencies: string[];
      }>;
      
      expect(steps.length).toBeGreaterThan(0);
      for (const step of steps) {
        expect(step.id).toBeDefined();
        expect(Array.isArray(step.dependencies)).toBe(true);
      }
    });

    it("should assign priorities to steps", async () => {
      const tool = createTaskDecomposeTool({});
      expect(tool).not.toBeNull();
      
      const result = await tool!.execute("call-12", {
        task: "Build REST API",
        includeEstimates: true,
      });

      const data = result.details as Record<string, unknown>;
      const steps = data.steps as Array<{ priority: number }>;
      
      for (const step of steps) {
        expect(typeof step.priority).toBe("number");
        expect(step.priority).toBeGreaterThan(0);
      }
    });

    it("should categorize step types", async () => {
      const tool = createTaskDecomposeTool({});
      expect(tool).not.toBeNull();
      
      const result = await tool!.execute("call-13", {
        task: "Develop and deploy microservice",
      });

      const data = result.details as Record<string, unknown>;
      const steps = data.steps as Array<{ type: string }>;
      
      const validTypes = ["research", "analysis", "creation", "review", "execution"];
      for (const step of steps) {
        expect(validTypes).toContain(step.type);
      }
    });
  });

  describe("analyzeTaskComplexity", () => {
    it("should identify simple tasks", async () => {
      const tool = createTaskDecomposeTool({});
      expect(tool).not.toBeNull();
      
      const result = await tool!.execute("call-14", {
        task: "Fix typo",
      });

      const data = result.details as Record<string, unknown>;
      expect(data.strategy).toBe("sequential");
    });

    it("should identify complex tasks", async () => {
      const tool = createTaskDecomposeTool({});
      expect(tool).not.toBeNull();
      
      const result = await tool!.execute("call-15", {
        task: "Design and implement a distributed caching system with multiple backends",
      });

      const data = result.details as Record<string, unknown>;
      expect(data.strategy).toBe("mixed");
    });
  });
});
