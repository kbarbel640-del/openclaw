import crypto from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SessionEntry } from "./types.js";
import {
  capEntryCount,
  clearSessionStoreCacheForTest,
  loadSessionStore,
  pruneCronRunSessions,
  pruneStaleEntries,
  rotateSessionFile,
  saveSessionStore,
} from "./store.js";

// Mock loadConfig so resolveMaintenanceConfig() never reads a real openclaw.json.
// Unit tests always pass explicit overrides so this mock is inert for them.
// Integration tests set return values to control the config.
vi.mock("../config.js", () => ({
  loadConfig: vi.fn().mockReturnValue({}),
}));

const DAY_MS = 24 * 60 * 60 * 1000;

function makeEntry(updatedAt: number): SessionEntry {
  return { sessionId: crypto.randomUUID(), updatedAt };
}

function makeStore(entries: Array<[string, SessionEntry]>): Record<string, SessionEntry> {
  return Object.fromEntries(entries);
}

// ---------------------------------------------------------------------------
// Unit tests — each function called with explicit override parameters.
// No config loading needed; overrides bypass resolveMaintenanceConfig().
// ---------------------------------------------------------------------------

describe("pruneStaleEntries", () => {
  it("removes entries older than maxAgeDays", () => {
    const now = Date.now();
    const store = makeStore([
      ["old", makeEntry(now - 31 * DAY_MS)],
      ["fresh", makeEntry(now - 1 * DAY_MS)],
    ]);

    const pruned = pruneStaleEntries(store, 30 * DAY_MS);

    expect(pruned).toBe(1);
    expect(store.old).toBeUndefined();
    expect(store.fresh).toBeDefined();
  });

  it("keeps entries newer than maxAgeDays", () => {
    const now = Date.now();
    const store = makeStore([
      ["a", makeEntry(now - 1 * DAY_MS)],
      ["b", makeEntry(now - 6 * DAY_MS)],
      ["c", makeEntry(now)],
    ]);

    const pruned = pruneStaleEntries(store, 7 * DAY_MS);

    expect(pruned).toBe(0);
    expect(Object.keys(store)).toHaveLength(3);
  });

  it("keeps entries with no updatedAt", () => {
    const store: Record<string, SessionEntry> = {
      noDate: { sessionId: crypto.randomUUID() } as SessionEntry,
      fresh: makeEntry(Date.now()),
    };

    const pruned = pruneStaleEntries(store, 1 * DAY_MS);

    expect(pruned).toBe(0);
    expect(store.noDate).toBeDefined();
  });

  it("empty store is a no-op", () => {
    const store: Record<string, SessionEntry> = {};
    const pruned = pruneStaleEntries(store, 30 * DAY_MS);

    expect(pruned).toBe(0);
    expect(Object.keys(store)).toHaveLength(0);
  });

  it("all entries stale results in empty store", () => {
    const now = Date.now();
    const store = makeStore([
      ["a", makeEntry(now - 10 * DAY_MS)],
      ["b", makeEntry(now - 20 * DAY_MS)],
      ["c", makeEntry(now - 100 * DAY_MS)],
    ]);

    const pruned = pruneStaleEntries(store, 5 * DAY_MS);

    expect(pruned).toBe(3);
    expect(Object.keys(store)).toHaveLength(0);
  });

  it("returns count of pruned entries", () => {
    const now = Date.now();
    const store = makeStore([
      ["stale1", makeEntry(now - 15 * DAY_MS)],
      ["stale2", makeEntry(now - 30 * DAY_MS)],
      ["fresh1", makeEntry(now - 5 * DAY_MS)],
      ["fresh2", makeEntry(now)],
    ]);

    const pruned = pruneStaleEntries(store, 10 * DAY_MS);

    expect(pruned).toBe(2);
    expect(Object.keys(store)).toHaveLength(2);
  });

  it("entry exactly at the boundary is kept", () => {
    const now = Date.now();
    const store = makeStore([["borderline", makeEntry(now - 30 * DAY_MS + 1000)]]);

    const pruned = pruneStaleEntries(store, 30 * DAY_MS);

    expect(pruned).toBe(0);
    expect(store.borderline).toBeDefined();
  });

  it("falls back to built-in default (30 days) when no override given", () => {
    const now = Date.now();
    const store = makeStore([
      ["old", makeEntry(now - 31 * DAY_MS)],
      ["fresh", makeEntry(now - 29 * DAY_MS)],
    ]);

    // loadConfig mock returns {} → maintenance is undefined → default 30 days
    const pruned = pruneStaleEntries(store);

    expect(pruned).toBe(1);
    expect(store.old).toBeUndefined();
    expect(store.fresh).toBeDefined();
  });
});

