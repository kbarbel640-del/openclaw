/**
 * Cortex Bridge - TypeScript wrapper for Python Cortex memory system
 *
 * PHASE 1 MEMORY EXPANSION:
 * - Full memory index loaded into RAM (microsecond retrieval)
 * - 50,000 item STM capacity
 * - Active Session layer (last 50 messages always in context)
 * - Write-through caching (RAM + SQLite)
 *
 * With 66GB available RAM, we can cache everything and eliminate disk I/O latency.
 */
import { spawn } from "node:child_process";
import { readFile, writeFile, access, constants } from "node:fs/promises";
import { join } from "node:path";
import { homedir } from "node:os";

export interface CortexMemory {
  id: string;
  content: string;
  source: string;
  category: string | null;
  timestamp: string;
  importance: number;
  access_count: number;
  score?: number;
  recency_score?: number;
  semantic_score?: number;
  embedding?: number[]; // Cached embedding vector
}

export interface CortexSearchOptions {
  limit?: number;
  temporalWeight?: number;
  dateRange?: string | [string, string];
  category?: string;
}

export interface STMItem {
  content: string;
  timestamp: string;
  category: string;
  importance: number;
  access_count: number;
}

export interface ActiveSessionMessage {
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: string;
  messageId?: string;
}

/**
 * L2 - Active Session Cache
 * Last N messages always in RAM, never expires during session
 */
export class ActiveSessionCache {
  private messages: ActiveSessionMessage[] = [];
  private readonly maxMessages: number;

  constructor(maxMessages = 50) {
    this.maxMessages = maxMessages;
  }

  add(message: ActiveSessionMessage): void {
    this.messages.push({
      ...message,
      timestamp: message.timestamp || new Date().toISOString(),
    });
    // Keep only last N messages
    if (this.messages.length > this.maxMessages) {
      this.messages = this.messages.slice(-this.maxMessages);
    }
  }

  getRecent(count?: number): ActiveSessionMessage[] {
    const n = count ?? this.maxMessages;
    return this.messages.slice(-n);
  }

  getAll(): ActiveSessionMessage[] {
    return [...this.messages];
  }

  search(query: string): ActiveSessionMessage[] {
    const terms = query.toLowerCase().split(/\s+/).filter(t => t.length > 2);
    if (terms.length === 0) {
      return [];
    }
    return this.messages.filter(msg => {
      const content = msg.content.toLowerCase();
      return terms.some(term => content.includes(term));
    });
  }

  clear(): void {
    this.messages = [];
  }

  get count(): number {
    return this.messages.length;
  }

  get sizeBytes(): number {
    return this.messages.reduce((sum, m) => sum + m.content.length * 2, 0);
  }
}

/**
 * L3/L4 - Full Memory Index Cache
 * All memories loaded into RAM for microsecond retrieval
 */
export class MemoryIndexCache {
  private memories: Map<string, CortexMemory> = new Map();
  private byCategory: Map<string, Set<string>> = new Map();
  private accessRanking: Map<string, number> = new Map(); // id -> composite score
  private initialized = false;
  private lastRefresh: number = 0;

  async loadFromDaemon(embeddingsUrl: string): Promise<number> {
    try {
      // Fetch all memories from the embeddings daemon
      const response = await fetch(`${embeddingsUrl}/dump`, {
        method: "GET",
        signal: AbortSignal.timeout(30000),
      });

      if (!response.ok) {
        // Daemon doesn't support /dump, fall back to stats only
        return 0;
      }

      const data = await response.json() as { memories: CortexMemory[] };
      this.loadMemories(data.memories);
      return data.memories.length;
    } catch {
      return 0;
    }
  }

