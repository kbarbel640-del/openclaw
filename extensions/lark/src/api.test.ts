import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  normalizeLarkAccountId,
  resolveLarkAccount,
  handleLarkChallenge,
  parseLarkMessageEvent,
} from "./api.js";
import { DEFAULT_ACCOUNT_ID } from "openclaw/plugin-sdk";
import type { LarkConfig } from "./types.js";

describe("lark/api", () => {
  // 保存原始环境变量
  const originalEnv = process.env;

  beforeEach(() => {
    // 清理飞书相关的环境变量
    delete process.env.LARK_APP_ID;
    delete process.env.LARK_APP_SECRET;
    delete process.env.LARK_ENCRYPT_KEY;
    delete process.env.LARK_VERIFICATION_TOKEN;
  });

  afterEach(() => {
    // 恢复原始环境变量
    process.env = originalEnv;
  });


  describe("normalizeLarkAccountId", () => {
    it("returns DEFAULT_ACCOUNT_ID for null", () => {
      expect(normalizeLarkAccountId(null)).toBe(DEFAULT_ACCOUNT_ID);
    });

    it("returns DEFAULT_ACCOUNT_ID for undefined", () => {
      expect(normalizeLarkAccountId(undefined)).toBe(DEFAULT_ACCOUNT_ID);
    });

    it("returns DEFAULT_ACCOUNT_ID for empty string", () => {
      expect(normalizeLarkAccountId("")).toBe(DEFAULT_ACCOUNT_ID);
    });

    it("returns the account id as-is", () => {
      expect(normalizeLarkAccountId("my-account")).toBe("my-account");
    });
  });

  describe("resolveLarkAccount", () => {
    it("resolves default account from config", () => {
      const cfg = {
        channels: {
          lark: {
            appId: "cli_xxx",
            appSecret: "secret_xxx",
            enabled: true,
            name: "Test Bot",
          } as LarkConfig,
        },
      };

      const account = resolveLarkAccount({ cfg });

      expect(account.accountId).toBe(DEFAULT_ACCOUNT_ID);
      expect(account.appId).toBe("cli_xxx");
      expect(account.appSecret).toBe("secret_xxx");
      expect(account.enabled).toBe(true);
      expect(account.name).toBe("Test Bot");
      expect(account.tokenSource).toBe("config");
    });

    it("prefers env vars over config for default account", () => {
      process.env.LARK_APP_ID = "env_cli_xxx";
      process.env.LARK_APP_SECRET = "env_secret_xxx";

      const cfg = {
        channels: {
          lark: {
            appId: "cli_xxx",
            appSecret: "secret_xxx",
          } as LarkConfig,
        },
      };

      const account = resolveLarkAccount({ cfg });

      expect(account.appId).toBe("env_cli_xxx");
      expect(account.appSecret).toBe("env_secret_xxx");
      expect(account.tokenSource).toBe("env");
    });

    it("resolves named account from accounts map", () => {
      const cfg = {
        channels: {
          lark: {
            accounts: {
              prod: {
                appId: "cli_prod",
                appSecret: "secret_prod",
                enabled: true,
              },
            },
          } as LarkConfig,
        },
      };

      const account = resolveLarkAccount({ cfg, accountId: "prod" });

      expect(account.accountId).toBe("prod");
      expect(account.appId).toBe("cli_prod");
      expect(account.appSecret).toBe("secret_prod");
    });

    it("returns none token source when not configured", () => {
      const cfg = { channels: {} };

      const account = resolveLarkAccount({ cfg });

      expect(account.tokenSource).toBe("none");
      expect(account.appId).toBe("");
      expect(account.appSecret).toBe("");
    });
  });

  describe("handleLarkChallenge", () => {
    it("returns challenge when token matches", () => {
      const body = {
        challenge: "test_challenge_123",
        token: "verification_token",
      };

      const result = handleLarkChallenge(body, "verification_token");

      expect(result).toEqual({ challenge: "test_challenge_123" });
    });

    it("throws when token does not match", () => {
      const body = {
        challenge: "test_challenge",
        token: "wrong_token",
      };

      expect(() => handleLarkChallenge(body, "correct_token")).toThrow("飞书验证 Token 不匹配");
    });

    it("returns null when no challenge", () => {
      const body = {
        token: "verification_token",
      };

      const result = handleLarkChallenge(body, "verification_token");

      expect(result).toBeNull();
    });

    it("allows any token when verificationToken is not provided", () => {
      const body = {
        challenge: "test_challenge",
        token: "any_token",
      };

      const result = handleLarkChallenge(body, undefined);

      expect(result).toEqual({ challenge: "test_challenge" });
    });
  });

  describe("parseLarkMessageEvent", () => {
    it("parses text message event", () => {
      const body = {
        event: {
          sender: {
            senderId: {
              openId: "ou_xxx",
              userId: "user_xxx",
            },
            senderType: "user",
          },
          message: {
            messageId: "om_xxx",
            createTime: "1234567890",
            chatId: "oc_xxx",
            chatType: "p2p",
            messageType: "text",
            content: '{"text": "Hello"}',
          },
        },
      };

      const event = parseLarkMessageEvent(body);

      expect(event).not.toBeNull();
      expect(event?.sender.senderId.openId).toBe("ou_xxx");
      expect(event?.message.messageId).toBe("om_xxx");
      expect(event?.message.chatType).toBe("p2p");
    });

    it("returns null when event is missing", () => {
      const body = {};

      const event = parseLarkMessageEvent(body);

      expect(event).toBeNull();
    });

    it("returns null when message is missing", () => {
      const body = {
        event: {
          sender: {},
        },
      };

      const event = parseLarkMessageEvent(body);

      expect(event).toBeNull();
    });
  });
});
