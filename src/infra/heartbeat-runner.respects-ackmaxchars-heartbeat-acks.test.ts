import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { OpenClawConfig } from "../config/config.js";
import { telegramPlugin } from "../../extensions/telegram/src/channel.js";
import { setTelegramRuntime } from "../../extensions/telegram/src/runtime.js";
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
  setActivePluginRegistry(
    createTestRegistry([{ pluginId: "telegram", plugin: telegramPlugin, source: "test" }]),
  );
});

describe("resolveHeartbeatIntervalMs", () => {
  it("respects ackMaxChars for heartbeat acks", async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "openclaw-hb-"));
    const storePath = path.join(tmpDir, "sessions.json");
    const replySpy = vi.spyOn(replyModule, "getReplyFromConfig");
    try {
      const cfg: OpenClawConfig = {
        agents: {
          defaults: {
            workspace: tmpDir,
            heartbeat: {
              every: "5m",
              target: "telegram",
              ackMaxChars: 0,
            },
          },
        },
        channels: { telegram: { botToken: "test-token" } },
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
              lastChannel: "telegram",
              lastProvider: "telegram",
              lastTo: "123456",
            },
          },
          null,
          2,
        ),
      );

      replySpy.mockResolvedValue({ text: "HEARTBEAT_OK 🦞" });
      const sendTelegram = vi.fn().mockResolvedValue({
        messageId: "m1",
        chatId: "123456",
      });

      await runHeartbeatOnce({
        cfg,
        deps: {
          sendTelegram,
          getQueueSize: () => 0,
          nowMs: () => 0,
        },
      });

      expect(sendTelegram).toHaveBeenCalled();
    } finally {
      replySpy.mockRestore();
      await fs.rm(tmpDir, { recursive: true, force: true });
    }
  });

  it("sends HEARTBEAT_OK when visibility.showOk is true", async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "openclaw-hb-"));
    const storePath = path.join(tmpDir, "sessions.json");
    const replySpy = vi.spyOn(replyModule, "getReplyFromConfig");
    try {
      const cfg: OpenClawConfig = {
        agents: {
          defaults: {
            workspace: tmpDir,
            heartbeat: {
              every: "5m",
              target: "telegram",
            },
          },
        },
        channels: { telegram: { botToken: "test-token", heartbeat: { showOk: true } } },
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
              lastChannel: "telegram",
              lastProvider: "telegram",
              lastTo: "123456",
            },
          },
          null,
          2,
        ),
      );

      replySpy.mockResolvedValue({ text: "HEARTBEAT_OK" });
      const sendTelegram = vi.fn().mockResolvedValue({
        messageId: "m1",
        chatId: "123456",
      });

      await runHeartbeatOnce({
        cfg,
        deps: {
          sendTelegram,
          getQueueSize: () => 0,
          nowMs: () => 0,
        },
      });

      expect(sendTelegram).toHaveBeenCalledTimes(1);
      expect(sendTelegram).toHaveBeenCalledWith("123456", "HEARTBEAT_OK", expect.any(Object));
    } finally {
      replySpy.mockRestore();
      await fs.rm(tmpDir, { recursive: true, force: true });
    }
  });

  it("skips heartbeat LLM calls when visibility disables all output", async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "openclaw-hb-"));
    const storePath = path.join(tmpDir, "sessions.json");
    const replySpy = vi.spyOn(replyModule, "getReplyFromConfig");
    try {
      const cfg: OpenClawConfig = {
        agents: {
          defaults: {
            workspace: tmpDir,
            heartbeat: {
              every: "5m",
              target: "telegram",
            },
          },
        },
        channels: {
          telegram: {
            botToken: "test-token",
            heartbeat: { showOk: false, showAlerts: false, useIndicator: false },
          },
        },
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
              lastChannel: "telegram",
              lastProvider: "telegram",
              lastTo: "123456",
            },
          },
          null,
          2,
        ),
      );

      const sendTelegram = vi.fn().mockResolvedValue({
        messageId: "m1",
        chatId: "123456",
      });

      const result = await runHeartbeatOnce({
        cfg,
        deps: {
          sendTelegram,
          getQueueSize: () => 0,
          nowMs: () => 0,
        },
      });

      expect(replySpy).not.toHaveBeenCalled();
      expect(sendTelegram).not.toHaveBeenCalled();
      expect(result).toEqual({ status: "skipped", reason: "alerts-disabled" });
    } finally {
      replySpy.mockRestore();
      await fs.rm(tmpDir, { recursive: true, force: true });
    }
  });

  it("skips delivery for markup-wrapped HEARTBEAT_OK", async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "openclaw-hb-"));
    const storePath = path.join(tmpDir, "sessions.json");
    const replySpy = vi.spyOn(replyModule, "getReplyFromConfig");
    try {
      const cfg: OpenClawConfig = {
        agents: {
          defaults: {
            workspace: tmpDir,
            heartbeat: {
              every: "5m",
              target: "telegram",
            },
          },
        },
        channels: { telegram: { botToken: "test-token" } },
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
              lastChannel: "telegram",
              lastProvider: "telegram",
              lastTo: "123456",
            },
          },
          null,
          2,
        ),
      );

      replySpy.mockResolvedValue({ text: "<b>HEARTBEAT_OK</b>" });
      const sendTelegram = vi.fn().mockResolvedValue({
        messageId: "m1",
        chatId: "123456",
      });

      await runHeartbeatOnce({
        cfg,
        deps: {
          sendTelegram,
          getQueueSize: () => 0,
          nowMs: () => 0,
        },
      });

      expect(sendTelegram).not.toHaveBeenCalled();
    } finally {
      replySpy.mockRestore();
      await fs.rm(tmpDir, { recursive: true, force: true });
    }
  });

  it("does not regress updatedAt when restoring heartbeat sessions", async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "openclaw-hb-"));
    const storePath = path.join(tmpDir, "sessions.json");
    const replySpy = vi.spyOn(replyModule, "getReplyFromConfig");
    try {
      const originalUpdatedAt = 1000;
      const bumpedUpdatedAt = 2000;
      const cfg: OpenClawConfig = {
        agents: {
          defaults: {
            workspace: tmpDir,
            heartbeat: {
              every: "5m",
              target: "telegram",
            },
          },
        },
        channels: { telegram: { botToken: "test-token" } },
        session: { store: storePath },
      };
      const sessionKey = resolveMainSessionKey(cfg);

      await fs.writeFile(
        storePath,
        JSON.stringify(
          {
            [sessionKey]: {
              sessionId: "sid",
              updatedAt: originalUpdatedAt,
              lastChannel: "telegram",
              lastProvider: "telegram",
              lastTo: "123456",
            },
          },
          null,
          2,
        ),
      );

      replySpy.mockImplementationOnce(async () => {
        const raw = await fs.readFile(storePath, "utf-8");
        const parsed = JSON.parse(raw) as Record<string, { updatedAt?: number } | undefined>;
        if (parsed[sessionKey]) {
          parsed[sessionKey] = {
            ...parsed[sessionKey],
            updatedAt: bumpedUpdatedAt,
          };
        }
        await fs.writeFile(storePath, JSON.stringify(parsed, null, 2));
        return { text: "" };
      });

      await runHeartbeatOnce({
        cfg,
        deps: {
          getQueueSize: () => 0,
          nowMs: () => 0,
        },
      });

      const finalStore = JSON.parse(await fs.readFile(storePath, "utf-8")) as Record<
        string,
        { updatedAt?: number } | undefined
      >;
      expect(finalStore[sessionKey]?.updatedAt).toBe(bumpedUpdatedAt);
    } finally {
      replySpy.mockRestore();
      await fs.rm(tmpDir, { recursive: true, force: true });
    }
  });

  it("passes through accountId for telegram heartbeats", async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "openclaw-hb-"));
    const storePath = path.join(tmpDir, "sessions.json");
    const replySpy = vi.spyOn(replyModule, "getReplyFromConfig");
    const prevTelegramToken = process.env.TELEGRAM_BOT_TOKEN;
    process.env.TELEGRAM_BOT_TOKEN = "";
    try {
      const cfg: OpenClawConfig = {
        agents: {
          defaults: {
            workspace: tmpDir,
            heartbeat: { every: "5m", target: "telegram" },
          },
        },
        channels: { telegram: { botToken: "test-bot-token-123" } },
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
              lastChannel: "telegram",
              lastProvider: "telegram",
              lastTo: "123456",
            },
          },
          null,
          2,
        ),
      );

      replySpy.mockResolvedValue({ text: "Hello from heartbeat" });
      const sendTelegram = vi.fn().mockResolvedValue({
        messageId: "m1",
        chatId: "123456",
      });

      await runHeartbeatOnce({
        cfg,
        deps: {
          sendTelegram,
          getQueueSize: () => 0,
          nowMs: () => 0,
        },
      });

      expect(sendTelegram).toHaveBeenCalledTimes(1);
      expect(sendTelegram).toHaveBeenCalledWith(
        "123456",
        "Hello from heartbeat",
        expect.objectContaining({ accountId: undefined, verbose: false }),
      );
    } finally {
      replySpy.mockRestore();
      if (prevTelegramToken === undefined) {
        delete process.env.TELEGRAM_BOT_TOKEN;
      } else {
        process.env.TELEGRAM_BOT_TOKEN = prevTelegramToken;
      }
      await fs.rm(tmpDir, { recursive: true, force: true });
    }
  });

  it("uses explicit heartbeat accountId for telegram delivery", async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "openclaw-hb-"));
    const storePath = path.join(tmpDir, "sessions.json");
    const replySpy = vi.spyOn(replyModule, "getReplyFromConfig");
    const prevTelegramToken = process.env.TELEGRAM_BOT_TOKEN;
    process.env.TELEGRAM_BOT_TOKEN = "";
    try {
      const cfg: OpenClawConfig = {
        agents: {
          defaults: {
            workspace: tmpDir,
            heartbeat: { every: "5m", target: "telegram", accountId: "work" },
          },
        },
        channels: {
          telegram: {
            accounts: {
              work: { botToken: "test-bot-token-123" },
            },
          },
        },
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
              lastChannel: "telegram",
              lastProvider: "telegram",
              lastTo: "123456",
            },
          },
          null,
          2,
        ),
      );

      replySpy.mockResolvedValue({ text: "Hello from heartbeat" });
      const sendTelegram = vi.fn().mockResolvedValue({
        messageId: "m1",
        chatId: "123456",
      });

      await runHeartbeatOnce({
        cfg,
        deps: {
          sendTelegram,
          getQueueSize: () => 0,
          nowMs: () => 0,
        },
      });

      expect(sendTelegram).toHaveBeenCalledTimes(1);
      expect(sendTelegram).toHaveBeenCalledWith(
        "123456",
        "Hello from heartbeat",
        expect.objectContaining({ accountId: "work", verbose: false }),
      );
    } finally {
      replySpy.mockRestore();
      if (prevTelegramToken === undefined) {
        delete process.env.TELEGRAM_BOT_TOKEN;
      } else {
        process.env.TELEGRAM_BOT_TOKEN = prevTelegramToken;
      }
      await fs.rm(tmpDir, { recursive: true, force: true });
    }
  });

  it("does not pre-resolve telegram accountId (allows config-only account tokens)", async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "openclaw-hb-"));
    const storePath = path.join(tmpDir, "sessions.json");
    const replySpy = vi.spyOn(replyModule, "getReplyFromConfig");
    const prevTelegramToken = process.env.TELEGRAM_BOT_TOKEN;
    process.env.TELEGRAM_BOT_TOKEN = "";
    try {
      const cfg: OpenClawConfig = {
        agents: {
          defaults: {
            workspace: tmpDir,
            heartbeat: { every: "5m", target: "telegram" },
          },
        },
        channels: {
          telegram: {
            accounts: {
              work: { botToken: "test-bot-token-123" },
            },
          },
        },
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
              lastChannel: "telegram",
              lastProvider: "telegram",
              lastTo: "123456",
            },
          },
          null,
          2,
        ),
      );

      replySpy.mockResolvedValue({ text: "Hello from heartbeat" });
      const sendTelegram = vi.fn().mockResolvedValue({
        messageId: "m1",
        chatId: "123456",
      });

      await runHeartbeatOnce({
        cfg,
        deps: {
          sendTelegram,
          getQueueSize: () => 0,
          nowMs: () => 0,
        },
      });

      expect(sendTelegram).toHaveBeenCalledTimes(1);
      expect(sendTelegram).toHaveBeenCalledWith(
        "123456",
        "Hello from heartbeat",
        expect.objectContaining({ accountId: undefined, verbose: false }),
      );
    } finally {
      replySpy.mockRestore();
      if (prevTelegramToken === undefined) {
        delete process.env.TELEGRAM_BOT_TOKEN;
      } else {
        process.env.TELEGRAM_BOT_TOKEN = prevTelegramToken;
      }
      await fs.rm(tmpDir, { recursive: true, force: true });
    }
  });
});
