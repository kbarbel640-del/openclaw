import { describe, expect, it } from "vitest";
import {
  buildSafeEndpoint,
  isLoopbackHost,
  normalizeBaseUrl,
  resolvePathFromAction,
} from "./index.js";

describe("ted-sidecar safety guards", () => {
  it("accepts loopback hosts", () => {
    expect(isLoopbackHost("127.0.0.1")).toBe(true);
    expect(isLoopbackHost("localhost")).toBe(true);
    expect(isLoopbackHost("::1")).toBe(true);
  });

  it("rejects non-loopback base URLs", () => {
    expect(() => normalizeBaseUrl("http://192.168.1.12:48080")).toThrow(/loopback-only/);
  });

  it("maps command actions to allowlisted paths", () => {
    expect(resolvePathFromAction("doctor")).toBe("/doctor");
    expect(resolvePathFromAction("status")).toBe("/status");
    expect(resolvePathFromAction("catalog")).toBe("/status");
    expect(() => resolvePathFromAction("secrets")).toThrow(/Usage/);
  });

  it("blocks non-allowlisted paths", () => {
    const base = new URL("http://127.0.0.1:48080");
    expect(() => buildSafeEndpoint(base, "/doctor")).not.toThrow();
    expect(() => buildSafeEndpoint(base, "/admin")).toThrow(/allowlist/);
  });
});
