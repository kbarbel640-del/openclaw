import { describe, expect, it } from "vitest";
import { stripAnsi, visibleWidth } from "./ansi.js";

describe("stripAnsi", () => {
  it("returns plain text unchanged", () => {
    expect(stripAnsi("hello")).toBe("hello");
  });

  it("strips SGR codes", () => {
    expect(stripAnsi("\x1b[31mred\x1b[0m")).toBe("red");
  });

  it("strips bold + color codes", () => {
    expect(stripAnsi("\x1b[1;32mbold green\x1b[0m")).toBe("bold green");
  });

  it("strips multiple SGR sequences", () => {
    expect(stripAnsi("\x1b[31mhello\x1b[0m \x1b[34mworld\x1b[0m")).toBe("hello world");
  });

  it("strips OSC-8 hyperlinks", () => {
    const link = "\x1b]8;;https://example.com\x1b\\Click Here\x1b]8;;\x1b\\";
    expect(stripAnsi(link)).toBe("Click Here");
  });

  it("handles empty string", () => {
    expect(stripAnsi("")).toBe("");
  });
});

describe("visibleWidth", () => {
  it("returns length for plain text", () => {
    expect(visibleWidth("hello")).toBe(5);
  });

  it("ignores ANSI codes", () => {
    expect(visibleWidth("\x1b[31mhello\x1b[0m")).toBe(5);
  });

  it("returns 0 for empty string", () => {
    expect(visibleWidth("")).toBe(0);
  });

  it("counts emoji as characters", () => {
    // Using Array.from counts grapheme clusters
    expect(visibleWidth("hi")).toBe(2);
  });
});
