/**
 * Context Builder for Agent Human-Like Memory
 *
 * Builds minimal relevant context for each request to minimize token usage.
 * Follows human memory model: sensory → working → short-term → long-term
 *
 * Target: <2000 tokens of historical context per request (vs 5000+ naive)
 * Token savings: 60-80% compared to loading all recent history
 */

import { createSubsystemLogger } from "../../logging/subsystem.js";
import { getDatabase } from "../../infra/database/client.js";
import { memoryManager, type SearchResult } from "./memory-manager.js";

const log = createSubsystemLogger("agent-memory/context");

export interface WorkingMemory {
  sessionId: string;
  activeGoals: string[];
  recentMessages: Array<{
    role: "user" | "assistant";
    content: string;
    timestamp: Date;
  }>;
}

export interface ShortTermContext {
  todayLearnings: string[];
  todayDecisions: Array<{ decision: string; outcome?: string }>;
  recentInteractions: Array<{ agentId: string; summary: string }>;
}

export interface LongTermContext {
  relevantMemories: SearchResult[];
  expertise: {
    strongAreas: string[];
    weakAreas: string[];
  };
  reputation: {
    reliability: number;
    quality: string;
  };
}

export interface AgentContext {
  agentId: string;
  currentState: {
    energy: number;
    focus: number;
  };
  workingMemory: WorkingMemory;
  shortTerm: ShortTermContext;
  longTerm: LongTermContext;
  estimatedTokens: number;
}

export interface ContextBuildOptions {
  agentId: string;
  currentMessage: string;
  sessionId?: string;
  workingMemory?: WorkingMemory;
  maxTokens?: number;
  includeShortTerm?: boolean;
  includeLongTerm?: boolean;
}

/**
 * Context Builder Class
 */
export class ContextBuilder {
  /**
   * Build complete agent context for a request
   */
  async buildContext(options: ContextBuildOptions): Promise<AgentContext> {
    const {
      agentId,
      currentMessage,
      sessionId = "default",
      workingMemory,
      maxTokens = 2000,
      includeShortTerm = true,
      includeLongTerm = true,
    } = options;

    log.debug(
      `Building context for agent ${agentId}, message: "${currentMessage.substring(0, 50)}..."`,
    );

    const startTime = Date.now();

    // 1. Working Memory (session context)
    const working = workingMemory ?? {
      sessionId,
      activeGoals: [],
      recentMessages: [],
    };

    // 2. Current State (from database if available, default otherwise)
    const currentState = await this.getCurrentState(agentId);

    // 3. Short-Term Context (today/yesterday)
    const shortTerm = includeShortTerm
      ? await this.buildShortTermContext(agentId)
      : { todayLearnings: [], todayDecisions: [], recentInteractions: [] };

    // 4. Long-Term Context (semantic search)
    const longTerm = includeLongTerm
      ? await this.buildLongTermContext(agentId, currentMessage, maxTokens)
      : {
          relevantMemories: [],
          expertise: { strongAreas: [], weakAreas: [] },
          reputation: { reliability: 0.5, quality: "unknown" },
        };

    // Estimate token count
    const estimatedTokens = this.estimateTokens({
      working,
      shortTerm,
      longTerm,
      currentState,
    });

    const duration = Date.now() - startTime;
    log.debug(`Context built in ${duration}ms (estimated ${estimatedTokens} tokens)`);

    return {
      agentId,
      currentState,
      workingMemory: working,
      shortTerm,
      longTerm,
      estimatedTokens,
    };
  }

