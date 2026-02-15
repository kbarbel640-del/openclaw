/**
 * Tests for workflow checkpoint system.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  createCheckpoint,
  recordSubtaskCompletion,
  updateCheckpointContext,
  getCheckpoint,
  listCheckpointsForWorkflow,
  listAllCheckpoints,
  getLatestCheckpoint,
  prepareResumePlan,
  deleteCheckpoint,
  resetCheckpointsForTests,
  restoreCheckpoints,
} from "./workflow-checkpoint.js";

// Mock the store module to avoid disk I/O
vi.mock("./workflow-checkpoint-store.js", () => ({
  loadCheckpointIndex: () => new Map(),
  saveCheckpointIndex: vi.fn(),
  saveCheckpointData: vi.fn(),
  loadCheckpointData: vi.fn(() => null),
  deleteCheckpointData: vi.fn(),
  listCheckpointFiles: vi.fn(() => []),
}));

describe("workflow-checkpoint", () => {
  beforeEach(() => {
    resetCheckpointsForTests();
  });

  describe("createCheckpoint", () => {
    it("creates checkpoint with correct fields", () => {
      const checkpoint = createCheckpoint({
        workflowId: "wf-1",
        phase: "initial",
        pendingSubtaskIds: ["task-1", "task-2"],
        sharedContext: { key: "value" },
      });

      expect(checkpoint.workflowId).toBe("wf-1");
      expect(checkpoint.phase).toBe("initial");
      expect(checkpoint.pendingSubtaskIds).toEqual(["task-1", "task-2"]);
      expect(checkpoint.sharedContext).toEqual({ key: "value" });
      expect(checkpoint.completedSubtasks).toEqual({});
    });

    it("generates unique ID", () => {
      const cp1 = createCheckpoint({
        workflowId: "wf-1",
        phase: "test",
        pendingSubtaskIds: [],
      });

      const cp2 = createCheckpoint({
        workflowId: "wf-1",
        phase: "test",
        pendingSubtaskIds: [],
      });

      expect(cp1.id).toBeTruthy();
      expect(cp2.id).toBeTruthy();
      expect(cp1.id).not.toBe(cp2.id);
    });

    it("sets createdAt and updatedAt timestamps", () => {
      const before = Date.now();
      const checkpoint = createCheckpoint({
        workflowId: "wf-1",
        phase: "test",
        pendingSubtaskIds: [],
      });
      const after = Date.now();

      expect(checkpoint.createdAt).toBeGreaterThanOrEqual(before);
      expect(checkpoint.createdAt).toBeLessThanOrEqual(after);
      expect(checkpoint.updatedAt).toBe(checkpoint.createdAt);
    });

    it("defaults to empty sharedContext when not provided", () => {
      const checkpoint = createCheckpoint({
        workflowId: "wf-1",
        phase: "test",
        pendingSubtaskIds: [],
      });

      expect(checkpoint.sharedContext).toEqual({});
    });

    it("handles empty pendingSubtaskIds", () => {
      const checkpoint = createCheckpoint({
        workflowId: "wf-1",
        phase: "test",
        pendingSubtaskIds: [],
      });

      expect(checkpoint.pendingSubtaskIds).toEqual([]);
    });
  });

  describe("recordSubtaskCompletion", () => {
    it("records completed subtask", () => {
      const checkpoint = createCheckpoint({
        workflowId: "wf-1",
        phase: "test",
        pendingSubtaskIds: ["task-1", "task-2"],
      });

      recordSubtaskCompletion(checkpoint.id, "task-1", {
        result: "success",
        model: "gpt-4",
        tokens: 100,
      });

      const updated = getCheckpoint(checkpoint.id);
      expect(updated?.completedSubtasks["task-1"]).toEqual({
        result: "success",
        model: "gpt-4",
        tokens: 100,
      });
    });

    it("removes from pendingSubtaskIds", () => {
      const checkpoint = createCheckpoint({
        workflowId: "wf-1",
        phase: "test",
        pendingSubtaskIds: ["task-1", "task-2"],
      });

      recordSubtaskCompletion(checkpoint.id, "task-1", { result: "success" });

      const updated = getCheckpoint(checkpoint.id);
      expect(updated?.pendingSubtaskIds).toEqual(["task-2"]);
    });

    it("updates updatedAt timestamp", () => {
      const checkpoint = createCheckpoint({
        workflowId: "wf-1",
        phase: "test",
        pendingSubtaskIds: ["task-1"],
      });

      const originalUpdatedAt = checkpoint.updatedAt;

      // Wait a bit to ensure timestamp difference
      vi.useFakeTimers();
      vi.setSystemTime(Date.now() + 1000);

      recordSubtaskCompletion(checkpoint.id, "task-1", { result: "success" });

      const updated = getCheckpoint(checkpoint.id);
      expect(updated?.updatedAt).toBeGreaterThan(originalUpdatedAt);

      vi.useRealTimers();
    });

    it("does nothing for unknown checkpoint ID", () => {
      recordSubtaskCompletion("unknown-id", "task-1", { result: "success" });
      // Should not throw or error
      expect(getCheckpoint("unknown-id")).toBeNull();
    });

    it("handles completion with partial result data", () => {
      const checkpoint = createCheckpoint({
        workflowId: "wf-1",
        phase: "test",
        pendingSubtaskIds: ["task-1"],
      });

      recordSubtaskCompletion(checkpoint.id, "task-1", {});

      const updated = getCheckpoint(checkpoint.id);
      expect(updated?.completedSubtasks["task-1"]).toEqual({});
    });

    it("handles multiple completions", () => {
      const checkpoint = createCheckpoint({
        workflowId: "wf-1",
        phase: "test",
        pendingSubtaskIds: ["task-1", "task-2", "task-3"],
      });

      recordSubtaskCompletion(checkpoint.id, "task-1", { result: "a" });
      recordSubtaskCompletion(checkpoint.id, "task-2", { result: "b" });

      const updated = getCheckpoint(checkpoint.id);
      expect(updated?.completedSubtasks).toEqual({
        "task-1": { result: "a" },
        "task-2": { result: "b" },
      });
      expect(updated?.pendingSubtaskIds).toEqual(["task-3"]);
    });
  });

  describe("updateCheckpointContext", () => {
    it("merges new context with existing", () => {
      const checkpoint = createCheckpoint({
        workflowId: "wf-1",
        phase: "test",
        pendingSubtaskIds: [],
        sharedContext: { existing: "value" },
      });

      updateCheckpointContext(checkpoint.id, { new: "data" });

      const updated = getCheckpoint(checkpoint.id);
      expect(updated?.sharedContext).toEqual({
        existing: "value",
        new: "data",
      });
    });

    it("preserves existing keys", () => {
      const checkpoint = createCheckpoint({
        workflowId: "wf-1",
        phase: "test",
        pendingSubtaskIds: [],
        sharedContext: { key1: "value1", key2: "value2" },
      });

      updateCheckpointContext(checkpoint.id, { key3: "value3" });

      const updated = getCheckpoint(checkpoint.id);
      expect(updated?.sharedContext).toEqual({
        key1: "value1",
        key2: "value2",
        key3: "value3",
      });
    });

    it("overwrites existing keys with new values", () => {
      const checkpoint = createCheckpoint({
        workflowId: "wf-1",
        phase: "test",
        pendingSubtaskIds: [],
        sharedContext: { key: "old" },
      });

      updateCheckpointContext(checkpoint.id, { key: "new" });

      const updated = getCheckpoint(checkpoint.id);
      expect(updated?.sharedContext).toEqual({ key: "new" });
    });

    it("updates updatedAt timestamp", () => {
      const checkpoint = createCheckpoint({
        workflowId: "wf-1",
        phase: "test",
        pendingSubtaskIds: [],
      });

      const originalUpdatedAt = checkpoint.updatedAt;

      vi.useFakeTimers();
      vi.setSystemTime(Date.now() + 1000);

      updateCheckpointContext(checkpoint.id, { key: "value" });

      const updated = getCheckpoint(checkpoint.id);
      expect(updated?.updatedAt).toBeGreaterThan(originalUpdatedAt);

      vi.useRealTimers();
    });

    it("does nothing for unknown checkpoint ID", () => {
      updateCheckpointContext("unknown-id", { key: "value" });
      // Should not throw or error
      expect(getCheckpoint("unknown-id")).toBeNull();
    });

    it("handles empty context update", () => {
      const checkpoint = createCheckpoint({
        workflowId: "wf-1",
        phase: "test",
        pendingSubtaskIds: [],
        sharedContext: { existing: "value" },
      });

      updateCheckpointContext(checkpoint.id, {});

      const updated = getCheckpoint(checkpoint.id);
      expect(updated?.sharedContext).toEqual({ existing: "value" });
    });
  });

  describe("getCheckpoint", () => {
    it("returns checkpoint by ID", () => {
      const checkpoint = createCheckpoint({
        workflowId: "wf-1",
        phase: "test",
        pendingSubtaskIds: ["task-1"],
      });

      const retrieved = getCheckpoint(checkpoint.id);
      expect(retrieved).toEqual(checkpoint);
    });

    it("returns null for unknown ID", () => {
      const result = getCheckpoint("unknown-id");
      expect(result).toBeNull();
    });

    it("returns same instance for repeated calls", () => {
      const checkpoint = createCheckpoint({
        workflowId: "wf-1",
        phase: "test",
        pendingSubtaskIds: [],
      });

      const retrieved1 = getCheckpoint(checkpoint.id);
      const retrieved2 = getCheckpoint(checkpoint.id);

      expect(retrieved1).toBe(retrieved2);
    });
  });

  describe("listCheckpointsForWorkflow", () => {
    it("returns checkpoints for specific workflow", () => {
      const cp1 = createCheckpoint({
        workflowId: "wf-1",
        phase: "test",
        pendingSubtaskIds: [],
      });

      const cp2 = createCheckpoint({
        workflowId: "wf-1",
        phase: "test",
        pendingSubtaskIds: [],
      });

      const cp3 = createCheckpoint({
        workflowId: "wf-2",
        phase: "test",
        pendingSubtaskIds: [],
      });

      const checkpoints = listCheckpointsForWorkflow("wf-1");

      expect(checkpoints).toHaveLength(2);
      expect(checkpoints).toContainEqual(cp1);
      expect(checkpoints).toContainEqual(cp2);
      expect(checkpoints).not.toContainEqual(cp3);
    });

    it("sorts by updatedAt descending", () => {
      vi.useFakeTimers();

      const cp1 = createCheckpoint({
        workflowId: "wf-1",
        phase: "test",
        pendingSubtaskIds: [],
      });

      vi.setSystemTime(Date.now() + 1000);

      const cp2 = createCheckpoint({
        workflowId: "wf-1",
        phase: "test",
        pendingSubtaskIds: [],
      });

      vi.setSystemTime(Date.now() + 1000);

      const cp3 = createCheckpoint({
        workflowId: "wf-1",
        phase: "test",
        pendingSubtaskIds: [],
      });

      const checkpoints = listCheckpointsForWorkflow("wf-1");

      expect(checkpoints[0]).toEqual(cp3);
      expect(checkpoints[1]).toEqual(cp2);
      expect(checkpoints[2]).toEqual(cp1);

      vi.useRealTimers();
    });

    it("returns empty array for unknown workflow", () => {
      const checkpoints = listCheckpointsForWorkflow("unknown-workflow");
      expect(checkpoints).toEqual([]);
    });

    it("returns empty array when no checkpoints exist", () => {
      const checkpoints = listCheckpointsForWorkflow("wf-1");
      expect(checkpoints).toEqual([]);
    });
  });

  describe("listAllCheckpoints", () => {
    it("returns all checkpoints sorted by updatedAt descending", () => {
      vi.useFakeTimers();

      const cp1 = createCheckpoint({
        workflowId: "wf-1",
        phase: "test",
        pendingSubtaskIds: [],
      });

      vi.setSystemTime(Date.now() + 1000);

      const cp2 = createCheckpoint({
        workflowId: "wf-2",
        phase: "test",
        pendingSubtaskIds: [],
      });

      vi.setSystemTime(Date.now() + 1000);

      const cp3 = createCheckpoint({
        workflowId: "wf-1",
        phase: "test",
        pendingSubtaskIds: [],
      });

      const checkpoints = listAllCheckpoints();

      expect(checkpoints).toHaveLength(3);
      expect(checkpoints[0]).toEqual(cp3);
      expect(checkpoints[1]).toEqual(cp2);
      expect(checkpoints[2]).toEqual(cp1);

      vi.useRealTimers();
    });

    it("returns empty array when no checkpoints exist", () => {
      const checkpoints = listAllCheckpoints();
      expect(checkpoints).toEqual([]);
    });
  });

  describe("getLatestCheckpoint", () => {
    it("returns most recent checkpoint for workflow", () => {
      vi.useFakeTimers();

      createCheckpoint({
        workflowId: "wf-1",
        phase: "test",
        pendingSubtaskIds: [],
      });

      vi.setSystemTime(Date.now() + 1000);

      const cp2 = createCheckpoint({
        workflowId: "wf-1",
        phase: "test",
        pendingSubtaskIds: [],
      });

      const latest = getLatestCheckpoint("wf-1");
      expect(latest).toEqual(cp2);

      vi.useRealTimers();
    });

    it("returns null when no checkpoints exist", () => {
      const latest = getLatestCheckpoint("wf-1");
      expect(latest).toBeNull();
    });

    it("returns null for unknown workflow", () => {
      createCheckpoint({
        workflowId: "wf-1",
        phase: "test",
        pendingSubtaskIds: [],
      });

      const latest = getLatestCheckpoint("wf-2");
      expect(latest).toBeNull();
    });

    it("returns correct checkpoint among multiple workflows", () => {
      vi.useFakeTimers();

      createCheckpoint({
        workflowId: "wf-1",
        phase: "test",
        pendingSubtaskIds: [],
      });

      vi.setSystemTime(Date.now() + 1000);

      const cp2 = createCheckpoint({
        workflowId: "wf-2",
        phase: "test",
        pendingSubtaskIds: [],
      });

      vi.setSystemTime(Date.now() + 1000);

      createCheckpoint({
        workflowId: "wf-1",
        phase: "test",
        pendingSubtaskIds: [],
      });

      const latest = getLatestCheckpoint("wf-2");
      expect(latest).toEqual(cp2);

      vi.useRealTimers();
    });
  });

  describe("prepareResumePlan", () => {
    it("returns incomplete subtask IDs", () => {
      const checkpoint = createCheckpoint({
        workflowId: "wf-1",
        phase: "test",
        pendingSubtaskIds: ["task-1", "task-2", "task-3"],
      });

      recordSubtaskCompletion(checkpoint.id, "task-1", { result: "done" });

      const plan = prepareResumePlan(checkpoint.id);

      expect(plan?.incompleteSubtaskIds).toEqual(["task-2", "task-3"]);
    });

    it("returns completed results", () => {
      const checkpoint = createCheckpoint({
        workflowId: "wf-1",
        phase: "test",
        pendingSubtaskIds: ["task-1", "task-2"],
      });

      recordSubtaskCompletion(checkpoint.id, "task-1", {
        result: "success",
        model: "gpt-4",
        tokens: 100,
      });

      const plan = prepareResumePlan(checkpoint.id);

      expect(plan?.completedResults).toEqual({
        "task-1": {
          result: "success",
          model: "gpt-4",
          tokens: 100,
        },
      });
    });

    it("returns shared context", () => {
      const checkpoint = createCheckpoint({
        workflowId: "wf-1",
        phase: "test",
        pendingSubtaskIds: [],
        sharedContext: { key: "value", data: 123 },
      });

      const plan = prepareResumePlan(checkpoint.id);

      expect(plan?.sharedContext).toEqual({
        key: "value",
        data: 123,
      });
    });

    it("returns checkpoint object", () => {
      const checkpoint = createCheckpoint({
        workflowId: "wf-1",
        phase: "test",
        pendingSubtaskIds: ["task-1"],
      });

      const plan = prepareResumePlan(checkpoint.id);

      expect(plan?.checkpoint).toEqual(checkpoint);
    });

    it("returns null for unknown checkpoint", () => {
      const plan = prepareResumePlan("unknown-id");
      expect(plan).toBeNull();
    });

    it("returns copies of arrays and objects (not references)", () => {
      const checkpoint = createCheckpoint({
        workflowId: "wf-1",
        phase: "test",
        pendingSubtaskIds: ["task-1"],
        sharedContext: { key: "value" },
      });

      recordSubtaskCompletion(checkpoint.id, "task-2", { result: "done" });

      const plan = prepareResumePlan(checkpoint.id);

      // Modify returned data
      plan?.incompleteSubtaskIds.push("task-new");
      if (plan?.sharedContext) {
        plan.sharedContext.newKey = "newValue";
      }
      if (plan?.completedResults) {
        plan.completedResults["task-new"] = { result: "new" };
      }

      // Original checkpoint should be unchanged
      const original = getCheckpoint(checkpoint.id);
      expect(original?.pendingSubtaskIds).toEqual(["task-1"]);
      expect(original?.sharedContext).toEqual({ key: "value" });
      expect(original?.completedSubtasks).toEqual({
        "task-2": { result: "done" },
      });
    });

    it("handles checkpoint with all tasks completed", () => {
      const checkpoint = createCheckpoint({
        workflowId: "wf-1",
        phase: "test",
        pendingSubtaskIds: ["task-1"],
      });

      recordSubtaskCompletion(checkpoint.id, "task-1", { result: "done" });

      const plan = prepareResumePlan(checkpoint.id);

      expect(plan?.incompleteSubtaskIds).toEqual([]);
      expect(plan?.completedResults).toEqual({
        "task-1": { result: "done" },
      });
    });
  });

  describe("deleteCheckpoint", () => {
    it("removes checkpoint from memory", () => {
      const checkpoint = createCheckpoint({
        workflowId: "wf-1",
        phase: "test",
        pendingSubtaskIds: [],
      });

      deleteCheckpoint(checkpoint.id);

      const retrieved = getCheckpoint(checkpoint.id);
      expect(retrieved).toBeNull();
    });

    it("handles deletion of unknown checkpoint", () => {
      deleteCheckpoint("unknown-id");
      // Should not throw
      expect(getCheckpoint("unknown-id")).toBeNull();
    });

    it("removes checkpoint from workflow list", () => {
      const cp1 = createCheckpoint({
        workflowId: "wf-1",
        phase: "test",
        pendingSubtaskIds: [],
      });

      const cp2 = createCheckpoint({
        workflowId: "wf-1",
        phase: "test",
        pendingSubtaskIds: [],
      });

      deleteCheckpoint(cp1.id);

      const checkpoints = listCheckpointsForWorkflow("wf-1");
      expect(checkpoints).toHaveLength(1);
      expect(checkpoints[0]).toEqual(cp2);
    });
  });

  describe("resetCheckpointsForTests", () => {
    it("clears all state", () => {
      createCheckpoint({
        workflowId: "wf-1",
        phase: "test",
        pendingSubtaskIds: [],
      });

      createCheckpoint({
        workflowId: "wf-2",
        phase: "test",
        pendingSubtaskIds: [],
      });

      resetCheckpointsForTests();

      const checkpoints = listAllCheckpoints();
      expect(checkpoints).toEqual([]);
    });

    it("allows fresh checkpoint creation after reset", () => {
      const cp1 = createCheckpoint({
        workflowId: "wf-1",
        phase: "test",
        pendingSubtaskIds: [],
      });

      resetCheckpointsForTests();

      const cp2 = createCheckpoint({
        workflowId: "wf-1",
        phase: "test",
        pendingSubtaskIds: [],
      });

      expect(getCheckpoint(cp1.id)).toBeNull();
      expect(getCheckpoint(cp2.id)).toEqual(cp2);
    });
  });

  describe("restoreCheckpoints", () => {
    it("can be called multiple times safely", () => {
      restoreCheckpoints();
      restoreCheckpoints();
      restoreCheckpoints();

      // Should not throw or cause issues
      const checkpoints = listAllCheckpoints();
      expect(Array.isArray(checkpoints)).toBe(true);
    });

    it("does not duplicate checkpoints on repeated calls", () => {
      const cp = createCheckpoint({
        workflowId: "wf-1",
        phase: "test",
        pendingSubtaskIds: [],
      });

      restoreCheckpoints();
      restoreCheckpoints();

      const checkpoints = listAllCheckpoints();
      expect(checkpoints).toHaveLength(1);
      expect(checkpoints[0]).toEqual(cp);
    });
  });

  describe("edge cases", () => {
    it("handles checkpoint with zero pending subtasks", () => {
      const checkpoint = createCheckpoint({
        workflowId: "wf-1",
        phase: "test",
        pendingSubtaskIds: [],
      });

      expect(checkpoint.pendingSubtaskIds).toEqual([]);

      const plan = prepareResumePlan(checkpoint.id);
      expect(plan?.incompleteSubtaskIds).toEqual([]);
    });

    it("handles checkpoint with complex sharedContext", () => {
      const checkpoint = createCheckpoint({
        workflowId: "wf-1",
        phase: "test",
        pendingSubtaskIds: [],
        sharedContext: {
          nested: { object: { value: 123 } },
          array: [1, 2, 3],
          boolean: true,
          null: null,
          undefined: undefined,
        },
      });

      const plan = prepareResumePlan(checkpoint.id);
      expect(plan?.sharedContext).toEqual({
        nested: { object: { value: 123 } },
        array: [1, 2, 3],
        boolean: true,
        null: null,
        undefined: undefined,
      });
    });

    it("handles subtask completion that was not in pending list", () => {
      const checkpoint = createCheckpoint({
        workflowId: "wf-1",
        phase: "test",
        pendingSubtaskIds: ["task-1"],
      });

      // Complete a task that wasn't pending
      recordSubtaskCompletion(checkpoint.id, "task-unknown", {
        result: "done",
      });

      const updated = getCheckpoint(checkpoint.id);
      expect(updated?.completedSubtasks["task-unknown"]).toEqual({
        result: "done",
      });
      expect(updated?.pendingSubtaskIds).toEqual(["task-1"]); // Unchanged
    });

    it("handles concurrent updates to different fields", () => {
      const checkpoint = createCheckpoint({
        workflowId: "wf-1",
        phase: "test",
        pendingSubtaskIds: ["task-1", "task-2"],
        sharedContext: { initial: "value" },
      });

      recordSubtaskCompletion(checkpoint.id, "task-1", { result: "done" });
      updateCheckpointContext(checkpoint.id, { updated: "context" });

      const updated = getCheckpoint(checkpoint.id);
      expect(updated?.completedSubtasks["task-1"]).toEqual({ result: "done" });
      expect(updated?.pendingSubtaskIds).toEqual(["task-2"]);
      expect(updated?.sharedContext).toEqual({
        initial: "value",
        updated: "context",
      });
    });

    it("maintains checkpoint integrity across operations", () => {
      const checkpoint = createCheckpoint({
        workflowId: "wf-1",
        phase: "execution",
        pendingSubtaskIds: ["task-1", "task-2", "task-3"],
        sharedContext: { phase: "start" },
      });

      // Simulate workflow progression
      recordSubtaskCompletion(checkpoint.id, "task-1", {
        result: "Step 1 complete",
        model: "gpt-4",
        tokens: 50,
      });

      updateCheckpointContext(checkpoint.id, { phase: "mid" });

      recordSubtaskCompletion(checkpoint.id, "task-2", {
        result: "Step 2 complete",
        model: "gpt-3.5",
        tokens: 30,
      });

      updateCheckpointContext(checkpoint.id, { phase: "end" });

      const plan = prepareResumePlan(checkpoint.id);

      expect(plan?.incompleteSubtaskIds).toEqual(["task-3"]);
      expect(plan?.completedResults).toEqual({
        "task-1": {
          result: "Step 1 complete",
          model: "gpt-4",
          tokens: 50,
        },
        "task-2": {
          result: "Step 2 complete",
          model: "gpt-3.5",
          tokens: 30,
        },
      });
      expect(plan?.sharedContext).toEqual({ phase: "end" });
    });
  });
});
