import { describe, expect, it } from "vitest";
import { expectsSubagentFollowup, isLikelyInterimCronMessage } from "./subagent-followup.js";

describe("subagent follow-up phrase detection", () => {
  it("treats 'will report back' phrasing as expected follow-up", () => {
    expect(expectsSubagentFollowup("I'll report back once both subagents finish.")).toBe(true);
    expect(expectsSubagentFollowup("I will report back when done.")).toBe(true);
  });

  it("classifies short 'will report back' updates as interim", () => {
    expect(isLikelyInterimCronMessage("Will report back after the subagent completes.")).toBe(true);
  });

  it("does not classify detailed, final updates as interim", () => {
    const detailedUpdate =
      "I will report back is no longer relevant because the work already completed: " +
      "we extracted all requested records, verified each entry against source logs, " +
      "resolved mismatched timestamps, produced a reconciled summary for each source, " +
      "and confirmed there are no remaining active subagent runs. " +
      "The final report includes exact totals, anomaly notes, remediation status, " +
      "and handoff details for the next scheduled operation.";
    expect(isLikelyInterimCronMessage(detailedUpdate)).toBe(false);
  });
});
