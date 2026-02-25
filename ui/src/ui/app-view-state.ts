import type { EventLogEntry } from "./app-events.ts";
import type { CompactionStatus } from "./app-tool-stream.ts";
import type { DevicePairingList } from "./controllers/devices.ts";
import type { ExecApprovalRequest } from "./controllers/exec-approval.ts";
import type { ExecApprovalsFile, ExecApprovalsSnapshot } from "./controllers/exec-approvals.ts";
import type { SkillMessage } from "./controllers/skills.ts";
import type { GatewayBrowserClient, GatewayHelloOk } from "./gateway.ts";
import type { Tab } from "./navigation.ts";
import type { UiSettings } from "./storage.ts";
import type { ThemeTransitionContext } from "./theme-transition.ts";
import type { ThemeMode } from "./theme.ts";
import type {
  AgentsListResult,
  AgentsFilesListResult,
  AgentIdentityResult,
  ChannelsStatusSnapshot,
  ConfigSnapshot,
  ConfigUiHints,
  CronJob,
  CronRunLogEntry,
  CronStatus,
  HealthSnapshot,
  LogEntry,
  LogLevel,
  NostrProfile,
  PresenceEntry,
  SessionsUsageResult,
  CostUsageSummary,
  SessionUsageTimeSeries,
  SessionsListResult,
  TedWorkbenchSnapshot,
  TedIntakeRecommendation,
  TedJobCardImpactPreview,
  TedKpiSuggestion,
  TedPolicyDocument,
  TedPolicyImpactPreview,
  TedPolicyKey,
  TedSourceDocument,
  TedDealFull,
  TedDealSummary,
  TedJobCardDetail,
  TedLlmProviderConfig,
  TedMeetingUpcomingResponse,
  TedCommitmentsListResponse,
  TedActionsListResponse,
  TedWaitingForListResponse,
  TedTrustMetricsResponse,
  TedDeepWorkMetricsResponse,
  TedDraftQueueResponse,
  TedEventLogStatsResponse,
  TedPlannerListResponse,
  TedPlannerTasksResponse,
  TedTodoListsResponse,
  TedTodoTasksResponse,
  TedSyncReconciliationResponse,
  TedSyncProposalsResponse,
  TedCommitmentExtractionResponse,
  TedImprovementProposal,
  TedTrustAutonomyEvaluation,
  TedFailureAggregationResponse,
  SkillStatusReport,
  StatusSummary,
} from "./types.ts";
import type { ChatAttachment, ChatQueueItem, CronFormState } from "./ui-types.ts";
import type { NostrProfileFormState } from "./views/channels.nostr-profile-form.ts";
import type { SessionLogEntry } from "./views/usage.ts";

