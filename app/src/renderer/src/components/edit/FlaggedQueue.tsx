import type { CSSProperties } from "react";

export interface FlaggedItem {
  id: string;
  scenario: string;
  confidence: number;
  description: string;
}

const MOCK_ITEMS: FlaggedItem[] = [
  {
    id: "DSC_0847",
    scenario: "CEREMONY::INDOOR::BACKLIT",
    confidence: 0.42,
    description: "Backlit ceremony, heavy flare",
  },
  {
    id: "DSC_1204",
    scenario: "RECEPTION::INDOOR::FLASH",
    confidence: 0.38,
    description: "Dance floor, unusual color cast",
  },
];

interface FlaggedQueueProps {
  items?: FlaggedItem[];
}

export function FlaggedQueue({ items = MOCK_ITEMS }: FlaggedQueueProps) {
  const itemStyle: CSSProperties = {
    marginBottom: "var(--space-4)",
  };

  const headStyle: CSSProperties = {
    fontFamily: "var(--font-mono)",
    fontSize: 11,
    color: "var(--text-primary)",
    marginBottom: "var(--space-1)",
  };

  const descStyle: CSSProperties = {
    fontFamily: "var(--font-mono)",
    fontSize: 11,
    color: "var(--text-secondary)",
    marginBottom: "var(--space-2)",
    paddingLeft: "var(--space-2)",
    borderLeft: "2px solid var(--border)",
  };

  const actionsStyle: CSSProperties = {
    display: "flex",
    gap: "var(--space-2)",
  };

  const btnStyle: CSSProperties = {
    fontFamily: "var(--font-mono)",
    fontSize: 11,
    textTransform: "uppercase",
    padding: "var(--space-2) var(--space-3)",
    border: "1px solid var(--border)",
    background: "transparent",
    color: "var(--text-primary)",
    cursor: "pointer",
  };

  return (
    <div>
      {items.map((item, i) => (
        <div key={i} style={itemStyle}>
          <div style={headStyle}>
            {item.id}, {item.scenario}, CONF {item.confidence.toFixed(2)}
          </div>
          <div style={descStyle}>\u2500\u2500\u2500\u2500 {item.description}</div>
          <div style={actionsStyle}>
            <button type="button" style={btnStyle}>
              APPROVE
            </button>
            <button type="button" style={btnStyle}>
              MANUAL
            </button>
            <button type="button" style={btnStyle}>
              SKIP
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
