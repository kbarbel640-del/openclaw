/**
 * Logs Page — Real-time log viewer for OpenClaw gateway and agents.
 *
 * Features:
 * - Live log streaming with filtering
 * - Multiple log sources (gateway, agents, containers)
 * - Log level filtering (debug, info, warn, error)
 * - Search and highlight
 * - Export and download capabilities
 */

import React, { useState, useEffect, useCallback, useRef } from "react";
import type { OcccBridge } from "../../shared/ipc-types.js";
import { useAuth } from "../App.js";

const occc = (window as unknown as { occc: OcccBridge }).occc;

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  source: LogSource;
  message: string;
  metadata?: Record<string, unknown>;
  sessionId?: string;
  agentId?: string;
}

type LogLevel = "debug" | "info" | "warn" | "error";
type LogSource = "gateway" | "agent" | "container" | "system";

interface LogFilter {
  levels: LogLevel[];
  sources: LogSource[];
  searchQuery: string;
  sessionId?: string;
  showTimestamp: boolean;
  showMetadata: boolean;
}

const DEFAULT_FILTER: LogFilter = {
  levels: ["info", "warn", "error"],
  sources: ["gateway", "agent", "container", "system"],
  searchQuery: "",
  showTimestamp: true,
  showMetadata: false,
};

const LOG_LEVELS: { level: LogLevel; label: string; color: string }[] = [
  { level: "debug", label: "Debug", color: "var(--text-tertiary)" },
  { level: "info", label: "Info", color: "var(--accent-info)" },
  { level: "warn", label: "Warn", color: "var(--accent-warning)" },
  { level: "error", label: "Error", color: "var(--accent-danger)" },
];

const LOG_SOURCES: { source: LogSource; label: string; icon: string }[] = [
  { source: "gateway", label: "Gateway", icon: "◈" },
  { source: "agent", label: "Agents", icon: "◎" },
  { source: "container", label: "Containers", icon: "🐳" },
  { source: "system", label: "System", icon: "⚙" },
];

