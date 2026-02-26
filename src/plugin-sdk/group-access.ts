import { resolveOpenProviderRuntimeGroupPolicy } from "../config/runtime-group-policy.js";
import type { GroupPolicy } from "../config/types.base.js";

/**
 * @description Reason code explaining a group access decision.
 *
 * - `"allowed"` — the sender may interact in this group.
 * - `"disabled"` — group interaction is disabled by policy.
 * - `"empty_allowlist"` — policy is `"allowlist"` but no entries are configured.
 * - `"sender_not_allowlisted"` — policy is `"allowlist"` but the sender is not in it.
 */
export type SenderGroupAccessReason =
  | "allowed"
  | "disabled"
  | "empty_allowlist"
  | "sender_not_allowlisted";

/**
 * @description The result of evaluating whether a sender may interact in a
 * group conversation.
 */
export type SenderGroupAccessDecision = {
  /** Whether the sender is permitted to interact in this group. */
  allowed: boolean;
  /** The effective group policy that was applied. */
  groupPolicy: GroupPolicy;
  /**
   * `true` when the provider's runtime config was absent and a fallback
   * default policy was applied instead of the configured one.
   */
  providerMissingFallbackApplied: boolean;
  /** The specific reason for the access decision. */
  reason: SenderGroupAccessReason;
};

/**
 * @description Evaluates whether a sender is permitted to interact in a group
 * conversation given the channel's group policy configuration. Resolves the
 * effective policy (handling the "provider config missing" fallback case) and
 * then applies allowlist filtering when needed.
 *
 * @param params.providerConfigPresent - Whether the provider's runtime config
 *   exists; affects fallback policy resolution.
 * @param params.configuredGroupPolicy - The group policy set in the channel
 *   config (`"open"`, `"allowlist"`, or `"disabled"`).
 * @param params.defaultGroupPolicy - Fallback policy used when
 *   `configuredGroupPolicy` is absent.
 * @param params.groupAllowFrom - Allowlist entries for the group.
 * @param params.senderId - The sender's identifier to check against the
 *   allowlist.
 * @param params.isSenderAllowed - Function that tests whether `senderId` is
 *   present in a given allowlist array.
 * @returns A {@link SenderGroupAccessDecision} with `allowed`, `groupPolicy`,
 *   `providerMissingFallbackApplied`, and `reason` fields.
 *
 * @example
 * ```ts
 * const decision = evaluateSenderGroupAccess({
 *   providerConfigPresent: true,
 *   configuredGroupPolicy: "allowlist",
 *   groupAllowFrom: ["alice", "bob"],
 *   senderId: "alice",
 *   isSenderAllowed: isNormalizedSenderAllowed,
 * });
 * if (!decision.allowed) {
 *   return; // drop message
 * }
 * ```
 */
export function evaluateSenderGroupAccess(params: {
  providerConfigPresent: boolean;
  configuredGroupPolicy?: GroupPolicy;
  defaultGroupPolicy?: GroupPolicy;
  groupAllowFrom: string[];
  senderId: string;
  isSenderAllowed: (senderId: string, allowFrom: string[]) => boolean;
}): SenderGroupAccessDecision {
  const { groupPolicy, providerMissingFallbackApplied } = resolveOpenProviderRuntimeGroupPolicy({
    providerConfigPresent: params.providerConfigPresent,
    groupPolicy: params.configuredGroupPolicy,
    defaultGroupPolicy: params.defaultGroupPolicy,
  });

  if (groupPolicy === "disabled") {
    return {
      allowed: false,
      groupPolicy,
      providerMissingFallbackApplied,
      reason: "disabled",
    };
  }
  if (groupPolicy === "allowlist") {
    if (params.groupAllowFrom.length === 0) {
      return {
        allowed: false,
        groupPolicy,
        providerMissingFallbackApplied,
        reason: "empty_allowlist",
      };
    }
    if (!params.isSenderAllowed(params.senderId, params.groupAllowFrom)) {
      return {
        allowed: false,
        groupPolicy,
        providerMissingFallbackApplied,
        reason: "sender_not_allowlisted",
      };
    }
  }

  return {
    allowed: true,
    groupPolicy,
    providerMissingFallbackApplied,
    reason: "allowed",
  };
}
