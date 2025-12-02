import { beforeEach, describe, expect, it, type Mock, vi } from "vitest";

import { HEARTBEAT_PROMPT, HEARTBEAT_TOKEN } from "../web/auto-reply.js";
import { runTwilioHeartbeatOnce } from "./heartbeat.js";

vi.mock("./send.js", () => ({
  sendMessage: vi.fn(),
}));

vi.mock("../auto-reply/reply.js", () => ({
  getReplyFromConfig: vi.fn(),
}));

vi.mock("../auto-reply/heartbeat-prehook.js", () => ({
  runHeartbeatPreHook: vi.fn(),
  buildHeartbeatPrompt: vi.fn((base: string, ctx?: string) =>
    ctx ? `${base}\n\n---\nContext from pre-hook:\n${ctx}` : base,
  ),
}));

vi.mock("../config/config.js", () => ({
  loadConfig: vi.fn(() => ({})),
}));

// eslint-disable-next-line import/first
import { runHeartbeatPreHook } from "../auto-reply/heartbeat-prehook.js";
// eslint-disable-next-line import/first
import { getReplyFromConfig } from "../auto-reply/reply.js";
// eslint-disable-next-line import/first
import { sendMessage } from "./send.js";

const sendMessageMock = sendMessage as unknown as Mock;
const replyResolverMock = getReplyFromConfig as unknown as Mock;
const runHeartbeatPreHookMock = runHeartbeatPreHook as unknown as Mock;

describe("runTwilioHeartbeatOnce", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    runHeartbeatPreHookMock.mockResolvedValue({ durationMs: 0 });
  });

  it("sends manual override body and skips resolver", async () => {
    sendMessageMock.mockResolvedValue({});
    await runTwilioHeartbeatOnce({
      to: "+1555",
      overrideBody: "hello manual",
    });
    expect(sendMessage).toHaveBeenCalledWith(
      "+1555",
      "hello manual",
      undefined,
      expect.anything(),
    );
    expect(replyResolverMock).not.toHaveBeenCalled();
  });

  it("dry-run manual message avoids sending", async () => {
    sendMessageMock.mockReset();
    await runTwilioHeartbeatOnce({
      to: "+1555",
      overrideBody: "hello manual",
      dryRun: true,
    });
    expect(sendMessage).not.toHaveBeenCalled();
    expect(replyResolverMock).not.toHaveBeenCalled();
  });

  it("skips send when resolver returns heartbeat token", async () => {
    replyResolverMock.mockResolvedValue({
      text: HEARTBEAT_TOKEN,
    });
    sendMessageMock.mockReset();
    await runTwilioHeartbeatOnce({
      to: "+1555",
    });
    expect(sendMessage).not.toHaveBeenCalled();
  });

  it("sends resolved heartbeat text when present", async () => {
    replyResolverMock.mockResolvedValue({
      text: "ALERT!",
    });
    sendMessageMock.mockReset().mockResolvedValue({});
    await runTwilioHeartbeatOnce({
      to: "+1555",
    });
    expect(sendMessage).toHaveBeenCalledWith(
      "+1555",
      "ALERT!",
      undefined,
      expect.anything(),
    );
  });

  describe("pre-hook integration", () => {
    it("runs pre-hook and includes context in prompt", async () => {
      runHeartbeatPreHookMock.mockResolvedValue({
        context: "You have 3 unread emails",
        durationMs: 100,
      });
      replyResolverMock.mockResolvedValue({ text: "ALERT!" });
      sendMessageMock.mockResolvedValue({});

      await runTwilioHeartbeatOnce({ to: "+1555" });

      expect(runHeartbeatPreHookMock).toHaveBeenCalled();
      expect(replyResolverMock).toHaveBeenCalledWith(
        expect.objectContaining({
          Body: expect.stringContaining("Context from pre-hook"),
        }),
        undefined,
      );
    });

    it("skips pre-hook when skipPreHook is true", async () => {
      replyResolverMock.mockResolvedValue({ text: "ALERT!" });
      sendMessageMock.mockResolvedValue({});

      await runTwilioHeartbeatOnce({ to: "+1555", skipPreHook: true });

      expect(runHeartbeatPreHookMock).not.toHaveBeenCalled();
      expect(replyResolverMock).toHaveBeenCalledWith(
        expect.objectContaining({
          Body: HEARTBEAT_PROMPT,
        }),
        undefined,
      );
    });

    it("continues with basic heartbeat on pre-hook failure", async () => {
      runHeartbeatPreHookMock.mockResolvedValue({
        error: "Pre-hook failed",
        durationMs: 50,
      });
      replyResolverMock.mockResolvedValue({ text: "ALERT!" });
      sendMessageMock.mockResolvedValue({});

      await runTwilioHeartbeatOnce({ to: "+1555" });

      expect(replyResolverMock).toHaveBeenCalledWith(
        expect.objectContaining({
          Body: HEARTBEAT_PROMPT,
        }),
        undefined,
      );
      expect(sendMessage).toHaveBeenCalled();
    });

    it("uses injected config to avoid loading real config in tests", async () => {
      const testConfig = {
        inbound: {
          reply: {
            mode: "command" as const,
            command: ["echo"],
            session: {
              heartbeatPreHook: ["test-script"],
            },
          },
        },
      };
      runHeartbeatPreHookMock.mockResolvedValue({ durationMs: 0 });
      replyResolverMock.mockResolvedValue({ text: "OK" });
      sendMessageMock.mockResolvedValue({});

      await runTwilioHeartbeatOnce({ to: "+1555", cfg: testConfig });

      expect(runHeartbeatPreHookMock).toHaveBeenCalledWith(testConfig);
    });
  });
});
