import { describe, expect, it } from "vitest";
import { buildDeviceAuthPayload } from "./device-auth.js";

const base = {
  deviceId: "dev-1",
  clientId: "cli-1",
  clientMode: "gateway",
  role: "admin",
  scopes: ["read", "write"],
  signedAtMs: 1700000000000,
};

describe("buildDeviceAuthPayload", () => {
  it("builds v1 payload by default (no nonce)", () => {
    const result = buildDeviceAuthPayload(base);
    expect(result).toBe("v1|dev-1|cli-1|gateway|admin|read,write|1700000000000|");
  });

  it("includes token when provided", () => {
    const result = buildDeviceAuthPayload({ ...base, token: "tok-abc" });
    expect(result).toBe("v1|dev-1|cli-1|gateway|admin|read,write|1700000000000|tok-abc");
  });

  it("uses empty string for null token", () => {
    const result = buildDeviceAuthPayload({ ...base, token: null });
    expect(result).toContain("|1700000000000|");
    expect(result).toMatch(/\|$/);
  });

  it("auto-detects v2 when nonce is present", () => {
    const result = buildDeviceAuthPayload({ ...base, nonce: "n-42" });
    expect(result).toMatch(/^v2\|/);
    expect(result).toMatch(/\|n-42$/);
  });

  it("appends nonce field for v2", () => {
    const result = buildDeviceAuthPayload({ ...base, version: "v2", nonce: "n-99" });
    const parts = result.split("|");
    expect(parts[0]).toBe("v2");
    expect(parts[parts.length - 1]).toBe("n-99");
  });

  it("uses empty nonce for v2 when nonce is null", () => {
    const result = buildDeviceAuthPayload({ ...base, version: "v2", nonce: null });
    const parts = result.split("|");
    expect(parts[0]).toBe("v2");
    expect(parts[parts.length - 1]).toBe("");
  });

  it("explicit version overrides auto-detection", () => {
    const result = buildDeviceAuthPayload({ ...base, version: "v1", nonce: "ignored" });
    expect(result).toMatch(/^v1\|/);
    expect(result).not.toContain("ignored");
  });

  it("joins scopes with comma", () => {
    const result = buildDeviceAuthPayload({ ...base, scopes: ["a", "b", "c"] });
    expect(result).toContain("|a,b,c|");
  });

  it("handles empty scopes array", () => {
    const result = buildDeviceAuthPayload({ ...base, scopes: [] });
    expect(result).toContain("||");
  });

  it("stringifies signedAtMs", () => {
    const result = buildDeviceAuthPayload({ ...base, signedAtMs: 0 });
    expect(result).toContain("|0|");
  });
});