  /**
   * Build short-term context (today/yesterday)
   */
  private async buildShortTermContext(_agentId: string): Promise<ShortTermContext> {
    try {
      const db = getDatabase();
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Query today's decisions from agent_decision_log
      const rows = await db<
        Array<{
          decision_type: string;
          decision_quality: string;
          outcome: string | null;
          impact_score: string | null;
        }>
      >`
        SELECT decision_type, decision_quality, outcome, impact_score
        FROM agent_decision_log
        WHERE agent_id = ${_agentId}
          AND time >= ${today}
        ORDER BY time DESC
        LIMIT 10
      `;

      const todayDecisions = rows.map((r) => ({
        decision: `${r.decision_type} (${r.decision_quality})`,
        outcome: r.outcome ?? undefined,
      }));

      return {
        todayLearnings: [],
        todayDecisions,
        recentInteractions: [],
      };
    } catch {
      // Non-blocking: DB may not be available
      return { todayLearnings: [], todayDecisions: [], recentInteractions: [] };
    }
  }

  /**
   * Build long-term context via semantic search
   */
  private async buildLongTermContext(
    agentId: string,
    query: string,
    maxTokens: number,
  ): Promise<LongTermContext> {
    // Semantic search for relevant memories
    const relevantMemories = await memoryManager.searchSemantic({
      agentId,
      query,
      limit: 5, // Top 5 most relevant
      minRetention: 0.2, // Only memories with retention > 0.2
    });

    // Filter by token budget (prioritize by similarity)
    const filteredMemories = this.filterByTokenBudget(relevantMemories, maxTokens * 0.6); // 60% of budget

    // Query expertise and reputation from agent_reputation table
    let expertise = { strongAreas: [] as string[], weakAreas: [] as string[] };
    let reputation = { reliability: 0.5, quality: "unknown" as string };
    try {
      const db = getDatabase();
      const rows = await db<
        Array<{ reliability_score: string; quality_rating: string }>
      >`
        SELECT reliability_score, quality_rating
        FROM agent_reputation
        WHERE agent_id = ${agentId}
        LIMIT 1
      `;
      if (rows.length > 0) {
        reputation = {
          reliability: parseFloat(rows[0].reliability_score),
          quality: rows[0].quality_rating,
        };
      }
    } catch {
      // Non-blocking: DB may not be available
    }

    return {
      relevantMemories: filteredMemories,
      expertise,
      reputation,
    };
  }

  /**
   * Get current agent state (energy, focus) from agent_energy_state table
   */
  private async getCurrentState(_agentId: string): Promise<{ energy: number; focus: number }> {
    try {
      const db = getDatabase();
      const rows = await db<
        Array<{ energy_level: string; focus_level: string }>
      >`
        SELECT energy_level, focus_level
        FROM agent_energy_state
        WHERE agent_id = ${_agentId}
        LIMIT 1
      `;
      if (rows.length > 0) {
        return {
          energy: parseFloat(rows[0].energy_level),
          focus: parseFloat(rows[0].focus_level),
        };
      }
    } catch {
      // Non-blocking: DB may not be available or table may not exist yet
    }
    // Defaults when no data available
    return { energy: 0.8, focus: 0.7 };
  }

  /**
   * Filter memories by token budget
   */
  private filterByTokenBudget<T extends { content: string; summary?: string | null }>(
    memories: T[],
    maxTokens: number,
  ): T[] {
    const filtered: T[] = [];
    let tokenCount = 0;

    for (const memory of memories) {
      // Estimate tokens for this memory (use summary if available)
      const text = memory.summary ?? memory.content;
      const memoryTokens = this.estimateTextTokens(text);

      if (tokenCount + memoryTokens <= maxTokens) {
        filtered.push(memory);
        tokenCount += memoryTokens;
      } else {
        break; // Exceeded budget
      }
    }

    return filtered;
  }

  /**
   * Estimate token count for text
   * Rule of thumb: ~4 characters per token (English), ~2 for code
   */
  private estimateTextTokens(text: string): number {
    return Math.ceil(text.length / 4);
  }