describe("capEntryCount", () => {
  it("over limit: keeps N most recent by updatedAt, deletes rest", () => {
    const now = Date.now();
    const store = makeStore([
      ["oldest", makeEntry(now - 4 * DAY_MS)],
      ["old", makeEntry(now - 3 * DAY_MS)],
      ["mid", makeEntry(now - 2 * DAY_MS)],
      ["recent", makeEntry(now - 1 * DAY_MS)],
      ["newest", makeEntry(now)],
    ]);

    const evicted = capEntryCount(store, 3);

    expect(evicted).toBe(2);
    expect(Object.keys(store)).toHaveLength(3);
    expect(store.newest).toBeDefined();
    expect(store.recent).toBeDefined();
    expect(store.mid).toBeDefined();
    expect(store.oldest).toBeUndefined();
    expect(store.old).toBeUndefined();
  });

  it("under limit: no-op", () => {
    const store = makeStore([
      ["a", makeEntry(Date.now())],
      ["b", makeEntry(Date.now() - DAY_MS)],
    ]);

    const evicted = capEntryCount(store, 10);

    expect(evicted).toBe(0);
    expect(Object.keys(store)).toHaveLength(2);
  });

  it("exactly at limit: no-op", () => {
    const now = Date.now();
    const store = makeStore([
      ["a", makeEntry(now)],
      ["b", makeEntry(now - DAY_MS)],
      ["c", makeEntry(now - 2 * DAY_MS)],
    ]);

    const evicted = capEntryCount(store, 3);

    expect(evicted).toBe(0);
    expect(Object.keys(store)).toHaveLength(3);
  });

  it("entries without updatedAt are evicted first (lowest priority)", () => {
    const now = Date.now();
    const store: Record<string, SessionEntry> = {
      noDate1: { sessionId: crypto.randomUUID() } as SessionEntry,
      noDate2: { sessionId: crypto.randomUUID() } as SessionEntry,
      recent: makeEntry(now),
      older: makeEntry(now - DAY_MS),
    };

    const evicted = capEntryCount(store, 2);

    expect(evicted).toBe(2);
    expect(store.recent).toBeDefined();
    expect(store.older).toBeDefined();
    expect(store.noDate1).toBeUndefined();
    expect(store.noDate2).toBeUndefined();
  });

  it("returns count of evicted entries", () => {
    const now = Date.now();
    const store = makeStore([
      ["a", makeEntry(now)],
      ["b", makeEntry(now - DAY_MS)],
      ["c", makeEntry(now - 2 * DAY_MS)],
    ]);

    const evicted = capEntryCount(store, 1);

    expect(evicted).toBe(2);
    expect(Object.keys(store)).toHaveLength(1);
    expect(store.a).toBeDefined();
  });

  it("falls back to built-in default (500) when no override given", () => {
    const now = Date.now();
    const entries: Array<[string, SessionEntry]> = [];
    for (let i = 0; i < 501; i++) {
      entries.push([`key-${i}`, makeEntry(now - i * 1000)]);
    }
    const store = makeStore(entries);

    // loadConfig mock returns {} → maintenance is undefined → default 500
    const evicted = capEntryCount(store);

    expect(evicted).toBe(1);
    expect(Object.keys(store)).toHaveLength(500);
    expect(store["key-0"]).toBeDefined();
    expect(store["key-500"]).toBeUndefined();
  });

  it("empty store is a no-op", () => {
    const store: Record<string, SessionEntry> = {};

    const evicted = capEntryCount(store, 5);

    expect(evicted).toBe(0);
  });
});

