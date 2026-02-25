interface HeaderProps {
  activeSection: string;
}

export function Header({ activeSection }: HeaderProps) {
  return (
    <header style={styles.header} className="drag-region">
      <div style={styles.left}>
        <div style={styles.brand}>THE LAB ®</div>
        <div style={styles.section}>SOPHIE / {activeSection}</div>
      </div>
      <div style={styles.right} className="no-drag">
        <div style={styles.org}>DEPARTMENT OF VIBE</div>
        <div style={styles.version}>v0.1 / 2026</div>
      </div>
    </header>
  );
}

const styles = {
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-end",
    padding: "var(--space-3) var(--space-5)",
    paddingTop: "var(--titlebar-inset)",
    borderBottom: "2px solid var(--border-strong)",
    background: "var(--bg-primary)",
    flexShrink: 0,
  },
  left: {
    display: "flex",
    flexDirection: "column" as const,
    gap: "2px",
  },
  brand: {
    fontFamily: "var(--font-sans)",
    fontWeight: 700,
    fontSize: "14px",
    textTransform: "uppercase" as const,
    color: "var(--text-primary)",
    letterSpacing: "1px",
  },
  section: {
    fontFamily: "var(--font-mono)",
    fontWeight: 400,
    fontSize: "11px",
    textTransform: "uppercase" as const,
    color: "var(--text-secondary)",
    letterSpacing: "3px",
  },
  right: {
    display: "flex",
    flexDirection: "column" as const,
    alignItems: "flex-end" as const,
    gap: "2px",
  },
  org: {
    fontFamily: "var(--font-mono)",
    fontWeight: 400,
    fontSize: "10px",
    textTransform: "uppercase" as const,
    color: "var(--text-secondary)",
    letterSpacing: "2px",
  },
  version: {
    fontFamily: "var(--font-mono)",
    fontWeight: 400,
    fontSize: "10px",
    color: "var(--text-muted)",
    letterSpacing: "2px",
  },
} as const;
