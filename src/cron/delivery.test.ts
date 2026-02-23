import { describe, expect, it } from "vitest";
import type { CronJob } from "./types.js";
import { resolveCronDeliveryPlan } from "./delivery.js";

function makeJob(overrides: Partial<CronJob>): CronJob {
  const now = Date.now();
  return {
    id: "job-1",
    name: "test",
    enabled: true,
    createdAtMs: now,
    updatedAtMs: now,
    schedule: { kind: "every", everyMs: 60_000 },
    sessionTarget: "isolated",
    wakeMode: "next-heartbeat",
    payload: { kind: "agentTurn", message: "hello" },
    state: {},
    ...overrides,
  };
}

describe("resolveCronDeliveryPlan", () => {
  it("defaults to announce when delivery object has no mode", () => {
    const plan = resolveCronDeliveryPlan(
      makeJob({
        delivery: { channel: "telegram", to: "123", mode: undefined as never },
      }),
    );
    expect(plan.mode).toBe("announce");
    expect(plan.requested).toBe(true);
    expect(plan.channel).toBe("telegram");
    expect(plan.to).toBe("123");
  });

  it("respects legacy payload deliver=false", () => {
    const plan = resolveCronDeliveryPlan(
      makeJob({
        delivery: undefined,
        payload: { kind: "agentTurn", message: "hello", deliver: false },
      }),
    );
    expect(plan.mode).toBe("none");
    expect(plan.requested).toBe(false);
  });

  it("propagates accountId from delivery config", () => {
    const plan = resolveCronDeliveryPlan(
      makeJob({
        delivery: { mode: "announce", channel: "discord", to: "user:12345", accountId: "bot1" },
      }),
    );
    expect(plan.accountId).toBe("bot1");
    expect(plan.channel).toBe("discord");
    expect(plan.to).toBe("user:12345");
  });

  it("returns undefined accountId when not set in delivery config", () => {
    const plan = resolveCronDeliveryPlan(
      makeJob({
        delivery: { mode: "announce", channel: "discord", to: "user:12345" },
      }),
    );
    expect(plan.accountId).toBeUndefined();
  });

  it("returns undefined accountId for legacy payload jobs", () => {
    const plan = resolveCronDeliveryPlan(
      makeJob({
        delivery: undefined,
        payload: { kind: "agentTurn", message: "hello", deliver: true, to: "user:12345" },
      }),
    );
    expect(plan.accountId).toBeUndefined();
  });
});
