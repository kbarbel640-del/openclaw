import { LitElement } from "lit";
import { customElement, state } from "lit/decorators.js";
import { i18n, I18nController, isSupportedLocale } from "../i18n/index.ts";
import {
  handleChannelConfigReload as handleChannelConfigReloadInternal,
  handleChannelConfigSave as handleChannelConfigSaveInternal,
  handleNostrProfileCancel as handleNostrProfileCancelInternal,
  handleNostrProfileEdit as handleNostrProfileEditInternal,
  handleNostrProfileFieldChange as handleNostrProfileFieldChangeInternal,
  handleNostrProfileImport as handleNostrProfileImportInternal,
  handleNostrProfileSave as handleNostrProfileSaveInternal,
  handleNostrProfileToggleAdvanced as handleNostrProfileToggleAdvancedInternal,
  handleWhatsAppLogout as handleWhatsAppLogoutInternal,
  handleWhatsAppStart as handleWhatsAppStartInternal,
  handleWhatsAppWait as handleWhatsAppWaitInternal,
} from "./app-channels.ts";
import {
  handleAbortChat as handleAbortChatInternal,
  handleSendChat as handleSendChatInternal,
  removeQueuedMessage as removeQueuedMessageInternal,
} from "./app-chat.ts";
import { DEFAULT_CRON_FORM, DEFAULT_LOG_LEVEL_FILTERS } from "./app-defaults.ts";
import type { EventLogEntry } from "./app-events.ts";
import { connectGateway as connectGatewayInternal } from "./app-gateway.ts";
import {
  handleConnected,
  handleDisconnected,
  handleFirstUpdated,
  handleUpdated,
} from "./app-lifecycle.ts";
import { renderApp } from "./app-render.ts";
import {
  exportLogs as exportLogsInternal,
  handleChatScroll as handleChatScrollInternal,
  handleLogsScroll as handleLogsScrollInternal,
  resetChatScroll as resetChatScrollInternal,
  scheduleChatScroll as scheduleChatScrollInternal,
} from "./app-scroll.ts";
import {
  applySettings as applySettingsInternal,
  loadCron as loadCronInternal,
  loadOverview as loadOverviewInternal,
  setTab as setTabInternal,
  setTheme as setThemeInternal,
  onPopState as onPopStateInternal,
} from "./app-settings.ts";
import {
  resetToolStream as resetToolStreamInternal,
  type ToolStreamEntry,
  type CompactionStatus,
} from "./app-tool-stream.ts";
import type { AppViewState } from "./app-view-state.ts";
import { normalizeAssistantIdentity } from "./assistant-identity.ts";
import { loadAssistantIdentity as loadAssistantIdentityInternal } from "./controllers/assistant-identity.ts";
import type { DevicePairingList } from "./controllers/devices.ts";
import type { ExecApprovalRequest } from "./controllers/exec-approval.ts";
import type { ExecApprovalsFile, ExecApprovalsSnapshot } from "./controllers/exec-approvals.ts";
import type { SkillMessage } from "./controllers/skills.ts";
import {
  applyTedThresholds,
  decideTedRecommendation,
  loadTedDealDetail,
  loadTedDealList,
  loadTedEodDigest,
  loadTedLlmProvider,
  loadTedMail,
  loadTedMorningBrief,
  loadTedMeetingsUpcoming,
  loadTedCommitments,
  loadTedActions,
  loadTedWaitingFor,
  loadTedTrustMetrics,
  loadTedDeepWorkMetrics,
  loadTedDraftQueue,
  loadTedEventLogStats,
  loadTedPlannerPlans,
  loadTedPlannerTasks,
  loadTedTodoLists,
  loadTedTodoTasks,
  loadTedSyncReconciliation,
  loadTedSyncProposals,
  approveTedSyncProposal,
  rejectTedSyncProposal,
  extractTedCommitments,
  loadTedImprovementProposals,
  createTedImprovementProposal,
  reviewTedImprovementProposal,
  applyTedImprovementProposal,
  generateTedImprovementProposal,
  loadTedTrustAutonomy,
  loadTedFailureAggregation,
  submitTedDraftForReviewById,
  recordTedDeepWorkSession,
  loadTedGraphSyncStatus,
  loadTedIngestionStatus,
  triggerTedIngestion,
  loadTedDiscoveryStatus,
  triggerTedDiscovery,
  loadTedPolicyDocument,
  loadTedSourceDocument,
  loadTedJobCardDetail,
  loadTedWorkbench,
  updateTedDeal,
  updateTedLlmProvider,
  pollTedConnectorAuth,
  previewTedPolicyUpdate,
  previewTedJobCardUpdate,
  revokeTedConnectorAuth,
  runTedIntakeRecommendation,
  saveTedIntakeJobCard,
  runTedProof,
  saveTedPolicyUpdate,
  saveTedJobCardDetail,
  startTedConnectorAuth,
  suggestTedJobCardKpis,
  validateTedRoleCard,
  loadBuilderLanePatterns,
  loadBuilderLaneStatus,
  loadBuilderLaneMetrics,
  generateFromPattern,
  revertAppliedProposal,
  submitCalibrationResponse,
  fetchSelfHealingStatus,
  fetchCorrectionTaxonomy,
  fetchEngagementInsights,
  fetchNoiseLevel,
  fetchAutonomyStatus,
  loadTedEvaluationStatus,
  triggerTedEvaluationRun,
  loadTedQaDashboard,
  triggerTedCanaryRun,
  loadTedStaleDeals,
  generateTedDealRetrospective,
  loadTedSharePointSites,
  loadTedSharePointDrives,
  loadTedSharePointItems,
  searchTedSharePoint,
  uploadTedSharePointFile,
  createTedSharePointFolder,
} from "./controllers/ted.ts";
import type { GatewayBrowserClient, GatewayHelloOk } from "./gateway.ts";
import type { Tab } from "./navigation.ts";
import { loadSettings, type UiSettings } from "./storage.ts";
import type { ResolvedTheme, ThemeMode } from "./theme.ts";
import type {
  AgentsListResult,
  AgentsFilesListResult,
  AgentIdentityResult,
  ConfigSnapshot,
  ConfigUiHints,
  CronJob,
  CronRunLogEntry,
  CronStatus,
  HealthSnapshot,
  LogEntry,
  LogLevel,
  PresenceEntry,
  ChannelsStatusSnapshot,
  SessionsListResult,
  TedWorkbenchSnapshot,
  TedIntakeRecommendation,
  TedDealFull,
  TedDealSummary,
  TedJobCardDetail,
  TedImprovementProposal,
  TedTrustAutonomyEvaluation,
  TedFailureAggregationResponse,
  SkillStatusReport,
  StatusSummary,
  NostrProfile,
} from "./types.ts";
import { type ChatAttachment, type ChatQueueItem, type CronFormState } from "./ui-types.ts";
import type { NostrProfileFormState } from "./views/channels.nostr-profile-form.ts";

