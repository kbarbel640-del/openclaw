import { afterEach, describe, expect, it, vi } from "vitest";
import type { OpenClawConfig } from "../config/config.js";
import { createExecApprovalForwarder, isSafeRegexPattern } from "./exec-approval-forwarder.js";

const baseRequest = {
  id: "req-1",
  request: {
    command: "echo hello",
    agentId: "main",
    sessionKey: "agent:main:main",
  },
  createdAtMs: 1000,
  expiresAtMs: 6000,
};

afterEach(() => {
  vi.useRealTimers();
});

function getFirstDeliveryText(deliver: ReturnType<typeof vi.fn>): string {
  const firstCall = deliver.mock.calls[0]?.[0] as
    | { payloads?: Array<{ text?: string }> }
    | undefined;
  return firstCall?.payloads?.[0]?.text ?? "";
}

const TARGETS_CFG = {
  approvals: {
    exec: {
      enabled: true,
      mode: "targets",
      targets: [{ channel: "telegram", to: "123" }],
    },
  },
} as OpenClawConfig;

function createForwarder(params: {
  cfg: OpenClawConfig;
  deliver?: ReturnType<typeof vi.fn>;
  resolveSessionTarget?: () => { channel: string; to: string } | null;
}) {
  const deliver = params.deliver ?? vi.fn().mockResolvedValue([]);
  const forwarder = createExecApprovalForwarder({
    getConfig: () => params.cfg,
    deliver: deliver as unknown as NonNullable<
      NonNullable<Parameters<typeof createExecApprovalForwarder>[0]>["deliver"]
    >,
    nowMs: () => 1000,
    resolveSessionTarget: params.resolveSessionTarget ?? (() => null),
  });
  return { deliver, forwarder };
}

describe("exec approval forwarder", () => {
  it("forwards to session target and resolves", async () => {
    vi.useFakeTimers();
    const cfg = {
      approvals: { exec: { enabled: true, mode: "session" } },
    } as OpenClawConfig;

    const { deliver, forwarder } = createForwarder({
      cfg,
      resolveSessionTarget: () => ({ channel: "slack", to: "U1" }),
    });

    await forwarder.handleRequested(baseRequest);
    expect(deliver).toHaveBeenCalledTimes(1);

    await forwarder.handleResolved({
      id: baseRequest.id,
      decision: "allow-once",
      resolvedBy: "slack:U1",
      ts: 2000,
    });
    expect(deliver).toHaveBeenCalledTimes(2);

    await vi.runAllTimersAsync();
    expect(deliver).toHaveBeenCalledTimes(2);
  });

  it("forwards to explicit targets and expires", async () => {
    vi.useFakeTimers();
    const { deliver, forwarder } = createForwarder({ cfg: TARGETS_CFG });

    await forwarder.handleRequested(baseRequest);
    expect(deliver).toHaveBeenCalledTimes(1);

    await vi.runAllTimersAsync();
    expect(deliver).toHaveBeenCalledTimes(2);
  });

  it("formats single-line commands as inline code", async () => {
    vi.useFakeTimers();
    const { deliver, forwarder } = createForwarder({ cfg: TARGETS_CFG });

    await forwarder.handleRequested(baseRequest);

    expect(getFirstDeliveryText(deliver)).toContain("Command: `echo hello`");
  });

  it("formats complex commands as fenced code blocks", async () => {
    vi.useFakeTimers();
    const { deliver, forwarder } = createForwarder({ cfg: TARGETS_CFG });

    await forwarder.handleRequested({
      ...baseRequest,
      request: {
        ...baseRequest.request,
        command: "echo `uname`\necho done",
      },
    });

    expect(getFirstDeliveryText(deliver)).toContain("Command:\n```\necho `uname`\necho done\n```");
  });

  it("skips discord forwarding targets", async () => {
    vi.useFakeTimers();
    const cfg = {
      approvals: { exec: { enabled: true, mode: "session" } },
    } as OpenClawConfig;

    const { deliver, forwarder } = createForwarder({
      cfg,
      resolveSessionTarget: () => ({ channel: "discord", to: "channel:123" }),
    });

    await forwarder.handleRequested(baseRequest);

    expect(deliver).not.toHaveBeenCalled();
  });

  it("uses a longer fence when command already contains triple backticks", async () => {
    vi.useFakeTimers();
    const { deliver, forwarder } = createForwarder({ cfg: TARGETS_CFG });

    await forwarder.handleRequested({
      ...baseRequest,
      request: {
        ...baseRequest.request,
        command: "echo ```danger```",
      },
    });

    expect(getFirstDeliveryText(deliver)).toContain("Command:\n````\necho ```danger```\n````");
  });
});

describe("isSafeRegexPattern", () => {
  it("accepts simple literal patterns", () => {
    expect(isSafeRegexPattern("agent:main")).toBe(true);
    expect(isSafeRegexPattern("discord")).toBe(true);
    expect(isSafeRegexPattern("")).toBe(true);
  });

  it("accepts safe regex patterns", () => {
    expect(isSafeRegexPattern("^agent:main$")).toBe(true);
    expect(isSafeRegexPattern("agent:\\w+")).toBe(true);
    expect(isSafeRegexPattern("session-[0-9]+")).toBe(true);
    expect(isSafeRegexPattern("(foo|bar)")).toBe(true);
  });

  it("rejects patterns longer than 200 characters", () => {
    expect(isSafeRegexPattern("a".repeat(201))).toBe(false);
  });

  it("allows patterns of exactly 200 characters", () => {
    expect(isSafeRegexPattern("a".repeat(200))).toBe(true);
  });

  it("rejects nested quantifiers like (a+)+", () => {
    expect(isSafeRegexPattern("(a+)+")).toBe(false);
  });

  it("rejects nested quantifiers like (a*)*", () => {
    expect(isSafeRegexPattern("(a*)*")).toBe(false);
  });

  it("rejects nested quantifiers like (a+)*", () => {
    expect(isSafeRegexPattern("(a+)*")).toBe(false);
  });

  it("rejects nested quantifiers like (a{2,})+", () => {
    expect(isSafeRegexPattern("(a{2,})+")).toBe(false);
  });

  it("rejects nested quantifiers like (a+)?", () => {
    expect(isSafeRegexPattern("(a+)?")).toBe(false);
  });

  it("rejects nested quantifiers like (a+){2,}", () => {
    expect(isSafeRegexPattern("(a+){2,}")).toBe(false);
  });

  it("rejects the classic ReDoS pattern (a+)+$", () => {
    expect(isSafeRegexPattern("(a+)+$")).toBe(false);
  });

  it("rejects non-greedy nested quantifiers like (a+?)+", () => {
    expect(isSafeRegexPattern("(a+?)+")).toBe(false);
  });

  it("rejects non-greedy nested quantifiers like (a*?)*", () => {
    expect(isSafeRegexPattern("(a*?)*")).toBe(false);
  });

  it("rejects non-greedy nested quantifiers like (a+?)*", () => {
    expect(isSafeRegexPattern("(a+?)*")).toBe(false);
  });

  it("rejects non-greedy nested quantifiers like (a{2,}?)+", () => {
    expect(isSafeRegexPattern("(a{2,}?)+")).toBe(false);
  });
});