export type AppViewState = {
  settings: UiSettings;
  password: string;
  tab: Tab;
  onboarding: boolean;
  basePath: string;
  connected: boolean;
  theme: ThemeMode;
  themeResolved: "light" | "dark";
  hello: GatewayHelloOk | null;
  lastError: string | null;
  eventLog: EventLogEntry[];
  assistantName: string;
  assistantAvatar: string | null;
  assistantAgentId: string | null;
  sessionKey: string;
  chatLoading: boolean;
  chatSending: boolean;
  chatMessage: string;
  chatAttachments: ChatAttachment[];
  chatMessages: unknown[];
  chatToolMessages: unknown[];
  chatStream: string | null;
  chatStreamStartedAt: number | null;
  chatRunId: string | null;
  compactionStatus: CompactionStatus | null;
  chatAvatarUrl: string | null;
  chatThinkingLevel: string | null;
  chatQueue: ChatQueueItem[];
  chatManualRefreshInFlight: boolean;
  nodesLoading: boolean;
  nodes: Array<Record<string, unknown>>;
  chatNewMessagesBelow: boolean;
  sidebarOpen: boolean;
  sidebarContent: string | null;
  sidebarError: string | null;
  splitRatio: number;
  scrollToBottom: (opts?: { smooth?: boolean }) => void;
  devicesLoading: boolean;
  devicesError: string | null;
  devicesList: DevicePairingList | null;
  execApprovalsLoading: boolean;
  execApprovalsSaving: boolean;
  execApprovalsDirty: boolean;
  execApprovalsSnapshot: ExecApprovalsSnapshot | null;
  execApprovalsForm: ExecApprovalsFile | null;
  execApprovalsSelectedAgent: string | null;
  execApprovalsTarget: "gateway" | "node";
  execApprovalsTargetNodeId: string | null;
  execApprovalQueue: ExecApprovalRequest[];
  execApprovalBusy: boolean;
  execApprovalError: string | null;
  pendingGatewayUrl: string | null;
  configLoading: boolean;
  configRaw: string;
  configRawOriginal: string;
  configValid: boolean | null;
  configIssues: unknown[];
  configSaving: boolean;
  configApplying: boolean;
  updateRunning: boolean;
  applySessionKey: string;
  configSnapshot: ConfigSnapshot | null;
  configSchema: unknown;
  configSchemaVersion: string | null;
  configSchemaLoading: boolean;
  configUiHints: ConfigUiHints;
  configForm: Record<string, unknown> | null;
  configFormOriginal: Record<string, unknown> | null;
  configFormMode: "form" | "raw";
  configSearchQuery: string;
  configActiveSection: string | null;
  configActiveSubsection: string | null;
  channelsLoading: boolean;
  channelsSnapshot: ChannelsStatusSnapshot | null;
  channelsError: string | null;
  channelsLastSuccess: number | null;
  whatsappLoginMessage: string | null;
  whatsappLoginQrDataUrl: string | null;
  whatsappLoginConnected: boolean | null;
  whatsappBusy: boolean;
  nostrProfileFormState: NostrProfileFormState | null;
  nostrProfileAccountId: string | null;
  configFormDirty: boolean;
  presenceLoading: boolean;
  presenceEntries: PresenceEntry[];
  presenceError: string | null;
  presenceStatus: string | null;
  agentsLoading: boolean;
  agentsList: AgentsListResult | null;
  agentsError: string | null;
  agentsSelectedId: string | null;
  agentsPanel: "overview" | "files" | "tools" | "skills" | "channels" | "cron";
  agentFilesLoading: boolean;
  agentFilesError: string | null;
  agentFilesList: AgentsFilesListResult | null;
  agentFileContents: Record<string, string>;
  agentFileDrafts: Record<string, string>;
  agentFileActive: string | null;
  agentFileSaving: boolean;
  agentIdentityLoading: boolean;
  agentIdentityError: string | null;
  agentIdentityById: Record<string, AgentIdentityResult>;
  agentSkillsLoading: boolean;
  agentSkillsError: string | null;
  agentSkillsReport: SkillStatusReport | null;
  agentSkillsAgentId: string | null;
  sessionsLoading: boolean;
  sessionsResult: SessionsListResult | null;
  sessionsError: string | null;
  sessionsFilterActive: string;
  sessionsFilterLimit: string;
  sessionsIncludeGlobal: boolean;
  sessionsIncludeUnknown: boolean;
  usageLoading: boolean;
  usageResult: SessionsUsageResult | null;
  usageCostSummary: CostUsageSummary | null;
  usageError: string | null;
  usageStartDate: string;
  usageEndDate: string;
  usageSelectedSessions: string[];
  usageSelectedDays: string[];
  usageSelectedHours: number[];
  usageChartMode: "tokens" | "cost";
  usageDailyChartMode: "total" | "by-type";
  usageTimeSeriesMode: "cumulative" | "per-turn";
  usageTimeSeriesBreakdownMode: "total" | "by-type";
  usageTimeSeries: SessionUsageTimeSeries | null;
  usageTimeSeriesLoading: boolean;
  usageTimeSeriesCursorStart: number | null;
  usageTimeSeriesCursorEnd: number | null;
  usageSessionLogs: SessionLogEntry[] | null;
  usageSessionLogsLoading: boolean;
  usageSessionLogsExpanded: boolean;
  usageQuery: string;
  usageQueryDraft: string;
  usageQueryDebounceTimer: number | null;
  usageSessionSort: "tokens" | "cost" | "recent" | "messages" | "errors";
  usageSessionSortDir: "asc" | "desc";
  usageRecentSessions: string[];
  usageTimeZone: "local" | "utc";
  usageContextExpanded: boolean;
  usageHeaderPinned: boolean;
  usageSessionsTab: "all" | "recent";
  usageVisibleColumns: string[];
  usageLogFilterRoles: import("./views/usage.js").SessionLogRole[];
  usageLogFilterTools: string[];
  usageLogFilterHasTools: boolean;
  usageLogFilterQuery: string;
  cronLoading: boolean;
  cronJobs: CronJob[];
  cronStatus: CronStatus | null;
  cronError: string | null;
  cronForm: CronFormState;
  cronRunsJobId: string | null;
  cronRuns: CronRunLogEntry[];
  cronBusy: boolean;
  skillsLoading: boolean;
  skillsReport: SkillStatusReport | null;
  skillsError: string | null;
  skillsFilter: string;
  skillEdits: Record<string, string>;
  skillMessages: Record<string, SkillMessage>;
  skillsBusyKey: string | null;
  debugLoading: boolean;
  debugStatus: StatusSummary | null;
  debugHealth: HealthSnapshot | null;
  debugModels: unknown[];
  debugHeartbeat: unknown;
  debugCallMethod: string;
  debugCallParams: string;
  debugCallResult: string | null;
  debugCallError: string | null;
  tedLoading: boolean;
  tedSnapshot: TedWorkbenchSnapshot | null;
  tedError: string | null;
  tedRoleCardJson: string;
  tedRoleCardBusy: boolean;
  tedRoleCardResult: string | null;
  tedRoleCardError: string | null;
  tedProofBusyKey: string | null;
  tedProofResult: string | null;
  tedProofError: string | null;
  tedJobCardDetailLoading: boolean;
  tedJobCardDetail: TedJobCardDetail | null;
  tedJobCardDetailError: string | null;
  tedJobCardEditorMarkdown: string;
  tedJobCardSaveBusy: boolean;
  tedJobCardSaveError: string | null;
  tedJobCardSaveResult: string | null;
  tedJobCardPreviewBusy: boolean;
  tedJobCardPreviewError: string | null;
  tedJobCardPreview: TedJobCardImpactPreview | null;
  tedJobCardKpiSuggestBusy: boolean;
  tedJobCardKpiSuggestError: string | null;
  tedJobCardKpiSuggestion: TedKpiSuggestion | null;
  tedRecommendationBusyId: string | null;
  tedRecommendationError: string | null;
  tedIntakeTitle: string;
  tedIntakeOutcome: string;
  tedIntakeJobFamily: string;
  tedIntakeRiskLevel: string;
  tedIntakeAutomationLevel: string;
  tedIntakeBusy: boolean;
  tedIntakeError: string | null;
  tedIntakeRecommendation: TedIntakeRecommendation | null;
  tedIntakeSaveBusy: boolean;
  tedIntakeSaveError: string | null;
  tedIntakeSaveResult: Record<string, unknown> | null;
  saveTedIntakeJobCard: () => Promise<void>;
  tedThresholdManual: string;
  tedThresholdApprovalAge: string;
  tedThresholdTriageEod: string;
  tedThresholdBlockedExplainability: string;
  tedThresholdAcknowledgeRisk: boolean;
  tedThresholdBusy: boolean;
  tedThresholdError: string | null;
  tedThresholdResult: string | null;
  tedSourceDocLoading: boolean;
  tedSourceDocError: string | null;
  tedSourceDoc: TedSourceDocument | null;
  tedPolicyLoading: boolean;
  tedPolicyError: string | null;
  tedPolicyDoc: TedPolicyDocument | null;
  tedPolicyPreviewBusy: boolean;
  tedPolicyPreviewError: string | null;
  tedPolicyPreview: TedPolicyImpactPreview | null;
  tedPolicySaveBusy: boolean;
  tedPolicySaveError: string | null;
  tedPolicySaveResult: string | null;
  tedConnectorAuthBusyProfile: string | null;
  tedConnectorAuthError: string | null;
  tedConnectorAuthResult: string | null;
  tedConnectorDeviceCodeByProfile: Record<string, string>;
  tedMailLoading: boolean;
  tedMailMessages: import("./types.js").TedMailMessage[];
  tedMailError: string | null;
  tedMailFolder: string;
  tedMorningBriefLoading: boolean;
  tedMorningBrief: import("./types.js").TedMorningBriefResponse | null;
  tedMorningBriefError: string | null;
  tedEodDigestLoading: boolean;
  tedEodDigest: import("./types.js").TedEodDigestResponse | null;
  tedEodDigestError: string | null;
  tedDealListLoading: boolean;
  tedDealList: TedDealSummary[];
  tedDealListError: string | null;
  tedDealDetailLoading: boolean;
  tedDealDetail: TedDealFull | null;
  tedDealDetailError: string | null;
  tedDealActionBusy: boolean;
  tedDealActionError: string | null;
  tedDealActionResult: string | null;
  tedLlmProviderConfig: TedLlmProviderConfig | null;
  tedLlmProviderLoading: boolean;
  tedLlmProviderError: string | null;
  // Phase 6: Meetings + Commitments + GTD
  tedMeetingsUpcoming: TedMeetingUpcomingResponse | null;
  tedMeetingsLoading: boolean;
  tedMeetingsError: string | null;
  tedCommitments: TedCommitmentsListResponse | null;
  tedCommitmentsLoading: boolean;
  tedCommitmentsError: string | null;
  tedActions: TedActionsListResponse | null;
  tedActionsLoading: boolean;
  tedActionsError: string | null;
  tedWaitingFor: TedWaitingForListResponse | null;
  tedWaitingForLoading: boolean;
  tedWaitingForError: string | null;
  // Phase 8: Trust + Deep Work
  tedTrustMetrics: TedTrustMetricsResponse | null;
  tedTrustMetricsLoading: boolean;
  tedTrustMetricsError: string | null;
  tedDeepWorkMetrics: TedDeepWorkMetricsResponse | null;
  tedDeepWorkMetricsLoading: boolean;
  tedDeepWorkMetricsError: string | null;
  // Draft Queue (JC-089f)
  tedDraftQueue: TedDraftQueueResponse | null;
  tedDraftQueueLoading: boolean;
  tedDraftQueueError: string | null;
  // Event Log Stats (JC-087e)
  tedEventLogStats: TedEventLogStatsResponse | null;
  tedEventLogStatsLoading: boolean;
  tedEventLogStatsError: string | null;
  // Planner
  tedPlannerPlans: TedPlannerListResponse | null;
  tedPlannerPlansLoading: boolean;
  tedPlannerPlansError: string | null;
  tedPlannerTasks: TedPlannerTasksResponse | null;
  tedPlannerTasksLoading: boolean;
  tedPlannerTasksError: string | null;
  // To Do
  tedTodoLists: TedTodoListsResponse | null;
  tedTodoListsLoading: boolean;
  tedTodoListsError: string | null;
  tedTodoTasks: TedTodoTasksResponse | null;
  tedTodoTasksLoading: boolean;
  tedTodoTasksError: string | null;
  // Sync
  tedSyncReconciliation: TedSyncReconciliationResponse | null;
  tedSyncReconciliationLoading: boolean;
  tedSyncReconciliationError: string | null;
  tedSyncProposals: TedSyncProposalsResponse | null;
  tedSyncProposalsLoading: boolean;
  tedSyncProposalsError: string | null;
  tedSyncApproveBusy: string | null;
  tedSyncApproveError: string | null;
  tedSyncApproveResult: string | null;
  tedSyncRejectBusy: string | null;
  tedSyncRejectError: string | null;
  tedSyncRejectResult: string | null;
  // Extraction
  tedExtractionResult: TedCommitmentExtractionResponse | null;
  tedExtractionLoading: boolean;
  tedExtractionError: string | null;
  // Improvement Proposals
  tedImprovementProposals: TedImprovementProposal[];
  tedImprovementProposalsLoading: boolean;
  tedImprovementProposalsError: string | null;
  tedImprovementCreateBusy: boolean;
  tedImprovementCreateError: string | null;
  tedImprovementCreateResult: string | null;
  tedImprovementReviewBusy: boolean;
  tedImprovementReviewError: string | null;
  tedImprovementReviewResult: string | null;
  tedImprovementApplyBusy: boolean;
  tedImprovementApplyError: string | null;
  tedImprovementApplyResult: string | null;
  tedImprovementGenerateBusy: boolean;
  tedImprovementGenerateError: string | null;
  tedImprovementGenerateResult: import("./types.ts").TedImprovementGenerateResponse | null;
  onLoadImprovementProposals: (status?: string) => void;
  onCreateImprovementProposal: (params: {
    title: string;
    type: string;
    description: string;
  }) => void;
  onReviewImprovementProposal: (proposalId: string, verdict: string, notes?: string) => void;
  onApplyImprovementProposal: (proposalId: string) => void;
  onGenerateImprovementProposal: (days?: number) => void;
  // Trust Autonomy
  tedTrustAutonomy: TedTrustAutonomyEvaluation | null;
  tedTrustAutonomyLoading: boolean;
  tedTrustAutonomyError: string | null;
  onLoadTrustAutonomy: () => void;
  // Failure Aggregation
  tedFailureAggregation: TedFailureAggregationResponse | null;
  tedFailureAggregationLoading: boolean;
  tedFailureAggregationError: string | null;
  onLoadFailureAggregation: (days?: number) => void;
  // Builder Lane (BL-010)
  tedBuilderLanePatterns: Record<string, unknown> | null;
  tedBuilderLanePatternsLoading: boolean;
  tedBuilderLanePatternsError: string | null;
  tedBuilderLaneStatus: Record<string, unknown> | null;
  tedBuilderLaneStatusLoading: boolean;
  tedBuilderLaneMetrics: Record<string, unknown> | null;
  tedBuilderLaneMetricsLoading: boolean;
  tedBuilderLaneRevertBusy: boolean;
  tedBuilderLaneRevertError: string | null;
  tedBuilderLaneRevertResult: string | null;
  tedBuilderLaneGenerateBusy: boolean;
  tedBuilderLaneCalibrationBusy: boolean;
  onLoadBuilderLanePatterns: () => void;
  onLoadBuilderLaneStatus: () => void;
  onLoadBuilderLaneMetrics: () => void;
  onGenerateFromPattern: (domain: string, contextBucket?: Record<string, unknown>) => void;
  onRevertAppliedProposal: (proposalId: string) => void;
  onSubmitCalibrationResponse: (
    promptId: string,
    response: string,
    domain?: string,
    moment?: string,
  ) => void;
  // JC-110: Architecture closure
  tedDraftSubmitReviewLoading: boolean;
  tedDraftSubmitReviewError: string | null;
  tedDeepWorkSessionLoading: boolean;
  tedDeepWorkSessionError: string | null;
  tedDeepWorkSessionResult: Record<string, unknown> | null;
  tedGraphSyncStatusLoading: boolean;
  tedGraphSyncStatusError: string | null;
  tedGraphSyncStatusResult: Record<string, unknown> | null;
  onTedDraftSubmitReview: (draftId: string) => void;
  onTedDeepWorkSession: (durationMinutes: number, label?: string, entity?: string) => void;
  onTedGraphSyncStatus: (profileId: string) => void;
  // Inline form state for deep work session input
  showDeepWorkInput: boolean;
  deepWorkInputMinutes: string;
  deepWorkInputLabel: string;
  // Inline form state for graph sync profile input
  showGraphSyncInput: boolean;
  graphSyncInputProfileId: string;
  // Ingestion
  tedIngestionStatusLoading: boolean;
  tedIngestionStatusError: string | null;
  tedIngestionStatus: Record<string, unknown> | null;
  tedIngestionRunBusy: boolean;
  tedIngestionRunError: string | null;
  tedIngestionRunResult: Record<string, unknown> | null;
  // Discovery
  tedDiscoveryStatusLoading: boolean;
  tedDiscoveryStatusError: string | null;
  tedDiscoveryStatus: Record<string, unknown> | null;
  tedDiscoveryRunBusy: boolean;
  tedDiscoveryRunError: string | null;
  tedDiscoveryRunResult: Record<string, unknown> | null;
  loadTedIngestionStatus: () => Promise<void>;
  triggerTedIngestion: () => Promise<void>;
  loadTedDiscoveryStatus: () => Promise<void>;
  triggerTedDiscovery: (profileId: string) => Promise<void>;
  // Self-Healing Dashboard
  fetchSelfHealingStatus: () => Promise<void>;
  fetchCorrectionTaxonomy: () => Promise<void>;
  fetchEngagementInsights: () => Promise<void>;
  fetchNoiseLevel: () => Promise<void>;
  fetchAutonomyStatus: () => Promise<void>;
  // Sprint 2 (SDD 72): Evaluation Pipeline
  tedEvaluationStatus: Record<string, unknown> | null;
  tedEvaluationStatusLoading: boolean;
  tedEvaluationStatusError: string | null;
  tedEvaluationRunBusy: boolean;
  tedEvaluationRunError: string | null;
  tedEvaluationRunResult: Record<string, unknown> | null;
  loadTedEvaluationStatus: () => Promise<void>;
  triggerTedEvaluationRun: () => Promise<void>;
  tedQaDashboard: Record<string, unknown> | null;
  tedQaDashboardLoading: boolean;
  tedQaDashboardError: string | null;
  tedCanaryRunBusy: boolean;
  tedCanaryRunError: string | null;
  tedCanaryRunResult: Record<string, unknown> | null;
  loadTedQaDashboard: () => Promise<void>;
  triggerTedCanaryRun: () => Promise<void>;
  // SharePoint state
  tedSharePointSites: Array<{
    id: string;
    displayName: string;
    webUrl: string;
    name: string;
  }> | null;
  tedSharePointSitesLoading: boolean;
  tedSharePointSitesError: string | null;
  tedSharePointDrives: Array<{
    id: string;
    name: string;
    driveType: string;
    webUrl: string;
    description: string | null;
  }> | null;
  tedSharePointDrivesLoading: boolean;
  tedSharePointDrivesError: string | null;
  tedSharePointItems: Array<{
    id: string;
    name: string;
    size: number;
    lastModifiedDateTime: string;
    webUrl: string;
    isFolder: boolean;
    mimeType: string | null;
    createdBy: string | null;
    lastModifiedBy: string | null;
    parentPath: string | null;
  }> | null;
  tedSharePointItemsLoading: boolean;
  tedSharePointItemsError: string | null;
  tedSharePointItemsPath: string;
  tedSharePointSearchResults: Array<{
    id: string;
    name: string;
    size: number;
    lastModifiedDateTime: string;
    webUrl: string;
    isFolder: boolean;
    mimeType: string | null;
    createdBy: string | null;
    lastModifiedBy: string | null;
    parentPath: string | null;
  }> | null;
  tedSharePointSearchLoading: boolean;
  tedSharePointSearchError: string | null;
  tedSharePointUploadResult: string | null;
  tedSharePointUploadLoading: boolean;
  tedSharePointUploadError: string | null;
  tedSharePointFolderResult: string | null;
  tedSharePointFolderLoading: boolean;
  tedSharePointFolderError: string | null;
  tedSharePointSelectedProfile: string;
  tedSharePointSelectedSiteId: string;
  tedSharePointSelectedDriveId: string;
  tedSharePointSearchQuery: string;
  // C12-004: Stale deal owners
  tedStaleDealsList: import("./types.ts").TedStaleDeal[];
  tedStaleDealsLoading: boolean;
  tedStaleDealsError: string | null;
  // C12-011: Deal retrospective
  tedDealRetrospective: import("./types.ts").TedDealRetrospective | null;
  tedDealRetrospectiveLoading: boolean;
  tedDealRetrospectiveError: string | null;
  tedActiveSection: "all" | "operate" | "build" | "govern" | "intake" | "evals";
  // Self-Healing Dashboard
  selfHealingStatus: Record<string, unknown> | null;
  selfHealingStatusLoading: boolean;
  selfHealingStatusError: string | null;
  correctionTaxonomy: Record<string, unknown> | null;
  correctionTaxonomyLoading: boolean;
  correctionTaxonomyError: string | null;
  engagementInsights: Record<string, unknown> | null;
  engagementInsightsLoading: boolean;
  engagementInsightsError: string | null;
  noiseLevel: Record<string, unknown> | null;
  noiseLevelLoading: boolean;
  noiseLevelError: string | null;
  autonomyStatus: Record<string, unknown> | null;
  autonomyStatusLoading: boolean;
  autonomyStatusError: string | null;
  logsLoading: boolean;
  logsError: string | null;
  logsFile: string | null;
  logsEntries: LogEntry[];
  logsFilterText: string;
  logsLevelFilters: Record<LogLevel, boolean>;
  logsAutoFollow: boolean;
  logsTruncated: boolean;
  logsCursor: number | null;
  logsLastFetchAt: number | null;
  logsLimit: number;
  logsMaxBytes: number;
  logsAtBottom: boolean;
  client: GatewayBrowserClient | null;
  refreshSessionsAfterChat: Set<string>;
  connect: () => void;
  setTab: (tab: Tab) => void;
  setTheme: (theme: ThemeMode, context?: ThemeTransitionContext) => void;
  applySettings: (next: UiSettings) => void;
  loadOverview: () => Promise<void>;
  loadAssistantIdentity: () => Promise<void>;
  loadCron: () => Promise<void>;
  loadTedWorkbench: () => Promise<void>;
  validateTedRoleCard: () => Promise<void>;
  runTedProof: (proofScript: string) => Promise<void>;
  loadTedJobCardDetail: (id: string) => Promise<void>;
  saveTedJobCardDetail: () => Promise<void>;
  previewTedJobCardUpdate: () => Promise<void>;
  suggestTedJobCardKpis: () => Promise<void>;
  decideTedRecommendation: (id: string, decision: "approved" | "dismissed") => Promise<void>;
  runTedIntakeRecommendation: () => Promise<void>;
  applyTedThresholds: (reset?: boolean) => Promise<void>;
  loadTedSourceDocument: (
    key: "job_board" | "promotion_policy" | "value_friction" | "interrogation_cycle",
  ) => Promise<void>;
  loadTedPolicyDocument: (key: TedPolicyKey) => Promise<void>;
  previewTedPolicyUpdate: () => Promise<void>;
  saveTedPolicyUpdate: () => Promise<void>;
  startTedConnectorAuth: (profileId: "olumie" | "everest") => Promise<void>;
  pollTedConnectorAuth: (profileId: "olumie" | "everest") => Promise<void>;
  revokeTedConnectorAuth: (profileId: "olumie" | "everest") => Promise<void>;
  loadTedMail: (profileId?: string, folder?: string) => Promise<void>;
  loadTedMorningBrief: () => Promise<void>;
  loadTedEodDigest: () => Promise<void>;
  loadTedDealList: () => Promise<void>;
  loadTedDealDetail: (dealId: string) => Promise<void>;
  updateTedDeal: (dealId: string, fields: Record<string, unknown>) => Promise<void>;
  loadTedStaleDeals: (days?: number) => Promise<void>;
  generateTedDealRetrospective: (dealId: string) => Promise<void>;
  loadTedSharePointSites: () => Promise<void>;
  loadTedSharePointDrives: () => Promise<void>;
  loadTedSharePointItems: (itemId?: string) => Promise<void>;
  searchTedSharePoint: () => Promise<void>;
  uploadTedSharePointFile: (
    fileName: string,
    contentBase64: string,
    contentType: string,
  ) => Promise<void>;
  createTedSharePointFolder: (folderName: string) => Promise<void>;
  loadTedLlmProvider: () => Promise<void>;
  updateTedLlmProvider: (
    newDefault: import("./types.js").LlmProviderName,
    perJobOverrides?: Record<string, { provider: import("./types.js").LlmProviderName }>,
  ) => Promise<void>;
  loadTedMeetingsUpcoming: () => Promise<void>;
  loadTedCommitments: () => Promise<void>;
  loadTedActions: () => Promise<void>;
  loadTedWaitingFor: () => Promise<void>;
  loadTedTrustMetrics: () => Promise<void>;
  loadTedDeepWorkMetrics: () => Promise<void>;
  loadTedDraftQueue: () => Promise<void>;
  loadTedEventLogStats: () => Promise<void>;
  loadTedPlannerPlans: (profileId?: string) => Promise<void>;
  loadTedPlannerTasks: (profileId: string, planId: string, bucketId?: string) => Promise<void>;
  loadTedTodoLists: (profileId?: string) => Promise<void>;
  loadTedTodoTasks: (profileId: string, listId: string) => Promise<void>;
  loadTedSyncReconciliation: (profileId?: string) => Promise<void>;
  loadTedSyncProposals: (profileId?: string) => Promise<void>;
  approveTedSyncProposal: (profileId: string, proposalId: string) => Promise<void>;
  rejectTedSyncProposal: (profileId: string, proposalId: string) => Promise<void>;
  extractTedCommitments: (profileId: string, messageId: string) => Promise<void>;
  handleWhatsAppStart: (force: boolean) => Promise<void>;
  handleWhatsAppWait: () => Promise<void>;
  handleWhatsAppLogout: () => Promise<void>;
  handleChannelConfigSave: () => Promise<void>;
  handleChannelConfigReload: () => Promise<void>;
  handleNostrProfileEdit: (accountId: string, profile: NostrProfile | null) => void;
  handleNostrProfileCancel: () => void;
  handleNostrProfileFieldChange: (field: keyof NostrProfile, value: string) => void;
  handleNostrProfileSave: () => Promise<void>;
  handleNostrProfileImport: () => Promise<void>;
  handleNostrProfileToggleAdvanced: () => void;
  handleExecApprovalDecision: (decision: "allow-once" | "allow-always" | "deny") => Promise<void>;
  handleGatewayUrlConfirm: () => void;
  handleGatewayUrlCancel: () => void;
  handleConfigLoad: () => Promise<void>;
  handleConfigSave: () => Promise<void>;
  handleConfigApply: () => Promise<void>;
  handleConfigFormUpdate: (path: string, value: unknown) => void;
  handleConfigFormModeChange: (mode: "form" | "raw") => void;
  handleConfigRawChange: (raw: string) => void;
  handleInstallSkill: (key: string) => Promise<void>;
  handleUpdateSkill: (key: string) => Promise<void>;
  handleToggleSkillEnabled: (key: string, enabled: boolean) => Promise<void>;
  handleUpdateSkillEdit: (key: string, value: string) => void;
  handleSaveSkillApiKey: (key: string, apiKey: string) => Promise<void>;
  handleCronToggle: (jobId: string, enabled: boolean) => Promise<void>;
  handleCronRun: (jobId: string) => Promise<void>;
  handleCronRemove: (jobId: string) => Promise<void>;
  handleCronAdd: () => Promise<void>;
  handleCronRunsLoad: (jobId: string) => Promise<void>;
  handleCronFormUpdate: (path: string, value: unknown) => void;
  handleSessionsLoad: () => Promise<void>;
  handleSessionsPatch: (key: string, patch: unknown) => Promise<void>;
  handleLoadNodes: () => Promise<void>;
  handleLoadPresence: () => Promise<void>;
  handleLoadSkills: () => Promise<void>;
  handleLoadDebug: () => Promise<void>;
  handleLoadLogs: () => Promise<void>;
  handleDebugCall: () => Promise<void>;
  handleRunUpdate: () => Promise<void>;
  setPassword: (next: string) => void;
  setSessionKey: (next: string) => void;
  setChatMessage: (next: string) => void;
  handleSendChat: (messageOverride?: string, opts?: { restoreDraft?: boolean }) => Promise<void>;
  handleAbortChat: () => Promise<void>;
  removeQueuedMessage: (id: string) => void;
  handleChatScroll: (event: Event) => void;
  resetToolStream: () => void;
  resetChatScroll: () => void;
  exportLogs: (lines: string[], label: string) => void;
  handleLogsScroll: (event: Event) => void;
  handleOpenSidebar: (content: string) => void;
  handleCloseSidebar: () => void;
  handleSplitRatioChange: (ratio: number) => void;
};