  loadMemories(memories: CortexMemory[]): void {
    this.memories.clear();
    this.byCategory.clear();
    this.accessRanking.clear();

    for (const memory of memories) {
      this.memories.set(memory.id, memory);

      // Index by category
      const category = memory.category ?? "general";
      if (!this.byCategory.has(category)) {
        this.byCategory.set(category, new Set());
      }
      this.byCategory.get(category)!.add(memory.id);

      // Calculate access ranking (recency × access_count × importance)
      const recency = this.calculateRecency(memory.timestamp);
      const score = recency * (memory.access_count + 1) * memory.importance;
      this.accessRanking.set(memory.id, score);
    }

    this.initialized = true;
    this.lastRefresh = Date.now();
  }

  private calculateRecency(timestamp: string): number {
    const now = Date.now();
    const then = new Date(timestamp).getTime();
    const ageHours = (now - then) / (1000 * 60 * 60);
    // Exponential decay with ~7 day half-life for long-term memories
    return Math.exp(-ageHours / 168);
  }

  add(memory: CortexMemory): void {
    this.memories.set(memory.id, memory);

    const category = memory.category ?? "general";
    if (!this.byCategory.has(category)) {
      this.byCategory.set(category, new Set());
    }
    this.byCategory.get(category)!.add(memory.id);

    const recency = this.calculateRecency(memory.timestamp);
    const score = recency * (memory.access_count + 1) * memory.importance;
    this.accessRanking.set(memory.id, score);
  }

  get(id: string): CortexMemory | undefined {
    const memory = this.memories.get(id);
    if (memory) {
      // Increment access count in cache
      memory.access_count = (memory.access_count || 0) + 1;
      // Update ranking
      const recency = this.calculateRecency(memory.timestamp);
      const score = recency * memory.access_count * memory.importance;
      this.accessRanking.set(id, score);
    }
    return memory;
  }

  getByCategory(category: string): CortexMemory[] {
    const ids = this.byCategory.get(category);
    if (!ids) {
      return [];
    }
    return Array.from(ids)
      .map(id => this.memories.get(id))
      .filter((m): m is CortexMemory => m !== undefined);
  }

  getHotMemories(limit = 500): CortexMemory[] {
    // Get top N memories by access ranking
    const sorted = Array.from(this.accessRanking.entries())
      .toSorted((a, b) => b[1] - a[1])
      .slice(0, limit);

    return sorted
      .map(([id]) => this.memories.get(id))
      .filter((m): m is CortexMemory => m !== undefined);
  }

  searchByKeyword(query: string, limit = 10): CortexMemory[] {
    const terms = query.toLowerCase().split(/\s+/).filter(t => t.length > 2);
    if (terms.length === 0) {
      return [];
    }

    const matches: Array<{ memory: CortexMemory; score: number }> = [];

    for (const memory of this.memories.values()) {
      const content = memory.content.toLowerCase();
      let matchCount = 0;
      for (const term of terms) {
        if (content.includes(term)) {
          matchCount++;
        }
      }

      if (matchCount > 0) {
        const keywordScore = matchCount / terms.length;
        const recency = this.calculateRecency(memory.timestamp);
        const accessScore = this.accessRanking.get(memory.id) ?? 0;
        const combinedScore = keywordScore * 0.4 + recency * 0.3 + (accessScore / 1000) * 0.3;
        matches.push({ memory, score: combinedScore });
      }
    }

    return matches
      .toSorted((a, b) => b.score - a.score)
      .slice(0, limit)
      .map(m => ({ ...m.memory, score: m.score }));
  }

  prefetchCategory(category: string): CortexMemory[] {
    // Immediately load all memories for a category into "hot" state
    const memories = this.getByCategory(category);
    for (const memory of memories) {
      // Boost access ranking for prefetched items
      const current = this.accessRanking.get(memory.id) ?? 0;
      this.accessRanking.set(memory.id, current * 1.5);
    }
    return memories;
  }

  get isInitialized(): boolean {
    return this.initialized;
  }

  get totalCount(): number {
    return this.memories.size;
  }

  get categories(): string[] {
    return Array.from(this.byCategory.keys());
  }

  get sizeBytes(): number {
    let total = 0;
    for (const memory of this.memories.values()) {
      total += memory.content.length * 2; // Rough estimate: 2 bytes per char
      total += 200; // Metadata overhead estimate
      if (memory.embedding) {
        total += memory.embedding.length * 8; // 8 bytes per float64
      }
    }
    return total;
  }

