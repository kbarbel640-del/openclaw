/**
 * Skills Page — AI skill governance and management interface.
 *
 * Features:
 * - Skill discovery and installation
 * - Security review and approval pipeline
 * - Risk assessment and badges
 * - AI-powered skill analysis
 * - Allowlist management
 */

import React, { useState, useEffect, useCallback } from "react";
import type { OcccBridge } from "../../shared/ipc-types.js";
import { useAuth } from "../App.js";

const occc = (window as unknown as { occc: OcccBridge }).occc;

interface SkillInfo {
  id: string;
  name: string;
  version: string;
  author: string;
  description: string;
  capabilities: string[];
  status: SkillStatus;
  riskLevel: RiskLevel;
  aiReviewStatus: AIReviewStatus;
  installDate?: string;
  lastUpdated: string;
  repository?: string;
  tags: string[];
  permissions: Permission[];
  dependencies: string[];
}

type SkillStatus = "available" | "pending-review" | "approved" | "installed" | "disabled" | "rejected";
type RiskLevel = "low" | "medium" | "high" | "critical";
type AIReviewStatus = "not-reviewed" | "analyzing" | "flagged" | "cleared";

interface Permission {
  type: "file-access" | "network" | "system" | "agent";
  description: string;
  required: boolean;
}

type SkillFilter = "all" | "installed" | "available" | "pending" | "high-risk";

const RISK_CONFIG = {
  low: { color: "var(--accent-success)", label: "Low Risk", icon: "🟢" },
  medium: { color: "var(--accent-warning)", label: "Medium Risk", icon: "🟡" },
  high: { color: "var(--accent-danger)", label: "High Risk", icon: "🟠" },
  critical: { color: "#dc2626", label: "Critical Risk", icon: "🔴" },
};

const STATUS_CONFIG = {
  available: { color: "var(--text-secondary)", label: "Available", icon: "◦" },
  "pending-review": { color: "var(--accent-warning)", label: "Pending Review", icon: "⏳" },
  approved: { color: "var(--accent-success)", label: "Approved", icon: "✓" },
  installed: { color: "var(--accent-primary)", label: "Installed", icon: "◉" },
  disabled: { color: "var(--text-muted)", label: "Disabled", icon: "◎" },
  rejected: { color: "var(--accent-danger)", label: "Rejected", icon: "✗" },
};

