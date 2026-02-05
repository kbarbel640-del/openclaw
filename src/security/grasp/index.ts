import {
  listAgentIds,
  resolveDefaultAgentId,
} from "../../agents/agent-scope.js";
import { DEFAULT_MODEL, DEFAULT_PROVIDER } from "../../agents/defaults.js";
import { resolveConfiguredModelRef } from "../../agents/model-selection.js";
import { ALL_DIMENSION_PROMPTS } from "./prompts/index.js";
import { runDimensionAnalysis } from "./runner.js";
import {
  aggregateScores,
  countBySeverity,
  generateAgentSummary,
  levelFromScore,
} from "./scoring.js";
import { computeCacheKey, getCachedReport, setCachedReport } from "./cache.js";
import type {
  GraspAgentProfile,
  GraspDimensionResult,
  GraspFinding,
  GraspOptions,
  GraspReport,
} from "./types.js";

export type { GraspOptions, GraspReport, GraspAgentProfile, GraspDimensionResult, GraspFinding };

export async function runGraspAssessment(opts: GraspOptions): Promise<GraspReport> {
  const { config } = opts;

  // Resolve model
  const modelRef = resolveConfiguredModelRef({
    cfg: config,
    defaultProvider: DEFAULT_PROVIDER,
    defaultModel: DEFAULT_MODEL,
  });
  const model = opts.model || modelRef.model;
  const provider = modelRef.provider;

  // Determine which agents to analyze
  const defaultAgentId = resolveDefaultAgentId(config);
  const allAgentIds = listAgentIds(config);
  const agentIds = opts.agentId ? [opts.agentId] : allAgentIds.length > 0 ? allAgentIds : [defaultAgentId];

  // Check cache (if not disabled)
  const cacheKey = computeCacheKey(config, opts.agentId);
  if (!opts.noCache) {
    const cached = await getCachedReport(cacheKey);
    if (cached) {
      return cached;
    }
  }

  const agents: GraspAgentProfile[] = [];

  for (const agentId of agentIds) {
    // Run all dimensions in parallel
    const dimensionResults = await Promise.all(
      ALL_DIMENSION_PROMPTS.map((prompt) =>
        runDimensionAnalysis({
          config,
          prompt,
          agentId,
          model,
          provider,
        }),
      ),
    );

    const overallScore = aggregateScores(dimensionResults.map((d) => d.score));

    agents.push({
      agentId,
      isDefault: agentId === defaultAgentId,
      dimensions: dimensionResults,
      overallScore,
      overallLevel: levelFromScore(overallScore),
      summary: generateAgentSummary(dimensionResults),
    });
  }

  // Extract global findings (from governance and reach dimensions, related to gateway/channels)
  const globalFindings = extractGlobalFindings(agents);

  const overallScore = Math.max(...agents.map((a) => a.overallScore), 0);
  const allFindings = agents.flatMap((a) => a.dimensions.flatMap((d) => d.findings));

  const report: GraspReport = {
    ts: Date.now(),
    modelUsed: `${provider}/${model}`,
    agents,
    globalFindings,
    overallScore,
    overallLevel: levelFromScore(overallScore),
    summary: countBySeverity(allFindings),
  };

  // Cache the report
  if (!opts.noCache) {
    await setCachedReport(cacheKey, report);
  }

  return report;
}

function extractGlobalFindings(agents: GraspAgentProfile[]): GraspFinding[] {
  // Extract findings related to gateway/channels (not agent-specific)
  const globalPatterns = [
    /^governance\.gateway/,
    /^governance\.control_ui/,
    /^reach\.gateway/,
    /^reach\.tailscale/,
    /^reach\.channel/,
    /^safeguards\.channel/,
  ];

  const seen = new Set<string>();
  const global: GraspFinding[] = [];

  for (const agent of agents) {
    for (const dim of agent.dimensions) {
      for (const finding of dim.findings) {
        if (seen.has(finding.id)) {
          continue;
        }
        if (globalPatterns.some((p) => p.test(finding.id))) {
          seen.add(finding.id);
          global.push(finding);
        }
      }
    }
  }

  return global;
}
