import { describe, it, expect, beforeEach, vi } from "vitest";
import type {
  DID,
  PolicyScope,
  PolicyCatalogs,
  PolicyConstraints,
  SetPolicyInput,
} from "../types.js";
import {
  DEFAULT_CATALOGS,
  DEFAULT_CONSTRAINTS,
  DEFAULT_MODELS,
  DEFAULT_TOOLS,
  DEFAULT_SKILLS,
  DEFAULT_SECRETS,
  DEFAULT_CODE_POLICY,
} from "./catalogs.js";
import { PolicyService } from "./service.js";

// ── Helpers ──────────────────────────────────────────────────────────────────

const ADMIN_DID: DID = "did:key:z6MkadminTestKey000000000000000000000000000";

function createService(): PolicyService {
  return new PolicyService();
}

function globalInput(
  catalogs?: Partial<PolicyCatalogs>,
  constraints?: Partial<PolicyConstraints>,
): Omit<SetPolicyInput, "scope"> {
  return {
    catalogs: { ...DEFAULT_CATALOGS, ...catalogs },
    constraints: { ...DEFAULT_CONSTRAINTS, ...constraints },
    updatedBy: ADMIN_DID,
  };
}

function scopedInput(
  scope: PolicyScope,
  catalogs?: Partial<PolicyCatalogs>,
  constraints?: Partial<PolicyConstraints>,
): SetPolicyInput {
  return {
    scope,
    catalogs: { ...DEFAULT_CATALOGS, ...catalogs },
    constraints: { ...DEFAULT_CONSTRAINTS, ...constraints },
    updatedBy: ADMIN_DID,
  };
}

/** Create a restricted catalog with only the specified model IDs. */
function modelsOnly(...ids: string[]): Partial<PolicyCatalogs> {
  return {
    models: DEFAULT_MODELS.filter((m) => ids.includes(m.id)),
  };
}

/** Create a restricted catalog with only the specified tool IDs. */
function toolsOnly(...ids: string[]): Partial<PolicyCatalogs> {
  return {
    tools: DEFAULT_TOOLS.filter((t) => ids.includes(t.id)),
  };
}

// ── Default Catalogs ─────────────────────────────────────────────────────────

describe("Default Catalogs", () => {
  it("has 6 default models", () => {
    expect(DEFAULT_MODELS).toHaveLength(6);
  });

  it("has 7 default tools", () => {
    expect(DEFAULT_TOOLS).toHaveLength(7);
  });

  it("has 2 default secrets", () => {
    expect(DEFAULT_SECRETS).toHaveLength(2);
  });

  it("has 6 default skills", () => {
    expect(DEFAULT_SKILLS).toHaveLength(6);
  });

  it("all default models have required fields", () => {
    for (const m of DEFAULT_MODELS) {
      expect(m.id).toBeTruthy();
      expect(m.provider).toBeTruthy();
      expect(m.model).toBeTruthy();
      expect(m.displayName).toBeTruthy();
      expect(typeof m.contextWindow).toBe("number");
      expect(typeof m.enabled).toBe("boolean");
    }
  });

  it("default code policy has languages and registries", () => {
    expect(DEFAULT_CODE_POLICY.allowedLanguages.length).toBeGreaterThan(0);
    expect(DEFAULT_CODE_POLICY.approvedRegistries.length).toBeGreaterThan(0);
    expect(DEFAULT_CODE_POLICY.blockedPackages).toEqual([]);
  });

  it("default constraints have maturity ceilings for all categories", () => {
    expect(DEFAULT_CONSTRAINTS.maturityCeilings.research).toBe(4);
    expect(DEFAULT_CONSTRAINTS.maturityCeilings.finance).toBe(2);
    expect(DEFAULT_CONSTRAINTS.maturityCeilings["code-execution"]).toBe(3);
  });
});

// ── CRUD ─────────────────────────────────────────────────────────────────────

