/**
 * Site Service for DJ Assistant
 *
 * Handles Squarespace site management with Notion as canonical storage:
 * - Draft creation/update with Notion tracking
 * - Content fetch from Notion (Content property preferred, blocks fallback)
 * - Idempotent sync using ContentHash
 * - Publish tracking with status updates
 */

import type { NotionPage, SitePostEntry } from "./notion/types.js";
import { computeContentHash, NotionService } from "./notion/notion-service.js";

// =============================================================================
// Types
// =============================================================================

export type PostTemplate = "episode" | "blog";
export type PostStatus = "Draft" | "Published" | "Archived";

export interface SiteServiceConfig {
  /** Notion service for post management */
  notionService?: NotionService;
  /** Squarespace site URL */
  siteUrl?: string;
  /** Squarespace editor URL */
  editorUrl?: string;
  /** Default template for new posts */
  defaultTemplate: PostTemplate;
}

export interface CreateDraftResult {
  success: boolean;
  notionPageId?: string;
  squarespaceDraftId?: string;
  message: string;
}

export interface UpdateDraftResult {
  success: boolean;
  contentChanged: boolean;
  newContentHash?: string;
  message: string;
}

export interface PublishResult {
  success: boolean;
  publishedUrl?: string;
  publishedAt?: string;
  message: string;
}

export interface FetchContentResult {
  success: boolean;
  content?: string;
  contentHash?: string;
  source: "property" | "blocks" | "none";
  message: string;
}

export interface PostMetadata {
  notionPageId: string;
  title: string;
  status: PostStatus;
  squarespaceDraftId?: string;
  template: PostTemplate;
  contentHash?: string;
  lastSyncedAt?: string;
  publishedAt?: string;
  publishedUrl?: string;
  lastError?: string;
}

// =============================================================================
// Default Configuration
// =============================================================================

export const DEFAULT_SITE_CONFIG: SiteServiceConfig = {
  defaultTemplate: "blog",
};

// =============================================================================
// Site Service
// =============================================================================

export class SiteService {
  private config: SiteServiceConfig;

  constructor(config: Partial<SiteServiceConfig> = {}) {
    this.config = {
      ...DEFAULT_SITE_CONFIG,
      ...config,
    };
  }

  /**
   * Set the Notion service for post management.
   */
  setNotionService(service: NotionService): void {
    this.config.notionService = service;
  }

  // ===========================================================================
  // Draft Operations
  // ===========================================================================

