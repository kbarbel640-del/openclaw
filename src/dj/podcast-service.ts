/**
 * Podcast Service for DJ Assistant
 *
 * Manages podcast episode workflows:
 * - Transcript ingestion with episode ID allocation
 * - Episode pack generation with budget-aware processing
 * - Cache management using transcript hash
 * - Notion persistence for episodes and assets
 */

import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync, renameSync } from "node:fs";
import { homedir } from "node:os";
import { join, dirname } from "node:path";
import type { BudgetGovernor } from "../budget/governor.js";
import type { NotionService } from "./notion/notion-service.js";
import type {
  CacheStatusResult,
  EpisodeId,
  EpisodeManifest,
  EpisodePack,
  EpisodePackArtifacts,
  IngestOptions,
  IngestResult,
  PackGenerationOptions,
  PackResult,
  PodcastServiceConfig,
  StatusResult,
} from "./podcast-types.js";
import { NotionOutbox, getDefaultNotionOutbox } from "./notion-outbox.js";
import {
  allocateEpisodeId,
  getLastAllocatedId,
  isEpisodeIdAvailable,
  reserveEpisodeId,
  rollbackEpisodeId,
  DEFAULT_STATE_FILE,
} from "./podcast-state.js";

// =============================================================================
// Constants
// =============================================================================

export const DEFAULT_PODCAST_DIR = join(homedir(), "openclaw", "dj", "podcast");

// =============================================================================
// Configuration
// =============================================================================

export interface FullPodcastServiceConfig {
  baseDir: string;
  stateFilePath: string;
  preferLocalModel: boolean;
}

export const DEFAULT_PODCAST_CONFIG: FullPodcastServiceConfig = {
  baseDir: DEFAULT_PODCAST_DIR,
  stateFilePath: DEFAULT_STATE_FILE,
  preferLocalModel: true,
};

// =============================================================================
// Podcast Service
// =============================================================================

export class PodcastService {
  private config: FullPodcastServiceConfig;
  private notionService?: NotionService;
  private budgetGovernor?: BudgetGovernor;
  private notionOutbox: NotionOutbox;

  constructor(config: Partial<PodcastServiceConfig> = {}) {
    this.config = {
      ...DEFAULT_PODCAST_CONFIG,
      baseDir: config.baseDir ?? DEFAULT_PODCAST_CONFIG.baseDir,
      stateFilePath: config.stateFilePath ?? DEFAULT_PODCAST_CONFIG.stateFilePath,
      preferLocalModel: config.preferLocalModel ?? DEFAULT_PODCAST_CONFIG.preferLocalModel,
    };
    this.notionOutbox = getDefaultNotionOutbox();
  }

  // ===========================================================================
  // Configuration
  // ===========================================================================

  /**
   * Set the Notion service for persistence.
   */
  setNotionService(service: NotionService): void {
    this.notionService = service;
  }

  /**
   * Set the budget governor for resource tracking.
   */
  setBudgetGovernor(governor: BudgetGovernor): void {
    this.budgetGovernor = governor;
  }

  /**
   * Get current configuration.
   */
  getConfig(): FullPodcastServiceConfig {
    return { ...this.config };
  }

  // ===========================================================================
  // Ingest Operations
  // ===========================================================================