  /**
   * Estimate total token count for context
   */
  private estimateTokens(context: {
    working: WorkingMemory;
    shortTerm: ShortTermContext;
    longTerm: LongTermContext;
    currentState: { energy: number; focus: number };
  }): number {
    let total = 0;

    // Working memory (recent messages)
    for (const msg of context.working.recentMessages) {
      total += this.estimateTextTokens(msg.content);
    }

    // Active goals
    total += this.estimateTextTokens(context.working.activeGoals.join("\n"));

    // Short-term context
    total += this.estimateTextTokens(context.shortTerm.todayLearnings.join("\n"));
    total += this.estimateTextTokens(
      context.shortTerm.todayDecisions.map((d) => d.decision).join("\n"),
    );

    // Long-term memories
    for (const memory of context.longTerm.relevantMemories) {
      total += this.estimateTextTokens(memory.summary ?? memory.content);
    }

    // Current state (~100 tokens)
    total += 100;

    return total;
  }

  /**
   * Format context as markdown for LLM
   */
  formatContext(context: AgentContext): string {
    const parts: string[] = [];

    // Header
    parts.push(`## Agent Context (${context.agentId})\n`);

    // Current State
    parts.push("**Current State:**");
    parts.push(`- Energy: ${context.currentState.energy.toFixed(1)}/1.0`);
    parts.push(`- Focus: ${context.currentState.focus.toFixed(1)}/1.0`);
    if (context.workingMemory.activeGoals.length > 0) {
      parts.push(`- Active goals: ${context.workingMemory.activeGoals.join(", ")}`);
    }
    parts.push("");

    // Recent Conversation (working memory)
    if (context.workingMemory.recentMessages.length > 0) {
      parts.push("**Recent Conversation:**");
      const recent = context.workingMemory.recentMessages.slice(-3); // Last 3 only
      recent.forEach((msg, i) => {
        const preview = msg.content.substring(0, 150);
        parts.push(
          `${i + 1}. ${msg.role === "user" ? "User" : "Agent"}: "${preview}${msg.content.length > 150 ? "..." : ""}"`,
        );
      });
      parts.push("");
    }

    // Relevant Memories (long-term)
    if (context.longTerm.relevantMemories.length > 0) {
      parts.push("**Relevant Memories (semantic search):**");
      context.longTerm.relevantMemories.forEach((memory, i) => {
        const preview = memory.summary ?? memory.content.substring(0, 200);
        parts.push(`${i + 1}. [${memory.memoryType}] ${memory.title}`);
        parts.push(`   ${preview}`);
        parts.push(
          `   (similarity: ${memory.similarity.toFixed(2)}, importance: ${memory.importance}/10)`,
        );
      });
      parts.push("");
    }

    // Today's Context (short-term)
    if (context.shortTerm.todayLearnings.length > 0) {
      parts.push("**Today's Learnings:**");
      context.shortTerm.todayLearnings.forEach((learning) => {
        parts.push(`- ${learning}`);
      });
      parts.push("");
    }

    if (context.shortTerm.todayDecisions.length > 0) {
      parts.push("**Today's Decisions:**");
      context.shortTerm.todayDecisions.forEach((decision) => {
        parts.push(
          `- ${decision.decision}${decision.outcome ? ` (outcome: ${decision.outcome})` : ""}`,
        );
      });
      parts.push("");
    }

    // Expertise & Reputation (long-term)
    if (
      context.longTerm.expertise.strongAreas.length > 0 ||
      context.longTerm.expertise.weakAreas.length > 0
    ) {
      parts.push("**Expertise:**");
      if (context.longTerm.expertise.strongAreas.length > 0) {
        parts.push(`- Strong: ${context.longTerm.expertise.strongAreas.join(", ")}`);
      }
      if (context.longTerm.expertise.weakAreas.length > 0) {
        parts.push(`- Weak: ${context.longTerm.expertise.weakAreas.join(", ")}`);
      }
      parts.push("");
    }

    // Footer
    parts.push(`*Context size: ~${context.estimatedTokens} tokens*`);

    return parts.join("\n");
  }
}

// Singleton instance
export const contextBuilder = new ContextBuilder();

/**
 * Helper: Build and format context in one call
 */
export async function buildFormattedContext(options: ContextBuildOptions): Promise<string> {
  const context = await contextBuilder.buildContext(options);
  return contextBuilder.formatContext(context);
}
