import { describe, expect, test } from "vitest";
import { buildExtraSystemPromptWithHotState } from "./hot-state-injection.js";
import { buildHotState } from "./hot-state.js";

describe("buildExtraSystemPromptWithHotState", () => {
  test("appends hot state JSON to existing extra system prompt", () => {
    const hotState = buildHotState({ session_id: "s1", risk_level: "low" });
    const { extraSystemPrompt, capped } = buildExtraSystemPromptWithHotState({
      extraSystemPrompt: "HELLO",
      hotState,
      maxHotStateTokens: 1000,
    });

    expect(capped.wasTruncated).toBe(false);
    expect(extraSystemPrompt.startsWith("HELLO\n\n")).toBe(true);
    expect(extraSystemPrompt).toContain('"session_id":"s1"');
  });

  test("returns just hot state JSON when no extra system prompt exists", () => {
    const hotState = buildHotState({ session_id: "s1" });
    const { extraSystemPrompt } = buildExtraSystemPromptWithHotState({
      hotState,
      maxHotStateTokens: 1000,
    });

    expect(extraSystemPrompt).toBe(JSON.stringify(hotState));
  });
});
