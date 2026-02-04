/**
 * 2FA Hook Handler
 *
 * Registers a before_tool_call hook that gates sensitive tools behind
 * GitHub Mobile push authentication using the Device Authorization Flow.
 *
 * Flow (non-blocking):
 * 1. Tool call triggers hook
 * 2. Check for valid session -> allow if valid
 * 3. Check for pending verification -> quick poll, if approved store session and allow
 * 4. No session/pending -> initiate device flow, store pending, return block with instructions
 * 5. User approves on phone, retries request -> step 3 succeeds
 */

import type { OpenClawPluginApi } from "openclaw/plugin-sdk";
import { requestDeviceCode, quickPollForAccessToken } from "./device-flow.js";
import {
  getSession,
  setSession,
  getPending,
  setPending,
  clearPending,
} from "./session-store.js";
import { parseConfig, type TwoFactorConfig } from "./config.js";

const DEFAULT_SENSITIVE_TOOLS = ["exec", "Bash", "Write", "Edit", "NotebookEdit"];

/**
 * Check if a file path matches any allowed path prefix.
 * Normalizes paths and handles trailing slashes.
 */
function isPathAllowed(filePath: string | undefined, allowPaths: string[] | undefined): boolean {
  if (!filePath || !allowPaths || allowPaths.length === 0) return false;
  
  // Normalize the file path (resolve . and .., but we can't use path module here easily)
  const normalizedFile = filePath.replace(/\/+/g, "/").replace(/\/$/, "");
  
  for (const allowed of allowPaths) {
    const normalizedAllowed = allowed.replace(/\/+/g, "/").replace(/\/$/, "");
    // Check prefix match (must match full directory component)
    if (
      normalizedFile === normalizedAllowed ||
      normalizedFile.startsWith(normalizedAllowed + "/")
    ) {
      return true;
    }
  }
  return false;
}

/**
 * Extract file path from tool parameters.
 * Handles various parameter naming conventions.
 */
function extractFilePath(params: Record<string, unknown> | undefined): string | undefined {
  if (!params) return undefined;
  // Common parameter names for file paths
  const pathKeys = ["path", "file_path", "filePath", "file"];
  for (const key of pathKeys) {
    const val = params[key];
    if (typeof val === "string") return val;
  }
  return undefined;
}

export function register2FAHook(api: OpenClawPluginApi): void {
  const cfg = parseConfig(api.pluginConfig);
  const clientId = cfg.clientId ?? process.env.GITHUB_2FA_CLIENT_ID;
  const ttlMinutes = cfg.tokenTtlMinutes ?? 30;
  const sensitiveTools = cfg.sensitiveTools ?? DEFAULT_SENSITIVE_TOOLS;
  const gateAllTools = cfg.gateAllTools ?? false;
  const readAllowPaths = cfg.readAllowPaths;
  const writeAllowPaths = cfg.writeAllowPaths;

  if (!clientId) {
    api.logger.warn("2fa-github: No clientId configured, plugin disabled");
    api.logger.warn(
      "2fa-github: Set plugins.entries.2fa-github.config.clientId in config or GITHUB_2FA_CLIENT_ID env var",
    );
    return;
  }

  api.on("before_tool_call", async (event, ctx) => {
    const toolName = event.toolName;
    
    // Check if this tool requires 2FA
    if (!gateAllTools && !sensitiveTools.includes(toolName)) {
      return; // Allow without 2FA
    }

    // Path-based allowlisting for read/write/edit tools
    const params = event.parameters as Record<string, unknown> | undefined;
    const filePath = extractFilePath(params);
    
    if (toolName === "read" && isPathAllowed(filePath, readAllowPaths)) {
      api.logger.debug?.(`2fa-github: Allowing read of ${filePath} (in allowlist)`);
      return; // Allow without 2FA - path is in allowlist
    }
    
    if ((toolName === "write" || toolName === "edit") && isPathAllowed(filePath, writeAllowPaths)) {
      api.logger.debug?.(`2fa-github: Allowing ${toolName} of ${filePath} (in allowlist)`);
      return; // Allow without 2FA - path is in allowlist
    }

    const sessionKey = ctx.sessionKey ?? "default";

    // Check for valid session first
    const session = getSession(sessionKey);
    if (session) {
      api.logger.debug?.(`2fa-github: Valid session for ${session.githubLogin}`);
      return; // Allow - valid session exists
    }

    // Check for pending verification (user might be retrying after approval)
    const pending = getPending(sessionKey);
    if (pending) {
      api.logger.info?.("2fa-github: Found pending verification, checking...");

      try {
        const result = await quickPollForAccessToken({
          clientId,
          deviceCode: pending.deviceCode,
        });

        if (result === "pending") {
          // Still pending - remind user to approve
          return {
            block: true,
            blockReason: [
              "2FA approval still pending.",
              "",
              `Visit: ${pending.verificationUri}`,
              `Code: ${pending.userCode}`,
              "",
              "Approve on GitHub Mobile (or enter code on website), then retry your request.",
            ].join("\n"),
          };
        }

        if (result === "expired") {
          clearPending(sessionKey);
          // Fall through to create new verification
        } else if (result === "denied") {
          clearPending(sessionKey);
          return {
            block: true,
            blockReason: "2FA authorization was denied. Please try again.",
          };
        } else {
          // Success! Store session and allow
          const now = new Date();
          const expiry = new Date(now.getTime() + ttlMinutes * 60 * 1000);
          setSession(sessionKey, {
            githubLogin: result.login,
            verifiedAt: now.toISOString(),
            expiresAt: expiry.toISOString(),
          });
          api.logger.info?.(`2fa-github: Verified as ${result.login}`);
          return; // Allow execution
        }
      } catch (err) {
        api.logger.warn?.(`2fa-github: Poll error: ${String(err)}`);
        clearPending(sessionKey);
        // Fall through to create new verification
      }
    }

    // No session, no valid pending - initiate new device flow
    api.logger.info?.("2fa-github: Initiating GitHub device flow");

    try {
      const device = await requestDeviceCode(clientId);

      // Store pending verification for retry
      const expiresAt = new Date(Date.now() + device.expires_in * 1000);
      setPending(sessionKey, {
        deviceCode: device.device_code,
        userCode: device.user_code,
        verificationUri: device.verification_uri,
        expiresAt: expiresAt.toISOString(),
        intervalMs: Math.max(1000, device.interval * 1000),
      });

      // Return block with instructions (non-blocking - returns immediately)
      return {
        block: true,
        blockReason: [
          "2FA verification required for this operation.",
          "",
          `Visit: ${device.verification_uri}`,
          `Code: ${device.user_code}`,
          "",
          "Approve on GitHub Mobile (or enter code on website), then retry your request.",
        ].join("\n"),
      };
    } catch (err) {
      api.logger.error?.(`2fa-github: Failed to initiate device flow: ${String(err)}`);
      return {
        block: true,
        blockReason: `2FA verification failed: ${String(err)}`,
      };
    }
  });

  const readPaths = readAllowPaths?.length ? readAllowPaths.join(", ") : "none";
  const writePaths = writeAllowPaths?.length ? writeAllowPaths.join(", ") : "none";
  api.logger.info?.(
    `2fa-github: Enabled (TTL: ${ttlMinutes}min, tools: ${sensitiveTools.join(", ")}, readAllow: ${readPaths}, writeAllow: ${writePaths})`,
  );
}
