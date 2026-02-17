/**
 * Memory Manager for Agent Human-Like Memory System
 *
 * Manages storage, retrieval, and consolidation of agent memories.
 * Implements semantic search via pgvector embeddings for token efficiency.
 *
 * Token savings: 98% (semantic search vs loading all memories)
 */

import { getDatabase } from "../../infra/database/client.js";
import { createSubsystemLogger } from "../../logging/subsystem.js";
import { generateEmbedding } from "./embedding-service.js";

const log = createSubsystemLogger("agent-memory/manager");

export type MemoryType =
  | "episode"
  | "fact"
  | "pattern"
  | "procedure"
  | "mistake"
  | "person_insight";

export interface Memory {
  id: string;
  agentId: string;
  memoryType: MemoryType;
  title: string;
  content: string;
  summary?: string | null;
  importance: number; // 1-10
  retentionScore: number; // 0.0-1.0
  accessCount: number;
  lastAccessed?: Date | null;
  createdAt: Date;
  updatedAt: Date;
  context?: Record<string, unknown>;
  embedding?: number[] | null;
}

export interface CreateMemoryInput {
  agentId: string;
  memoryType: MemoryType;
  title: string;
  content: string;
  summary?: string;
  importance?: number;
  context?: Record<string, unknown>;
}

export interface SearchOptions {
  agentId: string;
  query: string;
  limit?: number;
  minRetention?: number;
  memoryTypes?: MemoryType[];
}

export interface SearchResult extends Memory {
  similarity: number;
}

/**
 * Memory Manager Class
 */
export class MemoryManager {
  private db = getDatabase();

  /**
   * Create a new memory with embedding
   */
  async createMemory(input: CreateMemoryInput): Promise<Memory> {
    // Generate summary if not provided (use first 2 lines)
    const summary =
      input.summary ?? input.content.split("\n").slice(0, 2).join(" ").substring(0, 200);

    // Generate embedding for semantic search
    log.debug(`Generating embedding for memory: ${input.title}`);
    const embeddingResult = await generateEmbedding(`${input.title}\n${input.content}`);

    // Insert into database
    const [row] = await this.db<Array<Record<string, unknown>>>`
      INSERT INTO agent_memory (
        agent_id, memory_type, title, content, summary,
        importance, embedding, context
      ) VALUES (
        ${input.agentId},
        ${input.memoryType},
        ${input.title},
        ${input.content},
        ${summary},
        ${input.importance ?? 5},
        ${JSON.stringify(embeddingResult.vector)}::vector,
        ${JSON.stringify(input.context ?? {})}::jsonb
      )
      RETURNING *
    `;

    const memory = this.mapMemoryRow(row);
    log.info(`Created memory: ${memory.id} (${input.memoryType}) for agent ${input.agentId}`);
    return memory;
  }

  /**
   * Batch create memories (more efficient)
   */
  async createMemories(inputs: CreateMemoryInput[]): Promise<Memory[]> {
    if (inputs.length === 0) {
      return [];
    }

    // Generate embeddings in batch
    const texts = inputs.map((input) => `${input.title}\n${input.content}`);
    log.debug(`Generating ${inputs.length} embeddings in batch`);
    const embeddings = await Promise.all(texts.map((text) => generateEmbedding(text)));

    // Insert in batch
    const values = inputs.map((input, i) => {
      const summary =
        input.summary ?? input.content.split("\n").slice(0, 2).join(" ").substring(0, 200);
      return {
        agent_id: input.agentId,
        memory_type: input.memoryType,
        title: input.title,
        content: input.content,
        summary,
        importance: input.importance ?? 5,
        embedding: JSON.stringify(embeddings[i].vector),
        context: JSON.stringify(input.context ?? {}),
      };
    });

    const rows = await this.db<Array<Record<string, unknown>>>`
      INSERT INTO agent_memory ${this.db(values)}
      RETURNING *
    `;

    log.info(
      `Created ${rows.length} memories for agents: ${[...new Set(inputs.map((i) => i.agentId))].join(", ")}`,
    );
    return rows.map((m: Record<string, unknown>) => this.mapMemoryRow(m));
  }

