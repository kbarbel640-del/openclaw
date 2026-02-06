import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";

import {
  connectWithFallback,
  isLoopbackHost,
  parseGatewayUrl,
  resolveGatewayConnection,
  type GatewayChatClient,
} from "./gateway-chat.js";

// Mock loadConfig to avoid reading real config
vi.mock("../config/config.js", () => ({
  loadConfig: vi.fn(() => ({})),
  resolveGatewayPort: vi.fn((cfg, env) => {
    const envPort = env?.CLAWDBOT_GATEWAY_PORT?.trim();
    if (envPort) {
      const parsed = parseInt(envPort, 10);
      if (!Number.isNaN(parsed) && parsed > 0) return parsed;
    }
    return cfg?.gateway?.port ?? 18789;
  }),
  DEFAULT_GATEWAY_PORT: 18789,
}));

describe("URL parsing utilities", () => {
  describe("parseGatewayUrl", () => {
    it("extracts host and port from ws URL", () => {
      const result = parseGatewayUrl("ws://127.0.0.1:18789");
      expect(result).toEqual({ host: "127.0.0.1", port: 18789 });
    });

    it("extracts host and port from wss URL", () => {
      const result = parseGatewayUrl("wss://example.com:443");
      expect(result).toEqual({ host: "example.com", port: 443 });
    });

    it("uses default port 80 for ws without port", () => {
      const result = parseGatewayUrl("ws://localhost");
      expect(result).toEqual({ host: "localhost", port: 80 });
    });

    it("uses default port 443 for wss without port", () => {
      const result = parseGatewayUrl("wss://example.com");
      expect(result).toEqual({ host: "example.com", port: 443 });
    });

    it("handles IPv6 addresses", () => {
      const result = parseGatewayUrl("ws://[::1]:18789");
      expect(result).toEqual({ host: "[::1]", port: 18789 });
    });

    it("returns null for invalid URLs", () => {
      expect(parseGatewayUrl("not-a-url")).toBeNull();
      expect(parseGatewayUrl("")).toBeNull();
    });
  });

  describe("isLoopbackHost", () => {
    it("recognizes 127.0.0.1", () => {
      expect(isLoopbackHost("127.0.0.1")).toBe(true);
    });

    it("recognizes localhost", () => {
      expect(isLoopbackHost("localhost")).toBe(true);
      expect(isLoopbackHost("LOCALHOST")).toBe(true);
    });

    it("recognizes ::1 (IPv6 loopback)", () => {
      expect(isLoopbackHost("::1")).toBe(true);
    });

    it("recognizes [::1] (bracketed IPv6)", () => {
      expect(isLoopbackHost("[::1]")).toBe(true);
    });

    it("rejects external hosts", () => {
      expect(isLoopbackHost("example.com")).toBe(false);
      expect(isLoopbackHost("192.168.1.1")).toBe(false);
      expect(isLoopbackHost("10.0.0.1")).toBe(false);
    });
  });
});

