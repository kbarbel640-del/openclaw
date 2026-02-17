import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import { CronService } from "./service.js";

const noopLogger = {
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
};

async function makeStorePath() {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "openclaw-cron-delivery-"));
  return {
    storePath: path.join(dir, "cron", "jobs.json"),
    cleanup: async () => {
      await fs.rm(dir, { recursive: true, force: true });
    },
  };
}

type DeliveryMode = "none" | "announce";

type DeliveryOverride = {
  mode: DeliveryMode;
  channel?: string;
  to?: string;
};

async function withCronService(
  params: {
    runIsolatedAgentJob?: () => Promise<{
      status: "ok" | "error";
      summary?: string;
      error?: string;
      delivered?: boolean;
    }>;
  },
  run: (context: {
    cron: CronService;
    enqueueSystemEvent: ReturnType<typeof vi.fn>;
    requestHeartbeatNow: ReturnType<typeof vi.fn>;
  }) => Promise<void>,
) {
  const store = await makeStorePath();
  const enqueueSystemEvent = vi.fn();
  const requestHeartbeatNow = vi.fn();
  const cron = new CronService({
    cronEnabled: true,
    storePath: store.storePath,
    log: noopLogger,
    enqueueSystemEvent,
    requestHeartbeatNow,
    runIsolatedAgentJob:
      params.runIsolatedAgentJob ??
      (vi.fn(async () => ({ status: "ok", summary: "done" })) as never),
  });

  await cron.start();
  try {
    await run({ cron, enqueueSystemEvent, requestHeartbeatNow });
  } finally {
    cron.stop();
    await store.cleanup();
  }
}

async function addIsolatedAgentTurnJob(
  cron: CronService,
  params: {
    name: string;
    wakeMode: "next-heartbeat" | "now";
    payload?: { deliver?: boolean };
    delivery?: DeliveryOverride;
  },
) {
  return cron.add({
    name: params.name,
    schedule: { kind: "every", everyMs: 60_000, anchorMs: Date.now() },
    sessionTarget: "isolated",
    wakeMode: params.wakeMode,
    payload: {
      kind: "agentTurn",
      message: "hello",
      ...params.payload,
    },
    ...(params.delivery
      ? {
          delivery: params.delivery as unknown as {
            mode: DeliveryMode;
            channel?: string;
            to?: string;
          },
        }
      : {}),
  });
}

describe("CronService delivery plan consistency", () => {
  it("does not post isolated summary when legacy deliver=false", async () => {
    await withCronService({}, async ({ cron, enqueueSystemEvent }) => {
      const job = await addIsolatedAgentTurnJob(cron, {
        name: "legacy-off",
        wakeMode: "next-heartbeat",
        payload: { deliver: false },
      });

      const result = await cron.run(job.id, "force");
      expect(result).toEqual({ ok: true, ran: true });
      expect(enqueueSystemEvent).not.toHaveBeenCalled();
    });
  });

  it("treats delivery object without mode as announce", async () => {
    await withCronService({}, async ({ cron, enqueueSystemEvent }) => {
      const job = await addIsolatedAgentTurnJob(cron, {
        name: "partial-delivery",
        wakeMode: "next-heartbeat",
        delivery: { channel: "telegram", to: "123" } as DeliveryOverride,
      });

      const result = await cron.run(job.id, "force");
      expect(result).toEqual({ ok: true, ran: true });
      expect(enqueueSystemEvent).toHaveBeenCalledWith(
        "Cron: done",
        expect.objectContaining({ agentId: undefined }),
      );
    });
  });

  it("does not enqueue duplicate relay when isolated run marks delivery handled", async () => {
    await withCronService(
      {
        runIsolatedAgentJob: vi.fn(async () => ({
          status: "ok",
          summary: "done",
          delivered: true,
        })),
      },
      async ({ cron, enqueueSystemEvent, requestHeartbeatNow }) => {
        const job = await addIsolatedAgentTurnJob(cron, {
          name: "announce-delivered",
          wakeMode: "now",
          delivery: { channel: "telegram", to: "123" } as DeliveryOverride,
        });

        const result = await cron.run(job.id, "force");
        expect(result).toEqual({ ok: true, ran: true });
        expect(enqueueSystemEvent).not.toHaveBeenCalled();
        expect(requestHeartbeatNow).not.toHaveBeenCalled();
      },
    );
  });

  it("labels summary relays as delivery fallback when outbound send fails", async () => {
    await withCronService(
      {
        runIsolatedAgentJob: vi.fn(async () => ({
          status: "error",
          summary: "done",
          error: "cron announce delivery failed",
        })),
      },
      async ({ cron, enqueueSystemEvent }) => {
        const job = await addIsolatedAgentTurnJob(cron, {
          name: "delivery-fallback-summary",
          wakeMode: "next-heartbeat",
          delivery: { mode: "announce", channel: "telegram", to: "123" } as DeliveryOverride,
        });

        const result = await cron.run(job.id, "force");
        expect(result).toEqual({ ok: true, ran: true });
        expect(enqueueSystemEvent).toHaveBeenCalledWith(
          "Cron (delivery fallback): done",
          expect.objectContaining({ agentId: undefined }),
        );
      },
    );
  });

  it("still relays explicit fallback notice when delivery fails without summary", async () => {
    await withCronService(
      {
        runIsolatedAgentJob: vi.fn(async () => ({
          status: "error",
          error: "cron delivery target is missing",
        })),
      },
      async ({ cron, enqueueSystemEvent }) => {
        const job = await addIsolatedAgentTurnJob(cron, {
          name: "delivery-fallback-nosummary",
          wakeMode: "next-heartbeat",
          delivery: { mode: "announce", channel: "telegram", to: "123" } as DeliveryOverride,
        });

        const result = await cron.run(job.id, "force");
        expect(result).toEqual({ ok: true, ran: true });
        expect(enqueueSystemEvent).toHaveBeenCalledWith(
          expect.stringContaining("Cron (delivery fallback): outbound delivery failed"),
          expect.objectContaining({ agentId: undefined }),
        );
      },
    );
  });
});
