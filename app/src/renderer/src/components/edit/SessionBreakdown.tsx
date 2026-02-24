import type { CSSProperties } from "react";

export interface BreakdownItem {
  category: string;
  done: number;
  flagged: number;
  skipped?: boolean;
}

const MOCK_ITEMS: BreakdownItem[] = [
  { category: "PORTRAITS", done: 187, flagged: 2 },
  { category: "RECEPTION", done: 142, flagged: 14 },
  { category: "CEREMONY", skipped: true },
  { category: "DETAILS", done: 98, flagged: 3 },
  { category: "GROUPS", done: 45, flagged: 4 },
];

interface SessionBreakdownProps {
  items?: BreakdownItem[];
}

export function SessionBreakdown({ items = MOCK_ITEMS }: SessionBreakdownProps) {
  const rowStyle: CSSProperties = {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "baseline",
    fontFamily: "var(--font-mono)",
    fontSize: 11,
    color: "var(--text-primary)",
    marginBottom: "var(--space-2)",
  };

  const categoryStyle: CSSProperties = {
    flexShrink: 0,
  };

  const statsStyle: CSSProperties = {
    color: "var(--text-secondary)",
  };

  return (
    <div>
      {items.map((item, i) => (
        <div key={i} style={rowStyle}>
          <span style={categoryStyle}>{item.category}</span>
          <span style={statsStyle}>
            {item.skipped
              ? "SKIPPED (PER YOUR REQUEST)"
              : `${String(item.done).padStart(3)} DONE · ${String(item.flagged).padStart(2)} FLAGGED`}
          </span>
        </div>
      ))}
    </div>
  );
}
