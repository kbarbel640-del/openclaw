/**
 * DJ Assistant Profile Module
 *
 * Helpers for DJ-Personal and DJ-WorkSafe agent profiles.
 */

export {
  extractDateReference,
  parseCaptureInput,
  type CaptureType,
  type ParsedCapture,
} from "./capture-parser.js";

export {
  buildParagraphBlock,
  buildTaskPagePayload,
  buildTasksDueDateFilter,
  formatNotionCheckbox,
  formatNotionDate,
  formatNotionMultiSelect,
  formatNotionNumber,
  formatNotionRichText,
  formatNotionSelect,
  formatNotionTitle,
  formatNotionUrl,
} from "./notion-format.js";

// Web Operator (M4)
export {
  type ActionClass,
  type AllowlistEntry,
  type DenyRuleResult,
  type FormFieldInfo,
  type PageContext,
  type PolicyDecision,
  type WebPolicyConfig,
  AllowlistManager,
  applyDenyRules,
  classifyAction,
  containsSensitiveKeywords,
  DEFAULT_ALLOWLIST,
  DEFAULT_POLICY_CONFIG,
  DEFAULT_SENSITIVE_KEYWORDS,
  evaluatePolicy,
  findAllowlistEntry,
  HARD_APPROVAL_ACTIONS,
  hostMatchesEntry,
  isCrossDomainSubmit,
  isPageAllowlisted,
  isSubmitTargetAllowlisted,
  normalizeHost,
  pathMatchesEntry,
} from "./web-policy.js";

export {
  type AutoSubmitCheckResult,
  type AutoSubmitState,
  type WorkflowState,
  AutoSubmitStateManager,
  createAutoSubmitStateManager,
  getStateFilePath,
  getTodayDate,
  loadState,
  saveState,
} from "./web-autosubmit-state.js";

export {
  type NotionWebOpsLogEntry,
  type WebActionLog,
  type WebLoggingConfig,
  type WebOperationLog,
  createWebOperationLogger,
  formatDuration,
  generateLogId,
  getLogFilePath,
  WebOperationLogger,
} from "./web-logging.js";

export {
  type BrowserInterface,
  type PendingApproval,
  type WebOperatorConfig,
  type WorkflowResult,
  type WorkflowStatus,
  type WorkflowStep,
  createWebOperator,
  DEFAULT_OPERATOR_CONFIG,
  generateWorkflowId,
  requiresHardApproval,
  WebOperator,
} from "./web-operator.js";

// Notion Integration (M4.5)
export {
  blocksToMarkdown,
  computeContentHash,
  createNotionClient,
  createNotionClientOptional,
  createNotionService,
  extractPlainText,
  loadNotionServiceConfig,
  NotionApiError,
  NotionClient,
  NotionNotFoundError,
  NotionRateLimitError,
  NotionService,
  NotionValidationError,
  type NotionBlock,
  type NotionClientConfig,
  type NotionPage,
  type NotionServiceConfig,
  type ResearchRadarEntry,
  type SitePostEntry,
  type WebOpsLogEntry,
} from "./notion/index.js";

// Research Service (M4.5)
export {
  createResearchService,
  DEFAULT_RESEARCH_CONFIG,
  DEFAULT_RESEARCH_LIMITS,
  loadResearchConfig,
  ResearchService,
  type BudgetProfileId,
  type ResearchCacheEntry,
  type ResearchLimits,
  type ResearchResult,
  type ResearchServiceConfig,
} from "./research-service.js";

// Site Service (M4.5)
export {
  createSiteService,
  DEFAULT_SITE_CONFIG,
  loadSiteConfig,
  SiteService,
  type CreateDraftResult,
  type FetchContentResult,
  type PostMetadata,
  type PostStatus,
  type PostTemplate,
  type PublishResult,
  type SiteServiceConfig,
  type UpdateDraftResult,
} from "./site-service.js";

// Podcast Service (M5)
export {
  type ArtifactVersion,
  type CacheStatusResult,
  type Chapter,
  type ClipPlan,
  type ClipSpec,
  type EpisodeId,
  type EpisodeManifest,
  type EpisodePack,
  type EpisodePackArtifacts,
  type EpisodeSourceInfo,
  type EpisodeStatus,
  type GuestFollowUp,
  type IngestOptions,
  type IngestResult,
  type NotionPageIds,
  type NotionSyncStatus,
  type PackGenerationOptions,
  type PackResult,
  type PodcastServiceConfig,
  type PodcastState,
  type Quote,
  type ShowNotes,
  type StatusResult,
  type TitleSet,
} from "./podcast-types.js";

export {
  allocateEpisodeId,
  DEFAULT_STATE_DIR,
  DEFAULT_STATE_FILE,
  formatEpisodeId,
  getLastAllocatedId,
  getPodcastState,
  isEpisodeIdAvailable,
  isValidEpisodeId,
  loadPodcastState,
  parseEpisodeId,
  peekNextEpisodeId,
  reserveEpisodeId,
  resetPodcastState,
  rollbackEpisodeId,
  savePodcastState,
} from "./podcast-state.js";

export {
  createPodcastService,
  DEFAULT_PODCAST_CONFIG,
  DEFAULT_PODCAST_DIR,
  loadPodcastConfig,
  PodcastService,
  type FullPodcastServiceConfig,
} from "./podcast-service.js";

// Notion Outbox (M5 retry queue)
export {
  createNotionOutbox,
  DEFAULT_OUTBOX_DIR,
  getDefaultNotionOutbox,
  NotionOutbox,
  type OutboxEntry,
  type OutboxOperationType,
  type OutboxStatus,
} from "./notion-outbox.js";

// RLM Service (M6)
export {
  createRlmService,
  createRlmStore,
  DEFAULT_RLM_CONFIG,
  generateRlmSessionId,
  isValidRlmSessionId,
  RLM_MAX_DEPTH,
  RLM_MAX_ITERATIONS,
  RLM_MAX_SUBAGENTS,
  RlmService,
  RlmStore,
  type RefinementDecision,
  type RlmConfig,
  type RlmExecutor,
  type RlmHistoryResult,
  type RlmIteration,
  type RlmResult,
  type RlmRunOptions,
  type RlmServiceConfig,
  type RlmSession,
  type RlmSessionId,
  type RlmSessionStatus,
  type RlmSessionSummary,
  type RlmStatusResult,
  type RlmStopReason,
  type RlmStoreConfig,
} from "./rlm/index.js";

// Improve Service (M6)
export {
  buildFullBlocklist,
  calculateTotalLines,
  checkBlocklist,
  createImproveService,
  DEFAULT_BLOCKLIST,
  DEFAULT_IMPROVE_CONFIG,
  filterByBlocklist,
  filterByScope,
  filterToLineBudget,
  generateOpportunityId,
  generatePlanId,
  ImproveService,
  isValidOpportunityId,
  isValidPlanId,
  matchesScope,
  MAX_PR_LINES,
  NEVER_AUTO_MERGE,
  sortOpportunities,
  type BlocklistCheckResult,
  type CreatePrOptions,
  type CreatePrResult,
  type ImproveConfig,
  type ImproveOpportunityId,
  type ImprovePlan,
  type ImprovePlanId,
  type ImprovePlanStatus,
  type ImproveServiceConfig,
  type ImproveStatusResult,
  type ImprovementOpportunity,
  type OpportunityConfidence,
  type OpportunityType,
  type PlanOptions,
  type ScanOptions,
  type ScanResult,
} from "./improve/index.js";
