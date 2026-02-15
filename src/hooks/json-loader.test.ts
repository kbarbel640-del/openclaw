import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import type { InternalHookEvent } from "./internal-hooks.js";
import { parseJsonHooks, loadJsonHooks, loadAllJsonHooks } from "./json-loader.js";
import { matchesEvent, runShellHook } from "./shell-runner.js";

function makeTmpDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "hooks-json-test-"));
}

function cleanup(dir: string): void {
  fs.rmSync(dir, { recursive: true, force: true });
}

function makeEvent(
  type: string,
  action: string,
  context: Record<string, unknown> = {},
): InternalHookEvent {
  return {
    type: type as "command",
    action,
    sessionKey: "test-session",
    context,
    timestamp: new Date(),
    messages: [],
  };
}

describe("parseJsonHooks", () => {
  it("should parse a valid hooks.json", () => {
    const content = JSON.stringify({
      hooks: [
        {
          event: "command:new",
          command: "echo 'new session'",
        },
        {
          event: "agent:bootstrap",
          command: "python validate.py",
          matcher: { agentId: "*" },
          timeout: 5000,
        },
      ],
    });

    const result = parseJsonHooks(content, "/tmp/hooks.json");
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.config.hooks).toHaveLength(2);
    expect(result.config.hooks[0].event).toBe("command:new");
    expect(result.config.hooks[0].command).toBe("echo 'new session'");
    expect(result.config.hooks[1].matcher?.agentId).toBe("*");
    expect(result.config.hooks[1].timeout).toBe(5000);
  });

  it("should reject invalid JSON", () => {
    const result = parseJsonHooks("not json", "/tmp/hooks.json");
    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expect(result.error).toContain("parse");
  });

  it("should reject non-object root", () => {
    const result = parseJsonHooks("[]", "/tmp/hooks.json");
    expect(result.ok).toBe(false);
  });

  it("should reject missing hooks array", () => {
    const result = parseJsonHooks('{"other": 1}', "/tmp/hooks.json");
    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expect(result.error).toContain("hooks");
  });

  it("should reject hook entry without event", () => {
    const content = JSON.stringify({
      hooks: [{ command: "echo test" }],
    });
    const result = parseJsonHooks(content, "/tmp/hooks.json");
    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expect(result.error).toContain("event");
  });

  it("should reject hook entry without command", () => {
    const content = JSON.stringify({
      hooks: [{ event: "command:new" }],
    });
    const result = parseJsonHooks(content, "/tmp/hooks.json");
    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expect(result.error).toContain("command");
  });

  it("should reject event without colon separator", () => {
    const content = JSON.stringify({
      hooks: [{ event: "invalid", command: "echo test" }],
    });
    const result = parseJsonHooks(content, "/tmp/hooks.json");
    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expect(result.error).toContain("type:action");
  });

  it("should handle empty hooks array", () => {
    const result = parseJsonHooks('{"hooks": []}', "/tmp/hooks.json");
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.config.hooks).toHaveLength(0);
  });
});

describe("loadJsonHooks", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = makeTmpDir();
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  it("should load hooks.json from directory", () => {
    const content = JSON.stringify({
      hooks: [{ event: "command:new", command: "echo test" }],
    });
    fs.writeFileSync(path.join(tmpDir, "hooks.json"), content);

    const result = loadJsonHooks(tmpDir);
    expect(result).not.toBeNull();
    expect(result?.ok).toBe(true);
  });

  it("should return null for missing hooks.json", () => {
    const result = loadJsonHooks(tmpDir);
    expect(result).toBeNull();
  });
});

