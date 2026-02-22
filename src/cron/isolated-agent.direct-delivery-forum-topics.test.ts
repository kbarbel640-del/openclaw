import "./isolated-agent.mocks.js";
import fs from "node:fs/promises";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { runEmbeddedPiAgent } from "../agents/pi-embedded.js";
import { runSubagentAnnounceFlow } from "../agents/subagent-announce.js";
import type { CliDeps } from "../cli/deps.js";
import { runCronIsolatedAgentTurn } from "./isolated-agent.js";
import {
  makeCfg,
  makeJob,
  withTempCronHome,
  writeSessionStore,
} from "./isolated-agent.test-harness.js";
import { setupIsolatedAgentTurnMocks } from "./isolated-agent.test-setup.js";

function createCliDeps(overrides: Partial<CliDeps> = {}): CliDeps {
  return {
    sendMessageSlack: vi.fn(),
    sendMessageWhatsApp: vi.fn(),
    sendMessageTelegram: vi.fn(),
    sendMessageDiscord: vi.fn(),
    sendMessageSignal: vi.fn(),
    sendMessageIMessage: vi.fn(),
    ...overrides,
  };
}

function mockAgentPayloads(
  payloads: Array<Record<string, unknown>>,
  extra: Partial<Awaited<ReturnType<typeof runEmbeddedPiAgent>>> = {},
): void {
  vi.mocked(runEmbeddedPiAgent).mockResolvedValue({
    payloads,
    meta: {
      durationMs: 5,
      agentMeta: { sessionId: "s", provider: "p", model: "m" },
    },
    ...extra,
  });
}

describe("runCronIsolatedAgentTurn – forum topic direct delivery", () => {
  beforeEach(() => {
    setupIsolatedAgentTurnMocks();
  });

  it("uses direct delivery instead of announce flow when target has threadId (forum topic)", async () => {
    await withTempCronHome(async (home) => {
      const storePath = await writeSessionStore(home, { lastProvider: "webchat", lastTo: "" });
      await fs.writeFile(
        storePath,
        JSON.stringify(
          {
            "agent:main:main": {
              sessionId: "main-session",
              updatedAt: Date.now(),
              lastChannel: "telegram",
              lastTo: "-1003885638534",
              lastThreadId: 562,
            },
          },
          null,
          2,
        ),
        "utf-8",
      );
      const deps = createCliDeps();
      mockAgentPayloads([{ text: "Agent status: RUNNING, 3 commits" }]);

      const res = await runCronIsolatedAgentTurn({
        cfg: makeCfg(home, storePath, {
          channels: { telegram: { botToken: "t-1" } },
        }),
        deps,
        job: {
          ...makeJob({ kind: "agentTurn", message: "check agent status" }),
          delivery: {
            mode: "announce",
            channel: "telegram",
            to: "-1003885638534:topic:562",
          },
        },
        message: "check agent status",
        sessionKey: "cron:forum-topic-test",
        lane: "cron",
      });

      expect(res.status).toBe("ok");
      // Direct delivery should be used — NOT the announce flow
      expect(runSubagentAnnounceFlow).not.toHaveBeenCalled();
      // The telegram send function should have been called with the correct threadId
      expect(deps.sendMessageTelegram).toHaveBeenCalledTimes(1);
      const tgCall = vi.mocked(deps.sendMessageTelegram).mock.calls[0];
      expect(tgCall?.[0]).toBe("-1003885638534"); // chatId
      expect(tgCall?.[1]).toContain("Agent status"); // text
      expect(tgCall?.[2]).toMatchObject({ messageThreadId: 562 }); // options with threadId
    });
  });

  it("still uses announce flow for targets without threadId", async () => {
    await withTempCronHome(async (home) => {
      const storePath = await writeSessionStore(home, { lastProvider: "webchat", lastTo: "" });
      const deps = createCliDeps();
      mockAgentPayloads([{ text: "hello from cron" }]);

      const res = await runCronIsolatedAgentTurn({
        cfg: makeCfg(home, storePath, {
          channels: { telegram: { botToken: "t-1" } },
        }),
        deps,
        job: {
          ...makeJob({ kind: "agentTurn", message: "do it" }),
          delivery: {
            mode: "announce",
            channel: "telegram",
            to: "123",
          },
        },
        message: "do it",
        sessionKey: "cron:no-thread-test",
        lane: "cron",
      });

      expect(res.status).toBe("ok");
      // Without threadId, announce flow should still be used
      expect(runSubagentAnnounceFlow).toHaveBeenCalledTimes(1);
      expect(deps.sendMessageTelegram).not.toHaveBeenCalled();
    });
  });
});
