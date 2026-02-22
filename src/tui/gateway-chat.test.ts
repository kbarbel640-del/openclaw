import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { captureEnv, withEnv } from "../test-utils/env.js";

const loadConfig = vi.fn();
const resolveGatewayPort = vi.fn();
const pickPrimaryTailnetIPv4 = vi.fn();
const pickPrimaryLanIPv4 = vi.fn();
const loadGatewayTlsRuntime = vi.fn();

vi.mock("../config/config.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../config/config.js")>();
  return {
    ...actual,
    loadConfig,
    resolveGatewayPort,
  };
});

vi.mock("../infra/tailnet.js", () => ({
  pickPrimaryTailnetIPv4,
}));

vi.mock("../gateway/net.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../gateway/net.js")>();
  return {
    ...actual,
    pickPrimaryLanIPv4,
    // Allow all URLs in tests - security validation is tested separately
    isSecureWebSocketUrl: () => true,
  };
});

vi.mock("../infra/tls/gateway.js", () => ({
  loadGatewayTlsRuntime,
}));

// Mock GatewayClient to avoid real WebSocket connections
const GatewayClientSpy = vi.fn();
vi.mock("../gateway/client.js", () => ({
  GatewayClient: class MockGatewayClient {
    opts: unknown;
    constructor(opts: unknown) {
      GatewayClientSpy(opts);
      this.opts = opts;
    }
    start() {}
    stop() {}
    request() {}
  },
}));

const { resolveGatewayConnection, GatewayChatClient } = await import("./gateway-chat.js");

describe("resolveGatewayConnection", () => {
  let envSnapshot: ReturnType<typeof captureEnv>;

  beforeEach(() => {
    envSnapshot = captureEnv(["OPENCLAW_GATEWAY_TOKEN", "OPENCLAW_GATEWAY_PASSWORD"]);
    loadConfig.mockClear();
    resolveGatewayPort.mockClear();
    pickPrimaryTailnetIPv4.mockClear();
    pickPrimaryLanIPv4.mockClear();
    resolveGatewayPort.mockReturnValue(18789);
    pickPrimaryTailnetIPv4.mockReturnValue(undefined);
    pickPrimaryLanIPv4.mockReturnValue(undefined);
    delete process.env.OPENCLAW_GATEWAY_TOKEN;
    delete process.env.OPENCLAW_GATEWAY_PASSWORD;
  });

  afterEach(() => {
    envSnapshot.restore();
  });

  it("throws when url override is missing explicit credentials", () => {
    loadConfig.mockReturnValue({ gateway: { mode: "local" } });

    expect(() => resolveGatewayConnection({ url: "wss://override.example/ws" })).toThrow(
      "explicit credentials",
    );
  });

  it.each([
    {
      label: "token",
      auth: { token: "explicit-token" },
      expected: { token: "explicit-token", password: undefined },
    },
    {
      label: "password",
      auth: { password: "explicit-password" },
      expected: { token: undefined, password: "explicit-password" },
    },
  ])("uses explicit $label when url override is set", ({ auth, expected }) => {
    loadConfig.mockReturnValue({ gateway: { mode: "local" } });

    const result = resolveGatewayConnection({
      url: "wss://override.example/ws",
      ...auth,
    });

    expect(result).toEqual({
      url: "wss://override.example/ws",
      ...expected,
    });
  });

  it.each([
    {
      label: "tailnet",
      bind: "tailnet",
      setup: () => pickPrimaryTailnetIPv4.mockReturnValue("100.64.0.1"),
    },
    {
      label: "lan",
      bind: "lan",
      setup: () => pickPrimaryLanIPv4.mockReturnValue("192.168.1.42"),
    },
  ])("uses loopback host when local bind is $label", ({ bind, setup }) => {
    loadConfig.mockReturnValue({ gateway: { mode: "local", bind } });
    resolveGatewayPort.mockReturnValue(18800);
    setup();

    const result = resolveGatewayConnection({});

    expect(result.url).toBe("ws://127.0.0.1:18800");
  });

  it("uses OPENCLAW_GATEWAY_TOKEN for local mode", () => {
    loadConfig.mockReturnValue({ gateway: { mode: "local" } });

    withEnv({ OPENCLAW_GATEWAY_TOKEN: "env-token" }, () => {
      const result = resolveGatewayConnection({});
      expect(result.token).toBe("env-token");
    });
  });

  it("falls back to config auth token when env token is missing", () => {
    loadConfig.mockReturnValue({ gateway: { mode: "local", auth: { token: "config-token" } } });

    const result = resolveGatewayConnection({});
    expect(result.token).toBe("config-token");
  });

  it("prefers OPENCLAW_GATEWAY_PASSWORD over remote password fallback", () => {
    loadConfig.mockReturnValue({
      gateway: {
        mode: "remote",
        remote: { url: "wss://remote.example/ws", token: "remote-token", password: "remote-pass" },
      },
    });

    withEnv({ OPENCLAW_GATEWAY_PASSWORD: "env-pass" }, () => {
      const result = resolveGatewayConnection({});
      expect(result.password).toBe("env-pass");
    });
  });
});

