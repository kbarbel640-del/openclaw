import fs from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { withTempHome as withTempHomeBase } from "../../test/helpers/temp-home.js";
import * as acpManagerModule from "../acp/control-plane/manager.js";
import * as embeddedModule from "../agents/pi-embedded.js";
import type { OpenClawConfig } from "../config/config.js";
import * as configModule from "../config/config.js";
import type { RuntimeEnv } from "../runtime.js";
import { agentCommand } from "./agent.js";

const loadConfigSpy = vi.spyOn(configModule, "loadConfig");
const runEmbeddedPiAgentSpy = vi.spyOn(embeddedModule, "runEmbeddedPiAgent");
const getAcpSessionManagerSpy = vi.spyOn(acpManagerModule, "getAcpSessionManager");

const runtime: RuntimeEnv = {
  log: vi.fn(),
  error: vi.fn(),
  exit: vi.fn(() => {
    throw new Error("exit");
  }),
};

async function withTempHome<T>(fn: (home: string) => Promise<T>): Promise<T> {
  return withTempHomeBase(fn, { prefix: "openclaw-agent-acp-" });
}

function mockConfig(home: string, storePath: string) {
  loadConfigSpy.mockReturnValue({
    acp: {
      enabled: true,
      backend: "acpx",
      allowedAgents: ["codex"],
    },
    agents: {
      defaults: {
        model: { primary: "openai/gpt-5.3-codex" },
        models: { "openai/gpt-5.3-codex": {} },
        workspace: path.join(home, "openclaw"),
      },
    },
    session: { store: storePath, mainKey: "main" },
  } satisfies OpenClawConfig);
}

describe("agentCommand ACP runtime routing", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    runEmbeddedPiAgentSpy.mockResolvedValue({
      payloads: [{ text: "embedded" }],
      meta: {
        durationMs: 5,
      },
    } as never);
  });

  it("routes ACP sessions through AcpSessionManager instead of embedded agent", async () => {
    await withTempHome(async (home) => {
      const storePath = path.join(home, "sessions.json");
      fs.mkdirSync(path.dirname(storePath), { recursive: true });
      fs.writeFileSync(
        storePath,
        JSON.stringify(
          {
            "agent:codex:acp:test": {
              sessionId: "acp-session-1",
              updatedAt: Date.now(),
              acp: {
                backend: "acpx",
                agent: "codex",
                runtimeSessionName: "agent:codex:acp:test",
                mode: "oneshot",
                state: "idle",
                lastActivityAt: Date.now(),
              },
            },
          },
          null,
          2,
        ),
      );
      mockConfig(home, storePath);

      const runTurn = vi.fn(async (paramsUnknown: unknown) => {
        const params = paramsUnknown as {
          onEvent?: (event: { type: string; text?: string; stopReason?: string }) => Promise<void>;
        };
        await params.onEvent?.({ type: "text_delta", text: "ACP_" });
        await params.onEvent?.({ type: "text_delta", text: "OK" });
        await params.onEvent?.({ type: "done", stopReason: "stop" });
      });

      getAcpSessionManagerSpy.mockReturnValue({
        runTurn: (params: unknown) => runTurn(params),
      } as unknown as ReturnType<typeof acpManagerModule.getAcpSessionManager>);

      await agentCommand({ message: "ping", sessionKey: "agent:codex:acp:test" }, runtime);

      expect(runTurn).toHaveBeenCalledWith(
        expect.objectContaining({
          sessionKey: "agent:codex:acp:test",
          text: "ping",
          mode: "prompt",
        }),
      );
      expect(runEmbeddedPiAgentSpy).not.toHaveBeenCalled();
      const hasAckLog = vi
        .mocked(runtime.log)
        .mock.calls.some(([first]) => typeof first === "string" && first.includes("ACP_OK"));
      expect(hasAckLog).toBe(true);
    });
  });
});
