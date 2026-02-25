import { describe, expect, it } from "vitest";
import { __test } from "./client-fetch.js";

const { enhanceBrowserFetchError } = __test;

describe("enhanceBrowserFetchError", () => {
  it("returns actionable hint for 'tab not found' errors instead of restart-gateway", () => {
    const err = enhanceBrowserFetchError("/tabs", new Error("Error: tab not found"), 5000);
    expect(err.message).toContain("Browser tab not found");
    expect(err.message).toContain("action=tabs");
    expect(err.message).not.toContain("Restart the OpenClaw gateway");
    expect(err.message).not.toContain("Can't reach");
  });

  it("still returns restart-gateway hint for genuine connectivity errors", () => {
    const err = enhanceBrowserFetchError("/tabs", new Error("fetch failed"), 5000);
    expect(err.message).toContain("Can't reach the OpenClaw browser control service");
  });

  it("returns timeout hint for timeout errors", () => {
    const err = enhanceBrowserFetchError("/tabs", new Error("timed out"), 5000);
    expect(err.message).toContain("timed out after 5000ms");
  });

  it("handles case-insensitive 'tab not found' variants", () => {
    const err = enhanceBrowserFetchError("/tabs", new Error("Tab Not Found"), 5000);
    expect(err.message).toContain("Browser tab not found");
    expect(err.message).not.toContain("Restart the OpenClaw gateway");
  });
});
