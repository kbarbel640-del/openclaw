import type { GatewayPlugin } from "@buape/carbon/gateway";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearGateways,
  getGateway,
  getGatewayBotUserId,
  publishGatewayVoiceServerUpdate,
  publishGatewayVoiceStateUpdate,
  registerGateway,
  setGatewayBotUserId,
  subscribeGatewayVoiceServerUpdates,
  subscribeGatewayVoiceStateUpdates,
  unregisterGateway,
} from "./gateway-registry.js";

function fakeGateway(props: Partial<GatewayPlugin> = {}): GatewayPlugin {
  return { isConnected: true, ...props } as unknown as GatewayPlugin;
}

describe("gateway-registry", () => {
  beforeEach(() => {
    clearGateways();
  });

  it("stores and retrieves a gateway by account", () => {
    const gateway = fakeGateway();
    registerGateway("account-a", gateway);
    expect(getGateway("account-a")).toBe(gateway);
    expect(getGateway("account-b")).toBeUndefined();
  });

  it("uses collision-safe key when accountId is undefined", () => {
    const gateway = fakeGateway();
    registerGateway(undefined, gateway);
    expect(getGateway(undefined)).toBe(gateway);
    // "default" as a literal account ID must not collide with the sentinel key
    expect(getGateway("default")).toBeUndefined();
  });

  it("unregisters a gateway", () => {
    const gateway = fakeGateway();
    registerGateway("account-a", gateway);
    unregisterGateway("account-a");
    expect(getGateway("account-a")).toBeUndefined();
  });

  it("clears all gateways", () => {
    registerGateway("a", fakeGateway());
    registerGateway("b", fakeGateway());
    clearGateways();
    expect(getGateway("a")).toBeUndefined();
    expect(getGateway("b")).toBeUndefined();
  });

  it("overwrites existing entry for same account", () => {
    const gateway1 = fakeGateway({ isConnected: true });
    const gateway2 = fakeGateway({ isConnected: false });
    registerGateway("account-a", gateway1);
    registerGateway("account-a", gateway2);
    expect(getGateway("account-a")).toBe(gateway2);
  });

  it("stores and updates bot user id metadata", () => {
    registerGateway("account-a", fakeGateway(), { botUserId: "123" });
    expect(getGatewayBotUserId("account-a")).toBe("123");

    setGatewayBotUserId("account-a", "456");
    expect(getGatewayBotUserId("account-a")).toBe("456");
  });

  it("relays voice state updates to subscribers", () => {
    const listener = vi.fn();
    const off = subscribeGatewayVoiceStateUpdates("account-a", listener);

    publishGatewayVoiceStateUpdate("account-a", {
      guild_id: "g1",
      user_id: "u1",
      channel_id: "c1",
      session_id: "s1",
      deaf: false,
      mute: false,
      self_deaf: false,
      self_mute: false,
      self_video: false,
      suppress: false,
    });

    expect(listener).toHaveBeenCalledTimes(1);

    off();
    publishGatewayVoiceStateUpdate("account-a", {
      guild_id: "g1",
      user_id: "u2",
      channel_id: null,
      session_id: "s2",
      deaf: false,
      mute: false,
      self_deaf: false,
      self_mute: false,
      self_video: false,
      suppress: false,
    });
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("relays voice server updates to subscribers", () => {
    const listener = vi.fn();
    subscribeGatewayVoiceServerUpdates("account-a", listener);

    publishGatewayVoiceServerUpdate("account-a", {
      guild_id: "g1",
      endpoint: "voice.discord.media",
      token: "token-1",
    });

    expect(listener).toHaveBeenCalledTimes(1);
  });
});
