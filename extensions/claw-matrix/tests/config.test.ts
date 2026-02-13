/**
 * Tests for config.ts — Zod schema parsing and resolveMatrixAccount.
 */
import { describe, it, expect } from "vitest";
import { MatrixConfigSchema, resolveMatrixAccount } from "../src/config.js";

// ── Test Fixtures ────────────────────────────────────────────────────

const VALID_FULL_CONFIG = {
  channels: {
    matrix: {
      enabled: true,
      homeserver: "https://matrix.example.com",
      userId: "@bot:example.com",
      accessToken: "syt_abc123_xyz",
      password: "hunter2",
      encryption: true,
      deviceName: "TestDevice",
      dm: {
        policy: "open" as const,
        allowFrom: ["@admin:example.com"],
      },
      groupPolicy: "open" as const,
      groups: {
        "!room:example.com": { allow: true, requireMention: true },
      },
      groupAllowFrom: ["@admin:example.com"],
      chunkMode: "paragraph" as const,
      textChunkLimit: 2048,
      recoveryKey: "EsSZ 8bYP...",
      trustMode: "strict" as const,
      autoJoin: "always" as const,
      autoJoinAllowFrom: ["@admin:example.com"],
      replyToMode: "all" as const,
      maxMediaSize: 10_485_760,
      rateLimitTokens: 5,
      rateLimitRefillPerSec: 1,
    },
  },
};

const VALID_MINIMAL_CONFIG = {
  channels: {
    matrix: {
      homeserver: "https://matrix.example.com",
      userId: "@bot:example.com",
      accessToken: "syt_token",
    },
  },
};

describe("MatrixConfigSchema", () => {
  describe("valid full config", () => {
    it("should parse a complete valid config", () => {
      const result = MatrixConfigSchema.safeParse(VALID_FULL_CONFIG.channels.matrix);
      expect(result.success).toBeTruthy();
      expect(result.data.homeserver).toBe("https://matrix.example.com");
      expect(result.data.userId).toBe("@bot:example.com");
      expect(result.data.encryption).toBe(true);
      expect(result.data.deviceName).toBe("TestDevice");
      expect(result.data.trustMode).toBe("strict");
      expect(result.data.autoJoin).toBe("always");
      expect(result.data.replyToMode).toBe("all");
      expect(result.data.textChunkLimit).toBe(2048);
    });
  });

  describe("minimal config with defaults", () => {
    it("should apply defaults for omitted fields", () => {
      const result = MatrixConfigSchema.safeParse(VALID_MINIMAL_CONFIG.channels.matrix);
      expect(result.success).toBeTruthy();
      const data = result.data;
      expect(data.enabled).toBe(true);
      expect(data.encryption).toBe(true);
      expect(data.deviceName).toBe("OpenClaw");
      expect(data.trustMode).toBe("tofu");
      expect(data.autoJoin).toBe("off");
      expect(data.replyToMode).toBe("first");
      expect(data.chunkMode).toBe("length");
      expect(data.textChunkLimit).toBe(4096);
      expect(data.maxMediaSize).toBe(52_428_800);
      expect(data.rateLimitTokens).toBe(10);
      expect(data.rateLimitRefillPerSec).toBe(2);
      expect(data.groupPolicy).toBe("allowlist");
      expect(data.dm).toEqual({ policy: "allowlist", allowFrom: [] });
      expect(data.groups).toEqual({});
      expect(data.groupAllowFrom).toEqual([]);
      expect(data.autoJoinAllowFrom).toEqual([]);
    });
  });

  describe("homeserver normalization", () => {
    it("should strip trailing slashes from homeserver", () => {
      const result = MatrixConfigSchema.safeParse({
        ...VALID_MINIMAL_CONFIG.channels.matrix,
        homeserver: "https://matrix.example.com///",
      });
      expect(result.success).toBeTruthy();
      expect(result.data.homeserver).toBe("https://matrix.example.com");
    });

    it("should strip path from homeserver URL", () => {
      const result = MatrixConfigSchema.safeParse({
        ...VALID_MINIMAL_CONFIG.channels.matrix,
        homeserver: "https://matrix.example.com/some/path",
      });
      expect(result.success).toBeTruthy();
      expect(result.data.homeserver).toBe("https://matrix.example.com");
    });

    it("should reject non-HTTPS homeserver", () => {
      const result = MatrixConfigSchema.safeParse({
        ...VALID_MINIMAL_CONFIG.channels.matrix,
        homeserver: "http://matrix.example.com",
      });
      expect(!result.success).toBeTruthy();
    });
  });

  describe("userId validation", () => {
    it("should accept valid Matrix user IDs", () => {
      const result = MatrixConfigSchema.safeParse({
        ...VALID_MINIMAL_CONFIG.channels.matrix,
        userId: "@bot:matrix.org",
      });
      expect(result.success).toBeTruthy();
    });

    it("should reject user IDs without @", () => {
      const result = MatrixConfigSchema.safeParse({
        ...VALID_MINIMAL_CONFIG.channels.matrix,
        userId: "bot:matrix.org",
      });
      expect(!result.success).toBeTruthy();
    });

    it("should reject user IDs without domain", () => {
      const result = MatrixConfigSchema.safeParse({
        ...VALID_MINIMAL_CONFIG.channels.matrix,
        userId: "@bot",
      });
      expect(!result.success).toBeTruthy();
    });
  });

  describe("invalid configs", () => {
    it("should reject empty accessToken", () => {
      const result = MatrixConfigSchema.safeParse({
        ...VALID_MINIMAL_CONFIG.channels.matrix,
        accessToken: "",
      });
      expect(!result.success).toBeTruthy();
    });

    it("should reject invalid enum values", () => {
      const result = MatrixConfigSchema.safeParse({
        ...VALID_MINIMAL_CONFIG.channels.matrix,
        trustMode: "yolo",
      });
      expect(!result.success).toBeTruthy();
    });

    it("should reject invalid DM policy", () => {
      const result = MatrixConfigSchema.safeParse({
        ...VALID_MINIMAL_CONFIG.channels.matrix,
        dm: { policy: "invalid" },
      });
      expect(!result.success).toBeTruthy();
    });
  });
});

