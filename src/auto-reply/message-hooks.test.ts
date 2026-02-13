import { beforeEach, describe, expect, it } from "vitest";
import type { FinalizedMsgContext } from "./templating.js";
import {
  runPreMessageHooks,
  runPostMessageHooks,
  validateMessageHooksConfig,
  _resetRateLimitState,
  type MessageHooksConfig,
} from "./message-hooks.js";

// Mock context
const mockCtx: FinalizedMsgContext = {
  SessionKey: "test-session-123",
  Surface: "telegram",
  Provider: "telegram",
  SenderId: "user-456",
  SenderName: "Test User",
  RawBody: "Hello, how are you?",
  Body: "Hello, how are you?",
  MessageSid: "msg-789",
  From: "user-456",
  To: "bot-001",
  ChatType: "private",
};

describe("message-hooks", () => {
  // Reset rate limiting state before each test
  beforeEach(() => {
    _resetRateLimitState();
  });

  describe("validateMessageHooksConfig", () => {
    it("accepts undefined config", () => {
      expect(validateMessageHooksConfig(undefined)).toBe(true);
    });

    it("accepts null config", () => {
      expect(validateMessageHooksConfig(null)).toBe(true);
    });

    it("accepts empty object", () => {
      expect(validateMessageHooksConfig({})).toBe(true);
    });

    it("accepts valid minimal config", () => {
      const config: MessageHooksConfig = {
        enabled: true,
        preMessage: [{ command: "echo hello" }],
      };
      expect(validateMessageHooksConfig(config)).toBe(true);
    });

    it("accepts valid full config", () => {
      const config: MessageHooksConfig = {
        enabled: true,
        maxHooks: 5,
        aggregateTimeoutMs: 10000,
        allowedCommandPrefixes: ["python3 /opt/hooks/"],
        preMessage: [
          {
            command: "python3 /opt/hooks/recall.py",
            timeout: 3000,
            inject: true,
            env: { CUSTOM_VAR: "value" },
            sessionKeyPrefixes: ["main-"],
            channels: ["telegram", "signal"],
          },
        ],
        postMessage: [
          {
            command: "python3 /opt/hooks/capture.py",
            passContext: true,
          },
        ],
      };
      expect(validateMessageHooksConfig(config)).toBe(true);
    });

    it("rejects non-object config", () => {
      expect(validateMessageHooksConfig("invalid")).toBe(false);
      expect(validateMessageHooksConfig(123)).toBe(false);
      expect(validateMessageHooksConfig([])).toBe(false);
    });

    it("rejects invalid enabled type", () => {
      expect(validateMessageHooksConfig({ enabled: "yes" })).toBe(false);
    });

    it("rejects invalid maxHooks", () => {
      expect(validateMessageHooksConfig({ maxHooks: 0 })).toBe(false);
      expect(validateMessageHooksConfig({ maxHooks: -1 })).toBe(false);
      expect(validateMessageHooksConfig({ maxHooks: "5" })).toBe(false);
    });

    it("rejects invalid aggregateTimeoutMs", () => {
      expect(validateMessageHooksConfig({ aggregateTimeoutMs: 50 })).toBe(false);
      expect(validateMessageHooksConfig({ aggregateTimeoutMs: "1000" })).toBe(false);
    });

    it("rejects hook with empty command", () => {
      expect(validateMessageHooksConfig({ preMessage: [{ command: "" }] })).toBe(false);
      expect(validateMessageHooksConfig({ preMessage: [{ command: "  " }] })).toBe(false);
    });

    it("rejects hook with invalid timeout", () => {
      expect(
        validateMessageHooksConfig({
          preMessage: [{ command: "echo", timeout: -1 }],
        }),
      ).toBe(false);
    });
  });

  describe("runPreMessageHooks", () => {
    it("returns empty results when disabled", async () => {
      const result = await runPreMessageHooks({
        config: { enabled: false, preMessage: [{ command: "echo test" }] },
        ctx: mockCtx,
      });
      expect(result.hookResults).toHaveLength(0);
      expect(result.injectedContent).toBeUndefined();
    });

    it("returns empty results when no hooks configured", async () => {
      const result = await runPreMessageHooks({
        config: { enabled: true },
        ctx: mockCtx,
      });
      expect(result.hookResults).toHaveLength(0);
    });

    it("executes simple echo hook", async () => {
      const result = await runPreMessageHooks({
        config: {
          enabled: true,
          preMessage: [{ command: "echo 'test output'" }],
        },
        ctx: mockCtx,
      });
      expect(result.hookResults).toHaveLength(1);
      expect(result.hookResults[0].success).toBe(true);
      expect(result.hookResults[0].stdout).toBe("test output");
    });

    it("injects stdout when inject=true", async () => {
      const result = await runPreMessageHooks({
        config: {
          enabled: true,
          preMessage: [{ command: "echo 'injected context'", inject: true }],
        },
        ctx: mockCtx,
      });
      expect(result.injectedContent).toBe("injected context");
    });

    it("does not inject stdout when inject=false", async () => {
      const result = await runPreMessageHooks({
        config: {
          enabled: true,
          preMessage: [{ command: "echo 'not injected'", inject: false }],
        },
        ctx: mockCtx,
      });
      expect(result.injectedContent).toBeUndefined();
    });

    it("handles hook timeout", async () => {
      const result = await runPreMessageHooks({
        config: {
          enabled: true,
          preMessage: [{ command: "sleep 10", timeout: 100 }],
        },
        ctx: mockCtx,
      });
      expect(result.hookResults).toHaveLength(1);
      expect(result.hookResults[0].success).toBe(false);
      expect(result.hookResults[0].error).toContain("timed out");
    });

    it("filters by sessionKeyPrefixes", async () => {
      const result = await runPreMessageHooks({
        config: {
          enabled: true,
          preMessage: [
            {
              command: "echo 'should not run'",
              sessionKeyPrefixes: ["other-"],
            },
          ],
        },
        ctx: mockCtx, // SessionKey: "test-session-123"
      });
      expect(result.hookResults).toHaveLength(0);
    });

    it("filters by channels", async () => {
      const result = await runPreMessageHooks({
        config: {
          enabled: true,
          preMessage: [
            {
              command: "echo 'should not run'",
              channels: ["signal", "whatsapp"],
            },
          ],
        },
        ctx: mockCtx, // Surface: "telegram"
      });
      expect(result.hookResults).toHaveLength(0);
    });

    it("respects allowedCommandPrefixes", async () => {
      const result = await runPreMessageHooks({
        config: {
          enabled: true,
          allowedCommandPrefixes: ["python3 /safe/"],
          preMessage: [{ command: "echo 'blocked'" }],
        },
        ctx: mockCtx,
      });
      expect(result.hookResults).toHaveLength(0);
    });

    it("truncates when exceeding maxHooks", async () => {
      const result = await runPreMessageHooks({
        config: {
          enabled: true,
          maxHooks: 1,
          preMessage: [{ command: "echo 'first'" }, { command: "echo 'second'" }],
        },
        ctx: mockCtx,
      });
      expect(result.hookResults).toHaveLength(1);
      expect(result.truncated).toBe(true);
    });
  });

  describe("runPostMessageHooks", () => {
    it("returns empty results when disabled", async () => {
      const result = await runPostMessageHooks({
        config: { enabled: false, postMessage: [{ command: "echo test" }] },
        ctx: mockCtx,
      });
      expect(result.hookResults).toHaveLength(0);
    });

    it("executes post hooks with response context", async () => {
      const result = await runPostMessageHooks({
        config: {
          enabled: true,
          postMessage: [{ command: "echo 'captured'", passContext: true }],
        },
        ctx: mockCtx,
        responseText: "I'm doing well!",
        responseId: "resp-001",
      });
      expect(result.hookResults).toHaveLength(1);
      expect(result.hookResults[0].success).toBe(true);
    });
  });
});
