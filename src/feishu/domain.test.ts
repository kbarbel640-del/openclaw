import { describe, expect, it } from "vitest";
import {
  normalizeFeishuDomain,
  resolveFeishuDomain,
  resolveFeishuApiBase,
  FEISHU_DOMAIN,
  LARK_DOMAIN,
} from "./domain.js";

describe("normalizeFeishuDomain", () => {
  it("returns undefined for null/undefined/empty", () => {
    expect(normalizeFeishuDomain(null)).toBeUndefined();
    expect(normalizeFeishuDomain(undefined)).toBeUndefined();
    expect(normalizeFeishuDomain("")).toBeUndefined();
    expect(normalizeFeishuDomain("   ")).toBeUndefined();
  });

  it("maps 'feishu' to FEISHU_DOMAIN", () => {
    expect(normalizeFeishuDomain("feishu")).toBe(FEISHU_DOMAIN);
    expect(normalizeFeishuDomain("cn")).toBe(FEISHU_DOMAIN);
    expect(normalizeFeishuDomain("china")).toBe(FEISHU_DOMAIN);
  });

  it("maps 'lark' to LARK_DOMAIN", () => {
    expect(normalizeFeishuDomain("lark")).toBe(LARK_DOMAIN);
    expect(normalizeFeishuDomain("global")).toBe(LARK_DOMAIN);
    expect(normalizeFeishuDomain("intl")).toBe(LARK_DOMAIN);
    expect(normalizeFeishuDomain("international")).toBe(LARK_DOMAIN);
  });

  it("is case-insensitive", () => {
    expect(normalizeFeishuDomain("FEISHU")).toBe(FEISHU_DOMAIN);
    expect(normalizeFeishuDomain("Lark")).toBe(LARK_DOMAIN);
  });

  it("adds https:// to bare domains", () => {
    expect(normalizeFeishuDomain("custom.example.com")).toBe("https://custom.example.com");
  });

  it("preserves existing scheme", () => {
    expect(normalizeFeishuDomain("https://custom.example.com")).toBe("https://custom.example.com");
  });

  it("strips trailing slashes", () => {
    expect(normalizeFeishuDomain("https://custom.example.com/")).toBe("https://custom.example.com");
  });

  it("strips /open-apis suffix", () => {
    expect(normalizeFeishuDomain("https://custom.example.com/open-apis")).toBe(
      "https://custom.example.com",
    );
  });
});

describe("resolveFeishuDomain", () => {
  it("defaults to FEISHU_DOMAIN when undefined", () => {
    expect(resolveFeishuDomain(undefined)).toBe(FEISHU_DOMAIN);
  });

  it("returns custom domain when provided", () => {
    expect(resolveFeishuDomain("lark")).toBe(LARK_DOMAIN);
  });
});

describe("resolveFeishuApiBase", () => {
  it("appends /open-apis to resolved domain", () => {
    expect(resolveFeishuApiBase(undefined)).toBe(`${FEISHU_DOMAIN}/open-apis`);
    expect(resolveFeishuApiBase("lark")).toBe(`${LARK_DOMAIN}/open-apis`);
  });

  it("strips trailing slashes before appending", () => {
    expect(resolveFeishuApiBase("https://custom.example.com/")).toBe(
      "https://custom.example.com/open-apis",
    );
  });
});
