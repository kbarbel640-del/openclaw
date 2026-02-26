import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const watchMock = vi.fn(() => ({
  on: vi.fn(),
  close: vi.fn(async () => undefined),
}));

const buildWorkspaceSkillSnapshotMock = vi.fn(
  (_workspaceDir: string, opts?: { snapshotVersion?: number }) => ({
    version: opts?.snapshotVersion ?? 0,
    prompt: "",
    skills: [],
    resolvedSkills: [],
  }),
);

const updateSessionStoreMock = vi.fn(async () => undefined);

vi.mock("chokidar", () => ({
  default: { watch: watchMock },
}));

vi.mock("../../agents/skills.js", () => ({
  buildWorkspaceSkillSnapshot: buildWorkspaceSkillSnapshotMock,
}));

vi.mock("../../config/sessions.js", () => ({
  updateSessionStore: updateSessionStoreMock,
}));

vi.mock("../../infra/skills-remote.js", () => ({
  getRemoteSkillEligibility: () => undefined,
}));

describe("ensureSkillSnapshot", () => {
  const originalFastFlag = process.env.OPENCLAW_TEST_FAST;

  beforeEach(() => {
    watchMock.mockClear();
    buildWorkspaceSkillSnapshotMock.mockClear();
    updateSessionStoreMock.mockClear();
    vi.resetModules();
    delete process.env.OPENCLAW_TEST_FAST;
  });

  afterEach(() => {
    if (originalFastFlag === undefined) {
      delete process.env.OPENCLAW_TEST_FAST;
    } else {
      process.env.OPENCLAW_TEST_FAST = originalFastFlag;
    }
  });

  it("refreshes stale persisted snapshots after watcher initialization", async () => {
    const mod = await import("./session-updates.js");
    const workspaceDir = `/tmp/skills-refresh-${Date.now()}`;
    const sessionKey = "agent:main:telegram:123";
    const staleSnapshot = {
      version: 0,
      prompt: "old",
      skills: [],
      resolvedSkills: [],
    };
    const sessionStore = {
      [sessionKey]: {
        sessionId: "s1",
        updatedAt: 1,
        skillsSnapshot: staleSnapshot,
      },
    };

    const result = await mod.ensureSkillSnapshot({
      sessionEntry: sessionStore[sessionKey],
      sessionStore,
      sessionKey,
      sessionId: "s1",
      isFirstTurnInSession: false,
      workspaceDir,
      cfg: {} as never,
    });

    expect(watchMock).toHaveBeenCalled();
    expect(buildWorkspaceSkillSnapshotMock).toHaveBeenCalled();
    expect(result.skillsSnapshot?.version).toBeGreaterThan(0);
    expect(sessionStore[sessionKey]?.skillsSnapshot?.version).toBeGreaterThan(0);
  });
});
