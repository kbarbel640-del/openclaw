import { useState, useCallback, type KeyboardEvent, type CSSProperties } from "react";

interface InputBarProps {
  onSend: (text: string) => void;
}

export function InputBar({ onSend }: InputBarProps) {
  const [value, setValue] = useState("");
  const [sendHover, setSendHover] = useState(false);

  const handleSend = useCallback(() => {
    const trimmed = value.trim();
    if (!trimmed) {
      return;
    }
    onSend(trimmed);
    setValue("");
  }, [value, onSend]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend],
  );

  return (
    <div style={styles.bar}>
      <input
        style={styles.input}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="TYPE A MESSAGE..."
        spellCheck={false}
      />
      <button
        style={{
          ...styles.send,
          color: sendHover ? "var(--text-primary)" : "var(--accent)",
        }}
        onClick={handleSend}
        onMouseEnter={() => setSendHover(true)}
        onMouseLeave={() => setSendHover(false)}
      >
        {">>>>"}
      </button>
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  bar: {
    display: "flex",
    alignItems: "center",
    height: 48,
    borderTop: "1px solid var(--border)",
    background: "var(--bg-primary)",
    flexShrink: 0,
    padding: "0 var(--space-4)",
    gap: "var(--space-3)",
  },
  input: {
    flex: 1,
    height: "100%",
    border: "none",
    outline: "none",
    background: "transparent",
    color: "var(--text-primary)",
    fontFamily: "var(--font-mono)",
    fontSize: "13px",
    letterSpacing: "0.5px",
  },
  send: {
    border: "none",
    background: "transparent",
    fontFamily: "var(--font-mono)",
    fontSize: "13px",
    fontWeight: 700,
    letterSpacing: "2px",
    cursor: "pointer",
    padding: "var(--space-2) var(--space-3)",
    transition: "color 0.1s",
  },
};