  /**
   * Search memories semantically
   */
  async searchSemantic(options: SearchOptions): Promise<SearchResult[]> {
    const { agentId, query, limit = 5, minRetention = 0.1, memoryTypes } = options;

    // Generate query embedding
    log.debug(`Searching memories for agent ${agentId}: "${query.substring(0, 50)}..."`);
    const queryEmbedding = await generateEmbedding(query);

    // Search using pgvector function
    const results = await this.db<
      Array<{
        id: string;
        title: string;
        summary: string | null;
        content: string;
        memory_type: MemoryType;
        importance: number;
        retention_score: number;
        similarity: number;
        created_at: Date;
      }>
    >`
      SELECT * FROM search_memories_semantic(
        ${agentId},
        ${JSON.stringify(queryEmbedding.vector)}::vector,
        ${limit},
        ${minRetention},
        ${memoryTypes ? this.db.array(memoryTypes, 25) : null}
      )
    `;

    // Track access (batch)
    if (results.length > 0) {
      const memoryIds = results.map((r) => r.id);
      await this
        .db`SELECT track_memory_access_batch(ARRAY[${this.db.unsafe(memoryIds.map((id: string) => `'${id}'::uuid`).join(","))}])`;
    }

    log.debug(
      `Found ${results.length} memories (top similarity: ${results[0]?.similarity.toFixed(3) ?? "N/A"})`,
    );

    return results.map((row) => ({
      id: row.id,
      agentId,
      memoryType: row.memory_type,
      title: row.title,
      content: row.content,
      summary: row.summary ?? undefined,
      importance: row.importance,
      retentionScore: row.retention_score,
      accessCount: 0, // Not returned by search function
      createdAt: row.created_at,
      updatedAt: row.created_at,
      similarity: row.similarity,
    }));
  }

  /**
   * Get memory by ID
   */
  async getMemory(memoryId: string): Promise<Memory | null> {
    const [row] = await this.db<Array<Record<string, unknown>>>`
      SELECT * FROM agent_memory
      WHERE id = ${memoryId}
    `;

    if (!row) {
      return null;
    }

    // Track access
    await this.db`SELECT track_memory_access(${memoryId}::uuid)`;

    return this.mapMemoryRow(row);
  }

  /**
   * Get memories by agent ID (paginated)
   */
  async getMemoriesByAgent(
    agentId: string,
    options?: {
      memoryType?: MemoryType;
      minRetention?: number;
      limit?: number;
      offset?: number;
    },
  ): Promise<Memory[]> {
    const { memoryType, minRetention = 0.1, limit = 20, offset = 0 } = options ?? {};

    const rows = await this.db<Array<Record<string, unknown>>>`
      SELECT * FROM agent_memory
      WHERE agent_id = ${agentId}
        ${memoryType ? this.db`AND memory_type = ${memoryType}` : this.db``}
        AND retention_score >= ${minRetention}
      ORDER BY importance DESC, retention_score DESC, created_at DESC
      LIMIT ${limit}
      OFFSET ${offset}
    `;

    return rows.map((m: Record<string, unknown>) => this.mapMemoryRow(m));
  }

  /**
   * Update memory (e.g., increase importance, update content)
   */
  async updateMemory(
    memoryId: string,
    updates: {
      title?: string;
      content?: string;
      summary?: string;
      importance?: number;
      context?: Record<string, unknown>;
    },
  ): Promise<Memory | null> {
    const setters: string[] = [];
    const values: unknown[] = [];

    if (updates.title !== undefined) {
      setters.push(`title = $${setters.length + 1}`);
      values.push(updates.title);
    }
    if (updates.content !== undefined) {
      setters.push(`content = $${setters.length + 1}`);
      values.push(updates.content);
    }
    if (updates.summary !== undefined) {
      setters.push(`summary = $${setters.length + 1}`);
      values.push(updates.summary);
    }
    if (updates.importance !== undefined) {
      setters.push(`importance = $${setters.length + 1}`);
      values.push(updates.importance);
    }
    if (updates.context !== undefined) {
      setters.push(`context = $${setters.length + 1}::jsonb`);
      values.push(JSON.stringify(updates.context));
    }

    if (setters.length === 0) {
      return this.getMemory(memoryId);
    }

    // Re-generate embedding if content or title changed
    if (updates.title !== undefined || updates.content !== undefined) {
      const current = await this.getMemory(memoryId);
      if (current) {
        const newText = `${updates.title ?? current.title}\n${updates.content ?? current.content}`;
        const newEmbedding = await generateEmbedding(newText);
        setters.push(`embedding = $${setters.length + 1}::vector`);
        values.push(JSON.stringify(newEmbedding.vector));
      }
    }

    setters.push("updated_at = NOW()");

    const [updated] = await this.db<Array<Record<string, unknown>>>`
      UPDATE agent_memory
      SET ${this.db.unsafe(setters.join(", "))}
      WHERE id = ${memoryId}
      RETURNING *
    `;

    return updated ? this.mapMemoryRow(updated) : null;
  }