describe("PolicyService CRUD", () => {
  let svc: PolicyService;

  beforeEach(() => {
    svc = createService();
  });

  it("starts with no policies", () => {
    expect(svc.size).toBe(0);
    expect(svc.listPolicies()).toEqual([]);
  });

  it("setGlobalPolicy creates a global policy", () => {
    const doc = svc.setGlobalPolicy(globalInput());
    expect(doc.scope.level).toBe("global");
    expect(doc.id).toContain("global");
    expect(doc.updatedBy).toBe(ADMIN_DID);
    expect(svc.size).toBe(1);
  });

  it("setPolicy creates a scoped policy", () => {
    const doc = svc.setPolicy(scopedInput({ level: "tenant", tenantId: "t-1" }));
    expect(doc.scope.level).toBe("tenant");
    expect(doc.scope.tenantId).toBe("t-1");
    expect(svc.size).toBe(1);
  });

  it("setPolicy updates an existing policy at the same scope", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-01-01T00:00:00Z"));
    const first = svc.setGlobalPolicy(globalInput());
    vi.setSystemTime(new Date("2025-01-01T00:00:01Z"));
    const second = svc.setGlobalPolicy(globalInput());
    vi.useRealTimers();
    expect(svc.size).toBe(1);
    expect(second.id).toBe(first.id);
    expect(second.createdAt).toBe(first.createdAt);
    expect(second.updatedAt).not.toBe(first.updatedAt);
  });

  it("getPolicy returns null for missing scope", () => {
    expect(svc.getPolicy({ level: "global" })).toBeNull();
  });

  it("getPolicy returns the stored policy", () => {
    svc.setGlobalPolicy(globalInput());
    const doc = svc.getPolicy({ level: "global" });
    expect(doc).not.toBeNull();
    expect(doc!.scope.level).toBe("global");
  });

  it("deletePolicy removes the policy", () => {
    svc.setGlobalPolicy(globalInput());
    expect(svc.size).toBe(1);
    const deleted = svc.deletePolicy({ level: "global" }, ADMIN_DID);
    expect(deleted).toBe(true);
    expect(svc.size).toBe(0);
  });

  it("deletePolicy returns false for missing scope", () => {
    expect(svc.deletePolicy({ level: "global" }, ADMIN_DID)).toBe(false);
  });

  it("listPolicies returns all policies", () => {
    svc.setGlobalPolicy(globalInput());
    svc.setPolicy(scopedInput({ level: "tenant", tenantId: "t-1" }));
    svc.setPolicy(scopedInput({ level: "tenant", tenantId: "t-2" }));
    expect(svc.listPolicies()).toHaveLength(3);
  });

  it("different scope levels are independent", () => {
    svc.setGlobalPolicy(globalInput());
    svc.setPolicy(scopedInput({ level: "entity-type", entityType: "llc" }));
    svc.setPolicy(scopedInput({ level: "tenant", tenantId: "t-1" }));
    svc.setPolicy(scopedInput({ level: "agent", agentId: "a-1" }));
    expect(svc.size).toBe(4);
  });
});

// ── Cascade Resolution ───────────────────────────────────────────────────────

