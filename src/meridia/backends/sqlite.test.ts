/**
 * Tests for the SqliteBackend implementation of MeridiaDbBackend.
 *
 * Validates that the backend interface works correctly with the SQLite
 * implementation and produces the same results as the legacy functions.
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import type { MeridiaDbBackend } from "../backend.js";
import type { MeridiaExperienceRecord, MeridiaTraceEvent } from "../types.js";
import { SqliteBackend } from "./sqlite.js";

// ─── Test helpers ────────────────────────────────────────────────────

let tmpDir: string;
let backend: MeridiaDbBackend;

function makeRecord(overrides?: Partial<MeridiaExperienceRecord>): MeridiaExperienceRecord {
  const id = `rec-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  return {
    id,
    ts: new Date().toISOString(),
    sessionKey: "test-session",
    sessionId: "sid-123",
    runId: "run-456",
    tool: {
      name: "test-tool",
      callId: `call-${id}`,
      isError: false,
    },
    data: {
      args: { query: "hello" },
      result: { answer: "world" },
    },
    evaluation: {
      kind: "heuristic",
      score: 0.8,
      recommendation: "capture",
      reason: "High-quality test interaction",
    },
    ...overrides,
  };
}

function makeTrace(
  overrides?: Partial<Extract<MeridiaTraceEvent, { type: "tool_result" }>>,
): MeridiaTraceEvent {
  return {
    type: "tool_result",
    ts: new Date().toISOString(),
    sessionKey: "test-session",
    toolName: "test-tool",
    toolCallId: `call-${Date.now()}`,
    isError: false,
    decision: "capture",
    score: 0.8,
    ...overrides,
  };
}

// ─── Setup / teardown ────────────────────────────────────────────────

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "meridia-backend-test-"));
  const dbPath = path.join(tmpDir, "test.sqlite");
  backend = new SqliteBackend(dbPath);
});

afterEach(() => {
  backend.close();
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

// ─── Tests ───────────────────────────────────────────────────────────

describe("SqliteBackend", () => {
  describe("lifecycle", () => {
    it("creates database and schema", () => {
      const stats = backend.getStats();
      expect(stats.recordCount).toBe(0);
      expect(stats.traceCount).toBe(0);
      expect(stats.sessionCount).toBe(0);
      expect(stats.schemaVersion).toBe("1");
    });

    it("ensureSchema is idempotent", () => {
      const result1 = backend.ensureSchema();
      const result2 = backend.ensureSchema();
      expect(result1.ftsAvailable).toBe(result2.ftsAvailable);
    });
  });

  describe("insertRecord / getRecordById", () => {
    it("inserts and retrieves a record", () => {
      const record = makeRecord();
      const inserted = backend.insertRecord(record);
      expect(inserted).toBe(true);

      const result = backend.getRecordById(record.id);
      expect(result).not.toBeNull();
      expect(result!.record.id).toBe(record.id);
      expect(result!.record.tool.name).toBe("test-tool");
    });

    it("deduplicates by id", () => {
      const record = makeRecord();
      expect(backend.insertRecord(record)).toBe(true);
      expect(backend.insertRecord(record)).toBe(false);
    });

    it("returns null for non-existent record", () => {
      expect(backend.getRecordById("does-not-exist")).toBeNull();
    });
  });

  describe("insertRecordsBatch", () => {
    it("inserts multiple records in a batch", () => {
      const records = [makeRecord(), makeRecord(), makeRecord()];
      const count = backend.insertRecordsBatch(records);
      expect(count).toBe(3);
      expect(backend.getStats().recordCount).toBe(3);
    });

    it("skips duplicates in batch", () => {
      const record = makeRecord();
      backend.insertRecord(record);
      const records = [record, makeRecord()];
      const count = backend.insertRecordsBatch(records);
      expect(count).toBe(1);
    });
  });

  describe("trace events", () => {
    it("inserts and retrieves trace events", () => {
      const event = makeTrace();
      backend.insertTraceEvent(event);

      const stats = backend.getStats();
      expect(stats.traceCount).toBe(1);

      const events = backend.getTraceEvents({ sessionKey: "test-session" });
      expect(events.length).toBe(1);
    });

    it("batch inserts trace events", () => {
      const events = [makeTrace(), makeTrace(), makeTrace()];
      const count = backend.insertTraceEventsBatch(events);
      expect(count).toBe(3);
      expect(backend.getStats().traceCount).toBe(3);
    });
  });

  describe("session operations", () => {
    it("upserts and retrieves session summary", () => {
      backend.upsertSession({
        sessionKey: "sess-1",
        startedAt: "2025-01-15T10:00:00Z",
        toolsUsed: ["web_search", "read"],
        topics: ["coding"],
        summary: "A productive session",
      });

      const summary = backend.getSessionSummary("sess-1");
      expect(summary).not.toBeNull();
      expect(summary!.sessionKey).toBe("sess-1");
      expect(summary!.toolsUsed).toEqual(["web_search", "read"]);
      expect(summary!.summary).toBe("A productive session");
    });

    it("merges on upsert", () => {
      backend.upsertSession({
        sessionKey: "sess-1",
        startedAt: "2025-01-15T10:00:00Z",
      });
      backend.upsertSession({
        sessionKey: "sess-1",
        endedAt: "2025-01-15T11:00:00Z",
        summary: "Done",
      });

      const summary = backend.getSessionSummary("sess-1");
      expect(summary!.startedAt).toBe("2025-01-15T10:00:00Z");
      expect(summary!.endedAt).toBe("2025-01-15T11:00:00Z");
      expect(summary!.summary).toBe("Done");
    });

    it("builds session summary from records if no session row exists", () => {
      const record = makeRecord({ sessionKey: "sess-orphan" });
      backend.insertRecord(record);

      const summary = backend.getSessionSummary("sess-orphan");
      expect(summary).not.toBeNull();
      expect(summary!.recordCount).toBe(1);
      expect(summary!.toolsUsed).toContain("test-tool");
    });

    it("returns null for non-existent session", () => {
      expect(backend.getSessionSummary("does-not-exist")).toBeNull();
    });
  });

  describe("query operations", () => {
    beforeEach(() => {
      const records = [
        makeRecord({
          id: "r1",
          ts: "2025-01-15T10:00:00Z",
          sessionKey: "sess-a",
          tool: { name: "web_search", callId: "c1", isError: false },
          evaluation: {
            kind: "heuristic",
            score: 0.9,
            recommendation: "capture",
            reason: "Great search",
          },
        }),
        makeRecord({
          id: "r2",
          ts: "2025-01-15T11:00:00Z",
          sessionKey: "sess-a",
          tool: { name: "read", callId: "c2", isError: true },
          evaluation: {
            kind: "llm",
            score: 0.3,
            recommendation: "skip",
            reason: "Error reading file",
          },
        }),
        makeRecord({
          id: "r3",
          ts: "2025-01-16T08:00:00Z",
          sessionKey: "sess-b",
          tool: { name: "web_search", callId: "c3", isError: false },
          evaluation: {
            kind: "heuristic",
            score: 0.7,
            recommendation: "capture",
            reason: "Useful search result",
          },
        }),
      ];
      backend.insertRecordsBatch(records);
    });

    it("getRecordsByDateRange returns records in range", () => {
      const results = backend.getRecordsByDateRange("2025-01-15T00:00:00Z", "2025-01-15T23:59:59Z");
      expect(results.length).toBe(2);
    });

    it("getRecordsBySession returns session records", () => {
      const results = backend.getRecordsBySession("sess-a");
      expect(results.length).toBe(2);
    });

    it("getRecentRecords returns most recent", () => {
      const results = backend.getRecentRecords(2);
      expect(results.length).toBe(2);
      // Most recent first
      expect(results[0].record.id).toBe("r3");
    });

    it("getRecordsByTool filters by tool", () => {
      const results = backend.getRecordsByTool("web_search");
      expect(results.length).toBe(2);
    });

    it("searchRecords finds matching records", () => {
      const results = backend.searchRecords("search");
      expect(results.length).toBeGreaterThan(0);
    });

    it("filters by minScore", () => {
      const results = backend.getRecentRecords(10, { minScore: 0.5 });
      expect(results.length).toBe(2);
      for (const r of results) {
        expect(r.record.evaluation.score).toBeGreaterThanOrEqual(0.5);
      }
    });

    it("filters by isError", () => {
      const results = backend.getRecentRecords(10, { isError: true });
      expect(results.length).toBe(1);
      expect(results[0].record.tool.isError).toBe(true);
    });
  });

  describe("aggregate operations", () => {
    beforeEach(() => {
      backend.insertRecordsBatch([
        makeRecord({ tool: { name: "web_search", callId: "c1", isError: false } }),
        makeRecord({ tool: { name: "web_search", callId: "c2", isError: false } }),
        makeRecord({ tool: { name: "read", callId: "c3", isError: true } }),
      ]);
    });

    it("getToolStats returns aggregate stats", () => {
      const stats = backend.getToolStats();
      expect(stats.length).toBe(2);

      const searchStats = stats.find((s) => s.toolName === "web_search");
      expect(searchStats).toBeDefined();
      expect(searchStats!.count).toBe(2);
      expect(searchStats!.errorCount).toBe(0);

      const readStats = stats.find((s) => s.toolName === "read");
      expect(readStats).toBeDefined();
      expect(readStats!.count).toBe(1);
      expect(readStats!.errorCount).toBe(1);
    });

    it("getStats returns database stats", () => {
      const stats = backend.getStats();
      expect(stats.recordCount).toBe(3);
      expect(stats.schemaVersion).toBe("1");
    });
  });

  describe("metadata operations", () => {
    it("get/set meta", () => {
      expect(backend.getMeta("test_key")).toBeNull();
      backend.setMeta("test_key", "test_value");
      expect(backend.getMeta("test_key")).toBe("test_value");
    });

    it("overwrites existing meta", () => {
      backend.setMeta("key", "v1");
      backend.setMeta("key", "v2");
      expect(backend.getMeta("key")).toBe("v2");
    });
  });

  describe("listSessions", () => {
    it("lists sessions from records", () => {
      backend.insertRecordsBatch([
        makeRecord({ sessionKey: "sess-1" }),
        makeRecord({ sessionKey: "sess-1" }),
        makeRecord({ sessionKey: "sess-2" }),
      ]);

      const sessions = backend.listSessions();
      expect(sessions.length).toBe(2);

      const sess1 = sessions.find((s) => s.sessionKey === "sess-1");
      expect(sess1).toBeDefined();
      expect(sess1!.recordCount).toBe(2);
    });
  });
});
