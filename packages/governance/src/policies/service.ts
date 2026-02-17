/**
 * Policy Service — MSP governance floor + customer authoring separation.
 *
 * Three-gate authorization model:
 *   Gate 0: MSP Policy (this service) — "Is this resource available at all?"
 *   Gate 1: Contract (PermissionContractService) — "Does this agent have permission?"
 *   Gate 2: Runtime — "Is it within scope, maturity, rate limits?"
 *
 * Cascade algorithm: global → entity-type → tenant → agent.
 * At each level:
 *   - Catalogs: intersection (child can only restrict, not expand)
 *   - Maturity ceilings: Math.min() per category
 *   - Sandbox floor: more restrictive wins (all > code-only > none)
 *   - Deny lists / required approvals: union (combine both)
 *   - Rate limits: more restrictive (lower) values win
 *
 * In-memory for MVP. Production: backed by Postgres.
 */

import type {
  DID,
  FunctionCategory,
  MaturityLevel,
  PolicyDocument,
  PolicyScope,
  PolicyCatalogs,
  PolicyConstraints,
  EffectivePolicy,
  PolicyCheckParams,
  PolicyCheckResult,
  PolicyResolutionContext,
  SetPolicyInput,
  ModelCatalogEntry,
  ToolCatalogEntry,
  SkillCatalogEntry,
  SecretCatalogEntry,
  CodePolicy,
  SandboxLevel,
  RateLimits,
  MaturityCeilings,
} from "../types.js";
import { DEFAULT_CATALOGS, DEFAULT_CONSTRAINTS } from "./catalogs.js";

// ── Types ────────────────────────────────────────────────────────────────────

/** Configuration for the PolicyService. */
export interface PolicyServiceConfig {
  /** Default catalogs for the global policy. If not provided, uses built-in defaults. */
  defaultCatalogs?: PolicyCatalogs;
  /** Default constraints for the global policy. If not provided, uses built-in defaults. */
  defaultConstraints?: PolicyConstraints;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Generate a scope key for Map storage. */
function scopeKey(scope: PolicyScope): string {
  switch (scope.level) {
    case "global":
      return "global";
    case "entity-type":
      return `entity-type:${scope.entityType}`;
    case "tenant":
      return `tenant:${scope.tenantId}`;
    case "agent":
      return `agent:${scope.agentId}`;
  }
}

/** Sandbox level ordering — higher is more restrictive. */
const SANDBOX_ORDER: Record<SandboxLevel, number> = {
  none: 0,
  "code-only": 1,
  all: 2,
};

/** Merge two sandbox levels — take the more restrictive. */
function mergeSandbox(a: SandboxLevel, b: SandboxLevel): SandboxLevel {
  return SANDBOX_ORDER[a] >= SANDBOX_ORDER[b] ? a : b;
}

/** Merge maturity ceilings — take Math.min per category. */
function mergeCeilings(parent: MaturityCeilings, child: MaturityCeilings): MaturityCeilings {
  const merged: MaturityCeilings = { ...parent };
  for (const [key, value] of Object.entries(child)) {
    const category = key as FunctionCategory;
    const parentVal = parent[category];
    if (parentVal !== undefined && value !== undefined) {
      merged[category] = Math.min(parentVal, value) as MaturityLevel;
    } else if (value !== undefined) {
      merged[category] = value;
    }
  }
  return merged;
}

/** Merge rate limits — take the more restrictive (lower non-undefined) value. */
function mergeRateLimits(parent: RateLimits, child: RateLimits): RateLimits {
  return {
    requestsPerMinute: mergeMin(parent.requestsPerMinute, child.requestsPerMinute),
    tokensPerHour: mergeMin(parent.tokensPerHour, child.tokensPerHour),
    costPerDay: mergeMin(parent.costPerDay, child.costPerDay),
  };
}

function mergeMin(a: number | undefined, b: number | undefined): number | undefined {
  if (a === undefined) {
    return b;
  }
  if (b === undefined) {
    return a;
  }
  return Math.min(a, b);
}

/** Union two string arrays (deduplicated). */
function unionStrings(a: string[], b: string[]): string[] {
  return [...new Set([...a, ...b])];
}

/** Intersect catalog entries by ID. Child can only restrict. */
function intersectById<T extends { id: string }>(parent: T[], child: T[]): T[] {
  const childIds = new Set(child.map((e) => e.id));
  return parent.filter((e) => childIds.has(e.id));
}

/** Merge code policies — intersection of languages/registries, union of blocked. */
function mergeCodePolicy(parent: CodePolicy, child: CodePolicy): CodePolicy {
  return {
    allowedLanguages: parent.allowedLanguages.filter((l) => child.allowedLanguages.includes(l)),
    approvedRegistries: parent.approvedRegistries.filter((r) =>
      child.approvedRegistries.includes(r),
    ),
    versionConstraints: { ...parent.versionConstraints, ...child.versionConstraints },
    blockedPackages: unionStrings(parent.blockedPackages, child.blockedPackages),
  };
}

/** Merge catalogs — intersection at every level. */
function mergeCatalogs(parent: PolicyCatalogs, child: PolicyCatalogs): PolicyCatalogs {
  return {
    models: intersectById(parent.models, child.models),
    tools: intersectById(parent.tools, child.tools),
    secrets: intersectById(parent.secrets, child.secrets),
    skills: intersectById(parent.skills, child.skills),
    codePolicy: mergeCodePolicy(parent.codePolicy, child.codePolicy),
  };
}

/** Merge constraints — more restrictive wins. */
function mergeConstraints(parent: PolicyConstraints, child: PolicyConstraints): PolicyConstraints {
  return {
    maturityCeilings: mergeCeilings(parent.maturityCeilings, child.maturityCeilings),
    sandboxFloor: mergeSandbox(parent.sandboxFloor, child.sandboxFloor),
    toolDenyList: unionStrings(parent.toolDenyList, child.toolDenyList),
    requiredApprovals: unionStrings(parent.requiredApprovals, child.requiredApprovals),
    rateLimits: mergeRateLimits(parent.rateLimits, child.rateLimits),
  };
}

// ── Service ──────────────────────────────────────────────────────────────────

export class PolicyService {
  private policies = new Map<string, PolicyDocument>();
  private defaultCatalogs: PolicyCatalogs;
  private defaultConstraints: PolicyConstraints;

