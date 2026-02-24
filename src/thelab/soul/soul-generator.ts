/**
 * Soul Generator
 *
 * Generates a SOUL.md for a photographer based on their StyleDatabase data.
 * The Soul is a living document that captures the photographer's editing
 * personality in natural language — their philosophy, non-negotiables,
 * tendencies, scenario-specific shifts, and confidence gaps.
 *
 * The Soul serves two purposes:
 *   1. Injected into the VLM's system prompt during Step 4 (REASON) so Sophie
 *      edits with qualitative understanding, not just statistical profiles.
 *   2. Shown to the photographer as "Here's what I've learned about your style."
 *
 * @equity-partner Qwen3-VL (Alibaba) — optional VLM pass for qualitative analysis
 */

import type { StyleDatabase, ScenarioProfile } from "../learning/style-db.js";

/**
 * Configuration for Soul generation.
 */
export interface SoulGeneratorConfig {
  /** Minimum total edits before generating a Soul. */
  minEditsForSoul: number;
  /** Minimum per-scenario samples before including in Soul. */
  minSamplesPerScenario: number;
  /** Photographer display name (for header). */
  photographerName?: string;
}

const DEFAULT_SOUL_CONFIG: SoulGeneratorConfig = {
  minEditsForSoul: 20,
  minSamplesPerScenario: 3,
};

/**
 * Structured Soul data extracted from the StyleDatabase.
 * This is the intermediate representation before rendering to markdown.
 */
export interface SoulData {
  /** Photographer identifier. */
  photographerName: string;
  /** ISO 8601 generation timestamp. */
  generatedAt: string;
  /** Total edits analyzed. */
  totalEdits: number;
  /** Number of distinct scenarios. */
  scenarioCount: number;
  /** Global tendencies (consistent across all scenarios). */
  philosophy: SoulPhilosophy;
  /** Things the photographer always does, regardless of scenario. */
  nonNegotiables: SoulNonNegotiable[];
  /** Per-control tendencies with narrative descriptions. */
  tendencies: SoulTendency[];
  /** How the photographer shifts style between scenarios. */
  scenarioShifts: SoulScenarioShift[];
  /** Where the profile is thin or inconsistent. */
  confidenceGaps: SoulConfidenceGap[];
  /** Strong slider correlations (signature pairs). */
  signaturePairs: SoulSignaturePair[];
}

export interface SoulPhilosophy {
  /** One-line summary of overall approach. */
  summary: string;
  /** Key descriptors: "warm", "moody", "clean", "film-like", etc. */
  descriptors: string[];
}

export interface SoulNonNegotiable {
  control: string;
  direction: "always_positive" | "always_negative";
  strength: "subtle" | "moderate" | "strong";
  narrative: string;
}

export interface SoulTendency {
  control: string;
  globalMedian: number;
  consistency: "very_consistent" | "consistent" | "moderate" | "varies";
  narrative: string;
}

export interface SoulScenarioShift {
  fromScenario: string;
  toScenario: string;
  changes: Array<{ control: string; delta: number; narrative: string }>;
}

export interface SoulConfidenceGap {
  scenario: string;
  reason: "few_samples" | "high_variance" | "conflicting_edits";
  sampleCount: number;
  narrative: string;
}

export interface SoulSignaturePair {
  controlA: string;
  controlB: string;
  correlation: number;
  narrative: string;
}

/**
 * Generate Soul data from a StyleDatabase.
 * Pure data extraction — no markdown rendering.
 */
