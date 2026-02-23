import crypto from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import type { OpenClawConfig } from "../config/types.openclaw.js";
import { signEd25519Payload } from "./policy.crypto.js";
import { clearPolicyManagerCacheForTests, getPolicyManagerState } from "./policy.manager.js";

function generateRawBase64Keypair(): { publicKey: string; privateKey: string } {
  const pair = crypto.generateKeyPairSync("ed25519");
  const publicDer = pair.publicKey.export({ type: "spki", format: "der" }) as Buffer;
  const privateDer = pair.privateKey.export({ type: "pkcs8", format: "der" }) as Buffer;
  return {
    publicKey: publicDer.subarray(publicDer.length - 32).toString("base64"),
    privateKey: privateDer.subarray(privateDer.length - 32).toString("base64"),
  };
}

describe("policy manager", () => {
  beforeEach(() => {
    clearPolicyManagerCacheForTests();
  });

  it("loads a valid signed policy", async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "openclaw-policy-"));
    const policyPath = path.join(dir, "POLICY.json");
    const sigPath = path.join(dir, "POLICY.sig");
    const keys = generateRawBase64Keypair();
    const payload = JSON.stringify({ version: 1 });
    const signature = signEd25519Payload({ payload, privateKey: keys.privateKey });
    await fs.writeFile(policyPath, payload, "utf8");
    await fs.writeFile(sigPath, `${signature}\n`, "utf8");

    const config: OpenClawConfig = {
      policy: {
        enabled: true,
        failClosed: true,
        policyPath,
        sigPath,
        publicKey: keys.publicKey,
      },
    };
    const state = await getPolicyManagerState({ config, forceReload: true });
    expect(state.enabled).toBe(true);
    expect(state.valid).toBe(true);
    expect(state.lockdown).toBe(false);
    expect(state.policy?.version).toBe(1);
  });

  it("enters lockdown when failClosed is enabled and signature is missing", async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "openclaw-policy-lockdown-"));
    const policyPath = path.join(dir, "POLICY.json");
    await fs.writeFile(policyPath, JSON.stringify({ version: 1 }), "utf8");

    const config: OpenClawConfig = {
      policy: {
        enabled: true,
        failClosed: true,
        policyPath,
        sigPath: path.join(dir, "MISSING.sig"),
        publicKey: "invalid",
      },
    };
    const state = await getPolicyManagerState({ config, forceReload: true });
    expect(state.enabled).toBe(true);
    expect(state.valid).toBe(false);
    expect(state.lockdown).toBe(true);
  });
});
