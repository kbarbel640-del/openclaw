import { describe, expect, it, vi } from "vitest";
import { bookDineoutTable, checkDineoutSlots, searchDineout } from "./swiggy.js";

describe("swiggy wrappers", () => {
  it("returns fixture data when live command fails and fixture mode is on", async () => {
    const runner = vi.fn().mockResolvedValue({
      stdout: "",
      stderr: "command not found",
      code: 127,
      signal: null,
      killed: false,
    });
    const result = await searchDineout({
      cfg: { fixtureMode: true, command: "swiggy", timeoutMs: 2000 },
      runner,
      input: { query: "italian", location: "Indiranagar" },
    });
    expect(result.ok).toBe(true);
    expect(result.mode).toBe("fixture");
  });

  it("parses live JSON output on success", async () => {
    const runner = vi.fn().mockResolvedValue({
      stdout: '{"ok":true,"slots":["20:00"]}',
      stderr: "",
      code: 0,
      signal: null,
      killed: false,
    });
    const result = await checkDineoutSlots({
      cfg: { fixtureMode: false, command: "swiggy", timeoutMs: 2000 },
      runner,
      input: { restaurantId: "rest_1", date: "2026-02-14" },
    });
    expect(result.ok).toBe(true);
    expect(result.mode).toBe("live");
    expect(result.payload).toMatchObject({ ok: true });
  });

  it("enforces confirm for booking", async () => {
    const runner = vi.fn();
    const result = await bookDineoutTable({
      cfg: { fixtureMode: true, command: "swiggy", timeoutMs: 2000 },
      runner,
      input: {
        restaurantId: "rest_1",
        date: "2026-02-14",
        time: "20:00",
        guests: 2,
        confirm: false,
      },
    });
    expect(result.ok).toBe(false);
    expect(result.error).toBe("booking_confirm_required");
    expect(runner).not.toHaveBeenCalled();
  });
});

