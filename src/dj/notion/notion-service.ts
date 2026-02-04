/**
 * Notion Service
 *
 * Higher-level helpers for DJ assistant Notion operations:
 * - WebOps Log entries
 * - Research Radar entries
 * - Site/Post entries with content fetch
 */

import { createHash } from "node:crypto";
import type { NotionClient } from "./notion-client.js";
import type {
  EpisodePipelineEntry,
  ImprovePlanEntry,
  ImproveOpportunityEntry,
  NotionBlock,
  NotionBulletedListItemBlock,
  NotionCodeBlock,
  NotionHeading1Block,
  NotionHeading2Block,
  NotionHeading3Block,
  NotionNumberedListItemBlock,
  NotionPage,
  NotionParagraphBlock,
  NotionQuoteBlock,
  NotionRichTextItem,
  NotionToDoBlock,
  PodcastAssetEntry,
  ResearchRadarEntry,
  RlmSessionEntry,
  SitePostEntry,
  WebOpsLogEntry,
} from "./types.js";
import { NotionApiError, NotionNotFoundError } from "./types.js";

// =============================================================================
// Configuration
// =============================================================================

export interface NotionServiceConfig {
  /** WebOps Log database/data source ID */
  webOpsDbId?: string;
  /** Research Radar database/data source ID */
  researchRadarDbId?: string;
  /** Posts database/data source ID */
  postsDbId?: string;
  /** Episode Pipeline database/data source ID (M5 Podcast) */
  episodePipelineDbId?: string;
  /** Podcast Assets database/data source ID (M5 Podcast) */
  podcastAssetsDbId?: string;
  /** RLM Sessions database/data source ID (M6 RLM) */
  rlmSessionsDbId?: string;
  /** Improve Plans database/data source ID (M6 Improve) */
  improvePlansDbId?: string;
  /** Improve Opportunities database/data source ID (M6 Improve) */
  improveOpportunitiesDbId?: string;
  /** Whether to throw on write errors (default: false - log locally and continue) */
  throwOnWriteError?: boolean;
}

// =============================================================================
// Notion Service
// =============================================================================

export class NotionService {
  constructor(
    private readonly _client: NotionClient,
    private readonly config: NotionServiceConfig = {},
  ) {}

  /**
   * Get the underlying Notion client for direct API access.
   */
  get client(): NotionClient {
    return this._client;
  }

  // ===========================================================================
  // WebOps Log Operations
  // ===========================================================================

  /**
   * Create a WebOps Log entry.
   * Non-fatal: logs error and returns null if write fails.
   */
  async createWebOpsLogEntry(entry: WebOpsLogEntry): Promise<NotionPage | null> {
    if (!this.config.webOpsDbId) {
      console.warn("[notion-service] WebOps database ID not configured, skipping write");
      return null;
    }

    try {
      return await this.client.createPage({
        parent: { database_id: this.config.webOpsDbId },
        properties: {
          // Title: WorkflowId for easy identification
          Name: {
            title: [{ type: "text", text: { content: entry.workflowId } }],
          },
          Task: {
            rich_text: [{ type: "text", text: { content: truncate(entry.task, 2000) } }],
          },
          StartedAt: {
            date: { start: entry.startedAt },
          },
          FinishedAt: {
            date: { start: entry.finishedAt },
          },
          Outcome: {
            select: { name: entry.outcome },
          },
          DomainsVisited: {
            rich_text: [{ type: "text", text: { content: entry.domainsVisited.join(", ") } }],
          },
          ActionClasses: {
            multi_select: entry.actionClasses.map((name) => ({ name })),
          },
          ApprovedCount: {
            number: entry.approvedCount,
          },
          AutoSubmitCount: {
            number: entry.autoSubmitCount,
          },
          Profile: {
            select: { name: entry.profile },
          },
          LocalLogPath: {
            rich_text: [{ type: "text", text: { content: entry.localLogPath } }],
          },
          ...(entry.error && {
            Error: {
              rich_text: [{ type: "text", text: { content: truncate(entry.error, 2000) } }],
            },
          }),
        },
      });
    } catch (error) {
      console.error("[notion-service] Failed to create WebOps log entry:", error);
      if (this.config.throwOnWriteError) {
        throw error;
      }
      return null;
    }
  }

  // ===========================================================================
  // Research Radar Operations
  // ===========================================================================