export function LogsPage() {
  const { token } = useAuth();
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [filter, setFilter] = useState<LogFilter>(DEFAULT_FILTER);
  const [isStreaming, setIsStreaming] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [autoScroll, setAutoScroll] = useState(true);
  const logsEndRef = useRef<HTMLDivElement>(null);
  const logContainerRef = useRef<HTMLDivElement>(null);

  // Load initial logs
  useEffect(() => {
    const loadLogs = async () => {
      if (!token) { return; }
      
      setIsLoading(true);
      try {
        const result = await occc.invoke("occc:logs:fetch", {
          token,
          limit: 1000,
          filter: {
            levels: filter.levels,
            sources: filter.sources,
          },
        });
        setLogs(result as LogEntry[] || []);
      } catch (err) {
        console.error("Failed to fetch logs:", err);
      } finally {
        setIsLoading(false);
      }
    };
    
    void loadLogs();
  }, [token, filter.levels, filter.sources]);

  // Set up real-time log streaming
  useEffect(() => {
    if (!token || !isStreaming) { return; }
    
    // Start streaming
    occc.invoke("occc:logs:stream", { token, enable: true })
      .catch(err => console.error("Failed to start log streaming:", err));
    
    // Poll for new logs every 2 seconds when streaming
    const pollInterval = setInterval(async () => {
      try {
        const newLogs = await occc.invoke("occc:logs:fetch", {
          token,
          limit: 50, // Get last 50 entries
          since: logs.length > 0 ? logs[logs.length - 1].timestamp : undefined,
          filter: {
            levels: filter.levels,
            sources: filter.sources,
          },
        });
        
        if (Array.isArray(newLogs) && newLogs.length > 0) {
          setLogs(prev => [...prev.slice(-950), ...newLogs].slice(-1000)); // Keep last 1000 logs
        }
      } catch (err) {
        console.error("Failed to poll logs:", err);
      }
    }, 2000);
    
    return () => {
      clearInterval(pollInterval);
      occc.invoke("occc:logs:stream", { token, enable: false })
        .catch(() => {});
    };
  }, [token, isStreaming, filter, logs]);

  // Auto-scroll to bottom
  useEffect(() => {
    if (autoScroll && logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [logs, autoScroll]);

  // Handle scroll detection
  const handleScroll = useCallback(() => {
    if (!logContainerRef.current) { return; }
    
    const { scrollTop, scrollHeight, clientHeight } = logContainerRef.current;
    const atBottom = scrollTop + clientHeight >= scrollHeight - 100;
    setAutoScroll(atBottom);
  }, []);

  const handleToggleStreaming = useCallback(() => {
    setIsStreaming(prev => !prev);
  }, []);

  const handleClearLogs = useCallback(async () => {
    setLogs([]);
    if (token) {
      try {
        await occc.invoke("occc:logs:clear", token);
      } catch (err) {
        console.error("Failed to clear logs:", err);
      }
    }
  }, [token]);

  const handleExportLogs = useCallback(async () => {
    if (!token) { return; }
    
    try {
      await occc.invoke("occc:logs:export", {
        token,
        format: "json",
        filter: {
          levels: filter.levels,
          sources: filter.sources,
          searchQuery: filter.searchQuery,
        },
      });
    } catch (err) {
      console.error("Failed to export logs:", err);
    }
  }, [token, filter]);

  const filteredLogs = logs.filter(log => shouldShowLog(log, filter));

  if (isLoading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "60vh" }}>
        <div className="spinner" />
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div className="page-header">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <h1>Logs</h1>
            <p>Real-time monitoring and debugging</p>
          </div>
          <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
            {isStreaming && (
              <>
                <span style={styles.liveDot} />
                <span style={{ fontSize: "13px", color: "var(--text-secondary)" }}>
                  Live
                </span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Stats Bar */}
      <div style={styles.statsBar}>
        <div style={styles.logCounts}>
          {LOG_LEVELS.map(({ level, label, color }) => {
            const count = filteredLogs.filter(log => log.level === level).length;
            return (
              <div key={level} style={styles.logCount}>
                <span style={{ color, fontWeight: 600 }}>{count}</span>
                <span style={{ fontSize: "11px", color: "var(--text-tertiary)" }}>{label}</span>
              </div>
            );
          })}
        </div>
        <div style={{ fontSize: "12px", color: "var(--text-tertiary)" }}>
          {filteredLogs.length} entries
        </div>
      </div>

      {/* Controls */}
      <div style={styles.controls}>
        <div style={styles.controlsLeft}>
          {/* Level Filters */}
          <div style={styles.filterGroup}>
            <span style={styles.filterLabel}>Level:</span>
            {LOG_LEVELS.map(({ level, label }) => (
              <label key={level} style={styles.checkbox} aria-label={`Filter by ${label} level logs`}>
                <input
                  type="checkbox"
                  checked={filter.levels.includes(level)}
                  onChange={(e) => {
                    const levels = e.target.checked 
                      ? [...filter.levels, level]
                      : filter.levels.filter(l => l !== level);
                    setFilter(prev => ({ ...prev, levels }));
                  }}
                />
                <span>{label}</span>
              </label>
            ))}
          </div>

          {/* Source Filters */}
          <div style={styles.filterGroup}>
            <span style={styles.filterLabel}>Source:</span>
            {LOG_SOURCES.map(({ source, label }) => (
              <label key={source} style={styles.checkbox} aria-label={`Filter by ${label} source logs`}>
                <input
                  type="checkbox"
                  checked={filter.sources.includes(source)}
                  onChange={(e) => {
                    const sources = e.target.checked 
                      ? [...filter.sources, source]
                      : filter.sources.filter(s => s !== source);
                    setFilter(prev => ({ ...prev, sources }));
                  }}
                />
                <span>{label}</span>
              </label>
            ))}
          </div>

          {/* Search */}
          <input
            type="text"
            placeholder="Search logs..."
            value={filter.searchQuery}
            onChange={(e) => setFilter(prev => ({ ...prev, searchQuery: e.target.value }))}
            style={styles.searchInput}
            aria-label="Search log entries by message content, agent ID, or session ID"
          />
        </div>

        <div style={styles.controlsRight}>
          {/* View Options */}
          <label style={styles.checkbox} aria-label="Show timestamps in log entries">
            <input
              type="checkbox"
              checked={filter.showTimestamp}
              onChange={(e) => setFilter(prev => ({ ...prev, showTimestamp: e.target.checked }))}
            />
            <span>Timestamp</span>
          </label>
          
          <label style={styles.checkbox} aria-label="Show metadata in log entries">
            <input
              type="checkbox"
              checked={filter.showMetadata}
              onChange={(e) => setFilter(prev => ({ ...prev, showMetadata: e.target.checked }))}
            />
            <span>Metadata</span>
          </label>

          <label style={styles.checkbox} aria-label="Auto-scroll to new log entries">
            <input
              type="checkbox"
              checked={autoScroll}
              onChange={(e) => setAutoScroll(e.target.checked)}
            />
            <span>Auto-scroll</span>
          </label>

          {/* Actions */}
          <button onClick={handleToggleStreaming} style={styles.actionBtn}>
            {isStreaming ? "⏸ Pause" : "▶ Stream"}
          </button>
          
          <button onClick={handleExportLogs} style={styles.actionBtn}>
            ↓ Export
          </button>
          
          <button onClick={handleClearLogs} style={styles.actionBtn}>
            🗑 Clear
          </button>
        </div>
      </div>

      {/* Log Viewer */}
      <div 
        ref={logContainerRef}
        onScroll={handleScroll}
        style={styles.logViewer}
      >
        {filteredLogs.length === 0 ? (
          <div style={styles.emptyState}>
            <div style={{ fontSize: "32px", marginBottom: "12px", opacity: 0.3 }}>📋</div>
            <p>No logs to display</p>
            <p style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "4px" }}>
              {isStreaming ? "Waiting for log entries..." : "Click Stream to start monitoring"}
            </p>
          </div>
        ) : (
          <>
            {filteredLogs.map((log, index) => (
              <LogEntryComponent
                key={`${log.timestamp}-${index}`}
                log={log}
                filter={filter}
              />
            ))}
            <div ref={logsEndRef} />
          </>
        )}
      </div>
    </div>
  );
}

