import { useState, useEffect, useCallback } from "react";
import type { CSSProperties } from "react";
import { Rule } from "../shared/Rule";
import { SectionTitle } from "../shared/SectionTitle";
import { CorrelationView, type Correlation } from "./CorrelationView";
import { ScenarioProfile, type SliderAdjustment } from "./ScenarioProfile";
import { SignatureMoves, type SignatureMove } from "./SignatureMoves";

interface DNAProfile {
  totalPhotos: number;
  scenarioCount: number;
  signatureMoves: SignatureMove[];
  scenarios: Array<{
    name: string;
    sampleCount: number;
    adjustments: SliderAdjustment[];
  }>;
  correlations: Correlation[];
}

const MOCK_PROFILE: DNAProfile = {
  totalPhotos: 12847,
  scenarioCount: 24,
  signatureMoves: [
    { name: "SHADOWS", description: "+35 avg across all scenarios" },
    { name: "TEMPERATURE", description: "+280K avg warmth bias" },
    { name: "GRAIN", description: "12-18 subtle texture always" },
    { name: "GREEN SAT", description: "-8 avg desaturation" },
  ],
  scenarios: [
    {
      name: "GOLDEN_HOUR::OUTDOOR::PORTRAIT",
      sampleCount: 1847,
      adjustments: [
        { name: "EXPOSURE", value: "+0.35", deviation: "0.12", position: 0.68 },
        { name: "TEMPERATURE", value: "+300K", deviation: "45", position: 0.72 },
        { name: "SHADOWS", value: "+38", deviation: "8", position: 0.78 },
        { name: "HIGHLIGHTS", value: "-25", deviation: "10", position: 0.25 },
        { name: "VIBRANCE", value: "+12", deviation: "5", position: 0.55 },
        { name: "GRAIN AMT", value: "15", deviation: "3", position: 0.5 },
      ],
    },
    {
      name: "BLUE_HOUR::URBAN::ARCHITECTURE",
      sampleCount: 923,
      adjustments: [
        { name: "EXPOSURE", value: "-0.12", deviation: "0.08", position: 0.44 },
        { name: "TEMPERATURE", value: "-120K", deviation: "35", position: 0.2 },
        { name: "SHADOWS", value: "+42", deviation: "11", position: 0.82 },
        { name: "HIGHLIGHTS", value: "-18", deviation: "9", position: 0.32 },
        { name: "BLUE SAT", value: "+8", deviation: "4", position: 0.62 },
        { name: "CLARITY", value: "+15", deviation: "6", position: 0.58 },
      ],
    },
  ],
  correlations: [
    { description: "SHADOWS \u2191 + HIGHLIGHTS \u2193", r: -0.82 },
    { description: "SHADOWS \u2191 + CLARITY \u2191", r: 0.45 },
    { description: "TEMPERATURE \u2191 + VIBRANCE \u2193", r: -0.31 },
  ],
};

export function DNAView() {
  const [profile, setProfile] = useState<DNAProfile | null>(null);

  const loadProfile = useCallback(async () => {
    const sophie = (window as Window & { sophie?: { invoke: (c: string) => Promise<unknown> } })
      .sophie;
    if (sophie?.invoke) {
      try {
        const data = await sophie.invoke("profile:get");
        if (data && typeof data === "object") {
          const p = data as Partial<DNAProfile>;
          if (p.signatureMoves || p.scenarios || p.correlations) {
            setProfile({
              totalPhotos: p.totalPhotos ?? MOCK_PROFILE.totalPhotos,
              scenarioCount: p.scenarioCount ?? MOCK_PROFILE.scenarioCount,
              signatureMoves: p.signatureMoves ?? MOCK_PROFILE.signatureMoves,
              scenarios: p.scenarios ?? MOCK_PROFILE.scenarios,
              correlations: p.correlations ?? MOCK_PROFILE.correlations,
            });
            return;
          }
        }
      } catch {
        // Fall through to mock
      }
    }
    setProfile(MOCK_PROFILE);
  }, []);

  useEffect(() => {
    void loadProfile();
  }, [loadProfile]);

  const data = profile ?? MOCK_PROFILE;

  const handleExport = () => {
    // Placeholder for export action
  };

  const subText = `${data.totalPhotos.toLocaleString()} PHOTOS ANALYZED · ${data.scenarioCount} SCENARIOS`;

  return (
    <div style={styles.container}>
      <SectionTitle size="screen" sub={subText}>
        YOUR EDITING DNA
      </SectionTitle>
      <Rule spacing="md" />

      <SignatureMoves moves={data.signatureMoves} />
      <Rule spacing="md" />

      {data.scenarios.map((scenario, i) => (
        <div key={i}>
          <ScenarioProfile
            name={scenario.name}
            sampleCount={scenario.sampleCount}
            adjustments={scenario.adjustments}
          />
          <Rule spacing="md" />
        </div>
      ))}

      <CorrelationView correlations={data.correlations} />
      <Rule spacing="md" />

      <div style={styles.exportWrap}>
        <button type="button" style={styles.exportBtn} onClick={handleExport}>
          EXPORT REPORT
        </button>
      </div>
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  container: {
    display: "flex",
    flexDirection: "column",
    gap: "var(--space-4)",
    paddingBottom: "var(--space-5)",
    overflowY: "auto",
  },
  exportWrap: {
    display: "flex",
    justifyContent: "flex-start",
    marginTop: "var(--space-2)",
  },
  exportBtn: {
    fontFamily: "var(--font-mono)",
    fontSize: 11,
    textTransform: "uppercase" as const,
    letterSpacing: 2,
    padding: "var(--space-2) var(--space-4)",
    background: "var(--accent)",
    border: "1px solid var(--accent)",
    color: "#0d0d0d",
    cursor: "pointer",
    fontWeight: 500,
  },
};
