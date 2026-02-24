import type { CSSProperties } from "react";

export interface ActivityEntry {
  date: string;
  description: string;
}

const MOCK_ENTRIES: ActivityEntry[] = [
  { date: "2026-02-18", description: "Watched 23 edits (reception)" },
  { date: "2026-02-17", description: "Ingested 847 catalog edits" },
  { date: "2026-02-16", description: "Profile updated from feedback" },
];

export interface ActivityTimelineProps {
  entries?: ActivityEntry[];
}

export function ActivityTimeline({ entries = MOCK_ENTRIES }: ActivityTimelineProps) {
  const row: CSSProperties = {
    display: "flex",
    gap: "var(--space-4)",
    marginBottom: "var(--space-2)",
  };

  const dateStyle: CSSProperties = {
    fontFamily: "var(--font-mono)",
    fontSize: 11,
    color: "var(--text-secondary)",
    flexShrink: 0,
    width: 100,
  };

  const descStyle: CSSProperties = {
    fontFamily: "var(--font-sans)",
    fontSize: 14,
    color: "var(--text-primary)",
  };

  return (
    <div>
      {entries.map((entry, i) => (
        <div key={i} style={row}>
          <span style={dateStyle}>{entry.date}</span>
          <span style={descStyle}>{entry.description}</span>
        </div>
      ))}
    </div>
  );
}
