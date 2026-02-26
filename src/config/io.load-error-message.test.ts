import { describe, expect, it, vi } from "vitest";
import { createConfigIO } from "./io.js";

describe("loadConfig error messaging (#19653)", () => {
  it("logs explicit message when config JSON is invalid", () => {
    const errorSpy = vi.fn();
    const io = createConfigIO({
      fs: {
        existsSync: () => true,
        readFileSync: () => "{ invalid json !!!",
        promises: {} as never,
      } as never,
      logger: { error: errorSpy, warn: vi.fn() },
    });

    const result = io.loadConfig();
    expect(result).toEqual({});
    expect(errorSpy).toHaveBeenCalled();
    const msg = errorSpy.mock.calls[0]?.[0] ?? "";
    expect(msg).toContain("Failed to read config");
    expect(msg).toContain("Gateway will start with empty/default config");
  });
});
