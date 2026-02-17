/**
 * Provider status command implementation.
 * Shows detailed status for one or more providers.
 */

import { getModelCooldownSnapshot } from "../../agents/model-fallback.js";
import type { RuntimeEnv } from "../../runtime.js";
import { defaultRuntime } from "../../runtime.js";
import { theme, isRich } from "../../terminal/theme.js";
import { detectProvider, detectProviders } from "./detection.js";
import { getProviderById } from "./registry.js";
import type { ProviderStatus } from "./types.js";

export type ProvidersStatusOptions = {
  /** Provider ID to check (optional, shows all if not specified) */
  provider?: string;
  /** Output as JSON */
  json?: boolean;
  /** Plain output (no colors/formatting) */
  plain?: boolean;
};

export async function providersStatusCommand(
  opts: ProvidersStatusOptions,
  runtime: RuntimeEnv = defaultRuntime,
): Promise<void> {
  let providers: ProviderStatus[];

  if (opts.provider) {
    const status = detectProvider(opts.provider);
    providers = [status];
  } else {
    providers = detectProviders({ includeNotDetected: false });
  }

  if (opts.json) {
    runtime.log(JSON.stringify(providers, null, 2));
    return;
  }

  if (opts.plain) {
    for (const provider of providers) {
      const status = provider.detected ? "detected" : "not_detected";
      runtime.log(
        `${provider.id}:${status}:${provider.authSource ?? "none"}:${provider.authDetail ?? ""}`,
      );
    }
    return;
  }

  if (providers.length === 0) {
    runtime.log(theme.muted("No providers detected."));
    return;
  }

  const rich = isRich();

  for (const provider of providers) {
    runtime.log("");
    runtime.log(rich ? theme.heading(provider.name) : `## ${provider.name}`);
    runtime.log(rich ? theme.muted(`ID: ${provider.id}`) : `ID: ${provider.id}`);
    runtime.log("");

    const statusLabel = provider.detected ? "Detected" : "Not Detected";
    const statusValue = rich
      ? provider.detected
        ? theme.success("✓ " + statusLabel)
        : theme.error("✗ " + statusLabel)
      : statusLabel;
    runtime.log(`  Status:      ${statusValue}`);

    if (provider.authSource) {
      runtime.log(`  Auth Source: ${rich ? theme.info(provider.authSource) : provider.authSource}`);
    }

    if (provider.authDetail) {
      runtime.log(`  Auth Detail: ${rich ? theme.info(provider.authDetail) : provider.authDetail}`);
    }

    if (provider.authMode) {
      runtime.log(`  Auth Mode:   ${provider.authMode}`);
    }

    if (provider.baseUrl) {
      runtime.log(`  Base URL:    ${provider.baseUrl}`);
    }

    if (provider.error) {
      runtime.log(`  Error:       ${rich ? theme.error(provider.error) : provider.error}`);
    }

    // Token validity information
    if (provider.tokenValidity) {
      const validityLabel =
        provider.tokenValidity === "valid"
          ? rich
            ? theme.success("✓ Valid")
            : "Valid"
          : provider.tokenValidity === "expiring"
            ? rich
              ? theme.warn("⚠ Expiring soon")
              : "Expiring soon"
            : provider.tokenValidity === "expired"
              ? rich
                ? theme.error("✗ Expired")
                : "Expired"
              : "Unknown";
      runtime.log(`  Token:       ${validityLabel}`);
      if (provider.tokenExpiresIn && provider.tokenValidity !== "unknown") {
        runtime.log(`  Expires In:  ${provider.tokenExpiresIn}`);
      }
      if (provider.tokenExpiresAt) {
        runtime.log(`  Expires At:  ${provider.tokenExpiresAt}`);
      }
    }

    // Cooldown information
    if (provider.inCooldown) {
      const cooldownLabel = rich ? theme.warn("⚠ In cooldown") : "In cooldown";
      runtime.log(`  Status:      ${cooldownLabel}`);
      if (provider.cooldownEndsAt) {
        runtime.log(`  Cooldown Ends: ${provider.cooldownEndsAt}`);
      }
    }

    // Last used
    if (provider.lastUsed) {
      runtime.log(`  Last Used:   ${provider.lastUsed}`);
    }

    // Show provider info from registry
    const definition = getProviderById(provider.id);
    if (definition) {
      runtime.log("");
      runtime.log(rich ? theme.muted("  Configuration:") : "  Configuration:");
      runtime.log(`    Env Vars:    ${definition.envVars.join(", ") || "none"}`);
      if (definition.altEnvVars?.length) {
        runtime.log(`    Alt Vars:    ${definition.altEnvVars.join(", ")}`);
      }
      runtime.log(`    Auth Modes:  ${definition.authModes.join(", ")}`);
      if (definition.defaultBaseUrl) {
        runtime.log(`    Default URL: ${definition.defaultBaseUrl}`);
      }
      if (definition.isLocal) {
        runtime.log(`    Type:        Local provider`);
      }
    }

    // Show model cooldowns for this provider
    const snapshot = getModelCooldownSnapshot();
    const providerCooldowns = snapshot.filter((s) => s.provider === provider.id);
    if (providerCooldowns.length > 0) {
      runtime.log("");
      runtime.log(rich ? theme.warn("  Model Limits / Cooldowns:") : "  Model Limits / Cooldowns:");
      for (const entry of providerCooldowns) {
        const remaining = Math.ceil(entry.remainingMs / 1000);
        const reason = entry.reason === "rate_limit" ? "Rate Limit" : entry.reason;
        runtime.log(
          `    - ${entry.model}: ${reason} (${remaining}s remaining, ${entry.failures} failures)`,
        );
      }
    }

    runtime.log("");
  }
}
