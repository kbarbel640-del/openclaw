import path from "node:path";
import { describe, expect, it } from "vitest";
import { resolveGatewayStateDir } from "./paths.js";

describe("resolveGatewayStateDir", () => {
  it("uses the default state dir when no overrides are set", () => {
    const env = { HOME: "/Users/test" };
    expect(resolveGatewayStateDir(env)).toBe(path.join("/Users/test", ".amigo"));
  });

  it("appends the profile suffix when set", () => {
    const env = { HOME: "/Users/test", AMIGO_PROFILE: "rescue" };
    expect(resolveGatewayStateDir(env)).toBe(path.join("/Users/test", ".amigo-rescue"));
  });

  it("treats default profiles as the base state dir", () => {
    const env = { HOME: "/Users/test", AMIGO_PROFILE: "Default" };
    expect(resolveGatewayStateDir(env)).toBe(path.join("/Users/test", ".amigo"));
  });

  it("uses AMIGO_STATE_DIR when provided", () => {
    const env = { HOME: "/Users/test", AMIGO_STATE_DIR: "/var/lib/amigo" };
    expect(resolveGatewayStateDir(env)).toBe(path.resolve("/var/lib/amigo"));
  });

  it("expands ~ in AMIGO_STATE_DIR", () => {
    const env = { HOME: "/Users/test", AMIGO_STATE_DIR: "~/amigo-state" };
    expect(resolveGatewayStateDir(env)).toBe(path.resolve("/Users/test/amigo-state"));
  });

  it("preserves Windows absolute paths without HOME", () => {
    const env = { AMIGO_STATE_DIR: "C:\\State\\amigo" };
    expect(resolveGatewayStateDir(env)).toBe("C:\\State\\amigo");
  });
});