  /**
   * Check if a research entry already exists by cache key.
   */
  async findResearchByCacheKey(cacheKey: string): Promise<NotionPage | null> {
    if (!this.config.researchRadarDbId) {
      return null;
    }

    try {
      const response = await this.client.queryDataSource(this.config.researchRadarDbId, {
        filter: {
          property: "CacheKey",
          rich_text: { equals: cacheKey },
        },
        page_size: 1,
      });

      return response.results[0] ?? null;
    } catch (error) {
      console.error("[notion-service] Failed to query Research Radar:", error);
      return null;
    }
  }

  /**
   * Create or update a Research Radar entry.
   * Dedupes by cacheKey - if entry exists, updates it.
   * Non-fatal: logs error and returns null if write fails.
   */
  async saveResearchEntry(entry: ResearchRadarEntry): Promise<NotionPage | null> {
    if (!this.config.researchRadarDbId) {
      console.warn("[notion-service] Research Radar database ID not configured, skipping save");
      return null;
    }

    try {
      // Check for existing entry
      const existing = await this.findResearchByCacheKey(entry.cacheKey);

      const properties = {
        Name: {
          title: [{ type: "text", text: { content: truncate(entry.title, 200) } }],
        },
        Query: {
          rich_text: [{ type: "text", text: { content: entry.query } }],
        },
        Summary: {
          rich_text: [
            { type: "text", text: { content: entry.summary.map((s) => `• ${s}`).join("\n") } },
          ],
        },
        Citations: {
          rich_text: [
            {
              type: "text",
              text: {
                content: entry.citations.map((c) => `${c.title}: ${c.url}`).join("\n"),
              },
            },
          ],
        },
        NextActions: {
          rich_text: [
            {
              type: "text",
              text: { content: entry.nextActions.map((a) => `- [ ] ${a}`).join("\n") },
            },
          ],
        },
        ...(entry.uncertainty && {
          Uncertainty: {
            rich_text: [{ type: "text", text: { content: entry.uncertainty } }],
          },
        }),
        CacheKey: {
          rich_text: [{ type: "text", text: { content: entry.cacheKey } }],
        },
        Profile: {
          select: { name: entry.profile },
        },
        SearchCount: {
          number: entry.searchCount,
        },
        FetchCount: {
          number: entry.fetchCount,
        },
        ResearchedAt: {
          date: { start: new Date().toISOString() },
        },
      };

      if (existing) {
        // Update existing entry
        return await this.client.updatePage(existing.id, { properties });
      } else {
        // Create new entry
        return await this.client.createPage({
          parent: { database_id: this.config.researchRadarDbId },
          properties,
        });
      }
    } catch (error) {
      console.error("[notion-service] Failed to save Research Radar entry:", error);
      if (this.config.throwOnWriteError) {
        throw error;
      }
      return null;
    }
  }

  /**
   * Generate a cache key for a research query.
   */
  static generateResearchCacheKey(query: string): string {
    const normalized = query.toLowerCase().trim();
    return createHash("sha256").update(normalized).digest("hex").slice(0, 16);
  }

  // ===========================================================================
  // Site/Post Operations
  // ===========================================================================

  /**
   * Find a post by Squarespace draft ID.
   */
  async findPostByDraftId(squarespaceDraftId: string): Promise<NotionPage | null> {
    if (!this.config.postsDbId) {
      return null;
    }

    try {
      const response = await this.client.queryDataSource(this.config.postsDbId, {
        filter: {
          property: "SquarespaceDraftId",
          rich_text: { equals: squarespaceDraftId },
        },
        page_size: 1,
      });

      return response.results[0] ?? null;
    } catch (error) {
      console.error("[notion-service] Failed to query Posts:", error);
      return null;
    }
  }

  /**
   * Create a new post entry.
   */
  async createPostEntry(entry: SitePostEntry): Promise<NotionPage | null> {
    if (!this.config.postsDbId) {
      console.warn("[notion-service] Posts database ID not configured, skipping create");
      return null;
    }

    try {
      return await this.client.createPage({
        parent: { database_id: this.config.postsDbId },
        properties: this.buildPostProperties(entry),
      });
    } catch (error) {
      console.error("[notion-service] Failed to create post entry:", error);
      if (this.config.throwOnWriteError) {
        throw error;
      }
      return null;
    }
  }

  /**
   * Update an existing post entry.
   */
  async updatePostEntry(
    pageId: string,
    updates: Partial<SitePostEntry>,
  ): Promise<NotionPage | null> {
    try {
      return await this.client.updatePage(pageId, {
        properties: this.buildPostProperties(updates as SitePostEntry, true),
      });
    } catch (error) {
      console.error("[notion-service] Failed to update post entry:", error);
      if (this.config.throwOnWriteError) {
        throw error;
      }
      return null;
    }
  }

