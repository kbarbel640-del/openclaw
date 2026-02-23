import { beforeEach, describe, expect, it, vi } from "vitest";
import type { RestartSentinelPayload } from "../../infra/restart-sentinel.js";

let capturedSentinel: RestartSentinelPayload | undefined;

const scheduleGatewaySigusr1RestartMock = vi.fn(() => ({ scheduled: true }));
const installSkillMock = vi.fn<(...args: unknown[]) => Promise<{ ok: boolean; message: string }>>();

vi.mock("../../agents/agent-scope.js", () => ({
  resolveAgentWorkspaceDir: () => "/tmp/workspace",
  resolveDefaultAgentId: () => "default",
  listAgentIds: () => ["default"],
}));

vi.mock("../../agents/skills-install.js", () => ({
  installSkill: (...args: unknown[]) => installSkillMock(...args),
}));

vi.mock("../../agents/skills-status.js", () => ({
  buildWorkspaceSkillStatus: () => ({}),
}));

vi.mock("../../agents/skills.js", () => ({
  loadWorkspaceSkillEntries: () => [],
}));

vi.mock("../../agents/workspace-dirs.js", () => ({
  listAgentWorkspaceDirs: () => ["/tmp/workspace"],
}));

vi.mock("../../config/config.js", () => ({
  loadConfig: () => ({}),
  writeConfigFile: async () => {},
}));

vi.mock("../../infra/restart-sentinel.js", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...(actual as Record<string, unknown>),
    writeRestartSentinel: async (payload: RestartSentinelPayload) => {
      capturedSentinel = payload;
      return "/tmp/sentinel.json";
    },
  };
});

vi.mock("../../infra/restart.js", () => ({
  scheduleGatewaySigusr1Restart: scheduleGatewaySigusr1RestartMock,
}));

vi.mock("../../infra/skills-remote.js", () => ({
  getRemoteSkillEligibility: () => ({ eligible: false }),
}));

vi.mock("../../routing/session-key.js", () => ({
  normalizeAgentId: (id: string) => id,
}));

vi.mock("../../utils/normalize-secret-input.js", () => ({
  normalizeSecretInput: (s: string) => s.trim(),
}));

vi.mock("../protocol/index.js", () => ({
  ErrorCodes: { INVALID_REQUEST: -1, UNAVAILABLE: -2 },
  errorShape: (code: number, msg: string) => ({ code, message: msg }),
  formatValidationErrors: () => "validation error",
  validateSkillsBinsParams: () => true,
  validateSkillsInstallParams: () => true,
  validateSkillsStatusParams: () => true,
  validateSkillsUpdateParams: () => true,
}));

beforeEach(() => {
  capturedSentinel = undefined;
  installSkillMock.mockClear();
  scheduleGatewaySigusr1RestartMock.mockClear();
  scheduleGatewaySigusr1RestartMock.mockReturnValue({ scheduled: true });
});

async function invokeSkillsInstall(
  params: Record<string, unknown>,
): Promise<{ ok: boolean; result?: unknown; error?: unknown }> {
  const { skillsHandlers } = await import("./skills.js");
  let captured: { ok: boolean; result?: unknown; error?: unknown } | undefined;
  const respond = (ok: boolean, result?: unknown, error?: unknown) => {
    captured = { ok, result, error };
  };
  await skillsHandlers["skills.install"]({
    params,
    respond: respond as never,
  } as never);
  return captured!;
}

describe("skills.install restart", () => {
  it("schedules restart after successful install", async () => {
    installSkillMock.mockResolvedValue({ ok: true, message: "installed" });

    const res = await invokeSkillsInstall({
      name: "test-skill",
      installId: "abc-123",
    });

    expect(res.ok).toBe(true);
    expect(scheduleGatewaySigusr1RestartMock).toHaveBeenCalledTimes(1);
    expect(scheduleGatewaySigusr1RestartMock).toHaveBeenCalledWith({
      reason: "skills.install",
    });
  });

  it("writes restart sentinel after successful install", async () => {
    installSkillMock.mockResolvedValue({ ok: true, message: "installed" });

    await invokeSkillsInstall({
      name: "test-skill",
      installId: "abc-123",
    });

    expect(capturedSentinel).toBeDefined();
    expect(capturedSentinel!.kind).toBe("restart");
    expect(capturedSentinel!.status).toBe("ok");
    expect(capturedSentinel!.message).toBe("Gateway restarted to load updated skills.");
  });

  it("does NOT schedule restart after failed install", async () => {
    installSkillMock.mockResolvedValue({ ok: false, message: "not found" });

    const res = await invokeSkillsInstall({
      name: "nonexistent-skill",
      installId: "xyz-456",
    });

    expect(res.ok).toBe(false);
    expect(scheduleGatewaySigusr1RestartMock).not.toHaveBeenCalled();
    expect(capturedSentinel).toBeUndefined();
  });
});
