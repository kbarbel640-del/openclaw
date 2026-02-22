/**
 * Brain Tiered Memory Manager
 *
 * Implements the 4-tier memory system:
 * - Tier 0: Local memory.md (always searched first)
 * - Tier 1: Brain MCP quick_search (<100ms)
 * - Tier 2: Brain MCP smart_search (vector + graph + rerank, ~200ms)
 * - Tier 3: Brain MCP unified_search full (<3000ms)
 *
 * Enforces tiered search programmatically - no LLM instruction dependency.
 */

import fs from "node:fs";
import path from "node:path";
import type { ResolvedBrainTieredConfig } from "../config/types.brain-tiered.js";
import type {
  MemoryEmbeddingProbeResult,
  MemoryProviderStatus,
  MemorySearchManager,
  MemorySearchResult,
  MemorySyncProgressUpdate,
} from "./types.js";
import { createSubsystemLogger } from "../logging/subsystem.js";
import { BrainMcpClient, createBrainMcpClient } from "./brain-mcp-client.js";

const log = createSubsystemLogger("brain-tiered");

type TierSource =
  | "tier0-memory"
  | "tier0-daily"
  | "tier1-quick"
  | "tier1-triumph"
  | "tier2-semantic"
  | "tier2-triumph"
  | "tier3-unified";

type InternalSearchResult = MemorySearchResult & {
  tierSource: TierSource;
};

export class BrainTieredManager implements MemorySearchManager {
  private readonly config: ResolvedBrainTieredConfig;
  private readonly brainClient: BrainMcpClient;
  private brainAvailable: boolean | null = null;
  private brainLastChecked: number = 0;
  /** Re-check availability every 60s when unavailable, every 5min when available */
  private static readonly RECHECK_INTERVAL_UNAVAILABLE_MS = 60_000;
  private static readonly RECHECK_INTERVAL_AVAILABLE_MS = 300_000;

  private constructor(config: ResolvedBrainTieredConfig) {
    this.config = config;
    this.brainClient = createBrainMcpClient({
      mcporterPath: config.mcporterPath,
      timeoutMs: config.tiers.timeoutMs,
    });
  }

  /**
   * Create a new BrainTieredManager instance.
   */
  static async create(config: ResolvedBrainTieredConfig): Promise<BrainTieredManager> {
    const manager = new BrainTieredManager(config);

    // Blocking health check at startup — agents MUST have accurate Brain state
    try {
      await manager.checkBrainAvailability();
    } catch {
      log.debug("Brain MCP not available at startup — will retry on next search");
    }

    return manager;
  }

  /**
   * Search across all tiers.
   *
   * ALWAYS searches Tier 0 first, then escalates to Brain MCP tiers as needed.
   * This is enforced by code, not LLM instructions.
   */
  async search(
    query: string,
    opts?: { maxResults?: number; minScore?: number; sessionKey?: string },
  ): Promise<MemorySearchResult[]> {
    const maxResults = opts?.maxResults ?? 10;
    const minScore = opts?.minScore ?? 0.0;
    const allResults: InternalSearchResult[] = [];

    // TIER 0: Always search local first (enforced by code)
    const tier0Results = await this.searchTier0(query);
    allResults.push(...tier0Results);

    log.debug(`Tier 0 found ${tier0Results.length} results`);

    // Check if Tier 0 results are sufficient
    const tier0Sufficient = this.isTier0Sufficient(tier0Results);

    if (tier0Sufficient) {
      log.debug("Tier 0 results sufficient, skipping Brain MCP tiers");
      return this.finalizeResults(allResults, maxResults, minScore);
    }

    // ESCALATE to Brain MCP tiers
    if (await this.isBrainAvailable()) {
      try {
        const brainResults = await this.searchBrainTiers(query);
        allResults.push(...brainResults);
        log.debug(`Brain tiers found ${brainResults.length} additional results`);
      } catch (error) {
        log.warn(`Brain MCP search failed, using Tier 0 only: ${error}`);
        // Graceful degradation - continue with Tier 0 results
      }
    } else {
      log.debug("Brain MCP not available, using Tier 0 only");
    }

    return this.finalizeResults(allResults, maxResults, minScore);
  }