describe("rotateSessionFile", () => {
  let testDir: string;
  let storePath: string;

  beforeEach(async () => {
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), "openclaw-rotate-"));
    storePath = path.join(testDir, "sessions.json");
  });

  afterEach(async () => {
    await fs.rm(testDir, { recursive: true, force: true }).catch(() => undefined);
  });

  it("file under maxBytes: no rotation (returns false)", async () => {
    await fs.writeFile(storePath, "x".repeat(500), "utf-8");

    const rotated = await rotateSessionFile(storePath, 1000);

    expect(rotated).toBe(false);
    const content = await fs.readFile(storePath, "utf-8");
    expect(content).toBe("x".repeat(500));
  });

  it("file over maxBytes: renamed to .bak.{timestamp}, returns true", async () => {
    const bigContent = "x".repeat(200);
    await fs.writeFile(storePath, bigContent, "utf-8");

    const rotated = await rotateSessionFile(storePath, 100);

    expect(rotated).toBe(true);
    await expect(fs.stat(storePath)).rejects.toThrow();
    const files = await fs.readdir(testDir);
    const bakFiles = files.filter((f) => f.startsWith("sessions.json.bak."));
    expect(bakFiles).toHaveLength(1);
    const bakContent = await fs.readFile(path.join(testDir, bakFiles[0]), "utf-8");
    expect(bakContent).toBe(bigContent);
  });

  it("multiple rotations: only keeps 3 most recent .bak files", async () => {
    for (let i = 0; i < 5; i++) {
      await fs.writeFile(storePath, `data-${i}-${"x".repeat(100)}`, "utf-8");
      await rotateSessionFile(storePath, 50);
      await new Promise((r) => setTimeout(r, 5));
    }

    const files = await fs.readdir(testDir);
    const bakFiles = files.filter((f) => f.startsWith("sessions.json.bak.")).toSorted();

    expect(bakFiles.length).toBeLessThanOrEqual(3);
  });

  it("non-existent file: no rotation (returns false)", async () => {
    const missingPath = path.join(testDir, "missing.json");

    const rotated = await rotateSessionFile(missingPath, 100);

    expect(rotated).toBe(false);
  });

  it("file exactly at maxBytes: no rotation (returns false)", async () => {
    await fs.writeFile(storePath, "x".repeat(100), "utf-8");

    const rotated = await rotateSessionFile(storePath, 100);

    expect(rotated).toBe(false);
  });

  it("backup file name includes a timestamp", async () => {
    await fs.writeFile(storePath, "x".repeat(100), "utf-8");
    const before = Date.now();

    await rotateSessionFile(storePath, 50);

    const after = Date.now();
    const files = await fs.readdir(testDir);
    const bakFiles = files.filter((f) => f.startsWith("sessions.json.bak."));
    expect(bakFiles).toHaveLength(1);
    const timestamp = Number(bakFiles[0].replace("sessions.json.bak.", ""));
    expect(timestamp).toBeGreaterThanOrEqual(before);
    expect(timestamp).toBeLessThanOrEqual(after);
  });
});

// ---------------------------------------------------------------------------
// Integration tests — exercise saveSessionStore end-to-end.
// The file-level vi.mock("../config.js") stubs loadConfig; per-test
// mockReturnValue controls what resolveMaintenanceConfig() returns.
// ---------------------------------------------------------------------------

