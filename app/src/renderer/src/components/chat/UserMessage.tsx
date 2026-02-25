import type { CSSProperties } from "react";
import type { ChatMessage } from "./types";
import { formatTimestamp } from "./types";

interface UserMessageProps {
  message: ChatMessage;
}

export function UserMessage({ message }: UserMessageProps) {
  return (
    <div style={styles.wrapper}>
      <div style={styles.card}>
        <div style={styles.header}>
          <span style={styles.sender}>YOU</span>
          <span style={styles.time}>{formatTimestamp(message.timestamp)}</span>
        </div>
        <div style={styles.rule} />
        <div style={styles.body}>{message.content}</div>
      </div>
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  wrapper: {
    display: "flex",
    justifyContent: "flex-end",
    padding: "0 var(--space-3)",
  },
  card: {
    border: "1px solid var(--border)",
    borderRadius: 0,
    background: "var(--bg-primary)",
    maxWidth: "60%",
    minWidth: 200,
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
};
