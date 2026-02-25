import { describe, expect, it } from "vitest";
import { META_MESSAGE_PREFIX, prefixMetaMessage } from "./meta-message.js";

describe("prefixMetaMessage", () => {
  it("prepends the meta prefix once", () => {
    expect(prefixMetaMessage("thread notice")).toBe(`${META_MESSAGE_PREFIX} thread notice`);
  });

  it("does not double-prefix messages that already start with the prefix", () => {
    expect(prefixMetaMessage(`${META_MESSAGE_PREFIX} already prefixed`)).toBe(
      `${META_MESSAGE_PREFIX} already prefixed`,
    );
  });
});
