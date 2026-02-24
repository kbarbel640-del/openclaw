import type { SophieStatus, SessionProgress } from "../App";

interface StatusBarProps {
  status: SophieStatus;
  progress: SessionProgress | null;
}

const STATUS_COLORS: Record<SophieStatus, string> = {
  idle: "var(--success)",
  editing: "var(--accent)",
  learning: "var(--accent)",
  paused: "var(--text-muted)",
  waiting: "var(--warning)",
  complete: "var(--success)",
};

export function StatusBar({ status, progress }: StatusBarProps) {
  const dotColor = STATUS_COLORS[status];

  let statusText = `SOPHIE / STATUS: ${status.toUpperCase()}`;
  if (progress) {
    statusText += ` · ${progress.current.toLocaleString()}/${progress.total.toLocaleString()}`;
    if (progress.flagged > 0) {
      statusText += ` · ${progress.flagged} FLAGGED`;
    }
    statusText += ` · ETA ${progress.eta}`;
  }

  return (
    <footer style={styles.bar}>
      <div style={styles.content}>
        <span style={{ ...styles.dot, background: dotColor }} />
        <span style={styles.text}>{statusText}</span>
      </div>
      <span style={styles.platform}>LOCAL / MACOS</span>
    </footer>
  );
}

const styles = {
  bar: {
    display: "flex",
    alignItems: "center" as const,
    justifyContent: "space-between" as const,
    height: "var(--status-height)",
    padding: "0 var(--space-5)",
    borderTop: "1px solid var(--border-strong)",
    background: "var(--bg-primary)",
    flexShrink: 0,
  },
  content: {
    display: "flex",
    alignItems: "center" as const,
    gap: "var(--space-2)",
  },
  dot: {
    width: "6px",
    height: "6px",
    flexShrink: 0,
  },
  text: {
    fontFamily: "var(--font-mono)",
    fontSize: "10px",
    textTransform: "uppercase" as const,
    letterSpacing: "3px",
    color: "var(--text-secondary)",
  },
  platform: {
    fontFamily: "var(--font-mono)",
    fontSize: "10px",
    textTransform: "uppercase" as const,
    letterSpacing: "3px",
    color: "var(--text-muted)",
  },
} as const;
