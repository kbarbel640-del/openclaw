"use client";

import type { EntityType, EntityConfig } from "@six-fingered-man/governance";
import {
  Building2,
  Plus,
  Users,
  Bot,
  FolderOpen,
  Shield,
  ChevronRight,
  Trash2,
  Eye,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { StatusHeader } from "@/components/status-header";
import { cn } from "@/lib/cn";
import { useTenantStore } from "@/lib/tenant-store";

// ── Entity Type Info ─────────────────────────────────────────────────────────

const ENTITY_ICONS: Record<string, string> = {
  personal: "P",
  "sole-proprietor": "SP",
  partnership: "PT",
  llc: "LLC",
  "s-corp": "SC",
  franchise: "FR",
  "non-profit": "NP",
};

const ENTITY_DESCRIPTIONS: Record<string, string> = {
  personal: "1 human, 1-2 agents, minimal governance",
  "sole-proprietor": "1 owner, 2-4 agents, light governance",
  partnership: "2+ partners, multi-sig, formal governance",
  llc: "1+ members, configurable multi-sig, standard governance",
  "s-corp": "Board structure, full C-suite, strict governance",
  franchise: "Parent/location model, template-driven",
  "non-profit": "Board governance, strict financial controls",
};

// ── Create Tenant Modal ──────────────────────────────────────────────────────

function CreateTenantModal({ onClose }: { onClose: () => void }) {
  const { entityTypes, preview, fetchEntityTypes, fetchPreview, createTenant } = useTenantStore();
  const [name, setName] = useState("");
  const [entityType, setEntityType] = useState<EntityType | "">("");
  const [memberStructure, setMemberStructure] = useState<"single" | "multi">("single");
  const [memberCount, setMemberCount] = useState(2);
  const [partnerCount, setPartnerCount] = useState(2);
  const [franchiseRole, setFranchiseRole] = useState<"franchisor" | "franchisee">("franchisee");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    void fetchEntityTypes();
  }, [fetchEntityTypes]);

  useEffect(() => {
    if (!entityType) {
      return;
    }
    const config: Record<string, string> = {};
    if (entityType === "llc") {
      config.memberStructure = memberStructure;
      if (memberStructure === "multi") {
        config.memberCount = String(memberCount);
      }
    }
    if (entityType === "partnership") {
      config.partnerCount = String(partnerCount);
    }
    if (entityType === "franchise") {
      config.franchiseRole = franchiseRole;
    }
    void fetchPreview(entityType, config);
  }, [entityType, memberStructure, memberCount, partnerCount, franchiseRole, fetchPreview]);

  const handleCreate = async () => {
    if (!name || !entityType) {
      return;
    }
    setCreating(true);
    try {
      const entityConfig: EntityConfig = {};
      if (entityType === "llc") {
        entityConfig.memberStructure = memberStructure;
        if (memberStructure === "multi") {
          entityConfig.memberCount = memberCount;
        }
      }
      if (entityType === "partnership") {
        entityConfig.partnerCount = partnerCount;
      }
      if (entityType === "franchise") {
        entityConfig.franchiseRole = franchiseRole;
      }

      await createTenant({ name, entityType, entityConfig });
      onClose();
    } catch {
      // error handled by store
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="w-full max-w-2xl mx-4 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--color-border)]">
          <h2 className="text-lg font-bold tracking-wider uppercase text-[var(--color-text)]">
            Create Tenant
          </h2>
          <button
            onClick={onClose}
            className="text-[var(--color-text-muted)] hover:text-[var(--color-text)] text-xl leading-none"
          >
            x
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* Name */}
          <div>
            <label className="block text-xs font-medium uppercase tracking-wider text-[var(--color-text-muted)] mb-2">
              Organization Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. NerdPlanet LLC"
              className="w-full px-3 py-2 rounded border border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-text)] text-sm placeholder:text-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-accent)]"
            />
          </div>

          {/* Entity Type Grid */}
          <div>
            <label className="block text-xs font-medium uppercase tracking-wider text-[var(--color-text-muted)] mb-2">
              Entity Type
            </label>
            <div className="grid grid-cols-2 gap-2">
              {entityTypes.map((et) => (
                <button
                  key={et.value}
                  onClick={() => setEntityType(et.value)}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded border text-left transition-colors",
                    entityType === et.value
                      ? "border-[var(--color-accent)] bg-[var(--color-accent)]/10"
                      : "border-[var(--color-border)] hover:border-[var(--color-text-muted)]",
                  )}
                >
                  <span
                    className={cn(
                      "flex-shrink-0 w-10 h-10 rounded flex items-center justify-center text-xs font-bold",
                      entityType === et.value
                        ? "bg-[var(--color-accent)] text-white"
                        : "bg-[var(--color-bg)] text-[var(--color-text-muted)]",
                    )}
                  >
                    {ENTITY_ICONS[et.value] || "?"}
                  </span>
                  <div>
                    <div className="text-sm font-medium text-[var(--color-text)]">{et.label}</div>
                    <div className="text-xs text-[var(--color-text-muted)]">
                      {ENTITY_DESCRIPTIONS[et.value]}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Entity-specific config */}
          {entityType === "llc" && (
            <div className="flex gap-4">
              <div className="flex-1">
                <label className="block text-xs font-medium uppercase tracking-wider text-[var(--color-text-muted)] mb-2">
                  Member Structure
                </label>
                <select
                  value={memberStructure}
                  onChange={(e) => setMemberStructure(e.target.value as "single" | "multi")}
                  className="w-full px-3 py-2 rounded border border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-text)] text-sm"
                >
                  <option value="single">Single Member</option>
                  <option value="multi">Multi Member</option>
                </select>
              </div>
              {memberStructure === "multi" && (
                <div className="w-32">
                  <label className="block text-xs font-medium uppercase tracking-wider text-[var(--color-text-muted)] mb-2">
                    Members
                  </label>
                  <input
                    type="number"
                    min={2}
                    max={10}
                    value={memberCount}
                    onChange={(e) => setMemberCount(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded border border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-text)] text-sm"
                  />
                </div>
              )}
            </div>
          )}

          {entityType === "partnership" && (
            <div className="w-32">
              <label className="block text-xs font-medium uppercase tracking-wider text-[var(--color-text-muted)] mb-2">
                Partners
              </label>
              <input
                type="number"
                min={2}
                max={20}
                value={partnerCount}
                onChange={(e) => setPartnerCount(Number(e.target.value))}
                className="w-full px-3 py-2 rounded border border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-text)] text-sm"
              />
            </div>
          )}

          {entityType === "franchise" && (
            <div>
              <label className="block text-xs font-medium uppercase tracking-wider text-[var(--color-text-muted)] mb-2">
                Role
              </label>
              <select
                value={franchiseRole}
                onChange={(e) => setFranchiseRole(e.target.value as "franchisor" | "franchisee")}
                className="w-full px-3 py-2 rounded border border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-text)] text-sm"
              >
                <option value="franchisee">Franchisee (Location)</option>
                <option value="franchisor">Franchisor (Parent)</option>
              </select>
            </div>
          )}

          {/* Preview */}
          {preview && entityType && (
            <div className="rounded border border-[var(--color-border)] bg-[var(--color-bg)] p-4">
              <div className="flex items-center gap-2 mb-3">
                <Eye className="h-4 w-4 text-[var(--color-accent)]" />
                <span className="text-xs font-medium uppercase tracking-wider text-[var(--color-text-muted)]">
                  Template Preview
                </span>
              </div>
              <div className="grid grid-cols-3 gap-3 text-xs">
                <div>
                  <span className="text-[var(--color-text-muted)]">Isolation</span>
                  <div className="text-[var(--color-text)] font-medium mt-0.5">
                    {preview.isolation}
                  </div>
                </div>
                <div>
                  <span className="text-[var(--color-text-muted)]">Multi-Sig</span>
                  <div className="text-[var(--color-text)] font-medium mt-0.5">
                    {preview.multiSigRequired
                      ? `Required (${preview.multiSigThreshold}/${preview.multiSigThreshold})`
                      : "Off"}
                  </div>
                </div>
                <div>
                  <span className="text-[var(--color-text-muted)]">Escalation</span>
                  <div className="text-[var(--color-text)] font-medium mt-0.5">
                    {preview.escalationTiers} tier
                    {preview.escalationTiers > 1 ? "s" : ""}
                  </div>
                </div>
              </div>
              <div className="mt-3">
                <span className="text-xs text-[var(--color-text-muted)]">Suggested Agents</span>
                <div className="flex flex-wrap gap-1.5 mt-1.5">
                  {preview.suggestedAgents.map((a) => (
                    <span
                      key={a.name}
                      className="px-2 py-0.5 rounded text-xs bg-[var(--color-accent)]/10 text-[var(--color-accent)] border border-[var(--color-accent)]/30"
                    >
                      {a.name} &middot; {a.role}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3 px-6 py-4 border-t border-[var(--color-border)]">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleCreate}
            disabled={!name || !entityType || creating}
            className={cn(
              "px-4 py-2 rounded text-sm font-medium transition-colors",
              name && entityType && !creating
                ? "bg-[var(--color-accent)] text-white hover:bg-[var(--color-accent)]/80"
                : "bg-[var(--color-border)] text-[var(--color-text-muted)] cursor-not-allowed",
            )}
          >
            {creating ? "Creating..." : "Create Tenant"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Tenants Page ─────────────────────────────────────────────────────────────

export default function TenantsPage() {
  const { tenants, loading, error, fetchTenants, deleteTenant, clearError } = useTenantStore();
  const [showCreate, setShowCreate] = useState(false);

  useEffect(() => {
    void fetchTenants();
  }, [fetchTenants]);

  return (
    <div className="flex flex-col h-screen">
      <StatusHeader />

      <div className="flex-1 overflow-auto">
        <div className="max-w-5xl mx-auto px-6 py-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <Building2 className="h-6 w-6 text-[var(--color-accent)]" />
              <h1 className="text-xl font-bold tracking-wider uppercase text-[var(--color-text)]">
                Tenants
              </h1>
              <span className="text-sm text-[var(--color-text-muted)]">
                {tenants.length} organization
                {tenants.length !== 1 ? "s" : ""}
              </span>
            </div>
            <button
              onClick={() => setShowCreate(true)}
              className="flex items-center gap-2 px-4 py-2 rounded bg-[var(--color-accent)] text-white text-sm font-medium hover:bg-[var(--color-accent)]/80 transition-colors"
            >
              <Plus className="h-4 w-4" />
              New Tenant
            </button>
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

          {/* Loading */}
          {loading && tenants.length === 0 && (
            <div className="text-center py-12 text-[var(--color-text-muted)]">
              Loading tenants...
            </div>
          )}

          {/* Empty state */}
          {!loading && tenants.length === 0 && (
            <div className="text-center py-16">
              <Building2 className="h-12 w-12 mx-auto text-[var(--color-text-muted)] mb-4" />
              <p className="text-[var(--color-text-muted)] mb-4">
                No tenants yet. Create your first organization to get started.
              </p>
              <button
                onClick={() => setShowCreate(true)}
                className="inline-flex items-center gap-2 px-4 py-2 rounded bg-[var(--color-accent)] text-white text-sm font-medium hover:bg-[var(--color-accent)]/80 transition-colors"
              >
                <Plus className="h-4 w-4" />
                Create Tenant
              </button>
            </div>
          )}

          {/* Tenant List */}
          <div className="space-y-3">
            {tenants.map((tenant) => (
              <div
                key={tenant.id}
                className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] hover:border-[var(--color-text-muted)] transition-colors"
              >
                <div className="flex items-center justify-between px-5 py-4">
                  <Link
                    href={`/tenants/${tenant.id}`}
                    className="flex items-center gap-4 flex-1 min-w-0"
                  >
                    <span className="flex-shrink-0 w-12 h-12 rounded-lg flex items-center justify-center text-sm font-bold bg-[var(--color-accent)]/10 text-[var(--color-accent)] border border-[var(--color-accent)]/30">
                      {ENTITY_ICONS[tenant.entityType] || "?"}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-3">
                        <h3 className="font-bold text-[var(--color-text)] truncate">
                          {tenant.name}
                        </h3>
                        {tenant.multiSigRequired && (
                          <span className="flex items-center gap-1 text-xs text-[var(--color-warning)]">
                            <Shield className="h-3 w-3" />
                            Multi-Sig
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-4 mt-1 text-xs text-[var(--color-text-muted)]">
                        <span className="flex items-center gap-1">
                          <Bot className="h-3 w-3" />
                          {tenant.agents.length} agents
                        </span>
                        <span className="flex items-center gap-1">
                          <FolderOpen className="h-3 w-3" />
                          {tenant.projects.length} projects
                        </span>
                        <span className="flex items-center gap-1">
                          <Users className="h-3 w-3" />
                          {tenant.humans.length} humans
                        </span>
                        <span>{tenant.isolation} isolation</span>
                      </div>
                    </div>
                    <ChevronRight className="h-5 w-5 text-[var(--color-text-muted)] flex-shrink-0" />
                  </Link>
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      if (confirm(`Delete "${tenant.name}"?`)) {
                        void deleteTenant(tenant.id);
                      }
                    }}
                    className="ml-3 p-2 rounded text-[var(--color-text-muted)] hover:text-[var(--color-danger)] hover:bg-[var(--color-danger)]/10 transition-colors"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {showCreate && (
        <CreateTenantModal
          onClose={() => {
            setShowCreate(false);
            void fetchTenants();
          }}
        />
      )}
    </div>
  );
}