export function generateSoulData(
  styleDb: StyleDatabase,
  config: Partial<SoulGeneratorConfig> = {},
): SoulData | null {
  const cfg = { ...DEFAULT_SOUL_CONFIG, ...config };

  const totalEdits = styleDb.getEditCount();
  if (totalEdits < cfg.minEditsForSoul) {
    return null;
  }

  const scenarios = styleDb.listScenarios();
  const profiles: Array<{ key: string; label: string; profile: ScenarioProfile }> = [];

  for (const s of scenarios) {
    if (s.sampleCount < cfg.minSamplesPerScenario) {
      continue;
    }
    const profile = styleDb.getProfile(s.key);
    if (profile) {
      profiles.push({ key: s.key, label: s.label, profile });
    }
  }

  if (profiles.length === 0) {
    return null;
  }

  // Compute global stats (weighted across all scenarios)
  const globalStats = computeGlobalStats(profiles);
  const philosophy = derivePhilosophy(globalStats);
  const nonNegotiables = deriveNonNegotiables(globalStats, profiles);
  const tendencies = deriveTendencies(globalStats);
  const scenarioShifts = deriveScenarioShifts(profiles);
  const confidenceGaps = deriveConfidenceGaps(scenarios, profiles, cfg);
  const signaturePairs = deriveSignaturePairs(profiles);

  return {
    photographerName: cfg.photographerName ?? "Photographer",
    generatedAt: new Date().toISOString(),
    totalEdits,
    scenarioCount: profiles.length,
    philosophy,
    nonNegotiables,
    tendencies,
    scenarioShifts,
    confidenceGaps,
    signaturePairs,
  };
}

/**
 * Render SoulData to a SOUL.md markdown string.
 */
