// Re-trigger CI after rebase
import { describe, expect, it, vi } from "vitest";
import { registerSlackReactionEvents } from "./reactions.js";
import {
  createSlackSystemEventTestHarness,
  type SlackSystemEventTestOverrides,
} from "./system-event-test-harness.js";

const enqueueSystemEventMock = vi.fn();
const readAllowFromStoreMock = vi.fn();
const requestHeartbeatNowMock = vi.fn();

vi.mock("../../../infra/system-events.js", () => ({
  enqueueSystemEvent: (...args: unknown[]) => enqueueSystemEventMock(...args),
}));

vi.mock("../../../infra/heartbeat-wake.js", () => ({
  requestHeartbeatNow: (...args: unknown[]) => requestHeartbeatNowMock(...args),
}));

vi.mock("../../../pairing/pairing-store.js", () => ({
  readChannelAllowFromStore: (...args: unknown[]) => readAllowFromStoreMock(...args),
}));

type SlackReactionHandler = (args: {
  event: Record<string, unknown>;
  body: unknown;
}) => Promise<void>;

function createReactionContext(overrides?: SlackSystemEventTestOverrides) {
  const harness = createSlackSystemEventTestHarness(overrides);
  registerSlackReactionEvents({ ctx: harness.ctx });
  return {
    getAddedHandler: () => harness.getHandler("reaction_added") as SlackReactionHandler | null,
    getRemovedHandler: () => harness.getHandler("reaction_removed") as SlackReactionHandler | null,
  };
}

function makeReactionEvent(overrides?: { user?: string; channel?: string }) {
  return {
    type: "reaction_added",
    user: overrides?.user ?? "U1",
    reaction: "thumbsup",
    item: {
      type: "message",
      channel: overrides?.channel ?? "D1",
      ts: "123.456",
    },
    item_user: "UBOT",
  };
}

