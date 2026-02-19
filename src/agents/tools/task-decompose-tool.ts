import { Type } from "@sinclair/typebox";
import { randomUUID } from "node:crypto";
import type { OpenClawConfig } from "../../config/config.js";
import { resolveSessionAgentId } from "../agent-scope.js";
import type { AnyAgentTool } from "./common.js";
import { jsonResult, readNumberParam, readStringParam } from "./common.js";

type DecompositionStrategy = "sequential" | "parallel" | "mixed";

interface TaskStep {
  id: string;
  title: string;
  description: string;
  dependencies: string[];
  estimatedTokens?: number;
  priority: number;
  type: "research" | "analysis" | "creation" | "review" | "execution";
}

interface TaskDecompositionResult {
  originalTask: string;
  steps: TaskStep[];
  strategy: DecompositionStrategy;
  totalEstimatedTokens: number;
  criticalPath: string[];
  suggestions: string[];
}

const TaskDecomposeSchema = Type.Object({
  task: Type.String(),
  maxSteps: Type.Optional(Type.Number()),
  strategy: Type.Optional(
    Type.Union([
      Type.Literal("sequential"),
      Type.Literal("parallel"),
      Type.Literal("mixed"),
    ]),
  ),
  includeEstimates: Type.Optional(Type.Boolean()),
  context: Type.Optional(Type.String()),
});

function analyzeTaskComplexity(task: string, context?: string): {
  complexity: "simple" | "moderate" | "complex";
  suggestedMaxSteps: number;
  strategy: DecompositionStrategy;
} {
  const combinedText = `${task} ${context || ""}`.toLowerCase();
  const wordCount = combinedText.split(/\s+/).length;

  const complexIndicators = [
    "implement",
    "build",
    "create",
    "design",
    "architecture",
    "system",
    "multiple",
    "integrate",
    "migrate",
    "refactor",
    "optimize",
    "deploy",
  ];

  const moderateIndicators = [
    "add",
    "update",
    "modify",
    "fix",
    "improve",
    "enhance",
    "extend",
  ];

  const hasComplexIndicators = complexIndicators.some((indicator) =>
    combinedText.includes(indicator),
  );
  const hasModerateIndicators = moderateIndicators.some((indicator) =>
    combinedText.includes(indicator),
  );

  if (hasComplexIndicators || wordCount > 50) {
    return {
      complexity: "complex",
      suggestedMaxSteps: 10,
      strategy: "mixed",
    };
  }

  if (hasModerateIndicators || wordCount > 20) {
    return {
      complexity: "moderate",
      suggestedMaxSteps: 5,
      strategy: "sequential",
    };
  }

  return {
    complexity: "simple",
    suggestedMaxSteps: 3,
    strategy: "sequential",
  };
}

function generateTaskSteps(
  task: string,
  maxSteps: number,
  strategy: DecompositionStrategy,
  _context?: string,
): TaskStep[] {
  const steps: TaskStep[] = [];
  const stepIdPrefix = `step-${randomUUID().slice(0, 8)}`;

  const researchStep: TaskStep = {
    id: `${stepIdPrefix}-1`,
    title: "Research and Information Gathering",
    description:
      "Gather relevant information, review existing code/documentation, and understand requirements",
    dependencies: [],
    estimatedTokens: 2000,
    priority: 1,
    type: "research",
  };

  const analysisStep: TaskStep = {
    id: `${stepIdPrefix}-2`,
    title: "Analysis and Planning",
    description:
      "Analyze gathered information, identify constraints, and create detailed implementation plan",
    dependencies: [`${stepIdPrefix}-1`],
    estimatedTokens: 1500,
    priority: 2,
    type: "analysis",
  };

  const creationStep: TaskStep = {
    id: `${stepIdPrefix}-3`,
    title: "Implementation",
    description: "Implement the solution according to the plan",
    dependencies: [`${stepIdPrefix}-2`],
    estimatedTokens: 3000,
    priority: 3,
    type: "creation",
  };

  const reviewStep: TaskStep = {
    id: `${stepIdPrefix}-4`,
    title: "Review and Testing",
    description: "Review implementation, test functionality, and verify requirements are met",
    dependencies: [`${stepIdPrefix}-3`],
    estimatedTokens: 1500,
    priority: 4,
    type: "review",
  };

  if (strategy === "sequential") {
    steps.push(researchStep, analysisStep, creationStep, reviewStep);
  } else if (strategy === "parallel") {
    const parallelAnalysis: TaskStep = {
      id: `${stepIdPrefix}-2a`,
      title: "Technical Analysis",
      description: "Analyze technical requirements and constraints",
      dependencies: [`${stepIdPrefix}-1`],
      estimatedTokens: 1000,
      priority: 2,
      type: "analysis",
    };

    const parallelResearch: TaskStep = {
      id: `${stepIdPrefix}-2b`,
      title: "Domain Research",
      description: "Research domain-specific knowledge and best practices",
      dependencies: [`${stepIdPrefix}-1`],
      estimatedTokens: 1000,
      priority: 2,
      type: "research",
    };

    steps.push(researchStep, parallelAnalysis, parallelResearch, creationStep, reviewStep);
  } else {
    steps.push(researchStep, analysisStep, creationStep, reviewStep);
  }

  return steps.slice(0, maxSteps);
}

