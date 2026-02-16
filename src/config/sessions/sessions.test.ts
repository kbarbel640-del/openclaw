import fs from "node:fs";
import fsPromises from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { SessionConfig } from "../types.base.js";
import type { SessionEntry } from "./types.js";
import {
  clearSessionStoreCacheForTest,
  loadSessionStore,
  updateSessionStore,
} from "../sessions.js";
import {
  resolveSessionFilePath,
  resolveSessionFilePathOptions,
  resolveSessionTranscriptPath,
  resolveSessionTranscriptPathInDir,
  resolveStorePath,
  validateSessionId,
} from "./paths.js";
import { resolveSessionResetPolicy } from "./reset.js";
import { appendAssistantMessageToSessionTranscript } from "./transcript.js";

describe("session path safety", () => {
  it("rejects unsafe session IDs", () => {
    expect(() => validateSessionId("../etc/passwd")).toThrow(/Invalid session ID/);
    expect(() => validateSessionId("a/b")).toThrow(/Invalid session ID/);
    expect(() => validateSessionId("a\\b")).toThrow(/Invalid session ID/);
    expect(() => validateSessionId("/abs")).toThrow(/Invalid session ID/);
  });

  it("resolves transcript path inside an explicit sessions dir", () => {
    const sessionsDir = "/tmp/openclaw/agents/main/sessions";
    const resolved = resolveSessionTranscriptPathInDir("sess-1", sessionsDir, "topic/a+b");

    expect(resolved).toBe(path.resolve(sessionsDir, "sess-1-topic-topic%2Fa%2Bb.jsonl"));
  });

  it("rejects absolute sessionFile paths outside known agent sessions dirs", () => {
    const sessionsDir = "/tmp/openclaw/agents/main/sessions";

    expect(() =>
      resolveSessionFilePath(
        "sess-1",
        { sessionFile: "/tmp/openclaw/agents/work/not-sessions/abc-123.jsonl" },
        { sessionsDir },
      ),
    ).toThrow(/within sessions directory/);
  });

  it("uses explicit agentId fallback for absolute sessionFile outside sessionsDir", () => {
    const mainSessionsDir = path.dirname(resolveStorePath(undefined, { agentId: "main" }));
    const opsSessionsDir = path.dirname(resolveStorePath(undefined, { agentId: "ops" }));
    const opsSessionFile = path.join(opsSessionsDir, "abc-123.jsonl");

    const resolved = resolveSessionFilePath(
      "sess-1",
      { sessionFile: opsSessionFile },
      { sessionsDir: mainSessionsDir, agentId: "ops" },
    );

    expect(resolved).toBe(path.resolve(opsSessionFile));
  });

  it("uses absolute path fallback when sessionFile includes a different agent dir", () => {
    const mainSessionsDir = path.dirname(resolveStorePath(undefined, { agentId: "main" }));
    const opsSessionsDir = path.dirname(resolveStorePath(undefined, { agentId: "ops" }));
    const opsSessionFile = path.join(opsSessionsDir, "abc-123.jsonl");

    const resolved = resolveSessionFilePath(
      "sess-1",
      { sessionFile: opsSessionFile },
      { sessionsDir: mainSessionsDir },
    );

    expect(resolved).toBe(path.resolve(opsSessionFile));
  });

  it("uses sibling fallback for custom per-agent store roots", () => {
    const mainSessionsDir = "/srv/custom/agents/main/sessions";
    const opsSessionFile = "/srv/custom/agents/ops/sessions/abc-123.jsonl";

    const resolved = resolveSessionFilePath(
      "sess-1",
      { sessionFile: opsSessionFile },
      { sessionsDir: mainSessionsDir, agentId: "ops" },
    );

    expect(resolved).toBe(path.resolve(opsSessionFile));
  });

  it("uses extracted agent fallback for custom per-agent store roots", () => {
    const mainSessionsDir = "/srv/custom/agents/main/sessions";
    const opsSessionFile = "/srv/custom/agents/ops/sessions/abc-123.jsonl";

    const resolved = resolveSessionFilePath(
      "sess-1",
      { sessionFile: opsSessionFile },
      { sessionsDir: mainSessionsDir },
    );

    expect(resolved).toBe(path.resolve(opsSessionFile));
  });

  it("accepts absolute workspace-relative sessionFile with UUID basename", () => {
    const sessionsDir = "/home/user/.openclaw/agents/main/sessions";
    const workspaceFile = "/home/user/workspace/a1b2c3d4-e5f6-7890-abcd-ef1234567890.jsonl";

    const resolved = resolveSessionFilePath(
      "sess-1",
      { sessionFile: workspaceFile },
      { sessionsDir },
    );

    expect(resolved).toBe(path.resolve(workspaceFile));
  });

  it("accepts absolute workspace-relative sessionFile with timestamp prefix", () => {
    const sessionsDir = "/home/user/.openclaw/agents/main/sessions";
    const workspaceFile =
      "/home/user/workspace/20260216_a1b2c3d4-e5f6-7890-abcd-ef1234567890.jsonl";

    const resolved = resolveSessionFilePath(
      "sess-1",
      { sessionFile: workspaceFile },
      { sessionsDir },
    );

    expect(resolved).toBe(path.resolve(workspaceFile));
  });

  it("still rejects absolute paths outside sessions dir without UUID basename", () => {
    const sessionsDir = "/home/user/.openclaw/agents/main/sessions";

    expect(() =>
      resolveSessionFilePath("sess-1", { sessionFile: "/etc/passwd" }, { sessionsDir }),
    ).toThrow(/within sessions directory/);
  });

  it("still rejects absolute non-jsonl paths with UUID basename", () => {
    const sessionsDir = "/home/user/.openclaw/agents/main/sessions";

    expect(() =>
      resolveSessionFilePath(
        "sess-1",
        { sessionFile: "/tmp/a1b2c3d4-e5f6-7890-abcd-ef1234567890.txt" },
        { sessionsDir },
      ),
    ).toThrow(/within sessions directory/);
  });

  it("uses agent sessions dir fallback for transcript path", () => {
    const resolved = resolveSessionTranscriptPath("sess-1", "main");
    expect(resolved.endsWith(path.join("agents", "main", "sessions", "sess-1.jsonl"))).toBe(true);
  });

  it("keeps storePath and agentId when resolving session file options", () => {
    const opts = resolveSessionFilePathOptions({
      storePath: "/tmp/custom/agent-store/sessions.json",
      agentId: "ops",
    });
    expect(opts).toEqual({
      sessionsDir: path.resolve("/tmp/custom/agent-store"),
      agentId: "ops",
    });
  });

  it("keeps custom per-agent store roots when agentId is provided", () => {
    const opts = resolveSessionFilePathOptions({
      storePath: "/srv/custom/agents/ops/sessions/sessions.json",
      agentId: "ops",
    });
    expect(opts).toEqual({
      sessionsDir: path.resolve("/srv/custom/agents/ops/sessions"),
      agentId: "ops",
    });
  });

  it("falls back to agentId when storePath is absent", () => {
    const opts = resolveSessionFilePathOptions({ agentId: "ops" });
    expect(opts).toEqual({ agentId: "ops" });
  });
});

