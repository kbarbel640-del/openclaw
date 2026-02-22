import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

// Mock process.platform to linux so scanSystemdDir runs
const originalPlatform = process.platform;

import { findExtraGatewayServices } from "./inspect.js";

describe("findExtraGatewayServices (linux)", () => {
  let tmpHome: string;

  beforeEach(async () => {
    Object.defineProperty(process, "platform", { value: "linux" });
    tmpHome = await fs.mkdtemp(path.join(os.tmpdir(), "inspect-test-"));
    const systemdDir = path.join(tmpHome, ".config", "systemd", "user");
    await fs.mkdir(systemdDir, { recursive: true });
  });

  afterEach(async () => {
    Object.defineProperty(process, "platform", { value: originalPlatform });
    await fs.rm(tmpHome, { recursive: true, force: true });
  });

  it("does not flag openclaw-browser.service as extra gateway service", async () => {
    const systemdDir = path.join(tmpHome, ".config", "systemd", "user");
    // Browser service unit file — contains "openclaw" in paths but is not a gateway
    await fs.writeFile(
      path.join(systemdDir, "openclaw-browser.service"),
      [
        "[Unit]",
        "Description=OpenClaw Browser (Chrome CDP)",
        "",
        "[Service]",
        "ExecStart=/usr/bin/google-chrome --remote-debugging-port=9222",
        "Environment=OPENCLAW_BROWSER=1",
        "",
        "[Install]",
        "WantedBy=default.target",
      ].join("\n"),
    );

    const results = await findExtraGatewayServices({ HOME: tmpHome });
    const browserHit = results.find((svc) => svc.label === "openclaw-browser.service");
    expect(browserHit).toBeUndefined();
  });

  it("still flags unknown openclaw services that look like gateways", async () => {
    const systemdDir = path.join(tmpHome, ".config", "systemd", "user");
    // A rogue service that contains "openclaw" but isn't a known service
    await fs.writeFile(
      path.join(systemdDir, "openclaw-rogue.service"),
      [
        "[Unit]",
        "Description=Rogue OpenClaw Gateway Clone",
        "",
        "[Service]",
        "ExecStart=/usr/local/bin/openclaw gateway run",
        "",
        "[Install]",
        "WantedBy=default.target",
      ].join("\n"),
    );

    const results = await findExtraGatewayServices({ HOME: tmpHome });
    const rogueHit = results.find((svc) => svc.label === "openclaw-rogue.service");
    expect(rogueHit).toBeDefined();
  });

  it("does not flag openclaw-node.service as extra gateway service", async () => {
    const systemdDir = path.join(tmpHome, ".config", "systemd", "user");
    await fs.writeFile(
      path.join(systemdDir, "openclaw-node.service"),
      [
        "[Unit]",
        "Description=OpenClaw Node Host",
        "",
        "[Service]",
        "ExecStart=/usr/local/bin/openclaw node run",
        "Environment=OPENCLAW_SERVICE_KIND=node",
        "",
        "[Install]",
        "WantedBy=default.target",
      ].join("\n"),
    );

    const results = await findExtraGatewayServices({ HOME: tmpHome });
    const nodeHit = results.find((svc) => svc.label === "openclaw-node.service");
    expect(nodeHit).toBeUndefined();
  });

  it("skips non-.service files and files without openclaw marker", async () => {
    const systemdDir = path.join(tmpHome, ".config", "systemd", "user");
    // A .timer file should be skipped entirely
    await fs.writeFile(
      path.join(systemdDir, "openclaw-auth-monitor.timer"),
      "[Timer]\nOnCalendar=hourly\n",
    );
    // A .service file with no openclaw marker should be skipped
    await fs.writeFile(
      path.join(systemdDir, "unrelated-app.service"),
      "[Unit]\nDescription=Unrelated App\n[Service]\nExecStart=/usr/bin/app\n",
    );

    const results = await findExtraGatewayServices({ HOME: tmpHome });
    expect(results).toHaveLength(0);
  });

  it("detects legacy clawdbot/moltbot services", async () => {
    const systemdDir = path.join(tmpHome, ".config", "systemd", "user");
    await fs.writeFile(
      path.join(systemdDir, "clawdbot-gateway.service"),
      [
        "[Unit]",
        "Description=ClawdBot Gateway (legacy)",
        "",
        "[Service]",
        "ExecStart=/usr/local/bin/clawdbot gateway run",
        "",
        "[Install]",
        "WantedBy=default.target",
      ].join("\n"),
    );

    const results = await findExtraGatewayServices({ HOME: tmpHome });
    expect(results).toHaveLength(1);
    expect(results[0]?.legacy).toBe(true);
    expect(results[0]?.marker).toBe("clawdbot");
  });

  it("browser service coexists with gateway without false positives", async () => {
    const systemdDir = path.join(tmpHome, ".config", "systemd", "user");
    // Both services installed side by side — the exact scenario from the issue
    await fs.writeFile(
      path.join(systemdDir, "openclaw-gateway.service"),
      "[Unit]\nDescription=OpenClaw Gateway\n[Service]\nExecStart=/usr/local/bin/openclaw gateway run\n",
    );
    await fs.writeFile(
      path.join(systemdDir, "openclaw-browser.service"),
      "[Unit]\nDescription=OpenClaw Browser (Chrome CDP)\n[Service]\nExecStart=/usr/bin/google-chrome --remote-debugging-port=9222\nEnvironment=OPENCLAW_BROWSER=1\n",
    );

    const results = await findExtraGatewayServices({ HOME: tmpHome });
    expect(results).toHaveLength(0);
  });

  it("ignores the primary openclaw-gateway.service", async () => {
    const systemdDir = path.join(tmpHome, ".config", "systemd", "user");
    await fs.writeFile(
      path.join(systemdDir, "openclaw-gateway.service"),
      [
        "[Unit]",
        "Description=OpenClaw Gateway",
        "",
        "[Service]",
        "ExecStart=/usr/local/bin/openclaw gateway run",
        "",
        "[Install]",
        "WantedBy=default.target",
      ].join("\n"),
    );

    const results = await findExtraGatewayServices({ HOME: tmpHome });
    expect(results).toHaveLength(0);
  });
});
