/**
 * Regression test for #14646: Isolated session + delivery announce not sending
 * messages to Telegram when delivery.to is empty but the main session has a
 * valid Telegram lastChannel / lastTo.
 */
import fs from "node:fs/promises";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CliDeps } from "../cli/deps.js";
import type { OpenClawConfig } from "../config/config.js";
import type { CronJob } from "./types.js";
import { withTempHome as withTempHomeBase } from "../../test/helpers/temp-home.js";
import { telegramOutbound } from "../channels/plugins/outbound/telegram.js";
import { setActivePluginRegistry } from "../plugins/runtime.js";
import { createOutboundTestPlugin, createTestRegistry } from "../test-utils/channel-plugins.js";

vi.mock("../agents/pi-embedded.js", () => ({
  abortEmbeddedPiRun: vi.fn().mockReturnValue(false),
  runEmbeddedPiAgent: vi.fn(),
  resolveEmbeddedSessionLane: (key: string) => `session:${key.trim() || "main"}`,
}));
vi.mock("../agents/model-catalog.js", () => ({
  loadModelCatalog: vi.fn(),
}));
vi.mock("../agents/subagent-announce.js", () => ({
  runSubagentAnnounceFlow: vi.fn(),
}));

import { loadModelCatalog } from "../agents/model-catalog.js";
import { runEmbeddedPiAgent } from "../agents/pi-embedded.js";
import { runSubagentAnnounceFlow } from "../agents/subagent-announce.js";
import { runCronIsolatedAgentTurn } from "./isolated-agent.js";

async function withTempHome<T>(fn: (home: string) => Promise<T>): Promise<T> {
  return withTempHomeBase(fn, { prefix: "openclaw-cron-14646-" });
}

function makeCfg(
  home: string,
  storePath: string,
  overrides: Partial<OpenClawConfig> = {},
): OpenClawConfig {
  const base: OpenClawConfig = {
    agents: {
      defaults: {
        model: "anthropic/claude-opus-4-5",
        workspace: path.join(home, "openclaw"),
      },
    },
    session: { store: storePath, mainKey: "main" },
  } as OpenClawConfig;
  return { ...base, ...overrides };
}

function makeJob(overrides: Partial<CronJob> = {}): CronJob {
  const now = Date.now();
  return {
    id: "job-1",
    name: "daily-digest",
    enabled: true,
    createdAtMs: now,
    updatedAtMs: now,
    schedule: { kind: "every", everyMs: 60_000 },
    sessionTarget: "isolated",
    wakeMode: "now",
    payload: { kind: "agentTurn", message: "run daily digest" },
    state: {},
    ...overrides,
  };
}

function makeDeps(): CliDeps {
  return {
    sendMessageWhatsApp: vi.fn(),
    sendMessageTelegram: vi.fn().mockResolvedValue({ messageId: "t1", chatId: "99887766" }),
    sendMessageDiscord: vi.fn(),
    sendMessageSignal: vi.fn(),
    sendMessageIMessage: vi.fn(),
  };
}

