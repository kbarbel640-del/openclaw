import { describe, expect, it } from "vitest";
import {
  collectTextContentBlocks,
  isAnthropicServerContentBlock,
} from "./content-blocks.js";

describe("isAnthropicServerContentBlock", () => {
  it("returns true for server_tool_use and web_search_tool_result", () => {
    expect(isAnthropicServerContentBlock({ type: "server_tool_use" })).toBe(true);
    expect(isAnthropicServerContentBlock({ type: "web_search_tool_result" })).toBe(true);
  });

  it("returns false for text, toolCall, and invalid blocks", () => {
    expect(isAnthropicServerContentBlock({ type: "text", text: "hi" })).toBe(false);
    expect(isAnthropicServerContentBlock({ type: "toolCall", id: "1", name: "read" })).toBe(false);
    expect(isAnthropicServerContentBlock(null)).toBe(false);
    expect(isAnthropicServerContentBlock({})).toBe(false);
  });
});

describe("collectTextContentBlocks", () => {
  it("collects text content blocks in order", () => {
    const blocks = [
      { type: "text", text: "first" },
      { type: "image", data: "abc" },
      { type: "text", text: "second" },
    ];

    expect(collectTextContentBlocks(blocks)).toEqual(["first", "second"]);
  });

  it("ignores invalid entries and non-arrays", () => {
    expect(collectTextContentBlocks(null)).toEqual([]);
    expect(collectTextContentBlocks([{ type: "text", text: 1 }, undefined, "x"])).toEqual([]);
  });
});
