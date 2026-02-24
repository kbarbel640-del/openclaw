import type { CSSProperties } from "react";

const BLOCK_COUNT = 40;
const FILLED = "\u2588";
const EMPTY = "\u2591";

type ConfidenceLevel = "high" | "good" | "moderate" | "low";

const confidenceColorMap: Record<ConfidenceLevel, string> = {
  high: "var(--success)",
  good: "var(--text-primary)",
  moderate: "var(--warning)",
  low: "var(--text-muted)",
};

export interface ScenarioCoverageProps {
  name: string;
  sampleCount: number;
  confidence: ConfidenceLevel;
  maxSamples: number;
}

export function ScenarioCoverage({
  name,
  sampleCount,
  confidence,
  maxSamples,
}: ScenarioCoverageProps) {
  const ratio = maxSamples > 0 ? sampleCount / maxSamples : 0;
  const filledCount = Math.round(BLOCK_COUNT * ratio);
  const emptyCount = BLOCK_COUNT - filledCount;
  const bar = FILLED.repeat(Math.max(0, filledCount)) + EMPTY.repeat(Math.max(0, emptyCount));
  const confidenceColor = confidenceColorMap[confidence];
  const confidenceLabel = confidence.toUpperCase();

  const container: CSSProperties = {
    marginBottom: "var(--space-3)",
  };

  const nameStyle: CSSProperties = {
    fontFamily: "var(--font-mono)",
    fontSize: 11,
    textTransform: "uppercase",
    color: "var(--text-primary)",
    marginBottom: "var(--space-2)",
  };

  const barStyle: CSSProperties = {
    fontFamily: "var(--font-mono)",
    fontSize: 11,
    letterSpacing: 0.5,
  };

  const confidenceStyle: CSSProperties = {
    fontFamily: "var(--font-mono)",
    fontSize: 10,
    color: confidenceColor,
    textTransform: "uppercase",
    marginTop: "var(--space-2)",
  };

  return (
    <div style={container}>
      <div style={nameStyle}>{name}</div>
      <div style={barStyle}>
        {bar.split("").map((char, i) => (
          <span
            key={i}
            style={{
              color: char === FILLED ? "var(--accent)" : "var(--text-muted)",
            }}
          >
            {char}
          </span>
        ))}{" "}
        {sampleCount}
      </div>
      <div style={confidenceStyle}>CONFIDENCE: {confidenceLabel}</div>
    </div>
  );
}
