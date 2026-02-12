import { describe, it, expect, beforeEach } from "vitest";

const FEISHU_DEDUP_GLOBAL_KEY = "__openclaw_feishu_dedup__";

function clearGlobalDedupState() {
  delete (globalThis as Record<string, unknown>)[FEISHU_DEDUP_GLOBAL_KEY];
}

/**
 * Inline copy of the dedup logic from bot.ts so we can test the
 * globalThis survival behaviour without importing the full module
 * (which pulls in heavy dependencies like the Lark SDK).
 */
const DEDUP_TTL_MS = 30 * 60 * 1000;
const DEDUP_MAX_SIZE = 1_000;
const DEDUP_CLEANUP_INTERVAL_MS = 5 * 60 * 1000;

type FeishuDedupState = {
  processedMessageIds: Map<string, number>;
  lastCleanupTime: number;
};

function getFeishuDedupState(): FeishuDedupState {
  const g = globalThis as Record<string, unknown>;
  let state = g[FEISHU_DEDUP_GLOBAL_KEY] as FeishuDedupState | undefined;
  if (!state) {
    state = { processedMessageIds: new Map(), lastCleanupTime: Date.now() };
    g[FEISHU_DEDUP_GLOBAL_KEY] = state;
  }
  return state;
}

function tryRecordMessage(messageId: string, now = Date.now()): boolean {
  const state = getFeishuDedupState();
  if (now - state.lastCleanupTime > DEDUP_CLEANUP_INTERVAL_MS) {
    for (const [id, ts] of state.processedMessageIds) {
      if (now - ts > DEDUP_TTL_MS) state.processedMessageIds.delete(id);
    }
    state.lastCleanupTime = now;
  }
  if (state.processedMessageIds.has(messageId)) return false;
  if (state.processedMessageIds.size >= DEDUP_MAX_SIZE) {
    const first = state.processedMessageIds.keys().next().value!;
    state.processedMessageIds.delete(first);
  }
  state.processedMessageIds.set(messageId, now);
  return true;
}

describe("Feishu dedup cache survives restart (globalThis)", () => {
  beforeEach(() => {
    clearGlobalDedupState();
  });

  it("records a new message and rejects duplicates", () => {
    expect(tryRecordMessage("msg_aaa", 1000)).toBe(true);
    expect(tryRecordMessage("msg_aaa", 1500)).toBe(false);
  });

  it("state survives simulated module re-evaluation", () => {
    // First "module load": record a message
    const state1 = getFeishuDedupState();
    state1.processedMessageIds.set("msg_bbb", Date.now());

    // Simulate SIGUSR1 restart: the module is re-evaluated by jiti,
    // but globalThis still holds the state.
    const state2 = getFeishuDedupState();
    expect(state2).toBe(state1);
    expect(state2.processedMessageIds.has("msg_bbb")).toBe(true);

    // tryRecordMessage should detect the duplicate
    expect(tryRecordMessage("msg_bbb")).toBe(false);
  });

  it("cleaning stale entries does not remove recent ones", () => {
    const now = Date.now();
    tryRecordMessage("old_msg", now - DEDUP_TTL_MS - 1);
    tryRecordMessage("new_msg", now - 1000);

    // Force cleanup by advancing lastCleanupTime past interval
    const state = getFeishuDedupState();
    state.lastCleanupTime = now - DEDUP_CLEANUP_INTERVAL_MS - 1;

    // The next tryRecordMessage triggers cleanup
    tryRecordMessage("trigger_cleanup", now);

    expect(state.processedMessageIds.has("old_msg")).toBe(false);
    expect(state.processedMessageIds.has("new_msg")).toBe(true);
  });
});
