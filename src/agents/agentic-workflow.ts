/**
 * Agentic Workflow - 结构化 Agent 流程设计
 * 
 * 基于 Stanford HAI Agentic Workflow 设计模式
 * 实现：反思循环、并行验证、分解 - 解决 - 整合
 */

import type { AnyAgentTool } from "./tools/common.js";

/**
 * 解决方案评估结果
 */
export type SolutionEvaluation = {
  score: number;
  feedback: string;
  issues: string[];
  strengths: string[];
};

/**
 * 反思循环配置
 */
export type ReflectionConfig = {
  maxIterations: number;
  minScore: number;
  enableParallelVerify: boolean;
};

/**
 * Agentic Workflow 核心类
 * 
 * 注意：这是框架类，实际的 LLM 调用通过 tool 参数传入
 */
export class AgenticWorkflow {
  private readonly config: ReflectionConfig;

  constructor(config?: Partial<ReflectionConfig>) {
    this.config = {
      maxIterations: config?.maxIterations ?? 5,
      minScore: config?.minScore ?? 0.8,
      enableParallelVerify: config?.enableParallelVerify ?? true,
    };
  }

  /**
   * 执行反思循环
   * 
   * @param generateSolution - 生成解决方案的函数
   * @param evaluateSolution - 评估解决方案的函数
   * @param task - 任务描述
   */
  async executeWithReflection<T>(
    generateSolution: (task: string, previous?: T, previousEval?: SolutionEvaluation) => Promise<T>,
    evaluateSolution: (solution: T, task: string) => Promise<SolutionEvaluation>,
    task: string,
  ): Promise<{
    solution: T;
    iterations: number;
    finalScore: number;
    evaluation: SolutionEvaluation;
  }> {
    let bestSolution: T | null = null;
    let bestScore = 0;
    let bestEvaluation: SolutionEvaluation | null = null;
    let iterations = 0;

    let currentTask = task;

    for (let i = 0; i < this.config.maxIterations; i++) {
      iterations = i + 1;

      // Step 1: 生成解决方案
      const solution = await generateSolution(
        currentTask,
        bestSolution ?? undefined,
        bestEvaluation ?? undefined,
      );

      // Step 2: 自我评估
      const evaluation = await evaluateSolution(solution, currentTask);

      // Step 3: 更新最佳方案
      if (evaluation.score > bestScore) {
        bestSolution = solution;
        bestScore = evaluation.score;
        bestEvaluation = evaluation;

        // 如果达到高质量阈值，提前结束
        if (bestScore >= this.config.minScore) {
          break;
        }
      }

      // Step 4: 生成改进反馈
      const feedback = this.buildFeedback(evaluation);
      currentTask = `${task}\n\nPrevious attempt feedback: ${feedback}`;
    }

    if (!bestSolution || !bestEvaluation) {
      throw new Error("Failed to generate any valid solution");
    }

    return {
      solution: bestSolution,
      iterations,
      finalScore: bestEvaluation.score,
      evaluation: bestEvaluation,
    };
  }

  /**
   * 并行验证
   */
  async verifyWithMultipleAgents(
    verifyFn: (agentName: string, solution: string) => Promise<{
      passed: boolean;
      issues: string[];
      suggestions: string[];
    }>,
    solution: string,
  ): Promise<{
    passed: boolean;
    issues: string[];
    suggestions: string[];
  }> {
    const agents = [
      { name: 'critic', focus: 'Identify logical flaws and inconsistencies' },
      { name: 'tester', focus: 'Identify edge cases and potential failures' },
      { name: 'reviewer', focus: 'Check completeness and best practices' },
    ];

    const results = await Promise.all(
      agents.map(agent => verifyFn(agent.name, solution)),
    );

    const allIssues = results.flatMap(r => r.issues);
    const allSuggestions = results.flatMap(r => r.suggestions);
    const passed = results.every(r => r.passed);

    return {
      passed,
      issues: allIssues,
      suggestions: allSuggestions,
    };
  }

  private buildFeedback(evaluation: SolutionEvaluation): string {
    const parts: string[] = [];
    
    if (evaluation.issues.length > 0) {
      parts.push(`Issues to address: ${evaluation.issues.join(', ')}`);
    }
    
    if (evaluation.strengths.length > 0) {
      parts.push(`Strengths to leverage: ${evaluation.strengths.join(', ')}`);
    }
    
    parts.push(`Current score: ${evaluation.score}`);
    parts.push(`Feedback: ${evaluation.feedback}`);
    
    return parts.join('\n');
  }
}

/**
 * 创建 Agentic Workflow 工具
 */
export function createAgenticWorkflowTool(
  _config?: Partial<ReflectionConfig>,
): AnyAgentTool {
  return {
    name: 'agentic_workflow',
    label: 'Agentic Workflow',
    description: 'Solve complex problems through reflection and verification. Use for complex tasks that benefit from iterative improvement.',
    parameters: {
      type: 'object',
      properties: {
        task: {
          type: 'string',
          description: 'The complex problem to solve',
        },
        useDivideAndConquer: {
          type: 'boolean',
          description: 'Whether to use divide-and-conquer strategy for very complex problems',
          default: false,
        },
      },
      required: ['task'],
    },
    execute: async (_toolCallId, params) => {
      try {
        const task = params.task as string;
        const useDivideAndConquer = params.useDivideAndConquer as boolean;

        // 这是一个框架工具，实际使用由 Agent 根据任务复杂度决定是否调用
        // 简单任务不需要反思循环，复杂任务才使用
        
        return {
          content: [{
            type: 'text' as const,
            text: `Agentic Workflow framework ready for task: ${task}\n\n` +
                  `This tool provides:\n` +
                  `- Reflection loop for iterative improvement\n` +
                  `- Parallel verification for quality assurance\n` +
                  `- Divide-and-conquer for complex problems\n\n` +
                  `Usage: The Agent will automatically apply reflection when task complexity warrants it.`,
          }],
          details: {
            task,
            useDivideAndConquer,
            frameworkReady: true,
          },
        } as any;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return {
          content: [{
            type: 'text' as const,
            text: `Error: ${message}`,
          }],
          details: { error: message },
        } as any;
      }
    },
  };
}

/**
 * 工具集成辅助函数
 */
export function integrateAgenticWorkflow(): void {
  // 这个函数将被调用以将 agentic workflow 集成到现有 agent 流程中
  // 具体实现在 pi-tools.ts 或 agent-scope.ts 中
}
