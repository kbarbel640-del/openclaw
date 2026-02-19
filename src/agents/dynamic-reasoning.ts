/**
 * Dynamic Reasoning - 动态推理引擎
 * 
 * 根据任务难度动态调整推理级别
 * 实现：fast/balanced/deep 三级推理路径
 */

import type { AnyAgentTool } from "./tools/common.js";

/**
 * 推理级别
 */
export type ReasoningLevel = 'fast' | 'balanced' | 'deep';

/**
 * 任务难度评估结果
 */
export type TaskDifficulty = {
  level: ReasoningLevel;
  score: number; // 0-1
  factors: DifficultyFactor[];
  recommendedModel?: string;
  estimatedTokens?: number;
};

/**
 * 难度因子
 */
export type DifficultyFactor = {
  name: string;
  score: number;
  weight: number;
};

/**
 * Dynamic Reasoning 核心类
 */
export class DynamicReasoningEngine {
  private readonly config: {
    fastThreshold: number;
    balancedThreshold: number;
    enableModelSelection: boolean;
  };

  constructor(config?: {
    fastThreshold?: number;
    balancedThreshold?: number;
    enableModelSelection?: boolean;
  }) {
    this.config = {
      fastThreshold: config?.fastThreshold ?? 0.3,
      balancedThreshold: config?.balancedThreshold ?? 0.6,
      enableModelSelection: config?.enableModelSelection ?? true,
    };
  }

  /**
   * 评估任务难度
   * 
   * 基于多个信号综合评估：
   * - 复杂度（长度、结构）
   * - 歧义性
   * - 领域知识需求
   * - 步骤数量
   */
  async assessTaskDifficulty(task: string): Promise<TaskDifficulty> {
    const factors: DifficultyFactor[] = [];

    // 1. 复杂度分析
    const complexity = this.analyzeComplexity(task);
    factors.push(complexity);

    // 2. 歧义性检测
    const ambiguity = this.detectAmbiguity(task);
    factors.push(ambiguity);

    // 3. 领域知识需求
    const domainKnowledge = this.estimateDomainKnowledge(task);
    factors.push(domainKnowledge);

    // 4. 步骤数量估计
    const steps = await this.estimateSteps(task);
    factors.push(steps);

    // 计算加权总分
    const totalScore = factors.reduce(
      (sum, factor) => sum + factor.score * factor.weight,
      0,
    );

    const normalizedScore = Math.max(0, Math.min(1, totalScore));

    // 确定推理级别
    let level: ReasoningLevel;
    if (normalizedScore < this.config.fastThreshold) {
      level = 'fast';
    } else if (normalizedScore < this.config.balancedThreshold) {
      level = 'balanced';
    } else {
      level = 'deep';
    }

    // 推荐模型（如果启用）
    const recommendedModel = this.config.enableModelSelection
      ? this.selectModel(level)
      : undefined;

    // 估计 Token 消耗
    const estimatedTokens = this.estimateTokens(normalizedScore, task.length);

    return {
      level,
      score: normalizedScore,
      factors,
      recommendedModel,
      estimatedTokens,
    };
  }

  /**
   * 执行自适应推理
   * 
   * 根据难度级别选择推理路径
   */
  async executeWithAdaptiveReasoning(
    task: string,
    executeFast: () => Promise<any>,
    executeBalanced: () => Promise<any>,
    executeDeep: () => Promise<any>,
  ): Promise<{
    result: any;
    level: ReasoningLevel;
    duration: number;
  }> {
    // Step 1: 评估难度
    const assessment = await this.assessTaskDifficulty(task);
    const startTime = Date.now();

    // Step 2: 选择推理路径
    let result: any;
    switch (assessment.level) {
      case 'fast':
        result = await executeFast();
        break;
      case 'balanced':
        result = await executeBalanced();
        break;
      case 'deep':
        result = await executeDeep();
        break;
    }

    const duration = Date.now() - startTime;

    return {
      result,
      level: assessment.level,
      duration,
    };
  }