describe("registerSlackReactionEvents", () => {
  it("enqueues DM reaction system events when dmPolicy is open", async () => {
    enqueueSystemEventMock.mockClear();
    readAllowFromStoreMock.mockReset().mockResolvedValue([]);
    const { getAddedHandler } = createReactionContext({ dmPolicy: "open" });
    const addedHandler = getAddedHandler();
    expect(addedHandler).toBeTruthy();

    await addedHandler!({
      event: makeReactionEvent(),
      body: {},
    });

    expect(enqueueSystemEventMock).toHaveBeenCalledTimes(1);
  });

  it("blocks DM reaction system events when dmPolicy is disabled", async () => {
    enqueueSystemEventMock.mockClear();
    readAllowFromStoreMock.mockReset().mockResolvedValue([]);
    const { getAddedHandler } = createReactionContext({ dmPolicy: "disabled" });
    const addedHandler = getAddedHandler();
    expect(addedHandler).toBeTruthy();

    await addedHandler!({
      event: makeReactionEvent(),
      body: {},
    });

    expect(enqueueSystemEventMock).not.toHaveBeenCalled();
  });

  it("blocks DM reaction system events for unauthorized senders in allowlist mode", async () => {
    enqueueSystemEventMock.mockClear();
    readAllowFromStoreMock.mockReset().mockResolvedValue([]);
    const { getAddedHandler } = createReactionContext({
      dmPolicy: "allowlist",
      allowFrom: ["U2"],
    });
    const addedHandler = getAddedHandler();
    expect(addedHandler).toBeTruthy();

    await addedHandler!({
      event: makeReactionEvent({ user: "U1" }),
      body: {},
    });

    expect(enqueueSystemEventMock).not.toHaveBeenCalled();
  });

  it("allows DM reaction system events for authorized senders in allowlist mode", async () => {
    enqueueSystemEventMock.mockClear();
    readAllowFromStoreMock.mockReset().mockResolvedValue([]);
    const { getAddedHandler } = createReactionContext({
      dmPolicy: "allowlist",
      allowFrom: ["U1"],
    });
    const addedHandler = getAddedHandler();
    expect(addedHandler).toBeTruthy();

    await addedHandler!({
      event: makeReactionEvent({ user: "U1" }),
      body: {},
    });

    expect(enqueueSystemEventMock).toHaveBeenCalledTimes(1);
  });

  it("enqueues channel reaction events regardless of dmPolicy", async () => {
    enqueueSystemEventMock.mockClear();
    readAllowFromStoreMock.mockReset().mockResolvedValue([]);
    const { getRemovedHandler } = createReactionContext({
      dmPolicy: "disabled",
      channelType: "channel",
    });
    const removedHandler = getRemovedHandler();
    expect(removedHandler).toBeTruthy();

    await removedHandler!({
      event: {
        ...makeReactionEvent({ channel: "C1" }),
        type: "reaction_removed",
      },
      body: {},
    });

    expect(enqueueSystemEventMock).toHaveBeenCalledTimes(1);
  });

  it("blocks channel reaction events for users outside channel users allowlist", async () => {
    enqueueSystemEventMock.mockClear();
    readAllowFromStoreMock.mockReset().mockResolvedValue([]);
    const { getAddedHandler } = createReactionContext({
      dmPolicy: "open",
      channelType: "channel",
      channelUsers: ["U_OWNER"],
    });
    const addedHandler = getAddedHandler();
    expect(addedHandler).toBeTruthy();

    await addedHandler!({
      event: makeReactionEvent({ channel: "C1", user: "U_ATTACKER" }),
      body: {},
    });

    expect(enqueueSystemEventMock).not.toHaveBeenCalled();
  });

  describe("reactionTrigger", () => {
    it("does not call requestHeartbeatNow when reactionTrigger is off", async () => {
      enqueueSystemEventMock.mockClear();
      requestHeartbeatNowMock.mockClear();
      readAllowFromStoreMock.mockReset().mockResolvedValue([]);
      const { getAddedHandler } = createReactionContext({
        dmPolicy: "open",
        reactionTrigger: "off",
      });
      await getAddedHandler()!({ event: makeReactionEvent(), body: {} });

      expect(enqueueSystemEventMock).toHaveBeenCalledTimes(1);
      expect(requestHeartbeatNowMock).not.toHaveBeenCalled();
    });

    it("calls requestHeartbeatNow when reactionTrigger is 'all'", async () => {
      enqueueSystemEventMock.mockClear();
      requestHeartbeatNowMock.mockClear();
      readAllowFromStoreMock.mockReset().mockResolvedValue([]);
      const { getAddedHandler } = createReactionContext({
        dmPolicy: "open",
        reactionTrigger: "all",
      });
      await getAddedHandler()!({ event: makeReactionEvent(), body: {} });

      expect(enqueueSystemEventMock).toHaveBeenCalledTimes(1);
      expect(requestHeartbeatNowMock).toHaveBeenCalledTimes(1);
      expect(requestHeartbeatNowMock).toHaveBeenCalledWith(
        expect.objectContaining({ reason: "reaction" }),
      );
    });

    it("calls requestHeartbeatNow for 'own' when item_user matches botUserId", async () => {
      enqueueSystemEventMock.mockClear();
      requestHeartbeatNowMock.mockClear();
      readAllowFromStoreMock.mockReset().mockResolvedValue([]);
      const { getAddedHandler } = createReactionContext({
        dmPolicy: "open",
        reactionTrigger: "own",
        botUserId: "UBOT",
      });
      // item_user is "UBOT" in makeReactionEvent — matches botUserId
      await getAddedHandler()!({ event: makeReactionEvent(), body: {} });

      expect(requestHeartbeatNowMock).toHaveBeenCalledTimes(1);
    });

    it("does not call requestHeartbeatNow for 'own' when item_user differs from botUserId", async () => {
      enqueueSystemEventMock.mockClear();
      requestHeartbeatNowMock.mockClear();
      readAllowFromStoreMock.mockReset().mockResolvedValue([]);
      const { getAddedHandler } = createReactionContext({
        dmPolicy: "open",
        reactionTrigger: "own",
        botUserId: "UOTHER",
      });
      // item_user is "UBOT" — does not match botUserId "UOTHER"
      await getAddedHandler()!({ event: makeReactionEvent(), body: {} });

      expect(requestHeartbeatNowMock).not.toHaveBeenCalled();
    });
  });
});
