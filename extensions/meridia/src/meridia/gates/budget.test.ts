import { describe, expect, it } from "vitest";
import {
  checkGates,
  ensureBuffer,
  pruneOldEntries,
  recordCapture,
  recordEvaluation,
  type SessionBuffer,
  type GatesConfig,
} from "./budget.js";

const DEFAULT_CONFIG: GatesConfig = {
  maxCapturesPerHour: 10,
  minIntervalMs: 5 * 60 * 1000, // 5 min
};

function makeBuffer(overrides: Partial<SessionBuffer> = {}): SessionBuffer {
  return ensureBuffer({
    sessionId: "test-session",
    sessionKey: "test-key",
    ...overrides,
  });
}

describe("gates/budget", () => {
  // ── ensureBuffer ──────────────────────────────────────────────────────
  describe("ensureBuffer", () => {
    it("creates a fresh buffer with defaults", () => {
      const buf = ensureBuffer({ sessionId: "s1", sessionKey: "k1" });
      expect(buf.sessionId).toBe("s1");
      expect(buf.sessionKey).toBe("k1");
      expect(buf.captured).toBe(0);
      expect(buf.toolResultsSeen).toBe(0);
      expect(buf.recentCaptures).toEqual([]);
      expect(buf.recentEvaluations).toEqual([]);
    });

    it("preserves existing fields", () => {
      const existing = makeBuffer({ captured: 5, toolResultsSeen: 20 });
      const buf = ensureBuffer(existing);
      expect(buf.captured).toBe(5);
      expect(buf.toolResultsSeen).toBe(20);
    });

    it("sets version to 1", () => {
      const buf = ensureBuffer({});
      expect(buf.version).toBe(1);
    });

    it("sets createdAt and updatedAt", () => {
      const buf = ensureBuffer({});
      expect(buf.createdAt).toBeTruthy();
      expect(buf.updatedAt).toBeTruthy();
    });

    it("preserves provided createdAt", () => {
      const ts = "2025-01-01T00:00:00.000Z";
      const buf = ensureBuffer({ createdAt: ts });
      expect(buf.createdAt).toBe(ts);
    });
  });

  // ── checkGates ────────────────────────────────────────────────────────
  describe("checkGates", () => {
    it("allows when under rate limit and interval", () => {
      const buf = makeBuffer();
      const result = checkGates(buf, DEFAULT_CONFIG);
      expect(result.allowed).toBe(true);
      expect(result.reason).toBeUndefined();
    });

    it("blocks when max captures per hour reached", () => {
      const now = new Date().toISOString();
      const recentCaptures = Array.from({ length: 10 }, (_, i) => ({
        ts: now,
        toolName: `tool-${i}`,
        score: 0.8,
        recordId: `r${i}`,
      }));
      const buf = makeBuffer({ recentCaptures });
      const result = checkGates(buf, DEFAULT_CONFIG);
      expect(result.allowed).toBe(false);
      expect(result.reason).toBe("max_per_hour");
    });

    it("blocks when last capture was too recent", () => {
      const now = new Date().toISOString();
      const buf = makeBuffer({ lastCapturedAt: now });
      const result = checkGates(buf, DEFAULT_CONFIG);
      expect(result.allowed).toBe(false);
      expect(result.reason).toBe("min_interval");
    });

    it("allows when last capture is old enough", () => {
      const oldTime = new Date(Date.now() - 10 * 60 * 1000).toISOString(); // 10 min ago
      const buf = makeBuffer({
        lastCapturedAt: oldTime,
        recentCaptures: [{ ts: oldTime, toolName: "bash", score: 0.8, recordId: "r1" }],
      });
      const result = checkGates(buf, DEFAULT_CONFIG);
      expect(result.allowed).toBe(true);
    });

    it("allows with minIntervalMs=0 (no interval)", () => {
      const now = new Date().toISOString();
      const buf = makeBuffer({ lastCapturedAt: now });
      const result = checkGates(buf, { ...DEFAULT_CONFIG, minIntervalMs: 0 });
      expect(result.allowed).toBe(true);
    });

    it("provides detail string for max_per_hour", () => {
      const now = new Date().toISOString();
      const recentCaptures = Array.from({ length: 10 }, (_, i) => ({
        ts: now,
        toolName: `tool-${i}`,
        score: 0.8,
        recordId: `r${i}`,
      }));
      const buf = makeBuffer({ recentCaptures });
      const result = checkGates(buf, DEFAULT_CONFIG);
      expect(result.detail).toBe("10/10");
    });

    it("checks interval before rate limit", () => {
      const now = new Date().toISOString();
      const recentCaptures = Array.from({ length: 10 }, (_, i) => ({
        ts: now,
        toolName: `tool-${i}`,
        score: 0.8,
        recordId: `r${i}`,
      }));
      const buf = makeBuffer({ lastCapturedAt: now, recentCaptures });
      const result = checkGates(buf, DEFAULT_CONFIG);
      // min_interval is checked first
      expect(result.reason).toBe("min_interval");
    });
  });

  // ── pruneOldEntries ───────────────────────────────────────────────────
  describe("pruneOldEntries", () => {
    it("prunes captures older than 1 hour", () => {
      const oldTime = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
      const newTime = new Date().toISOString();
      const buf = makeBuffer({
        recentCaptures: [
          { ts: oldTime, toolName: "old", score: 0.5, recordId: "r-old" },
          { ts: newTime, toolName: "new", score: 0.9, recordId: "r-new" },
        ],
        recentEvaluations: [
          { ts: oldTime, toolName: "old", score: 0.3, recommendation: "skip" as const },
          { ts: newTime, toolName: "new", score: 0.8, recommendation: "capture" as const },
        ],
      });

      const pruned = pruneOldEntries(buf, Date.now());
      expect(pruned.recentCaptures.length).toBe(1);
      expect(pruned.recentCaptures[0]?.toolName).toBe("new");
      // pruneOldEntries slices evaluations to last 50, doesn't filter by time
      expect(pruned.recentEvaluations.length).toBe(2);
    });

    it("keeps all entries when none are old", () => {
      const newTime = new Date().toISOString();
      const buf = makeBuffer({
        recentCaptures: [
          { ts: newTime, toolName: "a", score: 0.5, recordId: "r-a" },
          { ts: newTime, toolName: "b", score: 0.6, recordId: "r-b" },
        ],
      });

      const pruned = pruneOldEntries(buf, Date.now());
      expect(pruned.recentCaptures.length).toBe(2);
    });

    it("limits evaluations to last 50", () => {
      const now = new Date().toISOString();
      const recentEvaluations = Array.from({ length: 60 }, (_, i) => ({
        ts: now,
        toolName: `tool-${i}`,
        score: 0.5,
        recommendation: "skip" as const,
      }));
      const buf = makeBuffer({ recentEvaluations });
      const pruned = pruneOldEntries(buf, Date.now());
      expect(pruned.recentEvaluations.length).toBe(50);
    });
  });

  // ── recordCapture ─────────────────────────────────────────────────────
  describe("recordCapture", () => {
    it("adds a capture entry and increments counter", () => {
      const buf = makeBuffer();
      const updated = recordCapture(buf, { toolName: "bash", score: 0.9, recordId: "r1" });
      expect(updated.captured).toBe(1);
      expect(updated.recentCaptures.length).toBe(1);
      expect(updated.recentCaptures[0]?.toolName).toBe("bash");
      expect(updated.recentCaptures[0]?.score).toBe(0.9);
      expect(updated.recentCaptures[0]?.recordId).toBe("r1");
    });

    it("updates lastCapturedAt", () => {
      const buf = makeBuffer();
      const updated = recordCapture(buf, { toolName: "bash", score: 0.9, recordId: "r1" });
      expect(updated.lastCapturedAt).toBeTruthy();
    });

    it("increments captured count from existing value", () => {
      const buf = makeBuffer({ captured: 3 });
      const updated = recordCapture(buf, { toolName: "bash", score: 0.9, recordId: "r1" });
      expect(updated.captured).toBe(4);
    });

    it("prunes old entries on capture", () => {
      const oldTime = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
      const buf = makeBuffer({
        recentCaptures: [{ ts: oldTime, toolName: "old", score: 0.5, recordId: "r-old" }],
      });
      const updated = recordCapture(buf, { toolName: "bash", score: 0.9, recordId: "r1" });
      // Old entry should be pruned, only new one remains
      expect(updated.recentCaptures.length).toBe(1);
      expect(updated.recentCaptures[0]?.toolName).toBe("bash");
    });
  });

  // ── recordEvaluation ──────────────────────────────────────────────────
  describe("recordEvaluation", () => {
    it("adds an evaluation entry", () => {
      const buf = makeBuffer();
      const updated = recordEvaluation(buf, {
        toolName: "bash",
        score: 0.5,
        recommendation: "skip",
        reason: "too boring",
      });
      expect(updated.recentEvaluations.length).toBe(1);
      expect(updated.recentEvaluations[0]?.recommendation).toBe("skip");
      expect(updated.recentEvaluations[0]?.reason).toBe("too boring");
    });

    it("limits evals to 50 entries", () => {
      let buf = makeBuffer();
      for (let i = 0; i < 55; i++) {
        buf = recordEvaluation(buf, {
          toolName: `tool-${i}`,
          score: 0.5,
          recommendation: "skip",
        });
      }
      expect(buf.recentEvaluations.length).toBeLessThanOrEqual(50);
    });

    it("updates updatedAt", () => {
      const buf = makeBuffer();
      const before = buf.updatedAt;
      // Small delay to ensure different timestamp
      const updated = recordEvaluation(buf, {
        toolName: "bash",
        score: 0.5,
        recommendation: "capture",
      });
      expect(updated.updatedAt).toBeTruthy();
    });

    it("preserves reason field", () => {
      const buf = makeBuffer();
      const updated = recordEvaluation(buf, {
        toolName: "bash",
        score: 0.8,
        recommendation: "capture",
        reason: "high significance event",
      });
      expect(updated.recentEvaluations[0]?.reason).toBe("high significance event");
    });
  });
});