  /**
   * Create a new draft post in Notion.
   * Does NOT create Squarespace draft - that's done by browser automation.
   */
  async createDraft(
    title: string,
    template: PostTemplate = this.config.defaultTemplate,
  ): Promise<CreateDraftResult> {
    if (!this.config.notionService) {
      return {
        success: false,
        message: "Notion service not configured",
      };
    }

    try {
      const entry: SitePostEntry = {
        title,
        status: "Draft",
        template,
      };

      const page = await this.config.notionService.createPostEntry(entry);
      if (!page) {
        return {
          success: false,
          message: "Failed to create Notion page",
        };
      }

      return {
        success: true,
        notionPageId: page.id,
        message: `Draft "${title}" created in Notion`,
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to create draft: ${error}`,
      };
    }
  }

  /**
   * Link a Squarespace draft ID to an existing Notion post.
   */
  async linkSquarespaceDraft(notionPageId: string, squarespaceDraftId: string): Promise<boolean> {
    if (!this.config.notionService) {
      console.warn("[site-service] Notion service not configured");
      return false;
    }

    try {
      const result = await this.config.notionService.updatePostEntry(notionPageId, {
        squarespaceDraftId,
      });
      return result !== null;
    } catch (error) {
      console.error("[site-service] Failed to link Squarespace draft:", error);
      return false;
    }
  }

  /**
   * Find a post by Squarespace draft ID.
   */
  async findByDraftId(squarespaceDraftId: string): Promise<PostMetadata | null> {
    if (!this.config.notionService) {
      return null;
    }

    try {
      const page = await this.config.notionService.findPostByDraftId(squarespaceDraftId);
      if (!page) {
        return null;
      }
      return this.pageToMetadata(page);
    } catch (error) {
      console.error("[site-service] Failed to find post by draft ID:", error);
      return null;
    }
  }

  // ===========================================================================
  // Content Operations
  // ===========================================================================

  /**
   * Fetch content from a Notion page.
   *
   * Strategy:
   * 1. If page has non-empty "Content" rich_text property, use that (preferred)
   * 2. Otherwise, fetch blocks and convert to markdown (fallback)
   */
  async fetchContent(notionPageIdOrUrl: string): Promise<FetchContentResult> {
    if (!this.config.notionService) {
      return {
        success: false,
        source: "none",
        message: "Notion service not configured",
      };
    }

    // Parse the page ID from URL if needed
    const pageId = NotionService.parseNotionUrl(notionPageIdOrUrl) ?? notionPageIdOrUrl;

    try {
      const { content, hash } = await this.config.notionService.fetchPageContent(pageId);

      if (!content.trim()) {
        return {
          success: false,
          source: "none",
          message: "No content found in Notion page",
        };
      }

      // Determine if it came from property or blocks (heuristic)
      // If content is short and doesn't have markdown headers, likely property
      const hasHeaders = /^#{1,3}\s/m.test(content);
      const source = content.length < 2000 && !hasHeaders ? "property" : "blocks";

      return {
        success: true,
        content,
        contentHash: hash,
        source,
        message: `Content fetched from ${source}`,
      };
    } catch (error) {
      return {
        success: false,
        source: "none",
        message: `Failed to fetch content: ${error}`,
      };
    }
  }

  /**
   * Check if content has changed since last sync.
   * Used for idempotent updates - skip browser if content unchanged.
   */
  async checkContentChanged(
    notionPageId: string,
    newContent: string,
  ): Promise<{ changed: boolean; oldHash?: string; newHash: string }> {
    const newHash = computeContentHash(newContent);

    if (!this.config.notionService) {
      return { changed: true, newHash };
    }

    try {
      // Get current post metadata
      const page = await this.config.notionService.client.getPage(notionPageId);
      const contentHashProperty = page.properties.ContentHash;

      if (contentHashProperty && contentHashProperty.type === "rich_text") {
        const richText = (contentHashProperty as { rich_text: Array<{ plain_text?: string }> })
          .rich_text;
        const oldHash = richText[0]?.plain_text;

        if (oldHash === newHash) {
          return { changed: false, oldHash, newHash };
        }

        return { changed: true, oldHash, newHash };
      }

      // No previous hash - assume changed
      return { changed: true, newHash };
    } catch {
      // On error, assume changed to be safe
      return { changed: true, newHash };
    }
  }

  /**
   * Update content hash and sync timestamp after successful browser update.
   */
  async recordSyncSuccess(notionPageId: string, contentHash: string): Promise<boolean> {
    if (!this.config.notionService) {
      return false;
    }

    try {
      const result = await this.config.notionService.updatePostEntry(notionPageId, {
        contentHash,
        lastSyncedAt: new Date().toISOString(),
        lastError: "", // Clear any previous error
      });
      return result !== null;
    } catch (error) {
      console.error("[site-service] Failed to record sync success:", error);
      return false;
    }
  }

  /**
   * Record a sync error.
   */
  async recordSyncError(notionPageId: string, error: string): Promise<boolean> {
    if (!this.config.notionService) {
      return false;
    }

    try {
      const result = await this.config.notionService.updatePostEntry(notionPageId, {
        lastError: error,
      });
      return result !== null;
    } catch (err) {
      console.error("[site-service] Failed to record sync error:", err);
      return false;
    }
  }

  // ===========================================================================
  // Publish Operations
  // ===========================================================================

  /**
   * Record successful publish.
   * Called after browser automation completes publish action.
   */
  async recordPublishSuccess(notionPageId: string, publishedUrl: string): Promise<boolean> {
    if (!this.config.notionService) {
      return false;
    }

    try {
      const result = await this.config.notionService.updatePostEntry(notionPageId, {
        status: "Published",
        publishedAt: new Date().toISOString(),
        publishedUrl,
        lastError: "", // Clear any previous error
      });
      return result !== null;
    } catch (error) {
      console.error("[site-service] Failed to record publish success:", error);
      return false;
    }
  }

  /**
   * Record publish failure.
   */
  async recordPublishError(notionPageId: string, error: string): Promise<boolean> {
    if (!this.config.notionService) {
      return false;
    }

    try {
      const result = await this.config.notionService.updatePostEntry(notionPageId, {
        lastError: error,
      });
      return result !== null;
    } catch (err) {
      console.error("[site-service] Failed to record publish error:", err);
      return false;
    }
  }

  // ===========================================================================
  // Helpers
  // ===========================================================================

  /**
   * Convert a Notion page to PostMetadata.
   */
  private pageToMetadata(page: NotionPage): PostMetadata {
    const props = page.properties;

    const title = this.extractTitle(props.Name);
    const status = this.extractSelect(props.Status) as PostStatus | undefined;
    const squarespaceDraftId = this.extractRichText(props.SquarespaceDraftId);
    const template = this.extractSelect(props.Template) as PostTemplate | undefined;
    const contentHash = this.extractRichText(props.ContentHash);
    const lastSyncedAt = this.extractDate(props.LastSyncedAt);
    const publishedAt = this.extractDate(props.PublishedAt);
    const publishedUrl = this.extractUrl(props.PublishedUrl);
    const lastError = this.extractRichText(props.LastError);

    return {
      notionPageId: page.id,
      title: title ?? "Untitled",
      status: status ?? "Draft",
      squarespaceDraftId: squarespaceDraftId || undefined,
      template: template ?? this.config.defaultTemplate,
      contentHash: contentHash || undefined,
      lastSyncedAt: lastSyncedAt || undefined,
      publishedAt: publishedAt || undefined,
      publishedUrl: publishedUrl || undefined,
      lastError: lastError || undefined,
    };
  }

  private extractTitle(prop: unknown): string | undefined {
    if (prop && typeof prop === "object" && "title" in prop) {
      const titleProp = prop as { title: Array<{ plain_text?: string }> };
      return titleProp.title[0]?.plain_text;
    }
    return undefined;
  }

  private extractRichText(prop: unknown): string | undefined {
    if (prop && typeof prop === "object" && "rich_text" in prop) {
      const rtProp = prop as { rich_text: Array<{ plain_text?: string }> };
      return rtProp.rich_text[0]?.plain_text;
    }
    return undefined;
  }

  private extractSelect(prop: unknown): string | undefined {
    if (prop && typeof prop === "object" && "select" in prop) {
      const selectProp = prop as { select: { name: string } | null };
      return selectProp.select?.name;
    }
    return undefined;
  }

  private extractDate(prop: unknown): string | undefined {
    if (prop && typeof prop === "object" && "date" in prop) {
      const dateProp = prop as { date: { start: string } | null };
      return dateProp.date?.start;
    }
    return undefined;
  }

  private extractUrl(prop: unknown): string | undefined {
    if (prop && typeof prop === "object" && "url" in prop) {
      const urlProp = prop as { url: string | null };
      return urlProp.url ?? undefined;
    }
    return undefined;
  }

  /**
   * Get configuration (for display/debugging).
   */
  getConfig(): SiteServiceConfig {
    return { ...this.config };
  }

  /**
   * Generate Squarespace editor URL for a draft.
   */
  getEditorUrl(squarespaceDraftId: string): string | null {
    if (!this.config.editorUrl) {
      return null;
    }
    return `${this.config.editorUrl}/${squarespaceDraftId}`;
  }
}

// =============================================================================
// Factory Functions
// =============================================================================

/**
 * Create a site service with default configuration.
 */
export function createSiteService(config?: Partial<SiteServiceConfig>): SiteService {
  return new SiteService(config);
}

/**
 * Load site service configuration from environment variables.
 */
export function loadSiteConfig(): Partial<SiteServiceConfig> {
  return {
    siteUrl: process.env.DJ_SQUARESPACE_SITE_URL,
    editorUrl: process.env.DJ_SQUARESPACE_EDITOR_URL,
    defaultTemplate: (process.env.DJ_SITE_DEFAULT_TEMPLATE as PostTemplate) ?? "blog",
  };
}
