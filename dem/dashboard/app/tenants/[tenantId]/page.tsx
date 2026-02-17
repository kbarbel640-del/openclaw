"use client";

import {
  ArrowLeft,
  Bot,
  Users,
  FolderOpen,
  Plus,
  Shield,
  Trash2,
  Cpu,
  Key,
  Gauge,
} from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { GovernanceCanvas } from "@/components/governance-canvas";
import { StatusHeader } from "@/components/status-header";
import { cn } from "@/lib/cn";
import { useTenantStore } from "@/lib/tenant-store";
// ── Maturity Label ───────────────────────────────────────────────────────────

const MATURITY_LABELS: Record<number, { label: string; color: string }> = {
  0: { label: "Locked", color: "var(--color-danger)" },
  1: { label: "Human-in-Loop", color: "var(--color-warning)" },
  2: { label: "Supervised", color: "var(--color-accent)" },
  3: { label: "Autonomous", color: "var(--color-success)" },
};

function MaturityBadge({ level, fn }: { level: number; fn: string }) {
  const info = MATURITY_LABELS[level] || MATURITY_LABELS[0];
  return (
    <div className="flex items-center justify-between text-xs py-1">
      <span className="text-[var(--color-text-muted)] capitalize">{fn.replace("-", " ")}</span>
      <span style={{ color: info.color }} className="font-medium">
        L{level} {info.label}
      </span>
    </div>
  );
}

// ── Add Agent Modal ──────────────────────────────────────────────────────────

