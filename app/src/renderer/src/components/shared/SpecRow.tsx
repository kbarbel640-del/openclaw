import type { CSSProperties } from "react";

interface SpecRowProps {
  label: string;
  value: string;
  valueColor?: string;
  mono?: boolean;
}

export function SpecRow({ label, value, valueColor, mono = true }: SpecRowProps) {
  return (
    <div style={styles.row}>
      <span style={styles.label}>{label}</span>
      <span style={styles.dots} />
      <span
        style={{
          ...styles.value,
          color: valueColor ?? "var(--text-primary)",
          fontFamily: mono ? "var(--font-mono)" : "var(--font-sans)",
        }}
      >
        {value}
      </span>
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  row: {
    display: "flex",
    alignItems: "baseline",
    gap: "var(--space-2)",
    marginBottom: "var(--space-2)",
  },
  label: {
    fontFamily: "var(--font-mono)",
    fontSize: 11,
    fontWeight: 400,
    letterSpacing: 2,
    textTransform: "uppercase",
    color: "var(--text-muted)",
    flexShrink: 0,
    minWidth: 100,
  },
  dots: {
    flex: 1,
    borderBottom: "1px dotted var(--border)",
    minWidth: 20,
    marginBottom: 3,
  },
  value: {
    fontFamily: "var(--font-mono)",
    fontSize: 11,
    fontWeight: 400,
    letterSpacing: 1,
    flexShrink: 0,
    textAlign: "right" as const,
  },
};
