import fs from "node:fs/promises";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CliDeps } from "../cli/deps.js";
import type { OpenClawConfig } from "../config/config.js";
import type { CronJob } from "./types.js";
import { withTempHome as withTempHomeBase } from "../../test/helpers/temp-home.js";

vi.mock("../agents/pi-embedded.js", () => ({
  abortEmbeddedPiRun: vi.fn().mockReturnValue(false),
  runEmbeddedPiAgent: vi.fn(),
  resolveEmbeddedSessionLane: (key: string) => `session:${key.trim() || "main"}`,
}));
vi.mock("../agents/model-catalog.js", () => ({
  loadModelCatalog: vi.fn(),
}));

import { loadModelCatalog } from "../agents/model-catalog.js";
import { runEmbeddedPiAgent } from "../agents/pi-embedded.js";
import { runCronIsolatedAgentTurn } from "./isolated-agent.js";

async function withTempHome<T>(fn: (home: string) => Promise<T>): Promise<T> {
  return withTempHomeBase(fn, { prefix: "openclaw-cron-model-" });
}

async function writeSessionStore(home: string) {
  const dir = path.join(home, ".openclaw", "sessions");
  await fs.mkdir(dir, { recursive: true });
  const storePath = path.join(dir, "sessions.json");
  await fs.writeFile(
    storePath,
    JSON.stringify(
      {
        "agent:main:main": {
          sessionId: "main-session",
          updatedAt: Date.now(),
          lastProvider: "webchat",
          lastTo: "",
        },
      },
      null,
      2,
    ),
    "utf-8",
  );
  return storePath;
}

async function readSessionStore(storePath: string) {
  const raw = await fs.readFile(storePath, "utf-8");
  return JSON.parse(raw) as Record<
    string,
    { sessionId?: string; model?: string; modelProvider?: string }
  >;
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

function makeJob(payload: CronJob["payload"]): CronJob {
  const now = Date.now();
  return {
    id: "job-model",
    enabled: true,
    createdAtMs: now,
    updatedAtMs: now,
    schedule: { kind: "every", everyMs: 60_000 },
    sessionTarget: "isolated",
    wakeMode: "now",
    payload,
    state: {},
  };
}

const makeDeps = (): CliDeps => ({
  sendMessageWhatsApp: vi.fn(),
  sendMessageTelegram: vi.fn(),
  sendMessageDiscord: vi.fn(),
  sendMessageSignal: vi.fn(),
  sendMessageIMessage: vi.fn(),
});

describe("cron payload.model session assignment (#14981)", () => {
  beforeEach(() => {
    vi.mocked(runEmbeddedPiAgent).mockReset();
    vi.mocked(loadModelCatalog).mockResolvedValue([]);
  });

  it("assigns payload.model to the session entry before the agent run", async () => {
    await withTempHome(async (home) => {
      const storePath = await writeSessionStore(home);

      // Capture the model passed to runEmbeddedPiAgent
      vi.mocked(runEmbeddedPiAgent).mockResolvedValue({
        payloads: [{ text: "done" }],
        meta: {
          durationMs: 5,
          agentMeta: {
            sessionId: "s",
            provider: "openai",
            model: "gpt-nano",
          },
        },
      });

      const res = await runCronIsolatedAgentTurn({
        cfg: makeCfg(home, storePath),
        deps: makeDeps(),
        job: makeJob({ kind: "agentTurn", message: "hello", model: "openai/gpt-nano" }),
        message: "hello",
        sessionKey: "cron:job-model",
        lane: "cron",
      });

      expect(res.status).toBe("ok");

      // The model passed to runEmbeddedPiAgent should be the payload model
      const call = vi.mocked(runEmbeddedPiAgent).mock.calls[0]?.[0];
      expect(call?.model).toBe("gpt-nano");
      expect(call?.provider).toBe("openai");

      // The session entry in the store should have the payload model
      const store = await readSessionStore(storePath);
      const cronKey = "agent:main:cron:job-model";
      const entry = store[cronKey];
      expect(entry).toBeDefined();
      expect(entry?.model).toBe("gpt-nano");
      expect(entry?.modelProvider).toBe("openai");
    });
  });

  it("uses the gateway default model when payload.model is not set", async () => {
    await withTempHome(async (home) => {
      const storePath = await writeSessionStore(home);

      vi.mocked(runEmbeddedPiAgent).mockResolvedValue({
        payloads: [{ text: "done" }],
        meta: {
          durationMs: 5,
          agentMeta: {
            sessionId: "s",
            provider: "anthropic",
            model: "claude-opus-4-5",
          },
        },
      });

      const res = await runCronIsolatedAgentTurn({
        cfg: makeCfg(home, storePath),
        deps: makeDeps(),
        job: makeJob({ kind: "agentTurn", message: "hello" }),
        message: "hello",
        sessionKey: "cron:job-model",
        lane: "cron",
      });

      expect(res.status).toBe("ok");

      // Should use the default model from config
      const call = vi.mocked(runEmbeddedPiAgent).mock.calls[0]?.[0];
      expect(call?.model).toBe("claude-opus-4-5");
      expect(call?.provider).toBe("anthropic");

      // Session entry should also reflect the default model
      const store = await readSessionStore(storePath);
      const cronKey = "agent:main:cron:job-model";
      const entry = store[cronKey];
      expect(entry).toBeDefined();
      expect(entry?.model).toBe("claude-opus-4-5");
      expect(entry?.modelProvider).toBe("anthropic");
    });
  });

  it("persists the payload model to the session store before the run starts", async () => {
    await withTempHome(async (home) => {
      const storePath = await writeSessionStore(home);
      let sessionModelDuringRun: string | undefined;
      let sessionProviderDuringRun: string | undefined;

      vi.mocked(runEmbeddedPiAgent).mockImplementation(async () => {
        // Read the session store mid-run to verify model was persisted
        const store = await readSessionStore(storePath);
        const cronKey = "agent:main:cron:job-model";
        const entry = store[cronKey];
        sessionModelDuringRun = entry?.model;
        sessionProviderDuringRun = entry?.modelProvider;

        return {
          payloads: [{ text: "done" }],
          meta: {
            durationMs: 5,
            agentMeta: {
              sessionId: "s",
              provider: "openai",
              model: "gpt-nano",
            },
          },
        };
      });

      const res = await runCronIsolatedAgentTurn({
        cfg: makeCfg(home, storePath),
        deps: makeDeps(),
        job: makeJob({ kind: "agentTurn", message: "hello", model: "openai/gpt-nano" }),
        message: "hello",
        sessionKey: "cron:job-model",
        lane: "cron",
      });

      expect(res.status).toBe("ok");
      // The session store should have the payload model DURING the run
      expect(sessionModelDuringRun).toBe("gpt-nano");
      expect(sessionProviderDuringRun).toBe("openai");
    });
  });
});
