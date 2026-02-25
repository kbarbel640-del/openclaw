import { useState } from "react";
import type { Section } from "../App";

interface NavRailProps {
  active: Section;
  onChange: (section: Section) => void;
  editActive?: boolean;
  catalogName?: string;
  photoCount?: number;
}

const NAV_ITEMS: Array<{
  id: Section;
  label: string;
  tag: string;
  code: string;
  shortcut: string;
}> = [
  { id: "chat", label: "CHAT", tag: "TALK TO SOPHIE", code: "01", shortcut: "⌘1" },
  { id: "learn", label: "LEARN", tag: "CATALOG & SCENARIOS", code: "02", shortcut: "⌘2" },
  { id: "edit", label: "EDIT", tag: "ACTIVE SESSIONS", code: "03", shortcut: "⌘3" },
  { id: "dna", label: "DNA", tag: "YOUR EDITING STYLE", code: "04", shortcut: "⌘4" },
];

export function NavRail({
  active,
  onChange,
  editActive,
  catalogName = "MyCatalog.lrcat",
  photoCount = 12847,
}: NavRailProps) {
  const [hovered, setHovered] = useState<Section | null>(null);

  return (
    <nav style={styles.rail}>
      {NAV_ITEMS.map((item) => {
        const isActive = active === item.id;
        const isHovered = hovered === item.id && !isActive;
        return (
          <button
            key={item.id}
            onClick={() => onChange(item.id)}
            onMouseEnter={() => setHovered(item.id)}
            onMouseLeave={() => setHovered(null)}
            style={{
              ...styles.item,
              ...(isActive ? styles.itemActive : {}),
              ...(isHovered ? styles.itemHover : {}),
            }}
          >
            <div style={styles.topRow}>
              <span
                style={{
                  ...styles.indicator,
                  color: isActive
                    ? "var(--accent)"
                    : isHovered
                      ? "var(--text-secondary)"
                      : "var(--text-muted)",
                }}
              >
                {isActive ? "■" : "□"}
              </span>
              <span
                style={{
                  ...styles.label,
                  color: isActive
                    ? "var(--accent)"
                    : isHovered
                      ? "var(--text-primary)"
                      : "var(--text-secondary)",
                }}
              >
                {item.label}
              </span>
              <span
                style={{
                  ...styles.code,
                  color: isHovered ? "var(--text-secondary)" : "var(--text-muted)",
                }}
              >
                {isHovered ? item.shortcut : item.code}
              </span>
              {item.id === "edit" && editActive && <span style={styles.activeDot} />}
            </div>
            <div
              style={{
                ...styles.tag,
                color: isActive
                  ? "var(--text-secondary)"
                  : isHovered
                    ? "var(--text-muted)"
                    : "transparent",
              }}
            >
              {item.tag}
            </div>
          </button>
        );
      })}
      <div style={styles.spacer} />
      <div style={styles.footer}>
        <div style={styles.footerRule} />
        <div style={styles.footerMeta}>{catalogName.toUpperCase()}</div>
        <div style={styles.footerCount}>{photoCount.toLocaleString()} PHOTOS</div>
      </div>
    </nav>
  );
}

const styles = {
  rail: {
    width: "180px",
    display: "flex",
    flexDirection: "column" as const,
    paddingTop: "var(--space-4)",
    borderRight: "1px solid var(--border)",
    background: "var(--bg-primary)",
    flexShrink: 0,
    overflow: "hidden",
  },
  item: {
    display: "flex",
    flexDirection: "column" as const,
    alignItems: "flex-start" as const,
    gap: "3px",
    padding: "var(--space-3) var(--space-4)",
    border: "none",
    background: "transparent",
    cursor: "pointer",
    transition: "background 0.15s, border-color 0.15s",
    width: "100%",
    textAlign: "left" as const,
    borderLeft: "2px solid transparent",
  },
  itemActive: {
    background: "var(--bg-surface)",
    borderLeft: "2px solid var(--accent)",
  },
  itemHover: {
    background: "rgba(255, 255, 255, 0.03)",
    borderLeft: "2px solid var(--border-strong)",
  },
  topRow: {
    display: "flex",
    alignItems: "center" as const,
    gap: "var(--space-2)",
    width: "100%",
  },
  indicator: {
    fontFamily: "var(--font-mono)",
    fontSize: "9px",
    lineHeight: 1,
    flexShrink: 0,
    transition: "color 0.15s",
  },
  label: {
    fontFamily: "var(--font-mono)",
    fontSize: "12px",
    fontWeight: 500,
    letterSpacing: "2px",
    textTransform: "uppercase" as const,
    lineHeight: 1,
    transition: "color 0.15s",
  },
  code: {
    fontFamily: "var(--font-mono)",
    fontSize: "9px",
    letterSpacing: "1px",
    marginLeft: "auto",
    transition: "color 0.15s",
  },
  tag: {
    fontFamily: "var(--font-mono)",
    fontSize: "9px",
    letterSpacing: "1.5px",
    textTransform: "uppercase" as const,
    lineHeight: 1.3,
    paddingLeft: "17px",
    transition: "color 0.15s",
    height: "12px",
  },
  activeDot: {
    width: "6px",
    height: "6px",
    background: "var(--accent)",
    flexShrink: 0,
  },
  spacer: {
    flex: 1,
  },
  footer: {
    padding: "var(--space-3) var(--space-4)",
    display: "flex",
    flexDirection: "column" as const,
    gap: "2px",
  },
  footerRule: {
    height: "1px",
    background: "var(--border)",
    marginBottom: "var(--space-2)",
  },
  footerMeta: {
    fontFamily: "var(--font-mono)",
    fontSize: "8px",
    letterSpacing: "1.5px",
    textTransform: "uppercase" as const,
    color: "var(--text-muted)",
  },
  footerCount: {
    fontFamily: "var(--font-mono)",
    fontSize: "8px",
    letterSpacing: "1.5px",
    textTransform: "uppercase" as const,
    color: "var(--text-secondary)",
  },
} as const;