  getStats(): { total: number; byCategory: Record<string, number>; sizeBytes: number; hotCount: number } {
    const byCategory: Record<string, number> = {};
    for (const [cat, ids] of this.byCategory.entries()) {
      byCategory[cat] = ids.size;
    }
    return {
      total: this.memories.size,
      byCategory,
      sizeBytes: this.sizeBytes,
      hotCount: Math.min(500, this.memories.size),
    };
  }
}

export class CortexBridge {
  private memoryDir: string;
  private pythonPath: string;
  private embeddingsUrl: string;

  // RAM Caches
  public readonly activeSession: ActiveSessionCache;
  public readonly memoryIndex: MemoryIndexCache;
  private stmCache: STMItem[] | null = null;
  private stmCacheTime: number = 0;
  private readonly stmCacheTTL = 5000; // 5 second TTL for STM cache

  // Configuration
  public readonly stmCapacity = 50000; // PHASE 1: Massive STM capacity
  public readonly activeSessionCapacity = 50; // Last 50 messages always in RAM

  constructor(options?: { memoryDir?: string; pythonPath?: string; embeddingsUrl?: string }) {
    this.memoryDir = options?.memoryDir ?? join(homedir(), ".openclaw", "workspace", "memory");
    this.pythonPath = options?.pythonPath ?? "python3";
    this.embeddingsUrl = options?.embeddingsUrl ?? "http://localhost:8030";

    // Initialize RAM caches
    this.activeSession = new ActiveSessionCache(this.activeSessionCapacity);
    this.memoryIndex = new MemoryIndexCache();
  }

  /**
   * PHASE 1: Warm up all caches on startup
   * Loads full memory index into RAM for microsecond retrieval
   */
  async warmupCaches(): Promise<{ stm: number; memories: number; activeSession: number }> {
    const results = { stm: 0, memories: 0, activeSession: 0 };

    // Load STM into cache
    try {
      const stmData = await this.loadSTMDirect();
      this.stmCache = stmData.short_term_memory;
      this.stmCacheTime = Date.now();
      results.stm = this.stmCache.length;
    } catch {
      // STM load failed, will fall back to on-demand
    }

    // Try to load full memory index from daemon
    try {
      results.memories = await this.memoryIndex.loadFromDaemon(this.embeddingsUrl);
    } catch {
      // Daemon doesn't support dump, index will be populated on-demand
    }

    results.activeSession = this.activeSession.count;
    return results;
  }

  /**
   * Add message to Active Session cache (L2)
   */
  trackMessage(role: "user" | "assistant" | "system", content: string, messageId?: string): void {
    this.activeSession.add({
      role,
      content,
      timestamp: new Date().toISOString(),
      messageId,
    });
  }

  /**
   * Get recent context from Active Session (L2)
   * This is what fixes "forgot 5 messages ago"
   */
  getRecentContext(count = 10): string {
    const messages = this.activeSession.getRecent(count);
    if (messages.length === 0) {
      return "";
    }
    return messages.map(m => `[${m.role}] ${m.content.slice(0, 200)}`).join("\n");
  }

  /**
   * Search Active Session for recent context
   */
  searchActiveSession(query: string): ActiveSessionMessage[] {
    return this.activeSession.search(query);
  }

