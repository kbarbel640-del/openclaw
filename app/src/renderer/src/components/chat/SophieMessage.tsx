import { useState, type CSSProperties } from "react";
import type { ChatMessage, ContentBlock } from "./types";
import { formatTimestamp } from "./types";

interface SophieMessageProps {
  message: ChatMessage;
  actions?: Array<{ label: string; onClick: () => void }>;
}

export function SophieMessage({ message, actions }: SophieMessageProps) {
  const hasBlocks = message.blocks && message.blocks.length > 0;

  return (
    <div style={styles.card}>
      <div style={styles.header}>
        <span style={styles.sender}>SOPHIE</span>
        <span style={styles.time}>{formatTimestamp(message.timestamp)}</span>
      </div>
      <div style={styles.rule} />

      {hasBlocks ? (
        <div style={styles.blocksWrap}>
          {message.blocks!.map((block, i) => (
            <BlockRenderer key={i} block={block} />
          ))}
        </div>
      ) : (
        <div style={styles.body}>{message.content}</div>
      )}

      {actions && actions.length > 0 && (
        <div style={styles.actions}>
          {actions.map((action) => (
            <ActionButton key={action.label} label={action.label} onClick={action.onClick} />
          ))}
        </div>
      )}
    </div>
  );
}

function BlockRenderer({ block }: { block: ContentBlock }) {
  switch (block.kind) {
    case "text":
      return <div style={styles.body}>{block.value}</div>;

    case "scenario-bar":
      return <ScenarioBar {...block} />;

    case "spec":
      return (
        <div style={styles.specBlock}>
          {block.rows.map((row, i) => (
            <div key={i} style={styles.specRow}>
              <span style={styles.specLabel}>{row.label}</span>
              <span style={styles.specDots} />
              <span
                style={{
                  ...styles.specValue,
                  color: row.accent ? "var(--accent)" : "var(--text-primary)",
                }}
              >
                {row.value}
              </span>
            </div>
          ))}
        </div>
      );

    case "stat":
      return (
        <div style={styles.statBlock}>
          <span style={styles.statValue}>{block.value}</span>
          <span style={styles.statLabel}>{block.label}</span>
        </div>
      );

    default:
      return null;
  }
}

const BAR_WIDTH = 24;
const FILLED = "█";
const EMPTY = "░";

function ScenarioBar({
  name,
  filled,
  total,
  count,
}: {
  name: string;
  filled: number;
  total: number;
  count: number;
}) {
  const ratio = total > 0 ? filled / total : 0;
  const filledCount = Math.round(ratio * BAR_WIDTH);
  const emptyCount = BAR_WIDTH - filledCount;
  const bar = FILLED.repeat(filledCount) + EMPTY.repeat(emptyCount);

  return (
    <div style={styles.scenarioRow}>
      <span style={styles.scenarioName}>{name}</span>
      <span style={styles.scenarioBar}>{bar}</span>
      <span style={styles.scenarioCount}>{count}</span>
    </div>
  );
}

function ActionButton({ label, onClick }: { label: string; onClick: () => void }) {
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
    border: "1px solid var(--border)",
    background: "var(--bg-primary)",
    margin: "0 var(--space-3)",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "var(--space-2) var(--space-3)",
  },
  sender: {
    fontFamily: "var(--font-mono)",
    fontSize: "10px",
    fontWeight: 400,
    letterSpacing: "3px",
    textTransform: "uppercase",
    color: "var(--text-secondary)",
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
  body: {
    padding: "var(--space-3)",
    fontFamily: "var(--font-sans)",
    fontSize: "14px",
    lineHeight: 1.5,
    color: "var(--text-primary)",
    whiteSpace: "pre-wrap",
  },
  blocksWrap: {
    display: "flex",
    flexDirection: "column",
  },
  scenarioRow: {
    display: "flex",
    alignItems: "baseline",
    gap: "var(--space-2)",
    padding: "3px var(--space-3)",
    fontFamily: "var(--font-mono)",
    fontSize: "11px",
  },
  scenarioName: {
    color: "var(--text-secondary)",
    letterSpacing: "1px",
    minWidth: 200,
    flexShrink: 0,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  scenarioBar: {
    color: "var(--accent)",
    letterSpacing: 0,
    lineHeight: 1,
    flexShrink: 0,
  },
  scenarioCount: {
    color: "var(--text-primary)",
    fontWeight: 500,
    minWidth: 24,
    textAlign: "right",
  },
  specBlock: {
    padding: "var(--space-2) var(--space-3)",
  },
  specRow: {
    display: "flex",
    alignItems: "baseline",
    gap: "var(--space-2)",
    marginBottom: 3,
  },
  specLabel: {
    fontFamily: "var(--font-mono)",
    fontSize: "10px",
    letterSpacing: "2px",
    textTransform: "uppercase",
    color: "var(--text-muted)",
    flexShrink: 0,
    minWidth: 80,
  },
  specDots: {
    flex: 1,
    borderBottom: "1px dotted var(--border)",
    minWidth: 12,
    marginBottom: 2,
  },
  specValue: {
    fontFamily: "var(--font-mono)",
    fontSize: "11px",
    letterSpacing: "1px",
    color: "var(--text-primary)",
    flexShrink: 0,
    textAlign: "right",
  },
  statBlock: {
    display: "flex",
    alignItems: "baseline",
    gap: "var(--space-3)",
    padding: "var(--space-2) var(--space-3)",
  },
  statValue: {
    fontFamily: "var(--font-mono)",
    fontSize: "28px",
    fontWeight: 700,
    letterSpacing: -1,
    lineHeight: 1,
    color: "var(--text-primary)",
  },
  statLabel: {
    fontFamily: "var(--font-mono)",
    fontSize: "9px",
    letterSpacing: "3px",
    textTransform: "uppercase",
    color: "var(--text-muted)",
  },
  actions: {
    display: "flex",
    gap: "var(--space-2)",
    padding: "var(--space-2) var(--space-3) var(--space-3)",
  },
  actionBtn: {
    border: "1px solid var(--border)",
    background: "transparent",
    fontFamily: "var(--font-mono)",
    fontSize: "11px",
    fontWeight: 400,
    letterSpacing: "2px",
    textTransform: "uppercase",
    padding: "var(--space-2) var(--space-3)",
    cursor: "pointer",
    transition: "border-color 0.1s, color 0.1s",
  },
};
