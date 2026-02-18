import { describe, expect, it } from "vitest";
import { resolveIsDirectMessage } from "./handler.js";

describe("resolveIsDirectMessage", () => {
  it("returns true when DM detected and room not in groups config", () => {
    expect(resolveIsDirectMessage(true, undefined)).toBe(true);
    expect(resolveIsDirectMessage(true, false)).toBe(true);
  });

  it("returns false when DM detected but room is explicitly allowed in groups", () => {
    // 2-member rooms listed in groups config should be treated as rooms, not DMs
    expect(resolveIsDirectMessage(true, true)).toBe(false);
  });

  it("returns false when DM not detected regardless of groups config", () => {
    expect(resolveIsDirectMessage(false, undefined)).toBe(false);
    expect(resolveIsDirectMessage(false, true)).toBe(false);
    expect(resolveIsDirectMessage(false, false)).toBe(false);
  });
});