export function renderSoulMarkdown(soul: SoulData): string {
  const lines: string[] = [];

  // Header
  lines.push(`# ${soul.photographerName}'s Editing Soul`);
  lines.push(`*Generated by Sophie — Department of Vibe*`);
  lines.push(`*${soul.totalEdits} edits analyzed across ${soul.scenarioCount} scenarios*`);
  lines.push(`*Last generated: ${new Date(soul.generatedAt).toLocaleDateString()}*`);
  lines.push("");

  // Philosophy
  lines.push("## Philosophy");
  lines.push("");
  lines.push(soul.philosophy.summary);
  if (soul.philosophy.descriptors.length > 0) {
    lines.push("");
    lines.push(`**Style keywords:** ${soul.philosophy.descriptors.join(", ")}`);
  }
  lines.push("");

  // Non-Negotiables
  if (soul.nonNegotiables.length > 0) {
    lines.push("## Non-Negotiables");
    lines.push("");
    lines.push("These are consistent across every scenario — the photographer's bedrock:");
    lines.push("");
    for (const nn of soul.nonNegotiables) {
      lines.push(`- **${nn.control}**: ${nn.narrative}`);
    }
    lines.push("");
  }

  // Tendencies
  if (soul.tendencies.length > 0) {
    lines.push("## Tendencies");
    lines.push("");
    for (const t of soul.tendencies) {
      const sign = t.globalMedian > 0 ? "+" : "";
      lines.push(
        `- **${t.control}** (${sign}${t.globalMedian.toFixed(1)}, ${t.consistency.replace(/_/g, " ")}): ${t.narrative}`,
      );
    }
    lines.push("");
  }

  // Scenario Shifts
  if (soul.scenarioShifts.length > 0) {
    lines.push("## Scenario Shifts");
    lines.push("");
    lines.push("How style changes between different types of photos:");
    lines.push("");
    for (const shift of soul.scenarioShifts) {
      lines.push(`### ${shift.fromScenario} → ${shift.toScenario}`);
      for (const change of shift.changes) {
        lines.push(`- ${change.narrative}`);
      }
      lines.push("");
    }
  }

  // Signature Pairs
  if (soul.signaturePairs.length > 0) {
    lines.push("## Signature Pairs");
    lines.push("");
    lines.push("Sliders that move together — revealing the photographer's workflow patterns:");
    lines.push("");
    for (const pair of soul.signaturePairs) {
      lines.push(`- ${pair.narrative}`);
    }
    lines.push("");
  }

  // Confidence Gaps
  if (soul.confidenceGaps.length > 0) {
    lines.push("## Confidence Gaps");
    lines.push("");
    lines.push("Areas where Sophie needs more data or the photographer's style is ambiguous:");
    lines.push("");
    for (const gap of soul.confidenceGaps) {
      lines.push(`- **${gap.scenario}**: ${gap.narrative}`);
    }
    lines.push("");
  }

  lines.push("---");
  lines.push(
    "*This Soul is a living document. It updates as Sophie learns more about your editing style.*",
  );

  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Internal: Statistical Analysis
// ---------------------------------------------------------------------------

interface GlobalControlStats {
  control: string;
  weightedMedian: number;
  totalSamples: number;
  /** Whether the sign is consistent across all scenarios */
  signConsistent: boolean;
  /** Coefficient of variation across scenarios */
  crossScenarioVariance: number;
  /** Per-scenario medians for computing shifts */
  scenarioMedians: Map<string, number>;
}

function computeGlobalStats(
  profiles: Array<{ key: string; label: string; profile: ScenarioProfile }>,
): Map<string, GlobalControlStats> {
  const controlMap = new Map<
    string,
    {
      weightedSum: number;
      totalWeight: number;
      signs: Set<string>;
      scenarioMedians: Map<string, number>;
      scenarioValues: number[];
    }
  >();

  for (const { key, profile } of profiles) {
    for (const [control, stats] of Object.entries(profile.adjustments)) {
      let entry = controlMap.get(control);
      if (!entry) {
        entry = {
          weightedSum: 0,
          totalWeight: 0,
          signs: new Set(),
          scenarioMedians: new Map(),
          scenarioValues: [],
        };
        controlMap.set(control, entry);
      }

      entry.weightedSum += stats.median * stats.sampleCount;
      entry.totalWeight += stats.sampleCount;
      entry.signs.add(stats.median > 0.5 ? "+" : stats.median < -0.5 ? "-" : "0");
      entry.scenarioMedians.set(key, stats.median);
      entry.scenarioValues.push(stats.median);
    }
  }

  const result = new Map<string, GlobalControlStats>();
  for (const [control, entry] of controlMap) {
    const weightedMedian = entry.totalWeight > 0 ? entry.weightedSum / entry.totalWeight : 0;
    const nonZeroSigns = new Set([...entry.signs].filter((s) => s !== "0"));
    const signConsistent = nonZeroSigns.size <= 1 && nonZeroSigns.size > 0;

    // Cross-scenario variance
    const mean = entry.scenarioValues.reduce((a, b) => a + b, 0) / entry.scenarioValues.length;
    const variance =
      entry.scenarioValues.reduce((sum, v) => sum + (v - mean) ** 2, 0) /
      entry.scenarioValues.length;

    result.set(control, {
      control,
      weightedMedian,
      totalSamples: entry.totalWeight,
      signConsistent,
      crossScenarioVariance: Math.sqrt(variance),
      scenarioMedians: entry.scenarioMedians,
    });
  }

  return result;
}

function derivePhilosophy(globalStats: Map<string, GlobalControlStats>): SoulPhilosophy {
  const descriptors: string[] = [];
  const sorted = [...globalStats.values()]
    .filter((s) => Math.abs(s.weightedMedian) > 1)
    .toSorted((a, b) => Math.abs(b.weightedMedian) - Math.abs(a.weightedMedian));

  // Derive style descriptors from the dominant adjustments
  for (const s of sorted.slice(0, 6)) {
    const d = controlToDescriptor(s.control, s.weightedMedian);
    if (d) {
      descriptors.push(d);
    }
  }

  // Build a summary sentence
  const summaryParts: string[] = [];
  const warmCool = globalStats.get("temp");
  if (warmCool && Math.abs(warmCool.weightedMedian) > 100) {
    summaryParts.push(warmCool.weightedMedian > 0 ? "warm-toned" : "cool-toned");
  }

  const shadows = globalStats.get("shadows");
  const blacks = globalStats.get("blacks");
  if (shadows && shadows.weightedMedian > 5) {
    summaryParts.push("lifted shadows");
  } else if (shadows && shadows.weightedMedian < -5) {
    summaryParts.push("crushed shadows");
  }
  if (blacks && blacks.weightedMedian < -5) {
    summaryParts.push("deep blacks");
  }

  const contrast = globalStats.get("contrast");
  const clarity = globalStats.get("clarity");
  if (contrast && contrast.weightedMedian > 5) {
    summaryParts.push("punchy contrast");
  } else if (contrast && contrast.weightedMedian < -5) {
    summaryParts.push("low contrast");
  }
  if (clarity && clarity.weightedMedian > 5) {
    summaryParts.push("crisp clarity");
  } else if (clarity && clarity.weightedMedian < -5) {
    summaryParts.push("soft clarity");
  }

  const grain = globalStats.get("grain_amount");
  if (grain && grain.weightedMedian > 5) {
    summaryParts.push("film grain");
  }

  const vignette = globalStats.get("vignette_amount");
  if (vignette && vignette.weightedMedian < -5) {
    summaryParts.push("vignette");
  }

  const sat = globalStats.get("saturation");
  const vib = globalStats.get("vibrance");
  if (sat && sat.weightedMedian < -10) {
    summaryParts.push("desaturated");
  } else if (vib && vib.weightedMedian > 10) {
    summaryParts.push("vibrant colors");
  }

  let summary: string;
  if (summaryParts.length >= 3) {
    summary = `This photographer's style emphasizes ${summaryParts.slice(0, -1).join(", ")}, and ${summaryParts[summaryParts.length - 1]}.`;
  } else if (summaryParts.length > 0) {
    summary = `This photographer's style leans toward ${summaryParts.join(" and ")}.`;
  } else {
    summary =
      "This photographer applies subtle, context-dependent adjustments — no single dominant style signature.";
  }

  return { summary, descriptors };
}

function controlToDescriptor(control: string, median: number): string | null {
  const map: Record<string, [string, string]> = {
    temp: ["cool", "warm"],
    shadows: ["crushed shadows", "lifted shadows"],
    highlights: ["pulled highlights", "bright highlights"],
    contrast: ["flat", "contrasty"],
    clarity: ["soft", "crisp"],
    vibrance: ["muted", "vibrant"],
    saturation: ["desaturated", "saturated"],
    exposure: ["underexposed", "bright"],
    dehaze: ["hazy", "clear"],
    grain_amount: ["clean", "grainy"],
    vignette_amount: ["open", "vignetted"],
    blacks: ["lifted blacks", "deep blacks"],
    whites: ["muted whites", "blown whites"],
    texture: ["smooth", "textured"],
  };

  const pair = map[control];
  if (!pair) {
    return null;
  }
  return median < -1 ? pair[0] : median > 1 ? pair[1] : null;
}

function deriveNonNegotiables(
  globalStats: Map<string, GlobalControlStats>,
  profiles: Array<{ key: string; label: string; profile: ScenarioProfile }>,
): SoulNonNegotiable[] {
  const result: SoulNonNegotiable[] = [];

  for (const [, stats] of globalStats) {
    // Must be sign-consistent across all scenarios and meaningfully non-zero
    if (!stats.signConsistent || Math.abs(stats.weightedMedian) < 2) {
      continue;
    }
    // Must appear in most scenarios
    if (stats.scenarioMedians.size < Math.max(2, profiles.length * 0.6)) {
      continue;
    }

    const direction =
      stats.weightedMedian > 0 ? ("always_positive" as const) : ("always_negative" as const);
    const magnitude = Math.abs(stats.weightedMedian);
    const strength =
      magnitude > 15
        ? ("strong" as const)
        : magnitude > 5
          ? ("moderate" as const)
          : ("subtle" as const);

    const narrative = buildNonNegotiableNarrative(stats.control, direction, strength, magnitude);
    result.push({ control: stats.control, direction, strength, narrative });
  }

  return result.toSorted((a, b) => {
    const order = { strong: 0, moderate: 1, subtle: 2 };
    return order[a.strength] - order[b.strength];
  });
}

function buildNonNegotiableNarrative(
  control: string,
  direction: "always_positive" | "always_negative",
  strength: "subtle" | "moderate" | "strong",
  magnitude: number,
): string {
  const label = control.replace(/_/g, " ");
  const dir = direction === "always_positive" ? "increases" : "decreases";
  const intensityWord =
    strength === "strong" ? "always" : strength === "moderate" ? "consistently" : "tends to";

  const special: Record<string, string> = {
    shadows:
      direction === "always_positive"
        ? `${intensityWord} lifts shadows (+${magnitude.toFixed(0)}) — never lets them go fully black`
        : `${intensityWord} crushes shadows (${magnitude.toFixed(0)}) — embraces deep darks`,
    temp:
      direction === "always_positive"
        ? `${intensityWord} warms white balance (+${magnitude.toFixed(0)}K) — warm tones are non-negotiable`
        : `${intensityWord} cools white balance (${magnitude.toFixed(0)}K) — cool tones are non-negotiable`,
    grain_amount: `${intensityWord} adds film grain (~${magnitude.toFixed(0)}) — grain is part of the aesthetic`,
    vignette_amount:
      direction === "always_negative"
        ? `${intensityWord} adds vignette — draws the eye inward`
        : `${intensityWord} removes default vignette — prefers edge-to-edge brightness`,
  };

  return special[control] ?? `${intensityWord} ${dir} ${label} by ~${magnitude.toFixed(1)}`;
}

function deriveTendencies(globalStats: Map<string, GlobalControlStats>): SoulTendency[] {
  return [...globalStats.values()]
    .filter((s) => Math.abs(s.weightedMedian) > 0.5)
    .toSorted((a, b) => Math.abs(b.weightedMedian) - Math.abs(a.weightedMedian))
    .slice(0, 12)
    .map((s) => {
      const cv =
        Math.abs(s.weightedMedian) > 0.1
          ? s.crossScenarioVariance / Math.abs(s.weightedMedian)
          : s.crossScenarioVariance;

      const consistency: SoulTendency["consistency"] =
        cv < 0.3 ? "very_consistent" : cv < 0.6 ? "consistent" : cv < 1.0 ? "moderate" : "varies";

      return {
        control: s.control,
        globalMedian: s.weightedMedian,
        consistency,
        narrative: buildTendencyNarrative(s.control, s.weightedMedian, consistency),
      };
    });
}

function buildTendencyNarrative(
  control: string,
  median: number,
  consistency: SoulTendency["consistency"],
): string {
  const label = control.replace(/_/g, " ");
  const sign = median > 0 ? "+" : "";
  const consistencyText =
    consistency === "very_consistent"
      ? "rock-solid"
      : consistency === "consistent"
        ? "reliable"
        : consistency === "moderate"
          ? "situational"
          : "highly variable";

  return `${consistencyText} — typically ${sign}${median.toFixed(1)} on ${label}`;
}

function deriveScenarioShifts(
  profiles: Array<{ key: string; label: string; profile: ScenarioProfile }>,
): SoulScenarioShift[] {
  if (profiles.length < 2) {
    return [];
  }

  const shifts: SoulScenarioShift[] = [];

  // Compare the top scenario pairs that differ most
  for (let i = 0; i < Math.min(profiles.length, 4); i++) {
    for (let j = i + 1; j < Math.min(profiles.length, 4); j++) {
      const a = profiles[i];
      const b = profiles[j];
      const changes = compareProfiles(a.profile, b.profile);
      if (changes.length > 0) {
        shifts.push({
          fromScenario: a.label,
          toScenario: b.label,
          changes: changes.slice(0, 4),
        });
      }
    }
  }

  return shifts.slice(0, 6);
}

function compareProfiles(
  a: ScenarioProfile,
  b: ScenarioProfile,
): Array<{ control: string; delta: number; narrative: string }> {
  const changes: Array<{ control: string; delta: number; narrative: string }> = [];
  const allControls = new Set([...Object.keys(a.adjustments), ...Object.keys(b.adjustments)]);

  for (const control of allControls) {
    const aMedian = a.adjustments[control]?.median ?? 0;
    const bMedian = b.adjustments[control]?.median ?? 0;
    const delta = bMedian - aMedian;

    if (Math.abs(delta) < 3) {
      continue;
    }

    const label = control.replace(/_/g, " ");
    const direction = delta > 0 ? "higher" : "lower";
    changes.push({
      control,
      delta,
      narrative: `${label} shifts ${direction} by ${Math.abs(delta).toFixed(1)}`,
    });
  }

  return changes.toSorted((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
}

function deriveConfidenceGaps(
  scenarios: Array<{ key: string; label: string; sampleCount: number }>,
  profiles: Array<{ key: string; label: string; profile: ScenarioProfile }>,
  config: SoulGeneratorConfig,
): SoulConfidenceGap[] {
  const gaps: SoulConfidenceGap[] = [];

  for (const s of scenarios) {
    if (s.sampleCount === 0) {
      continue;
    }

    // Few samples
    if (
      s.sampleCount < config.minSamplesPerScenario * 3 &&
      s.sampleCount >= config.minSamplesPerScenario
    ) {
      gaps.push({
        scenario: s.label,
        reason: "few_samples",
        sampleCount: s.sampleCount,
        narrative: `Only ${s.sampleCount} samples — Sophie will be cautious and may flag these for review`,
      });
      continue;
    }

    // High variance
    const profile = profiles.find((p) => p.key === s.key);
    if (profile) {
      const highVarianceControls = Object.entries(profile.profile.adjustments)
        .filter(
          ([, stats]) => stats.stdDev > Math.abs(stats.median) * 1.5 && stats.sampleCount >= 5,
        )
        .map(([ctrl]) => ctrl.replace(/_/g, " "));

      if (highVarianceControls.length >= 3) {
        gaps.push({
          scenario: s.label,
          reason: "high_variance",
          sampleCount: s.sampleCount,
          narrative: `High variance in ${highVarianceControls.slice(0, 3).join(", ")} — the photographer's approach varies significantly here`,
        });
      }
    }
  }

  return gaps;
}

function deriveSignaturePairs(
  profiles: Array<{ key: string; label: string; profile: ScenarioProfile }>,
): SoulSignaturePair[] {
  // Aggregate correlations across all scenarios
  const pairMap = new Map<
    string,
    { totalCorr: number; count: number; controlA: string; controlB: string }
  >();

  for (const { profile } of profiles) {
    for (const corr of profile.correlations) {
      const pairKey = `${corr.controlA}::${corr.controlB}`;
      const existing = pairMap.get(pairKey);
      if (existing) {
        existing.totalCorr += corr.correlation;
        existing.count++;
      } else {
        pairMap.set(pairKey, {
          totalCorr: corr.correlation,
          count: 1,
          controlA: corr.controlA,
          controlB: corr.controlB,
        });
      }
    }
  }

  return [...pairMap.values()]
    .filter((p) => p.count >= 2)
    .map((p) => {
      const avgCorr = p.totalCorr / p.count;
      return {
        controlA: p.controlA,
        controlB: p.controlB,
        correlation: avgCorr,
        narrative: buildCorrelationNarrative(p.controlA, p.controlB, avgCorr),
      };
    })
    .filter((p) => Math.abs(p.correlation) > 0.4)
    .toSorted((a, b) => Math.abs(b.correlation) - Math.abs(a.correlation))
    .slice(0, 8);
}

function buildCorrelationNarrative(controlA: string, controlB: string, corr: number): string {
  const a = controlA.replace(/_/g, " ");
  const b = controlB.replace(/_/g, " ");
  const strength = Math.abs(corr) > 0.7 ? "strongly" : "moderately";

  if (corr > 0) {
    return `**${a}** and **${b}** ${strength} move together (r=${corr.toFixed(2)}) — when one goes up, so does the other`;
  }
  return `**${a}** and **${b}** ${strength} oppose each other (r=${corr.toFixed(2)}) — when one increases, the other decreases`;
}