  /**
   * 分析任务复杂度
   */
  private analyzeComplexity(task: string): DifficultyFactor {
    const length = task.length;
    const sentences = task.split(/[.!?]+/).filter(s => s.trim()).length;
    const hasStructure = /```|^\s*[-*]|^\s*\d+\./.test(task);
    const hasMultipleRequirements = /and |also | additionally | furthermore/i.test(task);

    // 复杂度评分（0-1）
    let score = 0;
    
    // 长度因素
    if (length > 500) score += 0.3;
    else if (length > 200) score += 0.2;
    else if (length > 50) score += 0.1;

    // 句子数量
    if (sentences > 5) score += 0.2;
    else if (sentences > 2) score += 0.1;

    // 结构化内容
    if (hasStructure) score += 0.2;

    // 多重需求
    if (hasMultipleRequirements) score += 0.2;

    return {
      name: 'complexity',
      score: Math.min(1, score),
      weight: 0.35,
    };
  }

  /**
   * 检测歧义性
   */
  private detectAmbiguity(task: string): DifficultyFactor {
    const ambiguousWords = [
      'maybe', 'perhaps', 'possibly', 'might', 'could',
      'unsure', 'uncertain', 'ambiguous', 'vague',
      'best', 'optimal', 'better', // 相对词
    ];

    const hasQuestionWords = /what|how|why|when|where|which/i.test(task);
    const hasAmbiguousTerms = ambiguousWords.some(word =>
      new RegExp(`\\b${word}\\b`, 'i').test(task),
    );
    const lacksSpecifics = !/\d+|name|specific|exact|concrete/i.test(task);

    let score = 0;
    if (hasAmbiguousTerms) score += 0.4;
    if (hasQuestionWords && lacksSpecifics) score += 0.3;
    if (lacksSpecifics) score += 0.2;

    return {
      name: 'ambiguity',
      score: Math.min(1, score),
      weight: 0.25,
    };
  }

  /**
   * 估计领域知识需求
   */
  private estimateDomainKnowledge(task: string): DifficultyFactor {
    const technicalTerms = [
      // 编程
      'api', 'database', 'algorithm', 'deployment', 'kubernetes', 'docker',
      // 科学
      'quantum', 'molecular', 'neural', 'algorithm', 'optimization',
      // 专业
      'legal', 'medical', 'financial', 'regulatory', 'compliance',
    ];

    const hasTechnicalTerms = technicalTerms.some(term =>
      new RegExp(`\\b${term}\\b`, 'i').test(task),
    );

    const hasDomainContext = /in the context of |for |specific to |domain/i.test(task);
    const requiresExpertise = /expert |professional |advanced |specialized/i.test(task);

    let score = 0;
    if (hasTechnicalTerms) score += 0.4;
    if (hasDomainContext) score += 0.3;
    if (requiresExpertise) score += 0.3;

    return {
      name: 'domain_knowledge',
      score: Math.min(1, score),
      weight: 0.25,
    };
  }

  /**
   * 估计步骤数量
   */
  private async estimateSteps(task: string): Promise<DifficultyFactor> {
    // 简化实现：基于关键词估计
    const stepIndicators = [
      'first', 'then', 'next', 'finally',
      'step', 'phase', 'stage',
      'before', 'after', 'while',
    ];

    const count = stepIndicators.filter(indicator =>
      new RegExp(`\\b${indicator}\\b`, 'i').test(task),
    ).length;

    const hasSequence = /create.*then|build.*and|design.*implement/i.test(task);

    let score = 0;
    if (count >= 5) score = 1.0;
    else if (count >= 3) score = 0.7;
    else if (count >= 1 || hasSequence) score = 0.4;
    else score = 0.1;

    return {
      name: 'steps',
      score,
      weight: 0.15,
    };
  }

  /**
   * 选择推荐模型
   */
  private selectModel(level: ReasoningLevel): string {
    switch (level) {
      case 'fast':
        return 'fast-model'; // 例如：GPT-3.5-Turbo
      case 'balanced':
        return 'balanced-model'; // 例如：GPT-4-Turbo
      case 'deep':
        return 'deep-model'; // 例如：Claude-Opus
      default:
        return 'balanced-model';
    }
  }

  /**
   * 估计 Token 消耗
   */
  private estimateTokens(difficultyScore: number, taskLength: number): number {
    // 基础 Token（输入）
    const inputTokens = Math.ceil(taskLength / 4); // 约 4 字符/token

    // 输出 Token 基于难度
    let outputMultiplier: number;
    if (difficultyScore < this.config.fastThreshold) {
      outputMultiplier = 1; // 简单任务：1x
    } else if (difficultyScore < this.config.balancedThreshold) {
      outputMultiplier = 2; // 中等任务：2x
    } else {
      outputMultiplier = 4; // 复杂任务：4x
    }

    return inputTokens + (inputTokens * outputMultiplier);
  }

  /**
   * 优化计算预算
   */
  optimizeComputeBudget(
    task: string,
    budget: {
      maxTokens: number;
      maxTime: number; // ms
      maxCost: number; // USD
    },
  ): {
    feasible: boolean;
    recommendedLevel: ReasoningLevel;
    tradeoffs: string[];
  } {
    const difficulty = this.assessTaskDifficulty(task);
    const estimatedTokens = this.estimateTokens(difficulty.score, task.length);

    const tradeoffs: string[] = [];
    let recommendedLevel: ReasoningLevel = difficulty.level;

    // 检查是否超出预算
    if (estimatedTokens > budget.maxTokens) {
      tradeoffs.push(`Token budget exceeded (${estimatedTokens} > ${budget.maxTokens})`);
      
      // 降级推理级别
      if (recommendedLevel === 'deep') {
        recommendedLevel = 'balanced';
        tradeoffs.push('Downgraded to balanced reasoning');
      } else if (recommendedLevel === 'balanced') {
        recommendedLevel = 'fast';
        tradeoffs.push('Downgraded to fast reasoning');
      }
    }

    return {
      feasible: tradeoffs.length === 0 || recommendedLevel !== difficulty.level,
      recommendedLevel,
      tradeoffs,
    };
  }
}

/**
 * 创建 Dynamic Reasoning 工具
 */
export function createDynamicReasoningTool(): AnyAgentTool {
  const engine = new DynamicReasoningEngine();

  return {
    name: 'dynamic_reasoning',
    label: 'Dynamic Reasoning',
    description: 'Analyze task difficulty and recommend optimal reasoning level',
    parameters: {
      type: 'object',
      properties: {
        task: {
          type: 'string',
          description: 'The task to analyze',
        },
        includeModelRecommendation: {
          type: 'boolean',
          description: 'Whether to include model recommendation',
          default: true,
        },
      },
      required: ['task'],
    },
    execute: async (_toolCallId, params) => {
      try {
        const task = params.task as string;
        const includeModelRecommendation = params.includeModelRecommendation as boolean;

        const customEngine = new DynamicReasoningEngine({
          enableModelSelection: includeModelRecommendation,
        });

        const assessment = await customEngine.assessTaskDifficulty(task);

        return {
          content: [{
            type: 'text' as const,
            text: `Task Difficulty Assessment:\n\n` +
                  `Level: **${assessment.level}**\n` +
                  `Score: ${(assessment.score * 100).toFixed(1)}%\n\n` +
                  `Factors:\n` +
                  assessment.factors.map(f => 
                    `- ${f.name}: ${(f.score * 100).toFixed(1)}% (weight: ${(f.weight * 100).toFixed(0)}%)`
                  ).join('\n') +
                  `\n\n` +
                  (assessment.recommendedModel ? `Recommended Model: ${assessment.recommendedModel}\n` : '') +
                  (assessment.estimatedTokens ? `Estimated Tokens: ${assessment.estimatedTokens}\n` : ''),
          }],
          details: assessment,
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
 * 集成到现有 Agent 流程
 */
export function integrateDynamicReasoning(): void {
  // 这个函数将被调用以将 dynamic reasoning 集成到现有 agent 流程中
  // 具体实现在 model-selection.ts 或 agent-scope.ts 中
}
