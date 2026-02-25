import type { CSSProperties } from "react";

export interface Correlation {
  description: string;
  r: number;
}

interface CorrelationViewProps {
  correlations: Correlation[];
}

function correlationColor(r: number): string {
  if (r > 0.5) {
    return "var(--success)";
  }
  if (r < -0.3) {
    return "var(--accent)";
  }
  return "var(--text-primary)";
}

export function CorrelationView({ correlations }: CorrelationViewProps) {
  return (
    <section style={styles.section}>
      <h3 style={styles.header}>SLIDER CORRELATIONS</h3>
      <hr style={styles.rule} />
      <ul style={styles.list}>
        {correlations.map((c, i) => (
          <li key={i} style={styles.item}>
            <span style={styles.description}>{c.description}</span>
            <span style={{ ...styles.rValue, color: correlationColor(c.r) }}>
              r = {c.r.toFixed(2)}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

const styles: Record<string, CSSProperties> = {
  section: {
    display: "flex",
    flexDirection: "column",
    gap: "var(--space-2)",
  },
  header: {
    fontFamily: "var(--font-sans)",
    fontSize: 16,
    letterSpacing: 1,
    textTransform: "uppercase" as const,
    color: "var(--text-primary)",
    fontWeight: 500,
  },
  rule: {
    border: "none",
    borderTop: "1px solid var(--border)",
    margin: 0,
  },
  list: {
    listStyle: "none",
    display: "flex",
    flexDirection: "column",
    gap: "var(--space-2)",
    padding: 0,
    margin: 0,
  },
  item: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "baseline",
    gap: "var(--space-4)",
  },
  description: {
    fontFamily: "var(--font-sans)",
    fontSize: 14,
    color: "var(--text-primary)",
  },
  rValue: {
    fontFamily: "var(--font-mono)",
    fontSize: 11,
    flexShrink: 0,
  },
};