  /**
   * Read a file from the memory directory.
   */
  async readFile(params: {
    relPath: string;
    from?: number;
    lines?: number;
  }): Promise<{ text: string; path: string }> {
    const workspaceDir = path.dirname(this.config.memoryMdPath);
    const fullPath = path.resolve(workspaceDir, params.relPath);

    if (!fs.existsSync(fullPath)) {
      throw new Error(`File not found: ${params.relPath}`);
    }

    const content = fs.readFileSync(fullPath, "utf-8");
    const allLines = content.split("\n");

    const from = params.from ?? 0;
    const lines = params.lines ?? allLines.length;
    const selectedLines = allLines.slice(from, from + lines);

    return {
      text: selectedLines.join("\n"),
      path: fullPath,
    };
  }

  /**
   * Get provider status.
   */
  status(): MemoryProviderStatus {
    return {
      backend: "brain-tiered" as const,
      provider: "brain-tiered",
      model: "BGE-M3",
      workspaceDir: path.dirname(this.config.memoryMdPath),
      custom: {
        brainWorkspaceId: this.config.workspaceId,
        triumphWorkspaceId: this.config.triumphWorkspaceId,
        mcporterPath: this.config.mcporterPath,
        brainAvailable: this.brainAvailable,
        tiers: this.config.tiers,
      },
    } as MemoryProviderStatus;
  }

  /**
   * Sync is handled by external cron (memory.md -> Brain MCP).
   * This method is a no-op for brain-tiered backend.
   */
  async sync(params?: {
    reason?: string;
    force?: boolean;
    progress?: (update: MemorySyncProgressUpdate) => void;
  }): Promise<void> {
    // Sync is handled by external cron job
    log.debug("Sync called - handled by external cron");
  }

  /**
   * Check if embeddings are available.
   */
  async probeEmbeddingAvailability(): Promise<MemoryEmbeddingProbeResult> {
    // Brain MCP uses BGE-M3 embeddings
    const brainOk = await this.isBrainAvailable();
    return {
      ok: brainOk,
      error: brainOk ? undefined : "Brain MCP not available",
    };
  }

  /**
   * Check if vector search is available.
   */
  async probeVectorAvailability(): Promise<boolean> {
    return await this.isBrainAvailable();
  }

  /**
   * Close the manager.
   */
  async close(): Promise<void> {
    log.debug("BrainTieredManager closed");
  }

  // ========== PRIVATE METHODS ==========

  /**
   * Search Tier 0 (local memory.md and daily notes).
   */
  private async searchTier0(query: string): Promise<InternalSearchResult[]> {
    const results: InternalSearchResult[] = [];

    // Search memory.md
    const memoryMdResults = await this.searchLocalFile(
      this.config.memoryMdPath,
      query,
      "tier0-memory",
    );
    results.push(...memoryMdResults);

    // Search daily notes directory
    const dailyResults = await this.searchDailyNotes(query);
    results.push(...dailyResults);

    return results;
  }

  /**
   * Search a local file for matching content.
   */
  private async searchLocalFile(
    filePath: string,
    query: string,
    source: TierSource,
  ): Promise<InternalSearchResult[]> {
    if (!fs.existsSync(filePath)) {
      return [];
    }

    const content = fs.readFileSync(filePath, "utf-8");
    const lines = content.split("\n");
    const results: InternalSearchResult[] = [];

    // Simple keyword matching with context
    const queryTerms = query.toLowerCase().split(/\s+/).filter(Boolean);

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineLower = line.toLowerCase();

      // Check if any query term matches
      const matchCount = queryTerms.filter((term) => lineLower.includes(term)).length;

      if (matchCount > 0) {
        // Calculate score based on match quality
        const score = matchCount / queryTerms.length;

        // Get context (3 lines before and after)
        const startLine = Math.max(0, i - 3);
        const endLine = Math.min(lines.length - 1, i + 3);
        const snippet = lines.slice(startLine, endLine + 1).join("\n");

        results.push({
          path: filePath,
          startLine: startLine + 1, // 1-indexed
          endLine: endLine + 1,
          score,
          snippet: snippet.slice(0, 700), // Limit snippet length
          source: "memory",
          tierSource: source,
        });
      }
    }