describe("Integration: saveSessionStore with pruning", () => {
  let testDir: string;
  let storePath: string;
  let savedCacheTtl: string | undefined;
  let mockLoadConfig: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), "openclaw-pruning-integ-"));
    storePath = path.join(testDir, "sessions.json");
    savedCacheTtl = process.env.OPENCLAW_SESSION_CACHE_TTL_MS;
    process.env.OPENCLAW_SESSION_CACHE_TTL_MS = "0";
    clearSessionStoreCacheForTest();

    const configModule = await import("../config.js");
    mockLoadConfig = configModule.loadConfig as ReturnType<typeof vi.fn>;
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await fs.rm(testDir, { recursive: true, force: true }).catch(() => undefined);
    clearSessionStoreCacheForTest();
    if (savedCacheTtl === undefined) {
      delete process.env.OPENCLAW_SESSION_CACHE_TTL_MS;
    } else {
      process.env.OPENCLAW_SESSION_CACHE_TTL_MS = savedCacheTtl;
    }
  });

  it("saveSessionStore prunes stale entries on write", async () => {
    mockLoadConfig.mockReturnValue({
      session: {
        maintenance: {
          mode: "enforce",
          pruneAfter: "7d",
          maxEntries: 500,
          rotateBytes: 10_485_760,
        },
      },
    });

    const now = Date.now();
    const store: Record<string, SessionEntry> = {
      stale: makeEntry(now - 30 * DAY_MS),
      fresh: makeEntry(now),
    };

    await saveSessionStore(storePath, store);

    const loaded = loadSessionStore(storePath);
    expect(loaded.stale).toBeUndefined();
    expect(loaded.fresh).toBeDefined();
  });

  it("saveSessionStore caps entries over limit", async () => {
    mockLoadConfig.mockReturnValue({
      session: {
        maintenance: {
          mode: "enforce",
          pruneAfter: "30d",
          maxEntries: 5,
          rotateBytes: 10_485_760,
        },
      },
    });

    const now = Date.now();
    const store: Record<string, SessionEntry> = {};
    for (let i = 0; i < 10; i++) {
      store[`key-${i}`] = makeEntry(now - i * 1000);
    }

    await saveSessionStore(storePath, store);

    const loaded = loadSessionStore(storePath);
    expect(Object.keys(loaded)).toHaveLength(5);
    for (let i = 0; i < 5; i++) {
      expect(loaded[`key-${i}`]).toBeDefined();
    }
    for (let i = 5; i < 10; i++) {
      expect(loaded[`key-${i}`]).toBeUndefined();
    }
  });

  it("saveSessionStore rotates file when over size limit and creates .bak", async () => {
    mockLoadConfig.mockReturnValue({
      session: {
        maintenance: {
          mode: "enforce",
          pruneAfter: "30d",
          maxEntries: 500,
          rotateBytes: "100b",
        },
      },
    });

    const now = Date.now();
    const largeStore: Record<string, SessionEntry> = {};
    for (let i = 0; i < 50; i++) {
      largeStore[`agent:main:session-${crypto.randomUUID()}`] = makeEntry(now - i * 1000);
    }
    await fs.mkdir(path.dirname(storePath), { recursive: true });
    await fs.writeFile(storePath, JSON.stringify(largeStore, null, 2), "utf-8");

    const statBefore = await fs.stat(storePath);
    expect(statBefore.size).toBeGreaterThan(100);

    const smallStore: Record<string, SessionEntry> = {
      only: makeEntry(now),
    };
    await saveSessionStore(storePath, smallStore);

    const files = await fs.readdir(testDir);
    const bakFiles = files.filter((f) => f.startsWith("sessions.json.bak."));
    expect(bakFiles.length).toBeGreaterThanOrEqual(1);

    const loaded = loadSessionStore(storePath);
    expect(loaded.only).toBeDefined();
  });

  it("saveSessionStore applies both pruning and capping together", async () => {
    mockLoadConfig.mockReturnValue({
      session: {
        maintenance: {
          mode: "enforce",
          pruneAfter: "10d",
          maxEntries: 3,
          rotateBytes: 10_485_760,
        },
      },
    });

    const now = Date.now();
    const store: Record<string, SessionEntry> = {
      stale1: makeEntry(now - 15 * DAY_MS),
      stale2: makeEntry(now - 20 * DAY_MS),
      fresh1: makeEntry(now),
      fresh2: makeEntry(now - 1 * DAY_MS),
      fresh3: makeEntry(now - 2 * DAY_MS),
      fresh4: makeEntry(now - 5 * DAY_MS),
    };

    await saveSessionStore(storePath, store);

    const loaded = loadSessionStore(storePath);
    expect(loaded.stale1).toBeUndefined();
    expect(loaded.stale2).toBeUndefined();
    expect(Object.keys(loaded).length).toBeLessThanOrEqual(3);
    expect(loaded.fresh1).toBeDefined();
    expect(loaded.fresh2).toBeDefined();
    expect(loaded.fresh3).toBeDefined();
    expect(loaded.fresh4).toBeUndefined();
  });

  it("saveSessionStore skips enforcement when maintenance mode is warn", async () => {
    mockLoadConfig.mockReturnValue({
      session: {
        maintenance: {
          mode: "warn",
          pruneAfter: "7d",
          maxEntries: 1,
          rotateBytes: 10_485_760,
        },
      },
    });

    const now = Date.now();
    const store: Record<string, SessionEntry> = {
      stale: makeEntry(now - 30 * DAY_MS),
      fresh: makeEntry(now),
    };

    await saveSessionStore(storePath, store);

    const loaded = loadSessionStore(storePath);
    expect(loaded.stale).toBeDefined();
    expect(loaded.fresh).toBeDefined();
    expect(Object.keys(loaded)).toHaveLength(2);
  });

  it("resolveMaintenanceConfig reads from loadConfig().session.maintenance", async () => {
    mockLoadConfig.mockReturnValue({
      session: {
        maintenance: { pruneAfter: "7d", maxEntries: 100, rotateBytes: "5mb" },
      },
    });

    const { resolveMaintenanceConfig } = await import("./store.js");
    const config = resolveMaintenanceConfig();

    expect(config).toEqual({
      mode: "warn",
      pruneAfterMs: 7 * DAY_MS,
      maxEntries: 100,
      rotateBytes: 5 * 1024 * 1024,
    });
  });

  it("resolveMaintenanceConfig uses defaults for missing fields", async () => {
    mockLoadConfig.mockReturnValue({ session: { maintenance: { pruneAfter: "14d" } } });

    const { resolveMaintenanceConfig } = await import("./store.js");
    const config = resolveMaintenanceConfig();

    expect(config).toEqual({
      mode: "warn",
      pruneAfterMs: 14 * DAY_MS,
      maxEntries: 500,
      rotateBytes: 10_485_760,
    });
  });

  it("resolveMaintenanceConfig falls back to deprecated pruneDays", async () => {
    mockLoadConfig.mockReturnValue({ session: { maintenance: { pruneDays: 2 } } });

    const { resolveMaintenanceConfig } = await import("./store.js");
    const config = resolveMaintenanceConfig();

    expect(config).toEqual({
      mode: "warn",
      pruneAfterMs: 2 * DAY_MS,
      maxEntries: 500,
      rotateBytes: 10_485_760,
    });
  });
});