function AddAgentModal({
  tenantId,
  projectId,
  onClose,
}: {
  tenantId: string;
  projectId?: string;
  onClose: () => void;
}) {
  const { addAgent } = useTenantStore();
  const [name, setName] = useState("");
  const [role, setRole] = useState("");
  const [skills, setSkills] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!name || !role) {
      return;
    }
    setSaving(true);
    try {
      await addAgent(tenantId, {
        name,
        role,
        skills: skills ? skills.split(",").map((s) => s.trim()) : [],
        projectId,
      });
      onClose();
    } catch {
      // handled by store
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="w-full max-w-md mx-4 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] shadow-2xl">
        <div className="px-6 py-4 border-b border-[var(--color-border)]">
          <h2 className="text-lg font-bold tracking-wider uppercase text-[var(--color-text)]">
            Add Agent
          </h2>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-medium uppercase tracking-wider text-[var(--color-text-muted)] mb-1.5">
              Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Marketing"
              className="w-full px-3 py-2 rounded border border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-text)] text-sm focus:outline-none focus:border-[var(--color-accent)]"
            />
          </div>
          <div>
            <label className="block text-xs font-medium uppercase tracking-wider text-[var(--color-text-muted)] mb-1.5">
              Role
            </label>
            <input
              type="text"
              value={role}
              onChange={(e) => setRole(e.target.value)}
              placeholder="e.g. content-marketing"
              className="w-full px-3 py-2 rounded border border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-text)] text-sm focus:outline-none focus:border-[var(--color-accent)]"
            />
          </div>
          <div>
            <label className="block text-xs font-medium uppercase tracking-wider text-[var(--color-text-muted)] mb-1.5">
              Skills (comma-separated)
            </label>
            <input
              type="text"
              value={skills}
              onChange={(e) => setSkills(e.target.value)}
              placeholder="web_search, memory_search"
              className="w-full px-3 py-2 rounded border border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-text)] text-sm focus:outline-none focus:border-[var(--color-accent)]"
            />
          </div>
        </div>
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-[var(--color-border)]">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!name || !role || saving}
            className={cn(
              "px-4 py-2 rounded text-sm font-medium",
              name && role && !saving
                ? "bg-[var(--color-accent)] text-white hover:bg-[var(--color-accent)]/80"
                : "bg-[var(--color-border)] text-[var(--color-text-muted)] cursor-not-allowed",
            )}
          >
            {saving ? "Adding..." : "Add Agent"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Add Project Modal ────────────────────────────────────────────────────────

function AddProjectModal({ tenantId, onClose }: { tenantId: string; onClose: () => void }) {
  const { createProject } = useTenantStore();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!name) {
      return;
    }
    setSaving(true);
    try {
      await createProject(tenantId, { name, description: description || undefined });
      onClose();
    } catch {
      // handled by store
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="w-full max-w-md mx-4 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] shadow-2xl">
        <div className="px-6 py-4 border-b border-[var(--color-border)]">
          <h2 className="text-lg font-bold tracking-wider uppercase text-[var(--color-text)]">
            Create Project
          </h2>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-medium uppercase tracking-wider text-[var(--color-text-muted)] mb-1.5">
              Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Black Hole Registry"
              className="w-full px-3 py-2 rounded border border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-text)] text-sm focus:outline-none focus:border-[var(--color-accent)]"
            />
          </div>
          <div>
            <label className="block text-xs font-medium uppercase tracking-wider text-[var(--color-text-muted)] mb-1.5">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What is this project about?"
              rows={3}
              className="w-full px-3 py-2 rounded border border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-text)] text-sm focus:outline-none focus:border-[var(--color-accent)] resize-none"
            />
          </div>
        </div>
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-[var(--color-border)]">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!name || saving}
            className={cn(
              "px-4 py-2 rounded text-sm font-medium",
              name && !saving
                ? "bg-[var(--color-accent)] text-white hover:bg-[var(--color-accent)]/80"
                : "bg-[var(--color-border)] text-[var(--color-text-muted)] cursor-not-allowed",
            )}
          >
            {saving ? "Creating..." : "Create Project"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Add Human Modal ──────────────────────────────────────────────────────────

function AddHumanModal({ tenantId, onClose }: { tenantId: string; onClose: () => void }) {
  const { addHuman } = useTenantStore();
  const [name, setName] = useState("");
  const [signal, setSignal] = useState("");
  const [email, setEmail] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!name) {
      return;
    }
    setSaving(true);
    try {
      const contact: Record<string, string> = {};
      if (signal) {
        contact.signal = signal;
      }
      if (email) {
        contact.email = email;
      }
      await addHuman(tenantId, {
        name,
        contact: Object.keys(contact).length > 0 ? contact : undefined,
      });
      onClose();
    } catch {
      // handled by store
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="w-full max-w-md mx-4 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] shadow-2xl">
        <div className="px-6 py-4 border-b border-[var(--color-border)]">
          <h2 className="text-lg font-bold tracking-wider uppercase text-[var(--color-text)]">
            Add Human Operator
          </h2>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-medium uppercase tracking-wider text-[var(--color-text-muted)] mb-1.5">
              Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Titus"
              className="w-full px-3 py-2 rounded border border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-text)] text-sm focus:outline-none focus:border-[var(--color-accent)]"
            />
          </div>
          <div>
            <label className="block text-xs font-medium uppercase tracking-wider text-[var(--color-text-muted)] mb-1.5">
              Signal
            </label>
            <input
              type="text"
              value={signal}
              onChange={(e) => setSignal(e.target.value)}
              placeholder="+1234567890"
              className="w-full px-3 py-2 rounded border border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-text)] text-sm focus:outline-none focus:border-[var(--color-accent)]"
            />
          </div>
          <div>
            <label className="block text-xs font-medium uppercase tracking-wider text-[var(--color-text-muted)] mb-1.5">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@example.com"
              className="w-full px-3 py-2 rounded border border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-text)] text-sm focus:outline-none focus:border-[var(--color-accent)]"
            />
          </div>
        </div>
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-[var(--color-border)]">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!name || saving}
            className={cn(
              "px-4 py-2 rounded text-sm font-medium",
              name && !saving
                ? "bg-[var(--color-accent)] text-white hover:bg-[var(--color-accent)]/80"
                : "bg-[var(--color-border)] text-[var(--color-text-muted)] cursor-not-allowed",
            )}
          >
            {saving ? "Adding..." : "Add Human"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Page ────────────────────────────────────────────────────────────────

export default function TenantDetailPage() {
  const { tenantId } = useParams<{ tenantId: string }>();
  const { activeTenant: tenant, error, fetchTenant, removeAgent, clearError } = useTenantStore();
  const [showAddAgent, setShowAddAgent] = useState(false);
  const [addAgentProjectId, setAddAgentProjectId] = useState<string | undefined>();
  const [showAddProject, setShowAddProject] = useState(false);
  const [showAddHuman, setShowAddHuman] = useState(false);

  useEffect(() => {
    if (tenantId) {
      void fetchTenant(tenantId);
    }
  }, [tenantId, fetchTenant]);

  if (!tenant) {
    return (
      <div className="flex flex-col h-screen">
        <StatusHeader />
        <div className="flex-1 flex items-center justify-center text-[var(--color-text-muted)]">
          Loading tenant...
        </div>
      </div>
    );
  }

  const maturityEntries = Object.entries(tenant.defaultMaturity);

  return (
    <div className="flex flex-col h-screen">
      <StatusHeader />

      <div className="flex-1 overflow-auto">
        <div className="max-w-6xl mx-auto px-6 py-6">
          {/* Back + Header */}
          <div className="mb-6">
            <Link
              href="/tenants"
              className="inline-flex items-center gap-1.5 text-sm text-[var(--color-text-muted)] hover:text-[var(--color-accent)] transition-colors mb-3"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Tenants
            </Link>
            <div className="flex items-center gap-4">
              <h1 className="text-2xl font-bold tracking-wider text-[var(--color-text)]">
                {tenant.name}
              </h1>
              {tenant.multiSigRequired && (
                <span className="flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium bg-[var(--color-warning)]/10 text-[var(--color-warning)] border border-[var(--color-warning)]/30">
                  <Shield className="h-3.5 w-3.5" />
                  Multi-Sig ({tenant.multiSigThreshold})
                </span>
              )}
              <span className="px-2.5 py-1 rounded text-xs font-medium bg-[var(--color-surface)] text-[var(--color-text-muted)] border border-[var(--color-border)]">
                {tenant.isolation} isolation
              </span>
            </div>
            <div className="flex items-center gap-2 mt-2 text-xs text-[var(--color-text-muted)]">
              <Key className="h-3 w-3" />
              <span className="font-mono">{tenant.did}</span>
            </div>
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

          {/* Maturity Overview */}
          <div className="mb-6 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
            <div className="flex items-center gap-2 mb-3">
              <Gauge className="h-4 w-4 text-[var(--color-accent)]" />
              <h2 className="text-sm font-bold uppercase tracking-wider text-[var(--color-text)]">
                Default Maturity Levels
              </h2>
            </div>
            <div className="grid grid-cols-2 gap-x-8 gap-y-0.5">
              {maturityEntries.map(([fn, level]) => (
                <MaturityBadge key={fn} fn={fn} level={level as number} />
              ))}
            </div>
          </div>

          {/* Governance Canvas */}
          <div className="mb-6">
            <GovernanceCanvas tenant={tenant} />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Agents Column */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Bot className="h-4 w-4 text-[var(--color-accent)]" />
                  <h2 className="text-sm font-bold uppercase tracking-wider text-[var(--color-text)]">
                    Agents ({tenant.agents.length})
                  </h2>
                </div>
                <button
                  onClick={() => {
                    setAddAgentProjectId(undefined);
                    setShowAddAgent(true);
                  }}
                  className="p-1.5 rounded text-[var(--color-text-muted)] hover:text-[var(--color-accent)] hover:bg-[var(--color-accent)]/10 transition-colors"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>
              <div className="space-y-2">
                {tenant.agents.map((agent) => (
                  <div
                    key={agent.id}
                    className="rounded border border-[var(--color-border)] bg-[var(--color-surface)] p-3"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-medium text-sm text-[var(--color-text)]">
                        {agent.name}
                      </span>
                      <button
                        onClick={() => {
                          if (confirm(`Remove agent "${agent.name}"?`)) {
                            void removeAgent(tenant.id, agent.id);
                          }
                        }}
                        className="p-1 rounded text-[var(--color-text-muted)] hover:text-[var(--color-danger)] transition-colors"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <div className="text-xs text-[var(--color-text-muted)] space-y-0.5">
                      <div>{agent.role}</div>
                      <div className="flex items-center gap-1.5">
                        <Cpu className="h-3 w-3" />
                        {agent.model.model} @ {agent.model.server}
                      </div>
                      {agent.skills.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {agent.skills.map((s) => (
                            <span
                              key={s}
                              className="px-1.5 py-0.5 rounded text-[10px] bg-[var(--color-bg)] border border-[var(--color-border)]"
                            >
                              {s}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Projects Column */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <FolderOpen className="h-4 w-4 text-[var(--color-accent)]" />
                  <h2 className="text-sm font-bold uppercase tracking-wider text-[var(--color-text)]">
                    Projects ({tenant.projects.length})
                  </h2>
                </div>
                <button
                  onClick={() => setShowAddProject(true)}
                  className="p-1.5 rounded text-[var(--color-text-muted)] hover:text-[var(--color-accent)] hover:bg-[var(--color-accent)]/10 transition-colors"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>
              <div className="space-y-2">
                {tenant.projects.length === 0 && (
                  <div className="text-xs text-[var(--color-text-muted)] text-center py-4 border border-dashed border-[var(--color-border)] rounded">
                    No projects yet
                  </div>
                )}
                {tenant.projects.map((project) => (
                  <div
                    key={project.id}
                    className="rounded border border-[var(--color-border)] bg-[var(--color-surface)] p-3"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-medium text-sm text-[var(--color-text)]">
                        {project.name}
                      </span>
                      <span
                        className={cn(
                          "text-[10px] font-medium uppercase px-1.5 py-0.5 rounded",
                          project.status === "active"
                            ? "bg-[var(--color-success)]/10 text-[var(--color-success)]"
                            : "bg-[var(--color-text-muted)]/10 text-[var(--color-text-muted)]",
                        )}
                      >
                        {project.status}
                      </span>
                    </div>
                    {project.description && (
                      <p className="text-xs text-[var(--color-text-muted)] mb-2">
                        {project.description}
                      </p>
                    )}
                    <div className="flex items-center justify-between text-xs text-[var(--color-text-muted)]">
                      <span>
                        {project.agents.length} agent
                        {project.agents.length !== 1 ? "s" : ""}
                      </span>
                      <button
                        onClick={() => {
                          setAddAgentProjectId(project.id);
                          setShowAddAgent(true);
                        }}
                        className="flex items-center gap-1 text-[var(--color-accent)] hover:underline"
                      >
                        <Plus className="h-3 w-3" />
                        Add Agent
                      </button>
                    </div>
                    {project.agents.length > 0 && (
                      <div className="mt-2 space-y-1">
                        {project.agents.map((a) => (
                          <div
                            key={a.id}
                            className="flex items-center justify-between text-xs pl-2 border-l-2 border-[var(--color-accent)]/30"
                          >
                            <span className="text-[var(--color-text)]">
                              {a.name}{" "}
                              <span className="text-[var(--color-text-muted)]">({a.role})</span>
                            </span>
                            <button
                              onClick={() => {
                                if (confirm(`Remove "${a.name}"?`)) {
                                  void removeAgent(tenant.id, a.id);
                                }
                              }}
                              className="p-0.5 text-[var(--color-text-muted)] hover:text-[var(--color-danger)]"
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Humans Column */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-[var(--color-accent)]" />
                  <h2 className="text-sm font-bold uppercase tracking-wider text-[var(--color-text)]">
                    Humans ({tenant.humans.length})
                  </h2>
                </div>
                <button
                  onClick={() => setShowAddHuman(true)}
                  className="p-1.5 rounded text-[var(--color-text-muted)] hover:text-[var(--color-accent)] hover:bg-[var(--color-accent)]/10 transition-colors"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>
              <div className="space-y-2">
                {tenant.humans.length === 0 && (
                  <div className="text-xs text-[var(--color-text-muted)] text-center py-4 border border-dashed border-[var(--color-border)] rounded">
                    No humans yet
                  </div>
                )}
                {tenant.humans.map((human) => (
                  <div
                    key={human.id}
                    className="rounded border border-[var(--color-border)] bg-[var(--color-surface)] p-3"
                  >
                    <div className="font-medium text-sm text-[var(--color-text)] mb-1">
                      {human.name}
                    </div>
                    <div className="text-xs text-[var(--color-text-muted)] space-y-0.5">
                      <div className="flex items-center gap-1.5">
                        <Key className="h-3 w-3" />
                        <span className="font-mono truncate">{human.did.slice(0, 24)}...</span>
                      </div>
                      {human.contact?.signal && <div>Signal: {human.contact.signal}</div>}
                      {human.contact?.email && <div>Email: {human.contact.email}</div>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {showAddAgent && (
        <AddAgentModal
          tenantId={tenant.id}
          projectId={addAgentProjectId}
          onClose={() => setShowAddAgent(false)}
        />
      )}
      {showAddProject && (
        <AddProjectModal tenantId={tenant.id} onClose={() => setShowAddProject(false)} />
      )}
      {showAddHuman && (
        <AddHumanModal tenantId={tenant.id} onClose={() => setShowAddHuman(false)} />
      )}
    </div>
  );
}
