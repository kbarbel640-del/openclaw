import type { DestructiveMatch, Severity } from "./destructive/index.js";

export type AuditAction = "pass" | "ask" | "block";

export type HardcodedPolicy = {
  severityActions: Record<Severity, AuditAction>;
};

export const DEFAULT_POLICY: HardcodedPolicy = {
  // Independent-test policy:
  // - critical: require approval (ask)
  // - violation: block (default)
  // - high/medium: require approval (ask=always)
  // - low: pass
  severityActions: {
    violation: "block", // default
    critical: "ask",
    high: "ask",
    medium: "ask",
    low: "pass",
  },
};

export function resolveAction(
  match: DestructiveMatch,
  policy: HardcodedPolicy = DEFAULT_POLICY,
): AuditAction {
  return policy.severityActions[match.severity] ?? "pass";
}
