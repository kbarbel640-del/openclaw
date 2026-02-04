/**
 * Type definitions for Notion API integration.
 *
 * These types support the raw HTTP client approach (not using @notionhq/client SDK)
 * to enable data_sources endpoints and other custom API usage.
 */

// =============================================================================
// API Configuration
// =============================================================================

export interface NotionClientConfig {
  /** Notion API key (from NOTION_API_KEY env var) */
  apiKey: string;
  /** Notion API version header (default: "2025-09-03") */
  apiVersion?: string;
  /** Base URL (default: "https://api.notion.com") */
  baseUrl?: string;
  /** Request timeout in milliseconds (default: 30000) */
  timeoutMs?: number;
  /** Max retries for 429/5xx errors (default: 3) */
  maxRetries?: number;
  /** Base delay for exponential backoff in ms (default: 1000) */
  retryBaseDelayMs?: number;
}

// =============================================================================
// Error Types
// =============================================================================

export class NotionApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code?: string,
    public readonly requestId?: string,
  ) {
    super(message);
    this.name = "NotionApiError";
  }
}

export class NotionRateLimitError extends NotionApiError {
  constructor(
    message: string,
    public readonly retryAfterMs?: number,
    requestId?: string,
  ) {
    super(message, 429, "rate_limited", requestId);
    this.name = "NotionRateLimitError";
  }
}

export class NotionValidationError extends NotionApiError {
  constructor(message: string, requestId?: string) {
    super(message, 400, "validation_error", requestId);
    this.name = "NotionValidationError";
  }
}

export class NotionNotFoundError extends NotionApiError {
  constructor(message: string, requestId?: string) {
    super(message, 404, "object_not_found", requestId);
    this.name = "NotionNotFoundError";
  }
}

// =============================================================================
// API Response Types
// =============================================================================

export interface NotionErrorResponse {
  object: "error";
  status: number;
  code: string;
  message: string;
  request_id?: string;
}

export interface NotionPaginatedResponse<T> {
  object: "list";
  results: T[];
  next_cursor: string | null;
  has_more: boolean;
  type?: string;
}

// =============================================================================
// Rich Text Types
// =============================================================================

export interface NotionRichTextItem {
  type: "text" | "mention" | "equation";
  text?: {
    content: string;
    link?: { url: string } | null;
  };
  annotations?: {
    bold?: boolean;
    italic?: boolean;
    strikethrough?: boolean;
    underline?: boolean;
    code?: boolean;
    color?: string;
  };
  plain_text?: string;
  href?: string | null;
}

// =============================================================================
// Property Types
// =============================================================================

export interface NotionTitleProperty {
  type: "title";
  title: NotionRichTextItem[];
}

export interface NotionRichTextProperty {
  type: "rich_text";
  rich_text: NotionRichTextItem[];
}

export interface NotionSelectProperty {
  type: "select";
  select: { name: string; color?: string } | null;
}

export interface NotionMultiSelectProperty {
  type: "multi_select";
  multi_select: Array<{ name: string; color?: string }>;
}

export interface NotionDateProperty {
  type: "date";
  date: { start: string; end?: string; time_zone?: string } | null;
}

export interface NotionCheckboxProperty {
  type: "checkbox";
  checkbox: boolean;
}

export interface NotionNumberProperty {
  type: "number";
  number: number | null;
}

export interface NotionUrlProperty {
  type: "url";
  url: string | null;
}

export interface NotionFormulaProperty {
  type: "formula";
  formula: {
    type: "string" | "number" | "boolean" | "date";
    string?: string | null;
    number?: number | null;
    boolean?: boolean | null;
    date?: { start: string; end?: string } | null;
  };
}

export type NotionPropertyValue =
  | NotionTitleProperty
  | NotionRichTextProperty
  | NotionSelectProperty
  | NotionMultiSelectProperty
  | NotionDateProperty
  | NotionCheckboxProperty
  | NotionNumberProperty
  | NotionUrlProperty
  | NotionFormulaProperty;

// =============================================================================
// Page Types
// =============================================================================

export interface NotionPage {
  object: "page";
  id: string;
  created_time: string;
  last_edited_time: string;
  archived: boolean;
  url: string;
  properties: Record<string, NotionPropertyValue>;
  parent:
    | { type: "database_id"; database_id: string }
    | { type: "page_id"; page_id: string }
    | { type: "workspace"; workspace: true };
}

export interface NotionCreatePageRequest {
  parent: { database_id: string } | { page_id: string };
  properties: Record<string, unknown>;
  children?: NotionBlock[];
}

export interface NotionUpdatePageRequest {
  properties?: Record<string, unknown>;
  archived?: boolean;
}