  /**
   * Build Notion properties for a post entry.
   */
  private buildPostProperties(
    entry: Partial<SitePostEntry>,
    isUpdate: boolean = false,
  ): Record<string, unknown> {
    const properties: Record<string, unknown> = {};

    if (entry.title !== undefined) {
      properties.Name = {
        title: [{ type: "text", text: { content: entry.title } }],
      };
    }

    if (entry.status !== undefined) {
      properties.Status = {
        select: { name: entry.status },
      };
    }

    if (entry.squarespaceDraftId !== undefined) {
      properties.SquarespaceDraftId = {
        rich_text: [{ type: "text", text: { content: entry.squarespaceDraftId } }],
      };
    }

    if (entry.template !== undefined) {
      properties.Template = {
        select: { name: entry.template },
      };
    }

    if (entry.content !== undefined) {
      properties.Content = {
        rich_text: [{ type: "text", text: { content: truncate(entry.content, 2000) } }],
      };
    }

    if (entry.contentHash !== undefined) {
      properties.ContentHash = {
        rich_text: [{ type: "text", text: { content: entry.contentHash } }],
      };
    }

    if (entry.lastSyncedAt !== undefined) {
      properties.LastSyncedAt = {
        date: { start: entry.lastSyncedAt },
      };
    }

    if (entry.publishedAt !== undefined) {
      properties.PublishedAt = {
        date: entry.publishedAt ? { start: entry.publishedAt } : null,
      };
    }

    if (entry.publishedUrl !== undefined) {
      properties.PublishedUrl = {
        url: entry.publishedUrl || null,
      };
    }

    if (entry.lastError !== undefined) {
      properties.LastError = {
        rich_text: entry.lastError
          ? [{ type: "text", text: { content: truncate(entry.lastError, 2000) } }]
          : [],
      };
    }

    return properties;
  }

  // ===========================================================================
  // Podcast Episode Pipeline Operations (M5)
  // ===========================================================================

  /**
   * Create or update an Episode Pipeline entry (idempotent).
   * If an entry with the same episodeId exists, updates it instead.
   * Non-fatal: logs error and returns null if write fails.
   */
  async createEpisodePipelineEntry(entry: EpisodePipelineEntry): Promise<NotionPage | null> {
    if (!this.config.episodePipelineDbId) {
      console.warn("[notion-service] Episode Pipeline database ID not configured, skipping create");
      return null;
    }

    try {
      // Check for existing entry (idempotency)
      const existing = await this.findEpisodeById(entry.episodeId);

      if (existing) {
        // Update existing entry instead of creating duplicate
        return await this.client.updatePage(existing.id, {
          properties: this.buildEpisodePipelineProperties(entry, true),
        });
      }

      // Create new entry
      return await this.client.createPage({
        parent: { database_id: this.config.episodePipelineDbId },
        properties: this.buildEpisodePipelineProperties(entry),
      });
    } catch (error) {
      console.error("[notion-service] Failed to create Episode Pipeline entry:", error);
      if (this.config.throwOnWriteError) {
        throw error;
      }
      return null;
    }
  }

  /**
   * Update an existing Episode Pipeline entry.
   */
  async updateEpisodePipelineEntry(
    pageId: string,
    updates: Partial<EpisodePipelineEntry>,
  ): Promise<NotionPage | null> {
    try {
      return await this.client.updatePage(pageId, {
        properties: this.buildEpisodePipelineProperties(updates as EpisodePipelineEntry, true),
      });
    } catch (error) {
      console.error("[notion-service] Failed to update Episode Pipeline entry:", error);
      if (this.config.throwOnWriteError) {
        throw error;
      }
      return null;
    }
  }

  /**
   * Find an episode by episode ID.
   */
  async findEpisodeById(episodeId: string): Promise<NotionPage | null> {
    if (!this.config.episodePipelineDbId) {
      return null;
    }

    try {
      const response = await this.client.queryDataSource(this.config.episodePipelineDbId, {
        filter: {
          property: "Name",
          title: { equals: episodeId },
        },
        page_size: 1,
      });

      return response.results[0] ?? null;
    } catch (error) {
      console.error("[notion-service] Failed to query Episode Pipeline:", error);
      return null;
    }
  }

