import { beforeEach, describe, expect, it, vi } from "vitest";

const runCommandWithTimeoutMock = vi.hoisted(() => vi.fn());
const loadConfigMock = vi.hoisted(() => vi.fn());
const dispatchReplyWithBufferedBlockDispatcherMock = vi.hoisted(() => vi.fn());

vi.mock("../../process/exec.js", () => ({
  runCommandWithTimeout: (...args: unknown[]) => runCommandWithTimeoutMock(...args),
}));

vi.mock("../../config/config.js", async (importOriginal) => {
  const original = await importOriginal<typeof import("../../config/config.js")>();
  return {
    ...original,
    loadConfig: (...args: unknown[]) => loadConfigMock(...args),
  };
});

vi.mock("../../auto-reply/reply/provider-dispatcher.js", () => ({
  dispatchReplyWithBufferedBlockDispatcher: (...args: unknown[]) =>
    dispatchReplyWithBufferedBlockDispatcherMock(...args),
}));

import { createPluginRuntime } from "./index.js";

describe("plugin runtime command execution", () => {
  beforeEach(() => {
    runCommandWithTimeoutMock.mockClear();
  });

  it("exposes runtime.system.runCommandWithTimeout by default", async () => {
    const commandResult = {
      stdout: "hello\n",
      stderr: "",
      code: 0,
      signal: null,
      killed: false,
      termination: "exit" as const,
    };
    runCommandWithTimeoutMock.mockResolvedValue(commandResult);

    const runtime = createPluginRuntime();
    await expect(
      runtime.system.runCommandWithTimeout(["echo", "hello"], { timeoutMs: 1000 }),
    ).resolves.toEqual(commandResult);
    expect(runCommandWithTimeoutMock).toHaveBeenCalledWith(["echo", "hello"], { timeoutMs: 1000 });
  });

  it("forwards runtime.system.runCommandWithTimeout errors", async () => {
    runCommandWithTimeoutMock.mockRejectedValue(new Error("boom"));
    const runtime = createPluginRuntime();
    await expect(
      runtime.system.runCommandWithTimeout(["echo", "hello"], { timeoutMs: 1000 }),
    ).rejects.toThrow("boom");
    expect(runCommandWithTimeoutMock).toHaveBeenCalledWith(["echo", "hello"], { timeoutMs: 1000 });
  });
});

describe("plugin runtime reply dispatch", () => {
  type DispatchParams = Parameters<
    ReturnType<
      typeof createPluginRuntime
    >["channel"]["reply"]["dispatchReplyWithBufferedBlockDispatcher"]
  >[0];

  beforeEach(() => {
    loadConfigMock.mockReset();
    dispatchReplyWithBufferedBlockDispatcherMock.mockReset();
  });

  it("loads on-disk config when cfg is empty", async () => {
    const loadedConfig = {
      agents: { defaults: { model: { primary: "bailian/glm-5" } } },
      models: { providers: { bailian: { apiKey: "sk-test" } } },
    };
    loadConfigMock.mockReturnValue(loadedConfig);
    dispatchReplyWithBufferedBlockDispatcherMock.mockResolvedValue({
      queuedFinal: false,
      counts: { tool: 0, block: 0, final: 0 },
    });

    const runtime = createPluginRuntime();
    await runtime.channel.reply.dispatchReplyWithBufferedBlockDispatcher({
      ctx: {} as unknown as DispatchParams["ctx"],
      cfg: {},
      dispatcherOptions: {
        deliver: async () => undefined,
      } as unknown as DispatchParams["dispatcherOptions"],
    });

    expect(loadConfigMock).toHaveBeenCalledTimes(1);
    expect(dispatchReplyWithBufferedBlockDispatcherMock).toHaveBeenCalledTimes(1);
    expect(dispatchReplyWithBufferedBlockDispatcherMock).toHaveBeenCalledWith(
      expect.objectContaining({ cfg: loadedConfig }),
    );
  });

  it("does not load config when cfg is non-empty", async () => {
    const cfg = { agents: { defaults: { model: { primary: "openai/gpt-4.1" } } } };
    dispatchReplyWithBufferedBlockDispatcherMock.mockResolvedValue({
      queuedFinal: false,
      counts: { tool: 0, block: 0, final: 0 },
    });

    const runtime = createPluginRuntime();
    await runtime.channel.reply.dispatchReplyWithBufferedBlockDispatcher({
      ctx: {} as unknown as DispatchParams["ctx"],
      cfg,
      dispatcherOptions: {
        deliver: async () => undefined,
      } as unknown as DispatchParams["dispatcherOptions"],
    });

    expect(loadConfigMock).not.toHaveBeenCalled();
    expect(dispatchReplyWithBufferedBlockDispatcherMock).toHaveBeenCalledWith(
      expect.objectContaining({ cfg }),
    );
  });
});
