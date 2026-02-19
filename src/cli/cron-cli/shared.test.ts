import { describe, expect, it } from "vitest";
import type { CronJob } from "../../cron/types.js";
import type { RuntimeEnv } from "../../runtime.js";
import { parseAt, printCronList } from "./shared.js";

describe("parseAt", () => {
  it('parses "+2m" as ~2 minutes from now', () => {
    const before = Date.now();
    const result = parseAt("+2m");
    const after = Date.now();
    expect(result).not.toBeNull();
    const ms = new Date(result!).getTime();
    expect(ms).toBeGreaterThanOrEqual(before + 2 * 60_000);
    expect(ms).toBeLessThanOrEqual(after + 2 * 60_000);
  });

  it('parses "+1h" as ~1 hour from now', () => {
    const before = Date.now();
    const result = parseAt("+1h");
    expect(result).not.toBeNull();
    const ms = new Date(result!).getTime();
    expect(ms).toBeGreaterThanOrEqual(before + 3_600_000);
  });

  it('parses "20m" (no + prefix) as ~20 minutes from now', () => {
    const before = Date.now();
    const result = parseAt("20m");
    expect(result).not.toBeNull();
    const ms = new Date(result!).getTime();
    expect(ms).toBeGreaterThanOrEqual(before + 20 * 60_000);
  });
});

describe("printCronList", () => {
  it("handles job with undefined sessionTarget (#9649)", () => {
    const logs: string[] = [];
    const mockRuntime = {
      log: (msg: string) => logs.push(msg),
      error: () => {},
      exit: () => {},
    } as RuntimeEnv;

    // Simulate a job without sessionTarget (as reported in #9649)
    const jobWithUndefinedTarget = {
      id: "test-job-id",
      agentId: "main",
      name: "Test Job",
      enabled: true,
      createdAtMs: Date.now(),
      updatedAtMs: Date.now(),
      schedule: { kind: "at", at: new Date(Date.now() + 3600000).toISOString() },
      // sessionTarget is intentionally omitted to simulate the bug
      wakeMode: "next-heartbeat",
      payload: { kind: "systemEvent", text: "test" },
      state: { nextRunAtMs: Date.now() + 3600000 },
    } as CronJob;

    // This should not throw "Cannot read properties of undefined (reading 'trim')"
    expect(() => printCronList([jobWithUndefinedTarget], mockRuntime)).not.toThrow();

    // Verify output contains the job
    expect(logs.length).toBeGreaterThan(1);
    expect(logs.some((line) => line.includes("test-job-id"))).toBe(true);
  });

  it("handles job with defined sessionTarget", () => {
    const logs: string[] = [];
    const mockRuntime = {
      log: (msg: string) => logs.push(msg),
      error: () => {},
      exit: () => {},
    } as RuntimeEnv;

    const jobWithTarget: CronJob = {
      id: "test-job-id-2",
      agentId: "main",
      name: "Test Job 2",
      enabled: true,
      createdAtMs: Date.now(),
      updatedAtMs: Date.now(),
      schedule: { kind: "at", at: new Date(Date.now() + 3600000).toISOString() },
      sessionTarget: "isolated",
      wakeMode: "next-heartbeat",
      payload: { kind: "systemEvent", text: "test" },
      state: { nextRunAtMs: Date.now() + 3600000 },
    };

    expect(() => printCronList([jobWithTarget], mockRuntime)).not.toThrow();
    expect(logs.some((line) => line.includes("isolated"))).toBe(true);
  });
});
