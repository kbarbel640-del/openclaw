import type { CSSProperties } from "react";

export interface SignatureMove {
  name: string;
  description: string;
}

interface SignatureMovesProps {
  moves: SignatureMove[];
}

export function SignatureMoves({ moves }: SignatureMovesProps) {
  return (
    <section style={styles.section}>
      <h3 style={styles.header}>SIGNATURE MOVES</h3>
      <hr style={styles.rule} />
      <ul style={styles.list}>
        {moves.map((move, i) => (
          <li key={i} style={styles.item}>
            <span style={styles.dot}>&#8226;</span>
            <span style={styles.name}>{move.name}</span>
            <span style={styles.description}>{move.description}</span>
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
    alignItems: "baseline",
    gap: "var(--space-2)",
  },
  dot: {
    color: "var(--accent)",
    fontSize: 8,
    lineHeight: 1,
  },
  name: {
    fontFamily: "var(--font-mono)",
    fontSize: 12,
    textTransform: "uppercase" as const,
    color: "var(--text-primary)",
    width: 120,
    flexShrink: 0,
  },
  description: {
    fontFamily: "var(--font-sans)",
    fontSize: 14,
    color: "var(--text-secondary)",
  },
};
