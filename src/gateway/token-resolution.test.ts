import { describe, expect, it } from "vitest";
import {
  formatTokenSourceHint,
  resolveGatewayPassword,
  resolveGatewayToken,
} from "./token-resolution.js";

describe("resolveGatewayToken", () => {
  it("returns CLI token with highest priority", () => {
    const result = resolveGatewayToken({
      cliToken: "cli-token",
      configToken: "config-token",
      env: { CLAWDBOT_GATEWAY_TOKEN: "env-token" },
    });

    expect(result.token).toBe("cli-token");
    expect(result.source).toBe("cli");
  });

  it("returns config token when CLI not provided", () => {
    const result = resolveGatewayToken({
      cliToken: undefined,
      configToken: "config-token",
      env: { CLAWDBOT_GATEWAY_TOKEN: "env-token" },
    });

    expect(result.token).toBe("config-token");
    expect(result.source).toBe("config");
  });

  it("returns env token when CLI and config not provided", () => {
    const result = resolveGatewayToken({
      cliToken: undefined,
      configToken: undefined,
      env: { CLAWDBOT_GATEWAY_TOKEN: "env-token" },
    });

    expect(result.token).toBe("env-token");
    expect(result.source).toBe("env");
  });

  it("returns undefined when no token provided", () => {
    const result = resolveGatewayToken({
      cliToken: undefined,
      configToken: undefined,
      env: {},
    });

    expect(result.token).toBeUndefined();
    expect(result.source).toBe("none");
  });

  it("ignores empty string tokens", () => {
    const result = resolveGatewayToken({
      cliToken: "",
      configToken: "   ",
      env: { CLAWDBOT_GATEWAY_TOKEN: "env-token" },
    });

    expect(result.token).toBe("env-token");
    expect(result.source).toBe("env");
  });

  it("trims whitespace from tokens", () => {
    const result = resolveGatewayToken({
      cliToken: "  cli-token  ",
    });

    expect(result.token).toBe("cli-token");
  });

  it("uses process.env as default", () => {
    const originalEnv = process.env.CLAWDBOT_GATEWAY_TOKEN;
    process.env.CLAWDBOT_GATEWAY_TOKEN = "process-env-token";

    try {
      const result = resolveGatewayToken({});
      expect(result.token).toBe("process-env-token");
      expect(result.source).toBe("env");
    } finally {
      if (originalEnv === undefined) {
        delete process.env.CLAWDBOT_GATEWAY_TOKEN;
      } else {
        process.env.CLAWDBOT_GATEWAY_TOKEN = originalEnv;
      }
    }
  });
});

describe("resolveGatewayPassword", () => {
  it("returns CLI password with highest priority", () => {
    const result = resolveGatewayPassword({
      cliPassword: "cli-password",
      configPassword: "config-password",
      env: { CLAWDBOT_GATEWAY_PASSWORD: "env-password" },
    });

    expect(result.password).toBe("cli-password");
    expect(result.source).toBe("cli");
  });

  it("returns config password when CLI not provided", () => {
    const result = resolveGatewayPassword({
      cliPassword: undefined,
      configPassword: "config-password",
      env: { CLAWDBOT_GATEWAY_PASSWORD: "env-password" },
    });

    expect(result.password).toBe("config-password");
    expect(result.source).toBe("config");
  });

  it("returns env password when CLI and config not provided", () => {
    const result = resolveGatewayPassword({
      cliPassword: undefined,
      configPassword: undefined,
      env: { CLAWDBOT_GATEWAY_PASSWORD: "env-password" },
    });

    expect(result.password).toBe("env-password");
    expect(result.source).toBe("env");
  });

  it("returns undefined when no password provided", () => {
    const result = resolveGatewayPassword({
      cliPassword: undefined,
      configPassword: undefined,
      env: {},
    });

    expect(result.password).toBeUndefined();
    expect(result.source).toBe("none");
  });
});

describe("formatTokenSourceHint", () => {
  it("formats CLI source", () => {
    expect(formatTokenSourceHint("cli")).toBe("from CLI --token argument");
  });

  it("formats config source", () => {
    expect(formatTokenSourceHint("config")).toBe("from gateway.auth.token config");
  });

  it("formats env source", () => {
    expect(formatTokenSourceHint("env")).toBe("from CLAWDBOT_GATEWAY_TOKEN env var");
  });

  it("formats none source", () => {
    expect(formatTokenSourceHint("none")).toBe("no token configured");
  });
});
