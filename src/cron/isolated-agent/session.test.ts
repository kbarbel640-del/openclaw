import { describe, expect, it, vi } from "vitest";
import type { OpenClawConfig } from "../../config/config.js";

vi.mock("../../config/sessions.js", () => ({
  loadSessionStore: vi.fn(),
  resolveStorePath: vi.fn().mockReturnValue("/tmp/test-store.json"),
}));

import { loadSessionStore } from "../../config/sessions.js";
import { resolveCronSession } from "./session.js";

const NOW_MS = 1_737_600_000_000;

type SessionStore = ReturnType<typeof loadSessionStore>;
type SessionStoreEntry = SessionStore[string];
type MockSessionStoreEntry = Partial<SessionStoreEntry>;

function resolveWithStoredEntry(params?: {
  sessionKey?: string;
  entry?: MockSessionStoreEntry;
  forceNew?: boolean;
  freshSession?: boolean;
}) {
  const sessionKey = params?.sessionKey ?? "webhook:stable-key";
  const store: SessionStore = params?.entry
    ? ({ [sessionKey]: params.entry as SessionStoreEntry } as SessionStore)
    : {};
  vi.mocked(loadSessionStore).mockReturnValue(store);

  return resolveCronSession({
    cfg: {} as OpenClawConfig,
    sessionKey,
    agentId: "main",
    nowMs: NOW_MS,
    forceNew: params?.forceNew,
    freshSession: params?.freshSession,
  });
}

describe("resolveCronSession", () => {
  it("preserves modelOverride and providerOverride when freshSession is false", () => {
    const result = resolveWithStoredEntry({
      sessionKey: "agent:main:cron:test-job",
      entry: {
        sessionId: "old-session-id",
        updatedAt: 1000,
        modelOverride: "deepseek-v3-4bit-mlx",
        providerOverride: "inferencer",
        thinkingLevel: "high",
        model: "k2p5",
      },
      freshSession: false,
    });

    expect(result.sessionEntry.modelOverride).toBe("deepseek-v3-4bit-mlx");
    expect(result.sessionEntry.providerOverride).toBe("inferencer");
    expect(result.sessionEntry.thinkingLevel).toBe("high");
    expect(result.sessionEntry.model).toBe("k2p5");
  });

  it("ignores existing session entry when freshSession is true (default)", () => {
    const result = resolveWithStoredEntry({
      sessionKey: "agent:main:cron:test-job",
      entry: {
        sessionId: "old-session-id",
        updatedAt: 1000,
        modelOverride: "deepseek-v3-4bit-mlx",
        providerOverride: "inferencer",
        thinkingLevel: "high",
        model: "k2p5",
      },
      // freshSession defaults to true
    });

    expect(result.sessionEntry.modelOverride).toBeUndefined();
    expect(result.sessionEntry.providerOverride).toBeUndefined();
    expect(result.sessionEntry.thinkingLevel).toBeUndefined();
    expect(result.sessionEntry.model).toBeUndefined();
  });

  it("handles missing modelOverride gracefully when reusing session", () => {
    const result = resolveWithStoredEntry({
      sessionKey: "agent:main:cron:test-job",
      entry: {
        sessionId: "old-session-id",
        updatedAt: 1000,
        model: "claude-opus-4-5",
      },
      freshSession: false,
    });

    expect(result.sessionEntry.modelOverride).toBeUndefined();
    expect(result.sessionEntry.providerOverride).toBeUndefined();
    expect(result.sessionEntry.model).toBe("claude-opus-4-5");
  });

  it("handles no existing session entry", () => {
    const result = resolveWithStoredEntry({
      sessionKey: "agent:main:cron:new-job",
    });

    expect(result.sessionEntry.modelOverride).toBeUndefined();
    expect(result.sessionEntry.providerOverride).toBeUndefined();
    expect(result.sessionEntry.model).toBeUndefined();
    expect(result.isNewSession).toBe(true);
  });

  it("forces fresh session when forceNew is true even if freshSession is false", () => {
    const result = resolveWithStoredEntry({
      entry: {
        sessionId: "existing-session-id-456",
        updatedAt: NOW_MS - 1000,
        systemSent: true,
        modelOverride: "sonnet-4",
        providerOverride: "anthropic",
      },
      forceNew: true,
      freshSession: false,
    });

    // forceNew overrides freshSession: false
    expect(result.sessionEntry.modelOverride).toBeUndefined();
    expect(result.sessionEntry.providerOverride).toBeUndefined();
    expect(result.isNewSession).toBe(true);
  });

  it("always generates a new sessionId", () => {
    const result = resolveWithStoredEntry({
      entry: {
        sessionId: "old-session-id",
        updatedAt: NOW_MS - 1000,
      },
      freshSession: false,
    });

    expect(result.sessionEntry.sessionId).not.toBe("old-session-id");
    expect(result.isNewSession).toBe(true);
  });
});