  /**
   * List all episode IDs from Episode Pipeline.
   */
  async listEpisodeIds(): Promise<string[]> {
    if (!this.config.episodePipelineDbId) {
      return [];
    }

    try {
      const pages = await this.client.queryDataSourceAll(this.config.episodePipelineDbId);
      const ids: string[] = [];
      for (const page of pages) {
        const titleProp = page.properties.Name;
        if (titleProp?.type === "title") {
          const titleArray = (titleProp as { title: Array<{ plain_text?: string }> }).title;
          const id = titleArray[0]?.plain_text;
          if (id && /^E\d{3,}$/.test(id)) {
            ids.push(id);
          }
        }
      }
      return ids;
    } catch (error) {
      console.error("[notion-service] Failed to list episode IDs:", error);
      return [];
    }
  }

  /**
   * Build Notion properties for an Episode Pipeline entry.
   */
  private buildEpisodePipelineProperties(
    entry: Partial<EpisodePipelineEntry>,
    isUpdate: boolean = false,
  ): Record<string, unknown> {
    const properties: Record<string, unknown> = {};

    if (entry.episodeId !== undefined) {
      properties.Name = {
        title: [{ type: "text", text: { content: entry.episodeId } }],
      };
    }

    if (entry.title !== undefined) {
      properties.Title = {
        rich_text: [{ type: "text", text: { content: entry.title } }],
      };
    }

    if (entry.status !== undefined) {
      properties.Status = {
        select: { name: entry.status },
      };
    }

    if (entry.transcriptHash !== undefined) {
      properties.TranscriptHash = {
        rich_text: [{ type: "text", text: { content: entry.transcriptHash } }],
      };
    }

    if (entry.sourceType !== undefined) {
      properties.SourceType = {
        select: { name: entry.sourceType },
      };
    }

    if (entry.sourcePath !== undefined) {
      properties.SourcePath = {
        rich_text: [{ type: "text", text: { content: entry.sourcePath } }],
      };
    }

    if (entry.squarespaceDraftId !== undefined) {
      properties.SquarespaceDraftId = {
        rich_text: [{ type: "text", text: { content: entry.squarespaceDraftId } }],
      };
    }

    if (entry.publishedUrl !== undefined) {
      properties.PublishedUrl = {
        url: entry.publishedUrl || null,
      };
    }

    if (entry.publishedAt !== undefined) {
      properties.PublishedAt = {
        date: entry.publishedAt ? { start: entry.publishedAt } : null,
      };
    }

    if (entry.createdAt !== undefined) {
      properties.CreatedAt = {
        date: { start: entry.createdAt },
      };
    }

    if (entry.updatedAt !== undefined) {
      properties.UpdatedAt = {
        date: { start: entry.updatedAt },
      };
    }

    if (entry.lastError !== undefined) {
      properties.LastError = {
        rich_text: entry.lastError
          ? [{ type: "text", text: { content: truncate(entry.lastError, 2000) } }]
          : [],
      };
    }

    return properties;
  }

  // ===========================================================================
  // Podcast Assets Operations (M5)
  // ===========================================================================

  /**
   * Find a podcast asset by cache key (transcript hash).
   */
  async findPodcastAssetByCacheKey(cacheKey: string): Promise<NotionPage | null> {
    if (!this.config.podcastAssetsDbId) {
      return null;
    }

    try {
      const response = await this.client.queryDataSource(this.config.podcastAssetsDbId, {
        filter: {
          property: "CacheKey",
          rich_text: { equals: cacheKey },
        },
        page_size: 1,
      });

      return response.results[0] ?? null;
    } catch (error) {
      console.error("[notion-service] Failed to query Podcast Assets:", error);
      return null;
    }
  }

  /**
   * Find a podcast asset by cache key AND artifact type (full idempotency key).
   */
  async findPodcastAssetByIdempotencyKey(
    cacheKey: string,
    artifactType: string,
  ): Promise<NotionPage | null> {
    if (!this.config.podcastAssetsDbId) {
      return null;
    }

    try {
      const response = await this.client.queryDataSource(this.config.podcastAssetsDbId, {
        filter: {
          and: [
            { property: "CacheKey", rich_text: { equals: cacheKey } },
            { property: "ArtifactType", select: { equals: artifactType } },
          ],
        },
        page_size: 1,
      });

      return response.results[0] ?? null;
    } catch (error) {
      console.error("[notion-service] Failed to query Podcast Assets:", error);
      return null;
    }
  }

