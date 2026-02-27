import { describe, expect, it } from "vitest";
import { applyTargetToParams } from "./channel-target.js";

describe("applyTargetToParams", () => {
  it("maps target into to for send actions", () => {
    const args: Record<string, unknown> = {
      target: "channel:C123",
    };

    applyTargetToParams({ action: "send", args });

    expect(args.to).toBe("channel:C123");
  });

  it("maps target into channelId for channel-info actions", () => {
    const args: Record<string, unknown> = {
      target: "1234567890",
    };

    applyTargetToParams({ action: "channel-info", args });

    expect(args.channelId).toBe("1234567890");
  });

  it("throws actionable guidance for legacy to/channelId on routed actions", () => {
    const args: Record<string, unknown> = {
      to: "channel:C123",
    };

    expect(() => applyTargetToParams({ action: "send", args })).toThrow(
      /expects "target" for the destination/i,
    );
    expect(() => applyTargetToParams({ action: "send", args })).toThrow(
      /Replace legacy "to"\/"channelId" with "target"/i,
    );
  });

  it("throws actionable guidance when target is supplied for non-targeted actions", () => {
    const args: Record<string, unknown> = {
      target: "channel:C123",
    };

    expect(() => applyTargetToParams({ action: "search", args })).toThrow(
      /does not accept a destination target/i,
    );
  });
});