// ---------------------------------------------------------------------------
// Cron Run Session Garbage Collection
// ---------------------------------------------------------------------------

describe("pruneCronRunSessions", () => {
  let mockLoadConfig: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    const configModule = await import("../config.js");
    mockLoadConfig = configModule.loadConfig as ReturnType<typeof vi.fn>;
    mockLoadConfig.mockReturnValue({});
  });

  it("removes cron run sessions older than the retention TTL", () => {
    const now = Date.now();
    const store: Record<string, SessionEntry> = {
      "agent:main:cron:job1": makeEntry(now),
      "agent:main:cron:job1:run:old-run": makeEntry(now - 25 * 60 * 60 * 1000),
      "agent:main:cron:job1:run:recent-run": makeEntry(now - 1 * 60 * 60 * 1000),
      "agent:main:telegram:dm:123": makeEntry(now - 100 * DAY_MS),
    };

    const pruned = pruneCronRunSessions(store, {
      retentionMs: 24 * 60 * 60 * 1000,
      maxCronRunSessions: 100,
      nowMs: now,
    });

    expect(pruned).toBe(1);
    expect(store["agent:main:cron:job1"]).toBeDefined();
    expect(store["agent:main:cron:job1:run:old-run"]).toBeUndefined();
    expect(store["agent:main:cron:job1:run:recent-run"]).toBeDefined();
    expect(store["agent:main:telegram:dm:123"]).toBeDefined();
  });

  it("caps cron run sessions to maxCronRunSessions", () => {
    const now = Date.now();
    const store: Record<string, SessionEntry> = {};
    for (let i = 0; i < 20; i++) {
      store[`agent:main:cron:job1:run:run-${String(i).padStart(3, "0")}`] = makeEntry(
        now - i * 60_000,
      );
    }
    store["agent:main:telegram:dm:456"] = makeEntry(now - 50 * DAY_MS);

    const pruned = pruneCronRunSessions(store, {
      retentionMs: 30 * DAY_MS,
      maxCronRunSessions: 5,
      nowMs: now,
    });

    expect(pruned).toBe(15);
    const cronKeys = Object.keys(store).filter((k) => k.includes(":run:"));
    expect(cronKeys).toHaveLength(5);
    expect(store["agent:main:cron:job1:run:run-000"]).toBeDefined();
    expect(store["agent:main:cron:job1:run:run-004"]).toBeDefined();
    expect(store["agent:main:cron:job1:run:run-005"]).toBeUndefined();
    expect(store["agent:main:telegram:dm:456"]).toBeDefined();
  });

  it("applies both TTL and cap together", () => {
    const now = Date.now();
    const store: Record<string, SessionEntry> = {};
    // 3 expired
    for (let i = 0; i < 3; i++) {
      store[`agent:main:cron:job1:run:expired-${i}`] = makeEntry(
        now - 48 * 60 * 60 * 1000 - i * 60_000,
      );
    }
    // 10 recent
    for (let i = 0; i < 10; i++) {
      store[`agent:main:cron:job1:run:recent-${i}`] = makeEntry(now - i * 60_000);
    }

    const pruned = pruneCronRunSessions(store, {
      retentionMs: 24 * 60 * 60 * 1000,
      maxCronRunSessions: 5,
      nowMs: now,
    });

    // 3 expired by TTL + 5 excess by cap = 8
    expect(pruned).toBe(8);
    const cronKeys = Object.keys(store).filter((k) => k.includes(":run:"));
    expect(cronKeys).toHaveLength(5);
  });

  it("does nothing when there are no cron run sessions", () => {
    const now = Date.now();
    const store: Record<string, SessionEntry> = {
      "agent:main:telegram:dm:123": makeEntry(now),
      "agent:main:cron:job1": makeEntry(now),
    };

    const pruned = pruneCronRunSessions(store, {
      retentionMs: 24 * 60 * 60 * 1000,
      maxCronRunSessions: 50,
      nowMs: now,
    });

    expect(pruned).toBe(0);
    expect(Object.keys(store)).toHaveLength(2);
  });

  it("skips TTL pruning when retentionMs is null", () => {
    const now = Date.now();
    const store: Record<string, SessionEntry> = {
      "agent:main:cron:job1:run:old": makeEntry(now - 100 * DAY_MS),
      "agent:main:cron:job1:run:recent": makeEntry(now),
    };

    const pruned = pruneCronRunSessions(store, {
      retentionMs: null,
      maxCronRunSessions: 100,
      nowMs: now,
    });

    expect(pruned).toBe(0);
    expect(Object.keys(store)).toHaveLength(2);
  });

  it("still enforces cap even when TTL is disabled", () => {
    const now = Date.now();
    const store: Record<string, SessionEntry> = {};
    for (let i = 0; i < 10; i++) {
      store[`agent:main:cron:job1:run:run-${i}`] = makeEntry(now - i * 60_000);
    }

    const pruned = pruneCronRunSessions(store, {
      retentionMs: null,
      maxCronRunSessions: 3,
      nowMs: now,
    });

    expect(pruned).toBe(7);
    const cronKeys = Object.keys(store).filter((k) => k.includes(":run:"));
    expect(cronKeys).toHaveLength(3);
  });

  it("handles entries without updatedAt (treated as 0)", () => {
    const now = Date.now();
    const store: Record<string, SessionEntry> = {
      "agent:main:cron:job1:run:no-date": {
        sessionId: "no-date",
      } as SessionEntry,
      "agent:main:cron:job1:run:recent": makeEntry(now),
    };

    const pruned = pruneCronRunSessions(store, {
      retentionMs: 24 * 60 * 60 * 1000,
      maxCronRunSessions: 100,
      nowMs: now,
    });

    // Entry with no updatedAt (treated as 0) should be pruned by TTL
    expect(pruned).toBe(1);
    expect(store["agent:main:cron:job1:run:no-date"]).toBeUndefined();
    expect(store["agent:main:cron:job1:run:recent"]).toBeDefined();
  });
});

