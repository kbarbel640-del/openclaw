import { describe, expect, it, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  importSkill: vi.fn(),
  uninstallSkill: vi.fn(),
}));

vi.mock("../../agents/skills-import.js", () => ({
  importSkill: mocks.importSkill,
  uninstallSkill: mocks.uninstallSkill,
}));

const { skillsHandlers } = await import("./skills.js");

describe("skills.import", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("forwards validated params to importSkill", async () => {
    const result = {
      ok: true,
      skillName: "demo-skill",
      message: "installed",
      installedPath: "/tmp/demo-skill",
    };
    mocks.importSkill.mockResolvedValueOnce(result);

    let ok: boolean | null = null;
    let payload: unknown = null;
    let error: unknown = null;

    await skillsHandlers["skills.import"]({
      params: {
        source: "file",
        filePath: "/tmp/demo.skill",
        force: true,
      },
      respond: (success, res, err) => {
        ok = success;
        payload = res;
        error = err;
      },
    });

    expect(mocks.importSkill).toHaveBeenCalledWith(
      expect.objectContaining({
        source: "file",
        filePath: "/tmp/demo.skill",
        force: true,
      }),
    );
    expect(ok).toBe(true);
    expect(payload).toEqual(result);
    expect(error).toBeUndefined();
  });

  it("rejects invalid params before calling importSkill", async () => {
    let ok: boolean | null = null;
    let payload: unknown = null;
    let error: { message?: string } | undefined;

    await skillsHandlers["skills.import"]({
      params: {
        filePath: "/tmp/demo.skill",
      },
      respond: (success, res, err) => {
        ok = success;
        payload = res;
        error = err as { message?: string } | undefined;
      },
    });

    expect(mocks.importSkill).not.toHaveBeenCalled();
    expect(ok).toBe(false);
    expect(payload).toBeUndefined();
    expect(error?.message).toContain("invalid skills.import params");
  });
});

describe("skills.uninstall", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("forwards validated params to uninstallSkill", async () => {
    const result = {
      ok: true,
      skillName: "demo-skill",
      message: "removed",
    };
    mocks.uninstallSkill.mockResolvedValueOnce(result);

    let ok: boolean | null = null;
    let payload: unknown = null;
    let error: unknown = null;

    await skillsHandlers["skills.uninstall"]({
      params: {
        skillName: "demo-skill",
      },
      respond: (success, res, err) => {
        ok = success;
        payload = res;
        error = err;
      },
    });

    expect(mocks.uninstallSkill).toHaveBeenCalledWith({ skillName: "demo-skill" });
    expect(ok).toBe(true);
    expect(payload).toEqual(result);
    expect(error).toBeUndefined();
  });

  it("rejects invalid params before calling uninstallSkill", async () => {
    let ok: boolean | null = null;
    let payload: unknown = null;
    let error: { message?: string } | undefined;

    await skillsHandlers["skills.uninstall"]({
      params: {
        skillName: "",
      },
      respond: (success, res, err) => {
        ok = success;
        payload = res;
        error = err as { message?: string } | undefined;
      },
    });

    expect(mocks.uninstallSkill).not.toHaveBeenCalled();
    expect(ok).toBe(false);
    expect(payload).toBeUndefined();
    expect(error?.message).toContain("invalid skills.uninstall params");
  });
});
