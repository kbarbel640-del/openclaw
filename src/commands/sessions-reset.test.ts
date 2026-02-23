import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { loadSessionStore, resolveStorePath, type SessionEntry } from "../config/sessions.js";
import type { RuntimeEnv } from "../runtime.js";
import { sessionsResetCommand } from "./sessions-reset.js";

function writeStore(agentId: string, store: Record<string, SessionEntry>): string {
  const storePath = resolveStorePath(undefined, { agentId });
  fs.mkdirSync(path.dirname(storePath), { recursive: true });
  fs.writeFileSync(storePath, JSON.stringify(store, null, 2));
  return storePath;
}

function makeRuntime(): { runtime: RuntimeEnv; logs: string[]; errors: string[] } {
  const logs: string[] = [];
  const errors: string[] = [];
  return {
    runtime: {
      log: (msg) => logs.push(String(msg)),
      error: (msg) => errors.push(String(msg)),
      exit: (code) => {
        throw new Error(`exit ${code}`);
      },
    },
    logs,
    errors,
  };
}

describe("sessionsResetCommand", () => {
  let tmpDir: string;
  let previousStateDir: string | undefined;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-02-23T00:00:00Z"));
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "openclaw-sessions-reset-"));
    previousStateDir = process.env.OPENCLAW_STATE_DIR;
    process.env.OPENCLAW_STATE_DIR = tmpDir;
  });

  afterEach(() => {
    vi.useRealTimers();
    if (previousStateDir === undefined) {
      delete process.env.OPENCLAW_STATE_DIR;
    } else {
      process.env.OPENCLAW_STATE_DIR = previousStateDir;
    }
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("resets model overrides and auth overrides when --model is set", async () => {
    const storePath = writeStore("main", {
      target: {
        sessionId: "s-target",
        updatedAt: 1,
        providerOverride: "openai",
        modelOverride: "gpt-5",
        authProfileOverride: "work",
        authProfileOverrideSource: "user",
        authProfileOverrideCompactionCount: 2,
      },
      untouched: {
        sessionId: "s-other",
        updatedAt: 2,
        providerOverride: "anthropic",
        modelOverride: "claude",
      },
    });
    const untouchedBefore = loadSessionStore(storePath).untouched;

    const { runtime } = makeRuntime();
    await sessionsResetCommand(
      {
        key: "target",
        agent: "main",
        model: true,
      },
      runtime,
    );

    const store = loadSessionStore(storePath);
    expect(store.target?.providerOverride).toBeUndefined();
    expect(store.target?.modelOverride).toBeUndefined();
    expect(store.target?.authProfileOverride).toBeUndefined();
    expect(store.target?.authProfileOverrideSource).toBeUndefined();
    expect(store.target?.authProfileOverrideCompactionCount).toBeUndefined();
    expect(store.untouched).toEqual(untouchedBefore);
  });

  it("resets only auth overrides when --auth is set", async () => {
    const storePath = writeStore("main", {
      target: {
        sessionId: "s-target",
        updatedAt: 1,
        providerOverride: "openai",
        modelOverride: "gpt-5",
        authProfileOverride: "work",
        authProfileOverrideSource: "auto",
        authProfileOverrideCompactionCount: 3,
      },
      untouched: {
        sessionId: "s-other",
        updatedAt: 2,
        providerOverride: "anthropic",
        modelOverride: "claude",
      },
    });
    const untouchedBefore = loadSessionStore(storePath).untouched;

    const { runtime } = makeRuntime();
    await sessionsResetCommand(
      {
        key: "target",
        agent: "main",
        auth: true,
      },
      runtime,
    );

    const store = loadSessionStore(storePath);
    expect(store.target?.providerOverride).toBe("openai");
    expect(store.target?.modelOverride).toBe("gpt-5");
    expect(store.target?.authProfileOverride).toBeUndefined();
    expect(store.target?.authProfileOverrideSource).toBeUndefined();
    expect(store.target?.authProfileOverrideCompactionCount).toBeUndefined();
    expect(store.untouched).toEqual(untouchedBefore);
  });

  it("defaults to reset all overrides when no flags are passed", async () => {
    const storePath = writeStore("main", {
      target: {
        sessionId: "s-target",
        updatedAt: 1,
        providerOverride: "openai",
        modelOverride: "gpt-5",
        authProfileOverride: "work",
        authProfileOverrideSource: "user",
      },
      untouched: {
        sessionId: "s-other",
        updatedAt: 2,
        providerOverride: "anthropic",
      },
    });
    const untouchedBefore = loadSessionStore(storePath).untouched;

    const { runtime, logs } = makeRuntime();
    await sessionsResetCommand(
      {
        key: "target",
        agent: "main",
        json: true,
      },
      runtime,
    );

    const payload = JSON.parse(logs[0] ?? "{}") as {
      ok: boolean;
      changed: boolean;
      cleared?: { model?: boolean; auth?: boolean };
    };
    expect(payload.ok).toBe(true);
    expect(payload.changed).toBe(true);
    expect(payload.cleared?.model).toBe(true);
    expect(payload.cleared?.auth).toBe(true);

    const store = loadSessionStore(storePath);
    expect(store.target?.providerOverride).toBeUndefined();
    expect(store.target?.modelOverride).toBeUndefined();
    expect(store.target?.authProfileOverride).toBeUndefined();
    expect(store.untouched).toEqual(untouchedBefore);
  });

  it("exits non-zero when session key does not exist", async () => {
    writeStore("main", {
      existing: {
        sessionId: "s-existing",
        updatedAt: 1,
      },
    });
    const { runtime, errors } = makeRuntime();

    await expect(
      sessionsResetCommand(
        {
          key: "missing",
          agent: "main",
        },
        runtime,
      ),
    ).rejects.toThrow("exit 1");
    expect(errors[0]).toContain("Session not found");
  });
});