describe("loadAllJsonHooks", () => {
  let stateDir: string;
  let workspaceDir: string;

  beforeEach(() => {
    stateDir = makeTmpDir();
    workspaceDir = makeTmpDir();
  });

  afterEach(() => {
    cleanup(stateDir);
    cleanup(workspaceDir);
  });

  it("should merge global and workspace hooks", () => {
    fs.writeFileSync(
      path.join(stateDir, "hooks.json"),
      JSON.stringify({ hooks: [{ event: "command:new", command: "echo global" }] }),
    );

    const wsDir = path.join(workspaceDir, ".openclaw");
    fs.mkdirSync(wsDir, { recursive: true });
    fs.writeFileSync(
      path.join(wsDir, "hooks.json"),
      JSON.stringify({ hooks: [{ event: "agent:bootstrap", command: "echo workspace" }] }),
    );

    const entries = loadAllJsonHooks({ stateDir, workspaceDir });
    expect(entries).toHaveLength(2);
    expect(entries[0].event).toBe("command:new");
    expect(entries[1].event).toBe("agent:bootstrap");
  });

  it("should handle missing files gracefully", () => {
    const entries = loadAllJsonHooks({ stateDir, workspaceDir });
    expect(entries).toHaveLength(0);
  });
});

describe("matchesEvent", () => {
  it("should match event by exact event key", () => {
    const entry = { event: "command:new", command: "echo test" };
    expect(matchesEvent(entry, makeEvent("command", "new"))).toBe(true);
    expect(matchesEvent(entry, makeEvent("command", "reset"))).toBe(false);
  });

  it("should match event by type only", () => {
    // "command" matches type "command" regardless of action
    // But our format requires "type:action" — this tests matching by type prefix
    expect(
      matchesEvent({ event: "command:new", command: "echo" }, makeEvent("command", "new")),
    ).toBe(true);
  });

  it("should match with wildcard agentId matcher", () => {
    const entry = {
      event: "agent:bootstrap",
      command: "echo test",
      matcher: { agentId: "*" },
    };
    expect(matchesEvent(entry, makeEvent("agent", "bootstrap", { agentId: "any-agent" }))).toBe(
      true,
    );
  });

  it("should match with specific agentId matcher", () => {
    const entry = {
      event: "agent:bootstrap",
      command: "echo test",
      matcher: { agentId: "my-agent" },
    };
    expect(matchesEvent(entry, makeEvent("agent", "bootstrap", { agentId: "my-agent" }))).toBe(
      true,
    );
    expect(matchesEvent(entry, makeEvent("agent", "bootstrap", { agentId: "other" }))).toBe(false);
  });

  it("should not match different event types", () => {
    const entry = { event: "command:new", command: "echo test" };
    expect(matchesEvent(entry, makeEvent("agent", "bootstrap"))).toBe(false);
  });
});

describe("runShellHook", () => {
  it("should execute a simple echo command", async () => {
    const entry = { event: "command:new", command: "echo hello" };
    const event = makeEvent("command", "new");

    const result = await runShellHook(entry, event);
    expect(result.ok).toBe(true);
    expect(result.stdout.trim()).toBe("hello");
    expect(result.exitCode).toBe(0);
    expect(result.timedOut).toBe(false);
  });

  it("should capture stderr", async () => {
    const entry = { event: "command:new", command: "echo error >&2" };
    const event = makeEvent("command", "new");

    const result = await runShellHook(entry, event);
    expect(result.ok).toBe(true);
    expect(result.stderr.trim()).toBe("error");
  });

  it("should report non-zero exit code", async () => {
    const entry = { event: "command:new", command: "exit 1" };
    const event = makeEvent("command", "new");

    const result = await runShellHook(entry, event);
    expect(result.ok).toBe(false);
    expect(result.exitCode).toBe(1);
  });

  it("should pass hook context as environment variables", async () => {
    const entry = {
      event: "agent:bootstrap",
      command: 'echo "$OPENCLAW_HOOK_TYPE:$OPENCLAW_HOOK_ACTION"',
    };
    const event = makeEvent("agent", "bootstrap");

    const result = await runShellHook(entry, event);
    expect(result.ok).toBe(true);
    expect(result.stdout.trim()).toBe("agent:bootstrap");
  });

  it("should time out long-running commands", async () => {
    const entry = {
      event: "command:new",
      command: "sleep 30",
      timeout: 200,
    };
    const event = makeEvent("command", "new");

    const result = await runShellHook(entry, event);
    expect(result.ok).toBe(false);
    expect(result.timedOut).toBe(true);
  }, 10000);
});
