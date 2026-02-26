import { describe, expect, it, vi } from "vitest";

const { agentCtor } = vi.hoisted(() => ({
  agentCtor: vi.fn(function MockAgent(this: { options: unknown }, options: unknown) {
    this.options = options;
  }),
}));

vi.mock("undici", () => ({
  Agent: agentCtor,
}));

import { createPinnedDispatcher, type PinnedHostname } from "./ssrf.js";

describe("createPinnedDispatcher", () => {
  it("uses safe defaults for pinned lookups", () => {
    const lookup = vi.fn() as unknown as PinnedHostname["lookup"];
    const pinned: PinnedHostname = {
      hostname: "api.telegram.org",
      addresses: ["149.154.167.220"],
      lookup,
    };

    const dispatcher = createPinnedDispatcher(pinned);

    expect(dispatcher).toBeDefined();
    expect(agentCtor).toHaveBeenCalledWith({
      connect: {
        lookup,
        autoSelectFamily: true,
        autoSelectFamilyAttemptTimeout: 2_000,
      },
    });
  });

  it("respects explicit autoSelectFamily override", () => {
    const lookup = vi.fn() as unknown as PinnedHostname["lookup"];
    const pinned: PinnedHostname = {
      hostname: "api.telegram.org",
      addresses: ["149.154.167.220"],
      lookup,
    };

    createPinnedDispatcher(pinned, { autoSelectFamily: false });

    expect(agentCtor).toHaveBeenCalledWith({
      connect: {
        lookup,
        autoSelectFamily: false,
        autoSelectFamilyAttemptTimeout: 2_000,
      },
    });
  });

  it("respects explicit autoSelectFamilyAttemptTimeout override", () => {
    const lookup = vi.fn() as unknown as PinnedHostname["lookup"];
    const pinned: PinnedHostname = {
      hostname: "api.telegram.org",
      addresses: ["149.154.167.220"],
      lookup,
    };

    createPinnedDispatcher(pinned, { autoSelectFamilyAttemptTimeout: 5_000 });

    expect(agentCtor).toHaveBeenCalledWith({
      connect: {
        lookup,
        autoSelectFamily: true,
        autoSelectFamilyAttemptTimeout: 5_000,
      },
    });
  });
});