  /**
   * Save or update a podcast asset entry.
   * Dedupes by cacheKey + artifactType - if entry exists, updates it.
   * Non-fatal: logs error and returns null if write fails.
   */
  async savePodcastAsset(entry: PodcastAssetEntry): Promise<NotionPage | null> {
    if (!this.config.podcastAssetsDbId) {
      console.warn("[notion-service] Podcast Assets database ID not configured, skipping save");
      return null;
    }

    try {
      // Check for existing entry by cacheKey + artifactType (full idempotency key)
      const existing = await this.findPodcastAssetByIdempotencyKey(
        entry.cacheKey,
        entry.artifactType,
      );

      const properties = {
        Name: {
          title: [{ type: "text", text: { content: `${entry.episodeId}-${entry.artifactType}` } }],
        },
        EpisodeId: {
          rich_text: [{ type: "text", text: { content: entry.episodeId } }],
        },
        TranscriptHash: {
          rich_text: [{ type: "text", text: { content: entry.transcriptHash } }],
        },
        ArtifactType: {
          select: { name: entry.artifactType },
        },
        Content: {
          rich_text: [{ type: "text", text: { content: truncate(entry.content, 2000) } }],
        },
        CacheKey: {
          rich_text: [{ type: "text", text: { content: entry.cacheKey } }],
        },
        Version: {
          number: entry.version,
        },
        Profile: {
          select: { name: entry.profile },
        },
        GeneratedAt: {
          date: { start: entry.generatedAt },
        },
      };

      if (existing) {
        // Update existing entry
        return await this.client.updatePage(existing.id, { properties });
      } else {
        // Create new entry
        return await this.client.createPage({
          parent: { database_id: this.config.podcastAssetsDbId },
          properties,
        });
      }
    } catch (error) {
      console.error("[notion-service] Failed to save Podcast Asset:", error);
      if (this.config.throwOnWriteError) {
        throw error;
      }
      return null;
    }
  }

  // ===========================================================================
  // RLM Sessions Operations (M6)
  // ===========================================================================

  /**
   * Create an RLM session entry.
   * Non-fatal: logs error and returns null if write fails.
   */
  async createRlmSessionEntry(
    entry: Omit<RlmSessionEntry, "iterationCount" | "totalTokens"> & {
      iterationCount?: number;
      totalTokens?: number;
    },
  ): Promise<string | null> {
    if (!this.config.rlmSessionsDbId) {
      console.warn("[notion-service] RLM Sessions database ID not configured, skipping create");
      return null;
    }

    try {
      const page = await this.client.createPage({
        parent: { database_id: this.config.rlmSessionsDbId },
        properties: {
          Name: {
            title: [{ type: "text", text: { content: entry.sessionId } }],
          },
          Task: {
            rich_text: [{ type: "text", text: { content: truncate(entry.task, 2000) } }],
          },
          Status: {
            select: { name: entry.status },
          },
          IterationCount: {
            number: entry.iterationCount ?? 0,
          },
          TotalTokens: {
            number: entry.totalTokens ?? 0,
          },
          StartedAt: {
            date: { start: entry.startedAt },
          },
          ...(entry.config && {
            MaxDepth: {
              number: entry.config.maxDepth,
            },
            BudgetProfile: {
              select: { name: entry.config.budgetProfile },
            },
          }),
        },
      });
      return page.id;
    } catch (error) {
      console.error("[notion-service] Failed to create RLM session entry:", error);
      if (this.config.throwOnWriteError) {
        throw error;
      }
      return null;
    }
  }

  /**
   * Update an RLM session entry.
   * Non-fatal: logs error and returns null if update fails.
   */
  async updateRlmSessionEntry(
    pageId: string,
    updates: Partial<RlmSessionEntry>,
  ): Promise<NotionPage | null> {
    try {
      const properties: Record<string, unknown> = {};

      if (updates.status !== undefined) {
        properties.Status = { select: { name: updates.status } };
      }
      if (updates.iterationCount !== undefined) {
        properties.IterationCount = { number: updates.iterationCount };
      }
      if (updates.totalTokens !== undefined) {
        properties.TotalTokens = { number: updates.totalTokens };
      }
      if (updates.totalToolCalls !== undefined) {
        properties.TotalToolCalls = { number: updates.totalToolCalls };
      }
      if (updates.totalDurationMs !== undefined) {
        properties.TotalDurationMs = { number: updates.totalDurationMs };
      }
      if (updates.completedAt !== undefined) {
        properties.CompletedAt = { date: { start: updates.completedAt } };
      }
      if (updates.finalOutput !== undefined) {
        properties.FinalOutput = {
          rich_text: [{ type: "text", text: { content: truncate(updates.finalOutput, 2000) } }],
        };
      }
      if (updates.stopReason !== undefined) {
        properties.StopReason = {
          rich_text: [{ type: "text", text: { content: updates.stopReason } }],
        };
      }

      return await this.client.updatePage(pageId, { properties });
    } catch (error) {
      console.error("[notion-service] Failed to update RLM session entry:", error);
      if (this.config.throwOnWriteError) {
        throw error;
      }
      return null;
    }
  }

