import type { CSSProperties } from "react";

interface RuleProps {
  variant?: "default" | "strong" | "accent";
  spacing?: "none" | "sm" | "md" | "lg";
}

const BORDER_MAP: Record<string, string> = {
  default: "1px solid var(--border)",
  strong: "1px solid var(--border-strong)",
  accent: "2px solid var(--accent)",
};

const MARGIN_MAP: Record<string, string> = {
  none: "0",
  sm: "var(--space-3) 0",
  md: "var(--space-4) 0",
  lg: "var(--space-5) 0",
};

export function Rule({ variant = "default", spacing = "md" }: RuleProps) {
  const style: CSSProperties = {
    border: "none",
    borderTop: BORDER_MAP[variant],
    margin: MARGIN_MAP[spacing],
  };

  return <hr style={style} />;
}
