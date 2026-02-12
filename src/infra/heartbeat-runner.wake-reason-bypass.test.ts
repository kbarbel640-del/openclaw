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
import { resolveMainSessionKey } from "../config/sessions.js";
import { setActivePluginRegistry } from "../plugins/runtime.js";
import { createPluginRuntime } from "../plugins/runtime/index.js";
import { createTestRegistry } from "../test-utils/channel-plugins.js";
import { runHeartbeatOnce } from "./heartbeat-runner.js";

// Avoid pulling optional runtime deps during isolated runs.
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

/**
 * Helpers to reduce boilerplate across tests in this file.
 */
async function setupEmptyHeartbeat() {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "openclaw-hb-wake-"));
  const storePath = path.join(tmpDir, "sessions.json");
  const workspaceDir = path.join(tmpDir, "workspace");
  await fs.mkdir(workspaceDir, { recursive: true });

  // Create an effectively empty HEARTBEAT.md (only headers)
  await fs.writeFile(
    path.join(workspaceDir, "HEARTBEAT.md"),
    "# HEARTBEAT.md\n\n## Tasks\n\n",
    "utf-8",
  );

  const cfg: OpenClawConfig = {
    agents: {
      defaults: {
        workspace: workspaceDir,
        heartbeat: { every: "5m", target: "whatsapp" },
      },
    },
    channels: { whatsapp: { allowFrom: ["*"] } },
    session: { store: storePath },
  };
  const sessionKey = resolveMainSessionKey(cfg);

  await fs.writeFile(
    storePath,
    JSON.stringify(
      {
        [sessionKey]: {
          sessionId: "sid",
          updatedAt: Date.now(),
          lastChannel: "whatsapp",
          lastTo: "+1555",
        },
      },
      null,
      2,
    ),
  );

  const sendWhatsApp = vi.fn().mockResolvedValue({
    messageId: "m1",
    toJid: "jid",
  });

  return { cfg, tmpDir, storePath, workspaceDir, sendWhatsApp };
}

const baseDeps = (sendWhatsApp: ReturnType<typeof vi.fn>) => ({
  sendWhatsApp,
  getQueueSize: () => 0,
  nowMs: () => 0,
  webAuthExists: async () => true,
  hasActiveWebListener: () => true,
});

describe("runHeartbeatOnce – empty heartbeat exemptions (#14527)", () => {
  it("skips regular heartbeat when HEARTBEAT.md is effectively empty", async () => {
    const { cfg, tmpDir, sendWhatsApp } = await setupEmptyHeartbeat();
    const replySpy = vi.spyOn(replyModule, "getReplyFromConfig");
    try {
      const res = await runHeartbeatOnce({
        cfg,
        deps: baseDeps(sendWhatsApp),
      });

      expect(res.status).toBe("skipped");
      if (res.status === "skipped") {
        expect(res.reason).toBe("empty-heartbeat-file");
      }
      expect(replySpy).not.toHaveBeenCalled();
      expect(sendWhatsApp).not.toHaveBeenCalled();
    } finally {
      replySpy.mockRestore();
      await fs.rm(tmpDir, { recursive: true, force: true });
    }
  });

  it("runs heartbeat with reason 'wake' even when HEARTBEAT.md is empty", async () => {
    const { cfg, tmpDir, sendWhatsApp } = await setupEmptyHeartbeat();
    const replySpy = vi.spyOn(replyModule, "getReplyFromConfig");
    try {
      replySpy.mockResolvedValue([{ text: "Wake event processed" }]);

      const res = await runHeartbeatOnce({
        cfg,
        reason: "wake",
        deps: baseDeps(sendWhatsApp),
      });

      // Should NOT be skipped – wake is exempted from empty heartbeat check
      expect(res.status).toBe("ran");
      expect(replySpy).toHaveBeenCalled();
      expect(sendWhatsApp).toHaveBeenCalledTimes(1);
    } finally {
      replySpy.mockRestore();
      await fs.rm(tmpDir, { recursive: true, force: true });
    }
  });

  it("runs heartbeat with reason 'exec-event' even when HEARTBEAT.md is empty", async () => {
    const { cfg, tmpDir, sendWhatsApp } = await setupEmptyHeartbeat();
    const replySpy = vi.spyOn(replyModule, "getReplyFromConfig");
    try {
      replySpy.mockResolvedValue([{ text: "Exec event processed" }]);

      const res = await runHeartbeatOnce({
        cfg,
        reason: "exec-event",
        deps: baseDeps(sendWhatsApp),
      });

      expect(res.status).toBe("ran");
      expect(replySpy).toHaveBeenCalled();
      expect(sendWhatsApp).toHaveBeenCalledTimes(1);
    } finally {
      replySpy.mockRestore();
      await fs.rm(tmpDir, { recursive: true, force: true });
    }
  });

  it("runs heartbeat with reason 'cron:daily' even when HEARTBEAT.md is empty", async () => {
    const { cfg, tmpDir, sendWhatsApp } = await setupEmptyHeartbeat();
    const replySpy = vi.spyOn(replyModule, "getReplyFromConfig");
    try {
      replySpy.mockResolvedValue([{ text: "Cron event processed" }]);

      const res = await runHeartbeatOnce({
        cfg,
        reason: "cron:daily",
        deps: baseDeps(sendWhatsApp),
      });

      expect(res.status).toBe("ran");
      expect(replySpy).toHaveBeenCalled();
      expect(sendWhatsApp).toHaveBeenCalledTimes(1);
    } finally {
      replySpy.mockRestore();
      await fs.rm(tmpDir, { recursive: true, force: true });
    }
  });
});
