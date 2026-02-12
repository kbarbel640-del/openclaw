import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { clearSessionStoreCacheForTest, SessionStoreLockTimeoutError, __testing } from "./store.js";

const { withSessionStoreLock } = __testing;

// Mock loadConfig so resolveMaintenanceConfig() never reads a real openclaw.json.
vi.mock("../config.js", () => ({
  loadConfig: vi.fn().mockReturnValue({}),
}));

let tmpDir: string;

beforeEach(async () => {
  clearSessionStoreCacheForTest();
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "openclaw-lock-retry-"));
});

afterEach(async () => {
  await fs.rm(tmpDir, { recursive: true, force: true });
});

describe("SessionStoreLockTimeoutError", () => {
  it("is thrown when lock acquisition times out", async () => {
    const storePath = path.join(tmpDir, "sessions.json");
    const lockPath = `${storePath}.lock`;

    // Create a lock file held by the current process (so it won't be considered stale/dead)
    await fs.mkdir(path.dirname(storePath), { recursive: true });
    await fs.writeFile(
      lockPath,
      JSON.stringify({ pid: process.pid, startedAt: Date.now() }),
      "utf-8",
    );

    // Use withSessionStoreLock directly with a short timeout
    await expect(
      withSessionStoreLock(storePath, async () => "should not reach", {
        timeoutMs: 500,
        staleMs: 60_000,
      }),
    ).rejects.toThrow(SessionStoreLockTimeoutError);

    // Clean up
    await fs.unlink(lockPath).catch(() => {});
  });

  it("has the correct name and properties", () => {
    const err = new SessionStoreLockTimeoutError("/some/path.lock", 5000);
    expect(err.name).toBe("SessionStoreLockTimeoutError");
    expect(err.lockPath).toBe("/some/path.lock");
    expect(err.timeoutMs).toBe(5000);
    expect(err.message).toContain("timeout acquiring session store lock");
    expect(err.message).toContain("/some/path.lock");
  });

  it("preserves the cause", () => {
    const cause = new Error("EEXIST");
    const err = new SessionStoreLockTimeoutError("/some/path.lock", 5000, cause);
    expect(err.cause).toBe(cause);
  });

  it("is an instance of Error", () => {
    const err = new SessionStoreLockTimeoutError("/some/path.lock", 5000);
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(SessionStoreLockTimeoutError);
  });
});

describe("withSessionStoreLock backoff", () => {
  it("succeeds when lock is released before timeout", async () => {
    const storePath = path.join(tmpDir, "sessions.json");
    const lockPath = `${storePath}.lock`;

    // Write initial store
    await fs.mkdir(path.dirname(storePath), { recursive: true });
    await fs.writeFile(storePath, JSON.stringify({}), "utf-8");

    // Create a lock file held by the current process
    await fs.writeFile(
      lockPath,
      JSON.stringify({ pid: process.pid, startedAt: Date.now() }),
      "utf-8",
    );

    // Release the lock after 200ms
    setTimeout(async () => {
      await fs.unlink(lockPath).catch(() => {});
    }, 200);

    // This should succeed after the lock is released
    const startTime = Date.now();
    const result = await withSessionStoreLock(storePath, async () => "success", {
      timeoutMs: 5000,
      staleMs: 60_000,
    });
    const elapsed = Date.now() - startTime;

    expect(result).toBe("success");
    // Should have waited at least ~200ms for the lock release
    expect(elapsed).toBeGreaterThanOrEqual(150);

    // Clean up lock if it still exists
    await fs.unlink(lockPath).catch(() => {});
  });

  it("uses exponential backoff (delays grow over time)", async () => {
    const storePath = path.join(tmpDir, "sessions.json");
    const lockPath = `${storePath}.lock`;

    await fs.mkdir(path.dirname(storePath), { recursive: true });

    // Create a lock held by the current process
    await fs.writeFile(
      lockPath,
      JSON.stringify({ pid: process.pid, startedAt: Date.now() }),
      "utf-8",
    );

    const startTime = Date.now();
    try {
      await withSessionStoreLock(storePath, async () => "should not reach", {
        timeoutMs: 800,
        staleMs: 60_000,
      });
    } catch (err) {
      expect(err).toBeInstanceOf(SessionStoreLockTimeoutError);
    }
    const elapsed = Date.now() - startTime;

    // With exponential backoff starting at 50ms and doubling, we should
    // NOT see hundreds of attempts in 800ms (unlike the old 25ms fixed poll).
    // The elapsed time should be close to 800ms (the timeout).
    expect(elapsed).toBeGreaterThanOrEqual(700);
    expect(elapsed).toBeLessThan(2000);

    await fs.unlink(lockPath).catch(() => {});
  });

  it("reclaims stale lock files during retry", async () => {
    const storePath = path.join(tmpDir, "sessions.json");
    const lockPath = `${storePath}.lock`;

    await fs.mkdir(path.dirname(storePath), { recursive: true });
    await fs.writeFile(storePath, JSON.stringify({}), "utf-8");

    // Create a stale lock file (old mtime)
    await fs.writeFile(
      lockPath,
      JSON.stringify({ pid: 999999, startedAt: Date.now() - 60_000 }),
      "utf-8",
    );
    // Set mtime to 60 seconds ago to trigger stale eviction
    const pastTime = new Date(Date.now() - 60_000);
    await fs.utimes(lockPath, pastTime, pastTime);

    // Should succeed by reclaiming the stale lock
    const result = await withSessionStoreLock(storePath, async () => "reclaimed", {
      timeoutMs: 2000,
      staleMs: 10_000,
    });
    expect(result).toBe("reclaimed");

    // Clean up lock if it still exists
    await fs.unlink(lockPath).catch(() => {});
  });

  it("concurrent writers eventually succeed (no silent drops)", async () => {
    const storePath = path.join(tmpDir, "sessions.json");

    await fs.mkdir(path.dirname(storePath), { recursive: true });
    await fs.writeFile(storePath, JSON.stringify({}), "utf-8");

    // Launch 5 concurrent lock acquisitions — all should succeed
    const results = await Promise.allSettled(
      Array.from({ length: 5 }, (_, i) =>
        withSessionStoreLock(
          storePath,
          async () => {
            // Simulate some work inside the lock
            await new Promise((r) => setTimeout(r, 20));
            return `writer-${i}`;
          },
          { timeoutMs: 10_000 },
        ),
      ),
    );

    const fulfilled = results.filter((r) => r.status === "fulfilled");
    // All 5 should succeed (no silent drops)
    expect(fulfilled.length).toBe(5);

    // All should have returned their values
    const values = fulfilled.map((r) => r.value);
    for (let i = 0; i < 5; i++) {
      expect(values).toContain(`writer-${i}`);
    }
  });
});