  /**
   * Find an RLM session by session ID.
   */
  async findRlmSessionById(sessionId: string): Promise<RlmSessionEntry | null> {
    if (!this.config.rlmSessionsDbId) {
      return null;
    }

    try {
      const response = await this.client.queryDataSource(this.config.rlmSessionsDbId, {
        filter: {
          property: "Name",
          title: { equals: sessionId },
        },
        page_size: 1,
      });

      if (response.results.length === 0) {
        return null;
      }

      return this.pageToRlmSessionEntry(response.results[0]);
    } catch (error) {
      console.error("[notion-service] Failed to find RLM session:", error);
      return null;
    }
  }

  /**
   * List recent RLM sessions.
   */
  async listRlmSessions(limit: number = 10): Promise<RlmSessionEntry[]> {
    if (!this.config.rlmSessionsDbId) {
      return [];
    }

    try {
      const response = await this.client.queryDataSource(this.config.rlmSessionsDbId, {
        sorts: [{ property: "StartedAt", direction: "descending" }],
        page_size: limit,
      });

      return response.results.map((page) => this.pageToRlmSessionEntry(page));
    } catch (error) {
      console.error("[notion-service] Failed to list RLM sessions:", error);
      return [];
    }
  }

  /**
   * Convert Notion page to RlmSessionEntry.
   */
  private pageToRlmSessionEntry(page: NotionPage): RlmSessionEntry {
    const props = page.properties;

    // Extract title
    const nameTitle = props.Name as { title?: Array<{ plain_text?: string }> } | undefined;
    const sessionId = nameTitle?.title?.[0]?.plain_text ?? "";

    // Extract rich text
    const taskText = props.Task as { rich_text?: Array<{ plain_text?: string }> } | undefined;
    const task = taskText?.rich_text?.[0]?.plain_text ?? "";

    // Extract select
    const statusSelect = props.Status as { select?: { name?: string } } | undefined;
    const status = (statusSelect?.select?.name ?? "running") as RlmSessionEntry["status"];

    // Extract numbers
    const iterCount = props.IterationCount as { number?: number } | undefined;
    const iterationCount = iterCount?.number ?? 0;

    const tokenCount = props.TotalTokens as { number?: number } | undefined;
    const totalTokens = tokenCount?.number ?? 0;

    // Extract dates
    const startDate = props.StartedAt as { date?: { start?: string } } | undefined;
    const startedAt = startDate?.date?.start ?? new Date().toISOString();

    const endDate = props.CompletedAt as { date?: { start?: string } } | undefined;
    const completedAt = endDate?.date?.start;

    // Extract optional rich text
    const finalText = props.FinalOutput as
      | { rich_text?: Array<{ plain_text?: string }> }
      | undefined;
    const finalOutput = finalText?.rich_text?.[0]?.plain_text;

    const stopText = props.StopReason as { rich_text?: Array<{ plain_text?: string }> } | undefined;
    const stopReason = stopText?.rich_text?.[0]?.plain_text;

    return {
      sessionId,
      task,
      status,
      iterationCount,
      totalTokens,
      startedAt,
      completedAt,
      finalOutput,
      stopReason,
      notionPageId: page.id,
    };
  }

  // ===========================================================================
  // Improve Plans Operations (M6)
  // ===========================================================================

  /**
   * Create an Improve Plan entry.
   * Non-fatal: logs error and returns null if write fails.
   */
  async createImprovePlanEntry(entry: ImprovePlanEntry): Promise<string | null> {
    if (!this.config.improvePlansDbId) {
      console.warn("[notion-service] Improve Plans database ID not configured, skipping create");
      return null;
    }

    try {
      const page = await this.client.createPage({
        parent: { database_id: this.config.improvePlansDbId },
        properties: {
          Name: {
            title: [{ type: "text", text: { content: entry.planId } }],
          },
          Status: {
            select: { name: entry.status },
          },
          OpportunityCount: {
            number: entry.opportunityCount,
          },
          EstimatedLines: {
            number: entry.estimatedLines,
          },
          Scope: {
            multi_select: entry.scope.map((s) => ({ name: s })),
          },
          CreatedAt: {
            date: { start: entry.createdAt },
          },
          ...(entry.prUrl && {
            PRUrl: { url: entry.prUrl },
          }),
          ...(entry.prNumber && {
            PRNumber: { number: entry.prNumber },
          }),
        },
      });
      return page.id;
    } catch (error) {
      console.error("[notion-service] Failed to create Improve Plan entry:", error);
      if (this.config.throwOnWriteError) {
        throw error;
      }
      return null;
    }
  }

