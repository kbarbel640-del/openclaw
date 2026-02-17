import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { OpenClawConfig } from "../config/config.js";
import { telegramPlugin } from "../../extensions/telegram/src/channel.js";
import { setTelegramRuntime } from "../../extensions/telegram/src/runtime.js";
import { whatsappPlugin } from "../../extensions/whatsapp/src/channel.js";
import { setWhatsAppRuntime } from "../../extensions/whatsapp/src/runtime.js";
import * as replyModule from "../auto-reply/reply.js";
import * as runsModule from "../agents/pi-embedded-runner/runs.js";
import { setActivePluginRegistry } from "../plugins/runtime.js";
import { createPluginRuntime } from "../plugins/runtime/index.js";
import { createTestRegistry } from "../test-utils/channel-plugins.js";
import { runHeartbeatOnce } from "./heartbeat-runner.js";

vi.mock("jiti", () => ({ createJiti: () => () => ({}) }));

beforeEach(() => {
  const runtime = createPluginRuntime();
  setTelegramRuntime(runtime);
  setWhatsAppRuntime(runtime);
  setActivePluginRegistry(
    createTestRegistry([
      { pluginId: "whatsapp", plugin: whatsappPlugin, source: "test" },
      { pluginId: "telegram", plugin: telegramPlugin, source: "test" },
    ]),
  );
});

describe("runHeartbeatOnce – session busy guard", () => {
  it("skips heartbeat when embedded agent run is active for the session", async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "openclaw-hb-busy-"));
    const storePath = path.join(tmpDir, "sessions.json");
    const replySpy = vi.spyOn(replyModule, "getReplyFromConfig");
    const activeSpy = vi.spyOn(runsModule, "isEmbeddedPiRunActive");

    try {
      // Seed the session store with a known sessionId.
      await fs.writeFile(
        storePath,
        JSON.stringify({
          main: { sessionId: "test-session-123", updatedAt: Date.now() },
        }),
      );

      // Pretend the embedded agent is actively running for that session.
      activeSpy.mockReturnValue(true);

      const cfg: OpenClawConfig = {
        agents: {
          defaults: {
            workspace: tmpDir,
            heartbeat: { every: "5m", target: "whatsapp" },
          },
        },
        session: { store: storePath },
        channels: { whatsapp: { allowFrom: ["*"] } },
      };

      const res = await runHeartbeatOnce({ cfg });
      expect(res.status).toBe("skipped");
      if (res.status === "skipped") {
        expect(res.reason).toBe("session-busy");
      }
      // The reply agent should NOT have been called.
      expect(replySpy).not.toHaveBeenCalled();
    } finally {
      replySpy.mockRestore();
      activeSpy.mockRestore();
      await fs.rm(tmpDir, { recursive: true, force: true });
    }
  });

  it("proceeds normally when no embedded agent run is active", async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "openclaw-hb-idle-"));
    const storePath = path.join(tmpDir, "sessions.json");
    const activeSpy = vi.spyOn(runsModule, "isEmbeddedPiRunActive");
    const replySpy = vi.spyOn(replyModule, "getReplyFromConfig");

    try {
      await fs.writeFile(
        storePath,
        JSON.stringify({
          main: { sessionId: "test-session-456", updatedAt: Date.now() },
        }),
      );

      // Session is idle.
      activeSpy.mockReturnValue(false);
      // Reply returns HEARTBEAT_OK.
      replySpy.mockResolvedValue([{ text: "HEARTBEAT_OK" }]);

      const cfg: OpenClawConfig = {
        agents: {
          defaults: {
            workspace: tmpDir,
            heartbeat: { every: "5m", target: "whatsapp" },
          },
        },
        session: { store: storePath },
        channels: { whatsapp: { allowFrom: ["*"] } },
      };

      const res = await runHeartbeatOnce({ cfg });
      // Should NOT be skipped for session-busy.
      if (res.status === "skipped") {
        expect(res.reason).not.toBe("session-busy");
      }
    } finally {
      activeSpy.mockRestore();
      replySpy.mockRestore();
      await fs.rm(tmpDir, { recursive: true, force: true });
    }
  });
});
