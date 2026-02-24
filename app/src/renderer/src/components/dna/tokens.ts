/**
 * DNA section design tokens (American Industrial Utility).
 * Values defined in globals.css :root; reference via CSS vars.
 */
export const dnaTokens = {
  /* Background */
  bgPrimary: "var(--bg-primary)",
  bgSurface: "var(--bg-surface)",
  bgElevated: "var(--bg-elevated)",
  /* Text */
  textPrimary: "var(--text-primary)",
  textSecondary: "var(--text-secondary)",
  textMuted: "var(--text-muted)",
  /* Accent */
  accent: "var(--accent)",
  border: "var(--border)",
  borderStrong: "var(--border-strong)",
  /* Status */
  success: "var(--success)",
  warning: "var(--warning)",
  /* Typography */
  fontMono: "var(--font-mono)",
  fontSans: "var(--font-sans)",
  /* Spacing */
  space1: "var(--space-1)",
  space2: "var(--space-2)",
  space3: "var(--space-3)",
  space4: "var(--space-4)",
  space5: "var(--space-5)",
} as const;
