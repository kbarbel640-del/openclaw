import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SessionEntry } from "../../config/sessions.js";

const watchMock = vi.fn(() => ({
  on: vi.fn(),
  close: vi.fn(async () => undefined),
}));

const updateSessionStoreMock = vi.fn(async () => undefined);

vi.mock("chokidar", () => ({
  default: { watch: watchMock },
}));

vi.mock("../../config/sessions.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../config/sessions.js")>();
  return {
    ...actual,
    updateSessionStore: updateSessionStoreMock,
  };
});

vi.mock("../../infra/skills-remote.js", () => ({
  getRemoteSkillEligibility: () => undefined,
}));

describe("ensureSkillSnapshot stale snapshot refresh regression (#27125)", () => {
  const originalFastFlag = process.env.OPENCLAW_TEST_FAST;

  beforeEach(() => {
    watchMock.mockClear();
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

  it("rebuilds a stale persisted snapshot on first turn after watcher initialization", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "openclaw-27125-"));
    const workspaceDir = path.join(root, "workspace");
    const skillDir = path.join(workspaceDir, "skills", "demo-refresh-check");
    await fs.mkdir(skillDir, { recursive: true });
    await fs.writeFile(
      path.join(skillDir, "SKILL.md"),
      [
        "---",
        "name: demo-refresh-check",
        "description: Verifies stale snapshot refresh path",
        "---",
        "",
        "# demo-refresh-check",
        "",
      ].join("\n"),
      "utf-8",
    );

    const { ensureSkillSnapshot } = await import("./session-updates.js");
    const sessionKey = "agent:main:telegram:123";
    const sessionStore: Record<string, SessionEntry> = {
      [sessionKey]: {
        sessionId: "s1",
        updatedAt: Date.now() - 1_000,
        systemSent: true,
        skillsSnapshot: {
          version: 0,
          prompt: "stale",
          skills: [],
          resolvedSkills: [],
        },
      },
    };

    const result = await ensureSkillSnapshot({
      sessionEntry: sessionStore[sessionKey],
      sessionStore,
      sessionKey,
      sessionId: "s1",
      isFirstTurnInSession: false,
      workspaceDir,
      cfg: {} as never,
    });

    const resolvedNames = (result.skillsSnapshot?.resolvedSkills ?? []).map((s) => s.name);
    expect(watchMock).toHaveBeenCalled();
    expect(result.skillsSnapshot?.version).toBeGreaterThan(0);
    expect(resolvedNames).toContain("demo-refresh-check");
    expect(sessionStore[sessionKey]?.skillsSnapshot?.version).toBeGreaterThan(0);
  });
});