describe("resolveSessionResetPolicy", () => {
  describe("backward compatibility: resetByType.dm -> direct", () => {
    it("does not use dm fallback for group/thread types", () => {
      const sessionCfg = {
        resetByType: {
          dm: { mode: "idle" as const, idleMinutes: 45 },
        },
      } as unknown as SessionConfig;

      const groupPolicy = resolveSessionResetPolicy({
        sessionCfg,
        resetType: "group",
      });

      expect(groupPolicy.mode).toBe("daily");
    });
  });
});

describe("session store lock (Promise chain mutex)", () => {
  let lockFixtureRoot = "";
  let lockCaseId = 0;
  let lockTmpDirs: string[] = [];

  async function makeTmpStore(
    initial: Record<string, unknown> = {},
  ): Promise<{ dir: string; storePath: string }> {
    const dir = path.join(lockFixtureRoot, `case-${lockCaseId++}`);
    await fsPromises.mkdir(dir);
    lockTmpDirs.push(dir);
    const storePath = path.join(dir, "sessions.json");
    if (Object.keys(initial).length > 0) {
      await fsPromises.writeFile(storePath, JSON.stringify(initial, null, 2), "utf-8");
    }
    return { dir, storePath };
  }

  beforeAll(async () => {
    lockFixtureRoot = await fsPromises.mkdtemp(path.join(os.tmpdir(), "openclaw-lock-test-"));
  });

  afterAll(async () => {
    if (lockFixtureRoot) {
      await fsPromises.rm(lockFixtureRoot, { recursive: true, force: true }).catch(() => undefined);
    }
  });

  afterEach(async () => {
    clearSessionStoreCacheForTest();
    lockTmpDirs = [];
  });

  it("serializes concurrent updateSessionStore calls without data loss", async () => {
    const key = "agent:main:test";
    const { storePath } = await makeTmpStore({
      [key]: { sessionId: "s1", updatedAt: 100, counter: 0 },
    });

    const N = 4;
    await Promise.all(
      Array.from({ length: N }, (_, i) =>
        updateSessionStore(storePath, async (store) => {
          const entry = store[key] as Record<string, unknown>;
          await Promise.resolve();
          entry.counter = (entry.counter as number) + 1;
          entry.tag = `writer-${i}`;
        }),
      ),
    );

    const store = loadSessionStore(storePath);
    expect((store[key] as Record<string, unknown>).counter).toBe(N);
  });

  it("multiple consecutive errors do not permanently poison the queue", async () => {
    const key = "agent:main:multi-err";
    const { storePath } = await makeTmpStore({
      [key]: { sessionId: "s1", updatedAt: 100 },
    });

    const errors = Array.from({ length: 3 }, (_, i) =>
      updateSessionStore(storePath, async () => {
        throw new Error(`fail-${i}`);
      }),
    );

    const success = updateSessionStore(storePath, async (store) => {
      store[key] = { ...store[key], modelOverride: "recovered" } as unknown as SessionEntry;
    });

    for (const p of errors) {
      await expect(p).rejects.toThrow();
    }
    await success;

    const store = loadSessionStore(storePath);
    expect(store[key]?.modelOverride).toBe("recovered");
  });
});

