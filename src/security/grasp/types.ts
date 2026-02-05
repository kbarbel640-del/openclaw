import type { OpenClawConfig } from "../../config/config.js";

export type GraspDimension = "governance" | "reach" | "agency" | "safeguards" | "potential_damage";

export type GraspRiskLevel = "low" | "medium" | "high" | "critical";

export type GraspSeverity = "info" | "warn" | "critical";

export type GraspFinding = {
  id: string;
  dimension: GraspDimension;
  severity: GraspSeverity;
  signal: string;
  observation: string;
  riskContribution: number;
  title: string;
  detail: string;
  remediation?: string;
};

export type GraspDimensionResult = {
  dimension: GraspDimension;
  label: string;
  score: number;
  level: GraspRiskLevel;
  findings: GraspFinding[];
  reasoning: string;
  exploredPaths: string[];
};

export type GraspAgentProfile = {
  agentId: string;
  isDefault: boolean;
  dimensions: GraspDimensionResult[];
  overallScore: number;
  overallLevel: GraspRiskLevel;
  summary: string;
};

export type GraspReport = {
  ts: number;
  modelUsed: string;
  agents: GraspAgentProfile[];
  globalFindings: GraspFinding[];
  overallScore: number;
  overallLevel: GraspRiskLevel;
  summary: GraspSummary;
  cached?: boolean;
  cacheKey?: string;
};

export type GraspSummary = {
  critical: number;
  warn: number;
  info: number;
};

export type GraspOptions = {
  config: OpenClawConfig;
  agentId?: string;
  model?: string;
  verbose?: boolean;
  noCache?: boolean;
};

export type DimensionPrompt = {
  dimension: GraspDimension;
  label: string;
  systemPrompt: string;
};

export type GraspDimensionRawResponse = {
  score: number;
  level: GraspRiskLevel;
  findings: Array<{
    id: string;
    severity: GraspSeverity;
    signal: string;
    observation: string;
    riskContribution: number;
    title: string;
    detail: string;
    remediation?: string;
  }>;
  reasoning: string;
  exploredPaths: string[];
};
