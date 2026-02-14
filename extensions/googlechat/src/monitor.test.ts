import { describe, expect, it } from "vitest";
import { isSenderAllowed } from "./monitor.js";

describe("isSenderAllowed", () => {
  it("matches allowlist entries with raw email", () => {
    expect(isSenderAllowed("users/123", "[redacted-email]", ["[redacted-email]"])).toBe(true);
  });

  it("does not treat users/<email> entries as email allowlist (deprecated form)", () => {
    expect(isSenderAllowed("users/123", "[redacted-email]", ["users/[redacted-email]"])).toBe(
      false,
    );
  });

  it("still matches user id entries", () => {
    expect(isSenderAllowed("users/abc", "[redacted-email]", ["users/abc"])).toBe(true);
  });

  it("rejects non-matching raw email entries", () => {
    expect(isSenderAllowed("users/123", "[redacted-email]", ["[redacted-email]"])).toBe(false);
  });
});
