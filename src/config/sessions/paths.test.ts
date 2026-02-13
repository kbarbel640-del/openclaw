import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  resolveSessionFilePath,
  resolveSessionTranscriptPath,
  resolveSessionTranscriptPathInDir,
  resolveStorePath,
  validateSessionId,
} from "./paths.js";

describe("resolveStorePath", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("uses OPENCLAW_HOME for tilde expansion", () => {
    vi.stubEnv("OPENCLAW_HOME", "/srv/openclaw-home");
    vi.stubEnv("HOME", "/home/other");

    const resolved = resolveStorePath("~/.openclaw/agents/{agentId}/sessions/sessions.json", {
      agentId: "research",
    });

    expect(resolved).toBe(
      path.resolve("/srv/openclaw-home/.openclaw/agents/research/sessions/sessions.json"),
    );
  });
});

describe("session path safety", () => {
  it("validates safe session IDs", () => {
    expect(validateSessionId("sess-1")).toBe("sess-1");
    expect(validateSessionId("ABC_123.hello")).toBe("ABC_123.hello");
  });

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

  it("rejects unsafe sessionFile candidates that escape the sessions dir", () => {
    const sessionsDir = "/tmp/openclaw/agents/main/sessions";

    expect(() =>
      resolveSessionFilePath("sess-1", { sessionFile: "../../etc/passwd" }, { sessionsDir }),
    ).toThrow(/within sessions directory/);

    // Absolute paths outside the sessions dir fall back to basename resolution
    // rather than throwing, since initSessionState stores absolute paths.
    const resolved = resolveSessionFilePath(
      "sess-1",
      { sessionFile: "/etc/passwd" },
      { sessionsDir },
    );
    expect(resolved).toBe(path.resolve(sessionsDir, "passwd"));
  });

  it("accepts sessionFile candidates within the sessions dir", () => {
    const sessionsDir = "/tmp/openclaw/agents/main/sessions";

    const resolved = resolveSessionFilePath(
      "sess-1",
      { sessionFile: "subdir/threaded-session.jsonl" },
      { sessionsDir },
    );

    expect(resolved).toBe(path.resolve(sessionsDir, "subdir/threaded-session.jsonl"));
  });

  it("accepts absolute sessionFile paths that are within the sessions dir (#15152)", () => {
    const sessionsDir = "/tmp/openclaw/agents/default/sessions";
    const absoluteSessionFile = path.join(sessionsDir, "abc123.jsonl");

    // initSessionState stores absolute paths in sessionEntry.sessionFile;
    // resolveSessionFilePath must accept them when they're inside the sessions dir.
    const resolved = resolveSessionFilePath(
      "sess-1",
      { sessionFile: absoluteSessionFile },
      { sessionsDir },
    );

    expect(resolved).toBe(absoluteSessionFile);
  });

  it("accepts absolute sessionFile in a subdirectory of the sessions dir (#15152)", () => {
    const sessionsDir = "/tmp/openclaw/agents/default/sessions";
    const absoluteSessionFile = path.join(sessionsDir, "sub", "forked.jsonl");

    const resolved = resolveSessionFilePath(
      "sess-1",
      { sessionFile: absoluteSessionFile },
      { sessionsDir },
    );

    expect(resolved).toBe(absoluteSessionFile);
  });

  it("accepts absolute sessionFile when no opts are passed (#15152)", () => {
    // initSessionState stores absolute paths; callers like get-reply-run.ts
    // call resolveSessionFilePath(id, entry) without opts, so the sessions dir
    // is resolved from the default agent. The stored absolute path must still
    // be accepted as long as it doesn't escape the resolved sessions dir.
    const resolved = resolveSessionFilePath("sess-1", {
      sessionFile: resolveSessionTranscriptPath("sess-1"),
    });

    expect(resolved).toBe(resolveSessionTranscriptPath("sess-1"));
  });

  it("accepts absolute sessionFile when sessionsDir differs from stored path (#15152)", () => {
    // When session.store is configured to a custom path, the sessionsDir at
    // read time (path.dirname(storePath)) differs from the agent sessions dir
    // used at write time. The absolute path falls back to basename resolution.
    const agentSessionsDir = "/home/user/.openclaw/agents/main/sessions";
    const customStoreDir = "/data/openclaw/sessions";
    const storedAbsolutePath = path.join(agentSessionsDir, "sess-1.jsonl");

    const resolved = resolveSessionFilePath(
      "sess-1",
      { sessionFile: storedAbsolutePath },
      { sessionsDir: customStoreDir },
    );

    // Falls back to basename within the current sessionsDir
    expect(resolved).toBe(path.resolve(customStoreDir, "sess-1.jsonl"));
  });

  it("rejects absolute sessionFile paths outside the sessions dir", () => {
    const sessionsDir = "/tmp/openclaw/agents/default/sessions";

    // /etc/passwd basename is "passwd", resolved within sessionsDir
    const resolved = resolveSessionFilePath(
      "sess-1",
      { sessionFile: "/etc/passwd" },
      { sessionsDir },
    );
    expect(resolved).toBe(path.resolve(sessionsDir, "passwd"));
  });

  it("rejects absolute sessionFile that escapes via different agent dir (#15152)", () => {
    const sessionsDir = "/tmp/openclaw/agents/default/sessions";
    // A path under a sibling agent dir falls back to basename
    const resolved = resolveSessionFilePath(
      "sess-1",
      { sessionFile: "/tmp/openclaw/agents/research/sessions/abc.jsonl" },
      { sessionsDir },
    );
    expect(resolved).toBe(path.resolve(sessionsDir, "abc.jsonl"));
  });

  it("uses agent sessions dir fallback for transcript path", () => {
    const resolved = resolveSessionTranscriptPath("sess-1", "main");
    expect(resolved.endsWith(path.join("agents", "main", "sessions", "sess-1.jsonl"))).toBe(true);
  });
});
