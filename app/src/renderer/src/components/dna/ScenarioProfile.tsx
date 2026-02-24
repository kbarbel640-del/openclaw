import type { CSSProperties } from "react";

const TRACK_CHAR = "\u2500";
const MARKER_CHAR = "\u25CF";
const TRACK_LENGTH = 30;

export interface SliderAdjustment {
  name: string;
  value: string;
  deviation: string;
  /** Normalized position 0–1 along the slider track */
  position: number;
}

interface ScenarioProfileProps {
  name: string;
  sampleCount: number;
  adjustments: SliderAdjustment[];
}

function SliderTrack({ position }: { position: number }) {
  const idx = Math.round(position * (TRACK_LENGTH - 1));
  const before = TRACK_CHAR.repeat(idx);
  const after = TRACK_CHAR.repeat(TRACK_LENGTH - 1 - idx);
  return (
    <span style={styles.track}>
      {before}
      <span style={styles.marker}>{MARKER_CHAR}</span>
      {after}
    </span>
  );
}

export function ScenarioProfile({ name, sampleCount, adjustments }: ScenarioProfileProps) {
  return (
    <section style={styles.section}>
      <header style={styles.header}>
        <span style={styles.name}>{name}</span>
        <span style={styles.count}>{sampleCount.toLocaleString()} photos</span>
      </header>
      <hr style={styles.rule} />
      <div style={styles.sliders}>
        {adjustments.map((adj, i) => (
          <div key={i} style={styles.row}>
            <span style={styles.sliderName}>{adj.name}</span>
            <SliderTrack position={adj.position} />
            <span style={styles.value}>
              {adj.value} (±{adj.deviation})
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}

const styles: Record<string, CSSProperties> = {
  section: {
    display: "flex",
    flexDirection: "column",
    gap: "var(--space-2)",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "baseline",
  },
  name: {
    fontFamily: "var(--font-mono)",
    fontSize: 11,
    textTransform: "uppercase" as const,
    color: "var(--text-primary)",
  },
  count: {
    fontFamily: "var(--font-mono)",
    fontSize: 11,
    color: "var(--text-secondary)",
  },
  rule: {
    border: "none",
    borderTop: "1px solid var(--border)",
    margin: 0,
  },
  sliders: {
    display: "flex",
    flexDirection: "column",
    gap: "var(--space-2)",
  },
  row: {
    display: "flex",
    alignItems: "center",
    gap: "var(--space-3)",
  },
  sliderName: {
    fontFamily: "var(--font-mono)",
    fontSize: 11,
    textTransform: "uppercase" as const,
    color: "var(--text-secondary)",
    width: 100,
    flexShrink: 0,
  },
  track: {
    fontFamily: "var(--font-mono)",
    fontSize: 11,
    color: "var(--border)",
    letterSpacing: 0,
  },
  marker: {
    color: "var(--accent)",
  },
  value: {
    fontFamily: "var(--font-mono)",
    fontSize: 11,
    color: "var(--text-primary)",
    marginLeft: "auto",
  },
};
