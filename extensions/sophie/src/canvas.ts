/**
 * Sophie's Canvas Tools
 *
 * Uses OpenClaw's canvas system to display:
 * - Before/after editing comparisons
 * - Style DNA visualizations
 * - Editing progress dashboards
 * - Flagged image galleries
 */

import { Type } from "@sinclair/typebox";
import type { AnyAgentTool } from "../../../src/agents/tools/common.js";
import { jsonResult } from "../../../src/agents/tools/common.js";
import { getSophieSession } from "./session-bridge.js";

export function createSophieCanvasTools(): AnyAgentTool[] {
  return [createShowProgressTool(), createShowStyleDNATool()];
}

function createShowProgressTool(): AnyAgentTool {
  return {
    name: "sophie_show_progress",
    description:
      "Display the current editing session progress on canvas. " +
      "Shows total images, completed, remaining, and current image. " +
      "Renders an HTML progress dashboard.",
    parameters: Type.Object({}),
    async execute() {
      const state = getSophieSession();

      if (!state.editingSession) {
        return jsonResult({
          error: "No active editing session.",
          suggestion: "Start an editing session first.",
        });
      }

      const progress = state.editingSession.getProgress();
      const pct = progress.total > 0 ? Math.round((progress.completed / progress.total) * 100) : 0;

      const html = buildProgressHTML({
        total: progress.total,
        completed: progress.completed,
        remaining: progress.remaining,
        currentImage: progress.currentImage,
        percentage: pct,
      });

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({
              canvas_action: "present",
              html,
              width: 400,
              height: 300,
            }),
          },
        ],
      };
    },
  };
}

function createShowStyleDNATool(): AnyAgentTool {
  return {
    name: "sophie_show_dna",
    description:
      "Display the photographer's editing DNA on canvas. " +
      "Shows scenario distribution, confidence levels, and signature adjustments " +
      "as a visual dashboard.",
    parameters: Type.Object({
      db_path: Type.Optional(
        Type.String({
          description: "Path to the style database. Uses default if not provided.",
        }),
      ),
    }),
    async execute(_id, params: Record<string, unknown>) {
      const state = getSophieSession();
      const editCount = state.styleDb.getEditCount();
      const scenarios = state.styleDb.listScenarios();

      if (editCount === 0) {
        return jsonResult({
          error: "No editing data available.",
          suggestion: "Ingest a catalog first with sophie_ingest_catalog.",
        });
      }

      const html = buildDNADashboardHTML({
        editCount,
        scenarios: scenarios.map((s) => ({
          label: s.label,
          samples: s.sampleCount,
          confidence:
            s.sampleCount >= 20
              ? "HIGH"
              : s.sampleCount >= 10
                ? "GOOD"
                : s.sampleCount >= 3
                  ? "MOD"
                  : "LOW",
        })),
      });

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({
              canvas_action: "present",
              html,
              width: 600,
              height: 500,
            }),
          },
        ],
      };
    },
  };
}

interface ProgressData {
  total: number;
  completed: number;
  remaining: number;
  currentImage: string | null;
  percentage: number;
}

function buildProgressHTML(data: ProgressData): string {
  return `<!DOCTYPE html>
<html>
<head>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: 'JetBrains Mono', 'SF Mono', monospace;
    background: #1A1A1A;
    color: #F5F0E8;
    padding: 24px;
  }
  .header {
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 3px;
    color: #8A8A8A;
    margin-bottom: 16px;
  }
  .stat {
    font-size: 48px;
    font-weight: 700;
    line-height: 1;
    margin-bottom: 4px;
  }
  .label {
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 2px;
    color: #8A8A8A;
    margin-bottom: 24px;
  }
  .bar-container {
    width: 100%;
    height: 4px;
    background: #333;
    margin-bottom: 24px;
  }
  .bar-fill {
    height: 100%;
    background: #F5F0E8;
    transition: width 0.3s;
  }
  .grid {
    display: grid;
    grid-template-columns: 1fr 1fr 1fr;
    gap: 16px;
  }
  .grid-item .value {
    font-size: 24px;
    font-weight: 700;
  }
  .grid-item .key {
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 2px;
    color: #8A8A8A;
  }
  .current {
    margin-top: 24px;
    padding-top: 16px;
    border-top: 1px solid #333;
    font-size: 11px;
    color: #8A8A8A;
  }
  .current span { color: #F5F0E8; }
</style>
</head>
<body>
  <div class="header">Sophie — Editing Progress</div>
  <div class="stat">${data.percentage}%</div>
  <div class="label">Complete</div>
  <div class="bar-container">
    <div class="bar-fill" style="width: ${data.percentage}%"></div>
  </div>
  <div class="grid">
    <div class="grid-item">
      <div class="value">${data.completed}</div>
      <div class="key">Done</div>
    </div>
    <div class="grid-item">
      <div class="value">${data.remaining}</div>
      <div class="key">Remaining</div>
    </div>
    <div class="grid-item">
      <div class="value">${data.total}</div>
      <div class="key">Total</div>
    </div>
  </div>
  ${data.currentImage ? `<div class="current">Current: <span>${data.currentImage.split("/").pop()}</span></div>` : ""}
</body>
</html>`;
}

interface DNAData {
  editCount: number;
  scenarios: Array<{
    label: string;
    samples: number;
    confidence: string;
  }>;
}

function buildDNADashboardHTML(data: DNAData): string {
  const scenarioRows = data.scenarios
    .slice(0, 10)
    .map((s) => {
      const barWidth = Math.min(
        100,
        Math.round((s.samples / Math.max(...data.scenarios.map((x) => x.sampleCount))) * 100),
      );
      return `
      <div class="row">
        <div class="scenario-label">${s.label}</div>
        <div class="bar-wrap">
          <div class="bar" style="width: ${barWidth}%"></div>
        </div>
        <div class="count">${s.samples}</div>
        <div class="conf conf-${s.confidence.toLowerCase()}">${s.confidence}</div>
      </div>`;
    })
    .join("");

  return `<!DOCTYPE html>
<html>
<head>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: 'JetBrains Mono', 'SF Mono', monospace;
    background: #1A1A1A;
    color: #F5F0E8;
    padding: 24px;
  }
  .header {
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 3px;
    color: #8A8A8A;
    margin-bottom: 8px;
  }
  .title {
    font-size: 28px;
    font-weight: 700;
    margin-bottom: 4px;
  }
  .subtitle {
    font-size: 11px;
    color: #8A8A8A;
    margin-bottom: 24px;
  }
  .row {
    display: grid;
    grid-template-columns: 180px 1fr 40px 40px;
    gap: 8px;
    align-items: center;
    padding: 6px 0;
    border-bottom: 1px solid #222;
  }
  .scenario-label {
    font-size: 11px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .bar-wrap {
    height: 4px;
    background: #333;
  }
  .bar {
    height: 100%;
    background: #F5F0E8;
  }
  .count {
    font-size: 11px;
    text-align: right;
    font-weight: 600;
  }
  .conf {
    font-size: 9px;
    text-transform: uppercase;
    letter-spacing: 1px;
    text-align: right;
  }
  .conf-high { color: #F5F0E8; }
  .conf-good { color: #AAAAAA; }
  .conf-mod { color: #888888; }
  .conf-low { color: #555555; }
</style>
</head>
<body>
  <div class="header">Sophie — Style DNA</div>
  <div class="title">${data.editCount.toLocaleString()} Edits</div>
  <div class="subtitle">${data.scenarios.length} scenarios learned</div>
  ${scenarioRows}
</body>
</html>`;
}
