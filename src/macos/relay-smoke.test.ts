import { describe, expect, it } from "vitest";
import { parseRelaySmokeTest, runRelaySmokeTest } from "./relay-smoke.js";

describe("parseRelaySmokeTest", () => {
  it("parses --smoke qr", () => {
    expect(parseRelaySmokeTest(["--smoke", "qr"], {})).toBe("qr");
  });

  it("parses --smoke-qr", () => {
    expect(parseRelaySmokeTest(["--smoke-qr"], {})).toBe("qr");
  });

  it("parses env var smoke mode only when no args", () => {
    expect(parseRelaySmokeTest([], { OPENCLAW_SMOKE_QR: "1" })).toBe("qr");
    expect(parseRelaySmokeTest(["send"], { OPENCLAW_SMOKE_QR: "1" })).toBe(null);
  });

  it("rejects unknown smoke values", () => {
    expect(() => parseRelaySmokeTest(["--smoke", "nope"], {})).toThrow("Unknown smoke test");
  });
});

describe("runRelaySmokeTest", () => {
  it("throws for removed qr smoke test", async () => {
    await expect(runRelaySmokeTest("qr")).rejects.toThrow("no longer available");
  });
});
