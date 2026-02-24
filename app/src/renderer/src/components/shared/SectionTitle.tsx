import type { CSSProperties, ReactNode } from "react";

interface SectionTitleProps {
  children: ReactNode;
  size?: "default" | "screen";
  sub?: string;
}

export function SectionTitle({ children, size = "default", sub }: SectionTitleProps) {
  const titleStyle = size === "screen" ? styles.screen : styles.section;

  return (
    <div style={styles.wrap}>
      <h2 style={titleStyle}>{children}</h2>
      {sub && <p style={styles.sub}>{sub}</p>}
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  wrap: {
    display: "flex",
    flexDirection: "column",
    gap: "var(--space-1)",
  },
  section: {
    fontFamily: "var(--font-mono)",
    fontSize: 11,
    fontWeight: 600,
    letterSpacing: 2,
    textTransform: "uppercase",
    color: "var(--text-secondary)",
    margin: 0,
  },
  screen: {
    fontFamily: "var(--font-sans)",
    fontSize: 24,
    fontWeight: 700,
    letterSpacing: -0.5,
    textTransform: "uppercase",
    color: "var(--text-primary)",
    margin: 0,
  },
  sub: {
    fontFamily: "var(--font-mono)",
    fontSize: 11,
    color: "var(--text-secondary)",
    letterSpacing: 1,
    margin: 0,
  },
};
