import type { CSSProperties } from "react";
import type { ChatMessage, ProgressData } from "./types";

interface ProgressCardProps {
  message: ChatMessage;
}

const FILLED = "\u2588";
const EMPTY = "\u2591";
const BAR_LENGTH = 24;

function buildBar(ratio: number): { filled: string; empty: string } {
  const count = Math.round(ratio * BAR_LENGTH);
  return {
    filled: FILLED.repeat(count),
    empty: EMPTY.repeat(BAR_LENGTH - count),
  };
}

export function ProgressCard({ message }: ProgressCardProps) {
  const p = (message.data ?? {}) as unknown as ProgressData;
  const ratio = p.total > 0 ? p.current / p.total : 0;
  const pct = Math.round(ratio * 100);
  const bar = buildBar(ratio);

  return (
    <div style={styles.card}>
      <div style={styles.barRow}>
        <span style={styles.barFilled}>{bar.filled}</span>
        <span style={styles.barEmpty}>{bar.empty}</span>
      </div>
      <div style={styles.stats}>
        <span>{pct}%</span>
        <span style={styles.dot}>{"\u00B7"}</span>
        <span>{p.flagged ?? 0} FLAGGED</span>
        <span style={styles.dot}>{"\u00B7"}</span>
        <span>ETA {p.eta ?? "--"}</span>
      </div>
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  card: {
    margin: "0 var(--space-3)",
    padding: "var(--space-2) var(--space-3)",
    border: "1px solid var(--border)",
    borderRadius: 0,
    background: "var(--bg-primary)",
  },
  barRow: {
    fontFamily: "var(--font-mono)",
    fontSize: "10px",
    lineHeight: 1,
    letterSpacing: "0",
  },
  barFilled: {
    color: "var(--accent)",
  },
  barEmpty: {
    color: "var(--text-muted)",
  },
  stats: {
    marginTop: "var(--space-1)",
    fontFamily: "var(--font-mono)",
    fontSize: "10px",
    letterSpacing: "2px",
    textTransform: "uppercase" as const,
    color: "var(--text-secondary)",
    display: "flex",
    gap: "var(--space-2)",
  },
  dot: {
    color: "var(--text-muted)",
  },
};
