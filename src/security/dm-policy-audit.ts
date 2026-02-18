/**
 * SC-001: DM policy misconfiguration audit.
 * Validates that dmPolicy is set to a restrictive value and not left at the
 * permissive default ("all") which would allow any sender to interact with the bot.
 */

import type { SecurityAuditFinding } from "./audit.js";

// ---------------------------------------------------------------------------
// DM policy constants — must match those used in config/
// ---------------------------------------------------------------------------

/** The set of valid dmPolicy values, from most to least restrictive. */
export const DM_POLICY_VALUES = [
  "none",       // No DMs accepted
  "contacts",   // Only pre-approved contacts
  "pairedOnly", // Only devices that have completed pairing
  "all",        // Accepts DMs from anyone (dangerous default)
] as const;

export type DmPolicy = (typeof DM_POLICY_VALUES)[number];

/** Policies that are considered unsafe for production deployments. */
const UNSAFE_DM_POLICIES: Set<DmPolicy> = new Set(["all"]);

/** Policies that are considered acceptable with a note. */
const CAUTIOUS_DM_POLICIES: Set<DmPolicy> = new Set(["contacts"]);

// ---------------------------------------------------------------------------
// Runtime policy registry
// ---------------------------------------------------------------------------

interface ChannelPolicyRecord {
  channelName: string;
  policy: string;
  configuredAt: string;
}

const channelPolicies: ChannelPolicyRecord[] = [];

/**
 * Register a channel's DM policy for audit purposes.
 * Call this when a channel extension initialises with its config.
 */
export function registerChannelDmPolicy(channelName: string, policy: string): void {
  const existing = channelPolicies.find((r) => r.channelName === channelName);
  if (existing) {
    existing.policy = policy;
    existing.configuredAt = new Date().toISOString();
  } else {
    channelPolicies.push({
      channelName,
      policy,
      configuredAt: new Date().toISOString(),
    });
  }
}

/**
 * Evaluate a single dmPolicy string and return a severity + message.
 */
export function evaluateDmPolicy(policy: string): {
  severity: "info" | "warn" | "critical";
  message: string;
} {
  if (!DM_POLICY_VALUES.includes(policy as DmPolicy)) {
    return {
      severity: "warn",
      message: `Unknown dmPolicy value '${policy}'. Expected one of: ${DM_POLICY_VALUES.join(", ")}`,
    };
  }
  const p = policy as DmPolicy;
  if (UNSAFE_DM_POLICIES.has(p)) {
    return {
      severity: "critical",
      message:
        `dmPolicy='${p}' allows DMs from any user. ` +
        "Set to 'pairedOnly' or 'contacts' to restrict access.",
    };
  }
  if (CAUTIOUS_DM_POLICIES.has(p)) {
    return {
      severity: "warn",
      message:
        `dmPolicy='${p}' relies on contact list accuracy. ` +
        "Ensure contact lists are regularly audited.",
    };
  }
  return {
    severity: "info",
    message: `dmPolicy='${p}' — restrictive setting, good.`,
  };
}

// ---------------------------------------------------------------------------
// Audit findings
// ---------------------------------------------------------------------------

/** Collect DM policy audit findings (SC-001). */
export function collectDmPolicyFindings(): SecurityAuditFinding[] {
  const findings: SecurityAuditFinding[] = [];

  if (channelPolicies.length === 0) {
    findings.push({
      checkId: "SC-001",
      severity: "info",
      title: "DM policy audit: no channels registered yet",
      detail:
        "No channel extensions have registered their dmPolicy. " +
        "If channels are active, ensure they call registerChannelDmPolicy().",
    });
    return findings;
  }

  for (const record of channelPolicies) {
    const { severity, message } = evaluateDmPolicy(record.policy);
    findings.push({
      checkId: "SC-001",
      severity,
      title: `DM policy check for channel '${record.channelName}'`,
      detail: message,
      remediation:
        severity === "critical"
          ? "Update the channel's dmPolicy in its config to 'pairedOnly' or 'contacts'."
          : undefined,
    });
  }

  return findings;
}