declare global {
  interface Window {
    __OPENCLAW_CONTROL_UI_BASE_PATH__?: string;
  }
}

const bootAssistantIdentity = normalizeAssistantIdentity({});

function resolveOnboardingMode(): boolean {
  if (!window.location.search) {
    return false;
  }
  const params = new URLSearchParams(window.location.search);
  const raw = params.get("onboarding");
  if (!raw) {
    return false;
  }
  const normalized = raw.trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes" || normalized === "on";
}

@customElement("openclaw-app")
export class OpenClawApp extends LitElement {
  private i18nController = new I18nController(this);
  @state() settings: UiSettings = loadSettings();
  constructor() {
    super();
    if (isSupportedLocale(this.settings.locale)) {
      void i18n.setLocale(this.settings.locale);
    }
  }
  @state() password = "";
  @state() tab: Tab = "chat";
  @state() onboarding = resolveOnboardingMode();
  @state() connected = false;
  @state() theme: ThemeMode = this.settings.theme ?? "system";
  @state() themeResolved: ResolvedTheme = "dark";
  @state() hello: GatewayHelloOk | null = null;
  @state() lastError: string | null = null;
  @state() eventLog: EventLogEntry[] = [];
  private eventLogBuffer: EventLogEntry[] = [];
  private toolStreamSyncTimer: number | null = null;
  private sidebarCloseTimer: number | null = null;

  @state() assistantName = bootAssistantIdentity.name;
  @state() assistantAvatar = bootAssistantIdentity.avatar;
  @state() assistantAgentId = bootAssistantIdentity.agentId ?? null;

  @state() sessionKey = this.settings.sessionKey;
  @state() chatLoading = false;
  @state() chatSending = false;
  @state() chatMessage = "";
  @state() chatMessages: unknown[] = [];
  @state() chatToolMessages: unknown[] = [];
  @state() chatStream: string | null = null;
  @state() chatStreamStartedAt: number | null = null;
  @state() chatRunId: string | null = null;
  @state() compactionStatus: CompactionStatus | null = null;
  @state() chatAvatarUrl: string | null = null;
  @state() chatThinkingLevel: string | null = null;
  @state() chatQueue: ChatQueueItem[] = [];
  @state() chatAttachments: ChatAttachment[] = [];
  @state() chatManualRefreshInFlight = false;
  // Sidebar state for tool output viewing
  @state() sidebarOpen = false;
  @state() sidebarContent: string | null = null;
  @state() sidebarError: string | null = null;
  @state() splitRatio = this.settings.splitRatio;

  @state() nodesLoading = false;
  @state() nodes: Array<Record<string, unknown>> = [];
  @state() devicesLoading = false;
  @state() devicesError: string | null = null;
  @state() devicesList: DevicePairingList | null = null;
  @state() execApprovalsLoading = false;
  @state() execApprovalsSaving = false;
  @state() execApprovalsDirty = false;
  @state() execApprovalsSnapshot: ExecApprovalsSnapshot | null = null;
  @state() execApprovalsForm: ExecApprovalsFile | null = null;
  @state() execApprovalsSelectedAgent: string | null = null;
  @state() execApprovalsTarget: "gateway" | "node" = "gateway";
  @state() execApprovalsTargetNodeId: string | null = null;
  @state() execApprovalQueue: ExecApprovalRequest[] = [];
  @state() execApprovalBusy = false;
  @state() execApprovalError: string | null = null;
  @state() pendingGatewayUrl: string | null = null;

  @state() configLoading = false;
  @state() configRaw = "{\n}\n";
  @state() configRawOriginal = "";
  @state() configValid: boolean | null = null;
  @state() configIssues: unknown[] = [];
  @state() configSaving = false;
  @state() configApplying = false;
  @state() updateRunning = false;
  @state() applySessionKey = this.settings.lastActiveSessionKey;
  @state() configSnapshot: ConfigSnapshot | null = null;
  @state() configSchema: unknown = null;
  @state() configSchemaVersion: string | null = null;
  @state() configSchemaLoading = false;
  @state() configUiHints: ConfigUiHints = {};
  @state() configForm: Record<string, unknown> | null = null;
  @state() configFormOriginal: Record<string, unknown> | null = null;
  @state() configFormDirty = false;
  @state() configFormMode: "form" | "raw" = "form";
  @state() configSearchQuery = "";
  @state() configActiveSection: string | null = null;
  @state() configActiveSubsection: string | null = null;

  @state() channelsLoading = false;
  @state() channelsSnapshot: ChannelsStatusSnapshot | null = null;
  @state() channelsError: string | null = null;
  @state() channelsLastSuccess: number | null = null;
  @state() whatsappLoginMessage: string | null = null;
  @state() whatsappLoginQrDataUrl: string | null = null;
  @state() whatsappLoginConnected: boolean | null = null;
  @state() whatsappBusy = false;
  @state() nostrProfileFormState: NostrProfileFormState | null = null;
  @state() nostrProfileAccountId: string | null = null;

  @state() presenceLoading = false;
  @state() presenceEntries: PresenceEntry[] = [];
  @state() presenceError: string | null = null;
  @state() presenceStatus: string | null = null;

  @state() agentsLoading = false;
  @state() agentsList: AgentsListResult | null = null;
  @state() agentsError: string | null = null;
  @state() agentsSelectedId: string | null = null;
  @state() agentsPanel: "overview" | "files" | "tools" | "skills" | "channels" | "cron" =
    "overview";
  @state() agentFilesLoading = false;
  @state() agentFilesError: string | null = null;
  @state() agentFilesList: AgentsFilesListResult | null = null;
  @state() agentFileContents: Record<string, string> = {};
  @state() agentFileDrafts: Record<string, string> = {};
  @state() agentFileActive: string | null = null;
  @state() agentFileSaving = false;
  @state() agentIdentityLoading = false;
  @state() agentIdentityError: string | null = null;
  @state() agentIdentityById: Record<string, AgentIdentityResult> = {};
  @state() agentSkillsLoading = false;
  @state() agentSkillsError: string | null = null;
  @state() agentSkillsReport: SkillStatusReport | null = null;
  @state() agentSkillsAgentId: string | null = null;

  @state() sessionsLoading = false;
  @state() sessionsResult: SessionsListResult | null = null;
  @state() sessionsError: string | null = null;
  @state() sessionsFilterActive = "";
  @state() sessionsFilterLimit = "120";
  @state() sessionsIncludeGlobal = true;
  @state() sessionsIncludeUnknown = false;

