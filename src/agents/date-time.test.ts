import { describe, expect, it } from "vitest";
import { formatUserDateYmd } from "./date-time.js";

describe("formatUserDateYmd", () => {
  it("formats YYYY-MM-DD in the requested timezone", () => {
    // 2026-02-16T00:30:00Z is still 2026-02-15 in America/Los_Angeles.
    const d = new Date("2026-02-16T00:30:00.000Z");
    expect(formatUserDateYmd(d, "America/Los_Angeles")).toBe("2026-02-15");
  });

  it("falls back to UTC date on invalid timezone", () => {
    const d = new Date("2026-02-16T00:30:00.000Z");
    expect(formatUserDateYmd(d, "Not/A_Timezone")).toBe("2026-02-16");
  });
});
