import type { CoverageCoherenceReport } from "./coverage-report.js";

export function renderCoverageCoherenceMarkdown(report: CoverageCoherenceReport): string {
  const lines: string[] = [];

  lines.push("# Validation A — Coverage + Coherence");
  lines.push("## Sophie / The Lab — Department of Vibe");
  lines.push("");
  lines.push(`Generated at: ${report.generatedAt}`);
  lines.push("");
  lines.push("### Totals");
  lines.push(`- Total edits analyzed: ${report.totals.totalEdits}`);
  lines.push(`- Scenarios: ${report.totals.scenarioCount}`);
  lines.push(`- HIGH confidence: ${report.totals.highConfidenceScenarioCount}`);
  lines.push("");
  lines.push("### Scenarios");
  lines.push("");

  for (const s of report.scenarios) {
    lines.push(`#### ${s.label}`);
    lines.push(`- Key: ${s.key}`);
    lines.push(`- Samples: ${s.sampleCount}`);
    lines.push(`- Confidence: ${s.confidence.toUpperCase()}`);

    if (s.varianceWarnings.length > 0) {
      lines.push(`- Variance warnings:`);
      for (const w of s.varianceWarnings.slice(0, 5)) {
        lines.push(`  - ${w}`);
      }
    }

    if (s.topCorrelations.length > 0) {
      lines.push(`- Top correlations:`);
      for (const c of s.topCorrelations.slice(0, 5)) {
        lines.push(
          `  - ${c.controlA} vs ${c.controlB}: r=${c.correlation.toFixed(2)} (n=${c.sampleCount})`,
        );
      }
    }

    lines.push("");
  }

  return lines.join("\n").trimEnd() + "\n";
}

export function renderAccuracySheetHtml(input: {
  generatedAt: string;
  totalEdits: number;
  scenarioCount: number;
  highConfidenceScenarioCount: number;
  note?: string;
}): string {
  const note = input.note ?? "Coverage + coherence only";

  // Keep this intentionally simple. It's a canvas artifact, not a UI framework.
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <style>
    * { box-sizing: border-box; }
    body {
      margin: 0;
      padding: 24px;
      background: #0D0D0D;
      color: #F2EDE6;
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
    }
    .title {
      font-size: 10px;
      letter-spacing: 3px;
      text-transform: uppercase;
      color: #8A8078;
      margin-bottom: 10px;
    }
    .box {
      border: 1px solid #2A2A2A;
      padding: 16px;
    }
    .row {
      display: grid;
      grid-template-columns: 140px 1fr;
      gap: 10px;
      padding: 6px 0;
      border-bottom: 1px solid #222;
    }
    .row:last-child { border-bottom: 0; }
    .k {
      font-size: 10px;
      letter-spacing: 2px;
      text-transform: uppercase;
      color: #8A8078;
    }
    .v {
      font-size: 18px;
      font-weight: 700;
      text-align: right;
    }
    .note {
      margin-top: 14px;
      font-size: 11px;
      color: #8A8078;
    }
  </style>
</head>
<body>
  <div class="title">Sophie — Accuracy Sheet</div>
  <div class="box">
    <div class="row">
      <div class="k">Generated</div>
      <div class="v">${escapeHtml(input.generatedAt)}</div>
    </div>
    <div class="row">
      <div class="k">Total edits</div>
      <div class="v">${input.totalEdits}</div>
    </div>
    <div class="row">
      <div class="k">Scenarios</div>
      <div class="v">${input.scenarioCount}</div>
    </div>
    <div class="row">
      <div class="k">High conf</div>
      <div class="v">${input.highConfidenceScenarioCount}</div>
    </div>
  </div>
  <div class="note">${escapeHtml(note)}</div>
</body>
</html>`;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