export function SkillsPage() {
  const { token, requireElevation } = useAuth();
  const [skills, setSkills] = useState<SkillInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<SkillFilter>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedSkill, setSelectedSkill] = useState<SkillInfo | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchSkills = useCallback(async () => {
    if (!token) { return; }
    
    try {
      const result = await occc.invoke("occc:skills:list", { token });
      setSkills(result as SkillInfo[] || []);
    } catch (err) {
      console.error("Failed to fetch skills:", err);
      setSkills([]);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void fetchSkills();
  }, [fetchSkills]);

  const handleInstallSkill = useCallback(async (skillId: string) => {
    if (!token) { return; }
    
    const elevated = await requireElevation("Install skill");
    if (!elevated) { return; }
    
    setActionLoading(skillId);
    try {
      await occc.invoke("occc:skills:install", { token, skillId });
      void fetchSkills(); // Refresh the list
    } catch (err) {
      console.error("Failed to install skill:", err);
    } finally {
      setActionLoading(null);
    }
  }, [token, requireElevation, fetchSkills]);

  const handleApproveSkill = useCallback(async (skillId: string) => {
    if (!token) { return; }
    
    const elevated = await requireElevation("Approve skill");
    if (!elevated) { return; }
    
    setActionLoading(skillId);
    try {
      await occc.invoke("occc:skills:approve", { token, skillId });
      void fetchSkills();
    } catch (err) {
      console.error("Failed to approve skill:", err);
    } finally {
      setActionLoading(null);
    }
  }, [token, requireElevation, fetchSkills]);

  const handleRejectSkill = useCallback(async (skillId: string, reason: string) => {
    if (!token) { return; }
    
    const elevated = await requireElevation("Reject skill");
    if (!elevated) { return; }
    
    setActionLoading(skillId);
    try {
      await occc.invoke("occc:skills:reject", { token, skillId, reason });
      void fetchSkills();
    } catch (err) {
      console.error("Failed to reject skill:", err);
    } finally {
      setActionLoading(null);
    }
  }, [token, requireElevation, fetchSkills]);

  const handleRequestAIReview = useCallback(async (skillId: string) => {
    if (!token) { return; }
    
    setActionLoading(skillId);
    try {
      await occc.invoke("occc:skills:ai-review", { token, skillId });
      void fetchSkills();
    } catch (err) {
      console.error("Failed to request AI review:", err);
    } finally {
      setActionLoading(null);
    }
  }, [token, fetchSkills]);

  const filteredSkills = skills.filter(skill => {
    if (searchQuery && !skill.name.toLowerCase().includes(searchQuery.toLowerCase()) &&
        !skill.description.toLowerCase().includes(searchQuery.toLowerCase()) &&
        !skill.author.toLowerCase().includes(searchQuery.toLowerCase())) {
      return false;
    }
    
    switch (filter) {
      case "installed":
        return skill.status === "installed";
      case "available":
        return skill.status === "available";
      case "pending":
        return skill.status === "pending-review";
      case "high-risk":
        return skill.riskLevel === "high" || skill.riskLevel === "critical";
      default:
        return true;
    }
  });

  const stats = {
    total: skills.length,
    installed: skills.filter(s => s.status === "installed").length,
    pending: skills.filter(s => s.status === "pending-review").length,
    highRisk: skills.filter(s => s.riskLevel === "high" || s.riskLevel === "critical").length,
  };

  if (loading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "60vh" }}>
        <div className="spinner" />
      </div>
    );
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Skills</h1>
          <p>Manage AI capabilities and security governance</p>
        </div>
      </div>

      {/* Stats Cards */}
      <div style={styles.statsGrid}>
        <StatCard title="Total Skills" value={stats.total.toString()} icon="◈" color="var(--accent-primary)" />
        <StatCard title="Installed" value={stats.installed.toString()} icon="◉" color="var(--accent-success)" />
        <StatCard title="Pending Review" value={stats.pending.toString()} icon="⏳" color="var(--accent-warning)" />
        <StatCard title="High Risk" value={stats.highRisk.toString()} icon="⚠" color="var(--accent-danger)" />
      </div>

      {/* Controls */}
      <div style={styles.controls}>
        <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
          <input
            type="text"
            placeholder="Search skills..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={styles.searchInput}
          />
          
          <select 
            value={filter} 
            onChange={(e) => setFilter(e.target.value as SkillFilter)}
            style={styles.select}
          >
            <option value="all">All Skills</option>
            <option value="installed">Installed</option>
            <option value="available">Available</option>
            <option value="pending">Pending Review</option>
            <option value="high-risk">High Risk</option>
          </select>
        </div>
        
        <div style={{ display: "flex", gap: "8px" }}>
          <button onClick={fetchSkills} style={styles.refreshBtn}>
            ↻ Refresh
          </button>
          <button 
            onClick={() => occc.invoke("occc:skills:discover", { token })}
            style={styles.primaryBtn}
          >
            🔍 Discover Skills
          </button>
        </div>
      </div>

      {/* Skills List */}
      <div style={styles.skillsList}>
        {filteredSkills.length === 0 ? (
          <div style={styles.emptyState}>
            <div style={{ fontSize: "32px", marginBottom: "12px", opacity: 0.3 }}>◈</div>
            <p>No skills found</p>
          </div>
        ) : (
          filteredSkills.map(skill => (
            <SkillCard 
              key={skill.id}
              skill={skill}
              onViewDetails={() => {
                setSelectedSkill(skill);
                setShowDetails(true);
              }}
              onInstall={() => handleInstallSkill(skill.id)}
              onApprove={() => handleApproveSkill(skill.id)}
              onReject={() => handleRejectSkill(skill.id, "Security concerns")}
              onRequestReview={() => handleRequestAIReview(skill.id)}
              isLoading={actionLoading === skill.id}
            />
          ))
        )}
      </div>

      {/* Skill Details Modal */}
      {showDetails && selectedSkill && (
        <SkillDetailsModal 
          skill={selectedSkill}
          onClose={() => setShowDetails(false)}
        />
      )}
    </div>
  );
}

