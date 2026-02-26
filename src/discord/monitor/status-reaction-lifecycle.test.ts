import { describe, expect, it, vi } from "vitest";
import {
  __testing,
  createDiscordStatusReactionLifecycle,
  resolveDiscordStatusReactionProjection,
} from "./status-reaction-lifecycle.js";

describe("status-reaction-lifecycle", () => {
  it("keeps waiting-fresh and waiting-backlog mutually exclusive per message", async () => {
    const setReaction = vi.fn(async (_emoji: string) => {});
    const removeReaction = vi.fn(async (_emoji: string) => {});
    const lifecycle = createDiscordStatusReactionLifecycle({
      enabled: true,
      messageId: "m1",
      adapter: { setReaction, removeReaction },
      projection: resolveDiscordStatusReactionProjection(undefined, "👀"),
    });

    await lifecycle.enterWaiting(true);
    await lifecycle.enterActive();
    await lifecycle.complete(true);

    const emojis = setReaction.mock.calls.map((call) => call[0]);
    expect(emojis).toContain("⏳");
    expect(emojis).not.toContain("👀");
  });

  it("allows waiting -> terminal transition when active reaction fails", async () => {
    let activeFailed = false;
    const setReaction = vi.fn(async (emoji: string) => {
      if (emoji === "🤔" && !activeFailed) {
        activeFailed = true;
        throw new Error("active failed");
      }
    });
    const onError = vi.fn();
    const lifecycle = createDiscordStatusReactionLifecycle({
      enabled: true,
      messageId: "m2",
      adapter: { setReaction },
      projection: resolveDiscordStatusReactionProjection(undefined, "👀"),
      onError,
    });

    await lifecycle.enterWaiting(false);
    await lifecycle.enterActive();
    await lifecycle.complete(true);

    const emojis = setReaction.mock.calls.map((call) => call[0]);
    expect(emojis).toEqual(["👀", "🤔", "✅"]);
    expect(onError).toHaveBeenCalledTimes(1);
  });

  it("keeps queue order visible: backlog message can finish without showing fresh waiting", async () => {
    const setReaction = vi.fn(async (_emoji: string) => {});
    const lifecycle = createDiscordStatusReactionLifecycle({
      enabled: true,
      messageId: "m3",
      adapter: { setReaction },
      projection: resolveDiscordStatusReactionProjection(undefined, "👀"),
    });

    await lifecycle.enterWaiting(true);
    await lifecycle.complete(true);

    expect(setReaction.mock.calls.map((call) => call[0])).toEqual(["⏳", "✅"]);
  });

  it("records failed transition when active update fails", async () => {
    __testing.resetTraceEntriesForTests();
    const lifecycle = createDiscordStatusReactionLifecycle({
      enabled: true,
      messageId: "m4",
      adapter: {
        setReaction: async (emoji: string) => {
          if (emoji === "🤔") {
            throw new Error("boom");
          }
        },
      },
      projection: resolveDiscordStatusReactionProjection(undefined, "👀"),
    });

    await lifecycle.enterWaiting(false);
    await lifecycle.enterActive();

    const failed = __testing
      .getTraceEntriesForTests()
      .filter((entry) => entry.messageId === "m4" && entry.stage === "failed")
      .map((entry) => entry.state);
    expect(failed).toContain("active");
  });
});

it("reaches terminal state even when initial waiting reaction is still in flight", async () => {
  // This test verifies the fix for: if Discord is slow to apply the first
  // waiting reaction, complete() can be called while state is still idle,
  // and the lifecycle must still queue the terminal state.
  __testing.resetTraceEntriesForTests();
  const setReaction = vi.fn(async () => {});
  const lifecycle = createDiscordStatusReactionLifecycle({
    enabled: true,
    messageId: "m5",
    adapter: { setReaction },
    projection: resolveDiscordStatusReactionProjection(undefined, "👀"),
  });

  // Complete immediately without ever entering waiting/active
  // This simulates a very short run where the message finishes
  // before any reaction update settles.
  await lifecycle.complete(true);

  // The terminal state should have been queued and applied
  const trace = __testing.getTraceEntriesForTests().filter((e) => e.messageId === "m5");
  const queuedDone = trace.find((e) => e.state === "done" && e.stage === "queued");
  const appliedDone = trace.find((e) => e.state === "done" && e.stage === "applied");
  expect(queuedDone).toBeDefined();
  expect(appliedDone).toBeDefined();
});
