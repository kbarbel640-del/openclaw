import { useState, type CSSProperties } from "react";
import type { ChatMessage, QuestionData } from "./types";
import { formatTimestamp } from "./types";

interface QuestionCardProps {
  message: ChatMessage;
  onSelect?: (option: string) => void;
}

export function QuestionCard({ message, onSelect }: QuestionCardProps) {
  const q = (message.data ?? {}) as unknown as QuestionData;
  const options = q.options ?? [];
  const [selected, setSelected] = useState<string | null>(null);
  const [hovered, setHovered] = useState<string | null>(null);

  function handleSelect(opt: string) {
    setSelected(opt);
    onSelect?.(opt);
  }

  return (
    <div style={styles.card}>
      <div style={styles.header}>
        <span style={styles.sender}>SOPHIE</span>
        <span style={styles.time}>{formatTimestamp(message.timestamp)}</span>
      </div>
      <div style={styles.rule} />
      <div style={styles.body}>{message.content}</div>
      <div style={styles.options}>
        {options.map((opt) => {
          const isSelected = selected === opt;
          const isHovered = hovered === opt;
          return (
            <button
              key={opt}
              style={{
                ...styles.option,
                borderColor: isSelected
                  ? "var(--accent)"
                  : isHovered
                    ? "var(--accent)"
                    : "var(--border)",
                background: isSelected ? "var(--accent)" : "transparent",
                color: isSelected ? "var(--bg-primary)" : "var(--text-secondary)",
              }}
              onClick={() => handleSelect(opt)}
              onMouseEnter={() => setHovered(opt)}
              onMouseLeave={() => setHovered(null)}
            >
              {opt}
            </button>
          );
        })}
      </div>
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  card: {
    border: "1px solid var(--border)",
    borderRadius: 0,
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
    textTransform: "uppercase" as const,
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
    whiteSpace: "pre-wrap" as const,
  },
  options: {
    display: "flex",
    flexWrap: "wrap" as const,
    gap: "var(--space-2)",
    padding: "0 var(--space-3) var(--space-3)",
  },
  option: {
    border: "1px solid var(--border)",
    borderRadius: 0,
    fontFamily: "var(--font-mono)",
    fontSize: "11px",
    fontWeight: 400,
    letterSpacing: "2px",
    textTransform: "uppercase" as const,
    padding: "var(--space-2) var(--space-3)",
    cursor: "pointer",
    transition: "border-color 0.1s, background 0.1s, color 0.1s",
  },
};