  constructor(config: PolicyServiceConfig = {}) {
    this.defaultCatalogs = config.defaultCatalogs ?? DEFAULT_CATALOGS;
    this.defaultConstraints = config.defaultConstraints ?? DEFAULT_CONSTRAINTS;
  }

  // ── CRUD ────────────────────────────────────────────────────────────────────

  /**
   * Set the global policy. Convenience for setPolicy with scope.level = "global".
   */
  setGlobalPolicy(input: Omit<SetPolicyInput, "scope">): PolicyDocument {
    return this.setPolicy({
      ...input,
      scope: { level: "global" },
    });
  }

  /**
   * Set a policy at the given scope. Creates or updates.
   */
  setPolicy(input: SetPolicyInput): PolicyDocument {
    const key = scopeKey(input.scope);
    const existing = this.policies.get(key);
    const now = new Date().toISOString();

    const doc: PolicyDocument = {
      id: existing?.id ?? `pol-${key}-${Date.now().toString(36)}`,
      scope: input.scope,
      catalogs: input.catalogs,
      constraints: input.constraints,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
      updatedBy: input.updatedBy,
    };

    this.policies.set(key, doc);
    return doc;
  }

  /**
   * Get a policy at the given scope (exact match, no cascade).
   */
  getPolicy(scope: PolicyScope): PolicyDocument | null {
    return this.policies.get(scopeKey(scope)) ?? null;
  }

  /**
   * Delete a policy at the given scope.
   */
  deletePolicy(scope: PolicyScope, _deletedBy: DID): boolean {
    return this.policies.delete(scopeKey(scope));
  }

  /**
   * List all policies.
   */
  listPolicies(): PolicyDocument[] {
    return Array.from(this.policies.values());
  }

  // ── Cascade Resolution ──────────────────────────────────────────────────────

