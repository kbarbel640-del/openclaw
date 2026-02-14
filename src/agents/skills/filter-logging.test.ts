import { describe, expect, it, vi } from "vitest";

// Verify that filterSkillEntries uses the subsystem logger instead of console.log
describe("filterSkillEntries logging", () => {
  it("does not call console.log when skill filter is applied", async () => {
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    try {
      // Dynamic import to ensure fresh module state
      const { buildWorkspaceSkillsPrompt } = await import("./workspace.js");

      // Call with a filter that matches nothing — the filter path will execute
      buildWorkspaceSkillsPrompt("/tmp/nonexistent-workspace", {
        entries: [],
        skillFilter: ["some-skill"],
      });

      // console.log should NOT have been called with [skills] prefix
      const skillsCalls = consoleSpy.mock.calls.filter(
        (args) => typeof args[0] === "string" && args[0].includes("[skills]"),
      );
      expect(skillsCalls).toHaveLength(0);
    } finally {
      consoleSpy.mockRestore();
    }
  });
});
