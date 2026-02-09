import fs from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { setupIsolatedGateway } from "./isolated.js";
import { parsePort } from "./shared.js";

describe("setupIsolatedGateway", () => {
  const savedEnv: Record<string, string | undefined> = {};
  const envKeys = [
    "OPENCLAW_PROFILE",
    "OPENCLAW_STATE_DIR",
    "OPENCLAW_CONFIG_PATH",
    "OPENCLAW_GATEWAY_PORT",
    "OPENCLAW_SKIP_CHANNELS",
    "OPENCLAW_SKIP_BROWSER_CONTROL_SERVER",
    "OPENCLAW_SKIP_CANVAS_HOST",
    "OPENCLAW_SKIP_GMAIL_WATCHER",
    "OPENCLAW_SKIP_CRON",
  ];

  beforeEach(() => {
    for (const key of envKeys) {
      savedEnv[key] = process.env[key];
    }
  });

  afterEach(() => {
    for (const key of envKeys) {
      if (savedEnv[key] === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = savedEnv[key];
      }
    }
  });

  it("creates state dir with expected structure", async () => {
    const { stateDir } = await setupIsolatedGateway();

    expect(fs.existsSync(stateDir)).toBe(true);
    expect(fs.existsSync(path.join(stateDir, "agents", "main", "sessions"))).toBe(true);
    expect(fs.existsSync(path.join(stateDir, "workspace"))).toBe(true);

    // Clean up
    fs.rmSync(stateDir, { recursive: true, force: true });
  });

  it("generates a unique profile name matching test-<hex>", async () => {
    const { profile } = await setupIsolatedGateway();
    expect(profile).toMatch(/^test-[0-9a-f]{8}$/);

    // Clean up
    const stateDir = process.env.OPENCLAW_STATE_DIR!;
    fs.rmSync(stateDir, { recursive: true, force: true });
  });

  it("sets all SKIP env vars", async () => {
    const { stateDir } = await setupIsolatedGateway();

    expect(process.env.OPENCLAW_SKIP_CHANNELS).toBe("1");
    expect(process.env.OPENCLAW_SKIP_BROWSER_CONTROL_SERVER).toBe("1");
    expect(process.env.OPENCLAW_SKIP_CANVAS_HOST).toBe("1");
    expect(process.env.OPENCLAW_SKIP_GMAIL_WATCHER).toBe("1");
    expect(process.env.OPENCLAW_SKIP_CRON).toBe("1");

    fs.rmSync(stateDir, { recursive: true, force: true });
  });

  it("writes valid config with gateway.mode=local", async () => {
    const { stateDir } = await setupIsolatedGateway();

    const configPath = process.env.OPENCLAW_CONFIG_PATH!;
    expect(fs.existsSync(configPath)).toBe(true);

    const raw = fs.readFileSync(configPath, "utf-8");
    const config = JSON.parse(raw);
    expect(config.gateway.mode).toBe("local");
    expect(config.gateway.bind).toBe("loopback");
    expect(config.agents.defaults.skipBootstrap).toBe(true);

    fs.rmSync(stateDir, { recursive: true, force: true });
  });

  it("sets OPENCLAW_GATEWAY_PORT when port is specified", async () => {
    const { stateDir } = await setupIsolatedGateway({ port: 19999 });

    expect(process.env.OPENCLAW_GATEWAY_PORT).toBe("19999");

    fs.rmSync(stateDir, { recursive: true, force: true });
  });

  it("does not set OPENCLAW_GATEWAY_PORT when no port specified", async () => {
    delete process.env.OPENCLAW_GATEWAY_PORT;
    const { stateDir } = await setupIsolatedGateway();

    // Should not have been set (auto-pick handled by caller)
    expect(process.env.OPENCLAW_GATEWAY_PORT).toBeUndefined();

    fs.rmSync(stateDir, { recursive: true, force: true });
  });

  it("sets OPENCLAW_PROFILE and OPENCLAW_STATE_DIR", async () => {
    const { stateDir, profile } = await setupIsolatedGateway();

    expect(process.env.OPENCLAW_PROFILE).toBe(profile);
    expect(process.env.OPENCLAW_STATE_DIR).toBe(stateDir);

    fs.rmSync(stateDir, { recursive: true, force: true });
  });
});

describe("parsePort", () => {
  it("returns 0 for input 0 (auto-pick sentinel)", () => {
    expect(parsePort(0)).toBe(0);
    expect(parsePort("0")).toBe(0);
  });

  it("returns null for negative values", () => {
    expect(parsePort(-1)).toBeNull();
    expect(parsePort("-5")).toBeNull();
  });

  it("returns parsed value for positive integers", () => {
    expect(parsePort(8080)).toBe(8080);
    expect(parsePort("19847")).toBe(19847);
  });

  it("returns null for undefined and null", () => {
    expect(parsePort(undefined)).toBeNull();
    expect(parsePort(null)).toBeNull();
  });
});
