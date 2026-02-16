import { describe, expect, it } from "vitest";
import { resolveCurrentDirectiveLevels } from "./directive-handling.levels.js";

describe("resolveCurrentDirectiveLevels", () => {
  const resolveDefaultThinkingLevel = async () => undefined;

  it("returns undefined elevated level when no session or config override", async () => {
    const result = await resolveCurrentDirectiveLevels({
      sessionEntry: {},
      agentCfg: {},
      resolveDefaultThinkingLevel,
    });
    expect(result.currentElevatedLevel).toBeUndefined();
  });

  it("returns session elevated level when set", async () => {
    const result = await resolveCurrentDirectiveLevels({
      sessionEntry: { elevatedLevel: "ask" },
      agentCfg: {},
      resolveDefaultThinkingLevel,
    });
    expect(result.currentElevatedLevel).toBe("ask");
  });

  it("returns config elevatedDefault when session has no override", async () => {
    const result = await resolveCurrentDirectiveLevels({
      sessionEntry: {},
      agentCfg: { elevatedDefault: "on" },
      resolveDefaultThinkingLevel,
    });
    expect(result.currentElevatedLevel).toBe("on");
  });

  it("session elevated level takes precedence over config default", async () => {
    const result = await resolveCurrentDirectiveLevels({
      sessionEntry: { elevatedLevel: "full" },
      agentCfg: { elevatedDefault: "ask" },
      resolveDefaultThinkingLevel,
    });
    expect(result.currentElevatedLevel).toBe("full");
  });

  it("does not default elevated level to 'on' when both session and config are empty", async () => {
    const result = await resolveCurrentDirectiveLevels({
      sessionEntry: undefined,
      agentCfg: undefined,
      resolveDefaultThinkingLevel,
    });
    expect(result.currentElevatedLevel).toBeUndefined();
  });
});
