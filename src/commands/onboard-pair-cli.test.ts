import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, test } from "vitest";

describe("ensureCliOperatorPaired", () => {
  const prev = {
    home: process.env.HOME,
    stateDir: process.env.OPENCLAW_STATE_DIR,
  };
  let tempDir: string;

  beforeAll(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "openclaw-pair-cli-"));
    process.env.HOME = tempDir;
    process.env.OPENCLAW_STATE_DIR = tempDir;
  });

  afterAll(async () => {
    process.env.HOME = prev.home;
    process.env.OPENCLAW_STATE_DIR = prev.stateDir;
    if (tempDir) {
      await fs.rm(tempDir, { recursive: true, force: true });
    }
  });

  test("pairs CLI device on first call and returns created=true", async () => {
    const { ensureCliOperatorPaired } = await import("./onboard-pair-cli.js");
    const { getPairedDevice } = await import("../infra/device-pairing.js");
    const { loadOrCreateDeviceIdentity } = await import("../infra/device-identity.js");

    const result = await ensureCliOperatorPaired();
    expect(result.created).toBe(true);
    expect(typeof result.deviceId).toBe("string");
    expect(result.deviceId.length).toBeGreaterThan(0);

    // Verify the device is actually paired
    const paired = await getPairedDevice(result.deviceId);
    expect(paired).not.toBeNull();
    expect(paired?.role).toBe("operator");
    expect(paired?.roles).toContain("operator");
    expect(paired?.scopes).toEqual(
      expect.arrayContaining(["operator.admin", "operator.approvals", "operator.pairing"]),
    );

    // Verify deviceId matches the local identity
    const identity = loadOrCreateDeviceIdentity();
    expect(result.deviceId).toBe(identity.deviceId);
  });

  test("returns created=false on subsequent calls (idempotent)", async () => {
    const { ensureCliOperatorPaired } = await import("./onboard-pair-cli.js");

    const first = await ensureCliOperatorPaired();
    const second = await ensureCliOperatorPaired();
    expect(second.created).toBe(false);
    expect(second.deviceId).toBe(first.deviceId);
  });
});
