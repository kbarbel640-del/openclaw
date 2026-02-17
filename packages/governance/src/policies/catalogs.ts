/**
 * Default MSP catalog data — sensible starting point for governance policies.
 *
 * These represent what the MSP makes available to tenants. Tenants
 * select from these catalogs but cannot add resources the MSP hasn't approved.
 */

import type {
  ModelCatalogEntry,
  ToolCatalogEntry,
  SecretCatalogEntry,
  SkillCatalogEntry,
  CodePolicy,
  PolicyCatalogs,
  PolicyConstraints,
} from "../types.js";

// ── Default Model Catalog ────────────────────────────────────────────────────

export const DEFAULT_MODELS: ModelCatalogEntry[] = [
  {
    id: "llama3.1-8b",
    provider: "ollama",
    model: "llama3.1:8b",
    server: "localhost",
    displayName: "Llama 3.1 8B",
    costTier: "free",
    capabilityTier: "basic",
    contextWindow: 128_000,
    enabled: true,
  },
  {
    id: "llama3.1-70b",
    provider: "ollama",
    model: "llama3.1:70b",
    server: "maximus",
    displayName: "Llama 3.1 70B",
    costTier: "low",
    capabilityTier: "advanced",
    contextWindow: 128_000,
    enabled: true,
  },
  {
    id: "deepseek-r1-14b",
    provider: "ollama",
    model: "deepseek-r1:14b",
    server: "claudius",
    displayName: "DeepSeek R1 14B",
    costTier: "free",
    capabilityTier: "standard",
    contextWindow: 64_000,
    enabled: true,
  },
  {
    id: "deepseek-r1-32b",
    provider: "ollama",
    model: "deepseek-r1:32b",
    server: "tiberius",
    displayName: "DeepSeek R1 32B",
    costTier: "low",
    capabilityTier: "standard",
    contextWindow: 64_000,
    enabled: true,
  },
  {
    id: "deepseek-r1-70b",
    provider: "ollama",
    model: "deepseek-r1:70b",
    server: "maximus",
    displayName: "DeepSeek R1 70B",
    costTier: "low",
    capabilityTier: "advanced",
    contextWindow: 64_000,
    enabled: true,
  },
  {
    id: "qwen2.5-72b",
    provider: "ollama",
    model: "qwen2.5:72b",
    server: "maximus",
    displayName: "Qwen 2.5 72B",
    costTier: "low",
    capabilityTier: "advanced",
    contextWindow: 128_000,
    enabled: true,
  },
];

// ── Default Tool Catalog ─────────────────────────────────────────────────────

export const DEFAULT_TOOLS: ToolCatalogEntry[] = [
  {
    id: "web-search",
    name: "Web Search",
    categories: ["research"],
    riskLevel: "low",
    requiresApproval: false,
    enabled: true,
  },
  {
    id: "file-read",
    name: "File Read",
    categories: ["code-execution", "research"],
    riskLevel: "low",
    requiresApproval: false,
    enabled: true,
  },
  {
    id: "file-write",
    name: "File Write",
    categories: ["code-execution"],
    riskLevel: "medium",
    requiresApproval: false,
    enabled: true,
  },
  {
    id: "shell-exec",
    name: "Shell Execute",
    categories: ["code-execution", "infrastructure"],
    riskLevel: "high",
    requiresApproval: true,
    enabled: true,
  },
  {
    id: "api-call",
    name: "External API Call",
    categories: ["external-api"],
    riskLevel: "medium",
    requiresApproval: false,
    enabled: true,
  },
  {
    id: "email-send",
    name: "Send Email",
    categories: ["communications"],
    riskLevel: "medium",
    requiresApproval: true,
    enabled: true,
  },
  {
    id: "payment-submit",
    name: "Submit Payment",
    categories: ["finance"],
    riskLevel: "critical",
    requiresApproval: true,
    enabled: false,
  },
];

// ── Default Secret Catalog ───────────────────────────────────────────────────

export const DEFAULT_SECRETS: SecretCatalogEntry[] = [
  {
    id: "ollama-api",
    name: "Ollama API",
    provider: "ollama",
    allowedScopes: ["global", "tenant"],
  },
  {
    id: "github-token",
    name: "GitHub Token",
    provider: "github",
    allowedScopes: ["tenant", "agent"],
  },
];

// ── Default Skill Catalog ────────────────────────────────────────────────────

export const DEFAULT_SKILLS: SkillCatalogEntry[] = [
  {
    id: "research",
    name: "Research",
    categories: ["research"],
    minMaturityLevel: 1,
    enabled: true,
  },
  {
    id: "code-review",
    name: "Code Review",
    categories: ["code-execution"],
    minMaturityLevel: 2,
    enabled: true,
  },
  {
    id: "code-write",
    name: "Code Write",
    categories: ["code-execution"],
    minMaturityLevel: 2,
    enabled: true,
  },
  {
    id: "deploy",
    name: "Deploy",
    categories: ["infrastructure"],
    minMaturityLevel: 3,
    enabled: true,
  },
  {
    id: "financial-analysis",
    name: "Financial Analysis",
    categories: ["finance"],
    minMaturityLevel: 2,
    enabled: true,
  },
  {
    id: "communications",
    name: "Communications",
    categories: ["communications", "content"],
    minMaturityLevel: 1,
    enabled: true,
  },
];

// ── Default Code Policy ──────────────────────────────────────────────────────

export const DEFAULT_CODE_POLICY: CodePolicy = {
  allowedLanguages: ["typescript", "javascript", "python", "rust", "go"],
  approvedRegistries: ["https://registry.npmjs.org", "https://pypi.org/simple"],
  versionConstraints: {},
  blockedPackages: [],
};

// ── Default Constraints ──────────────────────────────────────────────────────

export const DEFAULT_CONSTRAINTS: PolicyConstraints = {
  maturityCeilings: {
    communications: 3,
    research: 4,
    finance: 2,
    content: 3,
    "code-execution": 3,
    infrastructure: 2,
    "external-api": 3,
  },
  sandboxFloor: "code-only",
  toolDenyList: [],
  requiredApprovals: ["shell-exec", "email-send"],
  rateLimits: {
    requestsPerMinute: 60,
    tokensPerHour: 1_000_000,
    costPerDay: 50,
  },
};

// ── Assembled Default Catalogs ───────────────────────────────────────────────

export const DEFAULT_CATALOGS: PolicyCatalogs = {
  models: DEFAULT_MODELS,
  tools: DEFAULT_TOOLS,
  secrets: DEFAULT_SECRETS,
  skills: DEFAULT_SKILLS,
  codePolicy: DEFAULT_CODE_POLICY,
};
