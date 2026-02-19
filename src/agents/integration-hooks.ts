import { handleTodosCreate } from "../../gateway/todos/handlers.js";
import { parseTodosFromPrompt } from "../../gateway/todos/handlers.js";
import { EvidenceGateManager } from "../../gateway/evidence/manager.js";
import { SessionContinuityManager } from "../../sessions/continuity/manager.js";
import type { EvidenceConfig } from "../../gateway/evidence/types.js";
import type { SessionContinuityConfig } from "../../sessions/continuity/types.js";

export interface AgentExecutionContext {
  message: string;
  sessionKey?: string;
  agentId?: string;
}

export interface AgentExecutionConfig {
  todos?: {
    enabled: boolean;
    autoTrack: boolean;
  };
  evidence?: EvidenceConfig;
  continuity?: SessionContinuityConfig;
}

const DEFAULT_CONFIG: AgentExecutionConfig = {
  todos: {
    enabled: false,
    autoTrack: false,
  },
  evidence: {
    enabled: false,
    gates: [],
    failOnError: false,
  },
  continuity: {
    enabled: false,
    inheritMode: "summary",
    maxHistoricalSessions: 3,
  },
};

export class AgentIntegrationHooks {
  private config: AgentExecutionConfig;
  private continuityManager?: SessionContinuityManager;
  private evidenceManager?: EvidenceGateManager;
  private workspace: string;

  constructor(config: Partial<AgentExecutionConfig> = {}, workspace: string = process.cwd()) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.workspace = workspace;

    if (this.config.continuity?.enabled) {
      const sessionsDir = process.env.OPENCLAW_SESSIONS_DIR || "~/.openclaw/sessions";
      this.continuityManager = new SessionContinuityManager(sessionsDir, this.config.continuity);
    }

    if (this.config.evidence?.enabled) {
      this.evidenceManager = new EvidenceGateManager(this.config.evidence, this.workspace);
    }
  }

  async beforeAgentExecution(ctx: AgentExecutionContext): Promise<{
    enhancedMessage: string;
    createdTodos: string[];
  }> {
    const createdTodos: string[] = [];
    let enhancedMessage = ctx.message;

    if (this.config.todos?.enabled && this.config.todos?.autoTrack && ctx.sessionKey) {
      const detectedTodos = parseTodosFromPrompt(ctx.message);

      for (const todoContent of detectedTodos) {
        try {
          const todo = await handleTodosCreate({
            content: todoContent,
            sessionKey: ctx.sessionKey,
            priority: "medium",
          });
          createdTodos.push(todo.id);
        } catch (error) {
          console.error("[agent-hooks] Failed to create todo:", error);
        }
      }
    }

    if (
      this.config.continuity?.enabled &&
      this.continuityManager &&
      ctx.sessionKey &&
      ctx.agentId
    ) {
      const historicalSessions = await this.continuityManager.getHistoricalSessions(
        ctx.sessionKey,
        ctx.agentId,
      );

      if (historicalSessions.length > 0) {
        const continuityPrompt = this.continuityManager.buildContextPrompt(historicalSessions);
        enhancedMessage = `${continuityPrompt}\n\n## Current Request\n${ctx.message}`;
      }
    }

    return { enhancedMessage, createdTodos };
  }

  async afterAgentCompletion(): Promise<{
    evidenceResults: unknown[];
    passed: boolean;
  }> {
    const evidenceResults: unknown[] = [];
    let passed = true;

    if (this.config.evidence?.enabled && this.evidenceManager) {
      const results = await this.evidenceManager.runAllGates();
      const validation = this.evidenceManager.validateResults(results);

      evidenceResults.push(...results);
      passed = validation.passed;
    }

    return { evidenceResults, passed };
  }

  isParallelEnabled(): boolean {
    return this.config.todos?.enabled === true && this.config.todos?.autoTrack === true;
  }

  async runParallelTasks(
    tasks: Array<{ message: string; sessionKey: string; agentId?: string }>,
    executeTask: (task: {
      message: string;
      sessionKey: string;
      agentId?: string;
    }) => Promise<unknown>,
  ): Promise<Array<{ task: (typeof tasks)[0]; result: unknown; error?: string }>> {
    const results = await Promise.all(
      tasks.map(async (task) => {
        try {
          const result = await executeTask(task);
          return { task, result, error: undefined };
        } catch (error) {
          return { task, result: undefined, error: String(error) };
        }
      }),
    );

    return results;
  }
}
