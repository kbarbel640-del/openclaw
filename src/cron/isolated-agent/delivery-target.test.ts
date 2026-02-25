import { describe, expect, it, vi } from "vitest";
import type { OpenClawConfig } from "../../config/config.js";

vi.mock("../../config/sessions.js", () => ({
  loadSessionStore: vi.fn(),
  resolveAgentMainSessionKey: vi.fn().mockReturnValue("agent:main"),
  resolveStorePath: vi.fn().mockReturnValue("/tmp/test-store.json"),
}));

vi.mock("../../infra/outbound/channel-selection.js", () => ({
  resolveMessageChannelSelection: vi.fn().mockResolvedValue({ channel: "slack" }),
}));

vi.mock("../../infra/outbound/targets.js", () => ({
  resolveSessionDeliveryTarget: vi.fn(),
  resolveOutboundTarget: vi.fn().mockReturnValue({ ok: true, to: "user:U1234" }),
}));

import { loadSessionStore } from "../../config/sessions.js";
import { resolveSessionDeliveryTarget } from "../../infra/outbound/targets.js";
import { resolveDeliveryTarget } from "./delivery-target.js";

const cfg = {} as OpenClawConfig;

describe("resolveDeliveryTarget", () => {
  it("preserves threadId when to matches lastTo for non-announce", async () => {
    vi.mocked(loadSessionStore).mockReturnValue({
      "agent:main": {
        sessionId: "s1",
        updatedAt: 1000,
      },
    });
    vi.mocked(resolveSessionDeliveryTarget).mockReturnValue({
      channel: "slack",
      to: "user:U1234",
      threadId: "1771022193.447729",
      lastTo: "user:U1234",
      mode: "explicit",
    });

    const result = await resolveDeliveryTarget(cfg, "main", {
      channel: "slack",
      to: "user:U1234",
    });

    expect(result.threadId).toBe("1771022193.447729");
  });

  it("clears threadId when announce=true even when to matches lastTo", async () => {
    vi.mocked(loadSessionStore).mockReturnValue({
      "agent:main": {
        sessionId: "s1",
        updatedAt: 1000,
      },
    });
    vi.mocked(resolveSessionDeliveryTarget).mockReturnValue({
      channel: "slack",
      to: "user:U1234",
      threadId: "1771022193.447729",
      lastTo: "user:U1234",
      mode: "explicit",
    });

    const result = await resolveDeliveryTarget(cfg, "main", {
      channel: "slack",
      to: "user:U1234",
      announce: true,
    });

    expect(result.threadId).toBeUndefined();
  });

  it("clears threadId when to does not match lastTo", async () => {
    vi.mocked(loadSessionStore).mockReturnValue({
      "agent:main": {
        sessionId: "s1",
        updatedAt: 1000,
      },
    });
    vi.mocked(resolveSessionDeliveryTarget).mockReturnValue({
      channel: "slack",
      to: "user:U9999",
      threadId: "1771022193.447729",
      lastTo: "user:U1234",
      mode: "explicit",
    });

    const result = await resolveDeliveryTarget(cfg, "main", {
      channel: "slack",
      to: "user:U9999",
    });

    expect(result.threadId).toBeUndefined();
  });
});
