"use client";

import type {
  PolicyDocument,
  PolicyConstraints,
  ModelCatalogEntry,
  ToolCatalogEntry,
  SkillCatalogEntry,
} from "@six-fingered-man/governance";
import {
  Shield,
  Plus,
  Trash2,
  Cpu,
  Wrench,
  Zap,
  Lock,
  ChevronDown,
  ChevronRight,
  Check,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";
import { StatusHeader } from "@/components/status-header";
import { cn } from "@/lib/cn";
import { usePolicyStore } from "@/lib/policy-store";

// ── Scope Label ──────────────────────────────────────────────────────────────

function scopeLabel(doc: PolicyDocument): string {
  const s = doc.scope;
  switch (s.level) {
    case "global":
      return "Global";
    case "entity-type":
      return `Entity: ${s.entityType ?? "?"}`;
    case "tenant":
      return `Tenant: ${s.tenantId ?? "?"}`;
    case "agent":
      return `Agent: ${s.agentId ?? "?"}`;
  }
}

// ── Catalog Summary Cards ────────────────────────────────────────────────────

function ModelsSummary({ models }: { models: ModelCatalogEntry[] }) {
  const enabled = models.filter((m) => m.enabled);
  return (
    <div className="flex items-center gap-2">
      <Cpu className="h-4 w-4 text-[var(--color-accent)]" />
      <span className="text-xs text-[var(--color-text-muted)]">
        {enabled.length} model{enabled.length !== 1 ? "s" : ""}
      </span>
      <div className="flex flex-wrap gap-1 ml-1">
        {enabled.slice(0, 4).map((m) => (
          <span
            key={m.id}
            className="px-1.5 py-0.5 rounded text-[10px] bg-[var(--color-accent)]/10 text-[var(--color-accent)] border border-[var(--color-accent)]/20"
          >
            {m.displayName}
          </span>
        ))}
        {enabled.length > 4 && (
          <span className="text-[10px] text-[var(--color-text-muted)]">
            +{enabled.length - 4} more
          </span>
        )}
      </div>
    </div>
  );
}

function ToolsSummary({ tools }: { tools: ToolCatalogEntry[] }) {
  const enabled = tools.filter((t) => t.enabled);
  return (
    <div className="flex items-center gap-2">
      <Wrench className="h-4 w-4 text-[var(--color-warning)]" />
      <span className="text-xs text-[var(--color-text-muted)]">
        {enabled.length} tool{enabled.length !== 1 ? "s" : ""}
      </span>
      <div className="flex flex-wrap gap-1 ml-1">
        {enabled.map((t) => (
          <span
            key={t.id}
            className={cn(
              "px-1.5 py-0.5 rounded text-[10px] border",
              t.riskLevel === "critical"
                ? "bg-[var(--color-danger)]/10 text-[var(--color-danger)] border-[var(--color-danger)]/20"
                : t.riskLevel === "high"
                  ? "bg-[var(--color-warning)]/10 text-[var(--color-warning)] border-[var(--color-warning)]/20"
                  : "bg-[var(--color-bg)] text-[var(--color-text-muted)] border-[var(--color-border)]",
            )}
          >
            {t.name}
            {t.requiresApproval && " *"}
          </span>
        ))}
      </div>
    </div>
  );
}

function SkillsSummary({ skills }: { skills: SkillCatalogEntry[] }) {
  const enabled = skills.filter((s) => s.enabled);
  return (
    <div className="flex items-center gap-2">
      <Zap className="h-4 w-4 text-[var(--color-success)]" />
      <span className="text-xs text-[var(--color-text-muted)]">
        {enabled.length} skill{enabled.length !== 1 ? "s" : ""}
      </span>
    </div>
  );
}

function ConstraintsSummary({ constraints }: { constraints: PolicyConstraints }) {
  const ceilings = Object.entries(constraints.maturityCeilings);
  return (
    <div className="space-y-2 mt-3">
      <div className="flex items-center gap-2">
        <Lock className="h-4 w-4 text-[var(--color-text-muted)]" />
        <span className="text-xs font-medium uppercase tracking-wider text-[var(--color-text-muted)]">
          Constraints
        </span>
      </div>
      <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-xs">
        <div>
          <span className="text-[var(--color-text-muted)]">Sandbox: </span>
          <span className="text-[var(--color-text)]">{constraints.sandboxFloor}</span>
        </div>
        <div>
          <span className="text-[var(--color-text-muted)]">Deny list: </span>
          <span className="text-[var(--color-text)]">{constraints.toolDenyList.length} tools</span>
        </div>
        <div>
          <span className="text-[var(--color-text-muted)]">Approvals: </span>
          <span className="text-[var(--color-text)]">
            {constraints.requiredApprovals.length} tools
          </span>
        </div>
        <div>
          <span className="text-[var(--color-text-muted)]">Rate: </span>
          <span className="text-[var(--color-text)]">
            {constraints.rateLimits.requestsPerMinute ?? "~"}/min
          </span>
        </div>
      </div>
      {ceilings.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-1">
          {ceilings.map(([cat, level]) => (
            <span
              key={cat}
              className="px-1.5 py-0.5 rounded text-[10px] bg-[var(--color-bg)] text-[var(--color-text-muted)] border border-[var(--color-border)]"
            >
              {cat}: L{level}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Policy Card ──────────────────────────────────────────────────────────────

function PolicyCard({ policy, onDelete }: { policy: PolicyDocument; onDelete: () => void }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] hover:border-[var(--color-text-muted)] transition-colors">
      <div className="flex items-center justify-between px-5 py-4">
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-4 flex-1 min-w-0 text-left"
        >
          <span className="flex-shrink-0 w-12 h-12 rounded-lg flex items-center justify-center text-sm font-bold bg-[var(--color-accent)]/10 text-[var(--color-accent)] border border-[var(--color-accent)]/30">
            {policy.scope.level === "global" ? "G" : policy.scope.level[0].toUpperCase()}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-3">
              <h3 className="font-bold text-[var(--color-text)] truncate">{scopeLabel(policy)}</h3>
              <span className="text-xs text-[var(--color-text-muted)]">{policy.scope.level}</span>
            </div>
            <div className="flex items-center gap-4 mt-1 text-xs text-[var(--color-text-muted)]">
              <span>{policy.catalogs.models.filter((m) => m.enabled).length} models</span>
              <span>{policy.catalogs.tools.filter((t) => t.enabled).length} tools</span>
              <span>Updated {new Date(policy.updatedAt).toLocaleDateString()}</span>
            </div>
          </div>
          {expanded ? (
            <ChevronDown className="h-5 w-5 text-[var(--color-text-muted)] flex-shrink-0" />
          ) : (
            <ChevronRight className="h-5 w-5 text-[var(--color-text-muted)] flex-shrink-0" />
          )}
        </button>
        {policy.scope.level !== "global" && (
          <button
            onClick={onDelete}
            className="ml-3 p-2 rounded text-[var(--color-text-muted)] hover:text-[var(--color-danger)] hover:bg-[var(--color-danger)]/10 transition-colors"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        )}
      </div>

      {expanded && (
        <div className="px-5 pb-4 border-t border-[var(--color-border)] pt-4 space-y-3">
          <ModelsSummary models={policy.catalogs.models} />
          <ToolsSummary tools={policy.catalogs.tools} />
          <SkillsSummary skills={policy.catalogs.skills} />
          <ConstraintsSummary constraints={policy.constraints} />
          <div className="text-xs text-[var(--color-text-muted)] pt-2 border-t border-[var(--color-border)]">
            <span>Code: {policy.catalogs.codePolicy.allowedLanguages.join(", ")}</span>
            {policy.catalogs.codePolicy.blockedPackages.length > 0 && (
              <span className="ml-4 text-[var(--color-danger)]">
                {policy.catalogs.codePolicy.blockedPackages.length} blocked pkg(s)
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Gate 0 Check Widget ──────────────────────────────────────────────────────

function PolicyCheckWidget() {
  const { checkPolicy } = usePolicyStore();
  const [resourceType, setResourceType] = useState("model");
  const [resourceId, setResourceId] = useState("");
  const [result, setResult] = useState<{
    allowed: boolean;
    reason: string;
    requiresApproval?: boolean;
  } | null>(null);

  const handleCheck = async () => {
    if (!resourceId) {
      return;
    }
    try {
      const r = await checkPolicy({
        resourceType,
        resourceId,
        scope: { level: "global" },
      });
      setResult(r);
    } catch {
      // error handled by store
    }
  };

  return (
    <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
      <h3 className="text-xs font-medium uppercase tracking-wider text-[var(--color-text-muted)] mb-3">
        Gate 0 Policy Check
      </h3>
      <div className="flex gap-2">
        <select
          value={resourceType}
          onChange={(e) => setResourceType(e.target.value)}
          className="px-3 py-2 rounded border border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-text)] text-sm"
        >
          <option value="model">Model</option>
          <option value="tool">Tool</option>
          <option value="skill">Skill</option>
          <option value="language">Language</option>
          <option value="package">Package</option>
        </select>
        <input
          type="text"
          value={resourceId}
          onChange={(e) => setResourceId(e.target.value)}
          placeholder="e.g. llama3.1-8b"
          className="flex-1 px-3 py-2 rounded border border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-text)] text-sm placeholder:text-[var(--color-text-muted)]"
        />
        <button
          onClick={handleCheck}
          disabled={!resourceId}
          className={cn(
            "px-4 py-2 rounded text-sm font-medium",
            resourceId
              ? "bg-[var(--color-accent)] text-white hover:bg-[var(--color-accent)]/80"
              : "bg-[var(--color-border)] text-[var(--color-text-muted)] cursor-not-allowed",
          )}
        >
          Check
        </button>
      </div>
      {result && (
        <div
          className={cn(
            "mt-3 px-4 py-3 rounded border text-sm flex items-center gap-2",
            result.allowed
              ? "border-[var(--color-success)]/30 bg-[var(--color-success)]/10 text-[var(--color-success)]"
              : "border-[var(--color-danger)]/30 bg-[var(--color-danger)]/10 text-[var(--color-danger)]",
          )}
        >
          {result.allowed ? (
            <Check className="h-4 w-4 flex-shrink-0" />
          ) : (
            <X className="h-4 w-4 flex-shrink-0" />
          )}
          <span>{result.reason}</span>
          {result.requiresApproval && (
            <span className="ml-2 px-1.5 py-0.5 rounded text-[10px] bg-[var(--color-warning)]/20 text-[var(--color-warning)] border border-[var(--color-warning)]/30">
              requires approval
            </span>
          )}
        </div>
      )}
    </div>
  );
}

// ── Policies Page ────────────────────────────────────────────────────────────

export default function PoliciesPage() {
  const { policies, loading, error, fetchPolicies, setGlobalPolicy, clearError } = usePolicyStore();
  const [initializing, setInitializing] = useState(false);

  useEffect(() => {
    void fetchPolicies();
  }, [fetchPolicies]);

  const hasGlobal = policies.some((p) => p.scope.level === "global");

  const handleInitGlobal = async () => {
    setInitializing(true);
    try {
      // Fetch defaults from catalog endpoint, then set as global policy
      const res = await fetch("/api/policies/catalog/models");
      const models = await res.json();
      const toolsRes = await fetch("/api/policies/catalog/tools");
      const tools = await toolsRes.json();
      const skillsRes = await fetch("/api/policies/catalog/skills");
      const skills = await skillsRes.json();

      // Use the full default catalogs from the server
      // This triggers the PolicyService defaults
      await setGlobalPolicy({
        catalogs: {
          models,
          tools,
          secrets: [
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
          ],
          skills,
          codePolicy: {
            allowedLanguages: ["typescript", "javascript", "python", "rust", "go"],
            approvedRegistries: ["https://registry.npmjs.org", "https://pypi.org/simple"],
            versionConstraints: {},
            blockedPackages: [],
          },
        },
        constraints: {
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
        },
        updatedBy: "did:key:z6MkadminDashboard000000000000000000000000000" as DID,
      });
      void fetchPolicies();
    } catch {
      // error handled by store
    } finally {
      setInitializing(false);
    }
  };

  const handleDelete = (doc: PolicyDocument) => {
    if (!confirm(`Delete ${scopeLabel(doc)} policy?`)) {
      return;
    }
    // Simplified: just refetch after delete
    void fetch(
      `/api/policies/${doc.scope.level}?${new URLSearchParams(
        Object.fromEntries(
          Object.entries(doc.scope)
            .filter(([k, v]) => k !== "level" && v)
            .map(([k, v]) => [k, String(v)]),
        ),
      ).toString()}&deletedBy=did:key:z6MkadminDashboard000000000000000000000000000`,
      { method: "DELETE" },
    ).then(() => fetchPolicies());
  };

  return (
    <div className="flex flex-col h-screen">
      <StatusHeader />

      <div className="flex-1 overflow-auto">
        <div className="max-w-5xl mx-auto px-6 py-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <Shield className="h-6 w-6 text-[var(--color-accent)]" />
              <h1 className="text-xl font-bold tracking-wider uppercase text-[var(--color-text)]">
                MSP Policies
              </h1>
              <span className="text-sm text-[var(--color-text-muted)]">
                {policies.length} polic{policies.length !== 1 ? "ies" : "y"}
              </span>
            </div>
            {!hasGlobal && (
              <button
                onClick={handleInitGlobal}
                disabled={initializing}
                className="flex items-center gap-2 px-4 py-2 rounded bg-[var(--color-accent)] text-white text-sm font-medium hover:bg-[var(--color-accent)]/80 transition-colors disabled:opacity-50"
              >
                <Plus className="h-4 w-4" />
                {initializing ? "Initializing..." : "Initialize Global Policy"}
              </button>
            )}
          </div>

          {/* Three Gates Explainer */}
          <div className="grid grid-cols-3 gap-3 mb-6">
            {[
              {
                gate: "Gate 0",
                label: "MSP Policy",
                desc: "Is this resource available at all?",
                color: "var(--color-accent)",
              },
              {
                gate: "Gate 1",
                label: "Contract (VC)",
                desc: "Does this agent have permission?",
                color: "var(--color-warning)",
              },
              {
                gate: "Gate 2",
                label: "Runtime",
                desc: "Within scope, maturity, rate limits?",
                color: "var(--color-success)",
              },
            ].map((g) => (
              <div
                key={g.gate}
                className="rounded border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3"
              >
                <div className="flex items-center gap-2 mb-1">
                  <span
                    className="text-xs font-bold uppercase tracking-wider"
                    style={{ color: g.color }}
                  >
                    {g.gate}
                  </span>
                  <span className="text-xs text-[var(--color-text)]">{g.label}</span>
                </div>
                <p className="text-[10px] text-[var(--color-text-muted)]">{g.desc}</p>
              </div>
            ))}
          </div>

          {/* Error */}
          {error && (
            <div className="mb-4 px-4 py-3 rounded border border-[var(--color-danger)]/30 bg-[var(--color-danger)]/10 text-[var(--color-danger)] text-sm flex items-center justify-between">
              {error}
              <button onClick={clearError} className="text-xs underline ml-4">
                dismiss
              </button>
            </div>
          )}

          {/* Gate 0 Check */}
          {hasGlobal && (
            <div className="mb-6">
              <PolicyCheckWidget />
            </div>
          )}

          {/* Loading */}
          {loading && policies.length === 0 && (
            <div className="text-center py-12 text-[var(--color-text-muted)]">
              Loading policies...
            </div>
          )}

          {/* Empty state */}
          {!loading && policies.length === 0 && (
            <div className="text-center py-16">
              <Shield className="h-12 w-12 mx-auto text-[var(--color-text-muted)] mb-4" />
              <p className="text-[var(--color-text-muted)] mb-4">
                No policies configured. Initialize the global policy to set up the MSP governance
                floor.
              </p>
            </div>
          )}

          {/* Policy List */}
          <div className="space-y-3">
            {policies.map((policy) => (
              <PolicyCard key={policy.id} policy={policy} onDelete={() => handleDelete(policy)} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// Type import needed for the DID cast in handleInitGlobal
import type { DID } from "@six-fingered-man/governance";