  /**
   * Resolve the effective policy for a scope by cascading
   * global → entity-type → tenant → agent.
   *
   * If no global policy exists, uses built-in defaults.
   */
  resolveEffectivePolicy(scope: PolicyScope, context?: PolicyResolutionContext): EffectivePolicy {
    const chain = this.buildScopeChain(scope, context);
    const appliedPolicies: string[] = [];

    // Start with global or defaults
    const globalPolicy = this.policies.get("global");
    let catalogs: PolicyCatalogs = globalPolicy?.catalogs ?? this.defaultCatalogs;
    let constraints: PolicyConstraints = globalPolicy?.constraints ?? this.defaultConstraints;
    if (globalPolicy) {
      appliedPolicies.push(globalPolicy.id);
    }

    // Apply each subsequent level in the chain
    for (const chainScope of chain) {
      const doc = this.policies.get(scopeKey(chainScope));
      if (doc) {
        catalogs = mergeCatalogs(catalogs, doc.catalogs);
        constraints = mergeConstraints(constraints, doc.constraints);
        appliedPolicies.push(doc.id);
      }
    }

    return { catalogs, constraints, appliedPolicies };
  }

  // ── Gate 0 Check ────────────────────────────────────────────────────────────

  /**
   * Gate 0: Check if a resource is allowed by MSP policy.
   * Called BEFORE ContractService.check (Gate 1).
   */
  check(params: PolicyCheckParams): PolicyCheckResult {
    const effective = this.resolveEffectivePolicy(params.scope);

    switch (params.resourceType) {
      case "model": {
        const model = effective.catalogs.models.find((m) => m.id === params.resourceId);
        if (!model) {
          return {
            allowed: false,
            reason: `Model "${params.resourceId}" is not available in the policy catalog`,
          };
        }
        if (!model.enabled) {
          return {
            allowed: false,
            reason: `Model "${params.resourceId}" is disabled by policy`,
          };
        }
        return { allowed: true, reason: "Model is available" };
      }

      case "tool": {
        // Check deny list first
        if (effective.constraints.toolDenyList.includes(params.resourceId)) {
          return {
            allowed: false,
            reason: `Tool "${params.resourceId}" is on the deny list`,
          };
        }
        const tool = effective.catalogs.tools.find((t) => t.id === params.resourceId);
        if (!tool) {
          return {
            allowed: false,
            reason: `Tool "${params.resourceId}" is not available in the policy catalog`,
          };
        }
        if (!tool.enabled) {
          return {
            allowed: false,
            reason: `Tool "${params.resourceId}" is disabled by policy`,
          };
        }
        const requiresApproval =
          tool.requiresApproval ||
          effective.constraints.requiredApprovals.includes(params.resourceId);
        return {
          allowed: true,
          reason: requiresApproval ? "Tool requires approval" : "Tool is available",
          requiresApproval,
        };
      }

      case "skill": {
        const skill = effective.catalogs.skills.find((s) => s.id === params.resourceId);
        if (!skill) {
          return {
            allowed: false,
            reason: `Skill "${params.resourceId}" is not available in the policy catalog`,
          };
        }
        if (!skill.enabled) {
          return {
            allowed: false,
            reason: `Skill "${params.resourceId}" is disabled by policy`,
          };
        }
        return { allowed: true, reason: "Skill is available" };
      }

      case "secret": {
        const secret = effective.catalogs.secrets.find((s) => s.id === params.resourceId);
        if (!secret) {
          return {
            allowed: false,
            reason: `Secret "${params.resourceId}" is not available in the policy catalog`,
          };
        }
        // Check if the scope level is allowed
        if (!secret.allowedScopes.includes(params.scope.level)) {
          return {
            allowed: false,
            reason: `Secret "${params.resourceId}" is not allowed at scope "${params.scope.level}"`,
          };
        }
        return { allowed: true, reason: "Secret is available" };
      }

      case "language": {
        if (!effective.catalogs.codePolicy.allowedLanguages.includes(params.resourceId)) {
          return {
            allowed: false,
            reason: `Language "${params.resourceId}" is not in the allowed languages list`,
          };
        }
        return { allowed: true, reason: "Language is allowed" };
      }

      case "package": {
        if (effective.catalogs.codePolicy.blockedPackages.includes(params.resourceId)) {
          return {
            allowed: false,
            reason: `Package "${params.resourceId}" is blocked by code policy`,
          };
        }
        return { allowed: true, reason: "Package is allowed" };
      }
    }
  }