    // Deduplicate overlapping results
    return this.deduplicateResults(results);
  }

  /**
   * Search daily notes directory.
   */
  private async searchDailyNotes(query: string): Promise<InternalSearchResult[]> {
    const dailyDir = this.config.dailyNotesPath;

    if (!fs.existsSync(dailyDir)) {
      return [];
    }

    const results: InternalSearchResult[] = [];

    try {
      const files = fs.readdirSync(dailyDir).filter((f) => f.endsWith(".md"));

      for (const file of files) {
        const filePath = path.join(dailyDir, file);
        const fileResults = await this.searchLocalFile(filePath, query, "tier0-daily");
        results.push(...fileResults);
      }
    } catch (error) {
      log.debug(`Error reading daily notes: ${error}`);
    }

    return results;
  }

  /**
   * Check if Tier 0 results are sufficient (skip Brain MCP).
   */
  private isTier0Sufficient(results: InternalSearchResult[]): boolean {
    const { escalationThreshold, minTier0Results } = this.config.tiers;

    // Need minimum number of results
    if (results.length < minTier0Results) {
      return false;
    }

    // Best result must meet threshold
    const bestScore = results.length > 0 ? Math.max(...results.map((r) => r.score)) : 0;
    return bestScore >= escalationThreshold;
  }

  /**
   * Search Brain MCP tiers (1, 2, 3) on agent's private workspace only.
   * Triumph (shared) workspace is handled by the mission system's triumph inject.
   */
  private async searchBrainTiers(query: string): Promise<InternalSearchResult[]> {
    const results: InternalSearchResult[] = [];
    const { enabled, maxTier } = this.config.tiers;

    // Tier 1: quick_search on private workspace
    if (enabled.tier1 && maxTier >= 1) {
      try {
        const tier1Results = await this.searchTier1(query);
        results.push(...tier1Results);

        // Check if Tier 1 is sufficient
        if (this.isBrainTierSufficient(tier1Results)) {
          return results;
        }
      } catch (error) {
        log.debug(`Tier 1 search failed: ${error}`);
      }

      // Triumph workspace search removed — now handled by the mission system's
      // triumph inject (subagent-mission.ts) which uses unifiedSearch for better
      // semantic ranking. Recalled Memory focuses on agent's private workspace only.
    }

    // Tier 2: unified_search (semantic) on private workspace
    if (enabled.tier2 && maxTier >= 2) {
      try {
        const tier2Results = await this.searchTier2(query);
        results.push(...tier2Results);

        // Check if Tier 2 is sufficient
        if (this.isBrainTierSufficient(tier2Results)) {
          return results;
        }
      } catch (error) {
        log.debug(`Tier 2 search failed: ${error}`);
      }

      // Triumph workspace search removed — now handled by the mission system's
      // triumph inject (subagent-mission.ts) which uses unifiedSearch for better
      // semantic ranking. Recalled Memory focuses on agent's private workspace only.
    }

    // Tier 3: unified_search (full with relationships)
    if (enabled.tier3 && maxTier >= 3) {
      try {
        const tier3Results = await this.searchTier3(query);
        results.push(...tier3Results);
      } catch (error) {
        log.debug(`Tier 3 search failed: ${error}`);
      }
    }

    return results;
  }

  /**
   * Tier 1: Brain MCP quick_search.
   */
  private async searchTier1(query: string): Promise<InternalSearchResult[]> {
    const response = await this.brainClient.quickSearch({
      query,
      workspaceId: this.config.workspaceId,
      limit: 5,
    });

    return response.results.map((r) => ({
      path: `brain://${r.memory_id}`,
      startLine: 1,
      endLine: 1,
      score: r.similarity_score,
      snippet: r.preview.slice(0, 700),
      source: "memory" as const,
      tierSource: "tier1-quick" as const,
    }));
  }

  /**
   * Tier 1 Triumph: quick_search on shared workspace.
   */
  private async searchTriumphTier1(query: string): Promise<InternalSearchResult[]> {
    if (!this.config.triumphWorkspaceId) return [];

    const response = await this.brainClient.quickSearch({
      query,
      workspaceId: this.config.triumphWorkspaceId,
      limit: 5,
    });

    return response.results.map((r) => ({
      path: `brain://triumph/${r.memory_id}`,
      startLine: 1,
      endLine: 1,
      score: r.similarity_score,
      snippet: r.preview.slice(0, 700),
      source: "memory" as const,
      tierSource: "tier1-triumph" as const,
    }));
  }

  /**
   * Tier 2: Brain MCP smart_search (vector + graph + rerank).
   */
  private async searchTier2(query: string): Promise<InternalSearchResult[]> {
    const response = await this.brainClient.smartSearch({
      query,
      workspaceId: this.config.workspaceId,
      limit: 10,
    });

    return response.results.map((r) => ({
      path: `brain://${r.memory_id}`,
      startLine: 1,
      endLine: 1,
      score: r.relevance_score,
      snippet: r.content.slice(0, 700),
      source: "memory" as const,
      tierSource: "tier2-semantic" as const,
    }));
  }

  /**
   * Tier 2 Triumph: smart_search on shared workspace.
   */
  private async searchTriumphTier2(query: string): Promise<InternalSearchResult[]> {
    if (!this.config.triumphWorkspaceId) return [];

    const response = await this.brainClient.smartSearch({
      query,
      workspaceId: this.config.triumphWorkspaceId,
      limit: 10,
    });

    return response.results.map((r) => ({
      path: `brain://triumph/${r.memory_id}`,
      startLine: 1,
      endLine: 1,
      score: r.relevance_score,
      snippet: r.content.slice(0, 700),
      source: "memory" as const,
      tierSource: "tier2-triumph" as const,
    }));
  }

  /**
   * Tier 3: Brain MCP unified_search (full mode with relationships).
   */
  private async searchTier3(query: string): Promise<InternalSearchResult[]> {
    const response = await this.brainClient.unifiedSearch({
      query,
      workspaceId: this.config.workspaceId,
      mode: "unified",
      limit: 20,
      includeRelationships: true,
    });

    return response.results.map((r) => ({
      path: `brain://${r.memory_id}`,
      startLine: 1,
      endLine: 1,
      score: r.relevance_score,
      snippet: r.content.slice(0, 700),
      source: "memory" as const,
      tierSource: "tier3-unified" as const,
    }));
  }

  /**
   * Check if Brain tier results are sufficient.
   */
  private isBrainTierSufficient(results: InternalSearchResult[]): boolean {
    if (results.length < 3) {
      return false;
    }
    const bestScore = Math.max(...results.map((r) => r.score));
    return bestScore >= 0.7;
  }

  /**
   * Check Brain MCP availability and update cache timestamp.
   */
  private async checkBrainAvailability(): Promise<void> {
    this.brainAvailable = await this.brainClient.healthCheck();
    this.brainLastChecked = Date.now();
    log.debug(`Brain MCP available: ${this.brainAvailable}`);
  }

  /**
   * Check if Brain MCP is available (TTL-cached).
   *
   * Re-checks every 60s when unavailable (recover quickly from transient failures),
   * every 5min when available (detect if Brain goes down).
   * Never caches permanently — Brain must always be reachable.
   */
  private async isBrainAvailable(): Promise<boolean> {
    const now = Date.now();
    const elapsed = now - this.brainLastChecked;
    const ttl = this.brainAvailable
      ? BrainTieredManager.RECHECK_INTERVAL_AVAILABLE_MS
      : BrainTieredManager.RECHECK_INTERVAL_UNAVAILABLE_MS;

    if (this.brainAvailable === null || elapsed >= ttl) {
      await this.checkBrainAvailability();
    }
    return this.brainAvailable ?? false;
  }

  /**
   * Deduplicate overlapping results from the same file.
   */
  private deduplicateResults(results: InternalSearchResult[]): InternalSearchResult[] {
    const seen = new Map<string, InternalSearchResult>();

    for (const result of results) {
      const key = `${result.path}:${result.startLine}-${result.endLine}`;
      const existing = seen.get(key);

      if (!existing || result.score > existing.score) {
        seen.set(key, result);
      }
    }

    return Array.from(seen.values());
  }

  /**
   * Finalize results: sort, filter, limit.
   */
  private finalizeResults(
    results: InternalSearchResult[],
    maxResults: number,
    minScore: number,
  ): MemorySearchResult[] {
    // Filter by minimum score
    const filtered = results.filter((r) => r.score >= minScore);

    // Sort by score descending
    filtered.sort((a, b) => b.score - a.score);

    // Deduplicate across all tiers (by content similarity)
    const deduped = this.deduplicateAcrossTiers(filtered);

    // Limit results
    const limited = deduped.slice(0, maxResults);

    // Remove internal fields
    return limited.map(({ tierSource, ...rest }) => rest);
  }

  /**
   * Deduplicate results across tiers based on content.
   */
  private deduplicateAcrossTiers(results: InternalSearchResult[]): InternalSearchResult[] {
    const seen = new Set<string>();
    const deduped: InternalSearchResult[] = [];

    for (const result of results) {
      // Create a content fingerprint (first 100 chars)
      const fingerprint = result.snippet.slice(0, 100).toLowerCase().replace(/\s+/g, " ");

      if (!seen.has(fingerprint)) {
        seen.add(fingerprint);
        deduped.push(result);
      }
    }

    return deduped;
  }
}
