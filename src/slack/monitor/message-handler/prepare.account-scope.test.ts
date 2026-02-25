import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ResolvedSlackAccount } from "../../accounts.js";
import type { SlackMessageEvent } from "../../types.js";
import type { SlackMonitorContext } from "../context.js";

const upsertChannelPairingRequestMock = vi.hoisted(() => vi.fn());
const resolveSlackEffectiveAllowFromMock = vi.hoisted(() => vi.fn());

vi.mock("../../../pairing/pairing-store.js", () => ({
  upsertChannelPairingRequest: (...args: unknown[]) => upsertChannelPairingRequestMock(...args),
}));

vi.mock("../auth.js", () => ({
  resolveSlackEffectiveAllowFrom: (...args: unknown[]) =>
    resolveSlackEffectiveAllowFromMock(...args),
}));

import { prepareSlackMessage } from "./prepare.js";

describe("prepareSlackMessage account scoping", () => {
  beforeEach(() => {
    upsertChannelPairingRequestMock
      .mockReset()
      .mockResolvedValue({ code: "PAIRCODE", created: false });
    resolveSlackEffectiveAllowFromMock.mockReset().mockResolvedValue({
      allowFrom: [],
      allowFromLower: [],
    });
  });

  it("writes DM pairing requests into the active account scope", async () => {
    const ctx = {
      cfg: {},
      dmEnabled: true,
      dmPolicy: "pairing",
      allowNameMatching: false,
      resolveChannelName: async () => ({ type: "im" }),
      isChannelAllowed: () => true,
      resolveUserName: async () => ({ name: "Mallory" }),
    } as unknown as SlackMonitorContext;

    const account: ResolvedSlackAccount = {
      accountId: "acct-team-a",
      enabled: true,
      botTokenSource: "config",
      appTokenSource: "config",
      config: {},
    };

    const message = {
      channel: "D123",
      channel_type: "im",
      user: "U_ATTACKER",
      text: "hello",
      ts: "1.000",
    } as SlackMessageEvent;

    const prepared = await prepareSlackMessage({
      ctx,
      account,
      message,
      opts: { source: "message" },
    });

    expect(prepared).toBeNull();
    expect(upsertChannelPairingRequestMock).toHaveBeenCalledWith(
      expect.objectContaining({
        channel: "slack",
        id: "U_ATTACKER",
        accountId: "acct-team-a",
      }),
    );
  });
});
