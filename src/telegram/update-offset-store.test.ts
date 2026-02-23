import { describe, expect, it } from "vitest";
import { withStateDirEnv } from "../test-helpers/state-dir-env.js";
import {
  deleteTelegramUpdateOffset,
  extractBotIdFromToken,
  readTelegramUpdateOffset,
  writeTelegramUpdateOffset,
} from "./update-offset-store.js";

describe("deleteTelegramUpdateOffset", () => {
  it("removes the offset file so a new bot starts fresh", async () => {
    await withStateDirEnv("openclaw-tg-offset-", async () => {
      await writeTelegramUpdateOffset({ accountId: "default", updateId: 432_000_000 });
      expect(await readTelegramUpdateOffset({ accountId: "default" })).toBe(432_000_000);

      await deleteTelegramUpdateOffset({ accountId: "default" });
      expect(await readTelegramUpdateOffset({ accountId: "default" })).toBeNull();
    });
  });

  it("does not throw when the offset file does not exist", async () => {
    await withStateDirEnv("openclaw-tg-offset-", async () => {
      await expect(deleteTelegramUpdateOffset({ accountId: "nonexistent" })).resolves.not.toThrow();
    });
  });

  it("only removes the targeted account offset, leaving others intact", async () => {
    await withStateDirEnv("openclaw-tg-offset-", async () => {
      await writeTelegramUpdateOffset({ accountId: "default", updateId: 100 });
      await writeTelegramUpdateOffset({ accountId: "alerts", updateId: 200 });

      await deleteTelegramUpdateOffset({ accountId: "default" });

      expect(await readTelegramUpdateOffset({ accountId: "default" })).toBeNull();
      expect(await readTelegramUpdateOffset({ accountId: "alerts" })).toBe(200);
    });
  });
});

describe("bot token scoping", () => {
  it("persists and reloads the last update id with token", async () => {
    await withStateDirEnv("openclaw-tg-offset-", async () => {
      const token = "111111111:AAFxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx";

      expect(await readTelegramUpdateOffset({ accountId: "primary", botToken: token })).toBeNull();

      await writeTelegramUpdateOffset({ accountId: "primary", updateId: 421, botToken: token });

      expect(await readTelegramUpdateOffset({ accountId: "primary", botToken: token })).toBe(421);
    });
  });

  it("invalidates offset when bot token changes", async () => {
    await withStateDirEnv("openclaw-tg-offset-", async () => {
      const oldToken = "111111111:AAFxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx";
      const newToken = "222222222:AAFyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyy";

      await writeTelegramUpdateOffset({
        accountId: "default",
        updateId: 432_527_632,
        botToken: oldToken,
      });

      // Same token reads back fine
      expect(await readTelegramUpdateOffset({ accountId: "default", botToken: oldToken })).toBe(
        432_527_632,
      );

      // Different token invalidates the offset
      expect(
        await readTelegramUpdateOffset({ accountId: "default", botToken: newToken }),
      ).toBeNull();
    });
  });

  it("reads offset when no botToken provided (backward compat)", async () => {
    await withStateDirEnv("openclaw-tg-offset-", async () => {
      await writeTelegramUpdateOffset({
        accountId: "default",
        updateId: 12345,
        botToken: "111111111:AAFxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
      });

      // No token provided — should still return the offset (no validation)
      expect(await readTelegramUpdateOffset({ accountId: "default" })).toBe(12345);
    });
  });

  it("reads legacy offset files without botId field", async () => {
    await withStateDirEnv("openclaw-tg-offset-", async () => {
      // Write a legacy-format file (no botId, no botToken)
      await writeTelegramUpdateOffset({
        accountId: "default",
        updateId: 99999,
      });

      // Should read fine with a valid token (no stored botId to compare against)
      expect(
        await readTelegramUpdateOffset({
          accountId: "default",
          botToken: "111111111:AAFxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
        }),
      ).toBe(99999);
    });
  });
});

describe("malformed token guard", () => {
  it("discards offset when new token is malformed and stored botId exists", async () => {
    await withStateDirEnv("openclaw-tg-offset-", async () => {
      await writeTelegramUpdateOffset({
        accountId: "default",
        updateId: 999_999,
        botToken: "111111111:AAFxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
      });

      // Malformed token can't extract a botId — should discard stale offset
      expect(
        await readTelegramUpdateOffset({ accountId: "default", botToken: "malformed-token" }),
      ).toBeNull();
    });
  });

  it("discards offset when token is malformed even without stored botId (legacy file)", async () => {
    await withStateDirEnv("openclaw-tg-offset-", async () => {
      // Write a legacy-format file (no botId stored)
      await writeTelegramUpdateOffset({
        accountId: "default",
        updateId: 888_888,
      });

      // Malformed token — should still discard because we cannot verify identity
      expect(
        await readTelegramUpdateOffset({ accountId: "default", botToken: "not-a-valid-token" }),
      ).toBeNull();
    });
  });

  it("discards offset when token is empty string", async () => {
    await withStateDirEnv("openclaw-tg-offset-", async () => {
      await writeTelegramUpdateOffset({
        accountId: "default",
        updateId: 777_777,
        botToken: "111111111:AAFxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
      });

      expect(await readTelegramUpdateOffset({ accountId: "default", botToken: "" })).toBeNull();
    });
  });

  it("discards offset when token has no numeric prefix", async () => {
    await withStateDirEnv("openclaw-tg-offset-", async () => {
      await writeTelegramUpdateOffset({
        accountId: "default",
        updateId: 666_666,
        botToken: "111111111:AAFxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
      });

      expect(
        await readTelegramUpdateOffset({ accountId: "default", botToken: ":AAFsecretpart" }),
      ).toBeNull();
    });
  });
});

describe("extractBotIdFromToken", () => {
  it("extracts bot ID from valid token", () => {
    expect(extractBotIdFromToken("8125167982:AAF35OFUg31nrRW0H60qglgZXfQm5D4xGE0")).toBe(
      "8125167982",
    );
  });

  it("returns undefined for invalid tokens", () => {
    expect(extractBotIdFromToken("not-a-token")).toBeUndefined();
    expect(extractBotIdFromToken("")).toBeUndefined();
    expect(extractBotIdFromToken(":secret")).toBeUndefined();
  });
});
