import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SlackMonitorContext } from "./context.js";

const readChannelAllowFromStoreMock = vi.hoisted(() => vi.fn());

vi.mock("../../pairing/pairing-store.js", () => ({
  readChannelAllowFromStore: (...args: unknown[]) => readChannelAllowFromStoreMock(...args),
}));

import { resolveSlackEffectiveAllowFrom } from "./auth.js";

describe("resolveSlackEffectiveAllowFrom account scoping", () => {
  beforeEach(() => {
    readChannelAllowFromStoreMock.mockReset().mockResolvedValue(["U_OWNER"]);
  });

  it("reads pairing-store entries from the active account scope", async () => {
    const ctx = {
      dmPolicy: "pairing",
      allowFrom: [],
      accountId: "acct-team-a",
    } as unknown as SlackMonitorContext;

    const resolved = await resolveSlackEffectiveAllowFrom(ctx);

    expect(readChannelAllowFromStoreMock).toHaveBeenCalledWith("slack", process.env, "acct-team-a");
    expect(resolved.allowFromLower).toEqual(["u_owner"]);
  });

  it("does not read pairing-store entries in allowlist mode", async () => {
    const ctx = {
      dmPolicy: "allowlist",
      allowFrom: ["U_CFG"],
      accountId: "acct-team-a",
    } as unknown as SlackMonitorContext;

    const resolved = await resolveSlackEffectiveAllowFrom(ctx);

    expect(readChannelAllowFromStoreMock).not.toHaveBeenCalled();
    expect(resolved.allowFromLower).toEqual(["u_cfg"]);
  });
});