  // ── Filtered Catalog Queries ────────────────────────────────────────────────

  /**
   * Get models available at the given scope after cascade.
   * Used by customer authoring UI to show selection options.
   */
  getAvailableModels(scope: PolicyScope, context?: PolicyResolutionContext): ModelCatalogEntry[] {
    const effective = this.resolveEffectivePolicy(scope, context);
    return effective.catalogs.models.filter((m) => m.enabled);
  }

  /**
   * Get tools available at the given scope after cascade.
   */
  getAvailableTools(scope: PolicyScope, context?: PolicyResolutionContext): ToolCatalogEntry[] {
    const effective = this.resolveEffectivePolicy(scope, context);
    return effective.catalogs.tools.filter(
      (t) => t.enabled && !effective.constraints.toolDenyList.includes(t.id),
    );
  }

  /**
   * Get skills available at the given scope after cascade.
   */
  getAvailableSkills(scope: PolicyScope, context?: PolicyResolutionContext): SkillCatalogEntry[] {
    const effective = this.resolveEffectivePolicy(scope, context);
    return effective.catalogs.skills.filter((s) => s.enabled);
  }

  /**
   * Get secrets available at the given scope after cascade.
   */
  getAvailableSecrets(scope: PolicyScope, context?: PolicyResolutionContext): SecretCatalogEntry[] {
    const effective = this.resolveEffectivePolicy(scope, context);
    return effective.catalogs.secrets.filter((s) => s.allowedScopes.includes(scope.level));
  }

  /**
   * Get the effective code policy at the given scope after cascade.
   */
  getEffectiveCodePolicy(scope: PolicyScope, context?: PolicyResolutionContext): CodePolicy {
    const effective = this.resolveEffectivePolicy(scope, context);
    return effective.catalogs.codePolicy;
  }

  // ── Validation Helpers ──────────────────────────────────────────────────────

  /**
   * Validate that a model ID can be assigned at the given scope.
   * Used at agent creation to enforce policy before TenantService.addAgent().
   */
  validateModelAssignment(
    modelId: string,
    scope: PolicyScope,
    context?: PolicyResolutionContext,
  ): PolicyCheckResult {
    const available = this.getAvailableModels(scope, context);
    const model = available.find((m) => m.id === modelId);
    if (!model) {
      return {
        allowed: false,
        reason: `Model "${modelId}" is not available at this scope`,
      };
    }
    return { allowed: true, reason: "Model assignment is valid" };
  }

  /**
   * Validate that a maturity level is within the policy ceiling for a category.
   */
  validateMaturityLevel(
    category: FunctionCategory,
    level: MaturityLevel,
    scope: PolicyScope,
    context?: PolicyResolutionContext,
  ): PolicyCheckResult {
    const effective = this.resolveEffectivePolicy(scope, context);
    const ceiling = effective.constraints.maturityCeilings[category];
    if (ceiling !== undefined && level > ceiling) {
      return {
        allowed: false,
        reason: `Maturity level ${level} exceeds ceiling ${ceiling} for "${category}"`,
      };
    }
    return { allowed: true, reason: "Maturity level is within ceiling" };
  }

  /** Number of stored policies. */
  get size(): number {
    return this.policies.size;
  }

  // ── Private ─────────────────────────────────────────────────────────────────

  /**
   * Build the scope chain from entity-type → tenant → agent,
   * excluding global (handled separately as the base).
   */
  private buildScopeChain(scope: PolicyScope, context?: PolicyResolutionContext): PolicyScope[] {
    const chain: PolicyScope[] = [];

    if (scope.level === "global") {
      return chain;
    }

    // Entity-type level
    const entityType = scope.entityType ?? context?.entityType;
    if (entityType) {
      chain.push({ level: "entity-type", entityType });
    }

    if (scope.level === "entity-type") {
      return chain;
    }

    // Tenant level
    const tenantId = scope.tenantId ?? context?.tenantId;
    if (tenantId) {
      chain.push({ level: "tenant", tenantId });
    }

    if (scope.level === "tenant") {
      return chain;
    }

    // Agent level
    const agentId = scope.agentId ?? context?.agentId;
    if (agentId) {
      chain.push({ level: "agent", agentId });
    }

    return chain;
  }
}
