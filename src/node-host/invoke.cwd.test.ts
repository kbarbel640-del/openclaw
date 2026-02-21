import os from "node:os";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import { handleInvoke } from "./invoke.js";
import type { NodeInvokeRequestPayload } from "./invoke.js";
import type { GatewayClient } from "../gateway/client.js";

vi.mock("../config/config.js", () => ({
  loadConfig: () => ({}),
}));

vi.mock("../agents/agent-scope.js", () => ({
  resolveAgentConfig: () => undefined,
}));

vi.mock("../infra/exec-approvals.js", () => ({
  ensureExecApprovals: () => {},
  readExecApprovalsSnapshot: () => ({ path: "", exists: false, hash: "", file: {} }),
  normalizeExecApprovals: (f: unknown) => f,
  resolveExecApprovals: () => ({
    agent: { security: "full", ask: "off", autoAllowSkills: false },
    allowlist: [],
    file: {},
    socketPath: "",
    token: "",
  }),
  analyzeArgvCommand: () => ({ ok: true, segments: [], shellCommand: null, cmdText: "whoami" }),
  evaluateExecAllowlist: () => ({ allowlistMatches: [], allowlistSatisfied: true }),
  evaluateShellAllowlist: () => ({
    analysisOk: true,
    allowlistMatches: [],
    allowlistSatisfied: true,
    segments: [],
  }),
  requiresExecApproval: () => false,
  recordAllowlistUse: () => {},
  addAllowlistEntry: () => {},
  saveExecApprovals: () => {},
  resolveExecApprovalsSocketPath: () => "",
  resolveSafeBins: () => new Set(),
  normalizeExecApprovals: (f: unknown) => f,
}));

vi.mock("../infra/system-run-command.js", () => ({
  validateSystemRunCommandConsistency: () => ({
    ok: true,
    shellCommand: null,
    cmdText: "whoami",
  }),
}));

function makeClient(calls: Array<{ method: string; params: unknown }>) {
  return {
    request: async (method: string, params: unknown) => {
      calls.push({ method, params });
    },
  } as unknown as GatewayClient;
}

function makeFrame(paramsJSON: object): NodeInvokeRequestPayload {
  return {
    id: "test-id",
    nodeId: "test-node",
    command: "system.run",
    paramsJSON: JSON.stringify(paramsJSON),
    timeoutMs: null,
    idempotencyKey: null,
  };
}

const skillBins = { current: async () => new Set<string>() };

describe("handleInvoke: cwd validation", () => {
  it("returns a clear error when cwd does not exist instead of spawn ENOENT", async () => {
    const calls: Array<{ method: string; params: unknown }> = [];
    const client = makeClient(calls);
    const nonExistentDir = path.join(os.tmpdir(), "openclaw-test-missing-dir-" + Date.now());

    await handleInvoke(
      makeFrame({
        command: ["whoami"],
        cwd: nonExistentDir,
        approved: true,
      }),
      client,
      skillBins,
    );

    const resultCall = calls.find((c) => c.method === "node.invoke.result");
    expect(resultCall).toBeDefined();
    const result = resultCall?.params as {
      ok: boolean;
      error?: { code: string; message: string };
    };
    expect(result.ok).toBe(false);
    expect(result.error?.code).toBe("INVALID_REQUEST");
    expect(result.error?.message).toContain("working directory not found");
    expect(result.error?.message).toContain(nonExistentDir);
    // Must NOT mention /bin/sh — that was the old misleading message
    expect(result.error?.message).not.toContain("/bin/sh");
  });

  it("proceeds normally when cwd exists", async () => {
    const calls: Array<{ method: string; params: unknown }> = [];
    const client = makeClient(calls);

    await handleInvoke(
      makeFrame({
        command: ["echo", "hello"],
        cwd: os.tmpdir(),
        approved: true,
      }),
      client,
      skillBins,
    );

    const resultCall = calls.find((c) => c.method === "node.invoke.result");
    expect(resultCall).toBeDefined();
    const result = resultCall?.params as { ok: boolean };
    // Should succeed (or fail for unrelated reasons, but not cwd-not-found)
    if (!result.ok) {
      const err = (resultCall?.params as { error?: { message?: string } }).error;
      expect(err?.message).not.toContain("working directory not found");
    }
  });
});