describe("issue #14646 – isolated session + delivery announce to Telegram", () => {
  beforeEach(() => {
    vi.mocked(runEmbeddedPiAgent).mockReset();
    vi.mocked(loadModelCatalog).mockResolvedValue([]);
    vi.mocked(runSubagentAnnounceFlow).mockReset().mockResolvedValue(true);
    setActivePluginRegistry(
      createTestRegistry([
        {
          pluginId: "telegram",
          plugin: createOutboundTestPlugin({ id: "telegram", outbound: telegramOutbound }),
          source: "test",
        },
      ]),
    );
  });

  it("resolves delivery target from main session when delivery.to is empty string", async () => {
    await withTempHome(async (home) => {
      const dir = path.join(home, ".openclaw", "sessions");
      await fs.mkdir(dir, { recursive: true });
      const storePath = path.join(dir, "sessions.json");
      await fs.writeFile(
        storePath,
        JSON.stringify({
          "agent:main:main": {
            sessionId: "main-session",
            updatedAt: Date.now(),
            lastChannel: "telegram",
            lastTo: "99887766",
          },
        }),
        "utf-8",
      );

      const deps = makeDeps();
      vi.mocked(runEmbeddedPiAgent).mockResolvedValue({
        payloads: [{ text: "Daily digest: all clear" }],
        meta: { durationMs: 5, agentMeta: { sessionId: "s", provider: "p", model: "m" } },
      });

      const res = await runCronIsolatedAgentTurn({
        cfg: makeCfg(home, storePath, { channels: { telegram: { botToken: "t-1" } } }),
        deps,
        job: makeJob({
          delivery: { mode: "announce", channel: "telegram", to: "" },
        }),
        message: "run daily digest",
        sessionKey: "cron:job-1",
        lane: "cron",
      });

      expect(res.status).toBe("ok");
      expect(runSubagentAnnounceFlow).toHaveBeenCalledTimes(1);
      const args = vi.mocked(runSubagentAnnounceFlow).mock.calls[0]?.[0] as {
        requesterOrigin?: { channel?: string; to?: string };
      };
      expect(args?.requesterOrigin?.channel).toBe("telegram");
      expect(args?.requesterOrigin?.to).toBe("99887766");
    });
  });

  it("resolves delivery target from main session when delivery.to is undefined", async () => {
    await withTempHome(async (home) => {
      const dir = path.join(home, ".openclaw", "sessions");
      await fs.mkdir(dir, { recursive: true });
      const storePath = path.join(dir, "sessions.json");
      await fs.writeFile(
        storePath,
        JSON.stringify({
          "agent:main:main": {
            sessionId: "main-session",
            updatedAt: Date.now(),
            lastChannel: "telegram",
            lastTo: "99887766",
          },
        }),
        "utf-8",
      );

      const deps = makeDeps();
      vi.mocked(runEmbeddedPiAgent).mockResolvedValue({
        payloads: [{ text: "Daily digest: all clear" }],
        meta: { durationMs: 5, agentMeta: { sessionId: "s", provider: "p", model: "m" } },
      });

      const res = await runCronIsolatedAgentTurn({
        cfg: makeCfg(home, storePath, { channels: { telegram: { botToken: "t-1" } } }),
        deps,
        job: makeJob({
          delivery: { mode: "announce", channel: "telegram" },
        }),
        message: "run daily digest",
        sessionKey: "cron:job-1",
        lane: "cron",
      });

      expect(res.status).toBe("ok");
      expect(runSubagentAnnounceFlow).toHaveBeenCalledTimes(1);
      const args = vi.mocked(runSubagentAnnounceFlow).mock.calls[0]?.[0] as {
        requesterOrigin?: { channel?: string; to?: string };
      };
      expect(args?.requesterOrigin?.channel).toBe("telegram");
      expect(args?.requesterOrigin?.to).toBe("99887766");
    });
  });

  it("resolves Telegram target from main session with lastProvider migration", async () => {
    await withTempHome(async (home) => {
      const dir = path.join(home, ".openclaw", "sessions");
      await fs.mkdir(dir, { recursive: true });
      const storePath = path.join(dir, "sessions.json");
      await fs.writeFile(
        storePath,
        JSON.stringify({
          "agent:main:main": {
            sessionId: "main-session",
            updatedAt: Date.now(),
            lastProvider: "telegram",
            lastTo: "99887766",
          },
        }),
        "utf-8",
      );

      const deps = makeDeps();
      vi.mocked(runEmbeddedPiAgent).mockResolvedValue({
        payloads: [{ text: "Daily digest: all clear" }],
        meta: { durationMs: 5, agentMeta: { sessionId: "s", provider: "p", model: "m" } },
      });

      const res = await runCronIsolatedAgentTurn({
        cfg: makeCfg(home, storePath, { channels: { telegram: { botToken: "t-1" } } }),
        deps,
        job: makeJob({
          delivery: { mode: "announce", channel: "telegram", to: "" },
        }),
        message: "run daily digest",
        sessionKey: "cron:job-1",
        lane: "cron",
      });

      expect(res.status).toBe("ok");
      expect(runSubagentAnnounceFlow).toHaveBeenCalledTimes(1);
      const args = vi.mocked(runSubagentAnnounceFlow).mock.calls[0]?.[0] as {
        requesterOrigin?: { channel?: string; to?: string };
      };
      expect(args?.requesterOrigin?.channel).toBe("telegram");
      expect(args?.requesterOrigin?.to).toBe("99887766");
    });
  });

  it("finds Telegram target from other session entries when main session lastChannel differs", async () => {
    await withTempHome(async (home) => {
      const dir = path.join(home, ".openclaw", "sessions");
      await fs.mkdir(dir, { recursive: true });
      const storePath = path.join(dir, "sessions.json");
      // Main session is on webchat, but a Telegram group session exists
      await fs.writeFile(
        storePath,
        JSON.stringify({
          "agent:main:main": {
            sessionId: "main-session",
            updatedAt: Date.now(),
            lastChannel: "webchat",
            lastTo: "web-user-1",
          },
          "agent:main:telegram:group:-100123": {
            sessionId: "tg-group-session",
            updatedAt: Date.now(),
            lastChannel: "telegram",
            lastTo: "telegram:-100123",
          },
        }),
        "utf-8",
      );

      const deps = makeDeps();
      vi.mocked(runEmbeddedPiAgent).mockResolvedValue({
        payloads: [{ text: "Daily digest: all clear" }],
        meta: { durationMs: 5, agentMeta: { sessionId: "s", provider: "p", model: "m" } },
      });

      const res = await runCronIsolatedAgentTurn({
        cfg: makeCfg(home, storePath, { channels: { telegram: { botToken: "t-1" } } }),
        deps,
        job: makeJob({
          delivery: { mode: "announce", channel: "telegram", to: "" },
        }),
        message: "run daily digest",
        sessionKey: "cron:job-1",
        lane: "cron",
      });

      expect(res.status).toBe("ok");
      expect(runSubagentAnnounceFlow).toHaveBeenCalledTimes(1);
      const args = vi.mocked(runSubagentAnnounceFlow).mock.calls[0]?.[0] as {
        requesterOrigin?: { channel?: string; to?: string };
      };
      expect(args?.requesterOrigin?.channel).toBe("telegram");
      expect(args?.requesterOrigin?.to).toBe("telegram:-100123");
    });
  });

  it("still errors when no session entry has the requested channel target", async () => {
    await withTempHome(async (home) => {
      const dir = path.join(home, ".openclaw", "sessions");
      await fs.mkdir(dir, { recursive: true });
      const storePath = path.join(dir, "sessions.json");
      // No session has ever used Telegram
      await fs.writeFile(
        storePath,
        JSON.stringify({
          "agent:main:main": {
            sessionId: "main-session",
            updatedAt: Date.now(),
            lastChannel: "webchat",
            lastTo: "web-user-1",
          },
        }),
        "utf-8",
      );

      const deps = makeDeps();
      vi.mocked(runEmbeddedPiAgent).mockResolvedValue({
        payloads: [{ text: "Daily digest: all clear" }],
        meta: { durationMs: 5, agentMeta: { sessionId: "s", provider: "p", model: "m" } },
      });

      const res = await runCronIsolatedAgentTurn({
        cfg: makeCfg(home, storePath, { channels: { telegram: { botToken: "t-1" } } }),
        deps,
        job: makeJob({
          delivery: { mode: "announce", channel: "telegram", to: "" },
        }),
        message: "run daily digest",
        sessionKey: "cron:job-1",
        lane: "cron",
      });

      expect(res.status).toBe("error");
      expect(res.error).toBe("cron delivery target is missing");
      expect(runSubagentAnnounceFlow).not.toHaveBeenCalled();
    });
  });
});
