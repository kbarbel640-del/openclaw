import os from "node:os";
import {
  loadOrCreateDeviceIdentity,
  publicKeyRawBase64UrlFromPem,
} from "../infra/device-identity.js";
import { addPairedDevice, getPairedDevice } from "../infra/device-pairing.js";

/**
 * Pre-pair the CLI operator device so it can connect to the gateway immediately
 * after onboarding, even when the gateway binds to a non-loopback address (LAN,
 * custom, auto, tailnet).
 *
 * When the gateway binds to loopback, the ws-connection handler treats the CLI
 * as a local client and auto-approves pairing on first connect.  For non-loopback
 * binds the CLI connects via a non-loopback IP, which makes `isLocalClient` false
 * and the auto-approve path is skipped.  Pre-pairing here avoids that gap.
 */
export async function ensureCliOperatorPaired(): Promise<{
  deviceId: string;
  created: boolean;
}> {
  const identity = loadOrCreateDeviceIdentity();
  const publicKeyBase64Url = publicKeyRawBase64UrlFromPem(identity.publicKeyPem);

  const existing = await getPairedDevice(identity.deviceId);
  if (existing) {
    return { deviceId: identity.deviceId, created: false };
  }

  const { device, created } = await addPairedDevice({
    deviceId: identity.deviceId,
    publicKey: publicKeyBase64Url,
    displayName: `CLI (${os.hostname()})`,
    platform: process.platform,
    role: "operator",
    roles: ["operator"],
    scopes: ["operator.admin", "operator.approvals", "operator.pairing"],
  });

  return { deviceId: device.deviceId, created };
}
