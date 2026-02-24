import type { CSSProperties } from "react";

interface HeroStatProps {
  value: string;
  label: string;
  size?: "lg" | "md";
}

export function HeroStat({ value, label, size = "lg" }: HeroStatProps) {
  return (
    <div style={styles.wrap}>
      <span style={size === "lg" ? styles.valueLg : styles.valueMd}>{value}</span>
      <span style={styles.label}>{label}</span>
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  wrap: {
    display: "flex",
    flexDirection: "column",
    gap: "var(--space-1)",
  },
  valueLg: {
    fontFamily: "var(--font-mono)",
    fontSize: 48,
    fontWeight: 700,
    letterSpacing: -2,
    lineHeight: 1,
    color: "var(--text-primary)",
  },
  valueMd: {
    fontFamily: "var(--font-mono)",
    fontSize: 32,
    fontWeight: 700,
    letterSpacing: -1,
    lineHeight: 1,
    color: "var(--text-primary)",
  },
  label: {
    fontFamily: "var(--font-mono)",
    fontSize: 9,
    fontWeight: 400,
    letterSpacing: 3,
    textTransform: "uppercase",
    color: "var(--text-muted)",
  },
};