describe("resolveMatrixAccount", () => {
  describe("valid Zod path", () => {
    it("should resolve from full config", () => {
      const resolved = resolveMatrixAccount(VALID_FULL_CONFIG);
      expect(resolved.accountId).toBe("default");
      expect(resolved.homeserver).toBe("https://matrix.example.com");
      expect(resolved.userId).toBe("@bot:example.com");
      expect(resolved.accessToken).toBe("syt_abc123_xyz");
      expect(resolved.deviceName).toBe("TestDevice");
    });

    it("should resolve from minimal config with defaults", () => {
      const resolved = resolveMatrixAccount(VALID_MINIMAL_CONFIG);
      expect(resolved.accountId).toBe("default");
      expect(resolved.encryption).toBe(true);
      expect(resolved.deviceName).toBe("OpenClaw");
      expect(resolved.trustMode).toBe("tofu");
    });

    it("should accept null accountId as default", () => {
      const resolved = resolveMatrixAccount(VALID_MINIMAL_CONFIG, null);
      expect(resolved.accountId).toBe("default");
    });

    it("should accept 'default' accountId", () => {
      const resolved = resolveMatrixAccount(VALID_MINIMAL_CONFIG, "default");
      expect(resolved.accountId).toBe("default");
    });
  });

  describe("multi-account rejection", () => {
    it("should reject non-default accountId", () => {
      expect(() => resolveMatrixAccount(VALID_MINIMAL_CONFIG, "secondary")).toThrow(
        /not supported.*only a single account/,
      );
    });
  });

  describe("fallback path", () => {
    it("should fall back gracefully on missing channels.matrix", () => {
      const resolved = resolveMatrixAccount({});
      expect(resolved.accountId).toBe("default");
      expect(resolved.homeserver).toBe("");
      expect(resolved.accessToken).toBe("");
      expect(resolved.deviceName).toBe("OpenClaw");
    });

    it("should fall back on null input", () => {
      const resolved = resolveMatrixAccount(null);
      expect(resolved.accountId).toBe("default");
      expect(resolved.homeserver).toBe("");
    });

    it("should fall back on completely empty matrix config", () => {
      const resolved = resolveMatrixAccount({ channels: { matrix: {} } });
      expect(resolved.accountId).toBe("default");
      expect(resolved.enabled).toBe(true);
      expect(resolved.encryption).toBe(true);
    });

    it("should preserve values even when Zod validation fails", () => {
      // HTTP homeserver fails Zod's HTTPS requirement, but fallback preserves it
      const cfg = {
        channels: {
          matrix: {
            homeserver: "http://localhost:8448",
            userId: "@bot:localhost",
            accessToken: "token123",
          },
        },
      };
      const resolved = resolveMatrixAccount(cfg);
      expect(resolved.accessToken).toBe("token123");
      // Homeserver should be preserved via fallback
      expect(resolved.homeserver.includes("localhost")).toBeTruthy();
    });
  });
});
