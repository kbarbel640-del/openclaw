import { describe, expect, it } from "vitest";
import { convertMarkdownTables } from "./tables.js";

describe("convertMarkdownTables", () => {
  it("returns empty string for empty input", () => {
    expect(convertMarkdownTables("", "bullets")).toBe("");
  });

  it("returns original for 'off' mode", () => {
    const md = "| A | B |\n|---|---|\n| 1 | 2 |";
    expect(convertMarkdownTables(md, "off")).toBe(md);
  });

  it("returns original when no tables present", () => {
    const md = "Hello world\n\nNo tables here.";
    expect(convertMarkdownTables(md, "bullets")).toBe(md);
  });

  it("converts table to bullet format", () => {
    const md = "| Name | Age |\n|------|-----|\n| Alice | 30 |\n| Bob | 25 |";
    const result = convertMarkdownTables(md, "bullets");
    expect(result).not.toContain("|");
    // Should contain the data in some structured form
    expect(result).toContain("Alice");
    expect(result).toContain("Bob");
  });

  it("converts table to code format", () => {
    const md = "| Name | Age |\n|------|-----|\n| Alice | 30 |";
    const result = convertMarkdownTables(md, "code");
    expect(result).toContain("Alice");
  });

  it("preserves text around tables", () => {
    const md = "Before\n\n| A | B |\n|---|---|\n| 1 | 2 |\n\nAfter";
    const result = convertMarkdownTables(md, "bullets");
    expect(result).toContain("Before");
    expect(result).toContain("After");
  });
});
