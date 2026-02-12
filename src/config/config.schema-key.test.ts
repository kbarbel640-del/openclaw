import { describe, expect, it, vi } from "vitest";

describe("$schema key in config", () => {
  it("accepts config with $schema key at root level", async () => {
    vi.resetModules();
    const { validateConfigObject } = await import("./config.js");
    const res = validateConfigObject({
      $schema: "https://openclaw.ai/config.json",
    });
    expect(res.ok).toBe(true);
  });

  it("accepts config with $schema alongside other keys", async () => {
    vi.resetModules();
    const { validateConfigObject } = await import("./config.js");
    const res = validateConfigObject({
      $schema: "https://openclaw.ai/config.json",
      agents: {
        list: [{ id: "main" }],
      },
    });
    expect(res.ok).toBe(true);
  });

  it("accepts config without $schema key", async () => {
    vi.resetModules();
    const { validateConfigObject } = await import("./config.js");
    const res = validateConfigObject({});
    expect(res.ok).toBe(true);
  });

  it("rejects $schema with non-string value", async () => {
    vi.resetModules();
    const { validateConfigObject } = await import("./config.js");
    const res = validateConfigObject({
      $schema: 123,
    });
    expect(res.ok).toBe(false);
  });
});