  @state() usageLoading = false;
  @state() usageResult: import("./types.js").SessionsUsageResult | null = null;
  @state() usageCostSummary: import("./types.js").CostUsageSummary | null = null;
  @state() usageError: string | null = null;
  @state() usageStartDate = (() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  })();
  @state() usageEndDate = (() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  })();
  @state() usageSelectedSessions: string[] = [];
  @state() usageSelectedDays: string[] = [];
  @state() usageSelectedHours: number[] = [];
  @state() usageChartMode: "tokens" | "cost" = "tokens";
  @state() usageDailyChartMode: "total" | "by-type" = "by-type";
  @state() usageTimeSeriesMode: "cumulative" | "per-turn" = "per-turn";
  @state() usageTimeSeriesBreakdownMode: "total" | "by-type" = "by-type";
  @state() usageTimeSeries: import("./types.js").SessionUsageTimeSeries | null = null;
  @state() usageTimeSeriesLoading = false;
  @state() usageTimeSeriesCursorStart: number | null = null;
  @state() usageTimeSeriesCursorEnd: number | null = null;
  @state() usageSessionLogs: import("./views/usage.js").SessionLogEntry[] | null = null;
  @state() usageSessionLogsLoading = false;
  @state() usageSessionLogsExpanded = false;
  // Applied query (used to filter the already-loaded sessions list client-side).
  @state() usageQuery = "";
  // Draft query text (updates immediately as the user types; applied via debounce or "Search").
  @state() usageQueryDraft = "";
  @state() usageSessionSort: "tokens" | "cost" | "recent" | "messages" | "errors" = "recent";
  @state() usageSessionSortDir: "desc" | "asc" = "desc";
  @state() usageRecentSessions: string[] = [];
  @state() usageTimeZone: "local" | "utc" = "local";
  @state() usageContextExpanded = false;
  @state() usageHeaderPinned = false;
  @state() usageSessionsTab: "all" | "recent" = "all";
  @state() usageVisibleColumns: string[] = [
    "channel",
    "agent",
    "provider",
    "model",
    "messages",
    "tools",
    "errors",
    "duration",
  ];
  @state() usageLogFilterRoles: import("./views/usage.js").SessionLogRole[] = [];
  @state() usageLogFilterTools: string[] = [];
  @state() usageLogFilterHasTools = false;
  @state() usageLogFilterQuery = "";

  // Non-reactive (don’t trigger renders just for timer bookkeeping).
  usageQueryDebounceTimer: number | null = null;

  @state() cronLoading = false;
  @state() cronJobs: CronJob[] = [];
  @state() cronStatus: CronStatus | null = null;
  @state() cronError: string | null = null;
  @state() cronForm: CronFormState = { ...DEFAULT_CRON_FORM };
  @state() cronRunsJobId: string | null = null;
  @state() cronRuns: CronRunLogEntry[] = [];
  @state() cronBusy = false;

  @state() skillsLoading = false;
  @state() skillsReport: SkillStatusReport | null = null;
  @state() skillsError: string | null = null;
  @state() skillsFilter = "";
  @state() skillEdits: Record<string, string> = {};
  @state() skillsBusyKey: string | null = null;
  @state() skillMessages: Record<string, SkillMessage> = {};

  @state() debugLoading = false;
  @state() debugStatus: StatusSummary | null = null;
  @state() debugHealth: HealthSnapshot | null = null;
  @state() debugModels: unknown[] = [];
  @state() debugHeartbeat: unknown = null;
  @state() debugCallMethod = "";
  @state() debugCallParams = "{}";
  @state() debugCallResult: string | null = null;
  @state() debugCallError: string | null = null;
  @state() tedLoading = false;
  @state() tedSnapshot: TedWorkbenchSnapshot | null = null;
  @state() tedError: string | null = null;
  @state() tedRoleCardJson =
    '{\n  "role_id": "sample-operator",\n  "domain": "Draft-only operator support",\n  "inputs": ["messages"],\n  "outputs": ["drafts"],\n  "definition_of_done": ["review-ready draft"],\n  "hard_bans": ["No direct send"],\n  "escalation": ["sensitive claims"]\n}';
  @state() tedRoleCardBusy = false;
  @state() tedRoleCardResult: string | null = null;
  @state() tedRoleCardError: string | null = null;
  @state() tedProofBusyKey: string | null = null;
  @state() tedProofResult: string | null = null;
  @state() tedProofError: string | null = null;
  @state() tedJobCardDetailLoading = false;
  @state() tedJobCardDetail: TedJobCardDetail | null = null;
  @state() tedJobCardDetailError: string | null = null;
  @state() tedJobCardEditorMarkdown = "";
  @state() tedJobCardSaveBusy = false;
  @state() tedJobCardSaveError: string | null = null;
  @state() tedJobCardSaveResult: string | null = null;
  @state() tedJobCardPreviewBusy = false;
  @state() tedJobCardPreviewError: string | null = null;
  @state() tedJobCardPreview: import("./types.js").TedJobCardImpactPreview | null = null;
  @state() tedJobCardKpiSuggestBusy = false;
  @state() tedJobCardKpiSuggestError: string | null = null;
  @state() tedJobCardKpiSuggestion: import("./types.js").TedKpiSuggestion | null = null;
  @state() tedRecommendationBusyId: string | null = null;
  @state() tedRecommendationError: string | null = null;
  @state() tedIntakeTitle = "";
  @state() tedIntakeOutcome = "";
  @state() tedIntakeJobFamily = "MNT";
  @state() tedIntakeRiskLevel = "medium";
  @state() tedIntakeAutomationLevel = "draft-only";
  @state() tedIntakeBusy = false;
  @state() tedIntakeError: string | null = null;
  @state() tedIntakeRecommendation: TedIntakeRecommendation | null = null;
  @state() tedIntakeSaveBusy = false;
  @state() tedIntakeSaveError: string | null = null;
  @state() tedIntakeSaveResult: Record<string, unknown> | null = null;
  @state() tedThresholdManual = "45";
  @state() tedThresholdApprovalAge = "120";
  @state() tedThresholdTriageEod = "12";
  @state() tedThresholdBlockedExplainability = "0";
  @state() tedThresholdAcknowledgeRisk = false;
  @state() tedThresholdBusy = false;
  @state() tedThresholdError: string | null = null;
  @state() tedThresholdResult: string | null = null;
  @state() tedSourceDocLoading = false;
  @state() tedSourceDocError: string | null = null;
  @state() tedSourceDoc: import("./types.js").TedSourceDocument | null = null;
  @state() tedPolicyLoading = false;
  @state() tedPolicyError: string | null = null;
  @state() tedPolicyDoc: import("./types.js").TedPolicyDocument | null = null;
  @state() tedPolicyPreviewBusy = false;
  @state() tedPolicyPreviewError: string | null = null;
  @state() tedPolicyPreview: import("./types.js").TedPolicyImpactPreview | null = null;
  @state() tedPolicySaveBusy = false;
  @state() tedPolicySaveError: string | null = null;
  @state() tedPolicySaveResult: string | null = null;
  @state() tedConnectorAuthBusyProfile: string | null = null;
  @state() tedConnectorAuthError: string | null = null;
  @state() tedConnectorAuthResult: string | null = null;
  @state() tedConnectorDeviceCodeByProfile: Record<string, string> = {};
  @state() tedMailLoading = false;
  @state() tedMailMessages: import("./types.js").TedMailMessage[] = [];
  @state() tedMailError: string | null = null;
  @state() tedMailFolder = "inbox";
  @state() tedMorningBriefLoading = false;
  @state() tedMorningBrief: import("./types.js").TedMorningBriefResponse | null = null;
  @state() tedMorningBriefError: string | null = null;
  @state() tedEodDigestLoading = false;
  @state() tedEodDigest: import("./types.js").TedEodDigestResponse | null = null;
  @state() tedEodDigestError: string | null = null;
  @state() tedDealListLoading = false;
  @state() tedDealList: TedDealSummary[] = [];
  @state() tedDealListError: string | null = null;
  @state() tedDealDetailLoading = false;
  @state() tedDealDetail: TedDealFull | null = null;
  @state() tedDealDetailError: string | null = null;
  @state() tedDealActionBusy = false;
  @state() tedDealActionError: string | null = null;
  @state() tedDealActionResult: string | null = null;
  @state() tedLlmProviderConfig: import("./types.ts").TedLlmProviderConfig | null = null;
  @state() tedLlmProviderLoading = false;
  @state() tedLlmProviderError: string | null = null;
  // Phase 6: Meetings + Commitments + GTD
  @state() tedMeetingsUpcoming: import("./types.ts").TedMeetingUpcomingResponse | null = null;
  @state() tedMeetingsLoading = false;
  @state() tedMeetingsError: string | null = null;
  @state() tedCommitments: import("./types.ts").TedCommitmentsListResponse | null = null;
  @state() tedCommitmentsLoading = false;
  @state() tedCommitmentsError: string | null = null;
  @state() tedActions: import("./types.ts").TedActionsListResponse | null = null;
  @state() tedActionsLoading = false;
  @state() tedActionsError: string | null = null;
  @state() tedWaitingFor: import("./types.ts").TedWaitingForListResponse | null = null;
  @state() tedWaitingForLoading = false;
  @state() tedWaitingForError: string | null = null;
  // Phase 8: Trust + Deep Work
  @state() tedTrustMetrics: import("./types.ts").TedTrustMetricsResponse | null = null;
  @state() tedTrustMetricsLoading = false;
  @state() tedTrustMetricsError: string | null = null;
  @state() tedDeepWorkMetrics: import("./types.ts").TedDeepWorkMetricsResponse | null = null;
  @state() tedDeepWorkMetricsLoading = false;
  @state() tedDeepWorkMetricsError: string | null = null;
  // Draft Queue (JC-089f)
  @state() tedDraftQueue: import("./types.ts").TedDraftQueueResponse | null = null;
  @state() tedDraftQueueLoading = false;
  @state() tedDraftQueueError: string | null = null;
  // Event Log Stats (JC-087e)
  @state() tedEventLogStats: import("./types.ts").TedEventLogStatsResponse | null = null;
  @state() tedEventLogStatsLoading = false;
  @state() tedEventLogStatsError: string | null = null;
  // Planner
  @state() tedPlannerPlans: import("./types.ts").TedPlannerListResponse | null = null;
  @state() tedPlannerPlansLoading = false;
  @state() tedPlannerPlansError: string | null = null;
  @state() tedPlannerTasks: import("./types.ts").TedPlannerTasksResponse | null = null;
  @state() tedPlannerTasksLoading = false;
  @state() tedPlannerTasksError: string | null = null;
  // To Do
  @state() tedTodoLists: import("./types.ts").TedTodoListsResponse | null = null;
  @state() tedTodoListsLoading = false;
  @state() tedTodoListsError: string | null = null;
  @state() tedTodoTasks: import("./types.ts").TedTodoTasksResponse | null = null;
  @state() tedTodoTasksLoading = false;
  @state() tedTodoTasksError: string | null = null;
  // Sync
  @state() tedSyncReconciliation: import("./types.ts").TedSyncReconciliationResponse | null = null;
  @state() tedSyncReconciliationLoading = false;
  @state() tedSyncReconciliationError: string | null = null;
  @state() tedSyncProposals: import("./types.ts").TedSyncProposalsResponse | null = null;
  @state() tedSyncProposalsLoading = false;
  @state() tedSyncProposalsError: string | null = null;
  @state() tedSyncApproveBusy: string | null = null;
  @state() tedSyncApproveError: string | null = null;
  @state() tedSyncApproveResult: string | null = null;
  @state() tedSyncRejectBusy: string | null = null;
  @state() tedSyncRejectError: string | null = null;
  @state() tedSyncRejectResult: string | null = null;
  // Extraction
  @state() tedExtractionResult: import("./types.ts").TedCommitmentExtractionResponse | null = null;
  @state() tedExtractionLoading = false;
  @state() tedExtractionError: string | null = null;
  // Improvement Proposals (Codex Builder Lane)
  @state() tedImprovementProposals: TedImprovementProposal[] = [];
  @state() tedImprovementProposalsLoading = false;
  @state() tedImprovementProposalsError: string | null = null;
  @state() tedImprovementCreateBusy = false;
  @state() tedImprovementCreateError: string | null = null;
  @state() tedImprovementCreateResult: string | null = null;
  @state() tedImprovementReviewBusy = false;
  @state() tedImprovementReviewError: string | null = null;
  @state() tedImprovementReviewResult: string | null = null;
  @state() tedImprovementApplyBusy = false;
  @state() tedImprovementApplyError: string | null = null;
  @state() tedImprovementApplyResult: string | null = null;
  @state() tedImprovementGenerateBusy = false;
  @state() tedImprovementGenerateError: string | null = null;
  @state() tedImprovementGenerateResult:
    | import("./types.ts").TedImprovementGenerateResponse
    | null = null;
  // Trust Autonomy Evaluation
  @state() tedTrustAutonomy: TedTrustAutonomyEvaluation | null = null;
  @state() tedTrustAutonomyLoading = false;
  @state() tedTrustAutonomyError: string | null = null;
  // Failure Aggregation
  @state() tedFailureAggregation: TedFailureAggregationResponse | null = null;
  @state() tedFailureAggregationLoading = false;
  @state() tedFailureAggregationError: string | null = null;
  // JC-110: Architecture closure
  @state() tedDraftSubmitReviewLoading = false;
  @state() tedDraftSubmitReviewError: string | null = null;
  @state() tedDeepWorkSessionLoading = false;
  @state() tedDeepWorkSessionError: string | null = null;
  @state() tedDeepWorkSessionResult: Record<string, unknown> | null = null;
  @state() tedGraphSyncStatusLoading = false;
  @state() tedGraphSyncStatusError: string | null = null;
  @state() tedGraphSyncStatusResult: Record<string, unknown> | null = null;
  // Inline form state for deep work session input
  @state() showDeepWorkInput = false;
  @state() deepWorkInputMinutes = "";
  @state() deepWorkInputLabel = "";
  // Inline form state for graph sync profile input
  @state() showGraphSyncInput = false;
  @state() graphSyncInputProfileId = "olumie";
  // Ingestion
  @state() tedIngestionStatusLoading = false;
  @state() tedIngestionStatusError: string | null = null;
  @state() tedIngestionStatus: Record<string, unknown> | null = null;
  @state() tedIngestionRunBusy = false;
  @state() tedIngestionRunError: string | null = null;
  @state() tedIngestionRunResult: Record<string, unknown> | null = null;
  // Discovery
  @state() tedDiscoveryStatusLoading = false;
  @state() tedDiscoveryStatusError: string | null = null;
  @state() tedDiscoveryStatus: Record<string, unknown> | null = null;
  @state() tedDiscoveryRunBusy = false;
  @state() tedDiscoveryRunError: string | null = null;
  @state() tedDiscoveryRunResult: Record<string, unknown> | null = null;
  // SharePoint state
  @state() tedSharePointSites: Array<{
    id: string;
    displayName: string;
    webUrl: string;
    name: string;
  }> | null = null;
  @state() tedSharePointSitesLoading = false;
  @state() tedSharePointSitesError: string | null = null;
  @state() tedSharePointDrives: Array<{
    id: string;
    name: string;
    driveType: string;
    webUrl: string;
    description: string | null;
  }> | null = null;
  @state() tedSharePointDrivesLoading = false;
  @state() tedSharePointDrivesError: string | null = null;
  @state() tedSharePointItems: Array<{
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
  }> | null = null;
  @state() tedSharePointItemsLoading = false;
  @state() tedSharePointItemsError: string | null = null;
  @state() tedSharePointItemsPath = "/";
  @state() tedSharePointSearchResults: Array<{
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
  }> | null = null;
  @state() tedSharePointSearchLoading = false;
  @state() tedSharePointSearchError: string | null = null;
  @state() tedSharePointUploadResult: string | null = null;
  @state() tedSharePointUploadLoading = false;
  @state() tedSharePointUploadError: string | null = null;
  @state() tedSharePointFolderResult: string | null = null;
  @state() tedSharePointFolderLoading = false;
  @state() tedSharePointFolderError: string | null = null;
  @state() tedSharePointSelectedProfile = "olumie";
  @state() tedSharePointSelectedSiteId = "";
  @state() tedSharePointSelectedDriveId = "";
  @state() tedSharePointSearchQuery = "";
  @state() tedStaleDealsList: import("./types.ts").TedStaleDeal[] = [];
  @state() tedStaleDealsLoading = false;
  @state() tedStaleDealsError: string | null = null;
  @state() tedDealRetrospective: import("./types.ts").TedDealRetrospective | null = null;
  @state() tedDealRetrospectiveLoading = false;
  @state() tedDealRetrospectiveError: string | null = null;
  // Builder Lane (Codex)
  @state() tedBuilderLanePatterns: Record<string, unknown> | null = null;
  @state() tedBuilderLanePatternsLoading = false;
  @state() tedBuilderLanePatternsError: string | null = null;
  @state() tedBuilderLaneStatus: Record<string, unknown> | null = null;
  @state() tedBuilderLaneStatusLoading = false;
  @state() tedBuilderLaneMetrics: Record<string, unknown> | null = null;
  @state() tedBuilderLaneMetricsLoading = false;
  @state() tedBuilderLaneRevertBusy = false;
  @state() tedBuilderLaneRevertError: string | null = null;
  @state() tedBuilderLaneRevertResult: string | null = null;
  @state() tedBuilderLaneGenerateBusy = false;
  @state() tedBuilderLaneCalibrationBusy = false;
  @state() tedActiveSection: "all" | "operate" | "build" | "govern" | "intake" | "evals" = "all";
  // Self-Healing Dashboard
  @state() selfHealingStatus: Record<string, unknown> | null = null;
  @state() selfHealingStatusLoading = false;
  @state() selfHealingStatusError: string | null = null;
  @state() correctionTaxonomy: Record<string, unknown> | null = null;
  @state() correctionTaxonomyLoading = false;
  @state() correctionTaxonomyError: string | null = null;
  @state() engagementInsights: Record<string, unknown> | null = null;
  @state() engagementInsightsLoading = false;
  @state() engagementInsightsError: string | null = null;
  @state() noiseLevel: Record<string, unknown> | null = null;
  @state() noiseLevelLoading = false;
  @state() noiseLevelError: string | null = null;
  @state() autonomyStatus: Record<string, unknown> | null = null;
  @state() autonomyStatusLoading = false;
  @state() autonomyStatusError: string | null = null;
  // Sprint 2 (SDD 72): Evaluation Pipeline
  @state() tedEvaluationStatus: Record<string, unknown> | null = null;
  @state() tedEvaluationStatusLoading = false;
  @state() tedEvaluationStatusError: string | null = null;
  @state() tedEvaluationRunBusy = false;
  @state() tedEvaluationRunError: string | null = null;
  @state() tedEvaluationRunResult: Record<string, unknown> | null = null;
  // QA Dashboard (SDD 75)
  @state() tedQaDashboard: Record<string, unknown> | null = null;
  @state() tedQaDashboardLoading = false;
  @state() tedQaDashboardError: string | null = null;
  @state() tedCanaryRunBusy = false;
  @state() tedCanaryRunError: string | null = null;
  @state() tedCanaryRunResult: Record<string, unknown> | null = null;

  @state() logsLoading = false;
  @state() logsError: string | null = null;
  @state() logsFile: string | null = null;
  @state() logsEntries: LogEntry[] = [];
  @state() logsFilterText = "";
  @state() logsLevelFilters: Record<LogLevel, boolean> = {
    ...DEFAULT_LOG_LEVEL_FILTERS,
  };
  @state() logsAutoFollow = true;
  @state() logsTruncated = false;
  @state() logsCursor: number | null = null;
  @state() logsLastFetchAt: number | null = null;
  @state() logsLimit = 500;
  @state() logsMaxBytes = 250_000;
  @state() logsAtBottom = true;

  client: GatewayBrowserClient | null = null;
  private chatScrollFrame: number | null = null;
  private chatScrollTimeout: number | null = null;
  private chatHasAutoScrolled = false;
  private chatUserNearBottom = true;
  @state() chatNewMessagesBelow = false;
  private nodesPollInterval: number | null = null;
  private logsPollInterval: number | null = null;
  private debugPollInterval: number | null = null;
  private logsScrollFrame: number | null = null;
  private toolStreamById = new Map<string, ToolStreamEntry>();
  private toolStreamOrder: string[] = [];
  refreshSessionsAfterChat = new Set<string>();
  basePath = "";
  private popStateHandler = () =>
    onPopStateInternal(this as unknown as Parameters<typeof onPopStateInternal>[0]);
  private themeMedia: MediaQueryList | null = null;
  private themeMediaHandler: ((event: MediaQueryListEvent) => void) | null = null;
  private topbarObserver: ResizeObserver | null = null;

  createRenderRoot() {
    return this;
  }

  connectedCallback() {
    super.connectedCallback();
    handleConnected(this as unknown as Parameters<typeof handleConnected>[0]);
  }

  protected firstUpdated() {
    handleFirstUpdated(this as unknown as Parameters<typeof handleFirstUpdated>[0]);
  }

  disconnectedCallback() {
    handleDisconnected(this as unknown as Parameters<typeof handleDisconnected>[0]);
    super.disconnectedCallback();
  }

  protected updated(changed: Map<PropertyKey, unknown>) {
    handleUpdated(this as unknown as Parameters<typeof handleUpdated>[0], changed);
  }

  connect() {
    connectGatewayInternal(this as unknown as Parameters<typeof connectGatewayInternal>[0]);
  }

  handleChatScroll(event: Event) {
    handleChatScrollInternal(
      this as unknown as Parameters<typeof handleChatScrollInternal>[0],
      event,
    );
  }

  handleLogsScroll(event: Event) {
    handleLogsScrollInternal(
      this as unknown as Parameters<typeof handleLogsScrollInternal>[0],
      event,
    );
  }

  exportLogs(lines: string[], label: string) {
    exportLogsInternal(lines, label);
  }

  resetToolStream() {
    resetToolStreamInternal(this as unknown as Parameters<typeof resetToolStreamInternal>[0]);
  }

  resetChatScroll() {
    resetChatScrollInternal(this as unknown as Parameters<typeof resetChatScrollInternal>[0]);
  }

  scrollToBottom(opts?: { smooth?: boolean }) {
    resetChatScrollInternal(this as unknown as Parameters<typeof resetChatScrollInternal>[0]);
    scheduleChatScrollInternal(
      this as unknown as Parameters<typeof scheduleChatScrollInternal>[0],
      true,
      Boolean(opts?.smooth),
    );
  }

  async loadAssistantIdentity() {
    await loadAssistantIdentityInternal(this);
  }

  applySettings(next: UiSettings) {
    applySettingsInternal(this as unknown as Parameters<typeof applySettingsInternal>[0], next);
  }

  setTab(next: Tab) {
    setTabInternal(this as unknown as Parameters<typeof setTabInternal>[0], next);
  }

  setTheme(next: ThemeMode, context?: Parameters<typeof setThemeInternal>[2]) {
    setThemeInternal(this as unknown as Parameters<typeof setThemeInternal>[0], next, context);
  }

  async loadOverview() {
    await loadOverviewInternal(this as unknown as Parameters<typeof loadOverviewInternal>[0]);
  }

  async loadCron() {
    await loadCronInternal(this as unknown as Parameters<typeof loadCronInternal>[0]);
  }

  async loadTedWorkbench() {
    await loadTedWorkbench(this);
  }

  async validateTedRoleCard() {
    await validateTedRoleCard(this);
  }

  async runTedProof(proofScript: string) {
    await runTedProof(this, proofScript);
  }

  async loadTedJobCardDetail(id: string) {
    await loadTedJobCardDetail(this, id);
  }

  async saveTedJobCardDetail() {
    await saveTedJobCardDetail(this);
  }

  async previewTedJobCardUpdate() {
    await previewTedJobCardUpdate(this);
  }

  async suggestTedJobCardKpis() {
    await suggestTedJobCardKpis(this);
  }

  async decideTedRecommendation(id: string, decision: "approved" | "dismissed") {
    await decideTedRecommendation(this, id, decision);
  }

  async runTedIntakeRecommendation() {
    await runTedIntakeRecommendation(this);
  }

  async saveTedIntakeJobCard() {
    await saveTedIntakeJobCard(this);
  }

  async applyTedThresholds(reset = false) {
    await applyTedThresholds(this, reset);
  }

  async loadTedSourceDocument(
    key: "job_board" | "promotion_policy" | "value_friction" | "interrogation_cycle",
  ) {
    await loadTedSourceDocument(this, key);
  }

  async loadTedPolicyDocument(key: import("./types.js").TedPolicyKey) {
    await loadTedPolicyDocument(this, key);
  }

  async previewTedPolicyUpdate() {
    await previewTedPolicyUpdate(this);
  }

  async saveTedPolicyUpdate() {
    await saveTedPolicyUpdate(this);
  }

  async startTedConnectorAuth(profileId: "olumie" | "everest") {
    await startTedConnectorAuth(this, profileId);
  }

  async pollTedConnectorAuth(profileId: "olumie" | "everest") {
    await pollTedConnectorAuth(this, profileId);
  }

  async revokeTedConnectorAuth(profileId: "olumie" | "everest") {
    await revokeTedConnectorAuth(this, profileId);
  }

  async loadTedMail(profileId?: string, folder?: string) {
    await loadTedMail(this, profileId, folder);
  }

  async loadTedMorningBrief() {
    await loadTedMorningBrief(this);
  }

  async loadTedEodDigest() {
    await loadTedEodDigest(this);
  }

  async loadTedDealList() {
    await loadTedDealList(this);
  }

  async loadTedDealDetail(dealId: string) {
    await loadTedDealDetail(this, dealId);
  }

  async updateTedDeal(dealId: string, fields: Record<string, unknown>) {
    await updateTedDeal(this, dealId, fields);
  }

  async loadTedLlmProvider() {
    await loadTedLlmProvider(this);
  }

  async updateTedLlmProvider(
    newDefault: import("./types.ts").LlmProviderName,
    perJobOverrides?: Record<string, { provider: import("./types.ts").LlmProviderName }>,
  ) {
    await updateTedLlmProvider(this, newDefault, perJobOverrides);
  }

  async loadTedMeetingsUpcoming() {
    await loadTedMeetingsUpcoming(this);
  }

  async loadTedCommitments() {
    await loadTedCommitments(this);
  }

  async loadTedActions() {
    await loadTedActions(this);
  }

  async loadTedWaitingFor() {
    await loadTedWaitingFor(this);
  }

  async loadTedTrustMetrics() {
    await loadTedTrustMetrics(this);
  }

  async loadTedDeepWorkMetrics() {
    await loadTedDeepWorkMetrics(this);
  }

  async loadTedDraftQueue() {
    await loadTedDraftQueue(this);
  }

  async loadTedEventLogStats() {
    await loadTedEventLogStats(this);
  }

  async loadTedPlannerPlans(profileId?: string) {
    await loadTedPlannerPlans(this, profileId);
  }

  async loadTedPlannerTasks(profileId: string, planId: string, bucketId?: string) {
    await loadTedPlannerTasks(this, profileId, planId, bucketId);
  }

  async loadTedTodoLists(profileId?: string) {
    await loadTedTodoLists(this, profileId);
  }

  async loadTedTodoTasks(profileId: string, listId: string) {
    await loadTedTodoTasks(this, profileId, listId);
  }

  async loadTedSyncReconciliation(profileId?: string) {
    await loadTedSyncReconciliation(this, profileId);
  }

  async loadTedSyncProposals(profileId?: string) {
    await loadTedSyncProposals(this, profileId);
  }

  async approveTedSyncProposal(profileId: string, proposalId: string) {
    await approveTedSyncProposal(this, profileId, proposalId);
  }

  async rejectTedSyncProposal(profileId: string, proposalId: string) {
    await rejectTedSyncProposal(this, profileId, proposalId);
  }

  async extractTedCommitments(profileId: string, messageId: string) {
    await extractTedCommitments(this, profileId, messageId);
  }

  onLoadImprovementProposals = (status?: string) => loadTedImprovementProposals(this, status);
  onCreateImprovementProposal = (params: { title: string; type: string; description: string }) =>
    createTedImprovementProposal(this, params);
  onReviewImprovementProposal = (proposalId: string, verdict: string, notes?: string) =>
    reviewTedImprovementProposal(this, proposalId, verdict, notes);
  onApplyImprovementProposal = (proposalId: string) =>
    applyTedImprovementProposal(this, proposalId);
  onGenerateImprovementProposal = (days?: number) => generateTedImprovementProposal(this, days);
  onLoadTrustAutonomy = () => loadTedTrustAutonomy(this);
  onLoadFailureAggregation = (days?: number) => loadTedFailureAggregation(this, days);
  onTedDraftSubmitReview = (draftId: string) => {
    void submitTedDraftForReviewById(
      this as unknown as import("./controllers/ted.ts").TedWorkbenchState,
      draftId,
    );
  };
  onTedDeepWorkSession = (durationMinutes: number, label?: string, entity?: string) => {
    void recordTedDeepWorkSession(
      this as unknown as import("./controllers/ted.ts").TedWorkbenchState,
      durationMinutes,
      label,
      entity,
    );
  };
  onTedGraphSyncStatus = (profileId: string) => {
    void loadTedGraphSyncStatus(
      this as unknown as import("./controllers/ted.ts").TedWorkbenchState,
      profileId,
    );
  };

  onLoadBuilderLanePatterns = () =>
    loadBuilderLanePatterns(this as unknown as import("./controllers/ted.ts").TedWorkbenchState);
  onLoadBuilderLaneStatus = () =>
    loadBuilderLaneStatus(this as unknown as import("./controllers/ted.ts").TedWorkbenchState);
  onLoadBuilderLaneMetrics = () =>
    loadBuilderLaneMetrics(this as unknown as import("./controllers/ted.ts").TedWorkbenchState);
  onGenerateFromPattern = (domain: string, contextBucket?: Record<string, unknown>) =>
    generateFromPattern(
      this as unknown as import("./controllers/ted.ts").TedWorkbenchState,
      domain,
      contextBucket,
    );
  onRevertAppliedProposal = (proposalId: string) =>
    revertAppliedProposal(
      this as unknown as import("./controllers/ted.ts").TedWorkbenchState,
      proposalId,
    );
  onSubmitCalibrationResponse = (
    promptId: string,
    response: string,
    domain?: string,
    moment?: string,
  ) =>
    submitCalibrationResponse(
      this as unknown as import("./controllers/ted.ts").TedWorkbenchState,
      promptId,
      response,
      domain,
      moment,
    );

  // Self-Healing Dashboard
  async fetchSelfHealingStatus() {
    await fetchSelfHealingStatus(
      this as unknown as import("./controllers/ted.ts").TedWorkbenchState,
    );
  }

  async fetchCorrectionTaxonomy() {
    await fetchCorrectionTaxonomy(
      this as unknown as import("./controllers/ted.ts").TedWorkbenchState,
    );
  }

  async fetchEngagementInsights() {
    await fetchEngagementInsights(
      this as unknown as import("./controllers/ted.ts").TedWorkbenchState,
    );
  }

  async fetchNoiseLevel() {
    await fetchNoiseLevel(this as unknown as import("./controllers/ted.ts").TedWorkbenchState);
  }

  async fetchAutonomyStatus() {
    await fetchAutonomyStatus(this as unknown as import("./controllers/ted.ts").TedWorkbenchState);
  }

  async loadTedEvaluationStatus() {
    await loadTedEvaluationStatus(
      this as unknown as import("./controllers/ted.ts").TedWorkbenchState,
    );
  }

  async triggerTedEvaluationRun() {
    await triggerTedEvaluationRun(
      this as unknown as import("./controllers/ted.ts").TedWorkbenchState,
    );
  }

  async loadTedQaDashboard() {
    await loadTedQaDashboard(this as unknown as import("./controllers/ted.ts").TedWorkbenchState);
  }

  async triggerTedCanaryRun() {
    await triggerTedCanaryRun(this as unknown as import("./controllers/ted.ts").TedWorkbenchState);
  }

  async loadTedIngestionStatus() {
    await loadTedIngestionStatus(
      this as unknown as import("./controllers/ted.ts").TedWorkbenchState,
    );
  }

  async triggerTedIngestion() {
    await triggerTedIngestion(this as unknown as import("./controllers/ted.ts").TedWorkbenchState);
  }

  async loadTedDiscoveryStatus() {
    await loadTedDiscoveryStatus(
      this as unknown as import("./controllers/ted.ts").TedWorkbenchState,
    );
  }

  async triggerTedDiscovery(profileId: string) {
    await triggerTedDiscovery(
      this as unknown as import("./controllers/ted.ts").TedWorkbenchState,
      profileId,
    );
  }

  // C12-004: Stale deals
  async loadTedStaleDeals(days?: number) {
    await loadTedStaleDeals(
      this as unknown as import("./controllers/ted.ts").TedWorkbenchState,
      days,
    );
  }

  // C12-011: Deal retrospective
  async generateTedDealRetrospective(dealId: string) {
    await generateTedDealRetrospective(
      this as unknown as import("./controllers/ted.ts").TedWorkbenchState,
      dealId,
    );
  }

  // SharePoint
  async loadTedSharePointSites() {
    await loadTedSharePointSites(
      this as unknown as import("./controllers/ted.ts").TedWorkbenchState & {
        client: import("./gateway.ts").GatewayBrowserClient;
        connected: boolean;
      },
    );
  }

  async loadTedSharePointDrives() {
    await loadTedSharePointDrives(
      this as unknown as import("./controllers/ted.ts").TedWorkbenchState & {
        client: import("./gateway.ts").GatewayBrowserClient;
        connected: boolean;
      },
    );
  }

  async loadTedSharePointItems(itemId?: string) {
    await loadTedSharePointItems(
      this as unknown as import("./controllers/ted.ts").TedWorkbenchState & {
        client: import("./gateway.ts").GatewayBrowserClient;
        connected: boolean;
      },
      itemId,
    );
  }

  async searchTedSharePoint() {
    await searchTedSharePoint(
      this as unknown as import("./controllers/ted.ts").TedWorkbenchState & {
        client: import("./gateway.ts").GatewayBrowserClient;
        connected: boolean;
      },
    );
  }

  async uploadTedSharePointFile(fileName: string, contentBase64: string, contentType: string) {
    await uploadTedSharePointFile(
      this as unknown as import("./controllers/ted.ts").TedWorkbenchState & {
        client: import("./gateway.ts").GatewayBrowserClient;
        connected: boolean;
      },
      fileName,
      contentBase64,
      contentType,
    );
  }

  async createTedSharePointFolder(folderName: string) {
    await createTedSharePointFolder(
      this as unknown as import("./controllers/ted.ts").TedWorkbenchState & {
        client: import("./gateway.ts").GatewayBrowserClient;
        connected: boolean;
      },
      folderName,
    );
  }

  async handleAbortChat() {
    await handleAbortChatInternal(this as unknown as Parameters<typeof handleAbortChatInternal>[0]);
  }

  removeQueuedMessage(id: string) {
    removeQueuedMessageInternal(
      this as unknown as Parameters<typeof removeQueuedMessageInternal>[0],
      id,
    );
  }

  async handleSendChat(
    messageOverride?: string,
    opts?: Parameters<typeof handleSendChatInternal>[2],
  ) {
    await handleSendChatInternal(
      this as unknown as Parameters<typeof handleSendChatInternal>[0],
      messageOverride,
      opts,
    );
  }

  async handleWhatsAppStart(force: boolean) {
    await handleWhatsAppStartInternal(this, force);
  }

  async handleWhatsAppWait() {
    await handleWhatsAppWaitInternal(this);
  }

  async handleWhatsAppLogout() {
    await handleWhatsAppLogoutInternal(this);
  }

  async handleChannelConfigSave() {
    await handleChannelConfigSaveInternal(this);
  }

  async handleChannelConfigReload() {
    await handleChannelConfigReloadInternal(this);
  }

  handleNostrProfileEdit(accountId: string, profile: NostrProfile | null) {
    handleNostrProfileEditInternal(this, accountId, profile);
  }

  handleNostrProfileCancel() {
    handleNostrProfileCancelInternal(this);
  }

  handleNostrProfileFieldChange(field: keyof NostrProfile, value: string) {
    handleNostrProfileFieldChangeInternal(this, field, value);
  }

  async handleNostrProfileSave() {
    await handleNostrProfileSaveInternal(this);
  }

  async handleNostrProfileImport() {
    await handleNostrProfileImportInternal(this);
  }

  handleNostrProfileToggleAdvanced() {
    handleNostrProfileToggleAdvancedInternal(this);
  }

  async handleExecApprovalDecision(decision: "allow-once" | "allow-always" | "deny") {
    const active = this.execApprovalQueue[0];
    if (!active || !this.client || this.execApprovalBusy) {
      return;
    }
    this.execApprovalBusy = true;
    this.execApprovalError = null;
    try {
      await this.client.request("exec.approval.resolve", {
        id: active.id,
        decision,
      });
      this.execApprovalQueue = this.execApprovalQueue.filter((entry) => entry.id !== active.id);
    } catch (err) {
      this.execApprovalError = `Exec approval failed: ${String(err)}`;
    } finally {
      this.execApprovalBusy = false;
    }
  }

  handleGatewayUrlConfirm() {
    const nextGatewayUrl = this.pendingGatewayUrl;
    if (!nextGatewayUrl) {
      return;
    }
    this.pendingGatewayUrl = null;
    applySettingsInternal(this as unknown as Parameters<typeof applySettingsInternal>[0], {
      ...this.settings,
      gatewayUrl: nextGatewayUrl,
    });
    this.connect();
  }

  handleGatewayUrlCancel() {
    this.pendingGatewayUrl = null;
  }

  // Sidebar handlers for tool output viewing
  handleOpenSidebar(content: string) {
    if (this.sidebarCloseTimer != null) {
      window.clearTimeout(this.sidebarCloseTimer);
      this.sidebarCloseTimer = null;
    }
    this.sidebarContent = content;
    this.sidebarError = null;
    this.sidebarOpen = true;
  }

  handleCloseSidebar() {
    this.sidebarOpen = false;
    // Clear content after transition
    if (this.sidebarCloseTimer != null) {
      window.clearTimeout(this.sidebarCloseTimer);
    }
    this.sidebarCloseTimer = window.setTimeout(() => {
      if (this.sidebarOpen) {
        return;
      }
      this.sidebarContent = null;
      this.sidebarError = null;
      this.sidebarCloseTimer = null;
    }, 200);
  }

  handleSplitRatioChange(ratio: number) {
    const newRatio = Math.max(0.4, Math.min(0.7, ratio));
    this.splitRatio = newRatio;
    this.applySettings({ ...this.settings, splitRatio: newRatio });
  }

  render() {
    return renderApp(this as unknown as AppViewState);
  }
}
