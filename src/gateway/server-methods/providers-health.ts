/**
 * Gateway handlers for provider health endpoints.
 *
 * Merges static provider detection (auth profiles, env vars, config) with
 * registry metadata and runtime health metrics so the UI gets a unified view.
 */

import { detectProviders } from "../../commands/providers/index.js";
import { getProviderById } from "../../commands/providers/registry.js";
import {
  getAllProviderHealth,
  getProviderHealth,
  getProvidersByHealth,
  isProviderHealthy,
} from "../../providers/core/health.js";
import type { ProviderHealthMetrics } from "../../providers/core/types.js";
import { ErrorCodes, errorShape } from "../protocol/index.js";
import type { GatewayRequestHandlers } from "./types.js";

/**
 * Derive a UI-friendly healthStatus from detection + runtime data.
 *
 * Values the UI recognises: "healthy", "warning", "missing", "disabled",
 * "expired", "cooldown".
 */
function deriveHealthStatus(
  detected: boolean,
  tokenValidity: string | undefined,
  inCooldown: boolean | undefined,
  runtimeStatus: string | undefined,
): string {
  if (!detected) {
    return "missing";
  }
  if (tokenValidity === "expired") {
    return "expired";
  }
  if (inCooldown) {
    return "cooldown";
  }
  if (runtimeStatus === "cooldown" || runtimeStatus === "offline") {
    return "cooldown";
  }
  if (runtimeStatus === "degraded") {
    return "warning";
  }
  if (tokenValidity === "expiring") {
    return "warning";
  }
  return "healthy";
}

function deriveDisabledReason(
  detected: boolean,
  tokenValidity: string | undefined,
  inCooldown: boolean | undefined,
  cooldownEndsAt: string | undefined,
  runtimeStatus: string | undefined,
): string | undefined {
  if (!detected) {
    return "Provider not configured";
  }
  if (tokenValidity === "expired") {
    return "Token expired";
  }
  if (inCooldown && cooldownEndsAt) {
    return `Rate limited until ${cooldownEndsAt}`;
  }
  if (runtimeStatus === "cooldown" || runtimeStatus === "offline") {
    return "Provider temporarily unavailable";
  }
  return undefined;
}

/** Convert an ISO 8601 string to epoch milliseconds, or return undefined. */
function isoToMs(iso: string | undefined): number | undefined {
  if (!iso) {
    return undefined;
  }
  const ms = new Date(iso).getTime();
  return Number.isFinite(ms) ? ms : undefined;
}

export const providersHealthHandlers: GatewayRequestHandlers = {
  /**
   * Get health status for all providers (or a specific one).
   *
   * Merges:
   * - Detection data (auth profiles, env vars, config)
   * - Registry metadata (authModes, envVars, isLocal)
   * - Runtime health metrics (populated by actual API calls)
   */
  "providers.health": async ({ params, respond }) => {
    try {
      const typedParams = params as {
        providerId?: string;
        all?: boolean;
        includeUsage?: boolean;
      };

      const now = Date.now();

      // Get detection data (static -- checks auth profiles, env, config)
      const detected = detectProviders({
        includeNotDetected: typedParams.all ?? true,
        providerIds: typedParams.providerId ? [typedParams.providerId] : undefined,
      });

      // Get runtime health metrics (populated by actual API calls)
      const runtimeHealth = getAllProviderHealth();

      const providers = detected.map((det) => {
        const runtime: ProviderHealthMetrics | undefined = runtimeHealth.get(det.id);
        const registry = getProviderById(det.id);

        const healthStatus = deriveHealthStatus(
          det.detected,
          det.tokenValidity,
          det.inCooldown,
          runtime?.status,
        );
        const disabledReason = deriveDisabledReason(
          det.detected,
          det.tokenValidity,
          det.inCooldown,
          det.cooldownEndsAt,
          runtime?.status,
        );

        // Convert ISO timestamps to epoch ms for the UI countdown timer
        const tokenExpiresAtMs = isoToMs(det.tokenExpiresAt);
        const cooldownEndsAtMs = isoToMs(det.cooldownEndsAt);

        // Determine OAuth availability: provider supports oauth AND the
        // gateway can initiate the flow (i.e. non-CLI auth modes include oauth).
        const registryAuthModes = registry?.authModes ?? [];
        const oauthAvailable = registryAuthModes.includes("oauth");

        return {
          id: det.id,
          name: det.name,
          detected: det.detected,
          healthStatus,
          disabledReason,
          // Auth details from detection
          authSource: det.authSource ?? undefined,
          authMode: det.authMode ?? undefined,
          tokenValidity: det.tokenValidity ?? undefined,
          tokenExpiresAt: tokenExpiresAtMs,
          tokenRemainingMs:
            tokenExpiresAtMs !== undefined ? Math.max(0, tokenExpiresAtMs - now) : undefined,
          // Cooldown from detection-level (auth-profile usage stats)
          inCooldown: det.inCooldown ?? false,
          cooldownEndsAt: cooldownEndsAtMs,
          cooldownRemainingMs:
            cooldownEndsAtMs !== undefined ? Math.max(0, cooldownEndsAtMs - now) : undefined,
          // Runtime error count
          errorCount: runtime?.failedCalls ?? 0,
          // Last used
          lastUsed: det.lastUsed ?? undefined,
          // Registry metadata for the configuration UI
          isLocal: registry?.isLocal ?? false,
          authModes: registryAuthModes as string[],
          envVars: registry?.envVars ?? [],
          configured: det.detected,
          oauthAvailable,
        };
      });

      respond(
        true,
        {
          providers,
          updatedAt: now,
        },
        undefined,
      );
    } catch (err) {
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, String(err)));
    }
  },

  /**
   * Check if a provider is healthy.
   */
  "providers.health.check": async ({ params, respond }) => {
    try {
      const typedParams = params as { providerId: string };
      if (!typedParams.providerId) {
        respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, "providerId is required"));
        return;
      }

      const healthy = isProviderHealthy(typedParams.providerId);
      const health = getProviderHealth(typedParams.providerId);

      respond(true, { healthy, status: health.status, provider: health }, undefined);
    } catch (err) {
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, String(err)));
    }
  },

  /**
   * Get providers sorted by health (healthiest first).
   */
  "providers.health.ranked": async ({ params, respond }) => {
    try {
      const typedParams = params as { providerIds?: string[] };
      const allHealth = getAllProviderHealth();
      const providerIds = typedParams.providerIds ?? Array.from(allHealth.keys());

      const ranked = getProvidersByHealth(providerIds);
      const providers = ranked.map((id) => getProviderHealth(id));

      respond(true, { providers, ranked }, undefined);
    } catch (err) {
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, String(err)));
    }
  },
};
