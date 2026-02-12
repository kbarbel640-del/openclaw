import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { OpenClawConfig } from "../config/config.js";
import * as replyModule from "../auto-reply/reply.js";
import { resolveAgentMainSessionKey } from "../config/sessions.js";
import { runHeartbeatOnce } from "./heartbeat-runner.js";

vi.mock("jiti", () => ({ createJiti: () => () => ({}) }));

describe("runHeartbeatOnce - busy session lane", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("skips heartbeat when the active session lane has in-flight work", async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "openclaw-hb-session-busy-"));
    const storePath = path.join(tmpDir, "sessions.json");

    try {
      const cfg: OpenClawConfig = {
        agents: {
          defaults: {
            workspace: tmpDir,
            heartbeat: {
              every: "5m",
            },
          },
          list: [{ id: "main", default: true }],
        },
        session: { store: storePath },
        channels: { discord: { enabled: true, token: "x", allowFrom: ["*"] } },
      };

      const sessionKey = resolveAgentMainSessionKey({ cfg, agentId: "main" });
      await fs.writeFile(
        storePath,
        JSON.stringify(
          {
            [sessionKey]: {
              sessionId: "sid-1",
              updatedAt: Date.now(),
              lastChannel: "discord",
              lastTo: "user:1",
            },
          },
          null,
          2,
        ),
      );

      const replySpy = vi.spyOn(replyModule, "getReplyFromConfig");

      const result = await runHeartbeatOnce({
        cfg,
        deps: {
          nowMs: () => Date.now(),
          getQueueSize: (lane?: string) => (lane === `session:${sessionKey}` ? 1 : 0),
        },
      });

      expect(result).toEqual({ status: "skipped", reason: "requests-in-flight" });
      expect(replySpy).not.toHaveBeenCalled();
    } finally {
      await fs.rm(tmpDir, { recursive: true, force: true });
    }
  });
});
