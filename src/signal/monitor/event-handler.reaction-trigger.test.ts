import { beforeEach, describe, expect, it, vi } from "vitest";
import { createSignalEventHandler } from "./event-handler.js";
import {
  createBaseSignalEventHandlerDeps,
  createSignalReceiveEvent,
} from "./event-handler.test-harness.js";

const requestHeartbeatNowMock = vi.fn();
const enqueueSystemEventMock = vi.fn();

vi.mock("../../infra/heartbeat-wake.js", () => ({
  requestHeartbeatNow: (...args: unknown[]) => requestHeartbeatNowMock(...args),
}));

vi.mock("../../infra/system-events.js", () => ({
  enqueueSystemEvent: (...args: unknown[]) => enqueueSystemEventMock(...args),
}));

vi.mock("../../routing/resolve-route.js", () => ({
  resolveAgentRoute: vi.fn(() => ({ sessionKey: "test-session" })),
}));

vi.mock("../../pairing/pairing-store.js", () => ({
  readChannelAllowFromStore: vi.fn().mockResolvedValue([]),
  upsertChannelPairingRequest: vi.fn(),
}));

const REACTION_MSG = {
  emoji: "👍",
  targetAuthor: "+15550009999",
  targetSentTimestamp: 1700000001000,
  isRemove: false,
};

function makeDeps(reactionTrigger: string, account?: string) {
  return createBaseSignalEventHandlerDeps({
    // oxlint-disable-next-line typescript/no-explicit-any
    cfg: { channels: { signal: { reactionTrigger } } } as any,
    reactionMode: "all",
    account: account ?? "+15550009999",
    isSignalReactionMessage: (r): r is typeof REACTION_MSG =>
      r != null && typeof r === "object" && "emoji" in r,
    shouldEmitSignalReactionNotification: () => true,
    resolveSignalReactionTargets: () => [
      { kind: "phone" as const, id: "+15550009999", display: "+15550009999" },
    ],
    buildSignalReactionSystemEventText: () => "reaction event",
  });
}

describe("signal reactionTrigger", () => {
  beforeEach(() => {
    requestHeartbeatNowMock.mockClear();
    enqueueSystemEventMock.mockClear();
  });

  it("calls requestHeartbeatNow when reactionTrigger is 'all'", async () => {
    const handler = createSignalEventHandler(makeDeps("all"));
    await handler(
      createSignalReceiveEvent({
        dataMessage: undefined,
        typingMessage: undefined,
        reactionMessage: REACTION_MSG,
      }),
    );

    expect(enqueueSystemEventMock).toHaveBeenCalled();
    expect(requestHeartbeatNowMock).toHaveBeenCalledTimes(1);
    expect(requestHeartbeatNowMock).toHaveBeenCalledWith(
      expect.objectContaining({ reason: "reaction" }),
    );
  });

  it("does not call requestHeartbeatNow when reactionTrigger is 'off'", async () => {
    const handler = createSignalEventHandler(makeDeps("off"));
    await handler(
      createSignalReceiveEvent({
        dataMessage: undefined,
        typingMessage: undefined,
        reactionMessage: REACTION_MSG,
      }),
    );

    expect(enqueueSystemEventMock).toHaveBeenCalled();
    expect(requestHeartbeatNowMock).not.toHaveBeenCalled();
  });

  it("calls requestHeartbeatNow for 'own' when target matches account", async () => {
    const handler = createSignalEventHandler(makeDeps("own", "+15550009999"));
    await handler(
      createSignalReceiveEvent({
        dataMessage: undefined,
        typingMessage: undefined,
        reactionMessage: REACTION_MSG,
      }),
    );

    expect(requestHeartbeatNowMock).toHaveBeenCalledTimes(1);
  });

  it("does not call requestHeartbeatNow for 'own' when target does not match account", async () => {
    const handler = createSignalEventHandler(makeDeps("own", "+15551111111"));
    await handler(
      createSignalReceiveEvent({
        dataMessage: undefined,
        typingMessage: undefined,
        reactionMessage: REACTION_MSG,
      }),
    );

    expect(requestHeartbeatNowMock).not.toHaveBeenCalled();
  });
});