  /**
   * Update an Improve Plan entry.
   * Non-fatal: logs error and returns null if update fails.
   */
  async updateImprovePlanEntry(
    pageId: string,
    updates: Partial<ImprovePlanEntry>,
  ): Promise<NotionPage | null> {
    try {
      const properties: Record<string, unknown> = {};

      if (updates.status !== undefined) {
        properties.Status = { select: { name: updates.status } };
      }
      if (updates.prUrl !== undefined) {
        properties.PRUrl = { url: updates.prUrl };
      }
      if (updates.prNumber !== undefined) {
        properties.PRNumber = { number: updates.prNumber };
      }
      if (updates.mergedAt !== undefined) {
        properties.MergedAt = { date: { start: updates.mergedAt } };
      }
      if (updates.lastError !== undefined) {
        properties.LastError = {
          rich_text: updates.lastError
            ? [{ type: "text", text: { content: truncate(updates.lastError, 2000) } }]
            : [],
        };
      }

      return await this.client.updatePage(pageId, { properties });
    } catch (error) {
      console.error("[notion-service] Failed to update Improve Plan entry:", error);
      if (this.config.throwOnWriteError) {
        throw error;
      }
      return null;
    }
  }

  /**
   * Find an Improve Plan by plan ID.
   */
  async findImprovePlanById(planId: string): Promise<NotionPage | null> {
    if (!this.config.improvePlansDbId) {
      return null;
    }

    try {
      const response = await this.client.queryDataSource(this.config.improvePlansDbId, {
        filter: {
          property: "Name",
          title: { equals: planId },
        },
        page_size: 1,
      });

      return response.results[0] ?? null;
    } catch (error) {
      console.error("[notion-service] Failed to find Improve Plan:", error);
      return null;
    }
  }

  // ===========================================================================
  // Content Fetch Operations
  // ===========================================================================

  /**
   * Fetch content from a Notion page.
   *
   * Strategy:
   * 1. If page has non-empty "Content" rich_text property, use that
   * 2. Otherwise, fetch blocks and convert to markdown
   */
  async fetchPageContent(pageId: string): Promise<{ content: string; hash: string }> {
    // First, try to get content from page property
    const page = await this.client.getPage(pageId);
    const contentProperty = page.properties.Content;

    if (contentProperty && contentProperty.type === "rich_text") {
      const richText = (contentProperty as { rich_text: NotionRichTextItem[] }).rich_text;
      const content = extractPlainText(richText);

      if (content.trim()) {
        return {
          content,
          hash: computeContentHash(content),
        };
      }
    }

    // Fallback: fetch blocks and convert to markdown
    const blocks = await this.client.listBlockChildrenAll(pageId);
    const content = blocksToMarkdown(blocks);

    return {
      content,
      hash: computeContentHash(content),
    };
  }

  /**
   * Parse a notion:// URL to extract the page ID.
   */
  static parseNotionUrl(url: string): string | null {
    // Handle notion://page/<id> format
    const notionMatch = url.match(/^notion:\/\/page\/([a-f0-9-]+)$/i);
    if (notionMatch) {
      return notionMatch[1];
    }

    // Handle full Notion URLs: https://www.notion.so/...-<id> or https://www.notion.so/<id>
    // Page IDs can be 32 hex chars or UUID format (with dashes)
    const fullUrlMatch = url.match(
      /notion\.so\/(?:[^/]+\/)?.*?([a-f0-9]{32}|[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})(?:\?|$)/i,
    );
    if (fullUrlMatch) {
      return fullUrlMatch[1];
    }

    // Handle bare page ID (32 hex chars or UUID with dashes)
    if (/^[a-f0-9]{32}$/i.test(url)) {
      return url;
    }

    // Handle UUID format
    if (/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(url)) {
      return url;
    }

    return null;
  }
}

// =============================================================================
// Content Conversion Helpers
// =============================================================================

/**
 * Extract plain text from Notion rich text items.
 */
export function extractPlainText(richText: NotionRichTextItem[]): string {
  return richText.map((item) => item.plain_text ?? item.text?.content ?? "").join("");
}

/**
 * Convert Notion blocks to Markdown.
 * Supports a minimal set: headings, paragraphs, bullets, numbered lists, quotes, code, to-dos.
 */
