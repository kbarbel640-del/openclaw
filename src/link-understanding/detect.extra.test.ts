import { describe, expect, it } from "vitest";
import { extractLinksFromMessage } from "./detect.js";

describe("extractLinksFromMessage", () => {
  it("returns empty array for empty message", () => {
    expect(extractLinksFromMessage("")).toEqual([]);
    expect(extractLinksFromMessage("   ")).toEqual([]);
  });

  it("extracts bare HTTP URLs", () => {
    const links = extractLinksFromMessage("check https://example.com for details");
    expect(links).toEqual(["https://example.com"]);
  });

  it("extracts multiple URLs", () => {
    const links = extractLinksFromMessage("see https://a.com and https://b.com");
    expect(links).toEqual(["https://a.com", "https://b.com"]);
  });

  it("deduplicates identical URLs", () => {
    const links = extractLinksFromMessage("https://a.com https://a.com");
    expect(links).toEqual(["https://a.com"]);
  });

  it("ignores markdown link URLs", () => {
    const links = extractLinksFromMessage("[click here](https://hidden.com) https://visible.com");
    expect(links).toEqual(["https://visible.com"]);
  });

  it("respects maxLinks option", () => {
    const links = extractLinksFromMessage("https://a.com https://b.com https://c.com", {
      maxLinks: 2,
    });
    expect(links).toHaveLength(2);
  });

  it("filters out localhost URLs", () => {
    const links = extractLinksFromMessage("http://127.0.0.1:3000 https://real.com");
    expect(links).toEqual(["https://real.com"]);
  });

  it("handles http and https protocols", () => {
    const links = extractLinksFromMessage("http://old.com https://new.com");
    expect(links).toEqual(["http://old.com", "https://new.com"]);
  });

  it("handles URLs with paths and query params", () => {
    const links = extractLinksFromMessage("see https://example.com/path?q=1&b=2#hash");
    expect(links).toHaveLength(1);
    expect(links[0]).toContain("example.com/path");
  });
});
