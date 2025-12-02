import { describe, expect, it, vi } from "vitest";
import type { WarelayConfig } from "../config/config.js";
import type { SpawnResult } from "../process/exec.js";
import {
  buildHeartbeatPrompt,
  runHeartbeatPreHook,
} from "./heartbeat-prehook.js";

describe("buildHeartbeatPrompt", () => {
  it("returns base prompt when no context", () => {
    expect(buildHeartbeatPrompt("HEARTBEAT ultrathink")).toBe(
      "HEARTBEAT ultrathink",
    );
    expect(buildHeartbeatPrompt("HEARTBEAT ultrathink", "")).toBe(
      "HEARTBEAT ultrathink",
    );
    expect(buildHeartbeatPrompt("HEARTBEAT ultrathink", "   ")).toBe(
      "HEARTBEAT ultrathink",
    );
  });

  it("appends context when provided", () => {
    const result = buildHeartbeatPrompt(
      "HEARTBEAT ultrathink",
      "You have 3 unread emails",
    );
    expect(result).toBe(
      "HEARTBEAT ultrathink\n\n---\nContext from pre-hook:\nYou have 3 unread emails",
    );
  });

  it("trims context whitespace", () => {
    const result = buildHeartbeatPrompt("HEARTBEAT", "  context with spaces  ");
    expect(result).toContain("context with spaces");
    expect(result).not.toContain("  context");
  });
});

describe("runHeartbeatPreHook", () => {
  it("returns empty result when no pre-hook configured", async () => {
    const cfg: WarelayConfig = {};
    const result = await runHeartbeatPreHook(cfg);
    expect(result.durationMs).toBe(0);
    expect(result.context).toBeUndefined();
    expect(result.error).toBeUndefined();
  });

  it("returns empty result when pre-hook is empty array", async () => {
    const cfg: WarelayConfig = {
      inbound: {
        reply: {
          mode: "command",
          command: ["echo"],
          session: {
            heartbeatPreHook: [],
          },
        },
      },
    };
    const result = await runHeartbeatPreHook(cfg);
    expect(result.durationMs).toBe(0);
    expect(result.context).toBeUndefined();
  });

  it("returns stdout as context on success", async () => {
    const cfg: WarelayConfig = {
      inbound: {
        reply: {
          mode: "command",
          command: ["echo"],
          session: {
            heartbeatPreHook: ["echo", "email summary"],
          },
        },
      },
    };
    const mockRunner = vi.fn().mockResolvedValue({
      stdout: "email summary\n",
      stderr: "",
      code: 0,
      signal: null,
      killed: false,
    } satisfies SpawnResult);

    const result = await runHeartbeatPreHook(cfg, mockRunner);
    expect(result.context).toBe("email summary");
    expect(result.error).toBeUndefined();
    expect(mockRunner).toHaveBeenCalledWith(["echo", "email summary"], {
      timeoutMs: 30000,
    });
  });

  it("returns error on non-zero exit", async () => {
    const cfg: WarelayConfig = {
      inbound: {
        reply: {
          mode: "command",
          command: ["echo"],
          session: {
            heartbeatPreHook: ["failing-script"],
          },
        },
      },
    };
    const mockRunner = vi.fn().mockResolvedValue({
      stdout: "",
      stderr: "error output",
      code: 1,
      signal: null,
      killed: false,
    } satisfies SpawnResult);

    const result = await runHeartbeatPreHook(cfg, mockRunner);
    expect(result.context).toBeUndefined();
    expect(result.error).toContain("exited with code 1");
  });

  it("handles timeout gracefully", async () => {
    const cfg: WarelayConfig = {
      inbound: {
        reply: {
          mode: "command",
          command: ["echo"],
          session: {
            heartbeatPreHook: ["slow-script"],
            heartbeatPreHookTimeoutSeconds: 5,
          },
        },
      },
    };
    const mockRunner = vi.fn().mockResolvedValue({
      stdout: "",
      stderr: "",
      code: null,
      signal: "SIGKILL",
      killed: true,
    } satisfies SpawnResult);

    const result = await runHeartbeatPreHook(cfg, mockRunner);
    expect(result.timedOut).toBe(true);
    expect(result.error).toContain("timed out");
    expect(result.context).toBeUndefined();
  });

  it("uses custom timeout from config", async () => {
    const cfg: WarelayConfig = {
      inbound: {
        reply: {
          mode: "command",
          command: ["echo"],
          session: {
            heartbeatPreHook: ["script"],
            heartbeatPreHookTimeoutSeconds: 60,
          },
        },
      },
    };
    const mockRunner = vi.fn().mockResolvedValue({
      stdout: "ok",
      stderr: "",
      code: 0,
      signal: null,
      killed: false,
    } satisfies SpawnResult);

    await runHeartbeatPreHook(cfg, mockRunner);
    expect(mockRunner).toHaveBeenCalledWith(["script"], { timeoutMs: 60000 });
  });

  it("returns empty context for whitespace-only stdout", async () => {
    const cfg: WarelayConfig = {
      inbound: {
        reply: {
          mode: "command",
          command: ["echo"],
          session: {
            heartbeatPreHook: ["script"],
          },
        },
      },
    };
    const mockRunner = vi.fn().mockResolvedValue({
      stdout: "   \n\n   ",
      stderr: "",
      code: 0,
      signal: null,
      killed: false,
    } satisfies SpawnResult);

    const result = await runHeartbeatPreHook(cfg, mockRunner);
    expect(result.context).toBeUndefined();
    expect(result.error).toBeUndefined();
  });

  it("handles thrown error from command runner", async () => {
    const cfg: WarelayConfig = {
      inbound: {
        reply: {
          mode: "command",
          command: ["echo"],
          session: {
            heartbeatPreHook: ["script"],
          },
        },
      },
    };
    const mockRunner = vi.fn().mockRejectedValue(new Error("spawn ENOENT"));

    const result = await runHeartbeatPreHook(cfg, mockRunner);
    expect(result.error).toBe("spawn ENOENT");
    expect(result.context).toBeUndefined();
  });

  it("handles thrown timeout error (killed property)", async () => {
    const cfg: WarelayConfig = {
      inbound: {
        reply: {
          mode: "command",
          command: ["echo"],
          session: {
            heartbeatPreHook: ["script"],
          },
        },
      },
    };
    const timeoutError = new Error("Command timed out");
    (timeoutError as unknown as { killed: boolean }).killed = true;
    const mockRunner = vi.fn().mockRejectedValue(timeoutError);

    const result = await runHeartbeatPreHook(cfg, mockRunner);
    expect(result.timedOut).toBe(true);
    expect(result.error).toContain("timed out");
  });

  it("caps large stdout to max size", async () => {
    const cfg: WarelayConfig = {
      inbound: {
        reply: {
          mode: "command",
          command: ["echo"],
          session: {
            heartbeatPreHook: ["script"],
          },
        },
      },
    };
    const largeOutput = "x".repeat(10000);
    const mockRunner = vi.fn().mockResolvedValue({
      stdout: largeOutput,
      stderr: "",
      code: 0,
      signal: null,
      killed: false,
    } satisfies SpawnResult);

    const result = await runHeartbeatPreHook(cfg, mockRunner);
    expect(result.context).toBeDefined();
    expect(result.context?.length).toBeLessThan(largeOutput.length);
    expect(result.context).toContain("...[truncated]");
  });
});
