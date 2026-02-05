import type { GraspDimensionResult, GraspFinding, GraspRiskLevel, GraspSummary } from "./types.js";

export function levelFromScore(score: number): GraspRiskLevel {
  if (score <= 25) {
    return "low";
  }
  if (score <= 50) {
    return "medium";
  }
  if (score <= 75) {
    return "high";
  }
  return "critical";
}

export function aggregateScores(scores: number[]): number {
  if (scores.length === 0) {
    return 0;
  }
  // Use weighted average with emphasis on higher scores
  const sorted = scores.toSorted((a, b) => b - a);
  let total = 0;
  let weight = 0;
  for (let i = 0; i < sorted.length; i++) {
    const w = sorted.length - i;
    total += sorted[i] * w;
    weight += w;
  }
  return Math.round(total / weight);
}

export function countBySeverity(findings: GraspFinding[]): GraspSummary {
  let critical = 0;
  let warn = 0;
  let info = 0;
  for (const f of findings) {
    if (f.severity === "critical") {
      critical++;
    } else if (f.severity === "warn") {
      warn++;
    } else {
      info++;
    }
  }
  return { critical, warn, info };
}

export function generateAgentSummary(dimensions: GraspDimensionResult[]): string {
  const highRisk = dimensions.filter((d) => d.level === "high" || d.level === "critical");
  if (highRisk.length === 0) {
    return "Agent has a low risk profile across all dimensions.";
  }
  const labels = highRisk.map((d) => d.label).join(", ");
  return `Elevated risk in: ${labels}`;
}