describe("GatewayChatClient TLS fingerprint", () => {
  beforeEach(() => {
    loadConfig.mockReset();
    resolveGatewayPort.mockReset();
    pickPrimaryTailnetIPv4.mockReset();
    pickPrimaryLanIPv4.mockReset();
    loadGatewayTlsRuntime.mockReset();
    GatewayClientSpy.mockClear();
    resolveGatewayPort.mockReturnValue(18789);
    pickPrimaryTailnetIPv4.mockReturnValue(undefined);
    pickPrimaryLanIPv4.mockReturnValue(undefined);
    delete process.env.OPENCLAW_GATEWAY_TOKEN;
    delete process.env.OPENCLAW_GATEWAY_PASSWORD;
  });

  afterEach(() => {
    if (originalEnvToken === undefined) {
      delete process.env.OPENCLAW_GATEWAY_TOKEN;
    } else {
      process.env.OPENCLAW_GATEWAY_TOKEN = originalEnvToken;
    }
    if (originalEnvPassword === undefined) {
      delete process.env.OPENCLAW_GATEWAY_PASSWORD;
    } else {
      process.env.OPENCLAW_GATEWAY_PASSWORD = originalEnvPassword;
    }
  });

  it("passes tlsFingerprint to GatewayClient when local TLS is enabled with wss://", async () => {
    loadConfig.mockReturnValue({
      gateway: {
        mode: "local",
        bind: "lan",
        auth: { token: "test-token" },
        tls: { enabled: true, autoGenerate: true },
      },
    });
    pickPrimaryLanIPv4.mockReturnValue("10.10.80.28");
    loadGatewayTlsRuntime.mockResolvedValue({
      enabled: true,
      required: true,
      fingerprintSha256: "abc123def456",
    });

    const client = new GatewayChatClient({});
    await client.start();

    expect(loadGatewayTlsRuntime).toHaveBeenCalledWith({ enabled: true, autoGenerate: true });
    expect(GatewayClientSpy).toHaveBeenCalledWith(
      expect.objectContaining({ tlsFingerprint: "abc123def456" }),
    );
  });

  it("does not call loadGatewayTlsRuntime when TLS is not enabled", async () => {
    loadConfig.mockReturnValue({
      gateway: { mode: "local", auth: { token: "test-token" } },
    });
    loadGatewayTlsRuntime.mockResolvedValue({ enabled: false, required: false });

    const client = new GatewayChatClient({});
    await client.start();

    expect(loadGatewayTlsRuntime).not.toHaveBeenCalled();
    expect(GatewayClientSpy).toHaveBeenCalledWith(
      expect.objectContaining({ tlsFingerprint: undefined }),
    );
  });

  it("does not call loadGatewayTlsRuntime when url is ws:// (TLS not enabled)", async () => {
    loadConfig.mockReturnValue({
      gateway: {
        mode: "local",
        auth: { token: "test-token" },
        // tls not enabled → scheme is ws://
      },
    });

    const client = new GatewayChatClient({});
    await client.start();

    expect(loadGatewayTlsRuntime).not.toHaveBeenCalled();
  });

  it("skips TLS resolution when url override is provided", async () => {
    loadConfig.mockReturnValue({
      gateway: {
        mode: "local",
        auth: { token: "test-token" },
        tls: { enabled: true, autoGenerate: true },
      },
    });
    loadGatewayTlsRuntime.mockResolvedValue({
      enabled: true,
      required: true,
      fingerprintSha256: "should-not-appear",
    });

    const client = new GatewayChatClient({ url: "wss://custom.example/ws", token: "t" });
    await client.start();

    expect(loadGatewayTlsRuntime).not.toHaveBeenCalled();
    expect(GatewayClientSpy).toHaveBeenCalledWith(
      expect.objectContaining({ tlsFingerprint: undefined }),
    );
  });

  it("uses remote tlsFingerprint in remote mode", async () => {
    loadConfig.mockReturnValue({
      gateway: {
        mode: "remote",
        remote: {
          url: "wss://remote-gw.example:18789",
          token: "remote-token",
          tlsFingerprint: "remote-fp-sha256",
        },
      },
    });

    const client = new GatewayChatClient({});
    await client.start();

    expect(loadGatewayTlsRuntime).not.toHaveBeenCalled();
    expect(GatewayClientSpy).toHaveBeenCalledWith(
      expect.objectContaining({ tlsFingerprint: "remote-fp-sha256" }),
    );
  });

  it("returns undefined fingerprint in remote mode when no tlsFingerprint configured", async () => {
    loadConfig.mockReturnValue({
      gateway: {
        mode: "remote",
        remote: {
          url: "wss://remote-gw.example:18789",
          token: "remote-token",
        },
      },
    });

    const client = new GatewayChatClient({});
    await client.start();

    expect(GatewayClientSpy).toHaveBeenCalledWith(
      expect.objectContaining({ tlsFingerprint: undefined }),
    );
  });

  it("stop() is safe to call before start() completes", () => {
    loadConfig.mockReturnValue({
      gateway: { mode: "local", auth: { token: "test-token" } },
    });
    loadGatewayTlsRuntime.mockResolvedValue({ enabled: false, required: false });

    const client = new GatewayChatClient({});
    // stop() before start() — client is not yet initialized
    expect(() => client.stop()).not.toThrow();
  });

  it("connection.url is available synchronously after construction", () => {
    loadConfig.mockReturnValue({
      gateway: {
        mode: "local",
        bind: "lan",
        auth: { token: "test-token" },
        tls: { enabled: true, autoGenerate: true },
      },
    });
    pickPrimaryLanIPv4.mockReturnValue("10.10.80.28");
    loadGatewayTlsRuntime.mockResolvedValue({
      enabled: true,
      required: true,
      fingerprintSha256: "abc123",
    });

    const client = new GatewayChatClient({});
    // connection.url must be available immediately (for TUI header rendering)
    expect(client.connection.url).toBe("wss://127.0.0.1:18789");
  });
});
