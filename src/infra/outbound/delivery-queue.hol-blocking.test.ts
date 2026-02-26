import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { recoverPendingDeliveries, type DeliverFn } from "./delivery-queue.js";

const QUEUE_DIRNAME = "delivery-queue";

function makeEntry(id: string, retryCount: number, enqueuedAt: number): Record<string, unknown> {
  return {
    id,
    channel: "slack",
    to: "C123",
    accountId: "acct",
    payloads: [{ text: `test-${id}` }],
    retryCount,
    enqueuedAt,
    lastAttemptAt: enqueuedAt + 1000,
  };
}

describe("recoverPendingDeliveries — head-of-line blocking fix (#27638)", () => {
  let tmpDir: string;
  let queueDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "dq-hol-test-"));
    queueDir = path.join(tmpDir, QUEUE_DIRNAME);
    fs.mkdirSync(queueDir, { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  function writeEntry(entry: Record<string, unknown>) {
    const filePath = path.join(queueDir, `${String(entry.id)}.json`);
    fs.writeFileSync(filePath, JSON.stringify(entry));
  }

  it("skips high-backoff entries and still processes lower-retry entries", async () => {
    const now = Date.now();
    // Entry A: retryCount=3 → backoff=120s (exceeds 60s budget)
    // Entry B: retryCount=0 → backoff=5s (fits in budget)
    // Entry C: retryCount=0 → backoff=5s (fits in budget)
    writeEntry(makeEntry("entry-a", 3, now - 30_000)); // oldest, high retry
    writeEntry(makeEntry("entry-b", 0, now - 20_000)); // newer, low retry
    writeEntry(makeEntry("entry-c", 0, now - 10_000)); // newest, low retry

    const delivered: string[] = [];
    const deliverFn: DeliverFn = async (params) => {
      const text = (params.payloads as Array<{ text?: string }>)?.[0]?.text ?? "";
      delivered.push(text);
    };

    const log = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    };

    const result = await recoverPendingDeliveries({
      deliver: deliverFn,
      log,
      cfg: {} as never,
      stateDir: tmpDir,
      delay: async () => {}, // instant delays for test
      maxRecoveryMs: 60_000,
    });

    // Entry A should be skipped (backoff exceeds budget), B and C recovered
    expect(result.recovered).toBe(2);
    expect(result.skipped).toBe(1);
    expect(delivered).toContain("test-entry-b");
    expect(delivered).toContain("test-entry-c");
    expect(delivered).not.toContain("test-entry-a");

    // Verify the skip was logged
    const skipLogs = log.info.mock.calls.filter(
      (args) => typeof args[0] === "string" && args[0].includes("skipping to next entry"),
    );
    expect(skipLogs.length).toBe(1);
    expect(skipLogs[0][0]).toContain("entry-a");
  });
});
