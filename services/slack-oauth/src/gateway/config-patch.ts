import { createGatewayWsClient } from "./client.js";
import {
  generateDeviceIdentity,
  publicKeyRawBase64UrlFromPem,
  signDevicePayload,
  buildDeviceAuthPayload,
} from "./device-auth.js";

export type ConfigPatchOptions = {
  gatewayUrl: string;
  gatewayToken: string;
  botToken: string;
  appToken?: string;
  signingSecret?: string;
  mode?: "socket" | "http";
  accountId?: string;
};

export async function patchGatewayConfig(opts: ConfigPatchOptions): Promise<void> {
  const client = createGatewayWsClient({ url: opts.gatewayUrl });

  try {
    await client.waitOpen();

    const identity = generateDeviceIdentity();
    const role = "operator";
    const scopes = ["operator.admin", "operator.read", "operator.write"];
    const clientId = "gateway-client";
    const clientMode = "backend";
    const signedAtMs = Date.now();

    const authPayload = buildDeviceAuthPayload({
      deviceId: identity.deviceId,
      clientId,
      clientMode,
      role,
      scopes,
      signedAtMs,
      token: opts.gatewayToken,
    });

    // Connect to gateway with device identity
    const connectRes = await client.request("connect", {
      minProtocol: 3,
      maxProtocol: 3,
      client: { id: clientId, version: "1.0.0", platform: "docker", mode: clientMode },
      role,
      scopes,
      auth: { token: opts.gatewayToken },
      device: {
        id: identity.deviceId,
        publicKey: publicKeyRawBase64UrlFromPem(identity.publicKeyPem),
        signature: signDevicePayload(identity.privateKeyPem, authPayload),
        signedAt: signedAtMs,
      },
    });

    if (!connectRes.ok) {
      throw new Error(`Gateway connect failed: ${JSON.stringify(connectRes.error)}`);
    }

    // Get current config to obtain baseHash
    const getRes = await client.request("config.get", {});
    if (!getRes.ok) {
      throw new Error(`config.get failed: ${JSON.stringify(getRes.error)}`);
    }

    const configPayload = getRes.payload as { hash?: string } | undefined;
    const baseHash = configPayload?.hash;
    if (!baseHash) {
      throw new Error("config.get response missing hash");
    }

    // Build the config patch
    const patch = buildPatch(opts);

    // Attempt config.patch, retry once on stale hash
    let patchRes = await client.request("config.patch", {
      raw: JSON.stringify(patch),
      baseHash,
    });

    if (!patchRes.ok) {
      const errMsg = typeof patchRes.error === "object" && patchRes.error !== null
        ? (patchRes.error as { message?: string }).message ?? ""
        : String(patchRes.error ?? "");

      if (errMsg.includes("config changed since last load") || errMsg.includes("stale")) {
        // Retry: re-fetch hash and patch again
        const retryGet = await client.request("config.get", {});
        if (!retryGet.ok) throw new Error(`config.get retry failed: ${JSON.stringify(retryGet.error)}`);
        const retryHash = (retryGet.payload as { hash?: string } | undefined)?.hash;
        if (!retryHash) throw new Error("config.get retry missing hash");

        patchRes = await client.request("config.patch", {
          raw: JSON.stringify(patch),
          baseHash: retryHash,
        });
      }

      if (!patchRes.ok) {
        throw new Error(`config.patch failed: ${JSON.stringify(patchRes.error)}`);
      }
    }
  } finally {
    client.close();
  }
}

function buildPatch(opts: ConfigPatchOptions): Record<string, unknown> {
  const accountConfig: Record<string, unknown> = {
    enabled: true,
    botToken: opts.botToken,
  };

  if (opts.appToken) accountConfig.appToken = opts.appToken;
  if (opts.signingSecret) accountConfig.signingSecret = opts.signingSecret;
  if (opts.mode) accountConfig.mode = opts.mode;

  if (opts.accountId) {
    return {
      channels: {
        slack: {
          enabled: true,
          accounts: {
            [opts.accountId]: accountConfig,
          },
        },
      },
    };
  }

  return {
    channels: {
      slack: accountConfig,
    },
  };
}