function LogEntryComponent({ log, filter }: { log: LogEntry; filter: LogFilter }) {
  const levelConfig = LOG_LEVELS.find(l => l.level === log.level);
  const sourceConfig = LOG_SOURCES.find(s => s.source === log.source);
  
  const timestamp = filter.showTimestamp 
    ? new Date(log.timestamp).toLocaleTimeString("en-US", { hour12: false, timeZoneName: "short" })
    : null;

  const highlightText = (text: string, query: string) => {
    if (!query.trim()) { return text; }
    
    const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi");
    const parts = text.split(regex);
    
    return parts.map((part, i) =>
      regex.test(part) ? (
        <span key={i} style={{ background: "var(--accent-warning)", color: "black", padding: "0 2px" }}>
          {part}
        </span>
      ) : (
        part
      )
    );
  };

  return (
    <div style={styles.logEntry}>
      <div style={styles.logEntryHeader}>
        {timestamp && (
          <span style={styles.timestamp}>{timestamp}</span>
        )}
        <span style={{ ...styles.level, color: levelConfig?.color }}>
          {levelConfig?.label.toUpperCase()}
        </span>
        <span style={styles.source}>
          {sourceConfig?.icon} {sourceConfig?.label}
        </span>
        {log.sessionId && (
          <span style={styles.sessionId}>
            Session: {log.sessionId.slice(0, 8)}
          </span>
        )}
        {log.agentId && (
          <span style={styles.agentId}>
            Agent: {log.agentId}
          </span>
        )}
      </div>
      
      <div style={styles.logMessage}>
        {highlightText(log.message, filter.searchQuery)}
      </div>
      
      {filter.showMetadata && log.metadata && Object.keys(log.metadata).length > 0 && (
        <details style={styles.metadata}>
          <summary style={styles.metadataSummary}>Metadata</summary>
          <pre style={styles.metadataContent}>
            {JSON.stringify(log.metadata, null, 2)}
          </pre>
        </details>
      )}
    </div>
  );
}

function shouldShowLog(log: LogEntry, filter: LogFilter): boolean {
  if (!filter.levels.includes(log.level)) { return false; }
  if (!filter.sources.includes(log.source)) { return false; }
  
  if (filter.searchQuery.trim()) {
    const query = filter.searchQuery.toLowerCase();
    const searchText = [
      log.message,
      log.agentId,
      log.sessionId,
      log.source,
      log.level,
    ].filter(Boolean).join(" ").toLowerCase();
    
    if (!searchText.includes(query)) { return false; }
  }
  
  return true;
}