describe("Cascade Resolution", () => {
  let svc: PolicyService;

  beforeEach(() => {
    svc = createService();
  });

  it("uses built-in defaults when no global policy exists", () => {
    const effective = svc.resolveEffectivePolicy({ level: "global" });
    expect(effective.catalogs.models).toHaveLength(DEFAULT_MODELS.length);
    expect(effective.appliedPolicies).toHaveLength(0);
  });

  it("global policy is the base of cascade", () => {
    svc.setGlobalPolicy(globalInput());
    const effective = svc.resolveEffectivePolicy({ level: "global" });
    expect(effective.appliedPolicies).toHaveLength(1);
    expect(effective.catalogs.models).toHaveLength(DEFAULT_MODELS.length);
  });

  it("tenant policy inherits from global", () => {
    svc.setGlobalPolicy(globalInput());
    const effective = svc.resolveEffectivePolicy({
      level: "tenant",
      tenantId: "t-1",
    });
    expect(effective.appliedPolicies).toHaveLength(1);
    expect(effective.catalogs.models).toHaveLength(DEFAULT_MODELS.length);
  });

  it("tenant policy restricts global catalog via intersection", () => {
    svc.setGlobalPolicy(globalInput());
    svc.setPolicy(
      scopedInput(
        { level: "tenant", tenantId: "t-1" },
        modelsOnly("llama3.1-8b", "deepseek-r1-14b"),
      ),
    );

    const effective = svc.resolveEffectivePolicy({
      level: "tenant",
      tenantId: "t-1",
    });
    expect(effective.catalogs.models).toHaveLength(2);
    expect(effective.catalogs.models.map((m) => m.id)).toContain("llama3.1-8b");
    expect(effective.catalogs.models.map((m) => m.id)).toContain("deepseek-r1-14b");
    expect(effective.appliedPolicies).toHaveLength(2);
  });

  it("child cannot add models not in parent", () => {
    // Global has only 2 models
    svc.setGlobalPolicy(globalInput(modelsOnly("llama3.1-8b", "deepseek-r1-14b")));
    // Tenant tries to include a model not in global — intersection means it drops out
    svc.setPolicy(
      scopedInput({ level: "tenant", tenantId: "t-1" }, modelsOnly("llama3.1-8b", "qwen2.5-72b")),
    );

    const effective = svc.resolveEffectivePolicy({
      level: "tenant",
      tenantId: "t-1",
    });
    // Only llama3.1-8b is in both
    expect(effective.catalogs.models).toHaveLength(1);
    expect(effective.catalogs.models[0].id).toBe("llama3.1-8b");
  });

  it("entity-type level participates in cascade", () => {
    svc.setGlobalPolicy(globalInput());
    svc.setPolicy(
      scopedInput(
        { level: "entity-type", entityType: "llc" },
        modelsOnly("llama3.1-8b", "llama3.1-70b", "qwen2.5-72b"),
      ),
    );

    const effective = svc.resolveEffectivePolicy(
      { level: "tenant", tenantId: "t-1" },
      { entityType: "llc" },
    );
    expect(effective.catalogs.models).toHaveLength(3);
    expect(effective.appliedPolicies).toHaveLength(2); // global + entity-type
  });

  it("full cascade: global → entity-type → tenant → agent", () => {
    // Global: all 6 models
    svc.setGlobalPolicy(globalInput());
    // Entity-type: restrict to 4 models
    svc.setPolicy(
      scopedInput(
        { level: "entity-type", entityType: "llc" },
        modelsOnly("llama3.1-8b", "llama3.1-70b", "deepseek-r1-32b", "qwen2.5-72b"),
      ),
    );
    // Tenant: restrict to 3 models
    svc.setPolicy(
      scopedInput(
        { level: "tenant", tenantId: "t-1" },
        modelsOnly("llama3.1-8b", "deepseek-r1-32b", "qwen2.5-72b"),
      ),
    );
    // Agent: restrict to 2 models
    svc.setPolicy(
      scopedInput({ level: "agent", agentId: "a-1" }, modelsOnly("llama3.1-8b", "deepseek-r1-32b")),
    );

    const effective = svc.resolveEffectivePolicy(
      { level: "agent", agentId: "a-1" },
      { entityType: "llc", tenantId: "t-1" },
    );
    expect(effective.catalogs.models).toHaveLength(2);
    expect(effective.appliedPolicies).toHaveLength(4);
  });

  it("maturity ceilings use Math.min per category", () => {
    svc.setGlobalPolicy(
      globalInput(undefined, {
        maturityCeilings: { research: 4, finance: 3, "code-execution": 3 },
      }),
    );
    svc.setPolicy(
      scopedInput({ level: "tenant", tenantId: "t-1" }, undefined, {
        maturityCeilings: { research: 3, finance: 2, "code-execution": 4 },
      }),
    );

    const effective = svc.resolveEffectivePolicy({
      level: "tenant",
      tenantId: "t-1",
    });
    // Math.min of each
    expect(effective.constraints.maturityCeilings.research).toBe(3);
    expect(effective.constraints.maturityCeilings.finance).toBe(2);
    expect(effective.constraints.maturityCeilings["code-execution"]).toBe(3);
  });

  it("sandbox floor uses more restrictive value", () => {
    svc.setGlobalPolicy(globalInput(undefined, { sandboxFloor: "code-only" }));
    svc.setPolicy(
      scopedInput({ level: "tenant", tenantId: "t-1" }, undefined, { sandboxFloor: "all" }),
    );

    const effective = svc.resolveEffectivePolicy({
      level: "tenant",
      tenantId: "t-1",
    });
    expect(effective.constraints.sandboxFloor).toBe("all");
  });

  it("sandbox floor: none < code-only < all ordering", () => {
    svc.setGlobalPolicy(globalInput(undefined, { sandboxFloor: "none" }));
    svc.setPolicy(
      scopedInput({ level: "tenant", tenantId: "t-1" }, undefined, { sandboxFloor: "code-only" }),
    );

    const effective = svc.resolveEffectivePolicy({
      level: "tenant",
      tenantId: "t-1",
    });
    expect(effective.constraints.sandboxFloor).toBe("code-only");
  });

  it("deny lists are unioned", () => {
    svc.setGlobalPolicy(globalInput(undefined, { toolDenyList: ["tool-a"] }));
    svc.setPolicy(
      scopedInput({ level: "tenant", tenantId: "t-1" }, undefined, { toolDenyList: ["tool-b"] }),
    );

    const effective = svc.resolveEffectivePolicy({
      level: "tenant",
      tenantId: "t-1",
    });
    expect(effective.constraints.toolDenyList).toContain("tool-a");
    expect(effective.constraints.toolDenyList).toContain("tool-b");
  });

  it("required approvals are unioned", () => {
    svc.setGlobalPolicy(globalInput(undefined, { requiredApprovals: ["shell-exec"] }));
    svc.setPolicy(
      scopedInput({ level: "tenant", tenantId: "t-1" }, undefined, {
        requiredApprovals: ["api-call"],
      }),
    );

    const effective = svc.resolveEffectivePolicy({
      level: "tenant",
      tenantId: "t-1",
    });
    expect(effective.constraints.requiredApprovals).toContain("shell-exec");
    expect(effective.constraints.requiredApprovals).toContain("api-call");
  });

  it("rate limits use more restrictive values", () => {
    svc.setGlobalPolicy(
      globalInput(undefined, {
        rateLimits: { requestsPerMinute: 60, tokensPerHour: 1_000_000, costPerDay: 50 },
      }),
    );
    svc.setPolicy(
      scopedInput({ level: "tenant", tenantId: "t-1" }, undefined, {
        rateLimits: { requestsPerMinute: 30, tokensPerHour: 2_000_000, costPerDay: 25 },
      }),
    );

    const effective = svc.resolveEffectivePolicy({
      level: "tenant",
      tenantId: "t-1",
    });
    expect(effective.constraints.rateLimits.requestsPerMinute).toBe(30);
    expect(effective.constraints.rateLimits.tokensPerHour).toBe(1_000_000);
    expect(effective.constraints.rateLimits.costPerDay).toBe(25);
  });

  it("code policy: languages are intersected", () => {
    svc.setGlobalPolicy(globalInput());
    svc.setPolicy(
      scopedInput(
        { level: "tenant", tenantId: "t-1" },
        {
          codePolicy: {
            allowedLanguages: ["typescript", "python"],
            approvedRegistries: DEFAULT_CODE_POLICY.approvedRegistries,
            versionConstraints: {},
            blockedPackages: [],
          },
        },
      ),
    );

    const effective = svc.resolveEffectivePolicy({
      level: "tenant",
      tenantId: "t-1",
    });
    expect(effective.catalogs.codePolicy.allowedLanguages).toEqual(["typescript", "python"]);
  });

  it("code policy: blocked packages are unioned", () => {
    svc.setGlobalPolicy(
      globalInput({
        codePolicy: { ...DEFAULT_CODE_POLICY, blockedPackages: ["malicious-pkg"] },
      }),
    );
    svc.setPolicy(
      scopedInput(
        { level: "tenant", tenantId: "t-1" },
        {
          codePolicy: { ...DEFAULT_CODE_POLICY, blockedPackages: ["risky-pkg"] },
        },
      ),
    );

    const effective = svc.resolveEffectivePolicy({
      level: "tenant",
      tenantId: "t-1",
    });
    expect(effective.catalogs.codePolicy.blockedPackages).toContain("malicious-pkg");
    expect(effective.catalogs.codePolicy.blockedPackages).toContain("risky-pkg");
  });

  it("tools are intersected by id", () => {
    svc.setGlobalPolicy(globalInput());
    svc.setPolicy(
      scopedInput(
        { level: "tenant", tenantId: "t-1" },
        toolsOnly("web-search", "file-read", "file-write"),
      ),
    );

    const effective = svc.resolveEffectivePolicy({
      level: "tenant",
      tenantId: "t-1",
    });
    expect(effective.catalogs.tools).toHaveLength(3);
    expect(effective.catalogs.tools.map((t) => t.id)).toEqual(
      expect.arrayContaining(["web-search", "file-read", "file-write"]),
    );
  });
});

