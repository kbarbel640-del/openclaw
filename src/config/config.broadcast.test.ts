import { describe, expect, it, vi } from "vitest";

describe("broadcast", () => {
  it("accepts a broadcast peer map with strategy", async () => {
    vi.resetModules();
    const { validateConfigObject } = await import("./config.js");
    const res = validateConfigObject({
      agents: {
        list: [{ id: "alfred" }, { id: "baerbel" }],
      },
      broadcast: {
        strategy: "parallel",
        "[redacted-email]": ["alfred", "baerbel"],
      },
    });
    expect(res.ok).toBe(true);
  });

  it("rejects invalid broadcast strategy", async () => {
    vi.resetModules();
    const { validateConfigObject } = await import("./config.js");
    const res = validateConfigObject({
      broadcast: { strategy: "nope" },
    });
    expect(res.ok).toBe(false);
  });

  it("rejects non-array broadcast entries", async () => {
    vi.resetModules();
    const { validateConfigObject } = await import("./config.js");
    const res = validateConfigObject({
      broadcast: { "[redacted-email]": 123 },
    });
    expect(res.ok).toBe(false);
  });
});