  /**
   * Check if the embeddings daemon is running
   */
  async isEmbeddingsDaemonAvailable(): Promise<boolean> {
    try {
      const response = await fetch(`${this.embeddingsUrl}/health`, {
        signal: AbortSignal.timeout(2000)
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * Semantic search using the GPU embeddings daemon (fast path)
   * Now with RAM cache integration
   */
  async semanticSearch(
    query: string,
    options: { limit?: number; temporalWeight?: number; minScore?: number } = {}
  ): Promise<Array<{ content: string; category: string | null; importance: number; score: number; semantic: number }>> {
    const { limit = 5, temporalWeight = 0.3, minScore = 0.3 } = options;

    // First, try RAM cache keyword search (microseconds)
    if (this.memoryIndex.isInitialized) {
      const cachedResults = this.memoryIndex.searchByKeyword(query, limit * 2);
      if (cachedResults.length >= limit) {
        return cachedResults.slice(0, limit).map(r => ({
          content: r.content,
          category: r.category,
          importance: r.importance,
          score: r.score ?? 0.5,
          semantic: 0.5, // Keyword match, not semantic
        }));
      }
    }

    // Fall back to GPU semantic search
    try {
      const response = await fetch(`${this.embeddingsUrl}/search`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query, limit: limit * 2, temporal_weight: temporalWeight }),
        signal: AbortSignal.timeout(5000),
      });

      if (!response.ok) {
        throw new Error(`Embeddings search failed: ${response.status}`);
      }

      const data = await response.json() as { results: Array<{ content: string; category: string | null; importance: number; score: number; semantic: number }> };

      // Cache results in memory index
      for (const result of data.results) {
        if (result.score >= minScore) {
          this.memoryIndex.add({
            id: `search-${Date.now()}-${Math.random().toString(36).slice(2)}`,
            content: result.content,
            source: "search",
            category: result.category,
            timestamp: new Date().toISOString(),
            importance: result.importance,
            access_count: 1,
            score: result.score,
            semantic_score: result.semantic,
          });
        }
      }

      return data.results
        .filter(r => r.score >= minScore)
        .slice(0, limit);
    } catch {
      // Fall back to Python-based search if daemon unavailable
      console.warn("Embeddings daemon unavailable, falling back to Python search");
      const results = await this.searchMemories(query, { limit, temporalWeight });
      return results.map(r => ({
        content: r.content,
        category: r.category,
        importance: r.importance,
        score: r.score ?? 0.5,
        semantic: r.semantic_score ?? 0.5,
      }));
    }
  }

  /**
   * Store memory using the GPU embeddings daemon (fast path)
   * With write-through to RAM cache
   */
  async storeMemoryFast(
    content: string,
    options: { category?: string; importance?: number } = {}
  ): Promise<string> {
    const { category, importance = 1.0 } = options;
    const timestamp = new Date().toISOString();
    const id = `mem-${Date.now()}-${Math.random().toString(36).slice(2)}`;

    // Write to RAM cache immediately
    this.memoryIndex.add({
      id,
      content,
      source: "agent",
      category: category ?? null,
      timestamp,
      importance,
      access_count: 0,
    });

    // Then persist to daemon/SQLite
    try {
      const response = await fetch(`${this.embeddingsUrl}/store`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content, category, importance, timestamp }),
        signal: AbortSignal.timeout(5000),
      });

      if (!response.ok) {
        throw new Error(`Embeddings store failed: ${response.status}`);
      }

