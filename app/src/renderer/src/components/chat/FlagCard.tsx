import { useState, type CSSProperties } from "react";
import type { ChatMessage, FlagData } from "./types";
import { formatTimestamp } from "./types";

interface FlagCardProps {
  message: ChatMessage;
  onAction?: (action: "approve" | "manual" | "skip") => void;
}

function confidenceColor(label: string): string {
  switch (label.toLowerCase()) {
    case "high":
      return "var(--success)";
    case "good":
      return "var(--text-primary)";
    case "moderate":
      return "var(--warning)";
    case "low":
      return "var(--accent)";
    default:
      return "var(--text-secondary)";
  }
}

export function FlagCard({ message, onAction }: FlagCardProps) {
  const flag = (message.data ?? {}) as unknown as FlagData;

  return (
    <div style={styles.card}>
      <div style={styles.header}>
        <span style={styles.label}>FLAGGED</span>
        <span style={styles.filename}>{flag.filename ?? "untitled"}</span>
        <span style={styles.time}>{formatTimestamp(message.timestamp)}</span>
      </div>
      <div style={styles.rule} />

      <div style={styles.thumbnail}>
        <span style={styles.thumbText}>16:9 PREVIEW</span>
      </div>

      <div style={styles.meta}>
        <MetaRow label="SCENARIO" value={flag.scenario ?? "--"} />
        <MetaRow
          label="CONFIDENCE"
          value={`${flag.confidence ?? 0}% ${flag.confidenceLabel ?? ""}`}
          valueColor={confidenceColor(flag.confidenceLabel ?? "low")}
        />
        <MetaRow label="REASON" value={flag.reason ?? "--"} />
      </div>

      <div style={styles.actions}>
        <FlagAction label="APPROVE" onClick={() => onAction?.("approve")} />
        <FlagAction label="MANUAL" onClick={() => onAction?.("manual")} />
        <FlagAction label="SKIP" onClick={() => onAction?.("skip")} />
      </div>
    </div>
  );
}

function MetaRow({
  label,
  value,
  valueColor,
}: {
  label: string;
  value: string;
  valueColor?: string;
}) {
  return (
    <div style={styles.metaRow}>
      <span style={styles.metaLabel}>{label}</span>
      <span style={{ ...styles.metaValue, color: valueColor ?? "var(--text-primary)" }}>
        {value}
      </span>
    </div>
  );
}

function FlagAction({ label, onClick }: { label: string; onClick: () => void }) {
  const [hover, setHover] = useState(false);
  return (
    <button
      style={{
        ...styles.actionBtn,
        borderColor: hover ? "var(--accent)" : "var(--border)",
        color: hover ? "var(--accent)" : "var(--text-secondary)",
      }}
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      {label}
    </button>
  );
}

const styles: Record<string, CSSProperties> = {
  card: {
    borderLeft: "2px solid var(--accent)",
    borderTop: "1px solid var(--border)",
    borderRight: "1px solid var(--border)",
    borderBottom: "1px solid var(--border)",
    borderRadius: 0,
    background: "var(--bg-primary)",
    margin: "0 var(--space-3)",
  },
  header: {
    display: "flex",
    alignItems: "center",
    gap: "var(--space-3)",
    padding: "var(--space-2) var(--space-3)",
  },
  label: {
    fontFamily: "var(--font-mono)",
    fontSize: "10px",
    fontWeight: 700,
    letterSpacing: "3px",
    textTransform: "uppercase" as const,
    color: "var(--accent)",
  },
  filename: {
    fontFamily: "var(--font-mono)",
    fontSize: "10px",
    fontWeight: 400,
    letterSpacing: "1px",
    color: "var(--text-secondary)",
    flex: 1,
  },
  time: {
    fontFamily: "var(--font-mono)",
    fontSize: "10px",
    fontWeight: 400,
    letterSpacing: "3px",
    color: "var(--text-secondary)",
  },
  rule: {
    height: 1,
    background: "var(--border)",
  },
  thumbnail: {
    margin: "var(--space-3)",
    aspectRatio: "16 / 9",
    border: "1px solid var(--border)",
    background: "var(--bg-surface)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  thumbText: {
    fontFamily: "var(--font-mono)",
    fontSize: "10px",
    letterSpacing: "2px",
    color: "var(--text-muted)",
    textTransform: "uppercase" as const,
  },
  meta: {
    padding: "0 var(--space-3) var(--space-3)",
    display: "flex",
    flexDirection: "column" as const,
    gap: "var(--space-1)",
  },
  metaRow: {
    display: "flex",
    alignItems: "baseline",
    gap: "var(--space-3)",
  },
  metaLabel: {
    fontFamily: "var(--font-mono)",
    fontSize: "10px",
    fontWeight: 400,
    letterSpacing: "3px",
    textTransform: "uppercase" as const,
    color: "var(--text-muted)",
    width: 100,
    flexShrink: 0,
  },
  metaValue: {
    fontFamily: "var(--font-mono)",
    fontSize: "11px",
    fontWeight: 400,
    letterSpacing: "1px",
  },
  actions: {
    display: "flex",
    gap: "var(--space-2)",
    padding: "0 var(--space-3) var(--space-3)",
  },
  actionBtn: {
    border: "1px solid var(--border)",
    borderRadius: 0,
    background: "transparent",
    fontFamily: "var(--font-mono)",
    fontSize: "11px",
    fontWeight: 400,
    letterSpacing: "2px",
    textTransform: "uppercase" as const,
    padding: "var(--space-2) var(--space-3)",
    cursor: "pointer",
    transition: "border-color 0.1s, color 0.1s",
  },
};
