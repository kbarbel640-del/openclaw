import { useState, useEffect } from "react";
import type { CSSProperties } from "react";
import { HeroStat } from "../shared/HeroStat";
import { Rule } from "../shared/Rule";
import { SectionTitle } from "../shared/SectionTitle";
import { SpecRow } from "../shared/SpecRow";
import { ActivityTimeline } from "./ActivityTimeline";
import { ScenarioCoverage } from "./ScenarioCoverage";

interface ProfileData {
  catalog?: string;
  ingested?: string;
  analyzed?: number;
  scenarios?: number;
  scenarioList?: Array<{
    name: string;
    sampleCount: number;
    confidence: string;
    maxSamples: number;
  }>;
  activity?: Array<{ date: string; description: string }>;
}

const MOCK_PROFILE: ProfileData = {
  catalog: "~/Pictures/Lightroom/MyCatalog.lrcat",
  ingested: "2026-02-18T15:42:00",
  analyzed: 12847,
  scenarios: 24,
  scenarioList: [
    { name: "GOLDEN_HOUR::OUTDOOR::PORTRAIT", sampleCount: 47, confidence: "high", maxSamples: 50 },
    { name: "INDOOR::FLASH::RECEPTION", sampleCount: 31, confidence: "good", maxSamples: 50 },
    { name: "CEREMONY::INDOOR::NATURAL", sampleCount: 12, confidence: "moderate", maxSamples: 50 },
    {
      name: "NIGHT::OUTDOOR::MIXED::COUPLE",
      sampleCount: 8,
      confidence: "moderate",
      maxSamples: 50,
    },
    {
      name: "BLUE_HOUR::OUTDOOR::NATURAL::LANDSCAPE",
      sampleCount: 4,
      confidence: "low",
      maxSamples: 50,
    },
    { name: "OVERCAST::OUTDOOR::GROUP", sampleCount: 22, confidence: "good", maxSamples: 50 },
  ],
};

export function LearnView() {
  const [profile, setProfile] = useState<ProfileData>(MOCK_PROFILE);
  const [watchToggle, setWatchToggle] = useState(false);

  useEffect(() => {
    const api = (
      window as Window & { sophie?: { invoke: (ch: string, d?: unknown) => Promise<unknown> } }
    ).sophie;
    if (api?.invoke) {
      api
        .invoke("profile:get")
        .then((data) => {
          if (data && typeof data === "object") {
            setProfile((prev) => ({ ...prev, ...(data as Partial<ProfileData>) }));
          }
        })
        .catch(() => {});
    }
  }, []);

  const actions: CSSProperties = {
    display: "flex",
    gap: "var(--space-2)",
    marginTop: "var(--space-4)",
    marginBottom: "var(--space-4)",
  };

  return (
    <div style={{ overflow: "auto", height: "100%" }}>
      {/* Hero stats */}
      <div style={{ display: "flex", gap: "var(--space-6)", marginBottom: "var(--space-4)" }}>
        <HeroStat value={profile.analyzed?.toLocaleString() ?? "—"} label="PHOTOS ANALYZED" />
        <HeroStat value={String(profile.scenarios ?? "—")} label="SCENARIOS" />
      </div>

      {/* Learning Status */}
      <SectionTitle>LEARNING STATUS</SectionTitle>
      <SpecRow label="CATALOG" value={profile.catalog ?? "—"} />
      <SpecRow label="INGESTED" value={profile.ingested ?? "—"} />
      <div style={actions}>
        <button type="button">RE-INGEST</button>
        <button
          type="button"
          style={
            watchToggle
              ? {
                  background: "var(--accent)",
                  borderColor: "var(--accent)",
                  color: "var(--bg-primary)",
                }
              : undefined
          }
          onClick={() => setWatchToggle(!watchToggle)}
        >
          ● WATCH ME EDIT
        </button>
      </div>
      <Rule spacing="lg" />

      {/* Scenario Coverage */}
      <SectionTitle>SCENARIO COVERAGE</SectionTitle>
      {profile.scenarioList?.map((s, i) => (
        <ScenarioCoverage
          key={i}
          name={s.name}
          sampleCount={s.sampleCount}
          confidence={s.confidence as "high" | "good" | "moderate" | "low"}
          maxSamples={s.maxSamples}
        />
      ))}
      <Rule spacing="lg" />

      {/* Recent Activity */}
      <SectionTitle>RECENT ACTIVITY</SectionTitle>
      <ActivityTimeline entries={profile.activity} />
    </div>
  );
}
