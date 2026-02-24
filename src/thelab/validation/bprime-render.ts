export function renderBPrimeMarkdown(input: {
  generatedAt: string;
  summary: {
    total: number;
    passed: number;
    failed: number;
    passRate: number;
    passThreshold: number;
  };
  outliers: Array<{ imageId: string; sliderMatch: number; reason: string }>;
}): string {
  const lines: string[] = [];
  const passPct = Math.round(input.summary.passRate * 1000) / 10;

  lines.push("# Validation B’ — Vision Prediction vs Ground Truth");
  lines.push("## Sophie / The Lab — Department of Vibe");
  lines.push("");
  lines.push(`Generated at: ${input.generatedAt}`);
  lines.push("");
  lines.push("### Headline");
  lines.push("");
  lines.push(`PASS_RATE: ${input.summary.passed}/${input.summary.total} (${passPct}%)`);
  lines.push(`THRESHOLD: SLIDER_MATCH >= ${input.summary.passThreshold}`);
  lines.push("");
  lines.push("### Outliers (Needs Review)");
  lines.push("");

  if (input.outliers.length === 0) {
    lines.push("- None");
  } else {
    for (const o of input.outliers.slice(0, 10)) {
      lines.push(`- ${o.imageId} — SLIDER_MATCH ${o.sliderMatch.toFixed(2)} — ${o.reason}`);
    }
  }

  lines.push("");
  return lines.join("\n").trimEnd() + "\n";
}
