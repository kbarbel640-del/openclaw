import { describe, expect, it, vi, beforeEach } from "vitest";

// Use vi.hoisted to create mocks before vi.mock factory runs
const { debugMock } = vi.hoisted(() => ({
  debugMock: vi.fn(),
}));

vi.mock("../../logging/subsystem.js", () => ({
  createSubsystemLogger: () => ({
    debug: debugMock,
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

// Mock external skill loader to avoid filesystem access
vi.mock("@mariozechner/pi-coding-agent", () => ({
  loadSkillsFromDir: () => [],
  formatSkillsForPrompt: () => "",
}));

vi.mock("./bundled-dir.js", () => ({
  resolveBundledSkillsDir: () => undefined,
}));

vi.mock("./plugin-skills.js", () => ({
  resolvePluginSkillDirs: () => [],
}));

import { buildWorkspaceSkillSnapshot } from "./workspace.js";

describe("workspace.ts uses skillsLogger (Fix #8)", () => {
  beforeEach(() => {
    debugMock.mockClear();
  });

  it("logs via skillsLogger.debug when skill filter is applied", () => {
    buildWorkspaceSkillSnapshot("/tmp/nonexistent", {
      skillFilter: ["some-skill"],
    });

    // filterSkillEntries should call skillsLogger.debug when skillFilter is provided
    expect(debugMock).toHaveBeenCalled();
    const messages = debugMock.mock.calls.map((call) => call[0]);
    expect(messages.some((msg: string) => msg.includes("skill filter"))).toBe(true);
  });

  it("does not use console.log for skill filtering", () => {
    const consoleSpy = vi.spyOn(console, "log");
    try {
      buildWorkspaceSkillSnapshot("/tmp/nonexistent", {
        skillFilter: ["some-skill"],
      });
      // Should NOT have called console.log for skill filter messages
      const consoleMessages = consoleSpy.mock.calls.map((call) => String(call[0] ?? ""));
      expect(
        consoleMessages.some((msg) => msg.includes("skill filter") || msg.includes("After filter")),
      ).toBe(false);
    } finally {
      consoleSpy.mockRestore();
    }
  });
});
