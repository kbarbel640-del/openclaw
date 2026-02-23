import { describe, expect, it, vi } from "vitest";
import { runVerifier, resolveVerifierConfig, resolveFailMode } from "./index.js";

vi.mock("./webhook.js", () => ({
  callWebhookVerifier: vi.fn(() => ({ decision: "allow" })),
  redactToolParams: vi.fn((_, params: unknown) => params),
}));

vi.mock("./telegram.js", () => ({
  callTelegramVerifier: vi.fn(() => ({ decision: "allow" })),
  formatTelegramApprovalMessage: vi.fn(() => "test"),
  isAllowedSender: vi.fn(() => true),
}));

describe("resolveVerifierConfig", () => {
  it("returns undefined when verifier is disabled", () => {
    expect(resolveVerifierConfig({ enabled: false })).toBeUndefined();
  });

  it("returns undefined when no verifier configured", () => {
    expect(resolveVerifierConfig(undefined)).toBeUndefined();
  });

  it("returns config when enabled with webhook", () => {
    const cfg = {
      enabled: true,
      webhook: { url: "https://example.com/verify", timeout: 10 },
    };
    expect(resolveVerifierConfig(cfg)).toEqual(cfg);
  });

  it("returns undefined when enabled but no webhook or telegram", () => {
    expect(resolveVerifierConfig({ enabled: true })).toBeUndefined();
  });
});

describe("resolveFailMode", () => {
  it("defaults to deny when both undefined", () => {
    expect(resolveFailMode(undefined, undefined)).toBe("deny");
  });

  it("global deny wins over agent allow (most restrictive)", () => {
    expect(resolveFailMode("deny", "allow")).toBe("deny");
  });

  it("agent deny wins over global allow (most restrictive)", () => {
    expect(resolveFailMode("allow", "deny")).toBe("deny");
  });

  it("both allow results in allow", () => {
    expect(resolveFailMode("allow", "allow")).toBe("allow");
  });

  it("global deny with agent undefined results in deny", () => {
    expect(resolveFailMode("deny", undefined)).toBe("deny");
  });
});

describe("runVerifier", () => {
  it("allows when verifier is not configured", async () => {
    const result = await runVerifier({
      config: undefined,
      toolName: "exec",
      params: { command: "ls" },
    });
    expect(result.blocked).toBe(false);
  });

  it("allows when tool is not in scope", async () => {
    const result = await runVerifier({
      config: {
        enabled: true,
        scope: { include: ["exec"] },
        webhook: { url: "https://example.com/verify" },
      },
      toolName: "read",
      params: {},
    });
    expect(result.blocked).toBe(false);
  });

  it("blocks when failMode is deny and webhook returns error", async () => {
    const { callWebhookVerifier } = await import("./webhook.js");
    vi.mocked(callWebhookVerifier).mockResolvedValueOnce({
      decision: "error",
      reason: "timeout",
    });

    const result = await runVerifier({
      config: {
        enabled: true,
        failMode: "deny",
        webhook: { url: "https://example.com/verify" },
      },
      toolName: "exec",
      params: { command: "ls" },
    });
    expect(result.blocked).toBe(true);
  });

  it("allows when failMode is allow and webhook returns error", async () => {
    const { callWebhookVerifier } = await import("./webhook.js");
    vi.mocked(callWebhookVerifier).mockResolvedValueOnce({
      decision: "error",
      reason: "timeout",
    });

    const result = await runVerifier({
      config: {
        enabled: true,
        failMode: "allow",
        webhook: { url: "https://example.com/verify" },
      },
      toolName: "exec",
      params: { command: "ls" },
    });
    expect(result.blocked).toBe(false);
  });

  it("blocks when webhook explicitly denies", async () => {
    const { callWebhookVerifier } = await import("./webhook.js");
    vi.mocked(callWebhookVerifier).mockResolvedValueOnce({
      decision: "deny",
      reason: "policy violation",
    });

    const result = await runVerifier({
      config: {
        enabled: true,
        webhook: { url: "https://example.com/verify" },
      },
      toolName: "exec",
      params: { command: "rm -rf /" },
    });
    expect(result.blocked).toBe(true);
    expect((result as { reason: string }).reason).toContain("policy violation");
  });
});
