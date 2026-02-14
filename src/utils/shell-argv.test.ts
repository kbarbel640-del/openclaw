import { describe, expect, it } from "vitest";
import { splitShellArgs } from "./shell-argv.js";

describe("splitShellArgs", () => {
  it("splits simple space-separated args", () => {
    expect(splitShellArgs("a b c")).toEqual(["a", "b", "c"]);
  });

  it("returns empty array for empty string", () => {
    expect(splitShellArgs("")).toEqual([]);
  });

  it("returns empty array for whitespace only", () => {
    expect(splitShellArgs("   ")).toEqual([]);
  });

  it("handles single-quoted strings", () => {
    expect(splitShellArgs("'hello world'")).toEqual(["hello world"]);
  });

  it("handles double-quoted strings", () => {
    expect(splitShellArgs('"hello world"')).toEqual(["hello world"]);
  });

  it("handles mixed quotes", () => {
    expect(splitShellArgs(`'a b' "c d" e`)).toEqual(["a b", "c d", "e"]);
  });

  it("handles backslash escaping outside quotes", () => {
    expect(splitShellArgs("hello\\ world")).toEqual(["hello world"]);
  });

  it("returns null for unclosed single quote", () => {
    expect(splitShellArgs("'unclosed")).toBeNull();
  });

  it("returns null for unclosed double quote", () => {
    expect(splitShellArgs('"unclosed')).toBeNull();
  });

  it("returns null for trailing backslash", () => {
    expect(splitShellArgs("trailing\\")).toBeNull();
  });

  it("preserves content inside quotes literally", () => {
    expect(splitShellArgs(`'it\\'s fine'`)).toBeNull(); // backslash doesn't escape inside single quotes
  });

  it("handles empty quoted strings", () => {
    expect(splitShellArgs("'' \"\"")).toEqual([]);
  });

  it("handles multiple spaces between args", () => {
    expect(splitShellArgs("a    b    c")).toEqual(["a", "b", "c"]);
  });

  it("handles tabs as whitespace", () => {
    expect(splitShellArgs("a\tb\tc")).toEqual(["a", "b", "c"]);
  });

  it("handles complex real-world command", () => {
    expect(splitShellArgs('git commit -m "fix: handle edge case"')).toEqual([
      "git",
      "commit",
      "-m",
      "fix: handle edge case",
    ]);
  });
});
