import { describe, expect, it } from "vitest";
import {
  formatSkillsUsageCsv,
  formatSkillsUsageMarkdown,
  type SkillsUsageRow,
} from "../agents/skills-usage-store.js";
import {
  __buildSkillsUsageJsonPayloadForTest,
  __formatSkillsUsageTableForTest,
} from "./skills-cli.js";

const rows: SkillsUsageRow[] = [
  {
    skillName: "alpha",
    commandCalls: 2,
    mappedToolCalls: 3,
    totalCalls: 5,
    firstSeenAt: "2026-02-26T00:00:00.000Z",
    lastSeenAt: "2026-02-26T01:00:00.000Z",
  },
  {
    skillName: "beta",
    commandCalls: 0,
    mappedToolCalls: 1,
    totalCalls: 1,
    firstSeenAt: "2026-02-26T02:00:00.000Z",
    lastSeenAt: "2026-02-26T03:00:00.000Z",
  },
];

describe("skills usage formatting", () => {
  it("formats default table output", () => {
    const output = __formatSkillsUsageTableForTest(rows);
    expect(output).toContain("Skill");
    expect(output).toContain("alpha");
    expect(output).toContain("MappedTool");
  });

  it("formats csv output", () => {
    const output = formatSkillsUsageCsv(rows);
    expect(output).toContain(
      "skill,commandCalls,mappedToolCalls,totalCalls,firstSeenAt,lastSeenAt",
    );
    expect(output).toContain("alpha,2,3,5");
  });

  it("formats markdown output", () => {
    const output = formatSkillsUsageMarkdown(rows);
    expect(output).toContain("| Skill | Command Calls | Mapped Tool Calls | Total Calls |");
    expect(output).toContain("| alpha | 2 | 3 | 5 |");
  });

  it("builds json diagnostics output", () => {
    const payload = __buildSkillsUsageJsonPayloadForTest({
      rows,
      totalSkills: rows.length,
      since: null,
      mappedToolCallsTotal: 4,
      mappedByRunContext: 3,
      mappedByStaticDispatch: 1,
      unmappedToolCalls: 1,
      tracker: {
        mappedTools: 2,
        runCacheEntries: 1,
        runContextEntries: 1,
        pendingSessionContextEntries: 0,
        ttlMs: 1000,
        maxRuns: 10,
      },
    });
    expect(payload.summary.mappedToolCallsTotal).toBe(4);
    expect(payload.summary.mappedByRunContext).toBe(3);
    expect(payload.summary.mappedByStaticDispatch).toBe(1);
    expect(payload.summary.unmappedToolCalls).toBe(1);
    expect(payload.summary.mappingCoverage).toBe(0.8);
    expect(payload.summary.attributionStrategy).toBe("context-priority");
    expect(payload.summary.attributionStrategyVersion).toBe(1);
    expect(payload.tracker.runCacheEntries).toBe(1);
  });
});