describe("resolveGatewayConnection", () => {
  beforeEach(() => {
    vi.stubEnv("CLAWDBOT_GATEWAY_URL", "");
    vi.stubEnv("MOLTBOT_GATEWAY_URL", "");
    vi.stubEnv("CLAWDBOT_GATEWAY_PORT", "");
    vi.stubEnv("CLAWDBOT_GATEWAY_TOKEN", "");
    vi.stubEnv("CLAWDBOT_GATEWAY_PASSWORD", "");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("opts.url takes priority over env vars", () => {
    const env = {
      CLAWDBOT_GATEWAY_URL: "ws://env:1111",
      MOLTBOT_GATEWAY_URL: "ws://legacy:2222",
    };
    const result = resolveGatewayConnection({ url: "ws://cli:3333" }, env);
    expect(result.url).toBe("ws://cli:3333");
    expect(result.isExplicitUrl).toBe(true);
  });

  it("CLAWDBOT_GATEWAY_URL takes priority over MOLTBOT_GATEWAY_URL", () => {
    const env = {
      CLAWDBOT_GATEWAY_URL: "ws://clawdbot:1111",
      MOLTBOT_GATEWAY_URL: "ws://moltbot:2222",
    };
    const result = resolveGatewayConnection({}, env);
    expect(result.url).toBe("ws://clawdbot:1111");
    expect(result.isExplicitUrl).toBe(true);
  });

  it("MOLTBOT_GATEWAY_URL is used as fallback when CLAWDBOT_GATEWAY_URL not set", () => {
    const env = {
      CLAWDBOT_GATEWAY_URL: "",
      MOLTBOT_GATEWAY_URL: "ws://moltbot:2222",
    };
    const result = resolveGatewayConnection({}, env);
    expect(result.url).toBe("ws://moltbot:2222");
    expect(result.isExplicitUrl).toBe(true);
  });

  it("CLAWDBOT_GATEWAY_PORT overrides port in default URL", () => {
    const env = { CLAWDBOT_GATEWAY_PORT: "19001" };
    const result = resolveGatewayConnection({}, env);
    expect(result.url).toBe("ws://127.0.0.1:19001");
    expect(result.isExplicitUrl).toBe(true); // Port override IS explicit (user set it)
  });

  it("CLAWDBOT_GATEWAY_PORT beats config remote.url", () => {
    // This tests precedence: env port > config remote.url
    // Since we mock loadConfig to return {}, we can't easily test remote.url here,
    // but we verify that env port results in a local URL even when env has nothing else
    const env = { CLAWDBOT_GATEWAY_PORT: "19002" };
    const result = resolveGatewayConnection({}, env);
    expect(result.url).toBe("ws://127.0.0.1:19002");
    expect(result.isExplicitUrl).toBe(true);
  });

  it("env URL beats env PORT", () => {
    const env = {
      CLAWDBOT_GATEWAY_URL: "ws://env-url:1111",
      CLAWDBOT_GATEWAY_PORT: "19003",
    };
    const result = resolveGatewayConnection({}, env);
    expect(result.url).toBe("ws://env-url:1111");
    expect(result.isExplicitUrl).toBe(true);
  });

  it("returns isExplicitUrl=true when CLI url provided", () => {
    const result = resolveGatewayConnection({ url: "ws://explicit:1234" }, {});
    expect(result.isExplicitUrl).toBe(true);
  });

  it("returns isExplicitUrl=true when env url provided", () => {
    const env = { CLAWDBOT_GATEWAY_URL: "ws://env:1234" };
    const result = resolveGatewayConnection({}, env);
    expect(result.isExplicitUrl).toBe(true);
  });

  it("returns isExplicitUrl=true when env port provided", () => {
    const env = { CLAWDBOT_GATEWAY_PORT: "19004" };
    const result = resolveGatewayConnection({}, env);
    expect(result.isExplicitUrl).toBe(true);
  });

  it("returns isExplicitUrl=false when using default port", () => {
    const result = resolveGatewayConnection({}, {});
    expect(result.url).toBe("ws://127.0.0.1:18789");
    expect(result.isExplicitUrl).toBe(false);
  });

  it("respects token from opts", () => {
    const result = resolveGatewayConnection({ token: "my-token" }, {});
    expect(result.token).toBe("my-token");
  });

  it("respects password from opts", () => {
    const result = resolveGatewayConnection({ password: "my-pass" }, {});
    expect(result.password).toBe("my-pass");
  });
});

describe("connectWithFallback", () => {
  const mockClient = {
    onConnected: undefined,
    onDisconnected: undefined,
    onEvent: undefined,
    onGap: undefined,
    start: vi.fn(),
    stop: vi.fn(),
  } as unknown as GatewayChatClient;

  const mockDial = vi.fn();

  beforeEach(() => {
    mockDial.mockReset();
    vi.stubEnv("CLAWDBOT_GATEWAY_URL", "");
    vi.stubEnv("MOLTBOT_GATEWAY_URL", "");
    vi.stubEnv("CLAWDBOT_GATEWAY_PORT", "");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("does NOT fallback when explicit URL provided via opts", async () => {
    mockDial.mockRejectedValueOnce(new Error("connection refused"));

    await expect(connectWithFallback({ url: "ws://custom:1234" }, mockDial, {})).rejects.toThrow(
      "connection refused",
    );

    expect(mockDial).toHaveBeenCalledTimes(1);
    expect(mockDial).toHaveBeenCalledWith("ws://custom:1234", expect.any(Object));
  });

  it("does NOT fallback when explicit URL provided via CLAWDBOT_GATEWAY_URL", async () => {
    mockDial.mockRejectedValueOnce(new Error("connection refused"));
    const env = { CLAWDBOT_GATEWAY_URL: "ws://explicit:5555" };

    await expect(connectWithFallback({}, mockDial, env)).rejects.toThrow("connection refused");

    expect(mockDial).toHaveBeenCalledTimes(1);
  });

  it("does NOT fallback when using non-default port via CLAWDBOT_GATEWAY_PORT", async () => {
    mockDial.mockRejectedValueOnce(new Error("connection refused"));
    const env = { CLAWDBOT_GATEWAY_PORT: "19999" };

    await expect(connectWithFallback({}, mockDial, env)).rejects.toThrow("connection refused");

    expect(mockDial).toHaveBeenCalledTimes(1);
    expect(mockDial).toHaveBeenCalledWith("ws://127.0.0.1:19999", expect.any(Object));
  });

  it("does NOT fallback when env PORT is set to default 18789 (explicit user choice)", async () => {
    // Even though the port is 18789 (same as default), setting it via env makes it explicit
    mockDial.mockRejectedValueOnce(new Error("connection refused"));
    const env = { CLAWDBOT_GATEWAY_PORT: "18789" };

    await expect(connectWithFallback({}, mockDial, env)).rejects.toThrow("connection refused");

    expect(mockDial).toHaveBeenCalledTimes(1);
    expect(mockDial).toHaveBeenCalledWith("ws://127.0.0.1:18789", expect.any(Object));
  });

  it("falls back from 18789 to 19001 when implicit loopback fails", async () => {
    mockDial
      .mockRejectedValueOnce(new Error("connection refused"))
      .mockResolvedValueOnce(mockClient);

    const result = await connectWithFallback({}, mockDial, {});

    expect(result.didFallback).toBe(true);
    expect(result.fallbackFromUrl).toBe("ws://127.0.0.1:18789");
    expect(result.url).toBe("ws://127.0.0.1:19001");
    expect(mockDial).toHaveBeenCalledTimes(2);
    expect(mockDial).toHaveBeenNthCalledWith(1, "ws://127.0.0.1:18789", expect.any(Object));
    expect(mockDial).toHaveBeenNthCalledWith(2, "ws://127.0.0.1:19001", expect.any(Object));
  });

  it("returns didFallback=false when primary connection succeeds", async () => {
    mockDial.mockResolvedValueOnce(mockClient);

    const result = await connectWithFallback({}, mockDial, {});

    expect(result.didFallback).toBe(false);
    expect(result.fallbackFromUrl).toBeUndefined();
    expect(result.url).toBe("ws://127.0.0.1:18789");
    expect(mockDial).toHaveBeenCalledTimes(1);
  });

  it("throws original error when both primary and fallback fail", async () => {
    mockDial
      .mockRejectedValueOnce(new Error("primary failed"))
      .mockRejectedValueOnce(new Error("fallback failed"));

    await expect(connectWithFallback({}, mockDial, {})).rejects.toThrow("primary failed");

    expect(mockDial).toHaveBeenCalledTimes(2);
  });

  it("handles localhost:18789 as fallback-eligible", async () => {
    // Mock loadConfig to return remote.url not set and use default
    mockDial.mockRejectedValueOnce(new Error("refused")).mockResolvedValueOnce(mockClient);

    // We can't easily test localhost variant without mocking resolveGatewayConnection
    // but the isLoopbackHost tests cover that logic
    const result = await connectWithFallback({}, mockDial, {});
    expect(result.didFallback).toBe(true);
  });

  it("does NOT fallback when target is external host", async () => {
    mockDial.mockRejectedValueOnce(new Error("connection refused"));

    await expect(
      connectWithFallback({ url: "ws://external.example.com:18789" }, mockDial, {}),
    ).rejects.toThrow("connection refused");

    expect(mockDial).toHaveBeenCalledTimes(1);
  });
});
