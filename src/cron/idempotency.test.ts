import { describe, it, expect } from "vitest";
import { generateScheduleKey, generateChainKey, generateRunNowKey } from "./idempotency.js";

describe("generateScheduleKey", () => {
  it("is deterministic: same inputs produce same key", () => {
    const key1 = generateScheduleKey("job-123", 1700000000000);
    const key2 = generateScheduleKey("job-123", 1700000000000);
    expect(key1).toBe(key2);
  });

  it("different times produce different keys", () => {
    const key1 = generateScheduleKey("job-123", 1700000000000);
    const key2 = generateScheduleKey("job-123", 1700000001000);
    expect(key1).not.toBe(key2);
  });

  it("different job ids produce different keys", () => {
    const key1 = generateScheduleKey("job-a", 1700000000000);
    const key2 = generateScheduleKey("job-b", 1700000000000);
    expect(key1).not.toBe(key2);
  });

  it("key length is 32 hex chars", () => {
    const key = generateScheduleKey("job-123", 1700000000000);
    expect(key).toHaveLength(32);
    expect(key).toMatch(/^[0-9a-f]{32}$/);
  });
});

describe("generateChainKey", () => {
  it("is deterministic: same inputs produce same key", () => {
    const key1 = generateChainKey("parent-run-1", "child-job-1");
    const key2 = generateChainKey("parent-run-1", "child-job-1");
    expect(key1).toBe(key2);
  });

  it("different parent runs produce different keys", () => {
    const key1 = generateChainKey("parent-run-1", "child-job-1");
    const key2 = generateChainKey("parent-run-2", "child-job-1");
    expect(key1).not.toBe(key2);
  });

  it("key length is 32 hex chars", () => {
    const key = generateChainKey("parent-run-1", "child-job-1");
    expect(key).toHaveLength(32);
    expect(key).toMatch(/^[0-9a-f]{32}$/);
  });

  it("chain keys differ from schedule keys", () => {
    const schedKey = generateScheduleKey("job-1", 1700000000000);
    const chainKey = generateChainKey("job-1", "1700000000000");
    expect(schedKey).not.toBe(chainKey);
  });
});

describe("generateRunNowKey", () => {
  it("produces unique keys each call", () => {
    const key1 = generateRunNowKey("job-123");
    const key2 = generateRunNowKey("job-123");
    expect(key1).not.toBe(key2);
  });

  it("key length is 32 hex chars", () => {
    const key = generateRunNowKey("job-123");
    expect(key).toHaveLength(32);
    expect(key).toMatch(/^[0-9a-f]{32}$/);
  });

  it("different job ids produce different keys", () => {
    // While they're random, different inputs should be different
    // (extremely unlikely collision with UUID-based nonce)
    const keys = new Set<string>();
    for (let i = 0; i < 10; i++) {
      keys.add(generateRunNowKey(`job-${i}`));
    }
    expect(keys.size).toBe(10);
  });
});
