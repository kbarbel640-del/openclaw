import { describe, expect, it } from "vitest";
import { sanitizeEnvVars } from "./sanitize-env-vars.js";

describe("sanitizeEnvVars", () => {
  it("keeps normal env vars and blocks obvious credentials", () => {
    const result = sanitizeEnvVars({
      NODE_ENV: "test",
      OPENAI_API_KEY: "sk-live-xxx",
      FOO: "bar",
      GITHUB_TOKEN: "gh-token",
    });

    expect(result.allowed).toEqual({
      NODE_ENV: "test",
      FOO: "bar",
    });
    expect(result.blocked).toEqual(expect.arrayContaining(["OPENAI_API_KEY", "GITHUB_TOKEN"]));
  });

  it("blocks credentials even when suffix pattern matches", () => {
    const result = sanitizeEnvVars({
      MY_TOKEN: "abc",
      MY_SECRET: "def",
      USER: "alice",
    });

    expect(result.allowed).toEqual({ USER: "alice" });
    expect(result.blocked).toEqual(expect.arrayContaining(["MY_TOKEN", "MY_SECRET"]));
  });

  it("adds warnings for suspicious values", () => {
    const base64Like =
      "YWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYQ==";
    const result = sanitizeEnvVars({
      USER: "alice",
      SAFE_TEXT: base64Like,
      NULL: "a\0b",
    });

    expect(result.allowed).toEqual({ USER: "alice", SAFE_TEXT: base64Like });
    expect(result.blocked).toContain("NULL");
    expect(result.warnings).toContain("SAFE_TEXT: Value looks like base64-encoded credential data");
  });

  it("supports strict mode with explicit allowlist", () => {
    const result = sanitizeEnvVars(
      {
        NODE_ENV: "test",
        FOO: "bar",
      },
      { strictMode: true },
    );

    expect(result.allowed).toEqual({ NODE_ENV: "test" });
    expect(result.blocked).toEqual(["FOO"]);
  });

  it("allows skill-declared env keys through allowedKeys even when they match blocked patterns", () => {
    const result = sanitizeEnvVars(
      {
        NOTION_API_KEY: "ntn_xxx",
        GITHUB_TOKEN: "gh-token",
        OPENAI_API_KEY: "sk-live-xxx",
        FOO: "bar",
      },
      { allowedKeys: new Set(["NOTION_API_KEY", "GITHUB_TOKEN"]) },
    );

    expect(result.allowed).toEqual({
      NOTION_API_KEY: "ntn_xxx",
      GITHUB_TOKEN: "gh-token",
      FOO: "bar",
    });
    expect(result.blocked).toEqual(["OPENAI_API_KEY"]);
  });

  it("still blocks allowedKeys vars with null bytes in values", () => {
    const result = sanitizeEnvVars(
      { NOTION_API_KEY: "a\0b" },
      { allowedKeys: new Set(["NOTION_API_KEY"]) },
    );

    expect(result.blocked).toEqual(["NOTION_API_KEY"]);
    expect(result.allowed).toEqual({});
  });

  it("still warns for allowedKeys vars with suspicious values", () => {
    const base64Like =
      "YWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYQ==";
    const result = sanitizeEnvVars(
      { NOTION_API_KEY: base64Like },
      { allowedKeys: new Set(["NOTION_API_KEY"]) },
    );

    expect(result.allowed).toEqual({ NOTION_API_KEY: base64Like });
    expect(result.warnings).toContain(
      "NOTION_API_KEY: Value looks like base64-encoded credential data",
    );
  });
});
