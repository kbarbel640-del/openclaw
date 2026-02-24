export const colors = {
  bgPrimary: "var(--bg-primary)",
  bgSurface: "var(--bg-surface)",
  bgElevated: "var(--bg-elevated)",
  textPrimary: "var(--text-primary)",
  textSecondary: "var(--text-secondary)",
  textMuted: "var(--text-muted)",
  accent: "var(--accent)",
  accentHover: "var(--accent-hover)",
  accentDim: "var(--accent-dim)",
  border: "var(--border)",
  borderStrong: "var(--border-strong)",
  success: "var(--success)",
  warning: "var(--warning)",
  statusActive: "var(--status-active)",
  utilityYellow: "var(--utility-yellow)",
} as const;

export const confidenceColor: Record<string, string> = {
  high: "var(--success)",
  good: "var(--text-primary)",
  moderate: "var(--warning)",
  low: "var(--text-muted)",
};
