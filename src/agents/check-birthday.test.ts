import { describe, it, expect } from "vitest";
import { checkBirthday } from "./system-prompt.js";

describe("checkBirthday", () => {
  const tz = "America/New_York";

  it("returns 'today' when birthday matches", () => {
    // March 15 in ET
    const now = new Date("2025-03-15T12:00:00-04:00");
    expect(checkBirthday("03-15", tz, now)).toBe("today");
  });

  it("returns 'tomorrow' when birthday is the next day", () => {
    const now = new Date("2025-03-14T12:00:00-04:00");
    expect(checkBirthday("03-15", tz, now)).toBe("tomorrow");
  });

  it("returns null when birthday is neither today nor tomorrow", () => {
    const now = new Date("2025-06-01T12:00:00-04:00");
    expect(checkBirthday("03-15", tz, now)).toBeNull();
  });

  it("handles year boundary (Dec 31 → Jan 1)", () => {
    const now = new Date("2025-12-31T12:00:00-05:00");
    expect(checkBirthday("01-01", tz, now)).toBe("tomorrow");
  });

  it("handles timezone edge case (UTC midnight vs local)", () => {
    // 11pm HST Dec 31 = Jan 1 UTC, but local is still Dec 31
    const now = new Date("2026-01-01T09:00:00Z"); // 11pm HST Dec 31
    expect(checkBirthday("12-31", "Pacific/Honolulu", now)).toBe("today");
  });
});