export function blocksToMarkdown(blocks: NotionBlock[]): string {
  const lines: string[] = [];
  let numberedListIndex = 0;

  for (const block of blocks) {
    // Reset numbered list counter when encountering non-numbered-list block
    if (block.type !== "numbered_list_item") {
      numberedListIndex = 0;
    }

    switch (block.type) {
      case "paragraph": {
        const paraBlock = block as NotionParagraphBlock;
        const text = extractPlainText(paraBlock.paragraph.rich_text);
        lines.push(text || "");
        break;
      }

      case "heading_1": {
        const h1Block = block as NotionHeading1Block;
        const text = extractPlainText(h1Block.heading_1.rich_text);
        lines.push(`# ${text}`);
        break;
      }

      case "heading_2": {
        const h2Block = block as NotionHeading2Block;
        const text = extractPlainText(h2Block.heading_2.rich_text);
        lines.push(`## ${text}`);
        break;
      }

      case "heading_3": {
        const h3Block = block as NotionHeading3Block;
        const text = extractPlainText(h3Block.heading_3.rich_text);
        lines.push(`### ${text}`);
        break;
      }

      case "bulleted_list_item": {
        const bulletBlock = block as NotionBulletedListItemBlock;
        const text = extractPlainText(bulletBlock.bulleted_list_item.rich_text);
        lines.push(`- ${text}`);
        break;
      }

      case "numbered_list_item": {
        numberedListIndex++;
        const numBlock = block as NotionNumberedListItemBlock;
        const text = extractPlainText(numBlock.numbered_list_item.rich_text);
        lines.push(`${numberedListIndex}. ${text}`);
        break;
      }

      case "quote": {
        const quoteBlock = block as NotionQuoteBlock;
        const text = extractPlainText(quoteBlock.quote.rich_text);
        lines.push(`> ${text}`);
        break;
      }

      case "code": {
        const codeBlock = block as NotionCodeBlock;
        const text = extractPlainText(codeBlock.code.rich_text);
        const language = codeBlock.code.language || "";
        lines.push(`\`\`\`${language}`);
        lines.push(text);
        lines.push("```");
        break;
      }

      case "to_do": {
        const todoBlock = block as NotionToDoBlock;
        const text = extractPlainText(todoBlock.to_do.rich_text);
        const checkbox = todoBlock.to_do.checked ? "[x]" : "[ ]";
        lines.push(`- ${checkbox} ${text}`);
        break;
      }

      case "divider": {
        lines.push("---");
        break;
      }

      default:
        // Skip unsupported block types
        break;
    }
  }

  return lines.join("\n");
}

/**
 * Compute a hash of content for change detection.
 */
export function computeContentHash(content: string): string {
  return createHash("sha256").update(content).digest("hex").slice(0, 16);
}

/**
 * Truncate a string to a maximum length.
 */
function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) {
    return str;
  }
  return str.slice(0, maxLength - 3) + "...";
}

// =============================================================================
// Factory Functions
// =============================================================================

/**
 * Create a Notion service from a client and config.
 */
export function createNotionService(
  client: NotionClient,
  config?: NotionServiceConfig,
): NotionService {
  return new NotionService(client, config);
}

/**
 * Load Notion service configuration from environment variables.
 */
export function loadNotionServiceConfig(): NotionServiceConfig {
  return {
    webOpsDbId: process.env.DJ_NOTION_WEBOPS_DB_ID ?? process.env.DJ_NOTION_WEBOPS_DB,
    researchRadarDbId:
      process.env.DJ_NOTION_RESEARCH_RADAR_DB_ID ?? process.env.DJ_NOTION_RESEARCH_RADAR_DB,
    postsDbId: process.env.DJ_NOTION_POSTS_DB_ID ?? process.env.DJ_NOTION_POSTS_DB,
    episodePipelineDbId:
      process.env.DJ_NOTION_EPISODE_PIPELINE_DB_ID ?? process.env.DJ_NOTION_PODCAST_PIPELINE_DB_ID,
    podcastAssetsDbId: process.env.DJ_NOTION_PODCAST_ASSETS_DB_ID,
    rlmSessionsDbId: process.env.DJ_NOTION_RLM_SESSIONS_DB_ID,
    improvePlansDbId: process.env.DJ_NOTION_IMPROVE_PLANS_DB_ID,
    improveOpportunitiesDbId: process.env.DJ_NOTION_IMPROVE_OPPORTUNITIES_DB_ID,
    throwOnWriteError: process.env.DJ_NOTION_THROW_ON_WRITE_ERROR === "true",
  };
}
