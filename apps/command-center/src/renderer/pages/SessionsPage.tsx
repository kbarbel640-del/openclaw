/**
 * Sessions Page — Active and historic OpenClaw agent sessions.
 *
 * Shows:
 * - Live sessions with real-time message count
 * - Session history with filters
 * - Quick actions (view, archive, export)
 * - Agent activity metrics
 */

import React, { useState, useEffect, useCallback } from "react";
import type { OcccBridge } from "../../shared/ipc-types.js";
import { useAuth } from "../App.js";

const occc = (window as unknown as { occc: OcccBridge }).occc;

interface SessionInfo {
  sessionId: string;
  agentId: string;
  channelId: string;
  startTime: string;
  endTime?: string;
  status: "active" | "completed" | "error";
  messageCount: number;
  lastActivity: string;
  participants: string[];
  model?: string;
  tags?: string[];
}

type SessionFilter = "all" | "active" | "completed" | "today" | "week";
type SortBy = "recent" | "duration" | "messages" | "agent";

export function SessionsPage() {
  const { token } = useAuth();
  const [sessions, setSessions] = useState<SessionInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<SessionFilter>("all");
  const [sortBy, setSortBy] = useState<SortBy>("recent");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedSession, setSelectedSession] = useState<SessionInfo | null>(null);
  const [showDetails, setShowDetails] = useState(false);

  const fetchSessions = useCallback(async () => {
    if (!token) { return; }
    
    try {
      const result = await occc.invoke("occc:sessions:list", { token, filter, sort: sortBy });
      setSessions(result as SessionInfo[] || []);
    } catch (err) {
      console.error("Failed to fetch sessions:", err);
      setSessions([]);
    } finally {
      setLoading(false);
    }
  }, [token, filter, sortBy]);

  useEffect(() => {
    void fetchSessions();
    
    // Refresh every 10 seconds to show live updates
    const interval = setInterval(fetchSessions, 10000);
    return () => clearInterval(interval);
  }, [fetchSessions]);

  const handleSessionClick = (session: SessionInfo) => {
    setSelectedSession(session);
    setShowDetails(true);
  };

  const handleExportSession = async (sessionId: string) => {
    if (!token) { return; }
    
    try {
      await occc.invoke("occc:sessions:export", { token, sessionId, format: "json" });
    } catch (err) {
      console.error("Failed to export session:", err);
    }
  };

  const filteredSessions = sessions.filter(session => {
    if (searchQuery && !session.sessionId.toLowerCase().includes(searchQuery.toLowerCase()) && 
        !session.agentId.toLowerCase().includes(searchQuery.toLowerCase())) {
      return false;
    }
    
    const now = new Date();
    const sessionDate = new Date(session.startTime);
    
    switch (filter) {
      case "active":
        return session.status === "active";
      case "completed":
        return session.status === "completed";
      case "today":
        return sessionDate.toDateString() === now.toDateString();
      case "week":
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        return sessionDate >= weekAgo;
      default:
        return true;
    }
  });

  const activeSessions = sessions.filter(s => s.status === "active");

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
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <h1>Sessions</h1>
            <p>Monitor agent conversations and activity</p>
          </div>
          <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
            <span style={styles.liveDot} />
            <span style={{ fontSize: "13px", color: "var(--text-secondary)" }}>
              {activeSessions.length} active
            </span>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div style={styles.statsGrid}>
        <StatCard 
          title="Active Sessions" 
          value={activeSessions.length.toString()} 
          icon="◎" 
          color="var(--accent-success)"
        />
        <StatCard 
          title="Total Today" 
          value={sessions.filter(s => new Date(s.startTime).toDateString() === new Date().toDateString()).length.toString()} 
          icon="◉" 
          color="var(--accent-primary)"
        />
        <StatCard 
          title="Avg Duration" 
          value={calculateAvgDuration(sessions)} 
          icon="⏱" 
          color="var(--accent-info)"
        />
        <StatCard 
          title="Total Messages" 
          value={sessions.reduce((sum, s) => sum + s.messageCount, 0).toString()} 
          icon="💬" 
          color="var(--accent-warning)"
        />
      </div>

      {/* Controls */}
      <div style={styles.controls}>
        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
          <input
            type="text"
            placeholder="Search sessions..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={styles.searchInput}
          />
          
          <select 
            value={filter} 
            onChange={(e) => setFilter(e.target.value as SessionFilter)}
            style={styles.select}
          >
            <option value="all">All Sessions</option>
            <option value="active">Active Only</option>
            <option value="completed">Completed</option>
            <option value="today">Today</option>
            <option value="week">This Week</option>
          </select>
          
          <select 
            value={sortBy} 
            onChange={(e) => setSortBy(e.target.value as SortBy)}
            style={styles.select}
          >
            <option value="recent">Most Recent</option>
            <option value="duration">By Duration</option>
            <option value="messages">By Messages</option>
            <option value="agent">By Agent</option>
          </select>
        </div>
        
        <button onClick={fetchSessions} style={styles.refreshBtn}>
          ↻ Refresh
        </button>
      </div>

      {/* Session List */}
      <div style={styles.sessionList}>
        {filteredSessions.length === 0 ? (
          <div style={styles.emptyState}>
            <div style={{ fontSize: "32px", marginBottom: "12px", opacity: 0.3 }}>◎</div>
            <p>No sessions found</p>
          </div>
        ) : (
          filteredSessions.map(session => (
            <SessionCard 
              key={session.sessionId}
              session={session}
              onClick={() => handleSessionClick(session)}
              onExport={() => handleExportSession(session.sessionId)}
            />
          ))
        )}
      </div>

      {/* Session Details Modal */}
      {showDetails && selectedSession && (
        <SessionDetailsModal 
          session={selectedSession}
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

function SessionCard({ session, onClick, onExport }: { 
  session: SessionInfo; 
  onClick: () => void; 
  onExport: () => void;
}) {
  return (
    <div style={styles.sessionCard} onClick={onClick}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: "12px", flex: 1 }}>
        <div style={{
          ...styles.statusDot,
          background: session.status === "active" ? "var(--accent-success)" : 
                     session.status === "error" ? "var(--accent-danger)" : "var(--text-muted)"
        }} />
        
        <div style={{ flex: 1 }}>
          <div style={styles.sessionHeader}>
            <span style={styles.sessionId}>{session.sessionId.slice(0, 8)}</span>
            <span style={styles.sessionAgent}>{session.agentId}</span>
            <span style={styles.sessionChannel}>{session.channelId}</span>
          </div>
          
          <div style={styles.sessionMeta}>
            <span>{formatTime(session.startTime)}</span>
            <span>•</span>
            <span>{session.messageCount} messages</span>
            {session.model && (
              <>
                <span>•</span>
                <span>{session.model}</span>
              </>
            )}
          </div>
          
          {session.participants.length > 0 && (
            <div style={styles.participants}>
              {session.participants.slice(0, 3).map((p, i) => (
                <span key={i} style={styles.participant}>{p}</span>
              ))}
              {session.participants.length > 3 && (
                <span style={styles.participant}>+{session.participants.length - 3}</span>
              )}
            </div>
          )}
        </div>
        
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <button 
            onClick={(e) => { e.stopPropagation(); onExport(); }}
            style={styles.actionBtn}
            title="Export session"
          >
            ↓
          </button>
          <span style={styles.duration}>
            {session.endTime ? formatDuration(session.startTime, session.endTime) : "ongoing"}
          </span>
        </div>
      </div>
    </div>
  );
}