  /**
   * Ingest a transcript and create episode record.
   */
  async ingest(transcriptContent: string, options: IngestOptions): Promise<IngestResult> {
    // Validate transcript
    if (!transcriptContent.trim()) {
      return {
        success: false,
        message: "Transcript content is empty",
      };
    }

    // Compute transcript hash (normalized for cross-platform consistency)
    const { cacheKey: transcriptHash, fullHash: transcriptHashFull } =
      this.computeTranscriptHash(transcriptContent);

    // Allocate or verify episode ID
    let episodeId: EpisodeId;
    let shouldRollback = false;

    if (options.episodeId) {
      // Verify override ID is available
      const existingIds = await this.getExistingEpisodeIds();
      if (!isEpisodeIdAvailable(options.episodeId, existingIds, this.config.stateFilePath)) {
        return {
          success: false,
          message: `Episode ID ${options.episodeId} is already in use`,
        };
      }
      episodeId = options.episodeId;
      // Reserve the ID if it's higher than current counter
      reserveEpisodeId(episodeId, this.config.stateFilePath);
    } else {
      episodeId = allocateEpisodeId(this.config.stateFilePath);
      shouldRollback = true;
    }

    try {
      // Create local directory structure
      const episodeDir = this.getEpisodeDir(episodeId);
      mkdirSync(episodeDir, { recursive: true });

      // Save transcript
      const transcriptPath = join(episodeDir, "transcript.txt");
      this.atomicWrite(transcriptPath, transcriptContent);

      // Create manifest
      const now = new Date().toISOString();
      const manifest: EpisodeManifest = {
        episodeId,
        transcriptHash,
        transcriptHashFull,
        createdAt: now,
        updatedAt: now,
        sourceInfo: {
          type: options.sourceType,
          source: options.sourcePath ?? "clipboard",
          filename: options.filename,
          sizeBytes: Buffer.byteLength(transcriptContent, "utf-8"),
          ingestedAt: now,
        },
        artifactVersions: {},
        notionPageIds: {},
        status: "ingested",
      };

      // Save manifest
      this.saveManifest(episodeId, manifest);

      // Create Notion episode record (non-fatal)
      let notionPageId: string | undefined;
      if (this.notionService) {
        try {
          const page = await this.notionService.createEpisodePipelineEntry?.({
            episodeId,
            title: `Episode ${episodeId}`,
            status: "Ingested",
            transcriptHash,
            sourceType: options.sourceType,
            sourcePath: options.sourcePath,
            createdAt: now,
            updatedAt: now,
          });
          notionPageId = page?.id;
          if (notionPageId) {
            manifest.notionPageIds.episodePipeline = notionPageId;
            this.saveManifest(episodeId, manifest);
          }
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : String(error);
          console.error("[podcast-service] Non-fatal: Failed to create Notion entry:", error);
          // Queue for retry
          this.notionOutbox.queue(
            "create_episode_pipeline",
            `${episodeId}:${transcriptHash}`,
            {
              episodeId,
              title: `Episode ${episodeId}`,
              status: "Ingested",
              transcriptHash,
              sourceType: options.sourceType,
              sourcePath: options.sourcePath,
              createdAt: now,
              updatedAt: now,
            },
            errorMsg,
          );
        }
      }

      // Check outbox status for user feedback
      const outboxStatus = this.notionOutbox.getStatus();
      const syncPending = outboxStatus.pendingCount > 0;

      return {
        success: true,
        episodeId,
        transcriptHash,
        transcriptPath,
        notionPageId,
        message: `Episode ${episodeId} ingested successfully${syncPending ? ` (${outboxStatus.pendingCount} Notion sync pending)` : ""}`,
      };
    } catch (error) {
      // Rollback episode ID on failure
      if (shouldRollback) {
        rollbackEpisodeId(episodeId, this.config.stateFilePath);
      }
      return {
        success: false,
        message: `Failed to ingest episode: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  // ===========================================================================
  // Pack Operations
  // ===========================================================================

  /**
   * Generate episode pack (or retrieve from cache).
   */
  async pack(
    episodeIdOrLatest: EpisodeId | "latest" = "latest",
    options: PackGenerationOptions = {},
  ): Promise<PackResult> {
    // Resolve episode ID
    const episodeId =
      episodeIdOrLatest === "latest" ? this.getLatestEpisodeId() : episodeIdOrLatest;

    if (!episodeId) {
      return {
        success: false,
        fromCache: false,
        message: "No episodes found",
      };
    }

    const manifest = this.loadManifest(episodeId);
    if (!manifest) {
      return {
        success: false,
        episodeId,
        fromCache: false,
        message: `Episode ${episodeId} not found`,
      };
    }

    // Check cache by transcript hash (unless forcing regeneration)
    if (!options.forceRegenerate) {
      const cacheKey = manifest.transcriptHash;
      const cached = await this.checkPackCache(episodeId, cacheKey);
      if (cached) {
        return {
          success: true,
          episodeId,
          pack: cached,
          fromCache: true,
          message: `Pack retrieved from cache (hash: ${cacheKey.slice(0, 8)}...)`,
        };
      }
    }

    // Load transcript
    const transcript = this.loadTranscript(episodeId);
    if (!transcript) {
      return {
        success: false,
        episodeId,
        fromCache: false,
        message: `Transcript not found for ${episodeId}`,
      };
    }

    // Update status to pack_pending
    manifest.status = "pack_pending";
    manifest.updatedAt = new Date().toISOString();
    this.saveManifest(episodeId, manifest);

    // Generate pack with budget tracking
    const profile = this.budgetGovernor?.getStatus().profileId ?? "normal";

    try {
      const artifacts = await this.generatePackArtifacts(transcript, manifest, options);

      const pack: EpisodePack = {
        episodeId,
        transcriptHash: manifest.transcriptHash,
        generatedAt: new Date().toISOString(),
        profile,
        artifacts,
      };

      // Save to local cache
      this.savePackCache(episodeId, pack);

      // Save individual artifact files
      this.savePackArtifactFiles(episodeId, pack);

      // Save to Notion assets (non-fatal)
      if (!options.skipNotionSave) {
        await this.savePackToNotion(episodeId, pack);
      }

      // Update manifest status
      manifest.status = "pack_complete";
      manifest.updatedAt = new Date().toISOString();
      this.updateArtifactVersions(manifest, artifacts, profile, false);
      this.saveManifest(episodeId, manifest);

      return {
        success: true,
        episodeId,
        pack,
        fromCache: false,
        message: `Pack generated for ${episodeId}`,
      };
    } catch (error) {
      // Check if budget exceeded
      if (this.budgetGovernor?.isStopped()) {
        const stopReason = this.budgetGovernor.getStopReason();
        manifest.status = "pack_partial";
        manifest.updatedAt = new Date().toISOString();
        this.saveManifest(episodeId, manifest);

        return {
          success: false,
          episodeId,
          fromCache: false,
          budgetExceeded: true,
          message: `Budget limit reached: ${stopReason?.message ?? "unknown limit"}. Use deep mode to complete.`,
        };
      }

      return {
        success: false,
        episodeId,
        fromCache: false,
        message: `Failed to generate pack: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  // ===========================================================================
  // Status Operations
  // ===========================================================================

  /**
   * Get episode status.
   */
  getStatus(episodeIdOrLatest: EpisodeId | "latest" = "latest"): StatusResult {
    const episodeId =
      episodeIdOrLatest === "latest" ? this.getLatestEpisodeId() : episodeIdOrLatest;

    if (!episodeId) {
      return {
        success: false,
        episodeId: "E000" as EpisodeId,
        message: "No episodes found",
      };
    }

    const manifest = this.loadManifest(episodeId);
    if (!manifest) {
      return {
        success: false,
        episodeId,
        message: `Episode ${episodeId} not found`,
      };
    }

    const pack = this.loadPackCache(episodeId);

    // Get Notion outbox status
    const outboxStatus = this.notionOutbox.getStatus();
    const notionSync =
      outboxStatus.pendingCount > 0
        ? {
            pending: true,
            pendingCount: outboxStatus.pendingCount,
            oldestQueuedAt: outboxStatus.oldestQueuedAt,
            recentErrors: outboxStatus.recentErrors.slice(0, 3).map((e) => e.error),
          }
        : { pending: false, pendingCount: 0 };

    const syncWarning = notionSync.pending
      ? ` (⚠️ ${outboxStatus.pendingCount} Notion sync pending)`
      : "";

    return {
      success: true,
      episodeId,
      manifest,
      pack: pack ?? undefined,
      notionSync,
      message: `Status for ${episodeId}: ${manifest.status}${syncWarning}`,
    };
  }

  /**
   * Get cache status for an episode.
   */
  async getCacheStatus(
    episodeIdOrLatest: EpisodeId | "latest" = "latest",
  ): Promise<CacheStatusResult> {
    const episodeId =
      episodeIdOrLatest === "latest" ? this.getLatestEpisodeId() : episodeIdOrLatest;

    if (!episodeId) {
      return {
        success: false,
        episodeId: "E000" as EpisodeId,
        cached: false,
        message: "No episodes found",
      };
    }

    const manifest = this.loadManifest(episodeId);
    if (!manifest) {
      return {
        success: false,
        episodeId,
        cached: false,
        message: `Episode ${episodeId} not found`,
      };
    }

    const cacheKey = manifest.transcriptHash;
    const localCached = this.loadPackCache(episodeId) !== null;

    // Check Notion cache
    let notionAssetId: string | undefined;
    if (this.notionService) {
      try {
        const asset = await this.notionService.findPodcastAssetByCacheKey?.(cacheKey);
        notionAssetId = asset?.id;
      } catch {
        // Ignore Notion errors
      }
    }

    return {
      success: true,
      episodeId,
      cached: localCached || !!notionAssetId,
      cacheKey,
      notionAssetId,
      message: localCached
        ? "Pack cached locally"
        : notionAssetId
          ? "Pack cached in Notion"
          : "No cache found",
    };
  }

  /**
   * Get latest episode ID.
   */
  getLatestEpisodeId(): EpisodeId | null {
    return getLastAllocatedId(this.config.stateFilePath);
  }

  /**
   * Retry failed Notion sync operations.
   * Returns number of successful retries and remaining pending count.
   */
  async retryNotionSync(): Promise<{ succeeded: number; remaining: number; errors: string[] }> {
    if (!this.notionService) {
      return { succeeded: 0, remaining: 0, errors: ["Notion service not configured"] };
    }

    const pending = this.notionOutbox.getPending();
    let succeeded = 0;
    const errors: string[] = [];

    for (const entry of pending) {
      try {
        switch (entry.operationType) {
          case "create_episode_pipeline":
            await this.notionService.createEpisodePipelineEntry?.(
              entry.payload as Parameters<
                NonNullable<NotionService["createEpisodePipelineEntry"]>
              >[0],
            );
            this.notionOutbox.markComplete(entry.id);
            succeeded++;
            break;

          case "save_podcast_asset":
            await this.notionService.savePodcastAsset?.(
              entry.payload as Parameters<NonNullable<NotionService["savePodcastAsset"]>>[0],
            );
            this.notionOutbox.markComplete(entry.id);
            succeeded++;
            break;

          case "update_episode_pipeline":
            // For updates, we'd need the page ID - skip for now
            errors.push(`Cannot retry update_episode_pipeline without page ID: ${entry.dedupeKey}`);
            break;
        }
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        this.notionOutbox.recordRetryFailure(entry.id, errorMsg);
        errors.push(`${entry.dedupeKey}: ${errorMsg}`);
      }
    }

    const remaining = this.notionOutbox.getStatus().pendingCount;
    return { succeeded, remaining, errors };
  }

  /**
   * Get the Notion outbox for direct access.
   */
  getNotionOutbox(): NotionOutbox {
    return this.notionOutbox;
  }

  // ===========================================================================
  // Internal Helpers
  // ===========================================================================

  private getEpisodeDir(episodeId: EpisodeId): string {
    return join(this.config.baseDir, "episodes", episodeId);
  }

  /**
   * Normalize transcript for consistent hashing across platforms.
   * - Converts CRLF to LF
   * - Trims trailing whitespace from each line
   * - Trims trailing newlines
   */
  private normalizeTranscript(content: string): string {
    return content
      .replace(/\r\n/g, "\n") // CRLF → LF
      .replace(/\r/g, "\n") // CR → LF (old Mac)
      .split("\n")
      .map((line) => line.trimEnd()) // Trim trailing whitespace per line
      .join("\n")
      .trimEnd(); // Trim trailing newlines
  }

  /**
   * Compute transcript hash with normalization.
   * Returns both the 16-char cache key and full 64-char hash.
   */
  private computeTranscriptHash(content: string): { cacheKey: string; fullHash: string } {
    const normalized = this.normalizeTranscript(content);
    const fullHash = createHash("sha256").update(normalized).digest("hex");
    return {
      cacheKey: fullHash.slice(0, 16),
      fullHash,
    };
  }

  private atomicWrite(filePath: string, content: string): void {
    const dir = dirname(filePath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    const tmp = `${filePath}.${process.pid}.${Date.now()}.tmp`;
    writeFileSync(tmp, content, "utf-8");
    renameSync(tmp, filePath);
  }

  private loadManifest(episodeId: EpisodeId): EpisodeManifest | null {
    const manifestPath = join(this.getEpisodeDir(episodeId), "manifest.json");
    try {
      if (existsSync(manifestPath)) {
        return JSON.parse(readFileSync(manifestPath, "utf-8"));
      }
    } catch {
      // Return null on error
    }
    return null;
  }

  private saveManifest(episodeId: EpisodeId, manifest: EpisodeManifest): void {
    const manifestPath = join(this.getEpisodeDir(episodeId), "manifest.json");
    this.atomicWrite(manifestPath, JSON.stringify(manifest, null, 2));
  }

  private loadTranscript(episodeId: EpisodeId): string | null {
    const transcriptPath = join(this.getEpisodeDir(episodeId), "transcript.txt");
    try {
      if (existsSync(transcriptPath)) {
        return readFileSync(transcriptPath, "utf-8");
      }
    } catch {
      // Return null on error
    }
    return null;
  }

  private loadPackCache(episodeId: EpisodeId): EpisodePack | null {
    const packPath = join(this.getEpisodeDir(episodeId), "pack", "pack.json");
    try {
      if (existsSync(packPath)) {
        return JSON.parse(readFileSync(packPath, "utf-8"));
      }
    } catch {
      // Return null on error
    }
    return null;
  }

  private savePackCache(episodeId: EpisodeId, pack: EpisodePack): void {
    const packDir = join(this.getEpisodeDir(episodeId), "pack");
    mkdirSync(packDir, { recursive: true });
    const packPath = join(packDir, "pack.json");
    this.atomicWrite(packPath, JSON.stringify(pack, null, 2));
  }

  private savePackArtifactFiles(episodeId: EpisodeId, pack: EpisodePack): void {
    const packDir = join(this.getEpisodeDir(episodeId), "pack");
    const { artifacts } = pack;

    // Save individual artifact files for human readability
    if (artifacts.showNotes) {
      this.atomicWrite(join(packDir, "show_notes_short.md"), artifacts.showNotes.short);
      this.atomicWrite(join(packDir, "show_notes_long.md"), artifacts.showNotes.long);
    }

    if (artifacts.titles) {
      this.atomicWrite(join(packDir, "titles.json"), JSON.stringify(artifacts.titles, null, 2));
    }

    if (artifacts.chapters) {
      this.atomicWrite(join(packDir, "chapters.json"), JSON.stringify(artifacts.chapters, null, 2));
    }

    if (artifacts.quotes) {
      const quotesMarkdown = artifacts.quotes
        .map(
          (q) =>
            `> "${q.text}"\n> — ${q.speaker}${q.timestamp ? ` (${q.timestamp})` : ""}\n> [${q.category}]\n`,
        )
        .join("\n");
      this.atomicWrite(join(packDir, "quotes.md"), quotesMarkdown);
    }

    if (artifacts.clipPlan) {
      const clipMarkdown = artifacts.clipPlan.clips
        .map(
          (c, i) =>
            `## Clip ${i + 1}: ${c.title}\n\n- **Type:** ${c.type}\n- **Timestamps:** ${c.startTimestamp} - ${c.endTimestamp}\n- **Platform:** ${c.platform}\n- **Rationale:** ${c.rationale}\n`,
        )
        .join("\n");
      this.atomicWrite(join(packDir, "clip_plan.md"), clipMarkdown);
    }

    if (artifacts.guestFollowUp) {
      const emailContent = `Subject: ${artifacts.guestFollowUp.subject}\n\n${artifacts.guestFollowUp.body}`;
      this.atomicWrite(join(packDir, "followup_email.md"), emailContent);
    }
  }

  private async checkPackCache(
    episodeId: EpisodeId,
    cacheKey: string,
  ): Promise<EpisodePack | null> {
    // Check local cache first
    const local = this.loadPackCache(episodeId);
    if (local && local.transcriptHash === cacheKey) {
      return local;
    }

    // Check Notion cache
    if (this.notionService) {
      try {
        const asset = await this.notionService.findPodcastAssetByCacheKey?.(cacheKey);
        if (asset) {
          // Could extract pack from Notion asset if needed
          // For now, we only use local cache for pack retrieval
        }
      } catch {
        // Ignore Notion errors
      }
    }

    return null;
  }

  private async getExistingEpisodeIds(): Promise<EpisodeId[]> {
    if (!this.notionService) {
      return [];
    }
    try {
      const ids = await this.notionService.listEpisodeIds?.();
      // Filter and cast to EpisodeId[] - listEpisodeIds already filters for E### format
      return (ids ?? []) as EpisodeId[];
    } catch {
      return [];
    }
  }

  private async generatePackArtifacts(
    transcript: string,
    manifest: EpisodeManifest,
    _options: PackGenerationOptions,
  ): Promise<EpisodePackArtifacts> {
    // Check budget before proceeding
    if (this.budgetGovernor) {
      const check = this.budgetGovernor.checkLimits();
      if (!check.allowed) {
        throw new Error(`Budget limit: ${check.message}`);
      }
    }

    // This is a placeholder for actual LLM-based pack generation.
    // In production, this would:
    // 1. Chunk the transcript if needed
    // 2. Call the agent to generate each artifact
    // 3. Track tool/LLM calls with budget governor
    // 4. Handle partial generation on budget exceeded

    // For now, return placeholder artifacts to demonstrate structure
    const artifacts: EpisodePackArtifacts = {
      titles: {
        safe: [
          `Episode ${manifest.episodeId}: A Conversation`,
          `What We Learned in ${manifest.episodeId}`,
          `Insights from Episode ${manifest.episodeId}`,
          `The ${manifest.episodeId} Discussion`,
          `Episode ${manifest.episodeId} Takeaways`,
        ],
        spicy: [
          `${manifest.episodeId}: The Episode That Changes Everything`,
          `You Won't Believe What We Discussed in ${manifest.episodeId}`,
          `${manifest.episodeId}: No Holds Barred`,
          `The Controversial ${manifest.episodeId} Episode`,
          `${manifest.episodeId}: Unfiltered`,
        ],
      },
      showNotes: {
        short: `Episode ${manifest.episodeId} covers key topics from our latest recording session. This episode explores important themes relevant to our audience.`,
        long: `# Episode ${manifest.episodeId}\n\n## Overview\n\nThis episode delves into the topics discussed during our recording session.\n\n## Key Points\n\n- Topic 1\n- Topic 2\n- Topic 3\n\n## Resources\n\nLinks and references mentioned in this episode.\n\n## Contact\n\nReach out with questions or feedback.`,
      },
      chapters: [
        { timestamp: "00:00:00", title: "Introduction", description: "Welcome and overview" },
        { timestamp: "00:05:00", title: "Main Discussion", description: "Core topics" },
        { timestamp: "00:30:00", title: "Deep Dive", description: "Detailed exploration" },
        { timestamp: "00:45:00", title: "Q&A", description: "Listener questions" },
        { timestamp: "00:55:00", title: "Wrap Up", description: "Summary and closing" },
      ],
      quotes: [
        {
          text: "Placeholder quote from the transcript",
          speaker: "Guest",
          timestamp: "00:15:30",
          category: "insight",
        },
      ],
      clipPlan: {
        clips: [
          {
            type: "hook",
            startTimestamp: "00:02:30",
            endTimestamp: "00:03:00",
            title: "Opening Hook",
            rationale: "Attention-grabbing opening statement",
            platform: "twitter",
          },
          {
            type: "context",
            startTimestamp: "00:10:00",
            endTimestamp: "00:11:30",
            title: "Key Context",
            rationale: "Sets up the main discussion",
            platform: "linkedin",
          },
          {
            type: "takeaway",
            startTimestamp: "00:35:00",
            endTimestamp: "00:36:30",
            title: "Main Takeaway",
            rationale: "Actionable insight for audience",
            platform: "instagram",
          },
          {
            type: "cta",
            startTimestamp: "00:55:00",
            endTimestamp: "00:56:00",
            title: "Call to Action",
            rationale: "Encourages engagement",
            platform: "tiktok",
          },
          {
            type: "highlight",
            startTimestamp: "00:25:00",
            endTimestamp: "00:27:00",
            title: "Episode Highlight",
            rationale: "Most engaging moment",
            platform: "youtube_shorts",
          },
        ],
      },
    };

    // Record tool call for budget tracking
    if (this.budgetGovernor) {
      this.budgetGovernor.recordToolCall("podcast_pack_generate");
    }

    return artifacts;
  }

  private async savePackToNotion(episodeId: EpisodeId, pack: EpisodePack): Promise<void> {
    if (!this.notionService) {
      console.warn("[podcast-service] Notion not configured, skipping pack save");
      return;
    }

    const assetEntry = {
      episodeId,
      transcriptHash: pack.transcriptHash,
      artifactType: "full_pack" as const,
      content: JSON.stringify(pack.artifacts),
      cacheKey: pack.transcriptHash,
      version: 1,
      profile: pack.profile,
      generatedAt: pack.generatedAt,
    };

    try {
      await this.notionService.savePodcastAsset?.(assetEntry);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error("[podcast-service] Non-fatal: Failed to save pack to Notion:", error);
      // Queue for retry
      this.notionOutbox.queue(
        "save_podcast_asset",
        `${episodeId}:${pack.transcriptHash}:full_pack`,
        assetEntry,
        errorMsg,
      );
    }
  }

  private updateArtifactVersions(
    manifest: EpisodeManifest,
    artifacts: EpisodePackArtifacts,
    profile: string,
    fromCache: boolean,
  ): void {
    const now = new Date().toISOString();
    for (const key of Object.keys(artifacts) as Array<keyof EpisodePackArtifacts>) {
      if (artifacts[key] !== undefined) {
        const existing = manifest.artifactVersions[key];
        manifest.artifactVersions[key] = {
          name: key,
          version: (existing?.version ?? 0) + 1,
          generatedAt: now,
          profile: profile as "cheap" | "normal" | "deep",
          fromCache,
        };
      }
    }
  }
}

// =============================================================================
// Factory Functions
// =============================================================================

/**
 * Create a podcast service with default configuration.
 */
export function createPodcastService(config?: Partial<PodcastServiceConfig>): PodcastService {
  return new PodcastService(config);
}

/**
 * Load podcast service configuration from environment variables.
 */
export function loadPodcastConfig(): Partial<PodcastServiceConfig> {
  return {
    baseDir: process.env.DJ_PODCAST_DIR ?? DEFAULT_PODCAST_DIR,
    preferLocalModel: process.env.DJ_PODCAST_PREFER_LOCAL !== "false",
  };
}
