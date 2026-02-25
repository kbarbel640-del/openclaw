import type { OpenClawPluginApi } from "openclaw/plugin-sdk";
import { afterEach, describe, expect, it, vi } from "vitest";

const resolveGatewayBindUrlMock = vi.hoisted(() =>
  vi.fn(() => ({ url: "ws://public.example:18789", source: "gateway.bind=lan" })),
);

vi.mock("openclaw/plugin-sdk", () => ({
  approveDevicePairing: vi.fn(),
  listDevicePairing: vi.fn(async () => ({ pending: [] })),
  resolveGatewayBindUrl: (...args: unknown[]) => resolveGatewayBindUrlMock(...args),
  runPluginCommandWithTimeout: vi.fn(),
  resolveTailnetHostWithRunner: vi.fn(async () => null),
}));

import register from "./index.js";

function decodeSetupCode(setupCode: string): Record<string, unknown> {
  const normalized = setupCode.replace(/-/g, "+").replace(/_/g, "/");
  const padding = "=".repeat((4 - (normalized.length % 4)) % 4);
  const json = Buffer.from(`${normalized}${padding}`, "base64").toString("utf8");
  return JSON.parse(json) as Record<string, unknown>;
}

function registerPairCommand(config: OpenClawPluginApi["config"]) {
  let pairCommand: {
    handler: (ctx: Record<string, unknown>) => Promise<{ text?: string }>;
  } | null = null;
  const api: OpenClawPluginApi = {
    id: "device-pair",
    name: "device-pair",
    source: "test",
    config,
    runtime: {},
    logger: {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
    },
    registerTool: vi.fn(),
    registerHook: vi.fn(),
    registerGatewayMethod: vi.fn(),
    registerProviderPlugin: vi.fn(),
    registerMemoryPlugin: vi.fn(),
    registerHttpRoute: vi.fn(),
    registerHttpPath: vi.fn(),
    registerCli: vi.fn(),
    registerService: vi.fn(),
    registerConfigHook: vi.fn(),
    registerChannel: vi.fn(),
    registerCommand: vi.fn((command) => {
      if (command.name === "pair") {
        pairCommand = command;
      }
    }),
    getPluginConfig: vi.fn(),
    getDataDir: vi.fn(),
    getStateDir: vi.fn(),
    getWorkspaceDir: vi.fn(),
  } as unknown as OpenClawPluginApi;
  register(api);
  if (!pairCommand) {
    throw new Error("pair command was not registered");
  }
  return pairCommand;
}

describe("device-pair setup code", () => {
  const originalToken = process.env.OPENCLAW_GATEWAY_TOKEN;

  afterEach(() => {
    process.env.OPENCLAW_GATEWAY_TOKEN = originalToken;
    resolveGatewayBindUrlMock.mockClear();
  });

  it("does not embed gateway credentials in generated setup code", async () => {
    process.env.OPENCLAW_GATEWAY_TOKEN = "super-secret-token";

    const command = registerPairCommand({
      gateway: {
        bind: "lan",
      },
    });

    const result = await command.handler({
      senderId: "user-1",
      channel: "discord",
      isAuthorizedSender: true,
      commandBody: "/pair",
      config: { gateway: { bind: "lan" } },
      from: "discord:user-1",
      to: "discord:user-1",
    });

    expect(resolveGatewayBindUrlMock).toHaveBeenCalled();
    expect(typeof result.text).toBe("string");
    const reply = result.text ?? "";
    const lines = reply.split("\n");
    const markerIndex = lines.indexOf("Setup code:");
    expect(markerIndex).toBeGreaterThan(-1);
    const setupCode = lines[markerIndex + 1]?.trim() ?? "";
    expect(setupCode).not.toHaveLength(0);

    const payload = decodeSetupCode(setupCode);
    expect(payload).toEqual({ url: "ws://public.example:18789" });
    expect(payload).not.toHaveProperty("token");
    expect(payload).not.toHaveProperty("password");
  });
});