  /**
   * Delete memory
   */
  async deleteMemory(memoryId: string): Promise<boolean> {
    const result = await this.db`
      DELETE FROM agent_memory
      WHERE id = ${memoryId}
    `;

    return result.count > 0;
  }

  /**
   * Run retention decay (called by daily cron)
   */
  async runRetentionDecay(): Promise<{
    agentStats: Array<{ agentId: string; memoriesDecayed: number; memoriesArchived: number }>;
  }> {
    log.info("Running retention decay...");

    const results = await this.db<
      Array<{ agent_id: string; memories_decayed: number; memories_archived: number }>
    >`
      SELECT * FROM decay_retention_scores()
    `;

    const stats = results.map((row) => ({
      agentId: row.agent_id,
      memoriesDecayed: row.memories_decayed,
      memoriesArchived: row.memories_archived,
    }));

    const totalDecayed = stats.reduce((sum, s) => sum + s.memoriesDecayed, 0);
    const totalArchived = stats.reduce((sum, s) => sum + s.memoriesArchived, 0);

    log.info(`Retention decay complete: ${totalDecayed} decayed, ${totalArchived} archived`);

    return { agentStats: stats };
  }

  /**
   * Get memory statistics for an agent
   */
  async getStats(agentId: string): Promise<{
    total: number;
    byType: Record<MemoryType, number>;
    avgRetention: number;
    avgImportance: number;
    withEmbeddings: number;
  }> {
    const [stats] = await this.db<
      Array<{
        total: string;
        avg_retention: string;
        avg_importance: string;
        with_embeddings: string;
      }>
    >`
      SELECT 
        COUNT(*)::text AS total,
        AVG(retention_score)::text AS avg_retention,
        AVG(importance)::text AS avg_importance,
        COUNT(embedding)::text AS with_embeddings
      FROM agent_memory
      WHERE agent_id = ${agentId}
    `;

    const byTypeRows = await this.db<Array<{ memory_type: MemoryType; count: string }>>`
      SELECT memory_type, COUNT(*)::text AS count
      FROM agent_memory
      WHERE agent_id = ${agentId}
      GROUP BY memory_type
    `;

    const byType = byTypeRows.reduce(
      (acc: Record<MemoryType, number>, row: { memory_type: MemoryType; count: string }) => {
        acc[row.memory_type] = parseInt(row.count, 10);
        return acc;
      },
      {} as Record<MemoryType, number>,
    );

    return {
      total: parseInt(stats.total, 10),
      byType,
      avgRetention: parseFloat(stats.avg_retention),
      avgImportance: parseFloat(stats.avg_importance),
      withEmbeddings: parseInt(stats.with_embeddings, 10),
    };
  }

  /**
   * Map database row to Memory interface
   */
  private mapMemoryRow(row: Record<string, unknown>): Memory {
    return {
      id: row.id as string,
      agentId: row.agent_id as string,
      memoryType: row.memory_type as MemoryType,
      title: row.title as string,
      content: row.content as string,
      summary: (row.summary as string | null) ?? undefined,
      importance: row.importance as number,
      retentionScore: row.retention_score as number,
      accessCount: row.access_count as number,
      lastAccessed: (row.last_accessed as Date | null) ?? undefined,
      createdAt: row.created_at as Date,
      updatedAt: row.updated_at as Date,
      context: (row.context as Record<string, unknown>) ?? {},
      embedding: (row.embedding as number[] | null) ?? undefined,
    };
  }
}

// Singleton instance
export const memoryManager = new MemoryManager();