function computeCriticalPath(steps: TaskStep[]): string[] {
  const stepMap = new Map(steps.map((s) => [s.id, s]));
  const visited = new Set<string>();
  const path: string[] = [];

  function dfs(stepId: string): void {
    if (visited.has(stepId)) {
      return;
    }
    visited.add(stepId);

    const step = stepMap.get(stepId);
    if (!step) {
      return;
    }

    for (const depId of step.dependencies) {
      dfs(depId);
    }

    if (!path.includes(stepId)) {
      path.push(stepId);
    }
  }

  const rootSteps = steps.filter((s) => s.dependencies.length === 0);
  rootSteps.forEach((s) => dfs(s.id));

  return path;
}

function generateSuggestions(task: string, steps: TaskStep[]): string[] {
  const suggestions: string[] = [];

  const hasResearch = steps.some((s) => s.type === "research");
  const hasTesting = steps.some((s) => s.type === "review");

  if (!hasResearch) {
    suggestions.push("Consider adding a research step to gather requirements");
  }

  if (!hasTesting) {
    suggestions.push("Add a review/testing step to verify the implementation");
  }

  if (steps.length > 8) {
    suggestions.push(
      "Task decomposition has many steps; consider breaking into smaller subtasks",
    );
  }

  const parallelizable = steps.filter((s) => s.dependencies.length <= 1);
  if (parallelizable.length > 3 && steps.every((s) => s.dependencies.length > 0)) {
    suggestions.push("Some steps could potentially run in parallel to save time");
  }

  return suggestions;
}

export function createTaskDecomposeTool(options: {
  config?: OpenClawConfig;
  agentSessionKey?: string;
}): AnyAgentTool | null {
  if (options.config) {
    resolveSessionAgentId({
      sessionKey: options.agentSessionKey,
      config: options.config,
    });
  }

  return {
    label: "Task Decomposition",
    name: "task_decompose",
    description:
      "Break down complex tasks into smaller, manageable steps with dependencies, priorities, and execution strategy. Returns a structured plan with step IDs, descriptions, and suggested order.",
    parameters: TaskDecomposeSchema,
    execute: async (_toolCallId, params) => {
      const task = readStringParam(params, "task", { required: true });
      const maxSteps = readNumberParam(params, "maxSteps") ?? 10;
      const strategyParam = readStringParam(params, "strategy") as DecompositionStrategy | undefined;
      const includeEstimates = Boolean(
        params.includeEstimates === true || params.includeEstimates === "true",
      );
      const context = readStringParam(params, "context");

      const analysis = analyzeTaskComplexity(task, context);
      const strategy = strategyParam || analysis.strategy;
      const effectiveMaxSteps = Math.min(maxSteps, analysis.suggestedMaxSteps);

      const steps = generateTaskSteps(task, effectiveMaxSteps, strategy, context);
      const criticalPath = computeCriticalPath(steps);
      const suggestions = generateSuggestions(task, steps);

      const totalEstimatedTokens = includeEstimates
        ? steps.reduce((sum, step) => sum + (step.estimatedTokens || 0), 0)
        : undefined;

      const result: TaskDecompositionResult = {
        originalTask: task,
        steps: includeEstimates ? steps : steps.map((step) => {
          const { estimatedTokens: _estimatedTokens, ...rest } = step;
          return rest;
        }),
        strategy,
        totalEstimatedTokens: totalEstimatedTokens || 0,
        criticalPath,
        suggestions,
      };

      return jsonResult(result);
    },
  };
}

export { type TaskDecompositionResult, type TaskStep };
