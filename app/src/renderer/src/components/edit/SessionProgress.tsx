import type { CSSProperties } from "react";

const BAR_WIDTH = 40;
const FILLED = "\u2588";
const EMPTY = "\u2591";

interface SessionProgressProps {
  current: number;
  total: number;
  flagged: number;
  eta: string;
}

export function SessionProgress({ current, total, flagged, eta }: SessionProgressProps) {
  const pct = total > 0 ? current / total : 0;
  const filledCount = Math.round(pct * BAR_WIDTH);
  const emptyCount = BAR_WIDTH - filledCount;
  const bar = FILLED.repeat(filledCount) + EMPTY.repeat(emptyCount);
  const pctDisplay = total > 0 ? Math.round(pct * 100) : 0;

  const barStyle: CSSProperties = {
    fontFamily: "var(--font-mono)",
    fontSize: 11,
    color: "var(--text-primary)",
    letterSpacing: 0,
    marginBottom: "var(--space-2)",
  };

  const statsStyle: CSSProperties = {
    fontFamily: "var(--font-mono)",
    fontSize: 10,
    color: "var(--text-secondary)",
    letterSpacing: 1,
    textTransform: "uppercase",
  };

  const countFormatted = current.toLocaleString();
  const totalFormatted = total.toLocaleString();

  return (
    <div>
      <div style={barStyle}>
        {bar} {countFormatted} / {totalFormatted}
      </div>
      <div style={statsStyle}>
        {pctDisplay}% COMPLETE · {flagged} FLAGGED · ~{eta} REMAINING
      </div>
    </div>
  );
}
