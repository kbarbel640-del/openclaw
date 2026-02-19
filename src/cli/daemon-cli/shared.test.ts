import { describe, expect, it } from "vitest";
import { theme } from "../../terminal/theme.js";
import { pickProbeHostForBind, resolveRuntimeStatusColor } from "./shared.js";

describe("resolveRuntimeStatusColor", () => {
  it("maps known runtime states to expected theme colors", () => {
    expect(resolveRuntimeStatusColor("running")).toBe(theme.success);
    expect(resolveRuntimeStatusColor("stopped")).toBe(theme.error);
    expect(resolveRuntimeStatusColor("unknown")).toBe(theme.muted);
  });

  it("falls back to warning color for unexpected states", () => {
    expect(resolveRuntimeStatusColor("degraded")).toBe(theme.warn);
    expect(resolveRuntimeStatusColor(undefined)).toBe(theme.muted);
  });
});

describe("pickProbeHostForBind", () => {
  it("uses loopback for lan probes", () => {
    expect(pickProbeHostForBind("lan", "100.64.0.1")).toBe("127.0.0.1");
  });

  it("uses custom bind host when provided", () => {
    expect(pickProbeHostForBind("custom", undefined, "10.1.2.3")).toBe("10.1.2.3");
  });

  it("uses tailnet IP for tailnet bind when available", () => {
    expect(pickProbeHostForBind("tailnet", "100.64.0.1")).toBe("100.64.0.1");
  });
});