// ── Gate 0 Check ─────────────────────────────────────────────────────────────

describe("Gate 0 Check", () => {
  let svc: PolicyService;

  beforeEach(() => {
    svc = createService();
    svc.setGlobalPolicy(globalInput());
  });

  it("allows a model in the catalog", () => {
    const result = svc.check({
      resourceType: "model",
      resourceId: "llama3.1-8b",
      scope: { level: "global" },
    });
    expect(result.allowed).toBe(true);
  });

  it("denies a model not in the catalog", () => {
    const result = svc.check({
      resourceType: "model",
      resourceId: "gpt-4o",
      scope: { level: "global" },
    });
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("not available");
  });

  it("denies a disabled model", () => {
    const disabledModels = DEFAULT_MODELS.map((m) =>
      m.id === "llama3.1-8b" ? { ...m, enabled: false } : m,
    );
    svc.setGlobalPolicy(globalInput({ models: disabledModels }));

    const result = svc.check({
      resourceType: "model",
      resourceId: "llama3.1-8b",
      scope: { level: "global" },
    });
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("disabled");
  });

  it("allows a tool in the catalog", () => {
    const result = svc.check({
      resourceType: "tool",
      resourceId: "web-search",
      scope: { level: "global" },
    });
    expect(result.allowed).toBe(true);
  });

  it("denies a tool on the deny list", () => {
    svc.setGlobalPolicy(globalInput(undefined, { toolDenyList: ["web-search"] }));
    const result = svc.check({
      resourceType: "tool",
      resourceId: "web-search",
      scope: { level: "global" },
    });
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("deny list");
  });

  it("marks a tool as requiring approval", () => {
    const result = svc.check({
      resourceType: "tool",
      resourceId: "shell-exec",
      scope: { level: "global" },
    });
    expect(result.allowed).toBe(true);
    expect(result.requiresApproval).toBe(true);
  });

  it("allows a skill in the catalog", () => {
    const result = svc.check({
      resourceType: "skill",
      resourceId: "research",
      scope: { level: "global" },
    });
    expect(result.allowed).toBe(true);
  });

  it("denies a skill not in the catalog", () => {
    const result = svc.check({
      resourceType: "skill",
      resourceId: "hacking",
      scope: { level: "global" },
    });
    expect(result.allowed).toBe(false);
  });

  it("allows a secret at a valid scope", () => {
    const result = svc.check({
      resourceType: "secret",
      resourceId: "ollama-api",
      scope: { level: "global" },
    });
    expect(result.allowed).toBe(true);
  });

  it("denies a secret at an invalid scope", () => {
    const result = svc.check({
      resourceType: "secret",
      resourceId: "github-token",
      scope: { level: "global" },
    });
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("not allowed at scope");
  });

  it("allows a language in the code policy", () => {
    const result = svc.check({
      resourceType: "language",
      resourceId: "typescript",
      scope: { level: "global" },
    });
    expect(result.allowed).toBe(true);
  });

  it("denies a language not in the code policy", () => {
    const result = svc.check({
      resourceType: "language",
      resourceId: "cobol",
      scope: { level: "global" },
    });
    expect(result.allowed).toBe(false);
  });

  it("allows a package not blocked", () => {
    const result = svc.check({
      resourceType: "package",
      resourceId: "express",
      scope: { level: "global" },
    });
    expect(result.allowed).toBe(true);
  });

  it("denies a blocked package", () => {
    svc.setGlobalPolicy(
      globalInput({
        codePolicy: { ...DEFAULT_CODE_POLICY, blockedPackages: ["evil-pkg"] },
      }),
    );
    const result = svc.check({
      resourceType: "package",
      resourceId: "evil-pkg",
      scope: { level: "global" },
    });
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("blocked");
  });

  it("cascade affects check results", () => {
    // Global allows all models, tenant restricts to 2
    svc.setPolicy(
      scopedInput(
        { level: "tenant", tenantId: "t-1" },
        modelsOnly("llama3.1-8b", "deepseek-r1-14b"),
      ),
    );

    const allowed = svc.check({
      resourceType: "model",
      resourceId: "llama3.1-8b",
      scope: { level: "tenant", tenantId: "t-1" },
    });
    expect(allowed.allowed).toBe(true);

    const denied = svc.check({
      resourceType: "model",
      resourceId: "qwen2.5-72b",
      scope: { level: "tenant", tenantId: "t-1" },
    });
    expect(denied.allowed).toBe(false);
  });

  it("tool not in catalog is denied", () => {
    const result = svc.check({
      resourceType: "tool",
      resourceId: "nonexistent-tool",
      scope: { level: "global" },
    });
    expect(result.allowed).toBe(false);
  });

  it("disabled tool is denied", () => {
    // payment-submit is disabled by default
    const result = svc.check({
      resourceType: "tool",
      resourceId: "payment-submit",
      scope: { level: "global" },
    });
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("disabled");
  });

  it("disabled skill is denied", () => {
    const disabledSkills = DEFAULT_SKILLS.map((s) =>
      s.id === "research" ? { ...s, enabled: false } : s,
    );
    svc.setGlobalPolicy(globalInput({ skills: disabledSkills }));

    const result = svc.check({
      resourceType: "skill",
      resourceId: "research",
      scope: { level: "global" },
    });
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("disabled");
  });
});

