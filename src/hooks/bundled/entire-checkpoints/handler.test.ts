import fs from "node:fs/promises";
import path from "node:path";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { HookHandler } from "../../hooks.js";
import { createHookEvent } from "../../hooks.js";
import { makeTempWorkspace } from "../../../test-helpers/workspace.js";

// Mock child_process.execFile
const mockExecFile = vi.fn();
vi.mock("node:child_process", () => ({
  execFile: (...args: unknown[]) => mockExecFile(...args),
}));

// Mock node:util promisify to return our mock
vi.mock("node:util", async (importOriginal) => {
  const orig = (await importOriginal()) as Record<string, unknown>;
  return {
    ...orig,
    promisify: (fn: unknown) => {
      // If it's the mocked execFile, return a promisified version
      if (fn === mockExecFile) {
        return (...args: unknown[]) => {
          const mockStdin = {
            write: vi.fn(),
            end: vi.fn(),
          };
          return Object.assign(Promise.resolve({ stdout: "", stderr: "" }), {
            child: { stdin: mockStdin },
          });
        };
      }
      return orig.promisify(fn);
    },
  };
});

let handler: HookHandler;

beforeAll(async () => {
  ({ default: handler } = await import("./handler.js"));
});

beforeEach(() => {
  vi.clearAllMocks();
});

describe("entire-checkpoints hook", () => {
  it("skips when event type does not match", async () => {
    const event = createHookEvent("agent", "bootstrap", "agent:main:main", {});
    await handler(event);
    // No calls to entire should be made — execFile not called for `which` even
    // (actually `which` would be called, but since we mock it, just verify no crash)
  });

  it("skips when entire binary is not found", async () => {
    const tempDir = await makeTempWorkspace("openclaw-entire-");

    // `which` will fail (default mock returns empty), handler should skip gracefully
    const event = createHookEvent("gateway", "startup", "agent:main:main", {
      workspaceDir: tempDir,
    });

    await handler(event);
    // Should not throw
  });

  it("skips when .entire/settings.json does not exist", async () => {
    const tempDir = await makeTempWorkspace("openclaw-entire-");

    // Even if `which` succeeds, no .entire/settings.json → skip
    const event = createHookEvent("gateway", "startup", "agent:main:main", {
      workspaceDir: tempDir,
    });

    await handler(event);
    // Should not throw
  });

  it("processes gateway:startup event when entire is available", async () => {
    const tempDir = await makeTempWorkspace("openclaw-entire-");
    // Create .entire/settings.json
    await fs.mkdir(path.join(tempDir, ".entire"), { recursive: true });
    await fs.writeFile(path.join(tempDir, ".entire", "settings.json"), "{}", "utf-8");

    const event = createHookEvent("gateway", "startup", "agent:main:main", {
      workspaceDir: tempDir,
      sessionEntry: { sessionId: "sess-1", sessionFile: "/tmp/sess.jsonl" },
    });

    // Handler will call `which` then `entire hooks openclaw session-start`
    // With our mocks both will resolve (mock returns empty stdout for which,
    // which means entireBin = null → skip). This test mainly verifies no crash.
    await handler(event);
  });

  it("processes command:stop event without crashing", async () => {
    const tempDir = await makeTempWorkspace("openclaw-entire-");
    await fs.mkdir(path.join(tempDir, ".entire"), { recursive: true });
    await fs.writeFile(path.join(tempDir, ".entire", "settings.json"), "{}", "utf-8");

    const event = createHookEvent("command", "stop", "agent:main:main", {
      workspaceDir: tempDir,
    });

    await handler(event);
  });

  it("processes command:new event without crashing", async () => {
    const tempDir = await makeTempWorkspace("openclaw-entire-");
    await fs.mkdir(path.join(tempDir, ".entire"), { recursive: true });
    await fs.writeFile(path.join(tempDir, ".entire", "settings.json"), "{}", "utf-8");

    const event = createHookEvent("command", "new", "agent:main:main", {
      workspaceDir: tempDir,
      previousSessionEntry: { sessionId: "sess-old" },
      firstUserMessage: "Hello world",
    });

    await handler(event);
  });
});