describe("Integration: saveSessionStore prunes cron sessions in warn mode", () => {
  let testDir: string;
  let storePath: string;
  let savedCacheTtl: string | undefined;
  let mockLoadConfig: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), "openclaw-cron-gc-integ-"));
    storePath = path.join(testDir, "sessions.json");
    savedCacheTtl = process.env.OPENCLAW_SESSION_CACHE_TTL_MS;
    process.env.OPENCLAW_SESSION_CACHE_TTL_MS = "0";
    clearSessionStoreCacheForTest();

    const configModule = await import("../config.js");
    mockLoadConfig = configModule.loadConfig as ReturnType<typeof vi.fn>;
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await fs.rm(testDir, { recursive: true, force: true }).catch(() => undefined);
    clearSessionStoreCacheForTest();
    if (savedCacheTtl === undefined) {
      delete process.env.OPENCLAW_SESSION_CACHE_TTL_MS;
    } else {
      process.env.OPENCLAW_SESSION_CACHE_TTL_MS = savedCacheTtl;
    }
  });

  it("prunes expired cron run sessions even when general maintenance is warn-only", async () => {
    const now = Date.now();
    mockLoadConfig.mockReturnValue({
      session: {
        maintenance: {
          mode: "warn",
          pruneAfter: "7d",
          maxEntries: 1000,
        },
      },
      cron: {
        sessionRetention: "24h",
        maxCronRunSessions: 50,
      },
    });

    const store: Record<string, SessionEntry> = {
      "agent:main:telegram:dm:stale": makeEntry(now - 30 * DAY_MS),
      "agent:main:cron:job1:run:expired": makeEntry(now - 48 * 60 * 60 * 1000),
      "agent:main:cron:job1:run:recent": makeEntry(now - 1 * 60 * 60 * 1000),
    };

    await saveSessionStore(storePath, store);

    const loaded = loadSessionStore(storePath);
    // Stale regular session should be KEPT (warn mode doesn't enforce general pruning)
    expect(loaded["agent:main:telegram:dm:stale"]).toBeDefined();
    // Expired cron run session should be PRUNED (cron GC always runs)
    expect(loaded["agent:main:cron:job1:run:expired"]).toBeUndefined();
    // Recent cron run session should be KEPT
    expect(loaded["agent:main:cron:job1:run:recent"]).toBeDefined();
  });

  it("caps cron run sessions during save even when general maintenance is warn-only", async () => {
    const now = Date.now();
    mockLoadConfig.mockReturnValue({
      session: {
        maintenance: {
          mode: "warn",
          maxEntries: 1000,
        },
      },
      cron: {
        maxCronRunSessions: 5,
      },
    });

    const store: Record<string, SessionEntry> = {};
    for (let i = 0; i < 20; i++) {
      store[`agent:main:cron:job1:run:run-${String(i).padStart(3, "0")}`] = makeEntry(
        now - i * 60_000,
      );
    }
    store["agent:main:telegram:dm:regular"] = makeEntry(now);

    await saveSessionStore(storePath, store);

    const loaded = loadSessionStore(storePath);
    const cronKeys = Object.keys(loaded).filter((k) => k.includes(":run:"));
    expect(cronKeys).toHaveLength(5);
    expect(loaded["agent:main:telegram:dm:regular"]).toBeDefined();
  });
});
