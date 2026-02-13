import { describe, expect, it } from "vitest";
import {
  deriveDefaultBridgePort,
  deriveDefaultBrowserControlPort,
  deriveDefaultCanvasHostPort,
  deriveDefaultBrowserCdpPortRange,
  DEFAULT_BRIDGE_PORT,
  DEFAULT_BROWSER_CONTROL_PORT,
  DEFAULT_CANVAS_HOST_PORT,
  DEFAULT_BROWSER_CDP_PORT_RANGE_START,
  DEFAULT_BROWSER_CDP_PORT_RANGE_END,
} from "./port-defaults.js";

describe("deriveDefaultBridgePort", () => {
  it("derives from gateway port + 1", () => {
    expect(deriveDefaultBridgePort(18789)).toBe(18790);
  });

  it("falls back to default for invalid port", () => {
    expect(deriveDefaultBridgePort(65535)).toBe(DEFAULT_BRIDGE_PORT);
    expect(deriveDefaultBridgePort(-1)).toBe(DEFAULT_BRIDGE_PORT);
    expect(deriveDefaultBridgePort(NaN)).toBe(DEFAULT_BRIDGE_PORT);
  });

  it("works with non-standard ports", () => {
    expect(deriveDefaultBridgePort(8080)).toBe(8081);
  });
});

describe("deriveDefaultBrowserControlPort", () => {
  it("derives from gateway port + 2", () => {
    expect(deriveDefaultBrowserControlPort(18789)).toBe(18791);
  });

  it("falls back to default for overflow", () => {
    expect(deriveDefaultBrowserControlPort(65534)).toBe(DEFAULT_BROWSER_CONTROL_PORT);
  });
});

describe("deriveDefaultCanvasHostPort", () => {
  it("derives from gateway port + 4", () => {
    expect(deriveDefaultCanvasHostPort(18789)).toBe(18793);
  });

  it("falls back to default for overflow", () => {
    expect(deriveDefaultCanvasHostPort(65532)).toBe(DEFAULT_CANVAS_HOST_PORT);
  });
});

describe("deriveDefaultBrowserCdpPortRange", () => {
  it("derives range from browser control port + 9", () => {
    const range = deriveDefaultBrowserCdpPortRange(18791);
    expect(range.start).toBe(18800);
    expect(range.end).toBe(18899);
  });

  it("falls back to defaults for invalid port", () => {
    const range = deriveDefaultBrowserCdpPortRange(NaN);
    expect(range.start).toBe(DEFAULT_BROWSER_CDP_PORT_RANGE_START);
    expect(range.end).toBe(DEFAULT_BROWSER_CDP_PORT_RANGE_END);
  });

  it("maintains consistent range size", () => {
    const range = deriveDefaultBrowserCdpPortRange(8080);
    expect(range.end - range.start).toBe(
      DEFAULT_BROWSER_CDP_PORT_RANGE_END - DEFAULT_BROWSER_CDP_PORT_RANGE_START,
    );
  });
});