function SessionDetailsModal({ session, onClose }: { session: SessionInfo; onClose: () => void }) {
  return (
    <div style={styles.modalOverlay} onClick={onClose}>
      <div style={styles.modalContent} onClick={(e) => e.stopPropagation()}>
        <div style={styles.modalHeader}>
          <h2>Session Details</h2>
          <button onClick={onClose} style={styles.closeBtn}>✕</button>
        </div>
        
        <div style={styles.modalBody}>
          <div style={styles.detailRow}>
            <span style={styles.detailLabel}>Session ID</span>
            <span style={styles.detailValue}>{session.sessionId}</span>
          </div>
          <div style={styles.detailRow}>
            <span style={styles.detailLabel}>Agent</span>
            <span style={styles.detailValue}>{session.agentId}</span>
          </div>
          <div style={styles.detailRow}>
            <span style={styles.detailLabel}>Channel</span>
            <span style={styles.detailValue}>{session.channelId}</span>
          </div>
          <div style={styles.detailRow}>
            <span style={styles.detailLabel}>Status</span>
            <span style={{
              ...styles.detailValue,
              color: session.status === "active" ? "var(--accent-success)" : 
                     session.status === "error" ? "var(--accent-danger)" : "var(--text-secondary)"
            }}>
              {session.status}
            </span>
          </div>
          <div style={styles.detailRow}>
            <span style={styles.detailLabel}>Started</span>
            <span style={styles.detailValue}>{new Date(session.startTime).toLocaleString()}</span>
          </div>
          {session.endTime && (
            <div style={styles.detailRow}>
              <span style={styles.detailLabel}>Ended</span>
              <span style={styles.detailValue}>{new Date(session.endTime).toLocaleString()}</span>
            </div>
          )}
          <div style={styles.detailRow}>
            <span style={styles.detailLabel}>Message Count</span>
            <span style={styles.detailValue}>{session.messageCount}</span>
          </div>
          {session.participants.length > 0 && (
            <div style={styles.detailRow}>
              <span style={styles.detailLabel}>Participants</span>
              <span style={styles.detailValue}>{session.participants.join(", ")}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Helper functions
function calculateAvgDuration(sessions: SessionInfo[]): string {
  const completedSessions = sessions.filter(s => s.endTime);
  if (completedSessions.length === 0) { return "—"; }
  
  const avgMs = completedSessions.reduce((sum, s) => {
    return sum + (new Date(s.endTime!).getTime() - new Date(s.startTime).getTime());
  }, 0) / completedSessions.length;
  
  return formatDurationMs(avgMs);
}

function formatTime(timeStr: string): string {
  const time = new Date(timeStr);
  const now = new Date();
  const diff = now.getTime() - time.getTime();
  
  if (diff < 60000) { return "just now"; }
  if (diff < 3600000) { return `${Math.floor(diff / 60000)}m ago`; }
  if (diff < 86400000) { return `${Math.floor(diff / 3600000)}h ago`; }
  return time.toLocaleDateString();
}

function formatDuration(start: string, end: string): string {
  const diffMs = new Date(end).getTime() - new Date(start).getTime();
  return formatDurationMs(diffMs);
}

function formatDurationMs(ms: number): string {
  const minutes = Math.floor(ms / 60000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  
  if (days > 0) { return `${days}d ${hours % 24}h`; }
  if (hours > 0) { return `${hours}h ${minutes % 60}m`; }
  return `${minutes}m`;
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
  
  sessionList: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
  } as React.CSSProperties,
  
  sessionCard: {
    background: "var(--surface-1)",
    border: "1px solid var(--border-subtle)",
    borderRadius: "10px",
    padding: "16px",
    cursor: "pointer",
    transition: "all 150ms",
    ':hover': {
      borderColor: "var(--border-default)",
      background: "var(--surface-hover)",
    }
  } as React.CSSProperties,
  
  statusDot: {
    width: "8px",
    height: "8px",
    borderRadius: "50%",
    marginTop: "6px",
  } as React.CSSProperties,
  
  sessionHeader: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    marginBottom: "4px",
  } as React.CSSProperties,
  
  sessionId: {
    fontFamily: "var(--font-mono)",
    fontSize: "12px",
    color: "var(--text-primary)",
    fontWeight: 600,
  } as React.CSSProperties,
  
  sessionAgent: {
    fontSize: "13px",
    color: "var(--accent-primary)",
    font: "600",
  } as React.CSSProperties,
  
  sessionChannel: {
    fontSize: "12px",
    color: "var(--text-tertiary)",
    background: "var(--surface-2)",
    padding: "2px 6px",
    borderRadius: "4px",
  } as React.CSSProperties,
  
  sessionMeta: {
    display: "flex",
    alignItems: "center",
    gap: "6px",
    fontSize: "12px",
    color: "var(--text-secondary)",
    marginBottom: "8px",
  } as React.CSSProperties,
  
  participants: {
    display: "flex",
    gap: "4px",
    flexWrap: "wrap",
  } as React.CSSProperties,
  
  participant: {
    background: "var(--surface-2)",
    padding: "2px 6px",
    borderRadius: "4px",
    fontSize: "11px",
    color: "var(--text-tertiary)",
  } as React.CSSProperties,
  
  actionBtn: {
    background: "none",
    border: "1px solid var(--border-subtle)",
    borderRadius: "4px",
    padding: "4px 6px",
    fontSize: "12px",
    color: "var(--text-secondary)",
    cursor: "pointer",
  } as React.CSSProperties,
  
  duration: {
    fontSize: "11px",
    color: "var(--text-tertiary)",
    fontFamily: "var(--font-mono)",
  } as React.CSSProperties,
  
  liveDot: {
    width: "6px",
    height: "6px",
    borderRadius: "50%",
    background: "var(--accent-success)",
    animation: "pulse 2s infinite",
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
    maxWidth: "500px",
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
};