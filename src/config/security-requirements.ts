import type { OpenClawConfig } from "./types.openclaw.js";

export type SecurityRequirement = {
  field: string;
  description: string;
  check: (config: OpenClawConfig) => boolean;
  remediation: string;
};

export const MANDATORY_SECURITY_REQUIREMENTS: SecurityRequirement[] = [
  {
    field: "gateway.auth.mode",
    description: "Gateway authentication mode must be explicitly configured",
    check: (config) => {
      const mode = config.gateway?.auth?.mode;
      return mode === "token" || mode === "password" || mode === "trusted-proxy";
    },
    remediation: 'Run "openclaw configure" and select an authentication mode',
  },
  {
    field: "gateway.auth.credential",
    description: "Gateway authentication credential must be configured",
    check: (config) => {
      const auth = config.gateway?.auth;
      if (auth?.mode === "token") {
        return Boolean(auth.token || process.env.OPENCLAW_GATEWAY_TOKEN);
      }
      if (auth?.mode === "password") {
        return Boolean(auth.password || process.env.OPENCLAW_GATEWAY_PASSWORD);
      }
      if (auth?.mode === "trusted-proxy") {
        return Boolean(auth.trustedProxy?.userHeader);
      }
      return false;
    },
    remediation:
      "Set gateway.auth.token or OPENCLAW_GATEWAY_TOKEN environment variable (for token mode), " +
      "gateway.auth.password or OPENCLAW_GATEWAY_PASSWORD (for password mode), " +
      "or gateway.auth.trustedProxy.userHeader (for trusted-proxy mode)",
  },
  {
    field: "gateway.securityConfigured",
    description: "Security configuration acknowledgement required",
    check: (config) => config.gateway?.securityConfigured === true,
    remediation:
      'Run "openclaw onboard" or set gateway.securityConfigured=true after manual review',
  },
];

export function validateSecurityRequirements(config: OpenClawConfig): {
  valid: boolean;
  failures: SecurityRequirement[];
} {
  const failures = MANDATORY_SECURITY_REQUIREMENTS.filter((req) => !req.check(config));
  return { valid: failures.length === 0, failures };
}

export function formatSecurityFailures(failures: SecurityRequirement[]): string {
  const lines = ["Gateway startup blocked: missing required security configuration", ""];
  for (const f of failures) {
    lines.push(`  ✗ ${f.field}: ${f.description}`);
    lines.push(`    → ${f.remediation}`);
    lines.push("");
  }
  lines.push('Run "openclaw security audit" for full security checklist.');
  return lines.join("\n");
}
