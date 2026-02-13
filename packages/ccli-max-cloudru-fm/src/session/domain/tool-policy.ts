/**
 * ToolAccessPolicy per access tier.
 *
 * Defines which tools are available to each tier and under what constraints.
 */

import type { AccessTier } from '../../core/types/access-tier.js';

/**
 * Policy defining tool access restrictions for an access tier.
 */
export interface ToolAccessPolicy {
  /** The access tier this policy applies to */
  readonly tier: AccessTier;
  /** Tools explicitly allowed for this tier */
  readonly allowedTools: readonly string[];
  /** Tools explicitly blocked for this tier */
  readonly blockedTools: readonly string[];
  /** Maximum number of tools that can run concurrently */
  readonly maxConcurrentTools: number;
  /** Whether tool execution requires manual approval */
  readonly requiresApproval: boolean;
}

/**
 * Read-only tools available to all tiers.
 */
const READ_TOOLS = ['Read', 'Glob', 'Grep', 'WebFetch'] as const;

/**
 * Write tools requiring elevated permissions.
 */
const WRITE_TOOLS = ['Write', 'Edit', 'NotebookEdit'] as const;

/**
 * Execution tools requiring elevated permissions.
 */
const EXEC_TOOLS = ['Bash', 'WebSearch'] as const;

/**
 * Advanced tools available only to premium/admin tiers.
 */
const ADVANCED_TOOLS = ['Skill', 'TodoWrite'] as const;

/**
 * Gets the default tool access policy for an access tier.
 *
 * Policies by tier:
 * - free: Read-only tools, 1 concurrent, requires approval
 * - standard: Read+write tools, 2 concurrent, no approval
 * - premium: All tools, 4 concurrent, no approval
 * - admin: All tools, unlimited concurrent, no approval
 *
 * @param tier - The access tier
 * @returns The default policy for that tier
 */
export function getDefaultPolicy(tier: AccessTier): ToolAccessPolicy {
  switch (tier) {
    case 'free':
      return {
        tier: 'free',
        allowedTools: [...READ_TOOLS],
        blockedTools: [...WRITE_TOOLS, ...EXEC_TOOLS, ...ADVANCED_TOOLS],
        maxConcurrentTools: 1,
        requiresApproval: true,
      };

    case 'standard':
      return {
        tier: 'standard',
        allowedTools: [...READ_TOOLS, ...WRITE_TOOLS],
        blockedTools: [...ADVANCED_TOOLS],
        maxConcurrentTools: 2,
        requiresApproval: false,
      };

    case 'premium':
      return {
        tier: 'premium',
        allowedTools: [...READ_TOOLS, ...WRITE_TOOLS, ...EXEC_TOOLS, ...ADVANCED_TOOLS],
        blockedTools: [],
        maxConcurrentTools: 4,
        requiresApproval: false,
      };

    case 'admin':
      return {
        tier: 'admin',
        allowedTools: [...READ_TOOLS, ...WRITE_TOOLS, ...EXEC_TOOLS, ...ADVANCED_TOOLS],
        blockedTools: [],
        maxConcurrentTools: Number.POSITIVE_INFINITY,
        requiresApproval: false,
      };
  }
}

/**
 * Checks if a tool is allowed under a policy.
 *
 * @param policy - The policy to check against
 * @param toolName - The tool to check
 * @returns True if the tool is allowed
 */
export function isToolAllowed(policy: ToolAccessPolicy, toolName: string): boolean {
  if (policy.blockedTools.includes(toolName)) {
    return false;
  }
  return policy.allowedTools.includes(toolName);
}