// Styles
const styles = {
  container: {
    display: "flex",
    flexDirection: "column",
    height: "100%",
  } as React.CSSProperties,
  
  statsBar: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    background: "var(--surface-1)",
    border: "1px solid var(--border-subtle)",
    borderRadius: "8px",
    padding: "12px 16px",
    marginBottom: "16px",
  } as React.CSSProperties,
  
  logCounts: {
    display: "flex",
    gap: "16px",
  } as React.CSSProperties,
  
  logCount: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "2px",
  } as React.CSSProperties,
  
  controls: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    background: "var(--surface-1)",
    border: "1px solid var(--border-subtle)",
    borderRadius: "8px",
    padding: "12px 16px",
    marginBottom: "16px",
    gap: "16px",
    flexWrap: "wrap",
  } as React.CSSProperties,
  
  controlsLeft: {
    display: "flex",
    gap: "16px",
    alignItems: "center",
    flexWrap: "wrap",
  } as React.CSSProperties,
  
  controlsRight: {
    display: "flex",
    gap: "12px",
    alignItems: "center",
  } as React.CSSProperties,
  
  filterGroup: {
    display: "flex",
    gap: "8px",
    alignItems: "center",
  } as React.CSSProperties,
  
  filterLabel: {
    fontSize: "12px",
    color: "var(--text-tertiary)",
    fontWeight: 600,
    textTransform: "uppercase",
    letterSpacing: "0.05em",
  } as React.CSSProperties,
  
  checkbox: {
    display: "flex",
    alignItems: "center",
    gap: "4px",
    fontSize: "12px",
    color: "var(--text-secondary)",
    cursor: "pointer",
  } as React.CSSProperties,
  
  searchInput: {
    background: "var(--surface-2)",
    border: "1px solid var(--border-subtle)",
    borderRadius: "6px",
    padding: "6px 10px",
    fontSize: "12px",
    color: "var(--text-primary)",
    outline: "none",
    width: "160px",
  } as React.CSSProperties,
  
  actionBtn: {
    background: "var(--surface-2)",
    border: "1px solid var(--border-default)",
    borderRadius: "6px",
    padding: "6px 10px",
    fontSize: "12px",
    color: "var(--text-secondary)",
    cursor: "pointer",
    whiteSpace: "nowrap",
  } as React.CSSProperties,
  
  logViewer: {
    flex: 1,
    background: "var(--bg-secondary)",
    border: "1px solid var(--border-subtle)",
    borderRadius: "8px",
    overflow: "auto",
    padding: "8px",
    fontFamily: "var(--font-mono)",
    fontSize: "12px",
    lineHeight: 1.4,
  } as React.CSSProperties,
  
  logEntry: {
    background: "var(--surface-1)",
    border: "1px solid var(--border-subtle)",
    borderRadius: "6px",
    padding: "8px 10px",
    marginBottom: "4px",
  } as React.CSSProperties,
  
  logEntryHeader: {
    display: "flex",
    gap: "8px",
    alignItems: "center",
    marginBottom: "4px",
    fontSize: "11px",
  } as React.CSSProperties,
  
  timestamp: {
    color: "var(--text-tertiary)",
    fontFamily: "var(--font-mono)",
  } as React.CSSProperties,
  
  level: {
    fontWeight: 600,
    fontFamily: "var(--font-mono)",
  } as React.CSSProperties,
  
  source: {
    color: "var(--text-secondary)",
    background: "var(--surface-2)",
    padding: "2px 6px",
    borderRadius: "4px",
  } as React.CSSProperties,
  
  sessionId: {
    color: "var(--accent-primary)",
    background: "rgba(99, 102, 241, 0.1)",
    padding: "2px 6px",
    borderRadius: "4px",
    fontSize: "10px",
  } as React.CSSProperties,
  
  agentId: {
    color: "var(--accent-success)",
    background: "rgba(34, 197, 94, 0.1)",
    padding: "2px 6px",
    borderRadius: "4px",
    fontSize: "10px",
  } as React.CSSProperties,
  
  logMessage: {
    color: "var(--text-primary)",
    whiteSpace: "pre-wrap",
    wordBreak: "break-word",
  } as React.CSSProperties,
  
  metadata: {
    marginTop: "6px",
  } as React.CSSProperties,
  
  metadataSummary: {
    cursor: "pointer",
    fontSize: "11px",
    color: "var(--text-tertiary)",
    userSelect: "none",
  } as React.CSSProperties,
  
  metadataContent: {
    background: "var(--surface-2)",
    border: "1px solid var(--border-subtle)",
    borderRadius: "4px",
    padding: "8px",
    marginTop: "4px",
    fontSize: "10px",
    color: "var(--text-secondary)",
    overflow: "auto",
    maxHeight: "200px",
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
};
