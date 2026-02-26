import { describe, expect, it } from "vitest";
import { assertSupportedJobSpec } from "./jobs.js";

describe("assertSupportedJobSpec with custom session targets", () => {
  it("allows main + systemEvent", () => {
    expect(() =>
      assertSupportedJobSpec({
        sessionTarget: "main",
        payload: { kind: "systemEvent", text: "hello" },
      }),
    ).not.toThrow();
  });

  it("rejects main + agentTurn", () => {
    expect(() =>
      assertSupportedJobSpec({
        sessionTarget: "main",
        payload: { kind: "agentTurn", message: "hello" },
      }),
    ).toThrow('main cron jobs require payload.kind="systemEvent"');
  });

  it("allows isolated + agentTurn", () => {
    expect(() =>
      assertSupportedJobSpec({
        sessionTarget: "isolated",
        payload: { kind: "agentTurn", message: "hello" },
      }),
    ).not.toThrow();
  });

  it("allows custom named session + agentTurn", () => {
    expect(() =>
      assertSupportedJobSpec({
        sessionTarget: "scheduled",
        payload: { kind: "agentTurn", message: "run task" },
      }),
    ).not.toThrow();
  });

  it("rejects custom named session + systemEvent", () => {
    expect(() =>
      assertSupportedJobSpec({
        sessionTarget: "scheduled",
        payload: { kind: "systemEvent", text: "hello" },
      }),
    ).toThrow('non-main cron jobs require payload.kind="agentTurn"');
  });

  it("allows any kebab-case session name + agentTurn", () => {
    for (const name of ["research", "daily-scan", "market-watch", "act"]) {
      expect(() =>
        assertSupportedJobSpec({
          sessionTarget: name,
          payload: { kind: "agentTurn", message: "hello" },
        }),
      ).not.toThrow();
    }
  });
});