// ── Filtered Catalog Queries ─────────────────────────────────────────────────

describe("Filtered Catalog Queries", () => {
  let svc: PolicyService;

  beforeEach(() => {
    svc = createService();
    svc.setGlobalPolicy(globalInput());
  });

  it("getAvailableModels returns only enabled models", () => {
    const models = svc.getAvailableModels({ level: "global" });
    expect(models.every((m) => m.enabled)).toBe(true);
    expect(models.length).toBe(DEFAULT_MODELS.filter((m) => m.enabled).length);
  });

  it("getAvailableModels respects tenant restriction", () => {
    svc.setPolicy(scopedInput({ level: "tenant", tenantId: "t-1" }, modelsOnly("llama3.1-8b")));
    const models = svc.getAvailableModels({ level: "tenant", tenantId: "t-1" });
    expect(models).toHaveLength(1);
    expect(models[0].id).toBe("llama3.1-8b");
  });

  it("getAvailableTools excludes denied tools", () => {
    svc.setGlobalPolicy(globalInput(undefined, { toolDenyList: ["web-search"] }));
    const tools = svc.getAvailableTools({ level: "global" });
    expect(tools.find((t) => t.id === "web-search")).toBeUndefined();
  });

  it("getAvailableTools excludes disabled tools", () => {
    const tools = svc.getAvailableTools({ level: "global" });
    expect(tools.find((t) => t.id === "payment-submit")).toBeUndefined();
  });

  it("getAvailableSkills returns only enabled skills", () => {
    const skills = svc.getAvailableSkills({ level: "global" });
    expect(skills.every((s) => s.enabled)).toBe(true);
  });

  it("getAvailableSecrets filters by scope level", () => {
    const globalSecrets = svc.getAvailableSecrets({ level: "global" });
    const agentSecrets = svc.getAvailableSecrets({ level: "agent", agentId: "a-1" });
    // ollama-api is allowed at global, github-token is allowed at tenant/agent
    expect(globalSecrets.find((s) => s.id === "ollama-api")).toBeDefined();
    expect(globalSecrets.find((s) => s.id === "github-token")).toBeUndefined();
    expect(agentSecrets.find((s) => s.id === "github-token")).toBeDefined();
  });

  it("getEffectiveCodePolicy returns merged code policy", () => {
    svc.setPolicy(
      scopedInput(
        { level: "tenant", tenantId: "t-1" },
        {
          codePolicy: {
            allowedLanguages: ["typescript", "python"],
            approvedRegistries: DEFAULT_CODE_POLICY.approvedRegistries,
            versionConstraints: { typescript: "^5.0.0" },
            blockedPackages: [],
          },
        },
      ),
    );

    const policy = svc.getEffectiveCodePolicy({ level: "tenant", tenantId: "t-1" });
    expect(policy.allowedLanguages).toEqual(["typescript", "python"]);
    expect(policy.versionConstraints.typescript).toBe("^5.0.0");
  });
});

