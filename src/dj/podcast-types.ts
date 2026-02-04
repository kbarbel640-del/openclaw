/**
 * Podcast Engine Types for DJ Assistant
 *
 * Type definitions for episode management, pack generation, and caching.
 */

import type { BudgetProfileId } from "../budget/types.js";

// =============================================================================
// Episode ID
// =============================================================================

/** Episode ID format: E001, E002, etc. */
export type EpisodeId = `E${string}`;

/** State file for episode counter */
export interface PodcastState {
  /** Next episode number to allocate */
  nextEpisodeNumber: number;
  /** Last allocated episode ID (for verification) */
  lastAllocatedId?: EpisodeId;
  /** When last updated */
  updatedAt: string;
}

// =============================================================================
// Episode Manifest
// =============================================================================

export interface EpisodeManifest {
  /** Episode ID (E001, E002, etc.) */
  episodeId: EpisodeId;
  /** SHA256 hash of normalized transcript (16 chars) - used as cache key */
  transcriptHash: string;
  /** Full SHA256 hash of normalized transcript (64 chars) - for audit/debugging */
  transcriptHashFull?: string;
  /** When episode was created */
  createdAt: string;
  /** When manifest was last updated */
  updatedAt: string;
  /** Source information */
  sourceInfo: EpisodeSourceInfo;
  /** Pack artifact versions (keyed by artifact name) */
  artifactVersions: Record<string, ArtifactVersion>;
  /** Notion page IDs */
  notionPageIds: NotionPageIds;
  /** Current status */
  status: EpisodeStatus;
}

export interface EpisodeSourceInfo {
  /** Original source type */
  type: "file" | "url" | "notion" | "clipboard";
  /** Original source path/URL */
  source: string;
  /** Original filename if file */
  filename?: string;
  /** File size in bytes */
  sizeBytes?: number;
  /** Ingested at timestamp */
  ingestedAt: string;
}

export interface ArtifactVersion {
  /** Artifact name (titles, show_notes_short, etc.) */
  name: string;
  /** Version number (increments on regeneration) */
  version: number;
  /** When generated */
  generatedAt: string;
  /** Budget profile used */
  profile: BudgetProfileId;
  /** Whether from cache */
  fromCache: boolean;
}

export interface NotionPageIds {
  /** Episode Pipeline database page ID */
  episodePipeline?: string;
  /** Podcast Assets database page ID */
  podcastAssets?: string;
}

export type EpisodeStatus =
  | "ingested"
  | "pack_pending"
  | "pack_partial"
  | "pack_complete"
  | "draft_pending"
  | "draft_ready"
  | "published";

// =============================================================================
// Episode Pack Artifacts
// =============================================================================

export interface EpisodePack {
  /** Episode ID */
  episodeId: EpisodeId;
  /** Transcript hash for cache invalidation */
  transcriptHash: string;
  /** When pack was generated */
  generatedAt: string;
  /** Budget profile used */
  profile: BudgetProfileId;
  /** Individual artifacts */
  artifacts: EpisodePackArtifacts;
}

export interface EpisodePackArtifacts {
  /** Title options */
  titles?: TitleSet;
  /** Show notes (short and long) */
  showNotes?: ShowNotes;
  /** Chapters with timestamps */
  chapters?: Chapter[];
  /** Quote bank */
  quotes?: Quote[];
  /** Clip plan for social media */
  clipPlan?: ClipPlan;
  /** Guest follow-up email draft */
  guestFollowUp?: GuestFollowUp;
}

export interface TitleSet {
  /** Safe/professional titles */
  safe: string[];
  /** Spicy/attention-grabbing titles */
  spicy: string[];
}

export interface ShowNotes {
  /** Short summary (2-3 sentences) */
  short: string;
  /** Long form show notes */
  long: string;
}

export interface Chapter {
  /** Timestamp in HH:MM:SS format */
  timestamp: string;
  /** Chapter title */
  title: string;
  /** Brief description */
  description?: string;
}

export interface Quote {
  /** The quote text */
  text: string;
  /** Speaker name */
  speaker: string;
  /** Timestamp if available */
  timestamp?: string;
  /** Quote category */
  category: "insight" | "funny" | "controversial" | "inspiring";
}

export interface ClipPlan {
  /** Planned clips (typically 5) */
  clips: ClipSpec[];
}

export interface ClipSpec {
  /** Clip type */
  type: "hook" | "context" | "takeaway" | "cta" | "highlight";
  /** Start timestamp */
  startTimestamp: string;
  /** End timestamp */
  endTimestamp: string;
  /** Clip title */
  title: string;
  /** Why this clip works */
  rationale: string;
  /** Suggested platform */
  platform: "twitter" | "linkedin" | "instagram" | "youtube_shorts" | "tiktok";
}

export interface GuestFollowUp {
  /** Guest name */
  guestName: string;
  /** Email subject line */
  subject: string;
  /** Email body */
  body: string;
  /** Key points to mention */
  keyPoints: string[];
}

// =============================================================================
// Service Configuration
// =============================================================================

export interface PodcastServiceConfig {
  /** Base directory for podcast files (default: ~/openclaw/dj/podcast) */
  baseDir?: string;
  /** State file path (default: ~/.openclaw/state/dj-podcast.json) */
  stateFilePath?: string;
  /** Whether to prefer local model for chunking */
  preferLocalModel?: boolean;
}

// =============================================================================
// Operation Results
// =============================================================================

export interface IngestResult {
  success: boolean;
  episodeId?: EpisodeId;
  transcriptHash?: string;
  message: string;
  /** Path to local transcript file */
  transcriptPath?: string;
  /** Notion page ID if created */
  notionPageId?: string;
}

export interface PackResult {
  success: boolean;
  episodeId?: EpisodeId;
  pack?: EpisodePack;
  fromCache: boolean;
  message: string;
  /** Budget exceeded */
  budgetExceeded?: boolean;
  /** Partial artifacts if budget stopped */
  partialArtifacts?: Partial<EpisodePackArtifacts>;
}

/** Notion sync status for status display */
export interface NotionSyncStatus {
  /** Whether sync is pending */
  pending: boolean;
  /** Number of pending operations */
  pendingCount: number;
  /** Oldest pending operation timestamp */
  oldestQueuedAt?: string;
  /** Recent errors (up to 3) */
  recentErrors?: string[];
}

export interface StatusResult {
  success: boolean;
  episodeId: EpisodeId;
  manifest?: EpisodeManifest;
  pack?: EpisodePack;
  /** Notion sync status (pending retries, errors) */
  notionSync?: NotionSyncStatus;
  message: string;
}

export interface CacheStatusResult {
  success: boolean;
  episodeId: EpisodeId;
  cached: boolean;
  cacheKey?: string;
  notionAssetId?: string;
  message: string;
}

// =============================================================================
// Ingest Options
// =============================================================================

export interface IngestOptions {
  /** Override episode ID (must verify not already used) */
  episodeId?: EpisodeId;
  /** Source type */
  sourceType: "file" | "url" | "notion" | "clipboard";
  /** Source path/URL */
  sourcePath?: string;
  /** Original filename */
  filename?: string;
}

// =============================================================================
// Pack Generation Options
// =============================================================================

export interface PackGenerationOptions {
  /** Force regeneration even if cached */
  forceRegenerate?: boolean;
  /** Only generate specific artifacts */
  artifactsToGenerate?: Array<keyof EpisodePackArtifacts>;
  /** Skip Notion save */
  skipNotionSave?: boolean;
}
