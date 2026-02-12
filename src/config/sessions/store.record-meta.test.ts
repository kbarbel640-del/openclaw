import { describe, expect, it } from "vitest";
import { recordSessionMetaFromInbound } from "./store.js";

describe("recordSessionMetaFromInbound", () => {
  it("returns null when storePath is undefined", async () => {
    const result = await recordSessionMetaFromInbound({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      storePath: undefined as any,
      sessionKey: "agent:main:telegram:default:direct:12345",
      ctx: { Provider: "telegram", From: "12345" },
    });
    expect(result).toBeNull();
  });

  it("returns null when storePath is empty string", async () => {
    const result = await recordSessionMetaFromInbound({
      storePath: "",
      sessionKey: "agent:main:telegram:default:direct:12345",
      ctx: { Provider: "telegram", From: "12345" },
    });
    expect(result).toBeNull();
  });
});
