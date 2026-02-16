import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  cancelRequestsForChild,
  createOrchestratorRequest,
  getOrchestratorRequest,
  initOrchestratorRegistry,
  listPendingRequestsForChild,
  listPendingRequestsForParent,
  orphanRequestsForParent,
  resetOrchestratorRegistryForTests,
  resolveOrchestratorRequest,
  startTimeoutSweeper,
  stopTimeoutSweeper,
  waitForResolution,
} from "./orchestrator-request-registry.js";

const { mockLoad, mockSave } = vi.hoisted(() => ({
  mockLoad: vi.fn(() => new Map()),
  mockSave: vi.fn(),
}));

vi.mock("./orchestrator-request-registry.store.js", () => ({
  loadOrchestratorRegistryFromDisk: mockLoad,
  saveOrchestratorRegistryToDisk: mockSave,
}));

describe("orchestrator-request-registry", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    resetOrchestratorRegistryForTests();
    mockLoad.mockClear();
    mockSave.mockClear();
    mockLoad.mockReturnValue(new Map());
  });

  afterEach(() => {
    stopTimeoutSweeper();
    resetOrchestratorRegistryForTests();
    vi.useRealTimers();
  });

  describe("Registry state transitions", () => {
    it("creates request with pending status", () => {
      const requestId = createOrchestratorRequest({
        childSessionKey: "child:1",
        parentSessionKey: "parent:1",
        message: "Need help with task",
        context: "Additional context",
      });

      expect(requestId).toMatch(/^req_/);

      const record = getOrchestratorRequest(requestId);
      expect(record).toBeDefined();
      expect(record?.status).toBe("pending");
      expect(record?.childSessionKey).toBe("child:1");
      expect(record?.parentSessionKey).toBe("parent:1");
      expect(record?.message).toBe("Need help with task");
      expect(record?.context).toBe("Additional context");
      expect(record?.priority).toBe("normal");
      expect(record?.createdAt).toBeGreaterThan(0);
      expect(record?.timeoutAt).toBeGreaterThan(record!.createdAt);
    });

    it("resolves request and wakes waiter", async () => {
      const requestId = createOrchestratorRequest({
        childSessionKey: "child:1",
        parentSessionKey: "parent:1",
        message: "Need help",
        timeoutMs: 60_000,
      });

      const waitPromise = waitForResolution(requestId, 60_000);

      // Resolve the request
      resolveOrchestratorRequest(requestId, "Here's the answer", "responder:1");

      const record = await waitPromise;
      expect(record.status).toBe("resolved");
      expect(record.response).toBe("Here's the answer");
      expect(record.resolvedBySessionKey).toBe("responder:1");
      expect(record.resolvedAt).toBeDefined();
    });

    it("times out request and wakes waiter with timeout error", async () => {
      const requestId = createOrchestratorRequest({
        childSessionKey: "child:1",
        parentSessionKey: "parent:1",
        message: "Need help",
        timeoutMs: 10_000,
      });

      const waitPromise = waitForResolution(requestId, 10_000);

      // Advance time past timeout
      await vi.advanceTimersByTimeAsync(15_000);

      const record = await waitPromise;
      expect(record.status).toBe("timeout");
      expect(record.error).toBeDefined();
    });

    it("cancels request for child and wakes waiter", async () => {
      const requestId = createOrchestratorRequest({
        childSessionKey: "child:1",
        parentSessionKey: "parent:1",
        message: "Need help",
      });

      const waitPromise = waitForResolution(requestId, 60_000);

      // Cancel all requests for the child
      cancelRequestsForChild("child:1");

      const record = await waitPromise;
      expect(record.status).toBe("cancelled");
    });

    it("orphans request for parent and wakes waiter", async () => {
      const requestId = createOrchestratorRequest({
        childSessionKey: "child:1",
        parentSessionKey: "parent:1",
        message: "Need help",
      });

      const waitPromise = waitForResolution(requestId, 60_000);

      // Orphan all requests for the parent
      orphanRequestsForParent("parent:1");

      const record = await waitPromise;
      expect(record.status).toBe("orphaned");
    });

    it("rejects resolve on already-resolved request", () => {
      const requestId = createOrchestratorRequest({
        childSessionKey: "child:1",
        parentSessionKey: "parent:1",
        message: "Need help",
      });

      // First resolve
      resolveOrchestratorRequest(requestId, "Answer 1", "responder:1");

      // Second resolve should throw
      expect(() => {
        resolveOrchestratorRequest(requestId, "Answer 2", "responder:2");
      }).toThrow();

      const record = getOrchestratorRequest(requestId);
      expect(record?.response).toBe("Answer 1");
    });

    it("rejects resolve on expired request", async () => {
      const requestId = createOrchestratorRequest({
        childSessionKey: "child:1",
        parentSessionKey: "parent:1",
        message: "Need help",
        timeoutMs: 10_000,
      });

      // Advance time past timeout
      await vi.advanceTimersByTimeAsync(15_000);

      // Should throw because request is already timed out
      expect(() => {
        resolveOrchestratorRequest(requestId, "Answer", "responder:1");
      }).toThrow();
    });

    it("rejects resolve on non-existent request", () => {
      expect(() => {
        resolveOrchestratorRequest("req_nonexistent", "Answer", "responder:1");
      }).toThrow();
    });
  });

  describe("Rate limiting and caps", () => {
    it("enforces max pending per child (3)", () => {
      // Create 3 requests for the same child - should succeed
      for (let i = 0; i < 3; i++) {
        const id = createOrchestratorRequest({
          childSessionKey: "child:1",
          parentSessionKey: "parent:1",
          message: `Request ${i}`,
        });
        expect(id).toMatch(/^req_/);
      }

      // 4th request should fail
      expect(() => {
        createOrchestratorRequest({
          childSessionKey: "child:1",
          parentSessionKey: "parent:1",
          message: "Request 4",
        });
      }).toThrow(/pending requests/i);
    });

    it("enforces max pending per parent (20)", () => {
      // Create 20 requests from different children but same parent
      for (let i = 0; i < 20; i++) {
        const id = createOrchestratorRequest({
          childSessionKey: `child:${i}`,
          parentSessionKey: "parent:1",
          message: `Request ${i}`,
        });
        expect(id).toMatch(/^req_/);
      }

      // 21st request should fail
      expect(() => {
        createOrchestratorRequest({
          childSessionKey: "child:21",
          parentSessionKey: "parent:1",
          message: "Request 21",
        });
      }).toThrow(/pending requests/i);
    });

    it("rate limits requests per child (5/min)", () => {
      const baseTime = Date.now();
      vi.setSystemTime(baseTime);

      // Create 5 requests, resolving after each to stay under the pending cap (3)
      // but still accumulating 5 rate-limit entries
      for (let i = 0; i < 5; i++) {
        const id = createOrchestratorRequest({
          childSessionKey: "child:1",
          parentSessionKey: "parent:1",
          message: `Request ${i}`,
        });
        expect(id).toMatch(/^req_/);
        // Resolve immediately to free up the pending slot
        resolveOrchestratorRequest(id, `Done ${i}`, "responder:1");
      }

      // 6th request within same minute should fail due to rate limit
      expect(() => {
        createOrchestratorRequest({
          childSessionKey: "child:1",
          parentSessionKey: "parent:1",
          message: "Request 6",
        });
      }).toThrow(/rate limit/i);

      // Advance time past 60 seconds - should succeed
      vi.setSystemTime(baseTime + 61_000);
      const id = createOrchestratorRequest({
        childSessionKey: "child:1",
        parentSessionKey: "parent:1",
        message: "Request after rate limit",
      });
      expect(id).toMatch(/^req_/);
    });
  });

  describe("Lifecycle", () => {
    it("sweeper detects and times out expired requests", async () => {
      startTimeoutSweeper();

      const requestId = createOrchestratorRequest({
        childSessionKey: "child:1",
        parentSessionKey: "parent:1",
        message: "Need help",
        timeoutMs: 10_000,
      });

      // Start waiting
      const waitPromise = waitForResolution(requestId, 15_000);

      // Advance time past timeout + sweeper interval
      await vi.advanceTimersByTimeAsync(20_000);

      const record = await waitPromise;
      expect(record.status).toBe("timeout");
    });

    it("terminal records cleaned up after TTL", async () => {
      const baseTime = Date.now();
      vi.setSystemTime(baseTime);

      const requestId = createOrchestratorRequest({
        childSessionKey: "child:1",
        parentSessionKey: "parent:1",
        message: "Need help",
      });

      resolveOrchestratorRequest(requestId, "Done", "responder:1");

      // Record should exist
      expect(getOrchestratorRequest(requestId)).toBeDefined();

      // Advance past TTL (24 hours)
      const ttlMs = 24 * 60 * 60 * 1000;
      vi.setSystemTime(baseTime + ttlMs + 1000);

      // Trigger cleanup by creating a new request
      const newId = createOrchestratorRequest({
        childSessionKey: "child:2",
        parentSessionKey: "parent:2",
        message: "New request",
      });

      // Old record should be cleaned up
      expect(getOrchestratorRequest(requestId)).toBeUndefined();
      expect(getOrchestratorRequest(newId)).toBeDefined();
    });

    it("waitForResolution respects abortSignal", async () => {
      const requestId = createOrchestratorRequest({
        childSessionKey: "child:1",
        parentSessionKey: "parent:1",
        message: "Need help",
      });

      const controller = new AbortController();
      const waitPromise = waitForResolution(requestId, 60_000, controller.signal);

      // Abort the wait
      controller.abort();

      await expect(waitPromise).rejects.toThrow(/abort/i);
    });
  });

  describe("Query functions", () => {
    it("listPendingRequestsForParent returns only pending for that parent", () => {
      createOrchestratorRequest({
        childSessionKey: "child:1",
        parentSessionKey: "parent:1",
        message: "Request 1",
      });
      createOrchestratorRequest({
        childSessionKey: "child:2",
        parentSessionKey: "parent:1",
        message: "Request 2",
      });
      createOrchestratorRequest({
        childSessionKey: "child:3",
        parentSessionKey: "parent:2",
        message: "Request 3",
      });

      const pending = listPendingRequestsForParent("parent:1");
      expect(pending).toHaveLength(2);
      expect(pending.map((r) => r.parentSessionKey)).toEqual(["parent:1", "parent:1"]);
    });

    it("listPendingRequestsForChild returns only pending for that child", () => {
      createOrchestratorRequest({
        childSessionKey: "child:1",
        parentSessionKey: "parent:1",
        message: "Request 1",
      });
      createOrchestratorRequest({
        childSessionKey: "child:1",
        parentSessionKey: "parent:2",
        message: "Request 2",
      });
      createOrchestratorRequest({
        childSessionKey: "child:2",
        parentSessionKey: "parent:1",
        message: "Request 3",
      });

      const pending = listPendingRequestsForChild("child:1");
      expect(pending).toHaveLength(2);
      expect(pending.map((r) => r.childSessionKey)).toEqual(["child:1", "child:1"]);
    });

    it("listPendingRequestsForParent excludes non-pending requests", () => {
      const req1 = createOrchestratorRequest({
        childSessionKey: "child:1",
        parentSessionKey: "parent:1",
        message: "Request 1",
      });
      createOrchestratorRequest({
        childSessionKey: "child:2",
        parentSessionKey: "parent:1",
        message: "Request 2",
      });

      // Resolve one
      resolveOrchestratorRequest(req1, "Done", "responder:1");

      const pending = listPendingRequestsForParent("parent:1");
      expect(pending).toHaveLength(1);
      expect(pending[0]?.message).toBe("Request 2");
    });
  });

  describe("Initialization", () => {
    it("loads persisted requests on init", () => {
      const persisted = new Map([
        [
          "req_persisted",
          {
            requestId: "req_persisted",
            childSessionKey: "child:1",
            parentSessionKey: "parent:1",
            message: "Persisted request",
            priority: "normal" as const,
            status: "pending" as const,
            createdAt: Date.now() - 1000,
            timeoutAt: Date.now() + 300_000,
          },
        ],
      ]);

      mockLoad.mockReturnValue(persisted);

      initOrchestratorRegistry();

      const record = getOrchestratorRequest("req_persisted");
      expect(record).toBeDefined();
      expect(record?.message).toBe("Persisted request");
    });
  });
});