// ── Validation Helpers ───────────────────────────────────────────────────────

describe("Validation Helpers", () => {
  let svc: PolicyService;

  beforeEach(() => {
    svc = createService();
    svc.setGlobalPolicy(globalInput());
  });

  it("validateModelAssignment allows valid model", () => {
    const result = svc.validateModelAssignment("llama3.1-8b", { level: "global" });
    expect(result.allowed).toBe(true);
  });

  it("validateModelAssignment denies unavailable model", () => {
    const result = svc.validateModelAssignment("gpt-4o", { level: "global" });
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("not available");
  });

  it("validateModelAssignment respects scope cascade", () => {
    svc.setPolicy(scopedInput({ level: "tenant", tenantId: "t-1" }, modelsOnly("llama3.1-8b")));

    const allowed = svc.validateModelAssignment("llama3.1-8b", {
      level: "tenant",
      tenantId: "t-1",
    });
    expect(allowed.allowed).toBe(true);

    const denied = svc.validateModelAssignment("qwen2.5-72b", { level: "tenant", tenantId: "t-1" });
    expect(denied.allowed).toBe(false);
  });

  it("validateMaturityLevel allows level within ceiling", () => {
    const result = svc.validateMaturityLevel("research", 3, { level: "global" });
    expect(result.allowed).toBe(true);
  });

  it("validateMaturityLevel denies level above ceiling", () => {
    // Finance ceiling is 2 by default
    const result = svc.validateMaturityLevel("finance", 3, { level: "global" });
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("exceeds ceiling");
  });

  it("validateMaturityLevel allows level exactly at ceiling", () => {
    const result = svc.validateMaturityLevel("finance", 2, { level: "global" });
    expect(result.allowed).toBe(true);
  });

  it("validateMaturityLevel allows any level if no ceiling set", () => {
    svc.setGlobalPolicy(globalInput(undefined, { maturityCeilings: {} }));
    const result = svc.validateMaturityLevel("research", 4, { level: "global" });
    expect(result.allowed).toBe(true);
  });

  it("validateMaturityLevel uses cascaded ceiling", () => {
    // Global ceiling for research: 4, tenant ceiling: 2
    svc.setPolicy(
      scopedInput({ level: "tenant", tenantId: "t-1" }, undefined, {
        maturityCeilings: { research: 2 },
      }),
    );

    const result = svc.validateMaturityLevel("research", 3, { level: "tenant", tenantId: "t-1" });
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("exceeds ceiling 2");
  });
});

