/**
 * Tests for Auto-Submit State Persistence
 */

import { existsSync, rmSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  AutoSubmitStateManager,
  createAutoSubmitStateManager,
  getTodayDate,
  loadState,
  saveState,
} from "./web-autosubmit-state.js";

describe("web-autosubmit-state", () => {
  let testDir: string;
  let testFilePath: string;

  beforeEach(() => {
    testDir = join(tmpdir(), `openclaw-test-${Date.now()}`);
    mkdirSync(testDir, { recursive: true });
    testFilePath = join(testDir, "test-state.json");
  });

  afterEach(() => {
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  // ===========================================================================
  // State Persistence Tests
  // ===========================================================================

  describe("loadState and saveState", () => {
    it("should return fresh state for new file", () => {
      const state = loadState(testFilePath);
      expect(state.date).toBe(getTodayDate());
      expect(state.dailyCount).toBe(0);
      expect(state.workflows).toEqual({});
    });

    it("should persist and load state", () => {
      const state = {
        date: getTodayDate(),
        dailyCount: 2,
        workflows: {
          "wf-123": {
            id: "wf-123",
            submitCount: 1,
            startedAt: new Date().toISOString(),
            submittedUrls: ["https://example.com"],
          },
        },
      };

      saveState(state, testFilePath);
      const loaded = loadState(testFilePath);

      expect(loaded.dailyCount).toBe(2);
      expect(loaded.workflows["wf-123"].submitCount).toBe(1);
    });

    it("should reset state on new day", () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().split("T")[0];

      const oldState = {
        date: yesterdayStr,
        dailyCount: 5,
        workflows: {},
      };

      saveState(oldState, testFilePath);
      const loaded = loadState(testFilePath);

      expect(loaded.date).toBe(getTodayDate());
      expect(loaded.dailyCount).toBe(0);
    });
  });

  // ===========================================================================
  // Cap Enforcement Tests
  // ===========================================================================

  describe("AutoSubmitStateManager caps", () => {
    it("should allow first auto-submit", () => {
      const manager = createAutoSubmitStateManager({
        dailyCap: 3,
        workflowCap: 1,
        filePath: testFilePath,
      });

      const check = manager.checkAutoSubmit("wf-test");
      expect(check.allowed).toBe(true);
    });

    it("should block second auto-submit in same workflow", () => {
      const manager = createAutoSubmitStateManager({
        dailyCap: 3,
        workflowCap: 1,
        filePath: testFilePath,
      });

      // Record first
      manager.recordAutoSubmit("wf-test", "https://example.com/1");

      // Check second
      const check = manager.checkAutoSubmit("wf-test");
      expect(check.allowed).toBe(false);
      expect(check.reason).toContain("Workflow cap");
    });

    it("should allow auto-submit in different workflow", () => {
      const manager = createAutoSubmitStateManager({
        dailyCap: 3,
        workflowCap: 1,
        filePath: testFilePath,
      });

      // Record first workflow
      manager.recordAutoSubmit("wf-1", "https://example.com/1");

      // Check second workflow
      const check = manager.checkAutoSubmit("wf-2");
      expect(check.allowed).toBe(true);
    });

    it("should block when daily cap exceeded", () => {
      const manager = createAutoSubmitStateManager({
        dailyCap: 3,
        workflowCap: 1,
        filePath: testFilePath,
      });

      // Record 3 auto-submits in different workflows
      manager.recordAutoSubmit("wf-1", "https://example.com/1");
      manager.recordAutoSubmit("wf-2", "https://example.com/2");
      manager.recordAutoSubmit("wf-3", "https://example.com/3");

      // 4th should be blocked
      const check = manager.checkAutoSubmit("wf-4");
      expect(check.allowed).toBe(false);
      expect(check.reason).toContain("Daily cap");
    });

    it("should persist caps across restarts", () => {
      // First manager records some submissions
      const manager1 = createAutoSubmitStateManager({
        dailyCap: 3,
        workflowCap: 1,
        filePath: testFilePath,
      });
      manager1.recordAutoSubmit("wf-1", "https://example.com/1");
      manager1.recordAutoSubmit("wf-2", "https://example.com/2");

      // Second manager (simulating restart) should see the count
      const manager2 = createAutoSubmitStateManager({
        dailyCap: 3,
        workflowCap: 1,
        filePath: testFilePath,
      });

      expect(manager2.getDailyCount()).toBe(2);

      // One more allowed
      const check1 = manager2.checkAutoSubmit("wf-3");
      expect(check1.allowed).toBe(true);

      manager2.recordAutoSubmit("wf-3", "https://example.com/3");

      // 4th blocked
      const check2 = manager2.checkAutoSubmit("wf-4");
      expect(check2.allowed).toBe(false);
    });
  });

  // ===========================================================================
  // Workflow Management Tests
  // ===========================================================================

  describe("workflow management", () => {
    it("should track workflow state", () => {
      const manager = createAutoSubmitStateManager({
        filePath: testFilePath,
      });

      manager.startWorkflow("wf-test");
      const state = manager.getWorkflowState("wf-test");

      expect(state).not.toBeNull();
      expect(state?.id).toBe("wf-test");
      expect(state?.submitCount).toBe(0);
    });

    it("should list workflow IDs", () => {
      const manager = createAutoSubmitStateManager({
        filePath: testFilePath,
      });

      manager.startWorkflow("wf-1");
      manager.startWorkflow("wf-2");

      const ids = manager.getWorkflowIds();
      expect(ids).toContain("wf-1");
      expect(ids).toContain("wf-2");
    });

    it("should clean up ended workflows", () => {
      const manager = createAutoSubmitStateManager({
        filePath: testFilePath,
      });

      manager.startWorkflow("wf-temp");
      expect(manager.getWorkflowState("wf-temp")).not.toBeNull();

      manager.endWorkflow("wf-temp");
      expect(manager.getWorkflowState("wf-temp")).toBeNull();
    });

    it("should track submitted URLs", () => {
      const manager = createAutoSubmitStateManager({
        dailyCap: 10,
        workflowCap: 5,
        filePath: testFilePath,
      });

      manager.recordAutoSubmit("wf-test", "https://example.com/1");
      manager.recordAutoSubmit("wf-test", "https://example.com/2");

      const state = manager.getWorkflowState("wf-test");
      expect(state?.submittedUrls).toContain("https://example.com/1");
      expect(state?.submittedUrls).toContain("https://example.com/2");
    });
  });

  // ===========================================================================
  // Reset Tests
  // ===========================================================================

  describe("reset", () => {
    it("should reset all state", () => {
      const manager = createAutoSubmitStateManager({
        filePath: testFilePath,
      });

      manager.recordAutoSubmit("wf-1", "https://example.com");
      expect(manager.getDailyCount()).toBe(1);

      manager.reset();

      expect(manager.getDailyCount()).toBe(0);
      expect(manager.getWorkflowIds()).toEqual([]);
    });
  });

  // ===========================================================================
  // Edge Cases
  // ===========================================================================

  describe("edge cases", () => {
    it("should handle corrupted state file", () => {
      // Write invalid JSON
      const fs = require("node:fs");
      fs.writeFileSync(testFilePath, "not valid json", "utf-8");

      const state = loadState(testFilePath);
      expect(state.date).toBe(getTodayDate());
      expect(state.dailyCount).toBe(0);
    });

    it("should report caps in check result", () => {
      const manager = createAutoSubmitStateManager({
        dailyCap: 5,
        workflowCap: 2,
        filePath: testFilePath,
      });

      const check = manager.checkAutoSubmit("wf-test");
      expect(check.dailyCap).toBe(5);
      expect(check.workflowCap).toBe(2);
    });
  });
});
