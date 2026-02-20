import { describe, expect, it } from "vitest";
import { resolveConfig } from "./config.js";

describe("resolveConfig", () => {
  it("returns defaults when config is undefined", () => {
    const config = resolveConfig(undefined);
    expect(config.aliases).toEqual({});
    expect(config.port).toBe(80);
    expect(config.bind).toBe("127.0.0.1");
    expect(config.manageHosts).toBe(true);
  });

  it("returns defaults when config is empty", () => {
    const config = resolveConfig({});
    expect(config.aliases).toEqual({});
    expect(config.port).toBe(80);
    expect(config.bind).toBe("127.0.0.1");
    expect(config.manageHosts).toBe(true);
  });

  it("parses valid aliases", () => {
    const config = resolveConfig({
      aliases: { hal: 18789, sam: 19789 },
    });
    expect(config.aliases).toEqual({ hal: 18789, sam: 19789 });
  });

  it("lowercases alias hostnames", () => {
    const config = resolveConfig({
      aliases: { HAL: 18789, Sam: 19789 },
    });
    expect(config.aliases).toEqual({ hal: 18789, sam: 19789 });
  });

  it("rejects invalid port numbers", () => {
    const config = resolveConfig({
      aliases: {
        valid: 18789,
        zero: 0,
        negative: -1,
        huge: 99999,
        nan: "not-a-number" as unknown as number,
      },
    });
    expect(config.aliases).toEqual({ valid: 18789 });
  });

  it("floors fractional ports", () => {
    const config = resolveConfig({
      aliases: { hal: 18789.7 },
    });
    expect(config.aliases).toEqual({ hal: 18789 });
  });

  it("skips empty hostname keys", () => {
    const config = resolveConfig({
      aliases: { "": 18789, " ": 19789, hal: 20000 },
    });
    expect(config.aliases).toEqual({ hal: 20000 });
  });

  it("overrides port and bind", () => {
    const config = resolveConfig({
      port: 8080,
      bind: "0.0.0.0",
    });
    expect(config.port).toBe(8080);
    expect(config.bind).toBe("0.0.0.0");
  });

  it("handles manageHosts: false", () => {
    const config = resolveConfig({ manageHosts: false });
    expect(config.manageHosts).toBe(false);
  });

  it("treats non-false manageHosts as true", () => {
    const config = resolveConfig({ manageHosts: 0 as unknown as boolean });
    expect(config.manageHosts).toBe(true);
  });

  it("ignores non-object aliases", () => {
    const config = resolveConfig({ aliases: "bad" as unknown as Record<string, number> });
    expect(config.aliases).toEqual({});
  });

  it("ignores array aliases", () => {
    const config = resolveConfig({ aliases: [1, 2, 3] as unknown as Record<string, number> });
    expect(config.aliases).toEqual({});
  });
});
