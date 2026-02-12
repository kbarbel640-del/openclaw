import type { AgentTool } from "@mariozechner/pi-agent-core";
import { describe, expect, it, vi } from "vitest";
const logger = vi.hoisted(() => ({
  logDebug: vi.fn(),
  logError: vi.fn(),
}));
vi.mock("../logger.js", () => logger);
import { toToolDefinitions } from "./pi-tool-definition-adapter.js";

describe("pi tool definition adapter", () => {
  it("logs exec failures with command context for tracing", async () => {
    logger.logError.mockReset();
    const tool = {
      name: "bash",
      label: "Bash",
      description: "throws",
      parameters: {},
      execute: async () => {
        throw new Error("Command exited with code 1");
      },
    } satisfies AgentTool<unknown, unknown>;

    const defs = toToolDefinitions([tool]);
    await defs[0].execute(
      "call-context",
      {
        command: "ls -la /tmp",
        workdir: "/app",
        timeout: 60,
        pty: true,
        env: { FOO: "bar" },
      },
      undefined,
      undefined,
    );

    expect(logger.logError).toHaveBeenCalledWith(
      expect.stringContaining(
        '[tools] exec failed: Command exited with code 1 (command="ls -la /tmp"',
      ),
    );
    expect(logger.logError).toHaveBeenCalledWith(expect.stringContaining('workdir="/app"'));
    expect(logger.logError).toHaveBeenCalledWith(expect.stringContaining("timeout=60"));
    expect(logger.logError).toHaveBeenCalledWith(expect.stringContaining("pty=true"));
    expect(logger.logError).toHaveBeenCalledWith(expect.stringContaining("envKeys=FOO"));
  });

  it("logs exec failures with cmd/args aliases for tracing", async () => {
    logger.logError.mockReset();
    const tool = {
      name: "exec",
      label: "Exec",
      description: "throws",
      parameters: {},
      execute: async () => {
        throw new Error("Command exited with code 1");
      },
    } satisfies AgentTool<unknown, unknown>;

    const defs = toToolDefinitions([tool]);
    await defs[0].execute(
      "call-context-cmd",
      {
        cmd: "echo hi",
        args: ["--foo", "bar"],
      },
      undefined,
      undefined,
    );

    expect(logger.logError).toHaveBeenCalledWith(expect.stringContaining('command="echo hi"'));
    expect(logger.logError).toHaveBeenCalledWith(expect.stringContaining('args="--foo bar"'));
  });

  it("wraps tool errors into a tool result", async () => {
    const tool = {
      name: "boom",
      label: "Boom",
      description: "throws",
      parameters: {},
      execute: async () => {
        throw new Error("nope");
      },
    } satisfies AgentTool<unknown, unknown>;

    const defs = toToolDefinitions([tool]);
    const result = await defs[0].execute("call1", {}, undefined, undefined);

    expect(result.details).toMatchObject({
      status: "error",
      tool: "boom",
    });
    expect(result.details).toMatchObject({ error: "nope" });
    expect(JSON.stringify(result.details)).not.toContain("\n    at ");
  });

  it("normalizes exec tool aliases in error results", async () => {
    const tool = {
      name: "bash",
      label: "Bash",
      description: "throws",
      parameters: {},
      execute: async () => {
        throw new Error("nope");
      },
    } satisfies AgentTool<unknown, unknown>;

    const defs = toToolDefinitions([tool]);
    const result = await defs[0].execute("call2", {}, undefined, undefined);

    expect(result.details).toMatchObject({
      status: "error",
      tool: "exec",
      error: "nope",
    });
  });
});
