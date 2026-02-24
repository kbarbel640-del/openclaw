/**
 * Bridge between the Electron main process and Sophie's backend engine.
 * Currently provides mock data for UI development.
 * Will be wired to src/thelab/ modules for production.
 */

export interface SophieMessageResponse {
  id: string;
  type: "sophie" | "progress" | "flag" | "question";
  content: string;
  timestamp: string;
  data?: Record<string, unknown>;
}

export interface SophieState {
  status: "idle" | "editing" | "learning" | "paused" | "waiting" | "complete";
  sessionProgress?: {
    current: number;
    total: number;
    flagged: number;
    eta: string;
    scenario?: string;
    confidence?: number;
  };
  learningStatus?: {
    catalogPath: string;
    lastIngested: string;
    photosAnalyzed: number;
    scenarioCount: number;
    observing: boolean;
  };
}

export interface ScenarioEntry {
  name: string;
  sampleCount: number;
  confidence: "high" | "good" | "moderate" | "low";
}

export interface ProfileData {
  totalPhotos: number;
  scenarioCount: number;
  scenarios: ScenarioEntry[];
  signatureMoves: Array<{ slider: string; description: string }>;
  correlations: Array<{ pair: string; r: number }>;
  scenarioProfiles: Array<{
    name: string;
    sampleCount: number;
    adjustments: Array<{ slider: string; median: number; deviation: number }>;
  }>;
}

export interface SessionRecord {
  id: string;
  name: string;
  date: string;
  edited: number;
  flagged: number;
  duration: string;
}

const MOCK_SCENARIOS: ScenarioEntry[] = [
  { name: "GOLDEN_HOUR::OUTDOOR::PORTRAIT", sampleCount: 47, confidence: "high" },
  { name: "INDOOR::FLASH::RECEPTION", sampleCount: 31, confidence: "good" },
  { name: "CEREMONY::INDOOR::NATURAL", sampleCount: 12, confidence: "moderate" },
  { name: "NIGHT::OUTDOOR::MIXED::COUPLE", sampleCount: 8, confidence: "moderate" },
  { name: "BLUE_HOUR::OUTDOOR::NATURAL::LANDSCAPE", sampleCount: 4, confidence: "low" },
  { name: "OVERCAST::OUTDOOR::GROUP", sampleCount: 22, confidence: "good" },
];

let currentState: SophieState = {
  status: "idle",
  learningStatus: {
    catalogPath: "~/Pictures/Lightroom/MyCatalog.lrcat",
    lastIngested: "2026-02-18T15:42:00",
    photosAnalyzed: 12847,
    scenarioCount: MOCK_SCENARIOS.length,
    observing: false,
  },
};

export async function handleSophieMessage(text: string): Promise<SophieMessageResponse> {
  const lower = text.toLowerCase();

  if (lower.includes("edit") || lower.includes("start")) {
    currentState.status = "editing";
    currentState.sessionProgress = {
      current: 0,
      total: 1412,
      flagged: 0,
      eta: "~1H 45M",
      scenario: "GOLDEN_HOUR::OUTDOOR::PORTRAIT",
      confidence: 0.92,
    };
    return {
      id: crypto.randomUUID(),
      type: "sophie",
      content:
        "Got it. 1,412 images queued. Starting with golden hour portraits — that's where your profile is strongest. I'll flag anything below 0.7 confidence.",
      timestamp: new Date().toISOString(),
      data: { sessionStarted: true },
    };
  }

  if (lower.includes("status") || lower.includes("how")) {
    return {
      id: crypto.randomUUID(),
      type: "sophie",
      content: `STATUS: ${currentState.status.toUpperCase()}. ${currentState.learningStatus?.photosAnalyzed ?? 0} photos analyzed across ${currentState.learningStatus?.scenarioCount ?? 0} scenarios.`,
      timestamp: new Date().toISOString(),
    };
  }

  return {
    id: crypto.randomUUID(),
    type: "sophie",
    content: `Understood. Processing: "${text}"`,
    timestamp: new Date().toISOString(),
  };
}

export async function getSophieState(): Promise<SophieState> {
  return { ...currentState };
}

export async function getProfileData(): Promise<ProfileData> {
  return {
    totalPhotos: 12847,
    scenarioCount: MOCK_SCENARIOS.length,
    scenarios: MOCK_SCENARIOS,
    signatureMoves: [
      { slider: "SHADOWS", description: "+35 avg across all scenarios" },
      { slider: "TEMPERATURE", description: "+280K avg warmth bias" },
      { slider: "GRAIN", description: "12-18 subtle texture always" },
      { slider: "GREEN SAT", description: "-8 avg desaturation" },
    ],
    correlations: [
      { pair: "SHADOWS ↑ + HIGHLIGHTS ↓", r: -0.82 },
      { pair: "SHADOWS ↑ + CLARITY ↑", r: 0.45 },
      { pair: "TEMPERATURE ↑ + VIBRANCE ↓", r: -0.31 },
    ],
    scenarioProfiles: [
      {
        name: "GOLDEN_HOUR::OUTDOOR::PORTRAIT",
        sampleCount: 47,
        adjustments: [
          { slider: "EXPOSURE", median: 0.35, deviation: 0.12 },
          { slider: "TEMPERATURE", median: 300, deviation: 45 },
          { slider: "SHADOWS", median: 38, deviation: 8 },
          { slider: "HIGHLIGHTS", median: -25, deviation: 10 },
          { slider: "VIBRANCE", median: 12, deviation: 5 },
          { slider: "GRAIN AMT", median: 15, deviation: 3 },
        ],
      },
      {
        name: "INDOOR::FLASH::RECEPTION",
        sampleCount: 31,
        adjustments: [
          { slider: "EXPOSURE", median: 0.15, deviation: 0.2 },
          { slider: "TEMPERATURE", median: -200, deviation: 80 },
          { slider: "SHADOWS", median: 25, deviation: 12 },
          { slider: "HIGHLIGHTS", median: -35, deviation: 15 },
          { slider: "VIBRANCE", median: 8, deviation: 6 },
        ],
      },
    ],
  };
}

export async function getSessionHistory(): Promise<SessionRecord[]> {
  return [
    {
      id: "s-001",
      name: "Tina & Jared Wedding",
      date: "2026-02-18",
      edited: 1412,
      flagged: 23,
      duration: "1H 42M",
    },
    {
      id: "s-002",
      name: "Johnson Family Portraits",
      date: "2026-02-15",
      edited: 342,
      flagged: 8,
      duration: "28M",
    },
    {
      id: "s-003",
      name: "Marcus Studio Headshots",
      date: "2026-02-12",
      edited: 156,
      flagged: 3,
      duration: "14M",
    },
  ];
}
