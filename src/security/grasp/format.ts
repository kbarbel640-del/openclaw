import { isRich, theme } from "../../terminal/theme.js";
import type {
  GraspAgentProfile,
  GraspDimensionResult,
  GraspFinding,
  GraspReport,
  GraspRiskLevel,
  GraspSummary,
} from "./types.js";

const BAR_WIDTH = 20;

const DIMENSION_LETTERS: Record<string, string> = {
  governance: "G",
  reach: "R",
  agency: "A",
  safeguards: "S",
  potential_damage: "P",
};

const DIMENSION_LABELS: Record<string, string> = {
  governance: "Governance",
  reach: "Reach",
  agency: "Agency",
  safeguards: "Safeguards",
  potential_damage: "Potential Dmg",
};

export type FormatOptions = {
  verbose?: boolean;
};

export function formatGraspReport(report: GraspReport, opts: FormatOptions = {}): string {
  const lines: string[] = [];
  const rich = isRich();

  // Header
  lines.push(rich ? theme.heading("OpenClaw GRASP Self-Assessment") : "OpenClaw GRASP Self-Assessment");
  lines.push("");
  lines.push(formatMuted(`Model: ${report.modelUsed}`));
  lines.push(formatMuted(`Analyzed: ${new Date(report.ts).toLocaleString()}`));
  if (report.cached) {
    lines.push(formatMuted("(cached result)"));
  }
  lines.push("");

  // Global findings summary (if any)
  if (report.globalFindings.length > 0) {
    lines.push(formatHeading("Global (gateway, channels)"));
    lines.push(formatBoxTop());
    for (const finding of report.globalFindings.slice(0, 3)) {
      lines.push(formatFindingLine(finding));
    }
    if (report.globalFindings.length > 3) {
      lines.push(formatMuted(`  ... and ${report.globalFindings.length - 3} more`));
    }
    lines.push(formatBoxBottom());
    lines.push("");
  }

  // Per-agent profiles
  for (const agent of report.agents) {
    lines.push(formatAgentProfile(agent, opts));
    lines.push("");
  }

  // Overall summary
  lines.push(formatHeading(`Overall Risk: ${formatRiskLevel(report.overallLevel)} (${report.overallScore})`));
  lines.push(formatSummary(report.summary));
  lines.push("");
  if (!opts.verbose) {
    lines.push(formatMuted("Run: openclaw security grasp --verbose  for AI reasoning"));
  }

  return lines.join("\n");
}

function formatAgentProfile(agent: GraspAgentProfile, opts: FormatOptions): string {
  const lines: string[] = [];
  const label = agent.isDefault ? `${agent.agentId} (default)` : agent.agentId;

  lines.push(formatBoxTop());
  lines.push(formatBoxLine(`Agent: ${label}`));
  lines.push(formatBoxSeparator());

  for (const dim of agent.dimensions) {
    lines.push(formatDimensionBar(dim));
  }

  lines.push(formatBoxLine(""));
  lines.push(formatBoxLine(`Risk: ${formatRiskLevel(agent.overallLevel)} (${agent.overallScore})`));
  lines.push(formatBoxBottom());

  // Verbose: show reasoning and findings
  if (opts.verbose) {
    for (const dim of agent.dimensions) {
      lines.push("");
      lines.push(formatHeading(`${DIMENSION_LETTERS[dim.dimension]}  ${dim.label} Analysis:`));
      lines.push(formatMuted(`   Explored: ${dim.exploredPaths.slice(0, 3).join(", ") || "none"}`));
      lines.push("");
      lines.push(`   Reasoning: ${wrapText(dim.reasoning, 70, "   ")}`);
      lines.push("");
      if (dim.findings.length > 0) {
        lines.push("   Findings:");
        for (const finding of dim.findings) {
          lines.push(formatFindingDetail(finding));
        }
      }
    }
  }

  return lines.join("\n");
}

function formatDimensionBar(dim: GraspDimensionResult): string {
  const letter = DIMENSION_LETTERS[dim.dimension] || "?";
  const label = (DIMENSION_LABELS[dim.dimension] || dim.label).padEnd(14);
  const bar = renderBar(dim.score);
  const score = String(dim.score).padStart(3);
  const level = formatRiskLevel(dim.level);

  return formatBoxLine(`  ${letter}  ${label} ${bar}  ${score}  ${level}`);
}

function renderBar(score: number): string {
  const rich = isRich();
  const filled = Math.round((score / 100) * BAR_WIDTH);
  const empty = BAR_WIDTH - filled;

  const filledChar = rich ? "\u2588" : "#";
  const emptyChar = rich ? "\u2591" : "-";

  const bar = filledChar.repeat(filled) + emptyChar.repeat(empty);
  return `[${bar}]`;
}

function formatRiskLevel(level: GraspRiskLevel): string {
  const rich = isRich();
  const label = level.toUpperCase();

  if (!rich) {
    return label;
  }

  switch (level) {
    case "low":
      return theme.success(label);
    case "medium":
      return theme.warn(label);
    case "high":
      return theme.error(label);
    case "critical":
      return theme.error(label);
    default:
      return label;
  }
}

function formatSummary(summary: GraspSummary): string {
  const rich = isRich();
  const parts: string[] = [];

  if (summary.critical > 0) {
    parts.push(rich ? theme.error(`${summary.critical} critical`) : `${summary.critical} critical`);
  }
  if (summary.warn > 0) {
    parts.push(rich ? theme.warn(`${summary.warn} warn`) : `${summary.warn} warn`);
  }
  if (summary.info > 0) {
    parts.push(rich ? theme.muted(`${summary.info} info`) : `${summary.info} info`);
  }

  return `Summary: ${parts.join(" · ") || "no findings"}`;
}

function formatFindingLine(finding: GraspFinding): string {
  const sev = formatSeverityBadge(finding.severity);
  return `  ${sev} ${finding.title}`;
}

function formatFindingDetail(finding: GraspFinding): string {
  const sev = formatSeverityBadge(finding.severity);
  const lines = [
    `   - ${sev} ${finding.title}`,
    `     ${formatMuted(finding.detail)}`,
  ];
  if (finding.remediation) {
    lines.push(`     ${formatMuted(`Fix: ${finding.remediation}`)}`);
  }
  return lines.join("\n");
}

function formatSeverityBadge(sev: "info" | "warn" | "critical"): string {
  const rich = isRich();
  switch (sev) {
    case "critical":
      return rich ? theme.error("[CRITICAL]") : "[CRITICAL]";
    case "warn":
      return rich ? theme.warn("[WARN]") : "[WARN]";
    default:
      return rich ? theme.muted("[INFO]") : "[INFO]";
  }
}

function formatHeading(text: string): string {
  return isRich() ? theme.heading(text) : text;
}

function formatMuted(text: string): string {
  return isRich() ? theme.muted(text) : text;
}

function formatBoxTop(): string {
  return "\u250C" + "\u2500".repeat(65) + "\u2510";
}

function formatBoxBottom(): string {
  return "\u2514" + "\u2500".repeat(65) + "\u2518";
}

function formatBoxSeparator(): string {
  return "\u251C" + "\u2500".repeat(65) + "\u2524";
}

function formatBoxLine(content: string): string {
  const padded = content.padEnd(65);
  return "\u2502" + padded + "\u2502";
}

function wrapText(text: string, width: number, indent: string): string {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    if (current.length + word.length + 1 > width) {
      lines.push(current);
      current = word;
    } else {
      current = current ? `${current} ${word}` : word;
    }
  }
  if (current) {
    lines.push(current);
  }

  return lines.map((l, i) => (i === 0 ? l : indent + l)).join("\n");
}