// =============================================================================
// Block Types
// =============================================================================

export type NotionBlockType =
  | "paragraph"
  | "heading_1"
  | "heading_2"
  | "heading_3"
  | "bulleted_list_item"
  | "numbered_list_item"
  | "quote"
  | "code"
  | "to_do"
  | "toggle"
  | "divider"
  | "callout"
  | "image"
  | "video"
  | "file"
  | "pdf"
  | "bookmark"
  | "embed"
  | "table"
  | "table_row"
  | "column_list"
  | "column"
  | "child_page"
  | "child_database"
  | "synced_block"
  | "template"
  | "link_preview"
  | "unsupported";

export interface NotionBlockBase {
  object: "block";
  id: string;
  type: NotionBlockType;
  created_time: string;
  last_edited_time: string;
  has_children: boolean;
  archived: boolean;
}

export interface NotionParagraphBlock extends NotionBlockBase {
  type: "paragraph";
  paragraph: {
    rich_text: NotionRichTextItem[];
    color?: string;
  };
}

export interface NotionHeading1Block extends NotionBlockBase {
  type: "heading_1";
  heading_1: {
    rich_text: NotionRichTextItem[];
    color?: string;
    is_toggleable?: boolean;
  };
}

export interface NotionHeading2Block extends NotionBlockBase {
  type: "heading_2";
  heading_2: {
    rich_text: NotionRichTextItem[];
    color?: string;
    is_toggleable?: boolean;
  };
}

export interface NotionHeading3Block extends NotionBlockBase {
  type: "heading_3";
  heading_3: {
    rich_text: NotionRichTextItem[];
    color?: string;
    is_toggleable?: boolean;
  };
}

export interface NotionBulletedListItemBlock extends NotionBlockBase {
  type: "bulleted_list_item";
  bulleted_list_item: {
    rich_text: NotionRichTextItem[];
    color?: string;
  };
}

export interface NotionNumberedListItemBlock extends NotionBlockBase {
  type: "numbered_list_item";
  numbered_list_item: {
    rich_text: NotionRichTextItem[];
    color?: string;
  };
}

export interface NotionQuoteBlock extends NotionBlockBase {
  type: "quote";
  quote: {
    rich_text: NotionRichTextItem[];
    color?: string;
  };
}

export interface NotionCodeBlock extends NotionBlockBase {
  type: "code";
  code: {
    rich_text: NotionRichTextItem[];
    language: string;
    caption?: NotionRichTextItem[];
  };
}

export interface NotionToDoBlock extends NotionBlockBase {
  type: "to_do";
  to_do: {
    rich_text: NotionRichTextItem[];
    checked: boolean;
    color?: string;
  };
}

export interface NotionDividerBlock extends NotionBlockBase {
  type: "divider";
  divider: Record<string, never>;
}

export type NotionBlock =
  | NotionParagraphBlock
  | NotionHeading1Block
  | NotionHeading2Block
  | NotionHeading3Block
  | NotionBulletedListItemBlock
  | NotionNumberedListItemBlock
  | NotionQuoteBlock
  | NotionCodeBlock
  | NotionToDoBlock
  | NotionDividerBlock
  | NotionBlockBase; // Fallback for unsupported types

// =============================================================================
// Database/Data Source Query Types
// =============================================================================

export interface NotionDatabaseQueryRequest {
  filter?: NotionFilter;
  sorts?: NotionSort[];
  start_cursor?: string;
  page_size?: number;
}

export interface NotionFilter {
  and?: NotionFilter[];
  or?: NotionFilter[];
  property?: string;
  title?: NotionTextFilter;
  rich_text?: NotionTextFilter;
  number?: NotionNumberFilter;
  checkbox?: NotionCheckboxFilter;
  select?: NotionSelectFilter;
  multi_select?: NotionMultiSelectFilter;
  date?: NotionDateFilter;
  formula?: NotionFormulaFilter;
}

export interface NotionTextFilter {
  equals?: string;
  does_not_equal?: string;
  contains?: string;
  does_not_contain?: string;
  starts_with?: string;
  ends_with?: string;
  is_empty?: boolean;
  is_not_empty?: boolean;
}

export interface NotionNumberFilter {
  equals?: number;
  does_not_equal?: number;
  greater_than?: number;
  less_than?: number;
  greater_than_or_equal_to?: number;
  less_than_or_equal_to?: number;
  is_empty?: boolean;
  is_not_empty?: boolean;
}

export interface NotionCheckboxFilter {
  equals?: boolean;
  does_not_equal?: boolean;
}

export interface NotionSelectFilter {
  equals?: string;
  does_not_equal?: string;
  is_empty?: boolean;
  is_not_empty?: boolean;
}

