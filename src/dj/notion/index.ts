/**
 * Notion Integration Module for DJ Assistant
 *
 * Provides HTTP client and service layer for Notion API operations:
 * - WebOps Log entries
 * - Research Radar entries
 * - Site/Post entries with content fetch
 */

// Types
export type {
  EpisodePipelineEntry,
  NotionBlock,
  NotionBlockBase,
  NotionBlockType,
  NotionBulletedListItemBlock,
  NotionCheckboxFilter,
  NotionCheckboxProperty,
  NotionClientConfig,
  NotionCodeBlock,
  NotionCreatePageRequest,
  NotionDatabaseQueryRequest,
  NotionDateFilter,
  NotionDateProperty,
  NotionDividerBlock,
  NotionErrorResponse,
  NotionFilter,
  NotionFormulaFilter,
  NotionFormulaProperty,
  NotionHeading1Block,
  NotionHeading2Block,
  NotionHeading3Block,
  NotionMultiSelectFilter,
  NotionMultiSelectProperty,
  NotionNumberedListItemBlock,
  NotionNumberFilter,
  NotionNumberProperty,
  NotionPage,
  NotionPaginatedResponse,
  NotionParagraphBlock,
  NotionPropertyValue,
  NotionQuoteBlock,
  NotionRichTextItem,
  NotionRichTextProperty,
  NotionSelectFilter,
  NotionSelectProperty,
  NotionSort,
  NotionTextFilter,
  NotionTitleProperty,
  NotionToDoBlock,
  NotionUpdatePageRequest,
  NotionUrlProperty,
  PodcastAssetEntry,
  ResearchRadarEntry,
  SitePostEntry,
  WebOpsLogEntry,
} from "./types.js";

// Error types
export {
  NotionApiError,
  NotionNotFoundError,
  NotionRateLimitError,
  NotionValidationError,
} from "./types.js";

// Client
export { createNotionClient, createNotionClientOptional, NotionClient } from "./notion-client.js";

// Service
export {
  blocksToMarkdown,
  computeContentHash,
  createNotionService,
  extractPlainText,
  loadNotionServiceConfig,
  NotionService,
  type NotionServiceConfig,
} from "./notion-service.js";