      const data = await response.json() as { id: string };
      return data.id;
    } catch {
      // Fall back to Python-based storage
      return this.addMemory(content, { category, importance });
    }
  }

  /**
   * Predictive prefetch - load all memories for a category into hot cache
   */
  async prefetchCategory(category: string): Promise<number> {
    const memories = this.memoryIndex.prefetchCategory(category);
    return memories.length;
  }

  /**
   * Get hot memories (most accessed/recent)
   */
  getHotMemories(limit = 100): CortexMemory[] {
    return this.memoryIndex.getHotMemories(limit);
  }

  /**
   * Check if Cortex is available (Python scripts exist)
   */
  async isAvailable(): Promise<boolean> {
    try {
      await access(join(this.memoryDir, "stm_manager.py"), constants.R_OK);
      await access(join(this.memoryDir, "embeddings_manager.py"), constants.R_OK);
      await access(join(this.memoryDir, "collections_manager.py"), constants.R_OK);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Run a Python script and return JSON result
   */
  private async runPython(code: string): Promise<unknown> {
    return new Promise((resolve, reject) => {
      const proc = spawn(this.pythonPath, ["-c", code], {
        cwd: this.memoryDir,
        env: { ...process.env, PYTHONPATH: this.memoryDir },
      });

      let stdout = "";
      let stderr = "";

      proc.stdout.on("data", (data) => {
        stdout += data.toString();
      });

      proc.stderr.on("data", (data) => {
        stderr += data.toString();
      });

      proc.on("close", (code) => {
        if (code !== 0) {
          reject(new Error(`Python error: ${stderr || "Unknown error"}`));
          return;
        }
        try {
          resolve(JSON.parse(stdout));
        } catch {
          resolve(stdout.trim());
        }
      });

      proc.on("error", reject);
    });
  }

  /**
   * Add to short-term memory
   * PHASE 1: Now with 50,000 item capacity
   */
  async addToSTM(content: string, category?: string, importance: number = 1.0): Promise<STMItem> {
    const item: STMItem = {
      content,
      timestamp: new Date().toISOString(),
      category: category ?? "general",
      importance,
      access_count: 0,
    };

    // Update RAM cache immediately
    if (this.stmCache) {
      this.stmCache.push(item);
      // Trim to capacity
      if (this.stmCache.length > this.stmCapacity) {
        this.stmCache = this.stmCache.slice(-this.stmCapacity);
      }
    }

    // Persist via Python
    const code = `
import json
import sys
sys.path.insert(0, '${this.memoryDir}')
from stm_manager import add_to_stm
result = add_to_stm(${JSON.stringify(content)}, category=${category ? JSON.stringify(category) : "None"}, importance=${importance})
print(json.dumps(result))
`;
    return (await this.runPython(code)) as STMItem;
  }

  /**
   * Get recent items from STM
   * PHASE 1: Uses RAM cache when available (microsecond access)
   */
  async getRecentSTM(limit: number = 10, category?: string): Promise<STMItem[]> {
    // Check RAM cache first
    const cacheAge = Date.now() - this.stmCacheTime;
    if (this.stmCache && cacheAge < this.stmCacheTTL) {
      let items = this.stmCache;
      if (category) {
        items = items.filter(i => i.category === category);
      }
      return items.slice(-limit).toReversed();
    }

    // Cache miss or stale - refresh from disk
    const code = `
import json
import sys
sys.path.insert(0, '${this.memoryDir}')
from stm_manager import get_recent
result = get_recent(limit=${limit}, category=${category ? JSON.stringify(category) : "None"})
print(json.dumps(result))
`;
    const result = (await this.runPython(code)) as STMItem[];

    // Update cache
    if (!category) {
      // Only cache full results
      const stmData = await this.loadSTMDirect();
      this.stmCache = stmData.short_term_memory;
      this.stmCacheTime = Date.now();
    }

    return result;
  }

  /**
   * Search memories with temporal weighting
   */
  async searchMemories(query: string, options: CortexSearchOptions = {}): Promise<CortexMemory[]> {
    const { limit = 10, temporalWeight = 0.7, dateRange, category } = options;

    let dateRangeArg = "None";
    if (typeof dateRange === "string") {
      dateRangeArg = JSON.stringify(dateRange);
    } else if (Array.isArray(dateRange)) {
      dateRangeArg = JSON.stringify(dateRange);
    }

    const code = `
import json
import sys
sys.path.insert(0, '${this.memoryDir}')
from embeddings_manager import search_memories, init_db
init_db()
result = search_memories(
    ${JSON.stringify(query)},
    limit=${limit},
    temporal_weight=${temporalWeight},
    date_range=${dateRangeArg},
    category=${category ? JSON.stringify(category) : "None"}
)
print(json.dumps(result))
`;
    return (await this.runPython(code)) as CortexMemory[];
  }

  /**
   * Add memory to embeddings database
   */
  async addMemory(
    content: string,
    options: {
      source?: string;
      category?: string;
      importance?: number;
    } = {},
  ): Promise<string> {
    const { source = "agent", category, importance = 1.0 } = options;

    // Add to RAM cache
    const id = `mem-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    this.memoryIndex.add({
      id,
      content,
      source,
      category: category ?? null,
      timestamp: new Date().toISOString(),
      importance,
      access_count: 0,
    });

    const code = `
import json
import sys
sys.path.insert(0, '${this.memoryDir}')
from embeddings_manager import add_memory, init_db
init_db()
result = add_memory(
    ${JSON.stringify(content)},
    source=${JSON.stringify(source)},
    category=${category ? JSON.stringify(category) : "None"},
    importance=${importance}
)
print(json.dumps(result))
`;
    return (await this.runPython(code)) as string;
  }

  /**
   * Get database statistics
   */
  async getStats(): Promise<{ total: number; by_category: Record<string, number>; by_source: Record<string, number> }> {
    const code = `
import json
import sys
sys.path.insert(0, '${this.memoryDir}')
from embeddings_manager import stats, init_db
init_db()
result = stats()
print(json.dumps(result))
`;
    return (await this.runPython(code)) as { total: number; by_category: Record<string, number>; by_source: Record<string, number> };
  }

  /**
   * Get extended stats including RAM cache info
   */
  getExtendedStats(): {
    stm: { count: number; capacity: number; cached: boolean };
    activeSession: { count: number; capacity: number; sizeBytes: number };
    memoryIndex: { total: number; byCategory: Record<string, number>; sizeBytes: number; initialized: boolean };
    totalRamUsageBytes: number;
  } {
    const stmCount = this.stmCache?.length ?? 0;
    const activeSessionStats = {
      count: this.activeSession.count,
      capacity: this.activeSessionCapacity,
      sizeBytes: this.activeSession.sizeBytes,
    };
    const memoryIndexStats = this.memoryIndex.getStats();

    return {
      stm: {
        count: stmCount,
        capacity: this.stmCapacity,
        cached: this.stmCache !== null,
      },
      activeSession: activeSessionStats,
      memoryIndex: {
        ...memoryIndexStats,
        initialized: this.memoryIndex.isInitialized,
      },
      totalRamUsageBytes: activeSessionStats.sizeBytes + memoryIndexStats.sizeBytes + (stmCount * 2000),
    };
  }

  /**
   * Sync STM and collections to embeddings database
   */
  async syncAll(): Promise<{ stm: number; collections: number }> {
    const code = `
import json
import sys
sys.path.insert(0, '${this.memoryDir}')
from embeddings_manager import sync_from_stm, sync_from_collections, init_db
init_db()
stm_count = sync_from_stm()
col_count = sync_from_collections()
print(json.dumps({"stm": stm_count, "collections": col_count}))
`;
    return (await this.runPython(code)) as { stm: number; collections: number };
  }

  /**
   * Run maintenance (cleanup expired STM, sync to embeddings)
   */
  async runMaintenance(mode: "nightly" | "weekly" = "nightly"): Promise<string> {
    const code = `
import sys
sys.path.insert(0, '${this.memoryDir}')
from maintenance import main
result = main(["${mode}"])
print(result or "OK")
`;
    return (await this.runPython(code)) as string;
  }

  /**
   * Load STM directly from JSON file
   */
  async loadSTMDirect(): Promise<{ short_term_memory: STMItem[]; capacity: number; auto_expire_days: number }> {
    const stmPath = join(this.memoryDir, "stm.json");
    try {
      const data = await readFile(stmPath, "utf-8");
      return JSON.parse(data);
    } catch {
      return { short_term_memory: [], capacity: this.stmCapacity, auto_expire_days: 30 };
    }
  }

  /**
   * Update STM capacity in the JSON file
   */
  async updateSTMCapacity(newCapacity: number): Promise<void> {
    const stmPath = join(this.memoryDir, "stm.json");
    try {
      const data = await this.loadSTMDirect();
      data.capacity = newCapacity;
      await writeFile(stmPath, JSON.stringify(data, null, 2));
    } catch (err) {
      console.error("Failed to update STM capacity:", err);
    }
  }
}

export const defaultBridge = new CortexBridge();