export interface NotionMultiSelectFilter {
  contains?: string;
  does_not_contain?: string;
  is_empty?: boolean;
  is_not_empty?: boolean;
}

export interface NotionDateFilter {
  equals?: string;
  before?: string;
  after?: string;
  on_or_before?: string;
  on_or_after?: string;
  is_empty?: boolean;
  is_not_empty?: boolean;
  past_week?: Record<string, never>;
  past_month?: Record<string, never>;
  past_year?: Record<string, never>;
  next_week?: Record<string, never>;
  next_month?: Record<string, never>;
  next_year?: Record<string, never>;
}

export interface NotionFormulaFilter {
  string?: NotionTextFilter;
  number?: NotionNumberFilter;
  checkbox?: NotionCheckboxFilter;
  date?: NotionDateFilter;
}

export interface NotionSort {
  property?: string;
  timestamp?: "created_time" | "last_edited_time";
  direction: "ascending" | "descending";
}

// =============================================================================
// Service-Level Types
// =============================================================================

/** WebOps Log entry for Notion storage */
export interface WebOpsLogEntry {
  workflowId: string;
  task: string;
  startedAt: string;
  finishedAt: string;
  outcome: "success" | "failure" | "paused" | "cancelled" | "budget_exceeded";
  domainsVisited: string[];
  actionClasses: string[];
  approvedCount: number;
  autoSubmitCount: number;
  profile: "cheap" | "normal" | "deep";
  localLogPath: string;
  error?: string;
}

/** Research Radar entry for Notion storage */
export interface ResearchRadarEntry {
  title: string;
  query: string;
  summary: string[];
  citations: Array<{ title: string; url: string }>;
  nextActions: string[];
  uncertainty?: string;
  cacheKey: string;
  profile: "cheap" | "normal" | "deep";
  searchCount: number;
  fetchCount: number;
}

/** Site/Post entry for Notion storage */
export interface SitePostEntry {
  title: string;
  status: "Draft" | "Published" | "Archived";
  squarespaceDraftId?: string;
  template: "episode" | "blog";
  content?: string;
  contentHash?: string;
  lastSyncedAt?: string;
  publishedAt?: string;
  publishedUrl?: string;
  lastError?: string;
}

/** Episode Pipeline entry for Notion storage (M5 Podcast) */
export interface EpisodePipelineEntry {
  episodeId: string;
  title: string;
  status:
    | "Ingested"
    | "Pack Pending"
    | "Pack Partial"
    | "Pack Complete"
    | "Draft Ready"
    | "Published";
  transcriptHash: string;
  sourceType: "file" | "url" | "notion" | "clipboard";
  sourcePath?: string;
  squarespaceDraftId?: string;
  publishedUrl?: string;
  publishedAt?: string;
  createdAt: string;
  updatedAt: string;
  lastError?: string;
}

/** Podcast Asset entry for Notion storage (M5 Podcast) */
export interface PodcastAssetEntry {
  episodeId: string;
  transcriptHash: string;
  artifactType:
    | "titles"
    | "show_notes"
    | "chapters"
    | "quotes"
    | "clip_plan"
    | "guest_followup"
    | "full_pack";
  content: string;
  cacheKey: string;
  version: number;
  profile: "cheap" | "normal" | "deep";
  generatedAt: string;
}

/** RLM Session entry for Notion storage (M6) */
export interface RlmSessionEntry {
  sessionId: string;
  task: string;
  status: "running" | "completed" | "stopped" | "error";
  config?: {
    maxDepth: number;
    maxSubagents: number;
    maxIterations: number;
    budgetProfile: "cheap" | "normal" | "deep";
  };
  iterationCount: number;
  totalTokens: number;
  totalToolCalls?: number;
  totalDurationMs?: number;
  finalOutput?: string;
  stopReason?: string;
  startedAt: string;
  completedAt?: string;
  notionPageId?: string;
}

/** Improvement Plan entry for Notion storage (M6) */
export interface ImprovePlanEntry {
  planId: string;
  status: "draft" | "approved" | "executing" | "pr-created" | "merged" | "rejected";
  opportunityCount: number;
  estimatedLines: number;
  scope: string[];
  prUrl?: string;
  prNumber?: number;
  createdAt: string;
  mergedAt?: string;
  lastError?: string;
}

/** Improvement Opportunity entry for scanning results (M6) */
export interface ImproveOpportunityEntry {
  opportunityId: string;
  planId?: string;
  type: "refactor" | "bugfix" | "performance" | "test" | "docs";
  file: string;
  line?: number;
  description: string;
  confidence: "high" | "medium" | "low";
  estimatedLines: number;
  status: "pending" | "selected" | "applied" | "skipped";
  createdAt: string;
}