describe("appendAssistantMessageToSessionTranscript", () => {
  let tempDir: string;
  let storePath: string;
  let sessionsDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "transcript-test-"));
    sessionsDir = path.join(tempDir, "agents", "main", "sessions");
    fs.mkdirSync(sessionsDir, { recursive: true });
    storePath = path.join(sessionsDir, "sessions.json");
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it("creates transcript file and appends message for valid session", async () => {
    const sessionId = "test-session-id";
    const sessionKey = "test-session";
    const store = {
      [sessionKey]: {
        sessionId,
        chatType: "direct",
        channel: "discord",
      },
    };
    fs.writeFileSync(storePath, JSON.stringify(store), "utf-8");

    const result = await appendAssistantMessageToSessionTranscript({
      sessionKey,
      text: "Hello from delivery mirror!",
      storePath,
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(fs.existsSync(result.sessionFile)).toBe(true);

      const lines = fs.readFileSync(result.sessionFile, "utf-8").trim().split("\n");
      expect(lines.length).toBe(2);

      const header = JSON.parse(lines[0]);
      expect(header.type).toBe("session");
      expect(header.id).toBe(sessionId);

      const messageLine = JSON.parse(lines[1]);
      expect(messageLine.type).toBe("message");
      expect(messageLine.message.role).toBe("assistant");
      expect(messageLine.message.content[0].type).toBe("text");
      expect(messageLine.message.content[0].text).toBe("Hello from delivery mirror!");
    }
  });
});