// ── Edge Cases ───────────────────────────────────────────────────────────────

describe("Edge Cases", () => {
  let svc: PolicyService;

  beforeEach(() => {
    svc = createService();
  });

  it("empty catalog intersection yields empty result", () => {
    svc.setGlobalPolicy(globalInput(modelsOnly("llama3.1-8b")));
    svc.setPolicy(scopedInput({ level: "tenant", tenantId: "t-1" }, modelsOnly("deepseek-r1-14b")));

    const effective = svc.resolveEffectivePolicy({
      level: "tenant",
      tenantId: "t-1",
    });
    expect(effective.catalogs.models).toHaveLength(0);
  });

  it("duplicate deny list entries are deduplicated", () => {
    svc.setGlobalPolicy(globalInput(undefined, { toolDenyList: ["tool-a", "tool-a"] }));
    svc.setPolicy(
      scopedInput({ level: "tenant", tenantId: "t-1" }, undefined, {
        toolDenyList: ["tool-a", "tool-b"],
      }),
    );

    const effective = svc.resolveEffectivePolicy({
      level: "tenant",
      tenantId: "t-1",
    });
    const aCount = effective.constraints.toolDenyList.filter((t) => t === "tool-a").length;
    expect(aCount).toBe(1);
  });

  it("rate limits: undefined values from child dont override parent", () => {
    svc.setGlobalPolicy(
      globalInput(undefined, {
        rateLimits: { requestsPerMinute: 60, tokensPerHour: 1_000_000 },
      }),
    );
    svc.setPolicy(
      scopedInput({ level: "tenant", tenantId: "t-1" }, undefined, {
        rateLimits: { requestsPerMinute: 30 },
      }),
    );

    const effective = svc.resolveEffectivePolicy({
      level: "tenant",
      tenantId: "t-1",
    });
    expect(effective.constraints.rateLimits.requestsPerMinute).toBe(30);
    expect(effective.constraints.rateLimits.tokensPerHour).toBe(1_000_000);
  });

  it("version constraints are merged with child overriding parent", () => {
    svc.setGlobalPolicy(
      globalInput({
        codePolicy: {
          ...DEFAULT_CODE_POLICY,
          versionConstraints: { react: "^18.0.0", typescript: "^5.0.0" },
        },
      }),
    );
    svc.setPolicy(
      scopedInput(
        { level: "tenant", tenantId: "t-1" },
        {
          codePolicy: {
            ...DEFAULT_CODE_POLICY,
            versionConstraints: { react: "^19.0.0" },
          },
        },
      ),
    );

    const policy = svc.getEffectiveCodePolicy({ level: "tenant", tenantId: "t-1" });
    expect(policy.versionConstraints.react).toBe("^19.0.0");
    expect(policy.versionConstraints.typescript).toBe("^5.0.0");
  });

  it("context fills in missing scope data for cascade", () => {
    svc.setGlobalPolicy(globalInput());
    svc.setPolicy(
      scopedInput(
        { level: "entity-type", entityType: "llc" },
        modelsOnly("llama3.1-8b", "llama3.1-70b"),
      ),
    );

    // Scope only says "agent" but context provides entityType for cascade
    const effective = svc.resolveEffectivePolicy(
      { level: "agent", agentId: "a-1" },
      { entityType: "llc", tenantId: "t-1" },
    );
    // Entity-type restricted to 2 models
    expect(effective.catalogs.models).toHaveLength(2);
  });

  it("custom default catalogs in constructor are used when no global policy", () => {
    const customModels = [DEFAULT_MODELS[0]]; // Only 1 model
    const customSvc = new PolicyService({
      defaultCatalogs: { ...DEFAULT_CATALOGS, models: customModels },
    });

    const effective = customSvc.resolveEffectivePolicy({ level: "global" });
    expect(effective.catalogs.models).toHaveLength(1);
  });

  it("required approval from both catalog and constraints is detected", () => {
    // file-write is not requiresApproval by default in catalog, add via constraints
    svc.setGlobalPolicy(globalInput(undefined, { requiredApprovals: ["file-write"] }));

    const result = svc.check({
      resourceType: "tool",
      resourceId: "file-write",
      scope: { level: "global" },
    });
    expect(result.allowed).toBe(true);
    expect(result.requiresApproval).toBe(true);
  });
});
