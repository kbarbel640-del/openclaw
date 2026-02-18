import { describe, expect, it } from "vitest";
import { matchSteerTrigger, resolveQueueSettings } from "./settings.js";
import type { ResolveQueueSettingsParams } from "./types.js";

describe("matchSteerTrigger", () => {
  it("returns no match when triggers list is empty", () => {
    const result = matchSteerTrigger("hello world", []);
    expect(result.matched).toBe(false);
    expect(result.cleanedPrompt).toBe("hello world");
  });

  it("returns no match when triggers list is undefined", () => {
    const result = matchSteerTrigger("hello world", undefined);
    expect(result.matched).toBe(false);
    expect(result.cleanedPrompt).toBe("hello world");
  });

  it("returns no match when prompt is undefined", () => {
    const result = matchSteerTrigger(undefined, ["!"]);
    expect(result.matched).toBe(false);
    expect(result.cleanedPrompt).toBe("");
  });

  it("matches trigger at the start of the message", () => {
    const result = matchSteerTrigger("!! urgent message", ["!!"]);
    expect(result.matched).toBe(true);
    expect(result.cleanedPrompt).toBe("urgent message");
  });

  it("matches trigger at the end of the message (natural language style)", () => {
    const result = matchSteerTrigger("check this now!", ["!"]);
    expect(result.matched).toBe(true);
    expect(result.cleanedPrompt).toBe("check this now");
  });

  it("matches trigger anywhere in the message", () => {
    const result = matchSteerTrigger("please URGENT do this", ["URGENT"]);
    expect(result.matched).toBe(true);
    expect(result.cleanedPrompt).toBe("please do this");
  });

  it("is case-insensitive for trigger matching", () => {
    const result = matchSteerTrigger("urgent: check this", ["URGENT:"]);
    expect(result.matched).toBe(true);
    expect(result.cleanedPrompt).toBe("check this");
  });

  it("matches the first trigger in the list (priority order)", () => {
    const result = matchSteerTrigger("do this now!", ["!!", "!", "URGENT"]);
    expect(result.matched).toBe(true);
    // "!" matches first (before "!!" would even be checked because "!" appears)
  });

  it("does not match when prompt contains no trigger", () => {
    const result = matchSteerTrigger("hello world", ["!!", "URGENT"]);
    expect(result.matched).toBe(false);
    expect(result.cleanedPrompt).toBe("hello world");
  });

  it("strips trigger and normalises whitespace in cleaned prompt", () => {
    const result = matchSteerTrigger("do  this  !  now", ["!"]);
    expect(result.matched).toBe(true);
    expect(result.cleanedPrompt).toBe("do this now");
  });

  it("skips empty trigger strings", () => {
    const result = matchSteerTrigger("hello", ["", "STOP"]);
    expect(result.matched).toBe(false);
    expect(result.cleanedPrompt).toBe("hello");
  });
});

describe("resolveQueueSettings — steerTriggers integration", () => {
  const baseParams = (): ResolveQueueSettingsParams => ({
    cfg: {
      messages: {
        queue: {
          mode: "collect",
          steerTriggers: ["!", "STOP"],
        },
      },
    } as any,
  });

  it("returns collect mode when no trigger present", () => {
    const result = resolveQueueSettings({
      ...baseParams(),
      prompt: "regular message",
    });
    expect(result.mode).toBe("collect");
    expect(result.cleanedPrompt).toBeUndefined();
  });

  it("overrides to steer when trigger matches", () => {
    const result = resolveQueueSettings({
      ...baseParams(),
      prompt: "!urgent: check this now",
    });
    expect(result.mode).toBe("steer");
    expect(result.cleanedPrompt).toBe("urgent: check this now");
  });

  it("inline /queue directive takes priority over trigger", () => {
    const result = resolveQueueSettings({
      ...baseParams(),
      prompt: "!message",
      inlineMode: "followup",
    });
    expect(result.mode).toBe("followup");
  });

  it("does not override mode when steerTriggers is not configured", () => {
    const result = resolveQueueSettings({
      cfg: { messages: { queue: { mode: "collect" } } } as any,
      prompt: "!urgent",
    });
    expect(result.mode).toBe("collect");
    expect(result.cleanedPrompt).toBeUndefined();
  });
});