function StatCard({ title, value, icon, color }: { title: string; value: string; icon: string; color: string }) {
  return (
    <div style={styles.statCard}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <div style={{ fontSize: "11px", color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
            {title}
          </div>
          <div style={{ fontSize: "20px", fontWeight: 700, color: "var(--text-primary)", marginTop: "4px" }}>
            {value}
          </div>
        </div>
        <span style={{ fontSize: "20px", color, opacity: 0.8 }}>{icon}</span>
      </div>
    </div>
  );
}

function SkillCard({ 
  skill, 
  onViewDetails, 
  onInstall, 
  onApprove, 
  onReject, 
  onRequestReview,
  isLoading 
}: { 
  skill: SkillInfo;
  onViewDetails: () => void;
  onInstall: () => void;
  onApprove: () => void;
  onReject: () => void;
  onRequestReview: () => void;
  isLoading: boolean;
}) {
  const riskConfig = RISK_CONFIG[skill.riskLevel];
  const statusConfig = STATUS_CONFIG[skill.status];

  return (
    <div style={styles.skillCard}>
      <div style={{ display: "flex", gap: "16px", flex: 1 }}>
        {/* Skill Info */}
        <div style={{ flex: 1 }}>
          <div style={styles.skillHeader}>
            <div>
              <h3 style={styles.skillName}>{skill.name}</h3>
              <p style={styles.skillAuthor}>by {skill.author}</p>
            </div>
            <div style={styles.badges}>
              <span style={{ ...styles.badge, ...styles.statusBadge, color: statusConfig.color }}>
                {statusConfig.icon} {statusConfig.label}
              </span>
              <span style={{ ...styles.badge, ...styles.riskBadge, color: riskConfig.color }}>
                {riskConfig.icon} {riskConfig.label}
              </span>
            </div>
          </div>

          <p style={styles.skillDescription}>{skill.description}</p>

          <div style={styles.skillMeta}>
            <span>v{skill.version}</span>
            <span>•</span>
            <span>{skill.capabilities.length} capabilities</span>
            <span>•</span>
            <span>Updated {new Date(skill.lastUpdated).toLocaleDateString()}</span>
          </div>

          {skill.tags.length > 0 && (
            <div style={styles.tags}>
              {skill.tags.map(tag => (
                <span key={tag} style={styles.tag}>{tag}</span>
              ))}
            </div>
          )}
        </div>

        {/* Actions */}
        <div style={styles.actions}>
          {skill.aiReviewStatus === "not-reviewed" && (
            <button onClick={onRequestReview} style={styles.secondaryBtn} disabled={isLoading}>
              🔍 AI Review
            </button>
          )}
          
          {skill.aiReviewStatus === "analyzing" && (
            <div style={styles.analyzingIndicator}>
              <div className="spinner" style={{ width: "12px", height: "12px" }} />
              <span>Analyzing...</span>
            </div>
          )}

          {skill.status === "pending-review" && (
            <>
              <button onClick={onApprove} style={styles.successBtn} disabled={isLoading}>
                ✓ Approve
              </button>
              <button onClick={onReject} style={styles.dangerBtn} disabled={isLoading}>
                ✗ Reject
              </button>
            </>
          )}

          {(skill.status === "approved" || skill.status === "available") && (
            <button onClick={onInstall} style={styles.primaryBtn} disabled={isLoading}>
              {isLoading ? "Installing..." : "📦 Install"}
            </button>
          )}

          <button onClick={onViewDetails} style={styles.secondaryBtn}>
            👁 Details
          </button>
        </div>
      </div>
    </div>
  );
}

function SkillDetailsModal({ skill, onClose }: { skill: SkillInfo; onClose: () => void }) {
  return (
    <div style={styles.modalOverlay} onClick={onClose}>
      <div style={styles.modalContent} onClick={(e) => e.stopPropagation()}>
        <div style={styles.modalHeader}>
          <h2>{skill.name}</h2>
          <button onClick={onClose} style={styles.closeBtn}>✕</button>
        </div>
        
        <div style={styles.modalBody}>
          <div style={styles.detailSection}>
            <h4 style={styles.sectionTitle}>Information</h4>
            <div style={styles.detailRow}>
              <span style={styles.detailLabel}>Author</span>
              <span style={styles.detailValue}>{skill.author}</span>
            </div>
            <div style={styles.detailRow}>
              <span style={styles.detailLabel}>Version</span>
              <span style={styles.detailValue}>{skill.version}</span>
            </div>
            <div style={styles.detailRow}>
              <span style={styles.detailLabel}>Risk Level</span>
              <span style={{
                ...styles.detailValue,
                color: RISK_CONFIG[skill.riskLevel].color,
                fontWeight: 600
              }}>
                {RISK_CONFIG[skill.riskLevel].icon} {RISK_CONFIG[skill.riskLevel].label}
              </span>
            </div>
          </div>

          {skill.capabilities.length > 0 && (
            <div style={styles.detailSection}>
              <h4 style={styles.sectionTitle}>Capabilities</h4>
              <ul style={styles.list}>
                {skill.capabilities.map((cap, i) => (
                  <li key={i} style={styles.listItem}>{cap}</li>
                ))}
              </ul>
            </div>
          )}

          {skill.permissions.length > 0 && (
            <div style={styles.detailSection}>
              <h4 style={styles.sectionTitle}>Permissions</h4>
              {skill.permissions.map((perm, i) => (
                <div key={i} style={styles.permission}>
                  <div style={{
                    ...styles.permissionType,
                    color: perm.required ? "var(--accent-danger)" : "var(--accent-warning)"
                  }}>
                    {perm.required ? "Required" : "Optional"} • {perm.type}
                  </div>
                  <div style={styles.permissionDesc}>{perm.description}</div>
                </div>
              ))}
            </div>
          )}

          {skill.dependencies.length > 0 && (
            <div style={styles.detailSection}>
              <h4 style={styles.sectionTitle}>Dependencies</h4>
              <div style={styles.dependencies}>
                {skill.dependencies.map((dep, i) => (
                  <span key={i} style={styles.dependency}>{dep}</span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Styles
const styles = {
  statsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
    gap: "16px",
    marginBottom: "24px",
  } as React.CSSProperties,
  
  statCard: {
    background: "var(--surface-1)",
    border: "1px solid var(--border-subtle)",
    borderRadius: "12px",
    padding: "20px",
  } as React.CSSProperties,
  
  controls: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "20px",
    gap: "12px",
  } as React.CSSProperties,
  
  searchInput: {
    background: "var(--surface-1)",
    border: "1px solid var(--border-subtle)",
    borderRadius: "8px",
    padding: "8px 12px",
    fontSize: "13px",
    color: "var(--text-primary)",
    outline: "none",
    width: "200px",
  } as React.CSSProperties,
  
  select: {
    background: "var(--surface-1)",
    border: "1px solid var(--border-subtle)",
    borderRadius: "8px",
    padding: "8px 12px",
    fontSize: "13px",
    color: "var(--text-primary)",
    outline: "none",
  } as React.CSSProperties,
  
  refreshBtn: {
    background: "var(--surface-1)",
    border: "1px solid var(--border-default)",
    borderRadius: "8px",
    padding: "8px 12px",
    fontSize: "13px",
    color: "var(--text-secondary)",
    cursor: "pointer",
  } as React.CSSProperties,
  
  primaryBtn: {
    background: "linear-gradient(135deg, #6366f1, #4f46e5)",
    border: "none",
    borderRadius: "8px",
    padding: "8px 12px",
    fontSize: "13px",
    fontWeight: 600,
    color: "white",
    cursor: "pointer",
  } as React.CSSProperties,
  
  secondaryBtn: {
    background: "var(--surface-1)",
    border: "1px solid var(--border-default)",
    borderRadius: "6px",
    padding: "6px 10px",
    fontSize: "12px",
    color: "var(--text-secondary)",
    cursor: "pointer",
  } as React.CSSProperties,
  
  successBtn: {
    background: "var(--accent-success)",
    border: "none",
    borderRadius: "6px",
    padding: "6px 10px",
    fontSize: "12px",
    color: "white",
    cursor: "pointer",
  } as React.CSSProperties,
  
  dangerBtn: {
    background: "var(--accent-danger)",
    border: "none",
    borderRadius: "6px",
    padding: "6px 10px",
    fontSize: "12px",
    color: "white",
    cursor: "pointer",
  } as React.CSSProperties,
  
  skillsList: {
    display: "flex",
    flexDirection: "column",
    gap: "12px",
  } as React.CSSProperties,
  
  skillCard: {
    background: "var(--surface-1)",
    border: "1px solid var(--border-subtle)",
    borderRadius: "12px",
    padding: "20px",
    transition: "all 150ms",
  } as React.CSSProperties,
  
  skillHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: "8px",
  } as React.CSSProperties,
  
  skillName: {
    fontSize: "16px",
    fontWeight: 600,
    color: "var(--text-primary)",
    margin: 0,
  } as React.CSSProperties,
  
  skillAuthor: {
    fontSize: "13px",
    color: "var(--text-tertiary)",
    margin: "2px 0 0 0",
  } as React.CSSProperties,
  
  badges: {
    display: "flex",
    gap: "8px",
  } as React.CSSProperties,
  
  badge: {
    fontSize: "11px",
    fontWeight: 600,
    padding: "4px 8px",
    borderRadius: "6px",
    textTransform: "uppercase",
    letterSpacing: "0.03em",
  } as React.CSSProperties,
  
  statusBadge: {
    background: "rgba(99, 102, 241, 0.1)",
  } as React.CSSProperties,
  
  riskBadge: {
    background: "rgba(239, 68, 68, 0.1)",
  } as React.CSSProperties,
  
  skillDescription: {
    fontSize: "14px",
    color: "var(--text-secondary)",
    lineHeight: 1.5,
    margin: "0 0 12px 0",
  } as React.CSSProperties,
  
  skillMeta: {
    display: "flex",
    alignItems: "center",
    gap: "6px",
    fontSize: "12px",
    color: "var(--text-tertiary)",
    marginBottom: "8px",
  } as React.CSSProperties,
  
  tags: {
    display: "flex",
    gap: "6px",
    flexWrap: "wrap",
  } as React.CSSProperties,
  
  tag: {
    background: "var(--surface-2)",
    padding: "2px 8px",
    borderRadius: "4px",
    fontSize: "11px",
    color: "var(--text-tertiary)",
  } as React.CSSProperties,
  
  actions: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
    alignItems: "flex-end",
    minWidth: "120px",
  } as React.CSSProperties,
  
  analyzingIndicator: {
    display: "flex",
    alignItems: "center",
    gap: "6px",
    fontSize: "12px",
    color: "var(--accent-warning)",
  } as React.CSSProperties,
  
  emptyState: {
    textAlign: "center",
    padding: "60px 20px",
    color: "var(--text-tertiary)",
  } as React.CSSProperties,
  
  modalOverlay: {
    position: "fixed",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: "rgba(0, 0, 0, 0.5)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1000,
  } as React.CSSProperties,
  
  modalContent: {
    background: "var(--bg-secondary)",
    border: "1px solid var(--border-default)",
    borderRadius: "12px",
    width: "90%",
    maxWidth: "600px",
    maxHeight: "80vh",
    overflow: "auto",
  } as React.CSSProperties,
  
  modalHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "20px 24px 0",
  } as React.CSSProperties,
  
  closeBtn: {
    background: "none",
    border: "none",
    color: "var(--text-muted)",
    cursor: "pointer",
    fontSize: "16px",
  } as React.CSSProperties,
  
  modalBody: {
    padding: "20px 24px 24px",
  } as React.CSSProperties,
  
  detailSection: {
    marginBottom: "20px",
  } as React.CSSProperties,
  
  sectionTitle: {
    fontSize: "14px",
    fontWeight: 600,
    color: "var(--text-primary)",
    marginBottom: "12px",
  } as React.CSSProperties,
  
  detailRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "8px 0",
    borderBottom: "1px solid var(--border-subtle)",
  } as React.CSSProperties,
  
  detailLabel: {
    fontSize: "12px",
    color: "var(--text-tertiary)",
    textTransform: "uppercase",
    letterSpacing: "0.05em",
  } as React.CSSProperties,
  
  detailValue: {
    fontSize: "13px",
    color: "var(--text-primary)",
    textAlign: "right",
  } as React.CSSProperties,
  
  list: {
    listStyle: "none",
    padding: 0,
    margin: 0,
  } as React.CSSProperties,
  
  listItem: {
    padding: "4px 0",
    fontSize: "13px",
    color: "var(--text-secondary)",
    borderBottom: "1px solid var(--border-subtle)",
  } as React.CSSProperties,
  
  permission: {
    padding: "8px 0",
    borderBottom: "1px solid var(--border-subtle)",
  } as React.CSSProperties,
  
  permissionType: {
    fontSize: "12px",
    fontWeight: 600,
    textTransform: "uppercase",
    letterSpacing: "0.03em",
  } as React.CSSProperties,
  
  permissionDesc: {
    fontSize: "13px",
    color: "var(--text-secondary)",
    marginTop: "2px",
  } as React.CSSProperties,
  
  dependencies: {
    display: "flex",
    gap: "6px",
    flexWrap: "wrap",
  } as React.CSSProperties,
  
  dependency: {
    background: "var(--surface-2)",
    padding: "4px 8px",
    borderRadius: "6px",
    fontSize: "12px",
    color: "var(--text-secondary)",
    fontFamily: "var(--font-mono)",
  } as React.CSSProperties,
};