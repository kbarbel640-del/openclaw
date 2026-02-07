import { Buffer } from "node:buffer";
import { describe, expect, it } from "vitest";
import { rawDataToString } from "./ws.js";

describe("rawDataToString", () => {
  it("returns string data as-is", () => {
    expect(rawDataToString("hello" as unknown as Buffer)).toBe("hello");
  });

  it("converts Buffer to utf8 string", () => {
    const buf = Buffer.from("hello world");
    expect(rawDataToString(buf)).toBe("hello world");
  });

  it("converts Buffer with custom encoding", () => {
    const buf = Buffer.from("café", "utf8");
    expect(rawDataToString(buf, "utf8")).toBe("café");
  });

  it("converts ArrayBuffer to string", () => {
    const ab = new ArrayBuffer(5);
    const view = new Uint8Array(ab);
    view.set([104, 101, 108, 108, 111]); // "hello"
    expect(rawDataToString(ab as unknown as Buffer)).toBe("hello");
  });

  it("converts Buffer array to string", () => {
    const bufs = [Buffer.from("hel"), Buffer.from("lo")];
    expect(rawDataToString(bufs as unknown as Buffer)).toBe("hello");
  });

  it("handles empty buffer", () => {
    expect(rawDataToString(Buffer.alloc(0))).toBe("");
  });

  it("handles empty array of buffers", () => {
    expect(rawDataToString([] as unknown as Buffer)).toBe("");
  });
});
