import crypto from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SessionEntry } from "./types.js";

// Mock loadConfig so resolveSessionLockConfig() never reads a real openclaw.json.
vi.mock("../config.js", () => ({
  loadConfig: vi.fn().mockReturnValue({}),
}));

function makeEntry(updatedAt: number): SessionEntry {
  return { sessionId: crypto.randomUUID(), updatedAt };
}

// ---------------------------------------------------------------------------
// resolveSessionLockConfig
// ---------------------------------------------------------------------------

describe("resolveSessionLockConfig", () => {
  let mockLoadConfig: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    vi.resetModules();
    const configModule = await import("../config.js");
    mockLoadConfig = configModule.loadConfig as ReturnType<typeof vi.fn>;
  });

  it("returns built-in defaults when no config is set", async () => {
    mockLoadConfig.mockReturnValue({});
    const { resolveSessionLockConfig } = await import("./store.js");
    const config = resolveSessionLockConfig();

    expect(config).toEqual({
      timeoutMs: 10_000,
      staleMs: 30_000,
    });
  });

  it("returns built-in defaults when session.lock is undefined", async () => {
    mockLoadConfig.mockReturnValue({ session: {} });
    const { resolveSessionLockConfig } = await import("./store.js");
    const config = resolveSessionLockConfig();

    expect(config).toEqual({
      timeoutMs: 10_000,
      staleMs: 30_000,
    });
  });

  it("reads timeoutMs from config", async () => {
    mockLoadConfig.mockReturnValue({
      session: { lock: { timeoutMs: 120_000 } },
    });
    const { resolveSessionLockConfig } = await import("./store.js");
    const config = resolveSessionLockConfig();

    expect(config.timeoutMs).toBe(120_000);
    expect(config.staleMs).toBe(30_000); // default
  });

  it("reads staleMs from config", async () => {
    mockLoadConfig.mockReturnValue({
      session: { lock: { staleMs: 90_000 } },
    });
    const { resolveSessionLockConfig } = await import("./store.js");
    const config = resolveSessionLockConfig();

    expect(config.timeoutMs).toBe(10_000); // default
    expect(config.staleMs).toBe(90_000);
  });

  it("reads both overrides from config", async () => {
    mockLoadConfig.mockReturnValue({
      session: { lock: { timeoutMs: 120_000, staleMs: 180_000 } },
    });
    const { resolveSessionLockConfig } = await import("./store.js");
    const config = resolveSessionLockConfig();

    expect(config).toEqual({
      timeoutMs: 120_000,
      staleMs: 180_000,
    });
  });

  it("falls back to defaults when loadConfig throws", async () => {
    mockLoadConfig.mockImplementation(() => {
      throw new Error("config not available");
    });
    const { resolveSessionLockConfig } = await import("./store.js");
    const config = resolveSessionLockConfig();

    expect(config).toEqual({
      timeoutMs: 10_000,
      staleMs: 30_000,
    });
  });
});

// ---------------------------------------------------------------------------
// withSessionStoreLock — config-driven lock parameters
// ---------------------------------------------------------------------------

describe("withSessionStoreLock uses config-driven lock parameters", () => {
  let tmpDir: string;
  let storePath: string;
  let mockLoadConfig: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    vi.resetModules();
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "openclaw-lock-cfg-"));
    storePath = path.join(tmpDir, "sessions.json");
    await fs.writeFile(storePath, JSON.stringify({}), "utf-8");

    const configModule = await import("../config.js");
    mockLoadConfig = configModule.loadConfig as ReturnType<typeof vi.fn>;
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it("acquires and releases lock with default config", async () => {
    mockLoadConfig.mockReturnValue({});
    const { updateSessionStore, loadSessionStore } = await import("./store.js");

    await updateSessionStore(storePath, (store) => {
      store["test-key"] = makeEntry(Date.now());
    });

    const store = loadSessionStore(storePath, { skipCache: true });
    expect(store["test-key"]).toBeDefined();
  });

  it("acquires and releases lock with custom config", async () => {
    mockLoadConfig.mockReturnValue({
      session: { lock: { timeoutMs: 60_000, staleMs: 120_000 } },
    });
    const { updateSessionStore, loadSessionStore } = await import("./store.js");

    await updateSessionStore(storePath, (store) => {
      store["custom-key"] = makeEntry(Date.now());
    });

    const store = loadSessionStore(storePath, { skipCache: true });
    expect(store["custom-key"]).toBeDefined();
  });

  it("reclaims stale lock based on configured staleMs", async () => {
    mockLoadConfig.mockReturnValue({
      session: { lock: { timeoutMs: 2_000, staleMs: 50 } },
    });
    const { updateSessionStore, loadSessionStore } = await import("./store.js");

    // Create a stale lock file
    const lockPath = `${storePath}.lock`;
    await fs.writeFile(
      lockPath,
      JSON.stringify({ pid: 999999, startedAt: Date.now() - 10_000 }),
      "utf-8",
    );

    // Wait a tiny bit so the lock file's mtime is older than staleMs (50ms)
    await new Promise((r) => setTimeout(r, 100));

    // Should successfully acquire lock by reclaiming the stale one
    await updateSessionStore(storePath, (store) => {
      store["reclaimed-key"] = makeEntry(Date.now());
    });

    const store = loadSessionStore(storePath, { skipCache: true });
    expect(store["reclaimed-key"]).toBeDefined();
  });

  it("times out when lock is held and not stale", async () => {
    mockLoadConfig.mockReturnValue({
      session: { lock: { timeoutMs: 200, staleMs: 60_000 } },
    });
    const { updateSessionStore } = await import("./store.js");

    // Create a fresh lock file owned by a "different process" that is still alive (use our own pid)
    const lockPath = `${storePath}.lock`;
    await fs.writeFile(
      lockPath,
      JSON.stringify({ pid: process.pid, startedAt: Date.now() }),
      "utf-8",
    );

    await expect(
      updateSessionStore(storePath, (store) => {
        store["timeout-key"] = makeEntry(Date.now());
      }),
    ).rejects.toThrow(/timeout/i);

    // Cleanup
    await fs.rm(lockPath, { force: true });
  });
});
