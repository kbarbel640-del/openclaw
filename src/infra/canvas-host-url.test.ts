import { describe, expect, it } from "vitest";
import { resolveCanvasHostUrl } from "./canvas-host-url.js";

describe("resolveCanvasHostUrl", () => {
  it("returns undefined when no port", () => {
    expect(resolveCanvasHostUrl({})).toBeUndefined();
    expect(resolveCanvasHostUrl({ canvasPort: 0 })).toBeUndefined();
  });

  it("returns undefined when no host resolves", () => {
    expect(resolveCanvasHostUrl({ canvasPort: 3000 })).toBeUndefined();
  });

  it("uses hostOverride as primary host", () => {
    expect(resolveCanvasHostUrl({ canvasPort: 3000, hostOverride: "example.com" })).toBe(
      "http://example.com:3000",
    );
  });

  it("uses requestHost when no override", () => {
    expect(resolveCanvasHostUrl({ canvasPort: 3000, requestHost: "api.example.com" })).toBe(
      "http://api.example.com:3000",
    );
  });

  it("uses localAddress as fallback", () => {
    expect(resolveCanvasHostUrl({ canvasPort: 3000, localAddress: "192.168.1.100" })).toBe(
      "http://192.168.1.100:3000",
    );
  });

  it("rejects loopback hostOverride", () => {
    expect(resolveCanvasHostUrl({ canvasPort: 3000, hostOverride: "localhost" })).toBeUndefined();
    expect(resolveCanvasHostUrl({ canvasPort: 3000, hostOverride: "127.0.0.1" })).toBeUndefined();
    expect(resolveCanvasHostUrl({ canvasPort: 3000, hostOverride: "::1" })).toBeUndefined();
  });

  it("rejects loopback requestHost when override is present", () => {
    expect(
      resolveCanvasHostUrl({
        canvasPort: 3000,
        hostOverride: "example.com",
        requestHost: "localhost:3000",
      }),
    ).toBe("http://example.com:3000");
  });

  it("uses https scheme when forwardedProto is https", () => {
    expect(
      resolveCanvasHostUrl({
        canvasPort: 3000,
        hostOverride: "example.com",
        forwardedProto: "https",
      }),
    ).toBe("https://example.com:3000");
  });

  it("handles array forwardedProto", () => {
    expect(
      resolveCanvasHostUrl({
        canvasPort: 3000,
        hostOverride: "example.com",
        forwardedProto: ["https", "http"],
      }),
    ).toBe("https://example.com:3000");
  });

  it("wraps IPv6 address in brackets", () => {
    expect(resolveCanvasHostUrl({ canvasPort: 3000, hostOverride: "fe80::1" })).toBe(
      "http://[fe80::1]:3000",
    );
  });

  it("explicit scheme overrides forwardedProto", () => {
    expect(
      resolveCanvasHostUrl({
        canvasPort: 3000,
        hostOverride: "example.com",
        forwardedProto: "https",
        scheme: "http",
      }),
    ).toBe("http://example.com:3000");
  });

  it("trims whitespace from hosts", () => {
    expect(resolveCanvasHostUrl({ canvasPort: 3000, hostOverride: "  example.com  " })).toBe(
      "http://example.com:3000",
    );
  });

  it("treats empty string host as missing", () => {
    expect(resolveCanvasHostUrl({ canvasPort: 3000, hostOverride: "  " })).toBeUndefined();
  });
});
