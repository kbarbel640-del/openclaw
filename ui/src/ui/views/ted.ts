import { html, nothing } from "lit";
import type {
  LlmProviderName,
  TedDealFull,
  TedDealSummary,
  TedEodDigestResponse,
  TedJobCardImpactPreview,
  TedIntakeRecommendation,
  TedJobCardDetail,
  TedKpiSuggestion,
  TedLlmProviderConfig,
  TedMailMessage,
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
  TedMorningBriefResponse,
  TedPolicyDocument,
  TedPolicyImpactPreview,
  TedPolicyKey,
  TedSourceDocument,
  TedWorkbenchSnapshot,
} from "../types.ts";

function formatFileSize(bytes: number): string {
  if (bytes === 0) {
    return "0 B";
  }
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

/** Safe stringifier for Record<string, unknown> values — avoids both restrict-template-expressions and no-base-to-string */
function toStr(val: unknown, fallback = "—"): string {
  if (val == null) {
    return fallback;
  }
  if (typeof val === "string") {
    return val;
  }
  if (typeof val === "number" || typeof val === "boolean") {
    return String(val);
  }
  return JSON.stringify(val);
}

export type TedWorkbenchSection = "all" | "operate" | "build" | "govern" | "intake" | "evals";

export type TedViewProps = {
  loading: boolean;
  snapshot: TedWorkbenchSnapshot | null;
  error: string | null;
  roleCardJson: string;
  roleCardBusy: boolean;
  roleCardResult: string | null;
  roleCardError: string | null;
  proofBusyKey: string | null;
  proofResult: string | null;
  proofError: string | null;
  jobCardDetailLoading: boolean;
  jobCardDetail: TedJobCardDetail | null;
  jobCardDetailError: string | null;
  jobCardEditorMarkdown: string;
  jobCardSaveBusy: boolean;
  jobCardSaveError: string | null;
  jobCardSaveResult: string | null;
  jobCardPreviewBusy: boolean;
  jobCardPreviewError: string | null;
  jobCardPreview: TedJobCardImpactPreview | null;
  jobCardKpiSuggestBusy: boolean;
  jobCardKpiSuggestError: string | null;
  jobCardKpiSuggestion: TedKpiSuggestion | null;
  recommendationBusyId: string | null;
  recommendationError: string | null;
  intakeTitle: string;
  intakeOutcome: string;
  intakeJobFamily: string;
  intakeRiskLevel: string;
  intakeAutomationLevel: string;
  intakeBusy: boolean;
  intakeError: string | null;
  intakeRecommendation: TedIntakeRecommendation | null;
  intakeSaveBusy: boolean;
  intakeSaveError: string | null;
  intakeSaveResult: Record<string, unknown> | null;
  onSaveIntakeJobCard: () => void;
  thresholdManual: string;
  thresholdApprovalAge: string;
  thresholdTriageEod: string;
  thresholdBlockedExplainability: string;
  thresholdAcknowledgeRisk: boolean;
  thresholdBusy: boolean;
  thresholdError: string | null;
  thresholdResult: string | null;
  sourceDocLoading: boolean;
  sourceDocError: string | null;
  sourceDoc: TedSourceDocument | null;
  policyLoading: boolean;
  policyError: string | null;
  policyDoc: TedPolicyDocument | null;
  policyPreviewBusy: boolean;
  policyPreviewError: string | null;
  policyPreview: TedPolicyImpactPreview | null;
  policySaveBusy: boolean;
  policySaveError: string | null;
  policySaveResult: string | null;
  connectorAuthBusyProfile: string | null;
  connectorAuthError: string | null;
  connectorAuthResult: string | null;
  activeSection: TedWorkbenchSection;
  onRoleCardJsonChange: (value: string) => void;
  onRoleCardValidate: () => void;
  onRunProof: (proofScript: string) => void;
  onOpenJobCard: (id: string) => void;
  onRecommendationDecision: (id: string, decision: "approved" | "dismissed") => void;
  onIntakeFieldChange: (
    field: "title" | "outcome" | "job_family" | "risk_level" | "automation_level",
    value: string,
  ) => void;
  onRunIntakeRecommendation: () => void;
  onApplyIntakeExample: (example: "ops-brief" | "deal-followup" | "governance-hardening") => void;
  onThresholdFieldChange: (
    field: "manual" | "approval" | "triage" | "blocked" | "ack",
    value: string,
  ) => void;
  onApplyThresholds: () => void;
  onResetThresholds: () => void;
  onSetSection: (section: TedWorkbenchSection) => void;
  onJobCardEditorChange: (value: string) => void;
  onSaveJobCardDetail: () => void;
  onPreviewJobCardUpdate: () => void;
  onSuggestJobCardKpis: () => void;
  onApplySuggestedKpisToEditor: () => void;
  onOpenSourceDoc: (
    key: "job_board" | "promotion_policy" | "value_friction" | "interrogation_cycle",
  ) => void;
  onLoadPolicyDoc: (key: TedPolicyKey) => void;
  onPolicyConfigChange: (
    field: "objective" | "rollout_mode" | "automation_ceiling" | "operator_notes",
    value: string,
  ) => void;
  onPolicyListChange: (field: "success_checks" | "guardrails", value: string) => void;
  onPreviewPolicyUpdate: () => void;
  onSavePolicyUpdate: () => void;
  onStartConnectorAuth: (profileId: "olumie" | "everest") => void;
  onPollConnectorAuth: (profileId: "olumie" | "everest") => void;
  onRevokeConnectorAuth: (profileId: "olumie" | "everest") => void;
  onRefresh: () => void;
  mailLoading: boolean;
  mailMessages: TedMailMessage[];
  mailError: string | null;
  morningBriefLoading: boolean;
  morningBrief: TedMorningBriefResponse | null;
  morningBriefError: string | null;
  eodDigestLoading: boolean;
  eodDigest: TedEodDigestResponse | null;
  eodDigestError: string | null;
  onLoadMail: (profileId?: string) => void;
  onLoadMorningBrief: () => void;
  onLoadEodDigest: () => void;
  tedDealListLoading: boolean;
  tedDealList: TedDealSummary[];
  tedDealListError: string | null;
  tedDealDetailLoading: boolean;
  tedDealDetail: TedDealFull | null;
  tedDealDetailError: string | null;
  tedDealActionBusy: boolean;
  tedDealActionError: string | null;
  tedDealActionResult: string | null;
  onLoadDealList: () => void;
  onLoadDealDetail: (dealId: string) => void;
  onUpdateDeal: (dealId: string, fields: Record<string, unknown>) => void;
  llmProviderConfig: TedLlmProviderConfig | null;
  llmProviderLoading: boolean;
  llmProviderError: string | null;
  onLoadLlmProvider: () => void;
  onUpdateLlmProvider: (provider: LlmProviderName) => void;
  // Phase 6: Meetings + Commitments + GTD
  meetingsUpcoming: TedMeetingUpcomingResponse | null;
  meetingsLoading: boolean;
  meetingsError: string | null;
  onLoadMeetings: () => void;
  commitments: TedCommitmentsListResponse | null;
  commitmentsLoading: boolean;
  commitmentsError: string | null;
  onLoadCommitments: () => void;
  actions: TedActionsListResponse | null;
  actionsLoading: boolean;
  actionsError: string | null;
  onLoadActions: () => void;
  waitingFor: TedWaitingForListResponse | null;
  waitingForLoading: boolean;
  waitingForError: string | null;
  onLoadWaitingFor: () => void;
  // Phase 8: Trust + Deep Work
  trustMetrics: TedTrustMetricsResponse | null;
  trustMetricsLoading: boolean;
  trustMetricsError: string | null;
  onLoadTrustMetrics: () => void;
  deepWorkMetrics: TedDeepWorkMetricsResponse | null;
  deepWorkMetricsLoading: boolean;
  deepWorkMetricsError: string | null;
  onLoadDeepWorkMetrics: () => void;
  // Draft Queue (JC-089f)
  draftQueue: TedDraftQueueResponse | null;
  draftQueueLoading: boolean;
  draftQueueError: string | null;
  onLoadDraftQueue: () => void;
  // Event Log Stats (JC-087e)
  eventLogStats: TedEventLogStatsResponse | null;
  eventLogStatsLoading: boolean;
  eventLogStatsError: string | null;
  onLoadEventLogStats: () => void;
  // Planner (JC-105)
  plannerPlans: TedPlannerListResponse | null;
  plannerPlansLoading: boolean;
  plannerPlansError: string | null;
  plannerTasks: TedPlannerTasksResponse | null;
  plannerTasksLoading: boolean;
  plannerTasksError: string | null;
  onLoadPlannerPlans: (profileId?: string) => void;
  onLoadPlannerTasks: (profileId: string, planId: string, bucketId?: string) => void;
  // To Do (JC-105)
  todoLists: TedTodoListsResponse | null;
  todoListsLoading: boolean;
  todoListsError: string | null;
  todoTasks: TedTodoTasksResponse | null;
  todoTasksLoading: boolean;
  todoTasksError: string | null;
  onLoadTodoLists: (profileId?: string) => void;
  onLoadTodoTasks: (profileId: string, listId: string) => void;
  // Sync Reconciliation (JC-105)
  syncReconciliation: TedSyncReconciliationResponse | null;
  syncReconciliationLoading: boolean;
  syncReconciliationError: string | null;
  syncProposals: TedSyncProposalsResponse | null;
  syncProposalsLoading: boolean;
  syncProposalsError: string | null;
  syncApproveBusy: string | null;
  syncApproveError: string | null;
  syncApproveResult: string | null;
  syncRejectBusy: string | null;
  syncRejectError: string | null;
  syncRejectResult: string | null;
  onRunReconciliation: (profileId?: string) => void;
  onLoadSyncProposals: (profileId?: string) => void;
  onApproveSyncProposal: (profileId: string, proposalId: string) => void;
  onRejectSyncProposal: (profileId: string, proposalId: string) => void;
  // Commitment Extraction (JC-105)
  extractionResult: TedCommitmentExtractionResponse | null;
  extractionLoading: boolean;
  extractionError: string | null;
  // Improvement Proposals (Codex Builder Lane)
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
  tedImprovementGenerateResult: import("../types.ts").TedImprovementGenerateResponse | null;
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
  // Inline form state for deep work session input
  showDeepWorkInput: boolean;
  deepWorkInputMinutes: string;
  deepWorkInputLabel: string;
  onDeepWorkInputToggle: () => void;
  onDeepWorkInputMinutesChange: (value: string) => void;
  onDeepWorkInputLabelChange: (value: string) => void;
  onDeepWorkInputSubmit: () => void;
  // Inline form state for graph sync profile input
  showGraphSyncInput: boolean;
  graphSyncInputProfileId: string;
  onGraphSyncInputToggle: () => void;
  onGraphSyncInputProfileChange: (value: string) => void;
  onGraphSyncInputSubmit: () => void;
  // Ingestion
  ingestionStatusLoading: boolean;
  ingestionStatusError: string | null;
  ingestionStatus: Record<string, unknown> | null;
  ingestionRunBusy: boolean;
  ingestionRunError: string | null;
  ingestionRunResult: Record<string, unknown> | null;
  onLoadIngestionStatus: () => void;
  onTriggerIngestion: () => void;
  // Discovery
  discoveryStatusLoading: boolean;
  discoveryStatusError: string | null;
  discoveryStatus: Record<string, unknown> | null;
  discoveryRunBusy: boolean;
  discoveryRunError: string | null;
  discoveryRunResult: Record<string, unknown> | null;
  onLoadDiscoveryStatus: () => void;
  onTriggerDiscovery: (profileId: string) => void;
  // SharePoint
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
  onSharePointLoadSites: () => void;
  onSharePointLoadDrives: () => void;
  onSharePointLoadItems: (itemId?: string) => void;
  onSharePointSearch: () => void;
  onSharePointUpload: (fileName: string, contentBase64: string, contentType: string) => void;
  onSharePointCreateFolder: (folderName: string) => void;
  onSharePointSelectProfile: (profileId: string) => void;
  onSharePointSelectSite: (siteId: string) => void;
  onSharePointSelectDrive: (driveId: string) => void;
  onSharePointSetSearchQuery: (query: string) => void;
  onSharePointSetPath: (path: string) => void;
  // C12-004: Stale deal owners
  tedStaleDealsList: import("../types.ts").TedStaleDeal[];
  tedStaleDealsLoading: boolean;
  tedStaleDealsError: string | null;
  onLoadStaleDeals: (days?: number) => void;
  // C12-011: Deal retrospective
  tedDealRetrospective: import("../types.ts").TedDealRetrospective | null;
  tedDealRetrospectiveLoading: boolean;
  tedDealRetrospectiveError: string | null;
  onGenerateRetrospective: (dealId: string) => void;
  // Builder Lane Dashboard
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
  onSubmitCalibrationResponse: (promptId: string, response: string, domain?: string) => void;
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
  onFetchSelfHealingStatus: () => void;
  onFetchCorrectionTaxonomy: () => void;
  onFetchEngagementInsights: () => void;
  onFetchNoiseLevel: () => void;
  onFetchAutonomyStatus: () => void;
  // Sprint 2 (SDD 72): Evaluation Pipeline
  tedEvaluationStatus: Record<string, unknown> | null;
  tedEvaluationStatusLoading: boolean;
  tedEvaluationStatusError: string | null;
  tedEvaluationRunBusy: boolean;
  tedEvaluationRunError: string | null;
  tedEvaluationRunResult: Record<string, unknown> | null;
  onLoadEvaluationStatus: () => void;
  onTriggerEvaluationRun: () => void;
  tedQaDashboard: Record<string, unknown> | null;
  tedQaDashboardLoading: boolean;
  tedQaDashboardError: string | null;
  tedCanaryRunBusy: boolean;
  tedCanaryRunError: string | null;
  tedCanaryRunResult: Record<string, unknown> | null;
  onLoadQaDashboard: () => void;
  onTriggerCanaryRun: () => void;
};

function labelForDealStage(stage: string | null): string {
  const labels: Record<string, string> = {
    deal_identified: "Identified",
    nda_signed: "NDA Signed",
    data_room_access: "Data Room",
    dd_active: "DD Active",
    psa_in_progress: "PSA In Progress",
    investor_onboarding: "Investor Onboarding",
    closing: "Closing",
    closed: "Closed",
    archived: "Archived",
  };
  return labels[stage ?? ""] ?? String(stage ?? "—");
}

function labelForDealType(dealType: string | null): string {
  const labels: Record<string, string> = {
    SNF_ALF: "SNF / ALF",
    SOFTWARE: "Software",
    ANCILLARY_HEALTHCARE: "Ancillary HC",
  };
  return labels[dealType ?? ""] ?? String(dealType ?? "—");
}

function toneForDealStatus(status: string | null): string {
  if (status === "active") {
    return "var(--color-success)";
  }
  if (status === "paused") {
    return "var(--color-warning)";
  }
  if (status === "closed") {
    return "var(--color-text-secondary)";
  }
  if (status === "archived") {
    return "var(--color-text-caption)";
  }
  return "var(--color-text-secondary)";
}

function daysUntil(dateStr: string): number {
  const target = new Date(dateStr).getTime();
  const now = Date.now();
  return Math.ceil((target - now) / (1000 * 60 * 60 * 24));
}

function familyLabel(family: "GOV" | "MNT" | "ING" | "LED" | "OUT"): string {
  if (family === "GOV") {
    return "Governance and Safety";
  }
  if (family === "MNT") {
    return "Reliability and Operations";
  }
  if (family === "ING") {
    return "Connectors and Intake";
  }
  if (family === "LED") {
    return "Deal and Work Ledger";
  }
  return "Outbound Drafting and Scheduling";
}

function toneForSeverity(severity: string): "" | "warn" | "danger" {
  if (severity === "critical") {
    return "danger";
  }
  if (severity === "warn") {
    return "warn";
  }
  return "";
}

function labelForJobCardStatus(status: string): string {
  if (status === "IN_PROGRESS") {
    return "In Progress";
  }
  if (status === "TODO_OR_UNKNOWN") {
    return "Not Started";
  }
  if (status === "DONE") {
    return "Complete";
  }
  if (status === "BLOCKED") {
    return "Needs Attention";
  }
  return status;
}

function toneForJobCardStatus(status: string): "" | "warn" | "danger" {
  if (status === "BLOCKED") {
    return "danger";
  }
  if (status === "IN_PROGRESS" || status === "TODO_OR_UNKNOWN") {
    return "warn";
  }
  return "";
}

function labelForConfidenceBand(band: "hold" | "watch" | "progressing" | "ready"): string {
  if (band === "ready") {
    return "Promotion Ready";
  }
  if (band === "progressing") {
    return "Building Confidence";
  }
  if (band === "watch") {
    return "Needs Monitoring";
  }
  return "Hold Promotion";
}

function toneForConfidenceBand(
  band: "hold" | "watch" | "progressing" | "ready",
): "" | "warn" | "danger" {
  if (band === "hold") {
    return "danger";
  }
  if (band === "watch") {
    return "warn";
  }
  return "";
}

function guidanceForConfidenceBand(band: "hold" | "watch" | "progressing" | "ready"): string {
  if (band === "ready") {
    return "This work item meets all promotion criteria. Review and approve when ready.";
  }
  if (band === "progressing") {
    return "Making progress. Continue adding proof evidence and KPI signals to build confidence.";
  }
  if (band === "watch") {
    return "Needs monitoring. Check that dependencies are unblocked and proof checks pass.";
  }
  return "Promotion held. Add KPI signals, proof evidence, and resolve blockers before this can advance.";
}

function labelForSection(section: TedWorkbenchSection): string {
  if (section === "all") {
    return "All";
  }
  if (section === "operate") {
    return "Run Today";
  }
  if (section === "build") {
    return "Build and Improve";
  }
  if (section === "govern") {
    return "Safety Controls";
  }
  if (section === "intake") {
    return "Add New Work";
  }
  return "Quality Trends";
}

function sectionFocus(section: TedWorkbenchSection): { title: string; subtitle: string } {
  if (section === "operate") {
    return {
      title: "Operate: Run Today",
      subtitle: "Review today’s decisions, blockers, and immediate actions.",
    };
  }
  if (section === "build") {
    return {
      title: "Build: Improve the System",
      subtitle: "Open work items, run proof checks, and inspect implementation details.",
    };
  }
  if (section === "govern") {
    return {
      title: "Govern: Safety and Approval",
      subtitle: "Control risk thresholds, approvals, and explainability.",
    };
  }
  if (section === "intake") {
    return {
      title: "Intake: Add New Work",
      subtitle: "Capture a new job and get a safe starter configuration.",
    };
  }
  if (section === "evals") {
    return {
      title: "Evals: Quality Trends",
      subtitle: "Track KPI and proof trajectories before promotions.",
    };
  }
  return {
    title: "All Views: Full Console",
    subtitle: "See the complete Ted operating picture in one place.",
  };
}

function humanizeRecommendationId(id: string): string {
  if (id === "blocked-job-cards") {
    return "Blocked work items";
  }
  if (id === "ted-sidecar-unhealthy") {
    return "Ted runtime health issue";
  }
  if (id === "steady-state") {
    return "Steady state";
  }
  if (id === "job-cards-not-found") {
    return "Job-card source missing";
  }
  if (id === "missing-kpi-signals") {
    return "Missing KPI signals";
  }
  return id.replaceAll("-", " ");
}

function labelForPolicyKey(key: TedPolicyKey): string {
  if (key === "job_board") {
    return "Job Board Policy";
  }
  if (key === "promotion_policy") {
    return "Promotion Policy";
  }
  return "Value and Friction Gates";
}

function toneForRiskDirection(direction: "safer" | "riskier" | "neutral"): "" | "warn" | "danger" {
  if (direction === "riskier") {
    return "danger";
  }
  if (direction === "neutral") {
    return "warn";
  }
  return "";
}

function toneForIntegrationStatus(
  status: "connected" | "needs_auth" | "misconfigured" | "error",
): "" | "warn" | "danger" {
  if (status === "connected") {
    return "";
  }
  if (status === "needs_auth") {
    return "warn";
  }
  return "danger";
}

function renderQaDashboard(props: TedViewProps): typeof nothing | ReturnType<typeof html> {
  const dashboard = props.tedQaDashboard;
  const loading = props.tedQaDashboardLoading ?? false;
  const dashError = props.tedQaDashboardError ?? "";
  const canaryBusy = props.tedCanaryRunBusy ?? false;
  const canaryError = props.tedCanaryRunError ?? "";

  const health = dashboard ? String((dashboard.health ?? "unknown") as string) : "unknown";
  const healthColor =
    health === "healthy"
      ? "var(--color-success)"
      : health === "degraded"
        ? "var(--color-warning)"
        : health === "unhealthy"
          ? "var(--color-error)"
          : "var(--color-text-secondary)";

  const evaluation = (dashboard?.evaluation ?? {}) as Record<string, unknown>;
  const canaries = (dashboard?.canaries ?? {}) as Record<string, unknown>;
  const drift = (dashboard?.drift ?? {}) as Record<string, unknown>;
  const config = (dashboard?.config ?? {}) as Record<string, unknown>;

  const evalPassRate = evaluation.pass_rate != null ? Number(evaluation.pass_rate) : null;
  const canaryPassed = canaries.passed != null ? Number(canaries.passed) : null;
  const canaryFailed = canaries.failed != null ? Number(canaries.failed) : null;
  const canaryTotal = canaries.canaries_run != null ? Number(canaries.canaries_run) : null;
  const driftCount = drift.drifting != null ? Number(drift.drifting) : null;
  const driftItems = Array.isArray(drift.drift_items)
    ? (drift.drift_items as Array<Record<string, unknown>>)
    : [];

  return html`
    <section class="card" style="margin-top: var(--space-4);">
      <div class="row" style="justify-content: space-between; align-items: center;">
        <div class="card-title">QA Dashboard</div>
        <div class="row" style="gap: var(--space-2);">
          <button class="btn btn--sm" ?disabled=${loading || canaryBusy} @click=${props.onLoadQaDashboard} aria-label="Refresh QA dashboard">Refresh</button>
          <button class="btn btn--sm btn--primary" ?disabled=${canaryBusy || loading} @click=${props.onTriggerCanaryRun} aria-label="Run canary checks">
            ${canaryBusy ? "Running..." : "Run Canaries"}
          </button>
        </div>
      </div>
      ${dashError ? html`<div class="text-error" style="margin-top: var(--space-2);">${dashError}</div>` : nothing}
      ${canaryError ? html`<div class="text-error" style="margin-top: var(--space-2);">${canaryError}</div>` : nothing}
      ${
        loading
          ? html`
              <div class="text-caption" style="margin-top: var(--space-2)">Loading...</div>
            `
          : nothing
      }
      ${
        !dashboard && !loading
          ? html`
              <div class="text-caption" style="margin-top: var(--space-2)">
                No QA data yet. Click "Refresh" to load the dashboard.
              </div>
            `
          : nothing
      }
      ${
        dashboard
          ? html`
        <div style="margin-top: var(--space-3);">
          <div style="display: flex; align-items: center; gap: var(--space-2); margin-bottom: var(--space-3);">
            <span style="font-size: var(--font-size-sm); font-weight: var(--font-weight-medium);">Health:</span>
            <span style="font-size: var(--font-size-md); font-weight: var(--font-weight-semibold); color: ${healthColor};">${health.toUpperCase()}</span>
          </div>
          <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: var(--space-3);">
            <div style="text-align: center; padding: var(--space-2); border: 1px solid var(--color-border-subtle); border-radius: var(--radius-sm);">
              <div class="text-caption">Evaluation</div>
              <div style="font-size: var(--font-size-md); font-weight: var(--font-weight-medium); color: ${evalPassRate != null && evalPassRate >= 80 ? "var(--color-success)" : evalPassRate != null ? "var(--color-warning)" : "var(--color-text-secondary)"};">
                ${evalPassRate != null ? `${evalPassRate}%` : "\u2014"}
              </div>
            </div>
            <div style="text-align: center; padding: var(--space-2); border: 1px solid var(--color-border-subtle); border-radius: var(--radius-sm);">
              <div class="text-caption">Canaries</div>
              <div style="font-size: var(--font-size-md); font-weight: var(--font-weight-medium); color: ${canaryFailed != null && canaryFailed === 0 ? "var(--color-success)" : canaryFailed != null ? "var(--color-error)" : "var(--color-text-secondary)"};">
                ${canaryTotal != null ? `${canaryPassed}/${canaryTotal}` : "\u2014"}
              </div>
            </div>
            <div style="text-align: center; padding: var(--space-2); border: 1px solid var(--color-border-subtle); border-radius: var(--radius-sm);">
              <div class="text-caption">Drift</div>
              <div style="font-size: var(--font-size-md); font-weight: var(--font-weight-medium); color: ${driftCount != null && driftCount === 0 ? "var(--color-success)" : driftCount != null ? "var(--color-warning)" : "var(--color-text-secondary)"};">
                ${driftCount != null ? (driftCount === 0 ? "Stable" : `${driftCount} drifting`) : "\u2014"}
              </div>
            </div>
          </div>
          ${
            driftItems.length > 0
              ? html`
            <div style="margin-top: var(--space-3);">
              <div class="text-caption" style="margin-bottom: var(--space-1);">Drifting Intents (${driftItems.length})</div>
              <div style="max-height: 150px; overflow-y: auto;">
                ${driftItems.map(
                  (d) => html`
                  <div style="padding: var(--space-1) var(--space-2); border-bottom: 1px solid var(--color-border-subtle); font-size: var(--font-size-sm);">
                    <span style="font-weight: var(--font-weight-medium);">${String(d.intent)}</span>
                    <span style="color: ${String(d.direction) === "degrading" ? "var(--color-error)" : "var(--color-success)"};">${String(d.direction)}</span>
                    <span class="text-caption">${String(d.baseline_avg)} -> ${String(d.recent_avg)} (delta: ${String(d.delta)})</span>
                  </div>
                `,
                )}
              </div>
            </div>
          `
              : nothing
          }
          ${
            config
              ? html`
            <div class="text-caption" style="margin-top: var(--space-2);">
              Canary schedule: ${config.canary_schedule_enabled ? "enabled" : "disabled"} (${config.canary_count} canaries, every ${config.canary_interval_minutes}min)
            </div>
          `
              : nothing
          }
        </div>
      `
          : nothing
      }
    </section>
  `;
}

function renderEvaluationPipeline(props: TedViewProps): typeof nothing | ReturnType<typeof html> {
  const status = props.tedEvaluationStatus;
  const statusLoading = props.tedEvaluationStatusLoading ?? false;
  const statusError = props.tedEvaluationStatusError ?? "";
  const runBusy = props.tedEvaluationRunBusy ?? false;
  const runError = props.tedEvaluationRunError ?? "";

  const passCount = status ? Number(status.pass_count ?? 0) : 0;
  const failCount = status ? Number(status.fail_count ?? 0) : 0;
  const total = status ? Number(status.total ?? 0) : 0;
  const passRate = status ? Number(status.pass_rate ?? 0) : 0;
  const trend = status ? String((status.trend ?? "unknown") as string) : "unknown";
  const avg7day = status?.avg_7day_rate != null ? Number(status.avg_7day_rate) : null;
  const timestamp = status?.timestamp ? String(status.timestamp as string) : null;
  const results = Array.isArray(status?.results)
    ? (status.results as Array<Record<string, unknown>>)
    : [];
  const failures = results.filter((r) => r.status !== "pass");

  const trendIcon =
    trend === "improving" ? "^" : trend === "degrading" ? "v" : trend === "stable" ? "=" : "?";
  const trendColor =
    trend === "improving"
      ? "var(--color-success)"
      : trend === "degrading"
        ? "var(--color-error)"
        : "var(--color-text-secondary)";
  const rateColor =
    passRate >= 80
      ? "var(--color-success)"
      : passRate >= 60
        ? "var(--color-warning)"
        : "var(--color-error)";

  return html`
    <section class="card" style="margin-top: var(--space-4);">
      <div class="row" style="justify-content: space-between; align-items: center;">
        <div class="card-title">Evaluation Pipeline</div>
        <div class="row" style="gap: var(--space-2);">
          <button class="btn btn--sm" ?disabled=${statusLoading || runBusy} @click=${props.onLoadEvaluationStatus} aria-label="Refresh evaluation status">Refresh</button>
          <button class="btn btn--sm btn--primary" ?disabled=${runBusy || statusLoading} @click=${props.onTriggerEvaluationRun} aria-label="Run evaluation pipeline">
            ${runBusy ? "Running..." : "Run Now"}
          </button>
        </div>
      </div>
      ${statusError ? html`<div class="text-error" style="margin-top: var(--space-2);">${statusError}</div>` : nothing}
      ${runError ? html`<div class="text-error" style="margin-top: var(--space-2);">${runError}</div>` : nothing}
      ${
        statusLoading
          ? html`
              <div class="text-caption" style="margin-top: var(--space-2)">Loading...</div>
            `
          : nothing
      }
      ${
        !status && !statusLoading
          ? html`
              <div class="text-caption" style="margin-top: var(--space-2)">
                No evaluation data yet. Click "Run Now" to trigger the first run.
              </div>
            `
          : nothing
      }
      ${
        status
          ? html`
        <div style="margin-top: var(--space-3); display: grid; grid-template-columns: repeat(4, 1fr); gap: var(--space-3);">
          <div style="text-align: center;">
            <div class="text-caption">Pass Rate</div>
            <div style="font-size: var(--font-size-lg); font-weight: var(--font-weight-semibold); color: ${rateColor};">${passRate}%</div>
          </div>
          <div style="text-align: center;">
            <div class="text-caption">Pass / Fail</div>
            <div style="font-size: var(--font-size-md); font-weight: var(--font-weight-medium);">${passCount} / ${failCount}</div>
          </div>
          <div style="text-align: center;">
            <div class="text-caption">Trend</div>
            <div style="font-size: var(--font-size-md); font-weight: var(--font-weight-medium); color: ${trendColor};">${trendIcon} ${trend}</div>
          </div>
          <div style="text-align: center;">
            <div class="text-caption">7-Day Avg</div>
            <div style="font-size: var(--font-size-md); font-weight: var(--font-weight-medium);">${avg7day != null ? `${avg7day}%` : "\u2014"}</div>
          </div>
        </div>
        ${timestamp ? html`<div class="text-caption" style="margin-top: var(--space-2);">Last run: ${new Date(timestamp).toLocaleString()}</div>` : nothing}
        ${
          failures.length > 0
            ? html`
          <div style="margin-top: var(--space-3);">
            <div class="text-caption" style="margin-bottom: var(--space-1);">Failing Fixtures (${failures.length})</div>
            <div style="max-height: 200px; overflow-y: auto;">
              ${failures.map(
                (f) => html`
                <div style="padding: var(--space-1) var(--space-2); border-bottom: 1px solid var(--color-border-subtle); font-size: var(--font-size-sm);">
                  <span style="font-weight: var(--font-weight-medium); color: var(--color-error);">${String(f.fixture)}</span>
                  ${
                    Array.isArray(f.missing_sections) && (f.missing_sections as string[]).length > 0
                      ? html` <span class="text-caption">missing: ${(f.missing_sections as string[]).join(", ")}</span>`
                      : nothing
                  }
                  ${f.error ? html` <span class="text-caption">error: ${String(f.error as string)}</span>` : nothing}
                </div>
              `,
              )}
            </div>
          </div>
        `
            : html`
          <div class="text-caption" style="margin-top: var(--space-2); color: var(--color-success);">All ${total} fixtures passing.</div>
        `
        }
      `
          : nothing
      }
    </section>
  `;
}

function renderSelfHealingDashboard(props: TedViewProps): typeof nothing | ReturnType<typeof html> {
  const status = props.selfHealingStatus;
  const statusLoading = props.selfHealingStatusLoading ?? false;
  const statusError = props.selfHealingStatusError ?? "";
  const taxonomy = props.correctionTaxonomy;
  const taxonomyLoading = props.correctionTaxonomyLoading ?? false;
  const taxonomyError = props.correctionTaxonomyError ?? "";
  const insights = props.engagementInsights;
  const insightsLoading = props.engagementInsightsLoading ?? false;
  const insightsError = props.engagementInsightsError ?? "";
  const noise = props.noiseLevel;
  const noiseLoading = props.noiseLevelLoading ?? false;
  const noiseError = props.noiseLevelError ?? "";
  const autonomy = props.autonomyStatus;
  const autonomyLoading = props.autonomyStatusLoading ?? false;
  const autonomyError = props.autonomyStatusError ?? "";

  const anyLoading =
    statusLoading || taxonomyLoading || insightsLoading || noiseLoading || autonomyLoading;

  // Circuit breakers
  const circuitBreakers = Array.isArray(status?.["circuit_breakers"])
    ? (status["circuit_breakers"] as Record<string, unknown>[])
    : [];
  // Provider health
  const providerHealth = Array.isArray(status?.["provider_health"])
    ? (status["provider_health"] as Record<string, unknown>[])
    : [];
  // Config drift
  const configDriftRaw = status?.["config_drift"] ?? status?.["config_hashes"];
  const configDrift = Array.isArray(configDriftRaw)
    ? (configDriftRaw as Record<string, unknown>[])
    : [];

  // Noise level color
  const noiseLevelValue = (noise?.["level"] as number | null) ?? null;
  const noiseLevelColor = (level: number | null) => {
    if (level === null || level === undefined) {
      return "var(--color-text-secondary, #6b7280)";
    }
    if (level <= 1) {
      return "var(--color-success, #34d399)";
    }
    if (level <= 2) {
      return "var(--color-warning, #fbbf24)";
    }
    return "var(--color-error, #f87171)";
  };
  const noiseLevelLabel = (level: number | null) => {
    if (level === null || level === undefined) {
      return "Unknown";
    }
    if (level === 0) {
      return "Silent";
    }
    if (level === 1) {
      return "Low";
    }
    if (level === 2) {
      return "Moderate";
    }
    if (level === 3) {
      return "High";
    }
    if (level >= 4) {
      return "Critical";
    }
    return String(level);
  };

  // Autonomy per-task-type entries
  const autonomyRaw = autonomy?.["task_types"] ?? autonomy?.["tasks"];
  const autonomyEntries = Array.isArray(autonomyRaw)
    ? (autonomyRaw as Record<string, unknown>[])
    : [];

  // Correction taxonomy categories
  const taxonomyCategories = (taxonomy?.["categories"] ?? {}) as Record<string, unknown>;
  const taxonomyCategoryNames = Object.keys(taxonomyCategories);

  // Engagement insights per content type
  const engagementRaw = insights?.["content_types"] ?? insights?.["windows"];
  const engagementTypes = Array.isArray(engagementRaw)
    ? (engagementRaw as Record<string, unknown>[])
    : [];

  return html`
    <div class="card" style="margin-top: 16px; margin-bottom: 0;">
      <div class="row" style="justify-content: space-between; align-items: center;">
        <div class="card-title">Self-Healing Dashboard</div>
        <div style="display: flex; gap: 6px;">
          <button class="btn btn--sm" aria-label="Refresh all self-healing data" ?disabled=${anyLoading} @click=${() => {
            props.onFetchSelfHealingStatus?.();
            props.onFetchCorrectionTaxonomy?.();
            props.onFetchEngagementInsights?.();
            props.onFetchNoiseLevel?.();
            props.onFetchAutonomyStatus?.();
          }}>
            ${anyLoading ? "Loading..." : "Refresh All"}
          </button>
        </div>
      </div>

      ${statusError ? html`<div class="callout danger" style="margin-top: 8px;">${statusError}</div>` : nothing}
      ${taxonomyError ? html`<div class="callout danger" style="margin-top: 8px;">${taxonomyError}</div>` : nothing}
      ${insightsError ? html`<div class="callout danger" style="margin-top: 8px;">${insightsError}</div>` : nothing}
      ${noiseError ? html`<div class="callout danger" style="margin-top: 8px;">${noiseError}</div>` : nothing}
      ${autonomyError ? html`<div class="callout danger" style="margin-top: 8px;">${autonomyError}</div>` : nothing}

      <!-- Noise Level -->
      ${
        noise
          ? html`
        <div style="margin-top: 12px;">
          <div style="font-size: 13px; font-weight: 600; margin-bottom: 6px;">Noise Level</div>
          <div style="display: flex; align-items: center; gap: 12px; padding: 10px; background: var(--color-bg-secondary, #f9fafb); border-radius: 6px;">
            <div style="font-size: 28px; font-weight: 700; color: ${noiseLevelColor(noiseLevelValue)};">${noiseLevelValue ?? "?"}</div>
            <div>
              <div style="font-size: 14px; font-weight: 600; color: ${noiseLevelColor(noiseLevelValue)};">${noiseLevelLabel(noiseLevelValue)}</div>
              ${(noise?.["description"] ?? noise?.["level_label"]) ? html`<div class="muted" style="font-size: 11px; margin-top: 2px;">${toStr(noise["description"] ?? noise["level_label"])}</div>` : nothing}
            </div>
          </div>
        </div>
      `
          : !noiseLoading
            ? html`
                <div class="muted" style="margin-top: 10px; font-size: 12px">
                  Click "Refresh All" to load noise level.
                </div>
              `
            : nothing
      }

      <!-- Circuit Breakers -->
      ${
        circuitBreakers.length > 0
          ? html`
        <div style="margin-top: 12px;">
          <div style="font-size: 13px; font-weight: 600; margin-bottom: 6px;">Circuit Breakers (${circuitBreakers.length})</div>
          <div style="max-height: 200px; overflow-y: auto;">
            <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
              <thead>
                <tr style="border-bottom: 1px solid var(--color-border, #e5e7eb);">
                  <th style="text-align: left; padding: 4px 6px;">Workload Group</th>
                  <th style="text-align: left; padding: 4px 6px;">State</th>
                  <th style="text-align: right; padding: 4px 6px;">Failure Rate</th>
                  <th style="text-align: right; padding: 4px 6px;">Call Count</th>
                  <th style="text-align: right; padding: 4px 6px;">Cooldown (ms)</th>
                </tr>
              </thead>
              <tbody>
                ${circuitBreakers.map((cb) => {
                  const stateColor =
                    cb["state"] === "closed"
                      ? "var(--color-success, #34d399)"
                      : cb["state"] === "open"
                        ? "var(--color-error, #f87171)"
                        : "var(--color-warning, #fbbf24)";
                  return html`
                    <tr style="border-bottom: 1px solid var(--color-border-subtle, #eeedea);">
                      <td style="padding: 4px 6px;">${toStr(cb["workload_group"])}</td>
                      <td style="padding: 4px 6px; color: ${stateColor}; font-weight: 600;">${toStr(cb["state"])}</td>
                      <td style="padding: 4px 6px; text-align: right;">${cb["failure_rate"] != null ? `${((cb["failure_rate"] as number) * 100).toFixed(1)}%` : "—"}</td>
                      <td style="padding: 4px 6px; text-align: right;">${toStr(cb["call_count"])}</td>
                      <td style="padding: 4px 6px; text-align: right;">${toStr(cb["cooldown_ms"])}</td>
                    </tr>
                  `;
                })}
              </tbody>
            </table>
          </div>
        </div>
      `
          : status && circuitBreakers.length === 0
            ? html`
                <div class="muted" style="margin-top: 10px; font-size: 12px">No circuit breakers active.</div>
              `
            : nothing
      }

      <!-- Provider Health -->
      ${
        providerHealth.length > 0
          ? html`
        <div style="margin-top: 12px;">
          <div style="font-size: 13px; font-weight: 600; margin-bottom: 6px;">Provider Health (${providerHealth.length})</div>
          <div style="max-height: 200px; overflow-y: auto;">
            <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
              <thead>
                <tr style="border-bottom: 1px solid var(--color-border, #e5e7eb);">
                  <th style="text-align: left; padding: 4px 6px;">Provider</th>
                  <th style="text-align: right; padding: 4px 6px;">EWMA Latency (ms)</th>
                  <th style="text-align: right; padding: 4px 6px;">EWMA Success Rate</th>
                  <th style="text-align: right; padding: 4px 6px;">Composite Score</th>
                  <th style="text-align: left; padding: 4px 6px;">Circuit State</th>
                </tr>
              </thead>
              <tbody>
                ${providerHealth.map((ph) => {
                  const circuitColor =
                    ph["circuit_state"] === "closed"
                      ? "var(--color-success, #34d399)"
                      : ph["circuit_state"] === "open"
                        ? "var(--color-error, #f87171)"
                        : "var(--color-warning, #fbbf24)";
                  return html`
                    <tr style="border-bottom: 1px solid var(--color-border-subtle, #eeedea);">
                      <td style="padding: 4px 6px; font-weight: 500;">${toStr(ph["provider"])}</td>
                      <td style="padding: 4px 6px; text-align: right;">${ph["ewma_latency_ms"] != null ? Math.round(ph["ewma_latency_ms"] as number) : "—"}</td>
                      <td style="padding: 4px 6px; text-align: right;">${ph["ewma_success_rate"] != null ? `${((ph["ewma_success_rate"] as number) * 100).toFixed(1)}%` : "—"}</td>
                      <td style="padding: 4px 6px; text-align: right;">${ph["composite_score"] != null ? (ph["composite_score"] as number).toFixed(3) : "—"}</td>
                      <td style="padding: 4px 6px; color: ${circuitColor}; font-weight: 600;">${toStr(ph["circuit_state"])}</td>
                    </tr>
                  `;
                })}
              </tbody>
            </table>
          </div>
        </div>
      `
          : nothing
      }

      <!-- Config Drift -->
      ${
        configDrift.length > 0
          ? html`
        <div style="margin-top: 12px;">
          <div style="font-size: 13px; font-weight: 600; margin-bottom: 6px;">Config Drift (${configDrift.length} monitored files)</div>
          <div style="max-height: 150px; overflow-y: auto;">
            <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
              <thead>
                <tr style="border-bottom: 1px solid var(--color-border, #e5e7eb);">
                  <th style="text-align: left; padding: 4px 6px;">File</th>
                  <th style="text-align: left; padding: 4px 6px;">Status</th>
                  <th style="text-align: left; padding: 4px 6px;">Last Check</th>
                </tr>
              </thead>
              <tbody>
                ${configDrift.map((cd) => {
                  const driftOk = cd["drift_detected"] === false || cd["status"] === "clean";
                  const driftColor = driftOk
                    ? "var(--color-success, #34d399)"
                    : "var(--color-warning, #fbbf24)";
                  return html`
                    <tr style="border-bottom: 1px solid var(--color-border-subtle, #eeedea);">
                      <td style="padding: 4px 6px; font-family: monospace; font-size: 11px;">${toStr(cd["file"])}</td>
                      <td style="padding: 4px 6px; color: ${driftColor}; font-weight: 600;">${driftOk ? "clean" : "drift"}</td>
                      <td style="padding: 4px 6px;" class="muted">${toStr(cd["last_check"] ?? cd["last_checked"])}</td>
                    </tr>
                  `;
                })}
              </tbody>
            </table>
          </div>
        </div>
      `
          : nothing
      }

      <!-- Autonomy Status -->
      ${
        autonomyEntries.length > 0
          ? html`
        <div style="margin-top: 12px;">
          <div style="font-size: 13px; font-weight: 600; margin-bottom: 6px;">Autonomy Status (${autonomyEntries.length} task types)</div>
          <div style="max-height: 250px; overflow-y: auto;">
            <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
              <thead>
                <tr style="border-bottom: 1px solid var(--color-border, #e5e7eb);">
                  <th style="text-align: left; padding: 4px 6px;">Task Type</th>
                  <th style="text-align: left; padding: 4px 6px;">Level</th>
                  <th style="text-align: right; padding: 4px 6px;">Correction Rate</th>
                  <th style="text-align: right; padding: 4px 6px;">Engagement Rate</th>
                  <th style="text-align: left; padding: 4px 6px;">Eligible</th>
                </tr>
              </thead>
              <tbody>
                ${autonomyEntries.map((at) => {
                  const eligibleColor = at["eligible"]
                    ? "var(--color-success, #34d399)"
                    : "var(--color-text-secondary, #6b7280)";
                  return html`
                    <tr style="border-bottom: 1px solid var(--color-border-subtle, #eeedea);">
                      <td style="padding: 4px 6px;">${toStr(at["task_type"])}</td>
                      <td style="padding: 4px 6px; font-weight: 600;">${toStr(at["level"] ?? at["current_level"])}</td>
                      <td style="padding: 4px 6px; text-align: right;">${at["correction_rate"] != null ? `${((at["correction_rate"] as number) * 100).toFixed(1)}%` : "—"}</td>
                      <td style="padding: 4px 6px; text-align: right;">${at["engagement_rate"] != null ? `${((at["engagement_rate"] as number) * 100).toFixed(1)}%` : "—"}</td>
                      <td style="padding: 4px 6px; color: ${eligibleColor}; font-weight: 600;">${at["eligible"] ? "Yes" : "No"}</td>
                    </tr>
                  `;
                })}
              </tbody>
            </table>
          </div>
        </div>
      `
          : autonomy && autonomyEntries.length === 0
            ? html`
                <div class="muted" style="margin-top: 10px; font-size: 12px">No autonomy data available.</div>
              `
            : nothing
      }

      <!-- Correction Taxonomy -->
      ${
        taxonomyCategoryNames.length > 0
          ? html`
        <div style="margin-top: 12px;">
          <div style="font-size: 13px; font-weight: 600; margin-bottom: 6px;">Correction Taxonomy</div>
          <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 8px;">
            ${taxonomyCategoryNames.map((cat: string) => {
              const val = taxonomyCategories[cat] as Record<string, unknown> | number | undefined;
              const count = typeof val === "number" ? val : (val?.count ?? 0);
              const pct =
                typeof (val as Record<string, unknown> | undefined)?.percentage === "number"
                  ? ((val as Record<string, unknown>).percentage as number)
                  : null;
              const catColors: Record<string, string> = {
                tone: "var(--color-accent, #4385BE)",
                content: "var(--color-success, #34d399)",
                structure: "var(--color-warning, #fbbf24)",
                factual: "var(--color-error, #f87171)",
              };
              const bgColor = catColors[cat] ?? "var(--color-text-secondary, #6b7280)";
              return html`
                <div style="text-align: center; padding: 10px; background: var(--color-bg-secondary, #f9fafb); border-radius: 6px; border-top: 3px solid ${bgColor};">
                  <div class="muted" style="font-size: 10px; text-transform: uppercase;">${cat}</div>
                  <div style="font-size: 18px; font-weight: 700; margin-top: 2px;">${count}</div>
                  ${pct !== null ? html`<div class="muted" style="font-size: 10px;">${pct.toFixed(1)}%</div>` : nothing}
                </div>
              `;
            })}
          </div>
        </div>
      `
          : nothing
      }

      <!-- Engagement Insights -->
      ${
        engagementTypes.length > 0
          ? html`
        <div style="margin-top: 12px;">
          <div style="font-size: 13px; font-weight: 600; margin-bottom: 6px;">Engagement Insights</div>
          <div style="max-height: 200px; overflow-y: auto;">
            <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
              <thead>
                <tr style="border-bottom: 1px solid var(--color-border, #e5e7eb);">
                  <th style="text-align: left; padding: 4px 6px;">Content Type</th>
                  <th style="text-align: left; padding: 4px 6px;">Optimal Window</th>
                  <th style="text-align: right; padding: 4px 6px;">Avg Engagement</th>
                  <th style="text-align: right; padding: 4px 6px;">Sample Size</th>
                </tr>
              </thead>
              <tbody>
                ${engagementTypes.map(
                  (et) => html`
                  <tr style="border-bottom: 1px solid var(--color-border-subtle, #eeedea);">
                    <td style="padding: 4px 6px; font-weight: 500;">${toStr(et["content_type"])}</td>
                    <td style="padding: 4px 6px;">${toStr(et["optimal_window"] ?? et["optimal_hour"])}</td>
                    <td style="padding: 4px 6px; text-align: right;">${(et["avg_engagement"] ?? et["confidence"]) != null ? `${(((et["avg_engagement"] ?? et["confidence"]) as number) * 100).toFixed(1)}%` : "—"}</td>
                    <td style="padding: 4px 6px; text-align: right;">${toStr(et["sample_size"])}</td>
                  </tr>
                `,
                )}
              </tbody>
            </table>
          </div>
        </div>
      `
          : nothing
      }

      ${
        !status && !noise && !taxonomy && !insights && !autonomy && !anyLoading
          ? html`
              <div class="muted" style="margin-top: 10px">Click "Refresh All" to load self-healing overview.</div>
            `
          : nothing
      }
    </div>
  `;
}

function renderBuilderLaneDashboard(props: TedViewProps): typeof nothing | ReturnType<typeof html> {
  const status = props.tedBuilderLaneStatus;
  const statusLoading = props.tedBuilderLaneStatusLoading ?? false;
  const patterns = props.tedBuilderLanePatterns;
  const patternsLoading = props.tedBuilderLanePatternsLoading ?? false;
  const patternsError = props.tedBuilderLanePatternsError ?? "";
  const metrics = props.tedBuilderLaneMetrics;
  const metricsLoading = props.tedBuilderLaneMetricsLoading ?? false;
  const revertError = props.tedBuilderLaneRevertError ?? "";
  const revertResult = props.tedBuilderLaneRevertResult ?? "";
  const generateBusy = props.tedBuilderLaneGenerateBusy ?? false;
  const calibrationBusy = props.tedBuilderLaneCalibrationBusy ?? false;

  const statusRec = status;
  const phase = (statusRec?.phase as string) ?? "silent";
  const totalCorrections = (statusRec?.total_corrections as number) ?? 0;
  const patternsDetected = (statusRec?.patterns_detected as number) ?? 0;
  const proposalsPending = (statusRec?.proposals_pending as number) ?? 0;
  const proposalsApplied = (statusRec?.proposals_applied as number) ?? 0;

  const patternsRec = patterns;
  const patternList = Array.isArray(patternsRec?.patterns)
    ? (patternsRec.patterns as Record<string, unknown>[])
    : [];
  const metricsRec = metrics;
  const correctionRate = (metricsRec?.correction_rate_current as number) ?? 0;
  const acceptanceRate = metricsRec?.acceptance_rate as number | undefined;
  const monthlyData = Array.isArray(metricsRec?.monthly_summary)
    ? (metricsRec.monthly_summary as Record<string, unknown>[])
    : [];

  const phaseColor = (p: string) => {
    if (p === "silent" || p === "observation") {
      return "var(--color-text-secondary, #6b7280)";
    }
    if (p === "proposal") {
      return "var(--color-warning, #fbbf24)";
    }
    if (p === "auto_apply" || p === "mature") {
      return "var(--color-success, #34d399)";
    }
    return "var(--color-text-secondary, #6b7280)";
  };

  const confidenceBar = (value: number) => {
    const pct = Math.round(value * 100);
    const color =
      pct >= 80
        ? "var(--color-success, #34d399)"
        : pct >= 50
          ? "var(--color-warning, #fbbf24)"
          : "var(--color-error, #f87171)";
    return html`<div style="display: flex; align-items: center; gap: 6px;">
      <div style="flex: 1; height: 6px; background: var(--color-bg-tertiary, #e5e7eb); border-radius: 3px; overflow: hidden;">
        <div style="width: ${pct}%; height: 100%; background: ${color}; border-radius: 3px;"></div>
      </div>
      <span style="font-size: 11px; min-width: 35px;">${pct}%</span>
    </div>`;
  };

  return html`
    <div class="card" style="margin-top: 16px; margin-bottom: 0;">
      <div class="row" style="justify-content: space-between; align-items: center;">
        <div class="card-title">Builder Lane Dashboard</div>
        <div style="display: flex; gap: 6px;">
          <button class="btn btn--sm" aria-label="Load builder lane status" ?disabled=${statusLoading} @click=${() => props.onLoadBuilderLaneStatus?.()}>
            ${statusLoading ? "Loading..." : "Status"}
          </button>
          <button class="btn btn--sm" aria-label="Detect patterns" ?disabled=${patternsLoading} @click=${() => props.onLoadBuilderLanePatterns?.()}>
            ${patternsLoading ? "Detecting..." : "Detect Patterns"}
          </button>
          <button class="btn btn--sm" aria-label="Load improvement metrics" ?disabled=${metricsLoading} @click=${() => props.onLoadBuilderLaneMetrics?.()}>
            ${metricsLoading ? "Loading..." : "Metrics"}
          </button>
        </div>
      </div>

      ${revertError ? html`<div class="callout danger" style="margin-top: 8px;">${revertError}</div>` : nothing}
      ${revertResult ? html`<div class="callout" style="margin-top: 8px;">${revertResult}</div>` : nothing}
      ${patternsError ? html`<div class="callout danger" style="margin-top: 8px;">${patternsError}</div>` : nothing}

      <!-- Status Overview -->
      ${
        status
          ? html`
        <div style="margin-top: 12px; display: grid; grid-template-columns: repeat(5, 1fr); gap: 8px;">
          <div style="text-align: center; padding: 8px; background: var(--color-bg-secondary, #f9fafb); border-radius: 6px;">
            <div class="muted" style="font-size: 10px; text-transform: uppercase;">Phase</div>
            <div style="font-size: 14px; font-weight: 600; color: ${phaseColor(phase)};">${phase}</div>
          </div>
          <div style="text-align: center; padding: 8px; background: var(--color-bg-secondary, #f9fafb); border-radius: 6px;">
            <div class="muted" style="font-size: 10px; text-transform: uppercase;">Corrections</div>
            <div style="font-size: 14px; font-weight: 600;">${totalCorrections}</div>
          </div>
          <div style="text-align: center; padding: 8px; background: var(--color-bg-secondary, #f9fafb); border-radius: 6px;">
            <div class="muted" style="font-size: 10px; text-transform: uppercase;">Patterns</div>
            <div style="font-size: 14px; font-weight: 600;">${patternsDetected}</div>
          </div>
          <div style="text-align: center; padding: 8px; background: var(--color-bg-secondary, #f9fafb); border-radius: 6px;">
            <div class="muted" style="font-size: 10px; text-transform: uppercase;">Pending</div>
            <div style="font-size: 14px; font-weight: 600;">${proposalsPending}</div>
          </div>
          <div style="text-align: center; padding: 8px; background: var(--color-bg-secondary, #f9fafb); border-radius: 6px;">
            <div class="muted" style="font-size: 10px; text-transform: uppercase;">Applied</div>
            <div style="font-size: 14px; font-weight: 600;">${proposalsApplied}</div>
          </div>
        </div>
      `
          : html`
              <div class="muted" style="margin-top: 10px">Click "Status" to load Builder Lane overview.</div>
            `
      }

      <!-- Detected Patterns -->
      ${
        patternList.length > 0
          ? html`
        <div style="margin-top: 12px;">
          <div style="font-size: 13px; font-weight: 600; margin-bottom: 6px;">Detected Patterns (${patternList.length})</div>
          <div style="max-height: 300px; overflow-y: auto;">
            <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
              <thead>
                <tr style="border-bottom: 1px solid var(--color-border, #e5e7eb);">
                  <th style="text-align: left; padding: 4px 6px;">Dimension</th>
                  <th style="text-align: left; padding: 4px 6px;">Confidence</th>
                  <th style="text-align: left; padding: 4px 6px;">Signals</th>
                  <th style="text-align: left; padding: 4px 6px;">Fatigue</th>
                  <th style="text-align: left; padding: 4px 6px;">Actions</th>
                </tr>
              </thead>
              <tbody>
                ${patternList.map(
                  (p: Record<string, unknown>) => html`
                  <tr style="border-bottom: 1px solid var(--color-border-subtle, #f3f4f6);">
                    <td style="padding: 4px 6px;">
                      <div style="font-weight: 500;">${toStr(p["domain"])}</div>
                      <div class="muted" style="font-size: 10px;">${toStr(p["context_bucket"], "")}</div>
                    </td>
                    <td style="padding: 4px 6px; min-width: 100px;">${confidenceBar((p["confidence"] as number) ?? 0)}</td>
                    <td style="padding: 4px 6px; text-align: center;">${toStr(p["signal_count"], "0")}</td>
                    <td style="padding: 4px 6px;">
                      <span style="font-size: 11px; padding: 1px 6px; border-radius: 8px; background: ${p["fatigue_state"] === "healthy_learning" ? "var(--color-success-bg, #d1fae5)" : p["fatigue_state"] === "suspected_fatigue" ? "var(--color-warning-bg, #fef3c7)" : "var(--color-bg-secondary, #f3f4f6)"}; color: ${p["fatigue_state"] === "healthy_learning" ? "var(--color-success, #059669)" : p["fatigue_state"] === "suspected_fatigue" ? "var(--color-warning, #d97706)" : "var(--color-text-secondary, #6b7280)"};">
                        ${toStr(p["fatigue_state"])}
                      </span>
                    </td>
                    <td style="padding: 4px 6px;">
                      ${
                        (p["confidence"] as number) >= 0.5
                          ? html`
                        <button class="btn btn--sm" style="font-size: 11px; padding: 2px 8px;" aria-label="Generate proposal from pattern" ?disabled=${generateBusy} @click=${() => props.onGenerateFromPattern?.(p["domain"] as string, p["context_bucket"] as Record<string, unknown> | undefined)}>
                          ${generateBusy ? "..." : "Generate"}
                        </button>
                      `
                          : nothing
                      }
                    </td>
                  </tr>
                `,
                )}
              </tbody>
            </table>
          </div>
        </div>
      `
          : nothing
      }

      <!-- Improvement Metrics -->
      ${
        metrics
          ? html`
        <div style="margin-top: 12px;">
          <div style="font-size: 13px; font-weight: 600; margin-bottom: 6px;">Improvement Metrics</div>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 8px;">
            ${
              correctionRate != null
                ? html`
              <div style="padding: 8px; background: var(--color-bg-secondary, #f9fafb); border-radius: 6px;">
                <div class="muted" style="font-size: 10px; text-transform: uppercase;">Correction Rate Trend</div>
                <div style="font-size: 14px; font-weight: 600; color: ${correctionRate < 0 ? "var(--color-success, #34d399)" : "var(--color-warning, #fbbf24)"};">
                  ${correctionRate > 0 ? "+" : ""}${Number.isFinite(correctionRate) ? (correctionRate * 100).toFixed(1) : "0.0"}%
                </div>
                <div class="muted" style="font-size: 10px;">${correctionRate < 0 ? "Improving" : "Needs attention"}</div>
              </div>
            `
                : nothing
            }
            ${
              acceptanceRate != null
                ? html`
              <div style="padding: 8px; background: var(--color-bg-secondary, #f9fafb); border-radius: 6px;">
                <div class="muted" style="font-size: 10px; text-transform: uppercase;">Acceptance Rate</div>
                <div style="font-size: 14px; font-weight: 600;">${(acceptanceRate * 100).toFixed(1)}%</div>
              </div>
            `
                : nothing
            }
          </div>
          ${
            monthlyData.length > 0
              ? html`
            <details>
              <summary style="cursor: pointer; font-size: 11px; color: var(--color-text-muted, #6b7280);">Monthly Breakdown</summary>
              <div style="max-height: 200px; overflow-y: auto; margin-top: 4px;">
                <table style="width: 100%; border-collapse: collapse; font-size: 11px;">
                  <thead>
                    <tr style="border-bottom: 1px solid var(--color-border, #e5e7eb);">
                      <th style="text-align: left; padding: 3px 6px;">Month</th>
                      <th style="text-align: right; padding: 3px 6px;">Corrections</th>
                      <th style="text-align: right; padding: 3px 6px;">Proposals</th>
                      <th style="text-align: right; padding: 3px 6px;">Applied</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${monthlyData.map(
                      (m: Record<string, unknown>) => html`
                      <tr style="border-bottom: 1px solid var(--color-border-subtle, #f3f4f6);">
                        <td style="padding: 3px 6px;">${toStr(m.month)}</td>
                        <td style="padding: 3px 6px; text-align: right;">${toStr(m.corrections, "0")}</td>
                        <td style="padding: 3px 6px; text-align: right;">${toStr(m.proposals, "0")}</td>
                        <td style="padding: 3px 6px; text-align: right;">${toStr(m.applied, "0")}</td>
                      </tr>
                    `,
                    )}
                  </tbody>
                </table>
              </div>
            </details>
          `
              : nothing
          }
        </div>
      `
          : nothing
      }

      <!-- Calibration Quick-Response -->
      <details style="margin-top: 10px;">
        <summary style="cursor: pointer; font-size: 13px; font-weight: 500;">Calibration Response</summary>
        <div style="padding: 8px 0;">
          <div style="margin-bottom: 6px;">
            <label style="font-size: 12px; display: block; margin-bottom: 2px;">Dimension</label>
            <select id="ted-bl-cal-dim" class="input" style="width: 100%;">
              <option value="tone">Tone</option>
              <option value="structure">Structure</option>
              <option value="detail_level">Detail Level</option>
              <option value="formality">Formality</option>
              <option value="urgency_sensitivity">Urgency Sensitivity</option>
            </select>
          </div>
          <div style="margin-bottom: 6px;">
            <label style="font-size: 12px; display: block; margin-bottom: 2px;">Rating (1-5)</label>
            <input id="ted-bl-cal-rating" class="input" type="number" min="1" max="5" value="3" style="width: 100%;" />
          </div>
          <div style="margin-bottom: 6px;">
            <label style="font-size: 12px; display: block; margin-bottom: 2px;">Notes (optional)</label>
            <input id="ted-bl-cal-notes" class="input" type="text" placeholder="Brief feedback..." style="width: 100%;" />
          </div>
          <button class="btn btn--sm" ?disabled=${calibrationBusy} @click=${() => {
            const dimEl = document.getElementById("ted-bl-cal-dim") as HTMLSelectElement | null;
            const ratingEl = document.getElementById(
              "ted-bl-cal-rating",
            ) as HTMLInputElement | null;
            const notesEl = document.getElementById("ted-bl-cal-notes") as HTMLInputElement | null;
            if (!dimEl || !ratingEl) {
              return;
            }
            const rating = parseInt(ratingEl.value, 10);
            if (isNaN(rating) || rating < 1 || rating > 5) {
              return;
            }
            const promptId = `cal-ui-${Date.now()}`;
            const response = `${rating}/5${notesEl?.value ? " — " + notesEl.value : ""}`;
            props.onSubmitCalibrationResponse?.(promptId, response, dimEl.value);
          }}>
            ${calibrationBusy ? "Submitting..." : "Submit Calibration"}
          </button>
        </div>
      </details>
    </div>
  `;
}

function renderImprovementProposalsCard(
  props: TedViewProps,
): typeof nothing | ReturnType<typeof html> {
  const proposals = props.tedImprovementProposals ?? [];
  const loading = props.tedImprovementProposalsLoading ?? false;
  const error = props.tedImprovementProposalsError ?? "";
  const createBusy = props.tedImprovementCreateBusy ?? false;
  const createError = props.tedImprovementCreateError ?? "";
  const createResult = props.tedImprovementCreateResult ?? "";
  const reviewBusy = props.tedImprovementReviewBusy ?? false;
  const reviewError = props.tedImprovementReviewError ?? "";
  const reviewResult = props.tedImprovementReviewResult ?? "";
  const applyBusy = props.tedImprovementApplyBusy ?? false;
  const applyError = props.tedImprovementApplyError ?? "";
  const applyResult = props.tedImprovementApplyResult ?? "";
  const generateBusy = props.tedImprovementGenerateBusy ?? false;
  const generateError = props.tedImprovementGenerateError ?? "";
  const generateResult = props.tedImprovementGenerateResult ?? null;

  const statusColor = (s: string) => {
    if (s === "proposed") {
      return "var(--color-warning, #fbbf24)";
    }
    if (s === "approved") {
      return "var(--color-success, #34d399)";
    }
    if (s === "applied") {
      return "var(--color-info, #60a5fa)";
    }
    if (s === "rejected") {
      return "var(--color-danger, #f87171)";
    }
    return "var(--color-muted, #9ca3af)";
  };

  const handleCreateSubmit = () => {
    const title = (document.getElementById("ted-imp-title") as HTMLInputElement)?.value?.trim();
    const type = (document.getElementById("ted-imp-type") as HTMLSelectElement)?.value;
    const description = (
      document.getElementById("ted-imp-desc") as HTMLTextAreaElement
    )?.value?.trim();
    const errEl = document.getElementById("ted-imp-validation-error");
    if (!title || !description) {
      if (errEl) {
        errEl.textContent = "Title and description are required.";
        errEl.style.display = "block";
      }
      return;
    }
    if (errEl) {
      errEl.style.display = "none";
    }
    props.onCreateImprovementProposal?.({ title, type, description });
  };

  return html`
    <div class="card" style="margin-top: 16px; margin-bottom: 0;">
      <div class="row" style="justify-content: space-between; align-items: center;">
        <div class="card-title">Improvement Proposals (Builder Lane)</div>
        <div>
          <button class="btn btn--sm" style="margin-right: 4px;" aria-label="Generate improvement proposal from failures" ?disabled=${generateBusy} @click=${() => props.onGenerateImprovementProposal?.()}>
            ${generateBusy ? "Generating..." : "Generate from Failures"}
          </button>
          <button class="btn btn--sm" aria-label="Refresh improvement proposals" ?disabled=${loading} @click=${() => props.onLoadImprovementProposals?.()}>
            ${loading ? "Loading..." : "Refresh"}
          </button>
        </div>
      </div>
      ${error ? html`<div class="callout danger" style="margin-top: 8px;">${error}</div>` : nothing}
      ${createError ? html`<div class="callout danger" style="margin-top: 8px;">${createError}</div>` : nothing}
      ${createResult ? html`<div class="callout" style="margin-top: 8px;">${createResult}</div>` : nothing}
      ${reviewError ? html`<div class="callout danger" style="margin-top: 8px;">${reviewError}</div>` : nothing}
      ${reviewResult ? html`<div class="callout" style="margin-top: 8px;">${reviewResult}</div>` : nothing}
      ${applyError ? html`<div class="callout danger" style="margin-top: 8px;">${applyError}</div>` : nothing}
      ${applyResult ? html`<div class="callout" style="margin-top: 8px;">${applyResult}</div>` : nothing}
      ${generateError ? html`<div class="callout danger" style="margin-top: 8px;">${generateError}</div>` : nothing}
      ${
        generateResult
          ? html`
        <div class="callout" style="margin-top: 8px;">
          <strong>Generated Proposal (${generateResult.source || "unknown"}):</strong>
          <pre style="white-space: pre-wrap; font-size: 12px; margin-top: 4px; max-height: 200px; overflow-y: auto;">${generateResult.proposal_text || "No text generated"}</pre>
          <div class="muted" style="font-size: 11px; margin-top: 4px;">Failures analyzed: ${generateResult.evidence?.total_failures ?? 0} | Copy the text above into the Create form to submit as a proposal.</div>
        </div>
      `
          : nothing
      }

      <!-- Create Proposal Form -->
      <details style="margin-top: 10px;">
        <summary style="cursor: pointer; font-size: 13px; font-weight: 500;">Create New Proposal</summary>
        <div style="padding: 8px 0;">
          <div style="margin-bottom: 6px;">
            <label for="ted-imp-title" style="font-size: 12px; display: block; margin-bottom: 2px;">Title</label>
            <input id="ted-imp-title" class="input" type="text" placeholder="Brief title for the improvement" style="width: 100%;" />
          </div>
          <div style="margin-bottom: 6px;">
            <label for="ted-imp-type" style="font-size: 12px; display: block; margin-bottom: 2px;">Type</label>
            <select id="ted-imp-type" class="input" style="width: 100%;">
              <option value="contract_update">Contract Update</option>
              <option value="config_update">Config Update</option>
              <option value="new_validator">New Validator</option>
              <option value="route_enhancement">Route Enhancement</option>
            </select>
          </div>
          <div style="margin-bottom: 6px;">
            <label for="ted-imp-desc" style="font-size: 12px; display: block; margin-bottom: 2px;">Description</label>
            <textarea id="ted-imp-desc" class="input" rows="3" placeholder="Describe the problem and proposed change..." style="width: 100%; resize: vertical;"></textarea>
          </div>
          <div id="ted-imp-validation-error" class="callout danger" style="display:none; margin-bottom:6px; font-size:12px;"></div>
          <button class="btn btn--sm" aria-label="Submit improvement proposal" ?disabled=${createBusy} @click=${handleCreateSubmit}>
            ${createBusy ? "Creating..." : "Submit Proposal"}
          </button>
        </div>
      </details>

      <!-- Proposals Table -->
      ${
        proposals.length === 0 && !loading
          ? html`
              <div class="muted" style="margin-top: 10px">
                No improvement proposals yet. Use "Generate from Failures" or create one manually.
              </div>
            `
          : html`
          <div style="max-height: 400px; overflow-y: auto; margin-top: 10px;">
            <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
              <thead>
                <tr style="border-bottom: 1px solid var(--color-border, #e5e7eb);">
                  <th style="text-align: left; padding: 6px;">Title</th>
                  <th style="text-align: left; padding: 6px;">Type</th>
                  <th style="text-align: left; padding: 6px;">Status</th>
                  <th style="text-align: left; padding: 6px;">Source</th>
                  <th style="text-align: left; padding: 6px;">Actions</th>
                </tr>
              </thead>
              <tbody>
                ${proposals.map(
                  (p) => html`
                  <tr style="border-bottom: 1px solid var(--color-border-subtle, #f3f4f6);">
                    <td style="max-width: 280px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; padding: 6px;" title=${p.description || p.title}>${p.title}</td>
                    <td style="padding: 6px;"><span class="pill" style="font-size: 11px;">${p.type}</span></td>
                    <td style="padding: 6px;"><span style="background: ${statusColor(p.status)}; color: #fff; padding: 2px 8px; border-radius: 10px; font-size: 11px;">${p.status}</span></td>
                    <td style="padding: 6px; font-size: 11px;" class="muted">${p.source}</td>
                    <td style="padding: 6px;">
                      ${
                        p.status === "proposed"
                          ? html`
                        <button class="btn btn--sm" style="margin-right: 4px;" aria-label="Approve proposal" ?disabled=${reviewBusy} @click=${() => props.onReviewImprovementProposal?.(p.proposal_id, "approved")}>Approve</button>
                        <button class="btn btn--sm" aria-label="Reject proposal" ?disabled=${reviewBusy} @click=${() => props.onReviewImprovementProposal?.(p.proposal_id, "rejected")}>Reject</button>
                      `
                          : nothing
                      }
                      ${
                        p.status === "approved"
                          ? html`
                        <button class="btn btn--sm" aria-label="Apply approved proposal" ?disabled=${applyBusy} @click=${() => {
                          if (
                            confirm(
                              'Apply proposal "' + p.title + '"? This may modify config files.',
                            )
                          ) {
                            props.onApplyImprovementProposal?.(p.proposal_id);
                          }
                        }}>
                          ${applyBusy ? "Applying..." : "Apply"}
                        </button>
                      `
                          : nothing
                      }
                    </td>
                  </tr>
                  <!-- Expandable detail row -->
                  <tr>
                    <td colspan="5" style="padding: 0;">
                      <details style="padding: 4px 6px;">
                        <summary style="cursor: pointer; font-size: 11px; color: var(--color-text-muted, #6b7280);">Details</summary>
                        <div style="padding: 6px; font-size: 12px; background: var(--color-bg-subtle, #f9fafb); border-radius: 4px; margin-top: 4px;">
                          <div><strong>Description:</strong> ${p.description}</div>
                          ${p.evidence ? html`<div style="margin-top: 4px;"><strong>Evidence:</strong> ${p.evidence.failure_count} failures (rate: ${(p.evidence.failure_rate * 100).toFixed(1)}%) ${p.evidence.sample_failures?.length ? html`<br/>Samples: ${p.evidence.sample_failures.join(", ")}` : nothing}</div>` : nothing}
                          ${p.change_spec && Object.keys(p.change_spec).length > 0 ? html`<div style="margin-top: 4px;"><strong>Change spec:</strong> <pre style="font-size: 11px; white-space: pre-wrap; margin: 2px 0;">${JSON.stringify(p.change_spec, null, 2)}</pre></div>` : nothing}
                          <div style="margin-top: 4px;" class="muted">Created: ${p.created_at} ${p.reviewed_at ? "| Reviewed: " + p.reviewed_at : ""} ${p.applied_at ? "| Applied: " + p.applied_at : ""}</div>
                        </div>
                      </details>
                    </td>
                  </tr>
                `,
                )}
              </tbody>
            </table>
          </div>
        `
      }
    </div>
  `;
}

function renderTrustAutonomyCard(props: TedViewProps): typeof nothing | ReturnType<typeof html> {
  const evaluation = props.tedTrustAutonomy;
  const loading = props.tedTrustAutonomyLoading ?? false;
  const error = props.tedTrustAutonomyError ?? "";
  const aggr = props.tedFailureAggregation;
  const aggrLoading = props.tedFailureAggregationLoading ?? false;
  const aggrError = props.tedFailureAggregationError ?? "";

  const pctBar = (value: number, threshold: number) => {
    const pct = Math.round(value * 100);
    const color =
      value >= threshold
        ? "var(--color-success, #34d399)"
        : value >= threshold * 0.8
          ? "var(--color-warning, #fbbf24)"
          : "var(--color-error, #f87171)";
    return html`<div style="display: flex; align-items: center; gap: 6px;">
      <div style="flex: 1; height: 8px; background: var(--color-bg-tertiary, #e5e7eb); border-radius: 4px; overflow: hidden;">
        <div style="width: ${pct}%; height: 100%; background: ${color}; border-radius: 4px;"></div>
      </div>
      <span style="font-size: 12px; min-width: 40px;">${pct}%</span>
    </div>`;
  };

  return html`
    <div class="card" style="margin-top: 16px; margin-bottom: 0;">
      <div class="row" style="justify-content: space-between; align-items: center;">
        <div class="card-title">Trust & Autonomy</div>
        <div style="display: flex; gap: 6px;">
          <button class="btn btn--sm" aria-label="Evaluate autonomy level" ?disabled=${loading} @click=${() => props.onLoadTrustAutonomy()}>
            ${loading ? "Evaluating..." : "Evaluate Autonomy"}
          </button>
          <button class="btn btn--sm" aria-label="Analyze failure aggregation" ?disabled=${aggrLoading} @click=${() => props.onLoadFailureAggregation()}>
            ${aggrLoading ? "Analyzing..." : "Analyze Failures"}
          </button>
        </div>
      </div>
      ${error ? html`<div class="callout danger" style="margin-top: 8px;">${error}</div>` : nothing}
      ${
        evaluation
          ? html`
        <div style="margin-top: 12px;">
          <div class="row" style="gap: 16px; margin-bottom: 12px;">
            <div style="flex: 1;">
              <div class="muted" style="font-size: 11px; margin-bottom: 2px;">Current Level</div>
              <div style="font-size: 16px; font-weight: 600;">${evaluation.current_level}</div>
            </div>
            <div style="flex: 1;">
              <div class="muted" style="font-size: 11px; margin-bottom: 2px;">Promotion Eligible</div>
              <div style="font-size: 16px; font-weight: 600; color: ${evaluation.eligible_for_promotion ? "var(--color-success, #34d399)" : "var(--color-error, #f87171)"};">
                ${evaluation.eligible_for_promotion ? "Yes" : "No"}
              </div>
            </div>
          </div>
          <div style="margin-bottom: 8px;">
            <div class="muted" style="font-size: 11px; margin-bottom: 4px;">Validation Pass Rate (need ${(evaluation.promotion_threshold?.min_pass_rate ?? 0.9) * 100}%)</div>
            ${pctBar(evaluation.metrics.validation_pass_rate, evaluation.promotion_threshold?.min_pass_rate ?? 0.9)}
          </div>
          <div style="margin-bottom: 8px;">
            <div class="muted" style="font-size: 11px; margin-bottom: 4px;">Draft Approval Rate (need ${(evaluation.promotion_threshold?.min_draft_approval_rate ?? 0.85) * 100}%)</div>
            ${pctBar(evaluation.metrics.draft_approval_rate, evaluation.promotion_threshold?.min_draft_approval_rate ?? 0.85)}
          </div>
          <div class="row" style="gap: 16px; margin-bottom: 8px;">
            <div><span class="muted" style="font-size: 11px;">Validations:</span> <strong>${evaluation.metrics.total_validations}</strong></div>
            <div><span class="muted" style="font-size: 11px;">Consecutive Passes:</span> <strong>${evaluation.metrics.consecutive_passes}</strong></div>
            <div><span class="muted" style="font-size: 11px;">Drafts Approved:</span> <strong>${evaluation.metrics.total_drafts_approved}</strong></div>
          </div>
          <div style="padding: 8px; background: var(--color-bg-secondary, #f9fafb); border-radius: 6px; font-size: 12px;">${evaluation.recommendation}</div>
        </div>
      `
          : html`
              <div class="muted" style="margin-top: 10px">
                Click "Evaluate Autonomy" to check trust metrics and promotion eligibility.
              </div>
            `
      }
      ${aggrError ? html`<div class="callout danger" style="margin-top: 8px;">${aggrError}</div>` : nothing}
      ${
        aggr
          ? html`
        <div style="margin-top: 12px;">
          <div style="font-size: 13px; font-weight: 600; margin-bottom: 6px;">Failure Analysis (${aggr.aggregation?.total_failures ?? 0} failures)</div>
          ${
            aggr.aggregation?.top_missing_sections?.length
              ? html`
            <div class="muted" style="font-size: 11px; margin-bottom: 4px;">Top Missing Sections: ${aggr.aggregation.top_missing_sections.join(", ")}</div>
          `
              : nothing
          }
          ${
            aggr.aggregation?.top_banned_phrases?.length
              ? html`
            <div class="muted" style="font-size: 11px; margin-bottom: 4px;">Top Banned Phrases: ${aggr.aggregation.top_banned_phrases.join(", ")}</div>
          `
              : nothing
          }
          <div style="padding: 6px; background: var(--color-bg-secondary, #f9fafb); border-radius: 6px; font-size: 12px;">${aggr.aggregation?.recommendation ?? ""}</div>
        </div>
      `
          : nothing
      }
    </div>
  `;
}

function renderIngestionStatusCard(props: TedViewProps): typeof nothing | ReturnType<typeof html> {
  const status = props.ingestionStatus;
  const loading = props.ingestionStatusLoading ?? false;
  const error = props.ingestionStatusError ?? null;
  const runBusy = props.ingestionRunBusy ?? false;
  const runError = props.ingestionRunError ?? null;
  const runResult = props.ingestionRunResult;
  const profiles = (status?.profiles ?? []) as Array<{
    profile_id: string;
    messages_ingested: number;
    last_cycle?: string;
  }>;
  const lastCycle = (status?.last_cycle as string | undefined) ?? null;

  return html`
    <div class="card" style="margin-top: 16px; margin-bottom: 0;">
      <div class="row" style="justify-content: space-between; align-items: center;">
        <div class="card-title">Ingestion Status</div>
        <div style="display: flex; gap: 6px;">
          <button class="btn btn--sm" aria-label="Load ingestion status" ?disabled=${loading} @click=${() => props.onLoadIngestionStatus?.()}>
            ${loading ? "Loading..." : "Refresh"}
          </button>
          <button class="btn btn--sm" aria-label="Run ingestion now" ?disabled=${runBusy} @click=${() => props.onTriggerIngestion?.()}>
            ${runBusy ? "Running..." : "Run Ingestion Now"}
          </button>
        </div>
      </div>
      <div class="card-sub">Messages ingested per profile and last cycle timestamp.</div>
      ${error ? html`<div class="callout danger" style="margin-top: 8px;">${error}</div>` : nothing}
      ${runError ? html`<div class="callout danger" style="margin-top: 8px;">${runError}</div>` : nothing}
      ${lastCycle ? html`<div class="muted" style="margin-top: 8px; font-size: 12px;">Last cycle: <span class="mono">${lastCycle}</span></div>` : nothing}
      ${
        profiles.length > 0
          ? html`
        <div class="list" style="margin-top: 10px;">
          ${profiles.map(
            (p) => html`
            <div class="list-item">
              <div class="list-main">
                <div class="list-title">${p.profile_id}</div>
                <div class="list-sub">Messages ingested: <strong>${p.messages_ingested}</strong>${p.last_cycle ? html` | Last: <span class="mono">${p.last_cycle}</span>` : nothing}</div>
              </div>
            </div>
          `,
          )}
        </div>
      `
          : status
            ? html`
                <div class="muted" style="margin-top: 10px">No ingestion data available yet.</div>
              `
            : html`
                <div class="muted" style="margin-top: 10px">Click "Refresh" to load ingestion status.</div>
              `
      }
      ${runResult && !runBusy ? html`<div style="margin-top: 8px; padding: 8px; background: var(--color-bg-secondary, #f9fafb); border-radius: 6px; font-size: 12px;"><pre class="mono" style="white-space: pre-wrap; margin: 0;">${JSON.stringify(runResult, null, 2)}</pre></div>` : nothing}
    </div>
  `;
}

function renderDiscoveryStatusCard(props: TedViewProps): typeof nothing | ReturnType<typeof html> {
  const status = props.discoveryStatus;
  const loading = props.discoveryStatusLoading ?? false;
  const error = props.discoveryStatusError ?? null;
  const runBusy = props.discoveryRunBusy ?? false;
  const runError = props.discoveryRunError ?? null;
  const runResult = props.discoveryRunResult;
  const profiles = (status?.profiles ?? []) as Array<{
    profile_id: string;
    emails_scanned?: number;
    events_found?: number;
    deal_candidates?: number;
    commitment_candidates?: number;
    last_run?: string;
  }>;

  return html`
    <div class="card" style="margin-top: 16px; margin-bottom: 0;">
      <div class="row" style="justify-content: space-between; align-items: center;">
        <div class="card-title">Discovery Status</div>
        <button class="btn btn--sm" aria-label="Load discovery status" ?disabled=${loading} @click=${() => props.onLoadDiscoveryStatus?.()}>
          ${loading ? "Loading..." : "Refresh"}
        </button>
      </div>
      <div class="card-sub">Discovery results per profile: emails scanned, events found, deal and commitment candidates.</div>
      ${error ? html`<div class="callout danger" style="margin-top: 8px;">${error}</div>` : nothing}
      ${runError ? html`<div class="callout danger" style="margin-top: 8px;">${runError}</div>` : nothing}
      ${
        profiles.length > 0
          ? html`
        <div class="list" style="margin-top: 10px;">
          ${profiles.map(
            (p) => html`
            <div class="list-item">
              <div class="list-main">
                <div class="list-title">${p.profile_id}</div>
                <div class="list-sub">
                  Emails scanned: <strong>${p.emails_scanned ?? 0}</strong> |
                  Events found: <strong>${p.events_found ?? 0}</strong> |
                  Deal candidates: <strong>${p.deal_candidates ?? 0}</strong> |
                  Commitment candidates: <strong>${p.commitment_candidates ?? 0}</strong>
                </div>
                ${p.last_run ? html`<div class="muted" style="font-size: 11px;">Last run: <span class="mono">${p.last_run}</span></div>` : nothing}
              </div>
              <div class="list-meta">
                <button class="btn btn--sm ghost" aria-label="Run discovery for ${p.profile_id}" ?disabled=${runBusy} @click=${() => props.onTriggerDiscovery?.(p.profile_id)}>
                  ${runBusy ? "Running..." : "Run Discovery"}
                </button>
              </div>
            </div>
          `,
          )}
        </div>
      `
          : status
            ? html`
        <div style="margin-top: 10px;">
          <div class="muted">No discovery data available yet. Run discovery for a profile to scan emails and identify candidates.</div>
          <div style="margin-top: 8px; display: flex; gap: 6px;">
            <button class="btn btn--sm ghost" ?disabled=${runBusy} @click=${() => props.onTriggerDiscovery?.("olumie")}>
              ${runBusy ? "Running..." : "Discover olumie"}
            </button>
            <button class="btn btn--sm ghost" ?disabled=${runBusy} @click=${() => props.onTriggerDiscovery?.("everest")}>
              ${runBusy ? "Running..." : "Discover everest"}
            </button>
          </div>
        </div>
      `
            : html`
        <div style="margin-top: 10px;">
          <div class="muted">Click "Refresh" to load discovery status, or run discovery for a profile.</div>
          <div style="margin-top: 8px; display: flex; gap: 6px;">
            <button class="btn btn--sm ghost" ?disabled=${runBusy} @click=${() => props.onTriggerDiscovery?.("olumie")}>
              ${runBusy ? "Running..." : "Discover olumie"}
            </button>
            <button class="btn btn--sm ghost" ?disabled=${runBusy} @click=${() => props.onTriggerDiscovery?.("everest")}>
              ${runBusy ? "Running..." : "Discover everest"}
            </button>
          </div>
        </div>
      `
      }
      ${runResult && !runBusy ? html`<div style="margin-top: 8px; padding: 8px; background: var(--color-bg-secondary, #f9fafb); border-radius: 6px; font-size: 12px;"><pre class="mono" style="white-space: pre-wrap; margin: 0;">${JSON.stringify(runResult, null, 2)}</pre></div>` : nothing}
    </div>
  `;
}

export function renderTed(props: TedViewProps) {
  const snapshot = props.snapshot;
  const healthTone = snapshot?.sidecar.healthy ? "ok" : "warn";
  const healthText = snapshot?.sidecar.healthy ? "Healthy" : "Unhealthy";
  const section = props.activeSection;
  const showOperate = section === "all" || section === "operate";
  const showBuild = section === "all" || section === "build";
  const showGovern = section === "all" || section === "govern";
  const showIntake = section === "all" || section === "intake";
  const showEvals = section === "all" || section === "evals";
  const focus = sectionFocus(section);
  const familyCounts = snapshot
    ? snapshot.job_cards.cards.reduce<Record<string, number>>((acc, card) => {
        acc[card.family] = (acc[card.family] ?? 0) + 1;
        return acc;
      }, {})
    : {};
  const detailConfidence =
    snapshot && props.jobCardDetail
      ? snapshot.job_cards.cards.find((card) => card.id === props.jobCardDetail?.id)
          ?.promotion_confidence
      : null;

  return html`
    <style>
      :host {
        /* Colors — Grounded Sophistication palette */
        --color-accent: #4385BE;
        --color-accent-hover: #3A76AA;
        --color-success: #7A8B3D;
        --color-warning: #C9A035;
        --color-error: #C45C5C;
        --color-text-primary: #2C2C2C;
        --color-text-secondary: #6B6B6B;
        --color-text-caption: #8C8C8C;
        --color-bg-primary: #FFFFFF;
        --color-bg-secondary: #F8F7F5;
        --color-bg-tertiary: #F0EEEB;
        --color-border: #E5E3DF;
        --color-border-subtle: #EEEDEA;
        --color-divider: #F0EEEB;

        /* Typography */
        --font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
        --font-size-xs: 11px;
        --font-size-sm: 13px;
        --font-size-base: 15px;
        --font-size-md: 17px;
        --font-size-lg: 20px;
        --font-size-xl: 24px;
        --font-weight-normal: 400;
        --font-weight-medium: 500;
        --font-weight-semibold: 600;

        /* Spacing — 4px grid */
        --space-1: 4px;
        --space-2: 8px;
        --space-3: 12px;
        --space-4: 16px;
        --space-5: 20px;
        --space-6: 24px;
        --space-8: 32px;
        --space-10: 40px;
        --space-12: 48px;

        /* Component dimensions */
        --button-height: 36px;
        --input-height: 36px;
        --border-radius: 6px;
        --border-radius-sm: 4px;
        --border-radius-pill: 100px;

        /* Motion */
        --transition-fast: 150ms ease-out;
      }
    </style>
    <section class="card">
      <div class="row" style="justify-content: space-between;">
        <div>
          <div class="card-title">Ted Operations Console</div>
          <div class="card-sub">
            Run today’s work, review decisions, and keep operations safe.
          </div>
        </div>
        <button class="btn" aria-label="Refresh operations console" ?disabled=${props.loading} @click=${props.onRefresh}>
          ${props.loading ? "Refreshing…" : "Refresh"}
        </button>
      </div>

      ${
        props.error
          ? html`<div class="callout danger" style="margin-top: 12px;">${props.error}</div>`
          : nothing
      }

      <div class="row" role="tablist" aria-label="Workbench sections" style="gap: 8px; flex-wrap: wrap; margin-top: 12px;">
        ${(["all", "operate", "build", "govern", "intake", "evals"] as TedWorkbenchSection[]).map(
          (candidate) => html`
            <button
              role="tab"
              class="btn btn--sm ${props.activeSection === candidate ? "active" : ""}"
              aria-label=${`Switch to ${labelForSection(candidate)} view`}
              aria-selected=${props.activeSection === candidate ? "true" : "false"}
              title=${`Switch to ${labelForSection(candidate)} view`}
              @click=${() => props.onSetSection(candidate)}
            >
              ${labelForSection(candidate)}
            </button>
          `,
        )}
      </div>

      <div class="card" style="margin-top: 16px; margin-bottom: 0;">
        <div class="card-title">${focus.title}</div>
        <div class="card-sub">${focus.subtitle}</div>
      </div>

      ${
        snapshot
          ? html`
              <div class="stat-grid" style="margin-top: 14px;">
                <div class="stat">
                  <div class="stat-label">Sidecar</div>
                  <div class="stat-value ${healthTone}">${healthText}</div>
                </div>
                <div class="stat">
                  <div class="stat-label">Job Cards Total</div>
                  <div class="stat-value">${snapshot.job_cards.total}</div>
                </div>
                <div class="stat">
                  <div class="stat-label">Done</div>
                  <div class="stat-value ok">${snapshot.job_cards.done}</div>
                </div>
                <div class="stat">
                  <div class="stat-label">Blocked</div>
                  <div class="stat-value ${snapshot.job_cards.blocked > 0 ? "warn" : "ok"}">
                    ${snapshot.job_cards.blocked}
                  </div>
                </div>
              </div>

              ${
                showOperate
                  ? html`<div class="card" style="margin-top: 16px; margin-bottom: 0;">
                      <div class="row" style="justify-content: space-between; align-items: baseline;">
                        <div class="card-title">Inbox</div>
                        <button
                          class="btn ghost btn--sm"
                          aria-label="Refresh inbox"
                          ?disabled=${props.mailLoading}
                          @click=${() => props.onLoadMail()}
                        >
                          ${props.mailLoading ? "Loading..." : "Refresh Inbox"}
                        </button>
                      </div>
                      <div class="card-sub">Recent messages from your Outlook inbox.</div>
                      ${
                        props.mailError
                          ? html`<div class="callout danger" style="margin-top: 10px;">${props.mailError}</div>`
                          : nothing
                      }
                      ${
                        props.mailMessages.length === 0 && !props.mailLoading && !props.mailError
                          ? html`
                              <div class="muted" style="margin-top: 10px">
                                No messages loaded. Click "Refresh Inbox" to fetch your latest messages.
                              </div>
                            `
                          : nothing
                      }
                      ${
                        props.mailMessages.length > 0
                          ? html`<div class="list" style="margin-top: 10px;">
                              ${props.mailMessages.map(
                                (msg) => html`<div class="list-item">
                                  <div class="list-main">
                                    <div class="list-title" style="max-width: 280px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; ${msg.is_read ? "" : "font-weight: 700;"}" title=${msg.subject || "(no subject)"}>
                                      ${msg.is_read ? "" : "● "}${msg.subject || "(no subject)"}
                                    </div>
                                    <div class="list-sub">
                                      ${msg.from.name || msg.from.address}${msg.has_attachments ? " 📎" : ""}
                                    </div>
                                    <div class="list-sub mono" style="margin-top: 4px; max-height: 40px; overflow: hidden;">
                                      ${msg.preview}
                                    </div>
                                  </div>
                                  <div class="list-meta">
                                    <span class="pill ${msg.importance === "high" ? "danger" : ""}">${msg.importance === "high" ? "High" : ""}</span>
                                    <div class="muted mono" style="margin-top: 4px;">
                                      ${msg.received_at ? new Date(msg.received_at).toLocaleString() : ""}
                                    </div>
                                  </div>
                                </div>`,
                              )}
                            </div>`
                          : nothing
                      }
                    </div>`
                  : nothing
              }

              ${
                showOperate
                  ? html`<div class="grid grid-cols-2" style="margin-top: 16px;">
                      <div class="card" style="margin: 0;">
                        <div class="row" style="justify-content: space-between; align-items: baseline;">
                          <div class="card-title">Morning Brief</div>
                          <button
                            class="btn ghost btn--sm"
                            aria-label="Generate morning brief"
                            ?disabled=${props.morningBriefLoading}
                            @click=${() => props.onLoadMorningBrief()}
                          >
                            ${props.morningBriefLoading ? "Generating..." : "Generate"}
                          </button>
                        </div>
                        <div class="card-sub">Aggregated snapshot of today's priorities.</div>
                        ${
                          props.morningBriefError
                            ? html`<div class="callout danger" style="margin-top: 10px;">${props.morningBriefError}</div>`
                            : nothing
                        }
                        ${
                          props.morningBrief
                            ? html`
                                <div class="callout" style="margin-top: 10px; font-weight: 500;">${props.morningBrief.headline}</div>
                                <div class="stat-grid" style="margin-top: 10px;">
                                  <div class="stat">
                                    <div class="stat-label">Triage Open</div>
                                    <div class="stat-value ${props.morningBrief.detail.triage_open > 0 ? "warn" : "ok"}">
                                      ${props.morningBrief.detail.triage_open}
                                    </div>
                                  </div>
                                  <div class="stat">
                                    <div class="stat-label">Active Deals</div>
                                    <div class="stat-value">${props.morningBrief.detail.deals_active}</div>
                                  </div>
                                  <div class="stat">
                                    <div class="stat-label">Filing Pending</div>
                                    <div class="stat-value ${props.morningBrief.detail.filing_pending_count > 0 ? "warn" : ""}">
                                      ${props.morningBrief.detail.filing_pending_count}
                                    </div>
                                  </div>
                                </div>
                                ${
                                  props.morningBrief.detail.automation_paused
                                    ? html`
                                        <div class="callout warn" style="margin-top: 10px">Automation is paused.</div>
                                      `
                                    : nothing
                                }
                                ${
                                  props.morningBrief.deals_summary &&
                                  props.morningBrief.deals_summary.length > 0
                                    ? html`<div style="margin-top: 10px;">
                                        <div class="card-sub">Active Deals</div>
                                        <div class="list" style="margin-top: 6px;">
                                          ${props.morningBrief.deals_summary.map(
                                            (deal: {
                                              deal_id: string | null;
                                              deal_name?: string;
                                              status?: string;
                                            }) => html`<div class="list-item">
                                              <div class="list-main">
                                                <div class="list-title">${deal.deal_name ?? "Untitled"}</div>
                                              </div>
                                              <div class="list-meta">
                                                <span class="pill">${deal.status ?? "unknown"}</span>
                                              </div>
                                            </div>`,
                                          )}
                                        </div>
                                      </div>`
                                    : nothing
                                }
                                ${
                                  props.morningBrief.recent_activity &&
                                  props.morningBrief.recent_activity.length > 0
                                    ? html`<div style="margin-top: 10px;">
                                        <div class="card-sub">Recent Activity</div>
                                        <div class="list" style="margin-top: 6px;">
                                          ${props.morningBrief.recent_activity.map(
                                            (act: {
                                              action: string;
                                              at: string | null;
                                              summary: string | null;
                                            }) => html`<div class="list-item">
                                              <div class="list-main">
                                                <div class="list-title">${act.action}</div>
                                                <div class="list-sub">${act.summary ?? ""}</div>
                                              </div>
                                              <div class="list-meta mono">${act.at ? new Date(act.at).toLocaleTimeString() : ""}</div>
                                            </div>`,
                                          )}
                                        </div>
                                      </div>`
                                    : nothing
                                }
                                ${
                                  props.morningBrief.recommendations.length > 0
                                    ? html`<div style="margin-top: 10px;">
                                        <div class="card-sub">Recommendations</div>
                                        <div class="list" style="margin-top: 6px;">
                                          ${props.morningBrief.recommendations.map(
                                            (rec) => html`<div class="list-item">
                                              <div class="list-main">
                                                <div class="list-sub">${rec}</div>
                                              </div>
                                            </div>`,
                                          )}
                                        </div>
                                      </div>`
                                    : nothing
                                }
                                <div class="muted mono" style="margin-top: 8px;">
                                  Generated: ${new Date(props.morningBrief.generated_at).toLocaleString()}
                                </div>
                              `
                            : html`
                                <div class="muted" style="margin-top: 10px">Click "Generate" to create today's morning brief.</div>
                              `
                        }
                      </div>

                      <div class="card" style="margin: 0;">
                        <div class="row" style="justify-content: space-between; align-items: baseline;">
                          <div class="card-title">End-of-Day Digest</div>
                          <button
                            class="btn ghost btn--sm"
                            aria-label="Generate end-of-day digest"
                            ?disabled=${props.eodDigestLoading}
                            @click=${() => props.onLoadEodDigest()}
                          >
                            ${props.eodDigestLoading ? "Generating..." : "Generate"}
                          </button>
                        </div>
                        <div class="card-sub">Summary of today's activity and unresolved items.</div>
                        ${
                          props.eodDigestError
                            ? html`<div class="callout danger" style="margin-top: 10px;">${props.eodDigestError}</div>`
                            : nothing
                        }
                        ${
                          props.eodDigest
                            ? html`
                                <div class="callout" style="margin-top: 10px; font-weight: 500;">${props.eodDigest.headline}</div>
                                <div class="stat-grid" style="margin-top: 10px;">
                                  <div class="stat">
                                    <div class="stat-label">Actions Today</div>
                                    <div class="stat-value">${props.eodDigest.detail.actions_count}</div>
                                  </div>
                                  <div class="stat">
                                    <div class="stat-label">Approvals</div>
                                    <div class="stat-value ok">${props.eodDigest.detail.approvals_count}</div>
                                  </div>
                                  <div class="stat">
                                    <div class="stat-label">Blocks</div>
                                    <div class="stat-value ${props.eodDigest.detail.blocks_count > 0 ? "danger" : ""}">
                                      ${props.eodDigest.detail.blocks_count}
                                    </div>
                                  </div>
                                </div>
                                <div class="stat-grid" style="margin-top: 8px;">
                                  <div class="stat">
                                    <div class="stat-label">Triage Resolved</div>
                                    <div class="stat-value ok">${props.eodDigest.detail.triage_resolved}</div>
                                  </div>
                                  <div class="stat">
                                    <div class="stat-label">Still Open</div>
                                    <div class="stat-value ${props.eodDigest.detail.triage_still_open > 0 ? "warn" : ""}">
                                      ${props.eodDigest.detail.triage_still_open}
                                    </div>
                                  </div>
                                  <div class="stat">
                                    <div class="stat-label">Filing Pending</div>
                                    <div class="stat-value ${props.eodDigest.detail.filing_pending > 0 ? "warn" : ""}">
                                      ${props.eodDigest.detail.filing_pending}
                                    </div>
                                  </div>
                                </div>
                                ${
                                  props.eodDigest.activity_log.length > 0
                                    ? html`<div class="list" style="margin-top: 10px;">
                                        ${props.eodDigest.activity_log.slice(0, 8).map(
                                          (entry) => html`<div class="list-item">
                                            <div class="list-main">
                                              <div class="list-title mono">${entry.action}</div>
                                            </div>
                                            <div class="list-meta">${entry.count}x</div>
                                          </div>`,
                                        )}
                                      </div>`
                                    : nothing
                                }
                                ${
                                  props.eodDigest.unresolved.length > 0
                                    ? html`<div class="callout warn" style="margin-top: 10px;">
                                        ${props.eodDigest.unresolved.map(
                                          (u) =>
                                            html`<div>${u.count} unresolved ${u.type} item${u.count === 1 ? "" : "s"}</div>`,
                                        )}
                                      </div>`
                                    : nothing
                                }
                                <div class="muted mono" style="margin-top: 8px;">
                                  Date: ${props.eodDigest.date} | Generated: ${new Date(props.eodDigest.generated_at).toLocaleString()}
                                </div>
                              `
                            : html`
                                <div class="muted" style="margin-top: 10px">
                                  Click "Generate" to create today's end-of-day digest.
                                </div>
                              `
                        }
                      </div>
                    </div>`
                  : nothing
              }

              ${
                showOperate
                  ? html`<div class="grid grid-cols-2" style="margin-top: 16px;">
                <div class="card" style="margin: 0;">
                  <div class="card-title">Daily Friction Limits</div>
                  <div class="list" style="margin-top: 10px;">
                    <div class="list-item"><div class="list-main"><div class="list-title">Manual work per day</div></div><div class="list-meta mono"><= ${snapshot.friction_kpis.manual_minutes_per_day_max}m</div></div>
                    <div class="list-item"><div class="list-main"><div class="list-title">Oldest pending decision</div></div><div class="list-meta mono"><= ${snapshot.friction_kpis.approval_queue_oldest_minutes_max}m</div></div>
                    <div class="list-item"><div class="list-main"><div class="list-title">Unresolved triage at EOD</div></div><div class="list-meta mono"><= ${snapshot.friction_kpis.unresolved_triage_eod_max}</div></div>
                    <div class="list-item"><div class="list-main"><div class="list-title">Blocked items without reason</div></div><div class="list-meta mono">${snapshot.friction_kpis.blocked_actions_missing_explainability_max}</div></div>
                  </div>
                </div>

                <div class="card" style="margin: 0;">
                  <div class="card-title">Source Documents</div>
                  <div class="muted" style="margin-top: 6px;">
                    Job cards source:
                    <span class="mono"
                      >${snapshot.data_sources.job_cards_dir ?? "not discovered"}</span
                    >
                  </div>
                  <div class="list" style="margin-top: 10px;">
                    <div class="list-item">
                      <div class="list-main"><div class="list-title">Job Board</div></div>
                      <div class="list-meta">
                        <div class="mono">${snapshot.references.job_board}</div>
                        <button class="btn ghost mono" style="margin-top: 6px;" aria-label="Open job board document" @click=${() => props.onOpenSourceDoc("job_board")}>Open</button>
                      </div>
                    </div>
                    <div class="list-item">
                      <div class="list-main"><div class="list-title">Promotion Policy</div></div>
                      <div class="list-meta">
                        <div class="mono">${snapshot.references.promotion_policy}</div>
                        <button class="btn ghost mono" style="margin-top: 6px;" aria-label="Open promotion policy document" @click=${() => props.onOpenSourceDoc("promotion_policy")}>Open</button>
                      </div>
                    </div>
                    <div class="list-item">
                      <div class="list-main"><div class="list-title">Value and Friction Gates</div></div>
                      <div class="list-meta">
                        <div class="mono">${snapshot.references.value_friction}</div>
                        <button class="btn ghost mono" style="margin-top: 6px;" aria-label="Open value and friction gates document" @click=${() => props.onOpenSourceDoc("value_friction")}>Open</button>
                      </div>
                    </div>
                    <div class="list-item">
                      <div class="list-main"><div class="list-title">Council Interrogation Cycle</div></div>
                      <div class="list-meta">
                        <div class="mono">${snapshot.references.interrogation_cycle}</div>
                        <button class="btn ghost mono" style="margin-top: 6px;" aria-label="Open council interrogation cycle document" @click=${() => props.onOpenSourceDoc("interrogation_cycle")}>Open</button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>`
                  : nothing
              }

              ${
                showOperate && props.sourceDoc
                  ? html`<div class="card" style="margin-top: 16px; margin-bottom: 0;">
                      <div class="card-title">Document Viewer</div>
                      <div class="card-sub">Read key SDD source docs without leaving Ted.</div>
                      <div class="muted mono" style="margin-top: 8px;">${props.sourceDoc.path}</div>
                      <pre class="mono" style="margin-top: 10px; max-height: 260px; overflow: auto; white-space: pre-wrap;">${props.sourceDoc.content}</pre>
                    </div>`
                  : nothing
              }
              ${
                showOperate && props.sourceDocLoading
                  ? html`
                      <div class="muted" style="margin-top: 10px">Loading document…</div>
                    `
                  : nothing
              }
              ${
                showOperate && props.sourceDocError
                  ? html`<div class="callout danger" style="margin-top: 10px;">${props.sourceDocError}</div>`
                  : nothing
              }

              ${
                showOperate
                  ? html`<div class="grid grid-cols-2" style="margin-top: 16px;">
                      <div class="card" style="margin: 0;">
                        <div class="card-title">Operator Workflow (Clint View)</div>
                        <div class="card-sub">Where work is reviewed, approved, and progressed.</div>
                        <div class="list" style="margin-top: 10px;">
                          <div class="list-item">
                            <div class="list-main">
                              <div class="list-title">Primary approval surface</div>
                              <div class="list-sub mono">${snapshot.operator_flow.primary_approval_surface}</div>
                            </div>
                          </div>
                          <div class="list-item">
                            <div class="list-main">
                              <div class="list-title">Secondary fallback surface</div>
                              <div class="list-sub mono">${snapshot.operator_flow.secondary_approval_surface}</div>
                            </div>
                          </div>
                          <div class="list-item">
                            <div class="list-main">
                              <div class="list-title">Draft review path</div>
                              <div class="list-sub mono">${snapshot.operator_flow.draft_review_surface}</div>
                            </div>
                          </div>
                        </div>
                        <div class="muted" style="margin-top: 8px;">
                          ${snapshot.operator_flow.notes.join(" ")}
                        </div>
                      </div>

                      <div class="card" style="margin: 0;">
                        <div class="card-title">Integration Health</div>
                        <div class="card-sub">
                          M365 profile status and sign-in actions for Ted-managed workflows.
                        </div>
                        <div class="list" style="margin-top: 10px;">
                          ${snapshot.integrations.m365_profiles.map(
                            (profile) => html`<div class="list-item">
                              <div class="list-main">
                                <div class="list-title">${profile.profile_id}</div>
                                <div class="list-sub">scopes: ${profile.delegated_scopes_count} | auth store: ${profile.auth_store ?? "n/a"}</div>
                              </div>
                              <div class="list-meta">
                                <span class="pill ${toneForIntegrationStatus(profile.status)}">${profile.status}</span>
                                <div class="muted" style="margin-top: 6px; max-width: 320px;">${profile.next_step}</div>
                                ${profile.last_error ? html`<div class="muted mono" style="margin-top: 6px;">${profile.last_error}</div>` : nothing}
                                <div class="row" style="gap: 6px; margin-top: 8px; justify-content: flex-end;">
                                  <button
                                    class="btn ghost btn--sm"
                                    aria-label="Start connector sign-in"
                                    ?disabled=${props.connectorAuthBusyProfile !== null}
                                    @click=${() => props.onStartConnectorAuth(profile.profile_id as "olumie" | "everest")}
                                  >
                                    ${
                                      props.connectorAuthBusyProfile === profile.profile_id
                                        ? "Starting..."
                                        : "Start sign-in"
                                    }
                                  </button>
                                  <button
                                    class="btn ghost btn--sm"
                                    aria-label="Check connector sign-in status"
                                    ?disabled=${props.connectorAuthBusyProfile !== null}
                                    @click=${() => props.onPollConnectorAuth(profile.profile_id as "olumie" | "everest")}
                                  >
                                    ${
                                      props.connectorAuthBusyProfile === profile.profile_id
                                        ? "Checking..."
                                        : "Check sign-in"
                                    }
                                  </button>
                                  <button
                                    class="btn ghost btn--sm"
                                    aria-label="Revoke connector integration"
                                    ?disabled=${props.connectorAuthBusyProfile !== null}
                                    @click=${() => {
                                      if (
                                        confirm(
                                          `Revoke ${profile.profile_id} integration? This will disconnect mail, calendar, and sync access.`,
                                        )
                                      ) {
                                        props.onRevokeConnectorAuth(
                                          profile.profile_id as "olumie" | "everest",
                                        );
                                      }
                                    }}
                                  >
                                    ${
                                      props.connectorAuthBusyProfile === profile.profile_id
                                        ? "Revoking..."
                                        : "Revoke"
                                    }
                                  </button>
                                </div>
                              </div>
                            </div>`,
                          )}
                        </div>
                        ${
                          props.connectorAuthError
                            ? html`<div class="callout danger" style="margin-top: 10px;">${props.connectorAuthError}</div>`
                            : nothing
                        }
                        ${
                          props.connectorAuthResult
                            ? html`<pre class="mono" style="margin-top: 10px; white-space: pre-wrap;">${props.connectorAuthResult}</pre>`
                            : nothing
                        }
                        <div style="margin-top:12px;padding-top:8px;border-top:1px solid var(--border-color,#333);">
                          <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
                            ${
                              props.showGraphSyncInput
                                ? html`
                                <div style="display:flex;align-items:center;gap:6px;">
                                  <select
                                    .value=${props.graphSyncInputProfileId}
                                    @change=${(e: Event) => props.onGraphSyncInputProfileChange((e.target as HTMLSelectElement).value)}
                                    style="padding:4px 6px;border:1px solid var(--border-color,#444);border-radius:4px;background:var(--bg-secondary,#222);color:inherit;font-size:0.9em;">
                                    <option value="olumie">olumie</option>
                                    <option value="everest">everest</option>
                                  </select>
                                  <button class="btn ghost btn--sm" aria-label="Submit graph sync profile" ?disabled=${props.tedGraphSyncStatusLoading} @click=${() => props.onGraphSyncInputSubmit()}>${props.tedGraphSyncStatusLoading ? "Loading..." : "View"}</button>
                                  <button class="btn ghost btn--sm" aria-label="Cancel graph sync input" @click=${() => props.onGraphSyncInputToggle()}>Cancel</button>
                                </div>`
                                : html`<button class="btn ghost btn--sm" aria-label="View graph sync history" ?disabled=${props.tedGraphSyncStatusLoading} @click=${() => props.onGraphSyncInputToggle()}>${props.tedGraphSyncStatusLoading ? "Loading..." : "View Sync History"}</button>`
                            }
                            ${props.tedGraphSyncStatusError ? html`<span class="text-danger" style="font-size:0.85em;">${props.tedGraphSyncStatusError}</span>` : nothing}
                          </div>
                          ${
                            props.tedGraphSyncStatusResult
                              ? html`
                            <div style="margin-top:6px;font-size:0.85em;">
                              <span class="muted">Recent sync entries: ${props.tedGraphSyncStatusResult?.count ?? 0}</span>
                            </div>`
                              : nothing
                          }
                        </div>
                      </div>
                    </div>`
                  : nothing
              }

              ${
                showGovern
                  ? html`<div class="card" style="margin-top: 16px; margin-bottom: 0;">
                <div class="card-title">Delivery Speed Controls (Advanced)</div>
                <div class="card-sub">
                  Move faster only when you choose to accept higher risk. Lower limits are safer; higher limits unlock more automation sooner.
                </div>
                ${
                  snapshot.threshold_controls.relaxed
                    ? html`<div class="callout warn" style="margin-top: 10px;">
                        Warnings: ${snapshot.threshold_controls.warnings.join(" ")}
                      </div>`
                    : nothing
                }
                <div class="grid grid-cols-2" style="margin-top: 10px;">
                  <label>
                    <div class="card-sub">Max manual work/day (minutes)</div>
                    <input
                      class="input"
                      type="number"
                      min="0"
                      max="1440"
                      .value=${props.thresholdManual}
                      @input=${(event: Event) =>
                        props.onThresholdFieldChange(
                          "manual",
                          (event.currentTarget as HTMLInputElement).value,
                        )}
                    />
                  </label>
                  <label>
                    <div class="card-sub">Max oldest pending decision (minutes)</div>
                    <input
                      class="input"
                      type="number"
                      min="0"
                      max="10080"
                      .value=${props.thresholdApprovalAge}
                      @input=${(event: Event) =>
                        props.onThresholdFieldChange(
                          "approval",
                          (event.currentTarget as HTMLInputElement).value,
                        )}
                    />
                  </label>
                </div>
                <div class="grid grid-cols-2" style="margin-top: 10px;">
                  <label>
                    <div class="card-sub">Max unresolved triage at end of day</div>
                    <input
                      class="input"
                      type="number"
                      min="0"
                      max="999"
                      .value=${props.thresholdTriageEod}
                      @input=${(event: Event) =>
                        props.onThresholdFieldChange(
                          "triage",
                          (event.currentTarget as HTMLInputElement).value,
                        )}
                    />
                  </label>
                  <label>
                    <div class="card-sub">Max blocked items without reason</div>
                    <input
                      class="input"
                      type="number"
                      min="0"
                      max="999"
                      .value=${props.thresholdBlockedExplainability}
                      @input=${(event: Event) =>
                        props.onThresholdFieldChange(
                          "blocked",
                          (event.currentTarget as HTMLInputElement).value,
                        )}
                    />
                  </label>
                </div>
                <label class="row" style="margin-top: 10px;">
                  <input
                    type="checkbox"
                    .checked=${props.thresholdAcknowledgeRisk}
                    @change=${(event: Event) =>
                      props.onThresholdFieldChange(
                        "ack",
                        String((event.currentTarget as HTMLInputElement).checked),
                      )}
                  />
                  <span class="muted"
                    >I understand this can deliver value faster, but with more risk.</span
                  >
                </label>
                <div class="row" style="justify-content: flex-end; gap: 8px; margin-top: 10px;">
                  <button
                    class="btn ghost"
                    aria-label="Reset delivery speed controls to safe defaults"
                    ?disabled=${props.thresholdBusy}
                    @click=${props.onResetThresholds}
                  >
                    Reset Safe Defaults
                  </button>
                  <button
                    class="btn"
                    aria-label="Apply delivery speed control changes"
                    ?disabled=${props.thresholdBusy}
                    @click=${props.onApplyThresholds}
                  >
                    ${props.thresholdBusy ? "Applying..." : "Apply Changes"}
                  </button>
                </div>
                ${
                  props.thresholdError
                    ? html`<div class="callout danger" style="margin-top: 10px;">${props.thresholdError}</div>`
                    : nothing
                }
                ${
                  props.thresholdResult
                    ? html`<pre class="mono" style="margin-top: 10px; white-space: pre-wrap;">${props.thresholdResult}</pre>`
                    : nothing
                }
                <div class="card" style="margin-top: 16px; margin-bottom: 0;">
                  <div class="card-title">What Unlocks as Quality Improves</div>
                  <div class="list" style="margin-top: 8px;">
                    <div class="list-item"><div class="list-main"><div class="list-title">Stage 1 - Daily value now</div><div class="list-sub">Briefs, draft queue, and governed approvals.</div></div></div>
                    <div class="list-item"><div class="list-main"><div class="list-title">Stage 2 - Safer data handling</div><div class="list-sub">Stronger entity separation, provenance checks, and audience controls.</div></div></div>
                    <div class="list-item"><div class="list-main"><div class="list-title">Stage 3 - Better decisions</div><div class="list-sub">Confidence routing and contradiction detection with citations.</div></div></div>
                    <div class="list-item"><div class="list-main"><div class="list-title">Stage 4 - Resilience</div><div class="list-sub">Pause/resume catch-up and rate-limit protection.</div></div></div>
                    <div class="list-item"><div class="list-main"><div class="list-title">Stage 5 - Governed learning</div><div class="list-sub">Measured improvement loops with no silent behavior drift.</div></div></div>
                  </div>
                </div>
              </div>`
                  : nothing
              }

              ${
                showGovern
                  ? html`<div class="card" style="margin-top: 16px; margin-bottom: 0;">
                      <div class="card-title">Policy Center</div>
                      <div class="card-sub">
                        Configure policy safely with preview before save.
                      </div>
                      <div class="row" style="gap: 8px; margin-top: 10px; flex-wrap: wrap;">
                        ${(
                          ["job_board", "promotion_policy", "value_friction"] as TedPolicyKey[]
                        ).map(
                          (key) => html`<button
                            class="btn btn--sm ${props.policyDoc?.key === key ? "active" : ""}"
                            aria-label=${`Load ${labelForPolicyKey(key)} policy`}
                            @click=${() => props.onLoadPolicyDoc(key)}
                          >
                            ${labelForPolicyKey(key)}
                          </button>`,
                        )}
                      </div>
                      ${
                        props.policyLoading
                          ? html`
                              <div class="muted" style="margin-top: 10px">Loading policy…</div>
                            `
                          : nothing
                      }
                      ${
                        props.policyError
                          ? html`<div class="callout danger" style="margin-top: 10px;">${props.policyError}</div>`
                          : nothing
                      }
                      ${
                        props.policyDoc
                          ? html`<div style="margin-top: 10px;">
                              <div class="muted mono">${props.policyDoc.path}</div>
                              <div class="grid grid-cols-2" style="margin-top: 10px;">
                                <label>
                                  <div class="card-sub">Objective</div>
                                  <input
                                    class="input"
                                    .value=${props.policyDoc.config.objective}
                                    @input=${(event: Event) =>
                                      props.onPolicyConfigChange(
                                        "objective",
                                        (event.currentTarget as HTMLInputElement).value,
                                      )}
                                  />
                                </label>
                                <label>
                                  <div class="card-sub">Rollout mode</div>
                                  <select
                                    class="input"
                                    .value=${props.policyDoc.config.rollout_mode}
                                    @change=${(event: Event) =>
                                      props.onPolicyConfigChange(
                                        "rollout_mode",
                                        (event.currentTarget as HTMLSelectElement).value,
                                      )}
                                  >
                                    <option value="conservative">Conservative</option>
                                    <option value="balanced">Balanced</option>
                                    <option value="aggressive">Aggressive</option>
                                  </select>
                                </label>
                              </div>
                              <div class="grid grid-cols-2" style="margin-top: 10px;">
                                <label>
                                  <div class="card-sub">Automation ceiling</div>
                                  <select
                                    class="input"
                                    .value=${props.policyDoc.config.automation_ceiling}
                                    @change=${(event: Event) =>
                                      props.onPolicyConfigChange(
                                        "automation_ceiling",
                                        (event.currentTarget as HTMLSelectElement).value,
                                      )}
                                  >
                                    <option value="draft-only">Draft only</option>
                                    <option value="approval-first">Approval first</option>
                                    <option value="limited-auto">Limited auto</option>
                                  </select>
                                </label>
                                <label>
                                  <div class="card-sub">Success checks (one per line)</div>
                                  <textarea
                                    class="input"
                                    style="width: 100%; min-height: 90px;"
                                    .value=${props.policyDoc.config.success_checks.join("\n")}
                                    @input=${(event: Event) =>
                                      props.onPolicyListChange(
                                        "success_checks",
                                        (event.currentTarget as HTMLTextAreaElement).value,
                                      )}
                                  ></textarea>
                                </label>
                              </div>
                              <div class="grid grid-cols-2" style="margin-top: 10px;">
                                <label>
                                  <div class="card-sub">Guardrails (one per line)</div>
                                  <textarea
                                    class="input"
                                    style="width: 100%; min-height: 90px;"
                                    .value=${props.policyDoc.config.guardrails.join("\n")}
                                    @input=${(event: Event) =>
                                      props.onPolicyListChange(
                                        "guardrails",
                                        (event.currentTarget as HTMLTextAreaElement).value,
                                      )}
                                  ></textarea>
                                </label>
                                <label>
                                  <div class="card-sub">Operator notes</div>
                                  <textarea
                                    class="input"
                                    style="width: 100%; min-height: 90px;"
                                    .value=${props.policyDoc.config.operator_notes}
                                    @input=${(event: Event) =>
                                      props.onPolicyConfigChange(
                                        "operator_notes",
                                        (event.currentTarget as HTMLTextAreaElement).value,
                                      )}
                                  ></textarea>
                                </label>
                              </div>
                              <div class="row" style="justify-content: flex-end; gap: 8px; margin-top: 10px;">
                                <button
                                  class="btn ghost"
                                  aria-label="Preview policy impact"
                                  ?disabled=${props.policyPreviewBusy}
                                  @click=${props.onPreviewPolicyUpdate}
                                >
                                  ${props.policyPreviewBusy ? "Previewing..." : "Preview Policy Impact"}
                                </button>
                                <button
                                  class="btn"
                                  aria-label="Save policy changes"
                                  ?disabled=${props.policySaveBusy}
                                  @click=${props.onSavePolicyUpdate}
                                >
                                  ${props.policySaveBusy ? "Saving..." : "Save Policy Changes"}
                                </button>
                              </div>
                            </div>`
                          : nothing
                      }
                      ${
                        props.policyPreviewError
                          ? html`<div class="callout danger" style="margin-top: 10px;">${props.policyPreviewError}</div>`
                          : nothing
                      }
                      ${
                        props.policyPreview
                          ? html`<div class="card" style="margin-top: 10px; margin-bottom: 0;">
                              <div class="card-title">Policy Impact Preview</div>
                              <div class="muted">${props.policyPreview.impact_summary.join("; ")}</div>
                              ${
                                props.policyPreview.warnings.length > 0
                                  ? html`<div class="callout warn" style="margin-top: 8px;">
                                      ${props.policyPreview.warnings.join(" ")}
                                    </div>`
                                  : nothing
                              }
                            </div>`
                          : nothing
                      }
                      ${
                        props.policySaveError
                          ? html`<div class="callout danger" style="margin-top: 10px;">${props.policySaveError}</div>`
                          : nothing
                      }
                      ${
                        props.policySaveResult
                          ? html`<pre class="mono" style="margin-top: 10px; white-space: pre-wrap;">${props.policySaveResult}</pre>`
                          : nothing
                      }
                    </div>`
                  : nothing
              }

              ${
                showGovern
                  ? html`<div class="card" style="margin-top: 16px; margin-bottom: 0;">
                      <div class="card-title">Policy Change Attribution</div>
                      <div class="card-sub">
                        Every policy save is attributed to likely affected work items and expected KPI effects.
                      </div>
                      <div class="stat-grid" style="margin-top: 10px;">
                        <div class="stat">
                          <div class="stat-label">Job Board changes</div>
                          <div class="stat-value">${snapshot.policy_impacts.totals_by_policy.job_board}</div>
                        </div>
                        <div class="stat">
                          <div class="stat-label">Promotion policy changes</div>
                          <div class="stat-value">${snapshot.policy_impacts.totals_by_policy.promotion_policy}</div>
                        </div>
                        <div class="stat">
                          <div class="stat-label">Value/Friction changes</div>
                          <div class="stat-value">${snapshot.policy_impacts.totals_by_policy.value_friction}</div>
                        </div>
                      </div>
                      <div class="list" style="margin-top: 10px;">
                        ${
                          snapshot.policy_impacts.recent.length === 0
                            ? html`
                                <div class="muted">No policy impact events captured yet.</div>
                              `
                            : snapshot.policy_impacts.recent.slice(0, 8).map(
                                (entry) => html`<div class="list-item">
                                  <div class="list-main">
                                    <div class="list-title">${labelForPolicyKey(entry.policy_key)}</div>
                                    <div class="list-sub mono">${entry.ts}</div>
                                    <div class="list-sub">${entry.rationale}</div>
                                    <div class="muted" style="margin-top: 6px;">
                                      fields: ${entry.changed_fields.length > 0 ? entry.changed_fields.join(", ") : "none"}
                                    </div>
                                  </div>
                                  <div class="list-meta">
                                    <span class="pill ${toneForRiskDirection(entry.risk_direction)}">${entry.risk_direction}</span>
                                    <div class="muted mono" style="margin-top: 6px;">
                                      cards: ${entry.linked_cards.length}
                                    </div>
                                    <div class="muted" style="margin-top: 6px; max-width: 300px;">
                                      KPI effects: ${entry.expected_kpi_effects.join("; ")}
                                    </div>
                                  </div>
                                </div>`,
                              )
                        }
                      </div>
                    </div>`
                  : nothing
              }

              ${
                showOperate
                  ? html`<div class="card" style="margin-top: 16px; margin-bottom: 0;">
                <div class="card-title">Recommended Next Actions</div>
                <div class="list" style="margin-top: 10px;">
                  ${
                    snapshot.recommendations.length === 0
                      ? html`
                          <div class="muted">No pending recommendations. Ted will surface actions as signals arrive.</div>
                        `
                      : snapshot.recommendations.map(
                          (entry) => html`<div class="list-item">
                      <div class="list-main">
                        <div class="list-title">${humanizeRecommendationId(entry.id)}</div>
                        <div class="list-sub">${entry.message}</div>
                      </div>
                      <div class="list-meta">
                        <span class="pill ${toneForSeverity(entry.severity)}">${entry.severity}</span>
                        <div class="muted mono" style="margin-top: 6px;">
                          decision: ${entry.decision}
                        </div>
                        <div class="muted" style="margin-top: 6px; max-width: 360px;">${entry.next_step}</div>
                        <div class="row" style="justify-content: flex-end; gap: 6px; margin-top: 8px;">
                          <button
                            class="btn ghost"
                            aria-label="Accept recommendation"
                            ?disabled=${props.recommendationBusyId !== null}
                            @click=${() => props.onRecommendationDecision(entry.id, "approved")}
                          >
                            ${props.recommendationBusyId === entry.id ? "Saving..." : "Accept"}
                          </button>
                          <button
                            class="btn ghost"
                            aria-label="Ignore recommendation"
                            ?disabled=${props.recommendationBusyId !== null}
                            @click=${() => props.onRecommendationDecision(entry.id, "dismissed")}
                          >
                            Ignore
                          </button>
                        </div>
                      </div>
                    </div>`,
                        )
                  }
                </div>
                ${
                  props.recommendationError
                    ? html`<div class="callout danger" style="margin-top: 10px;">${props.recommendationError}</div>`
                    : nothing
                }
              </div>`
                  : nothing
              }

              ${
                showOperate
                  ? html`<div class="card" style="margin-top: 16px; margin-bottom: 0;">
                      <div class="card-title">Recommendation Outcome Learning</div>
                      <div class="card-sub">
                        Ted attributes recommendation decisions to work items and feeds this into promotion confidence.
                      </div>
                      <div class="stat-grid" style="margin-top: 10px;">
                        <div class="stat">
                          <div class="stat-label">Approved</div>
                          <div class="stat-value ok">${snapshot.recommendation_outcomes.totals.approved}</div>
                        </div>
                        <div class="stat">
                          <div class="stat-label">Dismissed</div>
                          <div class="stat-value ${snapshot.recommendation_outcomes.totals.dismissed > 0 ? "warn" : ""}">
                            ${snapshot.recommendation_outcomes.totals.dismissed}
                          </div>
                        </div>
                        <div class="stat">
                          <div class="stat-label">Pending</div>
                          <div class="stat-value">${snapshot.recommendation_outcomes.totals.pending}</div>
                        </div>
                      </div>
                      <div class="list" style="margin-top: 10px;">
                        ${
                          snapshot.recommendation_outcomes.recent.length === 0
                            ? html`
                                <div class="muted">No attribution events recorded yet.</div>
                              `
                            : snapshot.recommendation_outcomes.recent.slice(0, 8).map(
                                (entry) => html`<div class="list-item">
                                  <div class="list-main">
                                    <div class="list-title">${humanizeRecommendationId(entry.id)}</div>
                                    <div class="list-sub mono">${entry.decided_at}</div>
                                    <div class="list-sub">${entry.rationale}</div>
                                  </div>
                                  <div class="list-meta">
                                    <span class="pill ${entry.decision === "dismissed" ? "warn" : ""}">
                                      ${entry.decision}
                                    </span>
                                    <div class="muted mono" style="margin-top: 6px;">
                                      ${entry.linked_cards.length > 0 ? `cards: ${entry.linked_cards.join(", ")}` : "cards: none"}
                                    </div>
                                  </div>
                                </div>`,
                              )
                        }
                      </div>
                    </div>`
                  : nothing
              }

              ${
                showOperate
                  ? html`<div class="card" style="margin-top: 16px; margin-bottom: 0;">
                      <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: var(--space-4);">
                        <div class="card-title" style="margin: 0;">Deal Pipeline</div>
                        <button class="btn" aria-label="Refresh deal pipeline"
                          ?disabled=${props.tedDealListLoading}
                          @click=${() => props.onLoadDealList()}
                        >${props.tedDealListLoading ? "Loading..." : "Refresh"}</button>
                      </div>
                      ${
                        props.tedDealListLoading
                          ? html`
                              <p style="color: var(--color-text-secondary); font-size: var(--font-size-sm)">Loading deals...</p>
                            `
                          : nothing
                      }
                      ${props.tedDealListError ? html`<p style="color: var(--color-error); font-size: var(--font-size-sm);">${props.tedDealListError}</p>` : nothing}
                      ${
                        !props.tedDealListLoading &&
                        !props.tedDealListError &&
                        props.tedDealList.length === 0
                          ? html`
                              <p style="color: var(--color-text-caption); font-size: var(--font-size-sm)">
                                No active deals yet. Create a deal through Ted to start tracking pipeline progress.
                              </p>
                            `
                          : nothing
                      }
                      ${
                        !props.tedDealListLoading && props.tedDealList.length > 0
                          ? props.tedDealList.map((deal) => {
                              const milestone = deal.next_milestone;
                              const days = milestone ? daysUntil(milestone.date) : null;
                              const stageColor =
                                deal.stage === "closed" || deal.stage === "archived"
                                  ? "var(--color-success)"
                                  : "var(--color-warning)";
                              return html`
                          <div
                            style="display: flex; align-items: center; gap: var(--space-4); padding: var(--space-3) 0; border-bottom: 1px solid var(--color-divider); cursor: pointer; transition: var(--transition-fast);"
                            role="button" tabindex="0"
                            aria-label=${`View deal ${deal.deal_name || deal.deal_id}`}
                            @click=${() => props.onLoadDealDetail(deal.deal_id)}
                            @keydown=${(e: KeyboardEvent) => {
                              if (e.key === "Enter" || e.key === " ") {
                                e.preventDefault();
                                props.onLoadDealDetail(deal.deal_id);
                              }
                            }}
                          >
                            <div style="flex: 1; min-width: 0;">
                              <span style="max-width: 280px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; display: inline-block; vertical-align: middle; font-weight: var(--font-weight-semibold); font-size: var(--font-size-base); color: var(--color-text-primary);" title=${deal.deal_name || deal.deal_id}>${deal.deal_name || deal.deal_id}</span>
                              <span style="margin-left: var(--space-2); font-size: var(--font-size-xs); color: var(--color-text-caption);">${labelForDealType(deal.deal_type)}</span>
                            </div>
                            <span style="font-size: var(--font-size-xs); padding: 2px var(--space-2); border-radius: var(--border-radius-pill); background: ${stageColor}; color: white;">${labelForDealStage(deal.stage)}</span>
                            ${milestone ? html`<span style="font-size: var(--font-size-xs); color: ${days !== null && days < 2 ? "var(--color-error)" : days !== null && days < 7 ? "var(--color-warning)" : "var(--color-text-secondary)"};">${milestone.label}: ${days}d</span>` : nothing}
                          </div>`;
                            })
                          : nothing
                      }
                    </div>`
                  : nothing
              }

              ${
                showOperate
                  ? html`<div class="card" style="margin-top: 16px; margin-bottom: 0;">
                    <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: var(--space-3);">
                      <div class="card-title" style="margin: 0;">Stale Deal Owners</div>
                      <button class="btn" aria-label="Check stale deal owners"
                        ?disabled=${props.tedStaleDealsLoading}
                        @click=${() => props.onLoadStaleDeals()}
                      >${props.tedStaleDealsLoading ? "Checking..." : "Check Stale Owners"}</button>
                    </div>
                    ${props.tedStaleDealsError ? html`<p style="color: var(--color-error); font-size: var(--font-size-xs);">${props.tedStaleDealsError}</p>` : nothing}
                    ${
                      props.tedStaleDealsList.length > 0
                        ? props.tedStaleDealsList.map(
                            (sd) => html`
                      <div style="display: flex; align-items: center; gap: var(--space-3); padding: var(--space-2) 0; border-bottom: 1px solid var(--color-border-subtle);">
                        <span style="flex: 1; font-size: var(--font-size-sm); color: var(--color-text-primary);">${sd.name}</span>
                        <span style="font-size: var(--font-size-xs); color: var(--color-text-caption);">${sd.last_touched_by}</span>
                        <span style="font-size: var(--font-size-xs); font-weight: var(--font-weight-semibold); color: ${sd.days_since_touch > 14 ? "var(--color-error)" : "var(--color-warning)"};">${sd.days_since_touch}d stale</span>
                      </div>`,
                          )
                        : nothing
                    }
                    ${
                      !props.tedStaleDealsLoading &&
                      props.tedStaleDealsList.length === 0 &&
                      !props.tedStaleDealsError
                        ? html`
                            <p style="font-size: var(--font-size-xs); color: var(--color-text-caption)">
                              Click "Check Stale Owners" to scan for inactive deals.
                            </p>
                          `
                        : nothing
                    }
                  </div>`
                  : nothing
              }

              ${
                showOperate && props.tedDealDetail
                  ? (() => {
                      const deal = props.tedDealDetail;
                      return html`
                <section style="margin-top: var(--space-8);">
                  <button
                    style="background: transparent; border: none; color: var(--color-accent); font-size: var(--font-size-sm); cursor: pointer; padding: 0; margin-bottom: var(--space-4);"
                    aria-label="Back to deal pipeline"
                    @click=${() => {
                      props.onLoadDealList();
                    }}
                  >&larr; Back to pipeline</button>

                  <div style="margin-bottom: var(--space-6);">
                    <h2 style="max-width: 280px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-size: var(--font-size-lg); font-weight: var(--font-weight-semibold); color: var(--color-text-primary); margin: 0 0 var(--space-2) 0;" title=${deal.deal_name || deal.deal_id}>${deal.deal_name || deal.deal_id}</h2>
                    <div style="display: flex; align-items: center; gap: var(--space-3); flex-wrap: wrap;">
                      <span style="font-size: var(--font-size-xs); color: var(--color-text-caption);">${labelForDealType(deal.deal_type)}</span>
                      <span style="font-size: var(--font-size-xs); padding: 2px var(--space-2); border-radius: var(--border-radius-pill); background: ${deal.stage === "closed" || deal.stage === "archived" ? "var(--color-success)" : "var(--color-warning)"}; color: white;">${labelForDealStage(deal.stage)}</span>
                      <span style="font-size: var(--font-size-xs); color: ${toneForDealStatus(deal.status)}; font-weight: var(--font-weight-medium);">${deal.status}</span>
                      <span style="font-size: var(--font-size-xs); color: var(--color-text-caption);">${deal.entity}</span>
                    </div>
                  </div>

                  <div style="display:flex;gap:var(--space-4);margin-bottom:var(--space-4);align-items:center;flex-wrap:wrap;">
                    <label style="display:flex;align-items:center;gap:var(--space-2);font-size:var(--font-size-sm);color:var(--color-text-secondary);">
                      Stage:
                      <select
                        style="font-size:var(--font-size-sm);padding:2px var(--space-2);border:1px solid var(--color-border);border-radius:var(--border-radius);background:var(--color-bg-secondary);color:var(--color-text-primary);"
                        ?disabled=${props.tedDealActionBusy}
                        @change=${(e: Event) => {
                          const val = (e.target as HTMLSelectElement).value;
                          if (val) {
                            props.onUpdateDeal(deal.deal_id, { stage: val });
                          }
                        }}
                      >
                        ${(
                          [
                            "deal_identified",
                            "nda_signed",
                            "data_room_access",
                            "dd_active",
                            "psa_in_progress",
                            "investor_onboarding",
                            "closing",
                            "closed",
                            "archived",
                          ] as const
                        ).map(
                          (s) =>
                            html`<option value=${s} ?selected=${deal.stage === s}>${labelForDealStage(s)}</option>`,
                        )}
                      </select>
                    </label>
                    <label style="display:flex;align-items:center;gap:var(--space-2);font-size:var(--font-size-sm);color:var(--color-text-secondary);">
                      Status:
                      <select
                        style="font-size:var(--font-size-sm);padding:2px var(--space-2);border:1px solid var(--color-border);border-radius:var(--border-radius);background:var(--color-bg-secondary);color:var(--color-text-primary);"
                        ?disabled=${props.tedDealActionBusy}
                        @change=${(e: Event) => {
                          const val = (e.target as HTMLSelectElement).value;
                          if (val) {
                            props.onUpdateDeal(deal.deal_id, { status: val });
                          }
                        }}
                      >
                        ${(["active", "paused", "closed", "archived"] as const).map(
                          (s) =>
                            html`<option value=${s} ?selected=${deal.status === s}>${s.replace(/_/g, " ")}</option>`,
                        )}
                      </select>
                    </label>
                    ${
                      props.tedDealActionBusy
                        ? html`
                            <span style="font-size: var(--font-size-xs); color: var(--color-text-secondary)">Updating...</span>
                          `
                        : nothing
                    }
                  </div>
                  ${props.tedDealActionError ? html`<div class="callout danger" style="margin-bottom:var(--space-4);font-size:var(--font-size-sm);">${props.tedDealActionError}</div>` : nothing}
                  ${
                    props.tedDealActionResult
                      ? html`
                          <div
                            class="callout"
                            style="margin-bottom: var(--space-4); font-size: var(--font-size-sm); color: var(--color-success)"
                          >
                            Deal updated.
                          </div>
                        `
                      : nothing
                  }

                  ${
                    props.tedDealDetailLoading
                      ? html`
                          <p style="color: var(--color-text-secondary); font-size: var(--font-size-sm)">Loading detail...</p>
                        `
                      : nothing
                  }
                  ${props.tedDealDetailError ? html`<p style="color: var(--color-error); font-size: var(--font-size-sm);">${props.tedDealDetailError}</p>` : nothing}

                  <div style="margin-bottom: var(--space-6);">
                    <h3 style="font-size: var(--font-size-base); font-weight: var(--font-weight-semibold); color: var(--color-text-primary); margin: 0 0 var(--space-3) 0;">Important Dates</h3>
                    ${
                      Array.isArray(deal.important_dates) && deal.important_dates.length > 0
                        ? deal.important_dates.map((d) => {
                            const days = daysUntil(d.date);
                            const countdownColor =
                              days < 2
                                ? "var(--color-error)"
                                : days < 7
                                  ? "var(--color-warning)"
                                  : "var(--color-text-secondary)";
                            return html`
                      <div style="display: flex; align-items: center; gap: var(--space-3); padding: var(--space-2) 0; border-bottom: 1px solid var(--color-border-subtle);">
                        <span style="font-size: var(--font-size-sm); color: var(--color-text-primary); flex: 1;">${d.label}</span>
                        <span style="font-size: var(--font-size-xs); color: var(--color-text-caption);">${d.date}</span>
                        <span style="font-size: var(--font-size-xs); font-weight: var(--font-weight-medium); color: ${countdownColor};">${days > 0 ? `${days}d` : days === 0 ? "Today" : `${Math.abs(days)}d ago`}</span>
                      </div>`;
                          })
                        : html`
                            <p style="font-size: var(--font-size-sm); color: var(--color-text-caption)">No dates set</p>
                          `
                    }
                  </div>

                  <!-- DW-020: Investors -->
                  <div style="margin-bottom: var(--space-6);">
                    <h3 style="font-size: var(--font-size-base); font-weight: var(--font-weight-semibold); color: var(--color-text-primary); margin: 0 0 var(--space-3) 0;">Investors</h3>
                    ${
                      Array.isArray(deal.investors) && deal.investors.length > 0
                        ? deal.investors.map((inv) => {
                            const oigColor =
                              inv.oig_status === "clear"
                                ? "var(--color-success)"
                                : inv.oig_status === "hit"
                                  ? "var(--color-error)"
                                  : "var(--color-warning)";
                            const exclColor =
                              inv.state_exclusion_status === "clear"
                                ? "var(--color-success)"
                                : inv.state_exclusion_status === "hit"
                                  ? "var(--color-error)"
                                  : "var(--color-warning)";
                            return html`
                      <div style="display: flex; align-items: center; gap: var(--space-3); padding: var(--space-2) 0; border-bottom: 1px solid var(--color-border-subtle);">
                        <span style="flex: 1; font-size: var(--font-size-sm); color: var(--color-text-primary);">${inv.name}</span>
                        <span style="font-size: var(--font-size-xs); padding: 2px var(--space-2); border-radius: var(--border-radius-pill); background: ${oigColor}; color: white;">OIG: ${inv.oig_status}</span>
                        <span style="font-size: var(--font-size-xs); padding: 2px var(--space-2); border-radius: var(--border-radius-pill); background: ${exclColor}; color: white;">Excl: ${inv.state_exclusion_status}</span>
                        <span style="font-size: var(--font-size-xs); padding: 2px var(--space-2); border-radius: var(--border-radius-pill); background: ${inv.disclosure_form_sent ? "var(--color-success)" : "var(--color-bg-tertiary, #555)"}; color: ${inv.disclosure_form_sent ? "white" : "var(--color-text-caption)"};" title="${inv.disclosure_form_sent ? "Disclosure form sent" : "Disclosure form not sent"}">${inv.disclosure_form_sent ? "\u2713 Disclosed" : "No Disclosure"}</span>
                      </div>`;
                          })
                        : html`
                            <p style="font-size: var(--font-size-sm); color: var(--color-text-caption)">No investors</p>
                          `
                    }
                  </div>

                  <!-- DW-021: Outside Counsel -->
                  <div style="margin-bottom: var(--space-6);">
                    <h3 style="font-size: var(--font-size-base); font-weight: var(--font-weight-semibold); color: var(--color-text-primary); margin: 0 0 var(--space-3) 0;">Outside Counsel</h3>
                    ${
                      Array.isArray(deal.outside_counsel) && deal.outside_counsel.length > 0
                        ? deal.outside_counsel.map(
                            (counsel) => html`
                      <div style="padding: var(--space-2) 0; border-bottom: 1px solid var(--color-border-subtle);">
                        <div style="display: flex; align-items: center; gap: var(--space-3);">
                          <span style="flex: 1; font-size: var(--font-size-sm); font-weight: var(--font-weight-medium); color: var(--color-text-primary);">${counsel.firm_name}</span>
                          <span style="font-size: var(--font-size-xs); color: var(--color-text-caption);">${counsel.matter}</span>
                          <span style="font-size: var(--font-size-sm); font-weight: var(--font-weight-semibold); color: var(--color-text-primary);">$${typeof counsel.total_spend === "number" ? counsel.total_spend.toLocaleString() : "0"}</span>
                        </div>
                        ${
                          Array.isArray(counsel.invoices) && counsel.invoices.length > 0
                            ? html`
                        <div style="margin-top: var(--space-1); padding-left: var(--space-6);">
                          ${counsel.invoices.map(
                            (inv) => html`
                          <div style="display: flex; align-items: center; gap: var(--space-3); padding: var(--space-1) 0;">
                            <span style="font-size: var(--font-size-xs); color: var(--color-text-caption);">${inv.date}</span>
                            <span style="font-size: var(--font-size-xs); color: var(--color-text-secondary); flex: 1;">${inv.description}</span>
                            <span style="font-size: var(--font-size-xs); color: var(--color-text-primary);">$${typeof inv.amount === "number" ? inv.amount.toLocaleString() : "0"}</span>
                          </div>`,
                          )}
                        </div>`
                            : nothing
                        }
                      </div>`,
                          )
                        : html`
                            <p style="font-size: var(--font-size-sm); color: var(--color-text-caption)">No outside counsel</p>
                          `
                    }
                  </div>

                  <!-- DW-022: Team Tasks + DD Checklist -->
                  <div style="margin-bottom: var(--space-6);">
                    <h3 style="font-size: var(--font-size-base); font-weight: var(--font-weight-semibold); color: var(--color-text-primary); margin: 0 0 var(--space-3) 0;">Team Tasks</h3>
                    ${
                      Array.isArray(deal.team_tasks) && deal.team_tasks.length > 0
                        ? deal.team_tasks.map((t) => {
                            const isDone = t.status === "done";
                            const ownerColor =
                              t.owner === "Clint"
                                ? "var(--color-accent)"
                                : "var(--color-text-secondary)";
                            return html`
                      <div style="display: flex; align-items: center; gap: var(--space-3); padding: var(--space-2) 0; border-bottom: 1px solid var(--color-border-subtle);">
                        <div style="width: 18px; height: 18px; border-radius: 50%; border: 2px solid ${isDone ? "var(--color-success)" : "var(--color-border)"}; background: ${isDone ? "var(--color-success)" : "transparent"}; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
                          ${
                            isDone
                              ? html`
                                  <span style="color: white; font-size: 11px">&#10003;</span>
                                `
                              : nothing
                          }
                        </div>
                        <span style="flex: 1; font-size: var(--font-size-sm); color: var(--color-text-primary); ${isDone ? "text-decoration: line-through; opacity: 0.6;" : ""}">${t.task}</span>
                        <span style="font-size: var(--font-size-xs); padding: 2px var(--space-2); border-radius: var(--border-radius-pill); border: 1px solid ${ownerColor}; color: ${ownerColor};">${t.owner}</span>
                        ${t.due_date ? html`<span style="font-size: var(--font-size-xs); color: var(--color-text-caption);">${t.due_date}</span>` : nothing}
                      </div>`;
                          })
                        : html`
                            <p style="font-size: var(--font-size-sm); color: var(--color-text-caption)">No tasks</p>
                          `
                    }
                  </div>

                  <div style="margin-bottom: var(--space-6);">
                    <h3 style="font-size: var(--font-size-base); font-weight: var(--font-weight-semibold); color: var(--color-text-primary); margin: 0 0 var(--space-3) 0;">DD Checklist</h3>
                    ${
                      Array.isArray(deal.dd_checklist) && deal.dd_checklist.length > 0
                        ? (() => {
                            const total = deal.dd_checklist.length;
                            const complete = deal.dd_checklist.filter(
                              (c) => c.status === "complete",
                            ).length;
                            const pct = total > 0 ? Math.round((complete / total) * 100) : 0;
                            return html`
                      <div style="height: 4px; background: var(--color-bg-tertiary); border-radius: 2px; margin-bottom: var(--space-3); overflow: hidden;">
                        <div style="height: 100%; width: ${pct}%; background: var(--color-accent); border-radius: 2px; transition: var(--transition-fast);"></div>
                      </div>
                      ${deal.dd_checklist.map((c) => {
                        const isComplete = c.status === "complete";
                        const isNa = c.status === "na";
                        return html`
                        <div style="display: flex; align-items: center; gap: var(--space-3); padding: var(--space-2) 0; border-bottom: 1px solid var(--color-border-subtle);">
                          <div style="width: 18px; height: 18px; border-radius: 50%; border: 2px solid ${isComplete ? "var(--color-success)" : isNa ? "var(--color-text-caption)" : "var(--color-border)"}; background: ${isComplete ? "var(--color-success)" : "transparent"}; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
                            ${
                              isComplete
                                ? html`
                                    <span style="color: white; font-size: 11px">&#10003;</span>
                                  `
                                : nothing
                            }
                            ${
                              isNa
                                ? html`
                                    <span style="color: var(--color-text-caption); font-size: 11px">—</span>
                                  `
                                : nothing
                            }
                          </div>
                          <span style="flex: 1; font-size: var(--font-size-sm); color: var(--color-text-primary); ${isNa ? "text-decoration: line-through; opacity: 0.5;" : ""}">${c.item}</span>
                          ${c.notes ? html`<span style="font-size: var(--font-size-xs); color: var(--color-text-caption);">${c.notes}</span>` : nothing}
                        </div>`;
                      })}`;
                          })()
                        : html`
                            <p style="font-size: var(--font-size-sm); color: var(--color-text-caption)">No checklist items</p>
                          `
                    }
                  </div>

                  <!-- DW-023: Notes -->
                  <div style="margin-bottom: var(--space-6);">
                    <h3 style="font-size: var(--font-size-base); font-weight: var(--font-weight-semibold); color: var(--color-text-primary); margin: 0 0 var(--space-3) 0;">Notes</h3>
                    ${
                      Array.isArray(deal.notes) && deal.notes.length > 0
                        ? [...deal.notes].toReversed().map(
                            (note) => html`
                      <div style="padding: var(--space-2) 0; border-bottom: 1px solid var(--color-border-subtle);">
                        <p style="font-size: var(--font-size-sm); color: var(--color-text-primary); margin: 0 0 var(--space-1) 0;">${note.text}</p>
                        <div style="display: flex; gap: var(--space-2);">
                          <span style="font-size: var(--font-size-xs); color: var(--color-text-caption);">${note.author}</span>
                          <span style="font-size: var(--font-size-xs); color: var(--color-text-caption);">${note.created_at}</span>
                        </div>
                      </div>`,
                          )
                        : html`
                            <p style="font-size: var(--font-size-sm); color: var(--color-text-caption)">No notes</p>
                          `
                    }
                  </div>

                  <!-- Deal Actions -->
                  <div style="margin-top: var(--space-6); padding-top: var(--space-4); border-top: 1px solid var(--color-border);">
                    <h3 style="font-size: var(--font-size-base); font-weight: var(--font-weight-semibold); color: var(--color-text-primary); margin: 0 0 var(--space-3) 0;">Actions</h3>
                    <div style="display: flex; gap: var(--space-3); flex-wrap: wrap;">
                      ${
                        deal.status === "active"
                          ? html`
                        <button
                          style="height: var(--button-height); padding: 0 var(--space-4); border: 1px solid var(--color-border); border-radius: var(--border-radius); background: transparent; color: var(--color-warning); font-size: var(--font-size-sm); cursor: pointer;"
                          aria-label="Pause deal"
                          ?disabled=${props.tedDealActionBusy}
                          @click=${() => props.onUpdateDeal(deal.deal_id, { status: "paused" })}
                        >${props.tedDealActionBusy ? "Updating..." : "Pause Deal"}</button>
                      `
                          : nothing
                      }
                      ${
                        deal.status === "paused"
                          ? html`
                        <button
                          style="height: var(--button-height); padding: 0 var(--space-4); border: 1px solid var(--color-border); border-radius: var(--border-radius); background: transparent; color: var(--color-success); font-size: var(--font-size-sm); cursor: pointer;"
                          aria-label="Resume deal"
                          ?disabled=${props.tedDealActionBusy}
                          @click=${() => props.onUpdateDeal(deal.deal_id, { status: "active" })}
                        >${props.tedDealActionBusy ? "Updating..." : "Resume Deal"}</button>
                      `
                          : nothing
                      }
                      ${
                        deal.stage !== "closed" && deal.stage !== "archived"
                          ? html`
                        <button
                          style="height: var(--button-height); padding: 0 var(--space-4); border: 1px solid var(--color-border); border-radius: var(--border-radius); background: transparent; color: var(--color-accent); font-size: var(--font-size-sm); cursor: pointer;"
                          aria-label="Advance deal to closing stage"
                          ?disabled=${props.tedDealActionBusy}
                          @click=${() => props.onUpdateDeal(deal.deal_id, { stage: "closing" })}
                        >${props.tedDealActionBusy ? "Updating..." : "Advance to Closing"}</button>
                      `
                          : nothing
                      }
                      <button
                        style="height: var(--button-height); padding: 0 var(--space-4); border: 1px solid var(--color-border); border-radius: var(--border-radius); background: transparent; color: var(--color-text-secondary); font-size: var(--font-size-sm); cursor: pointer;"
                        aria-label="Generate deal retrospective"
                        ?disabled=${props.tedDealRetrospectiveLoading}
                        @click=${() => props.onGenerateRetrospective(deal.deal_id)}
                      >${props.tedDealRetrospectiveLoading ? "Generating..." : "Retrospective"}</button>
                    </div>
                    ${props.tedDealRetrospectiveError ? html`<p style="color: var(--color-error); font-size: var(--font-size-sm); margin-top: var(--space-2);">${props.tedDealRetrospectiveError}</p>` : nothing}
                    ${
                      props.tedDealRetrospective &&
                      props.tedDealRetrospective.deal_id === deal.deal_id
                        ? html`
                      <div style="margin-top: var(--space-4); padding: var(--space-3); background: var(--color-bg-secondary); border-radius: var(--border-radius); font-size: var(--font-size-sm);">
                        <h4 style="font-size: var(--font-size-sm); font-weight: var(--font-weight-semibold); margin: 0 0 var(--space-2) 0;">Retrospective</h4>
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-2);">
                          <span>Timeline: ${props.tedDealRetrospective.timeline_days} days</span>
                          <span>Events: ${props.tedDealRetrospective.total_events}</span>
                          <span>Commitments: ${props.tedDealRetrospective.commitments_completed}/${props.tedDealRetrospective.total_commitments} complete</span>
                          <span>Drafts: ${props.tedDealRetrospective.drafts_executed} sent, ${props.tedDealRetrospective.drafts_archived} archived</span>
                        </div>
                        ${
                          props.tedDealRetrospective.stage_transitions.length > 0
                            ? html`
                          <div style="margin-top: var(--space-2);">
                            <span style="font-weight: var(--font-weight-medium);">Stage transitions:</span>
                            ${props.tedDealRetrospective.stage_transitions.map((t) => html`<span style="display: block; color: var(--color-text-caption);">${t.from} -> ${t.to} (${t.at})</span>`)}
                          </div>`
                            : nothing
                        }
                      </div>`
                        : nothing
                    }
                    ${props.tedDealActionError ? html`<p style="color: var(--color-error); font-size: var(--font-size-sm); margin-top: var(--space-2);">${props.tedDealActionError}</p>` : nothing}
                    ${props.tedDealActionResult ? html`<p style="color: var(--color-success); font-size: var(--font-size-sm); margin-top: var(--space-2);">${props.tedDealActionResult}</p>` : nothing}
                  </div>
                </section>`;
                    })()
                  : nothing
              }

              ${
                showOperate
                  ? html`<div class="card" style="margin-top: 16px; margin-bottom: 0;">
                      <div class="row" style="justify-content: space-between; align-items: baseline;">
                        <div class="card-title">LLM Provider</div>
                        <button
                          class="btn ghost"
                          aria-label="Refresh LLM provider configuration"
                          ?disabled=${props.llmProviderLoading}
                          @click=${() => props.onLoadLlmProvider()}
                        >${props.llmProviderLoading ? "Loading..." : "Refresh"}</button>
                      </div>
                      ${
                        props.llmProviderLoading && !props.llmProviderConfig
                          ? html`
                              <div class="muted" style="margin-top: 10px">Loading provider configuration...</div>
                            `
                          : nothing
                      }
                      ${props.llmProviderError ? html`<div class="callout danger" style="margin-top: 10px;">${props.llmProviderError}</div>` : nothing}
                      ${
                        props.llmProviderConfig
                          ? html`
                        <div class="stat-grid" style="margin-top: 10px;">
                          <div class="stat">
                            <div class="stat-label">Default Provider</div>
                            <div class="stat-value">${props.llmProviderConfig.default_provider}</div>
                          </div>
                          <div class="stat">
                            <div class="stat-label">Default Model</div>
                            <div class="stat-value">${props.llmProviderConfig.default_model}</div>
                          </div>
                          <div class="stat">
                            <div class="stat-label">Timeout</div>
                            <div class="stat-value">${props.llmProviderConfig.timeout_ms}ms</div>
                          </div>
                        </div>
                        <div style="margin-top: 14px;">
                          <div class="card-sub" style="font-weight: 600; margin-bottom: 6px;">Providers</div>
                          <div class="list">
                            ${Object.entries(props.llmProviderConfig.providers).map(
                              ([name, info]) => html`
                              <div class="list-item">
                                <div class="list-main">
                                  <div class="list-title">${name}</div>
                                  <div class="list-sub">
                                    ${info.enabled ? "Enabled" : "Disabled"}
                                    ${info.hipaa_cleared ? " · HIPAA cleared" : " · HIPAA not cleared"}
                                    ${info.api_key_set ? " · API key configured" : ""}
                                    ${info.endpoint_set ? " · Endpoint configured" : ""}
                                  </div>
                                </div>
                                <div class="list-meta">
                                  <span class="pill ${info.enabled ? "" : "warn"}">${info.enabled ? "active" : "off"}</span>
                                  ${
                                    info.hipaa_cleared
                                      ? html`
                                          <span class="pill" style="margin-top: 4px">HIPAA</span>
                                        `
                                      : nothing
                                  }
                                </div>
                              </div>
                            `,
                            )}
                          </div>
                        </div>
                        ${
                          Object.keys(props.llmProviderConfig.entity_overrides).length > 0
                            ? html`
                          <div style="margin-top: 14px;">
                            <div class="card-sub" style="font-weight: 600; margin-bottom: 6px;">Entity Overrides</div>
                            <div class="list">
                              ${Object.entries(props.llmProviderConfig.entity_overrides).map(
                                ([entity, cfg]) => html`
                                <div class="list-item">
                                  <div class="list-main">
                                    <div class="list-title">${entity}</div>
                                    <div class="list-sub">
                                      Provider: ${cfg.provider ?? "default"}
                                      ${cfg.required_hipaa_cleared ? " · HIPAA required" : ""}
                                      ${cfg.notes ? ` · ${cfg.notes}` : ""}
                                    </div>
                                  </div>
                                </div>
                              `,
                              )}
                            </div>
                          </div>
                        `
                            : nothing
                        }
                        ${
                          Object.keys(props.llmProviderConfig.per_job_overrides).length > 0
                            ? html`
                          <div style="margin-top: 14px;">
                            <div class="card-sub" style="font-weight: 600; margin-bottom: 6px;">Per-Job Overrides</div>
                            <div class="list">
                              ${Object.entries(props.llmProviderConfig.per_job_overrides).map(
                                ([jobId, cfg]) => html`
                                <div class="list-item">
                                  <div class="list-main">
                                    <div class="list-title">${jobId}</div>
                                    <div class="list-sub">Provider: ${cfg.provider}</div>
                                  </div>
                                </div>
                              `,
                              )}
                            </div>
                          </div>
                        `
                            : nothing
                        }
                        <div style="margin-top: 14px;">
                          <div class="card-sub" style="font-weight: 600; margin-bottom: 6px;">Switch Default Provider</div>
                          <div class="row" style="gap: 6px; flex-wrap: wrap;">
                            ${(
                              [
                                "openai_direct",
                                "azure_openai",
                                "copilot_extension",
                                "disabled",
                              ] as const
                            ).map(
                              (p) => html`<button
                                class="btn ${props.llmProviderConfig?.default_provider === p ? "primary" : "ghost"}"
                                aria-label=${`Switch default provider to ${p.replaceAll("_", " ")}`}
                                ?disabled=${props.llmProviderLoading}
                                @click=${() => props.onUpdateLlmProvider(p)}
                              >${p.replaceAll("_", " ")}</button>`,
                            )}
                          </div>
                        </div>
                      `
                          : nothing
                      }
                    </div>`
                  : nothing
              }

              ${
                showOperate
                  ? html`<div class="card" style="margin-top: 16px; margin-bottom: 0;">
                    <div class="row" style="justify-content: space-between; align-items: center; margin-bottom: 8px;">
                      <div class="card-title" style="margin: 0;">Upcoming Meetings</div>
                      <button class="btn ghost" aria-label="Refresh upcoming meetings" ?disabled=${props.meetingsLoading} @click=${() => props.onLoadMeetings()}>
                        ${props.meetingsLoading ? "Loading..." : "Refresh"}
                      </button>
                    </div>
                    ${props.meetingsError ? html`<p class="text-danger">${props.meetingsError}</p>` : nothing}
                    ${
                      props.meetingsLoading
                        ? html`
                            <div class="muted" style="margin-top: 8px">Loading...</div>
                          `
                        : nothing
                    }
                    ${
                      props.meetingsUpcoming?.meetings?.length
                        ? html`<ul style="list-style:none;padding:0;margin:0;">
                          ${props.meetingsUpcoming.meetings.map(
                            (m) => html`
                            <li style="padding:6px 0;border-bottom:1px solid var(--border-color,#333);">
                              <strong>${m.title}</strong>
                              <span style="float:right;opacity:0.7;">${new Date(m.start_time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                              <br/>
                              <span style="font-size:0.85em;opacity:0.8;">
                                ${m.entity} · ${m.attendees?.length || 0} attendee(s) ·
                                ${
                                  m.prep_ready
                                    ? html`
                                        <span style="color: var(--color-success, #4caf50)">Prep ready</span>
                                      `
                                    : html`
                                        <span style="color: var(--color-warning, #ff9800)">No prep</span>
                                      `
                                }
                                ${m.open_commitments > 0 ? html` · ${m.open_commitments} open commitment(s)` : nothing}
                              </span>
                            </li>
                          `,
                          )}
                        </ul>`
                        : html`
                            <p class="muted">No upcoming meetings loaded. Click Refresh to load.</p>
                          `
                    }
                  </div>`
                  : nothing
              }

              ${
                showOperate
                  ? html`<div class="card" style="margin-top: 16px; margin-bottom: 0;">
                    <div class="row" style="justify-content: space-between; align-items: center; margin-bottom: 8px;">
                      <div class="card-title" style="margin: 0;">Commitments</div>
                      <button class="btn ghost" aria-label="Refresh commitments" ?disabled=${props.commitmentsLoading} @click=${() => props.onLoadCommitments()}>
                        ${props.commitmentsLoading ? "Loading..." : "Refresh"}
                      </button>
                    </div>
                    ${props.commitmentsError ? html`<p class="text-danger">${props.commitmentsError}</p>` : nothing}
                    ${
                      props.commitmentsLoading
                        ? html`
                            <div class="muted" style="margin-top: 8px">Loading...</div>
                          `
                        : nothing
                    }
                    ${
                      props.commitments?.commitments?.length
                        ? html`<ul style="list-style:none;padding:0;margin:0;">
                          ${props.commitments.commitments.slice(0, 10).map(
                            (c) => html`
                            <li style="padding:6px 0;border-bottom:1px solid var(--border-color,#333);">
                              <strong style="max-width: 280px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; display: inline-block;" title=${c.what}>${c.what}</strong>
                              <br/>
                              <span style="font-size:0.85em;opacity:0.8;">
                                ${c.who_owes} → ${c.who_to} · ${c.entity}
                                ${c.due_date ? html` · Due: ${c.due_date}` : nothing}
                                · <span style="color:${c.status === "overdue" ? "var(--color-danger,#f44336)" : c.status === "active" ? "var(--color-success,#4caf50)" : "var(--text-muted,#999)"};">${c.status}</span>
                              </span>
                            </li>
                          `,
                          )}
                        </ul>
                        <p class="muted" style="font-size:0.85em;margin-top:4px;">${props.commitments.total_count} total</p>`
                        : html`
                            <p class="muted">No commitments loaded. Click Refresh to load.</p>
                          `
                    }
                  </div>`
                  : nothing
              }

              ${
                showOperate
                  ? html`<div class="card" style="margin-top: 16px; margin-bottom: 0;">
                    <div class="row" style="justify-content: space-between; align-items: center; margin-bottom: 8px;">
                      <div class="card-title" style="margin: 0;">Next Actions (GTD)</div>
                      <button class="btn ghost" aria-label="Refresh next actions" ?disabled=${props.actionsLoading} @click=${() => props.onLoadActions()}>
                        ${props.actionsLoading ? "Loading..." : "Refresh"}
                      </button>
                    </div>
                    ${props.actionsError ? html`<p class="text-danger">${props.actionsError}</p>` : nothing}
                    ${
                      props.actionsLoading
                        ? html`
                            <div class="muted" style="margin-top: 8px">Loading...</div>
                          `
                        : nothing
                    }
                    ${
                      props.actions?.actions?.length
                        ? html`<ul style="list-style:none;padding:0;margin:0;">
                          ${props.actions.actions.slice(0, 10).map(
                            (a) => html`
                            <li style="padding:6px 0;border-bottom:1px solid var(--border-color,#333);">
                              <strong style="max-width: 280px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; display: inline-block;" title=${a.description}>${a.description}</strong>
                              <br/>
                              <span style="font-size:0.85em;opacity:0.8;">
                                ${a.entity} · ${a.energy} energy
                                ${a.time_estimate_min ? html` · ~${a.time_estimate_min}min` : nothing}
                                ${a.due_date ? html` · Due: ${a.due_date}` : nothing}
                                ${a.context ? html` · ${a.context}` : nothing}
                              </span>
                            </li>
                          `,
                          )}
                        </ul>
                        <p class="muted" style="font-size:0.85em;margin-top:4px;">${props.actions.total_count} total</p>`
                        : html`
                            <p class="muted">No actions loaded. Click Refresh to load.</p>
                          `
                    }
                  </div>`
                  : nothing
              }

              ${
                showOperate
                  ? html`<div class="card" style="margin-top: 16px; margin-bottom: 0;">
                    <div class="row" style="justify-content: space-between; align-items: center; margin-bottom: 8px;">
                      <div class="card-title" style="margin: 0;">Waiting For</div>
                      <button class="btn ghost" aria-label="Refresh waiting-for items" ?disabled=${props.waitingForLoading} @click=${() => props.onLoadWaitingFor()}>
                        ${props.waitingForLoading ? "Loading..." : "Refresh"}
                      </button>
                    </div>
                    ${props.waitingForError ? html`<p class="text-danger">${props.waitingForError}</p>` : nothing}
                    ${
                      props.waitingForLoading
                        ? html`
                            <div class="muted" style="margin-top: 8px">Loading...</div>
                          `
                        : nothing
                    }
                    ${
                      props.waitingFor?.waiting_for?.length
                        ? html`<ul style="list-style:none;padding:0;margin:0;">
                          ${props.waitingFor.waiting_for.slice(0, 10).map(
                            (w) => html`
                            <li style="padding:6px 0;border-bottom:1px solid var(--border-color,#333);">
                              <strong>${w.description}</strong>
                              <br/>
                              <span style="font-size:0.85em;opacity:0.8;">
                                From: ${w.delegated_to} · ${w.entity}
                                ${w.expected_by ? html` · Expected: ${w.expected_by}` : nothing}
                                · <span style="color:${w.status === "overdue" ? "var(--color-danger,#f44336)" : "var(--text-muted,#999)"};">${w.status}</span>
                              </span>
                            </li>
                          `,
                          )}
                        </ul>`
                        : html`
                            <p class="muted">No waiting-for items loaded. Click Refresh to load.</p>
                          `
                    }
                  </div>`
                  : nothing
              }

              ${
                showOperate
                  ? html`<div class="card" style="margin-top: 16px; margin-bottom: 0;">
                    <div class="row" style="justify-content: space-between; align-items: center; margin-bottom: 8px;">
                      <div class="card-title" style="margin: 0;">Trust Dashboard</div>
                      <button class="btn ghost" aria-label="Refresh trust metrics" ?disabled=${props.trustMetricsLoading} @click=${() => props.onLoadTrustMetrics()}>
                        ${props.trustMetricsLoading ? "Loading..." : "Refresh"}
                      </button>
                    </div>
                    ${props.trustMetricsError ? html`<p class="text-danger">${props.trustMetricsError}</p>` : nothing}
                    ${
                      props.trustMetricsLoading
                        ? html`
                            <div class="muted" style="margin-top: 8px">Loading...</div>
                          `
                        : nothing
                    }
                    ${
                      props.trustMetrics
                        ? html`<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
                          <div style="padding:8px;border-radius:4px;background:var(--card-bg,#1e1e1e);">
                            <div style="font-size:1.5em;font-weight:bold;">${props.trustMetrics.approval_rate}%</div>
                            <div style="font-size:0.85em;opacity:0.7;">Approval Rate</div>
                          </div>
                          <div style="padding:8px;border-radius:4px;background:var(--card-bg,#1e1e1e);">
                            <div style="font-size:1.5em;font-weight:bold;">${props.trustMetrics.time_saved_estimate}</div>
                            <div style="font-size:0.85em;opacity:0.7;">Time Saved</div>
                          </div>
                          <div style="padding:8px;border-radius:4px;background:var(--card-bg,#1e1e1e);">
                            <div style="font-size:1.5em;font-weight:bold;">${props.trustMetrics.actions_completed}</div>
                            <div style="font-size:0.85em;opacity:0.7;">Actions Done</div>
                          </div>
                          <div style="padding:8px;border-radius:4px;background:var(--card-bg,#1e1e1e);">
                            <div style="font-size:1.5em;font-weight:bold;">${props.trustMetrics.commitments_completed}</div>
                            <div style="font-size:0.85em;opacity:0.7;">Commitments Done</div>
                          </div>
                        </div>
                        <p class="muted" style="font-size:0.85em;margin-top:8px;">Period: ${props.trustMetrics.period} · ${props.trustMetrics.total_decisions} decisions</p>`
                        : html`
                            <p class="muted">No trust metrics loaded. Click Refresh to load.</p>
                          `
                    }
                  </div>`
                  : nothing
              }

              ${
                showOperate
                  ? html`<div class="card" style="margin-top: 16px; margin-bottom: 0;">
                    <div class="row" style="justify-content: space-between; align-items: center; margin-bottom: 8px;">
                      <div class="card-title" style="margin: 0;">Deep Work Metrics</div>
                      <button class="btn ghost" aria-label="Refresh deep work metrics" ?disabled=${props.deepWorkMetricsLoading} @click=${() => props.onLoadDeepWorkMetrics()}>
                        ${props.deepWorkMetricsLoading ? "Loading..." : "Refresh"}
                      </button>
                    </div>
                    ${props.deepWorkMetricsError ? html`<p class="text-danger">${props.deepWorkMetricsError}</p>` : nothing}
                    ${
                      props.deepWorkMetricsLoading
                        ? html`
                            <div class="muted" style="margin-top: 8px">Loading...</div>
                          `
                        : nothing
                    }
                    ${
                      props.deepWorkMetrics
                        ? html`<div>
                          <div style="margin-bottom:8px;">
                            <div style="display:flex;justify-content:space-between;">
                              <span>Deep Work</span>
                              <span style="font-weight:bold;">${props.deepWorkMetrics.deep_work_hours}h / ${props.deepWorkMetrics.target_hours}h target</span>
                            </div>
                            <div style="height:8px;background:var(--border-color,#333);border-radius:4px;margin-top:4px;">
                              <div style="height:100%;width:${Math.min(props.deepWorkMetrics.adherence_pct, 100)}%;background:${props.deepWorkMetrics.adherence_pct >= 80 ? "var(--color-success,#4caf50)" : props.deepWorkMetrics.adherence_pct >= 50 ? "var(--color-warning,#ff9800)" : "var(--color-danger,#f44336)"};border-radius:4px;"></div>
                            </div>
                            <div style="font-size:0.85em;opacity:0.7;margin-top:4px;">${props.deepWorkMetrics.adherence_pct}% of target</div>
                          </div>
                          <div style="display:flex;gap:16px;font-size:0.85em;opacity:0.8;">
                            <span>Plans: ${props.deepWorkMetrics.plans_generated}</span>
                            <span>Actions done: ${props.deepWorkMetrics.actions_completed}</span>
                            <span>Period: ${props.deepWorkMetrics.period}</span>
                          </div>
                        </div>`
                        : html`
                            <p class="muted">No deep work metrics loaded. Click Refresh to load.</p>
                          `
                    }
                    <div style="display:flex;align-items:center;gap:8px;margin-top:8px;flex-wrap:wrap;">
                      ${
                        props.showDeepWorkInput
                          ? html`
                          <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;">
                            <input type="number" min="1" max="480" placeholder="Minutes (1-480)"
                              .value=${props.deepWorkInputMinutes}
                              @input=${(e: Event) => props.onDeepWorkInputMinutesChange((e.target as HTMLInputElement).value)}
                              style="width:130px;padding:4px 6px;border:1px solid var(--border-color,#444);border-radius:4px;background:var(--bg-secondary,#222);color:inherit;font-size:0.9em;" />
                            <input type="text" placeholder="Label (optional)"
                              .value=${props.deepWorkInputLabel}
                              @input=${(e: Event) => props.onDeepWorkInputLabelChange((e.target as HTMLInputElement).value)}
                              style="width:160px;padding:4px 6px;border:1px solid var(--border-color,#444);border-radius:4px;background:var(--bg-secondary,#222);color:inherit;font-size:0.9em;" />
                            <button class="btn ghost btn--sm" aria-label="Submit deep work session" ?disabled=${props.tedDeepWorkSessionLoading || !props.deepWorkInputMinutes || props.deepWorkInputMinutes === "0"} @click=${() => props.onDeepWorkInputSubmit()}>${props.tedDeepWorkSessionLoading ? "Logging..." : "Start"}</button>
                            <button class="btn ghost btn--sm" aria-label="Cancel deep work input" @click=${() => props.onDeepWorkInputToggle()}>Cancel</button>
                          </div>`
                          : html`<button class="btn ghost btn--sm" aria-label="Log deep work session" ?disabled=${props.tedDeepWorkSessionLoading} @click=${() => props.onDeepWorkInputToggle()}>Log Deep Work Session</button>`
                      }
                      ${props.tedDeepWorkSessionError ? html`<span class="text-danger" style="font-size:0.85em;">${props.tedDeepWorkSessionError}</span>` : nothing}
                      ${
                        props.tedDeepWorkSessionResult
                          ? html`
                              <span class="text-success" style="font-size: 0.85em">Session logged successfully.</span>
                            `
                          : nothing
                      }
                    </div>
                  </div>`
                  : nothing
              }

              ${
                showOperate
                  ? html`<div class="card" style="margin-top: 16px; margin-bottom: 0;">
                    <div class="row" style="justify-content: space-between; align-items: center; margin-bottom: 8px;">
                      <div class="card-title" style="margin: 0;">Draft Queue</div>
                      <button class="btn ghost" aria-label="Refresh draft queue" ?disabled=${props.draftQueueLoading} @click=${() => props.onLoadDraftQueue()}>
                        ${props.draftQueueLoading ? "Loading..." : "Refresh"}
                      </button>
                    </div>
                    ${props.draftQueueError ? html`<p class="text-danger">${props.draftQueueError}</p>` : nothing}
                    ${
                      props.draftQueueLoading
                        ? html`
                            <div class="muted" style="margin-top: 8px">Loading...</div>
                          `
                        : nothing
                    }
                    ${props.tedDraftSubmitReviewError ? html`<p class="text-danger">${props.tedDraftSubmitReviewError}</p>` : nothing}
                    ${
                      props.draftQueue && props.draftQueue.drafts.length > 0
                        ? html`<div>
                          <p class="muted" style="font-size:0.85em;margin-bottom:8px;">${props.draftQueue.count} draft(s) in queue</p>
                          ${props.draftQueue.drafts.map(
                            (d) => html`
                            <div style="padding:8px;border-radius:4px;background:var(--card-bg,#1e1e1e);margin-bottom:6px;">
                              <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;">
                                <span class="pill" style="font-size:0.75em;">${d.state}</span>
                                <strong style="max-width: 280px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; display: inline-block; font-size:0.95em;" title=${d.subject || "(no subject)"}>${d.subject || "(no subject)"}</strong>
                              </div>
                              <div style="display:flex;gap:12px;font-size:0.85em;opacity:0.8;">
                                ${d.to ? html`<span>To: ${d.to}</span>` : nothing}
                                ${d.from_profile ? html`<span>From: ${d.from_profile}</span>` : nothing}
                                ${d.draft_kind ? html`<span>Kind: ${d.draft_kind}</span>` : nothing}
                              </div>
                              <div style="font-size:0.8em;opacity:0.6;margin-top:4px;">
                                Updated: ${new Date(d.updated_at).toLocaleString()}
                              </div>
                              ${d.state === "drafted" || d.state === "edited" ? html`<button class="btn ghost btn--sm" style="margin-top:4px;" aria-label="Submit draft for review" ?disabled=${props.tedDraftSubmitReviewLoading} @click=${() => props.onTedDraftSubmitReview?.(d.draft_id)}>Submit Review</button>` : nothing}
                            </div>
                          `,
                          )}
                        </div>`
                        : html`
                            <p class="muted">No drafts in queue. Click Refresh to load.</p>
                          `
                    }
                  </div>`
                  : nothing
              }

              ${
                showOperate
                  ? html`<div class="card" style="margin-top: 16px; margin-bottom: 0;">
                    <div class="row" style="justify-content: space-between; align-items: center; margin-bottom: 8px;">
                      <div class="card-title" style="margin: 0;">Event Log Health</div>
                      <button class="btn ghost" aria-label="Refresh event log stats" ?disabled=${props.eventLogStatsLoading} @click=${() => props.onLoadEventLogStats()}>
                        ${props.eventLogStatsLoading ? "Loading..." : "Refresh"}
                      </button>
                    </div>
                    ${props.eventLogStatsError ? html`<p class="text-danger">${props.eventLogStatsError}</p>` : nothing}
                    ${
                      props.eventLogStatsLoading
                        ? html`
                            <div class="muted" style="margin-top: 8px">Loading...</div>
                          `
                        : nothing
                    }
                    ${
                      props.eventLogStats
                        ? html`<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
                          <div style="padding:8px;border-radius:4px;background:var(--card-bg,#1e1e1e);">
                            <div style="font-size:1.5em;font-weight:bold;">${props.eventLogStats.total_events}</div>
                            <div style="font-size:0.85em;opacity:0.7;">Total Events</div>
                          </div>
                          <div style="padding:8px;border-radius:4px;background:var(--card-bg,#1e1e1e);">
                            <div style="font-size:1.1em;font-weight:bold;">${props.eventLogStats.last_event_at ?? "N/A"}</div>
                            <div style="font-size:0.85em;opacity:0.7;">Last Event</div>
                          </div>
                        </div>
                        ${(() => {
                          const entries = Object.entries(props.eventLogStats.event_type_counts);
                          const top5 = entries.toSorted((a, b) => b[1] - a[1]).slice(0, 5);
                          return top5.length > 0
                            ? html`<div style="margin-top:12px;">
                                <div style="font-size:0.85em;font-weight:bold;margin-bottom:6px;opacity:0.8;">Top Event Types</div>
                                ${top5.map(
                                  ([
                                    type,
                                    count,
                                  ]) => html`<div style="display:flex;justify-content:space-between;padding:4px 0;border-bottom:1px solid var(--border-color,#333);font-size:0.85em;">
                                    <span>${type}</span>
                                    <span style="font-weight:bold;">${count}</span>
                                  </div>`,
                                )}
                              </div>`
                            : html`
                                <p class="muted" style="font-size: 0.85em; margin-top: 8px">No event types recorded yet.</p>
                              `;
                        })()}`
                        : html`
                            <p class="muted">No event log stats loaded. Click Refresh to load.</p>
                          `
                    }
                  </div>`
                  : nothing
              }

              ${
                showOperate
                  ? html`<div class="card" style="margin-top: 16px; margin-bottom: 0;">
                    <div class="row" style="justify-content: space-between; align-items: center; margin-bottom: 8px;">
                      <div class="card-title" style="margin: 0;">Planner Tasks</div>
                      <button class="btn ghost" aria-label="Refresh planner tasks" ?disabled=${props.plannerPlansLoading} @click=${() => props.onLoadPlannerPlans()}>
                        ${props.plannerPlansLoading ? "Loading..." : "Refresh"}
                      </button>
                    </div>
                    ${props.plannerPlansError ? html`<p class="text-danger">${props.plannerPlansError}</p>` : nothing}
                    ${
                      props.plannerPlansLoading
                        ? html`
                            <div class="muted" style="margin-top: 8px">Loading...</div>
                          `
                        : nothing
                    }
                    ${
                      props.plannerPlans?.plans?.length
                        ? props.plannerPlans.plans.map(
                            (plan: TedPlannerListResponse["plans"][number]) => html`
                      <div style="margin-top:0.5rem">
                        <div style="display:flex;justify-content:space-between;align-items:center">
                          <span style="font-weight:600">${plan.title}</span>
                          <span class="muted" style="font-size:0.8rem">${plan.tasks_complete}/${plan.tasks_total} done</span>
                        </div>
                        ${
                          plan.buckets?.length
                            ? plan.buckets.map(
                                (b) => html`
                          <div style="margin-left:1rem;padding:0.25rem 0;border-bottom:1px solid var(--border-color,#333);display:flex;justify-content:space-between;cursor:pointer"
                            role="button" tabindex="0"
                            aria-label=${`Load tasks for bucket ${b.name}`}
                            @click=${() => props.onLoadPlannerTasks(props.plannerPlans?.profile_id || "olumie", plan.plan_id, b.id)}
                            @keydown=${(e: KeyboardEvent) => {
                              if (e.key === "Enter" || e.key === " ") {
                                e.preventDefault();
                                props.onLoadPlannerTasks(
                                  props.plannerPlans?.profile_id || "olumie",
                                  plan.plan_id,
                                  b.id,
                                );
                              }
                            }}>
                            <span>${b.name}</span>
                            <span class="muted" style="font-size:0.8rem">${b.tasks_count} tasks</span>
                          </div>
                        `,
                              )
                            : html`
                                <div class="muted" style="margin-left: 1rem">No buckets</div>
                              `
                        }
                      </div>
                    `,
                          )
                        : !props.plannerPlansLoading
                          ? html`
                              <p class="muted">No plans loaded. Click Refresh.</p>
                            `
                          : nothing
                    }
                    ${props.plannerTasksError ? html`<p class="text-danger">${props.plannerTasksError}</p>` : nothing}
                    ${
                      props.plannerTasks?.tasks?.length
                        ? html`
                      <div style="margin-top:0.75rem;border-top:1px solid var(--border-color,#333);padding-top:0.5rem">
                        <div style="font-size:0.85em;font-weight:bold;margin-bottom:6px;opacity:0.8;">Tasks ${props.plannerTasks.bucket_id ? "(filtered)" : ""}</div>
                        ${props.plannerTasks.tasks.map(
                          (t) => html`
                          <div style="display:flex;justify-content:space-between;padding:0.25rem 0;border-bottom:1px solid var(--border-color,#333)">
                            <span>${t.title}</span>
                            <span class="pill" style="font-size:0.75rem">${t.percent_complete === 100 ? "Done" : t.percent_complete + "%"}</span>
                          </div>
                        `,
                        )}
                      </div>
                    `
                        : nothing
                    }
                    ${
                      props.plannerTasksLoading
                        ? html`
                            <p class="muted">Loading tasks...</p>
                          `
                        : nothing
                    }
                  </div>`
                  : nothing
              }

              ${
                showOperate
                  ? html`<div class="card" style="margin-top: 16px; margin-bottom: 0;">
                    <div class="row" style="justify-content: space-between; align-items: center; margin-bottom: 8px;">
                      <div class="card-title" style="margin: 0;">To Do Actions</div>
                      <button class="btn ghost" aria-label="Refresh to-do lists" ?disabled=${props.todoListsLoading} @click=${() => props.onLoadTodoLists()}>
                        ${props.todoListsLoading ? "Loading..." : "Refresh"}
                      </button>
                    </div>
                    ${props.todoListsError ? html`<p class="text-danger">${props.todoListsError}</p>` : nothing}
                    ${
                      props.todoListsLoading
                        ? html`
                            <div class="muted" style="margin-top: 8px">Loading...</div>
                          `
                        : nothing
                    }
                    ${
                      props.todoLists?.lists?.length
                        ? props.todoLists.lists.map(
                            (l) => html`
                      <div style="display:flex;justify-content:space-between;padding:0.25rem 0;border-bottom:1px solid var(--border-color,#333);cursor:pointer"
                        role="button" tabindex="0"
                        aria-label=${`Load tasks for list ${l.display_name}`}
                        @click=${() => props.onLoadTodoTasks(props.todoLists?.profile_id || "olumie", l.id)}
                        @keydown=${(e: KeyboardEvent) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            props.onLoadTodoTasks(props.todoLists?.profile_id || "olumie", l.id);
                          }
                        }}>
                        <span>${l.display_name}</span>
                        <span class="muted" style="font-size:0.8rem">${l.tasks_count || 0} tasks</span>
                      </div>
                    `,
                          )
                        : !props.todoListsLoading
                          ? html`
                              <p class="muted">No lists loaded. Click Refresh.</p>
                            `
                          : nothing
                    }
                    ${props.todoTasksError ? html`<p class="text-danger">${props.todoTasksError}</p>` : nothing}
                    ${
                      props.todoTasks?.tasks?.length
                        ? html`
                      <div style="margin-top:0.75rem;border-top:1px solid var(--border-color,#333);padding-top:0.5rem">
                        <div style="font-size:0.85em;font-weight:bold;margin-bottom:6px;opacity:0.8;">${props.todoTasks.list_name || "Tasks"}</div>
                        ${props.todoTasks.tasks.map(
                          (t) => html`
                          <div style="display:flex;justify-content:space-between;padding:0.25rem 0;border-bottom:1px solid var(--border-color,#333)">
                            <span>${t.title}</span>
                            <div>
                              <span class="pill" style="font-size:0.75rem;margin-right:0.25rem">${t.importance}</span>
                              <span class="pill" style="font-size:0.75rem">${t.status}</span>
                            </div>
                          </div>
                        `,
                        )}
                      </div>
                    `
                        : nothing
                    }
                    ${
                      props.todoTasksLoading
                        ? html`
                            <p class="muted">Loading tasks...</p>
                          `
                        : nothing
                    }
                  </div>`
                  : nothing
              }

              ${
                showOperate
                  ? html`<div class="card" style="margin-top: 16px; margin-bottom: 0;">
                    <div class="row" style="justify-content: space-between; align-items: center; margin-bottom: 8px;">
                      <div class="card-title" style="margin: 0;">M365 Sync</div>
                      <div style="display:flex;gap:0.5rem">
                        <button class="btn ghost" aria-label="Run M365 sync reconciliation" ?disabled=${props.syncReconciliationLoading} @click=${() => props.onRunReconciliation()}>
                          ${props.syncReconciliationLoading ? "Reconciling..." : "Run Reconciliation"}
                        </button>
                        <button class="btn ghost" aria-label="Load sync proposals" ?disabled=${props.syncProposalsLoading} @click=${() => props.onLoadSyncProposals()}>
                          ${props.syncProposalsLoading ? "Loading..." : "Proposals"}
                        </button>
                      </div>
                    </div>
                    ${props.syncReconciliationError ? html`<p class="text-danger">${props.syncReconciliationError}</p>` : nothing}
                    ${props.syncApproveError ? html`<p class="text-danger">${props.syncApproveError}</p>` : nothing}
                    ${props.syncRejectError ? html`<p class="text-danger">${props.syncRejectError}</p>` : nothing}
                    ${props.syncApproveResult ? html`<p class="text-success" style="font-size:0.85em;">${props.syncApproveResult}</p>` : nothing}
                    ${props.syncRejectResult ? html`<p class="text-success">${props.syncRejectResult}</p>` : nothing}
                    ${
                      props.syncReconciliation
                        ? html`
                      <div style="margin-top:0.5rem">
                        <div style="display:flex;gap:1rem;margin-bottom:0.5rem">
                          <span class="muted" style="font-size:0.85em;">Local: ${props.syncReconciliation.local_counts?.commitments || 0} commitments, ${props.syncReconciliation.local_counts?.gtd_actions || 0} actions</span>
                          <span class="muted" style="font-size:0.85em;">Remote: ${props.syncReconciliation.remote_counts?.planner_tasks || 0} planner, ${props.syncReconciliation.remote_counts?.todo_tasks || 0} todo</span>
                        </div>
                        ${
                          props.syncReconciliation.drift_items?.length
                            ? html`
                          <div style="font-size:0.85em;font-weight:bold;margin-bottom:6px;opacity:0.8;">Drift Detected (${props.syncReconciliation.drift_items.length})</div>
                          ${props.syncReconciliation.drift_items.map(
                            (d) => html`
                            <div style="padding:0.25rem 0;border-bottom:1px solid var(--border-color,#333)">
                              <div style="display:flex;justify-content:space-between">
                                <span style="font-weight:500">${d.local_value || d.remote_value}</span>
                                <span class="pill" style="font-size:0.75rem">${d.target}</span>
                              </div>
                              <div class="muted" style="font-size:0.8rem">${d.recommendation}</div>
                            </div>
                          `,
                          )}
                        `
                            : html`
                                <p class="muted" style="font-size: 0.85em">No drift detected.</p>
                              `
                        }
                        ${
                          props.syncReconciliation.proposed_writes?.length
                            ? html`
                          <div style="font-size:0.85em;font-weight:bold;margin-top:0.5rem;margin-bottom:6px;opacity:0.8;">Proposed Writes (${props.syncReconciliation.proposed_writes.length})</div>
                          ${props.syncReconciliation.proposed_writes.map(
                            (p) => html`
                            <div style="padding:0.4rem 0;border-bottom:1px solid var(--border-color,#333)">
                              <div style="display:flex;justify-content:space-between;align-items:center">
                                <div>
                                  <span style="max-width: 280px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; display: inline-block; font-weight:500" title=${p.title}>${p.title}</span>
                                  <span class="pill" style="font-size:0.7rem;margin-left:0.25rem">${p.target_system} ${p.action}</span>
                                </div>
                                <div style="display:flex;gap:0.25rem">
                                  ${
                                    p.status === "pending"
                                      ? html`
                                    <button class="btn ghost"
                                      aria-label="Approve sync proposal"
                                      ?disabled=${props.syncApproveBusy === p.proposal_id}
                                      @click=${() => props.onApproveSyncProposal(props.syncReconciliation?.profile_id || "olumie", p.proposal_id)}>
                                      ${props.syncApproveBusy === p.proposal_id ? "Syncing..." : "Approve"}
                                    </button>
                                    <button class="btn ghost"
                                      aria-label="Reject sync proposal"
                                      ?disabled=${props.syncRejectBusy === p.proposal_id}
                                      @click=${() => props.onRejectSyncProposal(props.syncReconciliation?.profile_id || "olumie", p.proposal_id)}>
                                      ${props.syncRejectBusy === p.proposal_id ? "Rejecting..." : "Reject"}
                                    </button>
                                  `
                                      : html`<span class="pill" style="font-size:0.7rem">${p.status}</span>`
                                  }
                                </div>
                              </div>
                            </div>
                          `,
                          )}
                        `
                            : nothing
                        }
                      </div>
                    `
                        : nothing
                    }
                    ${
                      props.syncProposals?.proposals?.length
                        ? html`
                      <div style="margin-top:0.75rem;border-top:1px solid var(--border-color,#333);padding-top:0.5rem">
                        <div style="font-size:0.85em;font-weight:bold;margin-bottom:6px;opacity:0.8;">All Proposals (${props.syncProposals.total_count})</div>
                        ${props.syncProposals.proposals.slice(0, 20).map(
                          (p) => html`
                          <div style="display:flex;justify-content:space-between;padding:0.2rem 0;font-size:0.85rem">
                            <span style="max-width: 280px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; display: inline-block;" title=${p.title}>${p.title}</span>
                            <span class="pill" style="font-size:0.7rem">${p.status}</span>
                          </div>
                        `,
                        )}
                      </div>
                    `
                        : nothing
                    }
                    ${props.syncProposalsError ? html`<p class="text-danger">${props.syncProposalsError}</p>` : nothing}
                  </div>`
                  : nothing
              }

              ${
                showOperate && props.extractionResult
                  ? html`<div class="card" style="margin-top: 16px; margin-bottom: 0;">
                    <div class="card-title">Extracted Commitments</div>
                    <div class="muted" style="font-size:0.8rem">From: ${props.extractionResult.source_subject || "email"}${
                      props.extractionResult.extraction_source === "fallback"
                        ? html`
                            <span
                              class="pill"
                              style="font-size: 0.7rem; background: var(--warning-bg, #5a4b00); margin-left: 6px"
                              >fallback</span
                            >
                          `
                        : nothing
                    }</div>
                    ${
                      props.extractionResult.detected?.length
                        ? props.extractionResult.detected.map(
                            (c) => html`
                      <div style="padding:0.4rem 0;border-bottom:1px solid var(--border-color,#333)">
                        <div style="max-width: 280px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-weight:500" title=${c.what}>${c.what}</div>
                        <div class="muted" style="font-size:0.85rem">${c.who_owes} -> ${c.who_to}${c.due_date ? ` by ${c.due_date}` : ""}</div>
                        <div style="display:flex;justify-content:space-between;align-items:center;margin-top:0.2rem">
                          <span class="muted" style="font-size:0.8rem;font-style:italic">"${c.source_text?.slice(0, 80)}..."</span>
                          <span class="pill" style="font-size:0.7rem">${Math.round(c.confidence * 100)}%</span>
                        </div>
                      </div>
                    `,
                          )
                        : props.extractionResult.extraction_status === "extraction_failed"
                          ? html`
                              <p class="text-danger" style="margin-top: 4px">Extraction unavailable — manual review required</p>
                            `
                          : html`
                              <p class="muted">No commitments detected in this email.</p>
                            `
                    }
                  </div>`
                  : nothing
              }
              ${
                showOperate && props.extractionLoading
                  ? html`
                      <p class="muted" style="margin-top: 8px">Extracting commitments...</p>
                    `
                  : nothing
              }
              ${showOperate && props.extractionError ? html`<p class="text-danger" style="margin-top:8px;">${props.extractionError}</p>` : nothing}

              ${showOperate ? renderIngestionStatusCard(props) : nothing}
              ${showOperate ? renderDiscoveryStatusCard(props) : nothing}

              <!-- SharePoint Documents -->
              ${
                showOperate
                  ? html`
              <div class="card" style="margin-top: 16px; margin-bottom: 0;">
                <div class="card-title">SharePoint Documents</div>
                <div class="row" style="gap: 8px; align-items: center; margin-top: 8px;">
                  <label>Profile:</label>
                  <select @change=${(e: Event) => props.onSharePointSelectProfile((e.target as HTMLSelectElement).value)}>
                    <option value="olumie" ?selected=${props.tedSharePointSelectedProfile === "olumie"}>Olumie Capital</option>
                    <option value="everest" ?selected=${props.tedSharePointSelectedProfile === "everest"}>Everest Management</option>
                  </select>
                  <button class="btn btn--sm" @click=${props.onSharePointLoadSites} ?disabled=${props.tedSharePointSitesLoading}>
                    ${props.tedSharePointSitesLoading ? "Loading..." : "Load Sites"}
                  </button>
                </div>
                ${props.tedSharePointSitesError ? html`<div class="text-danger" style="margin-top:8px;">${props.tedSharePointSitesError}</div>` : nothing}

                ${
                  props.tedSharePointSites && props.tedSharePointSites.length > 0
                    ? html`
                  <div class="row" style="gap: 8px; align-items: center; margin-top: 8px;">
                    <label>Site:</label>
                    <select @change=${(e: Event) => {
                      props.onSharePointSelectSite((e.target as HTMLSelectElement).value);
                    }}>
                      <option value="">-- Select site --</option>
                      ${props.tedSharePointSites.map((s) => html`<option value=${s.id} ?selected=${props.tedSharePointSelectedSiteId === s.id}>${s.displayName}</option>`)}
                    </select>
                    <button class="btn btn--sm" @click=${props.onSharePointLoadDrives} ?disabled=${props.tedSharePointDrivesLoading || !props.tedSharePointSelectedSiteId}>
                      ${props.tedSharePointDrivesLoading ? "Loading..." : "Load Libraries"}
                    </button>
                  </div>
                  ${props.tedSharePointDrivesError ? html`<div class="text-danger" style="margin-top:8px;">${props.tedSharePointDrivesError}</div>` : nothing}
                `
                    : nothing
                }

                ${
                  props.tedSharePointDrives && props.tedSharePointDrives.length > 0
                    ? html`
                  <div class="row" style="gap: 8px; align-items: center; margin-top: 8px;">
                    <label>Library:</label>
                    <select @change=${(e: Event) => {
                      props.onSharePointSelectDrive((e.target as HTMLSelectElement).value);
                    }}>
                      <option value="">-- Select library --</option>
                      ${props.tedSharePointDrives.map((d) => html`<option value=${d.id} ?selected=${props.tedSharePointSelectedDriveId === d.id}>${d.name} (${d.driveType})</option>`)}
                    </select>
                    <button class="btn btn--sm" @click=${() => props.onSharePointLoadItems()} ?disabled=${props.tedSharePointItemsLoading || !props.tedSharePointSelectedDriveId}>
                      ${props.tedSharePointItemsLoading ? "Loading..." : "Browse"}
                    </button>
                  </div>
                `
                    : nothing
                }

                ${
                  props.tedSharePointSelectedDriveId
                    ? html`
                  <div class="row" style="gap: 8px; align-items: center; margin-top: 8px;">
                    <label>Search:</label>
                    <input type="text" .value=${props.tedSharePointSearchQuery}
                      @input=${(e: Event) => props.onSharePointSetSearchQuery((e.target as HTMLInputElement).value)}
                      placeholder="Search files..." />
                    <button class="btn btn--sm" @click=${props.onSharePointSearch} ?disabled=${props.tedSharePointSearchLoading || !props.tedSharePointSearchQuery.trim()}>
                      ${props.tedSharePointSearchLoading ? "Searching..." : "Search"}
                    </button>
                  </div>
                  ${props.tedSharePointSearchError ? html`<div class="text-danger" style="margin-top:8px;">${props.tedSharePointSearchError}</div>` : nothing}
                `
                    : nothing
                }

                ${
                  props.tedSharePointItemsPath && props.tedSharePointItemsPath !== "/"
                    ? html`
                  <div style="margin-top:8px; display:flex; align-items:center; gap:8px;">
                    <span class="muted" style="font-size:0.85em;">Path: ${props.tedSharePointItemsPath}</span>
                    <button class="btn btn--sm ghost" @click=${() => {
                      const parts = props.tedSharePointItemsPath.split("/").filter(Boolean);
                      parts.pop();
                      const newPath = parts.length > 0 ? parts.join("/") : "/";
                      props.onSharePointSetPath(newPath);
                      props.onSharePointLoadItems();
                    }}>Up</button>
                    <button class="btn btn--sm ghost" @click=${() => {
                      props.onSharePointSetPath("/");
                      props.onSharePointLoadItems();
                    }}>Root</button>
                  </div>
                `
                    : nothing
                }

                ${props.tedSharePointItemsError ? html`<div class="text-danger" style="margin-top:8px;">${props.tedSharePointItemsError}</div>` : nothing}

                ${
                  props.tedSharePointItems && props.tedSharePointItems.length > 0
                    ? html`
                  <table class="ted-table" style="width:100%; margin-top:8px; font-size:0.85em; border-collapse:collapse;">
                    <thead><tr><th style="text-align:left;padding:4px 8px;">Name</th><th style="text-align:left;padding:4px 8px;">Type</th><th style="text-align:right;padding:4px 8px;">Size</th><th style="text-align:left;padding:4px 8px;">Modified</th><th style="text-align:left;padding:4px 8px;">Actions</th></tr></thead>
                    <tbody>
                      ${props.tedSharePointItems.map(
                        (item) => html`
                        <tr style="border-bottom:1px solid var(--border-color,#333);">
                          <td style="padding:4px 8px;">${item.name}</td>
                          <td style="padding:4px 8px;">${item.isFolder ? "Folder" : item.mimeType || "File"}</td>
                          <td style="padding:4px 8px;text-align:right;">${item.isFolder ? "-" : formatFileSize(item.size)}</td>
                          <td style="padding:4px 8px;">${item.lastModifiedDateTime ? new Date(item.lastModifiedDateTime).toLocaleDateString() : "-"}</td>
                          <td style="padding:4px 8px;">
                            ${item.isFolder ? html`<button class="btn btn--sm ghost" @click=${() => props.onSharePointLoadItems(item.id)}>Open</button>` : nothing}
                            ${item.webUrl ? html`<a href=${item.webUrl} target="_blank" rel="noopener" style="color:var(--color-accent);">View</a>` : nothing}
                          </td>
                        </tr>
                      `,
                      )}
                    </tbody>
                  </table>
                `
                    : props.tedSharePointItems !== null
                      ? html`
                          <div class="muted" style="margin-top: 8px">No items in this folder</div>
                        `
                      : nothing
                }

                ${
                  props.tedSharePointSearchResults && props.tedSharePointSearchResults.length > 0
                    ? html`
                  <div style="margin-top:12px; font-weight:600; font-size:0.9em;">Search Results</div>
                  <table class="ted-table" style="width:100%; margin-top:4px; font-size:0.85em; border-collapse:collapse;">
                    <thead><tr><th style="text-align:left;padding:4px 8px;">Name</th><th style="text-align:left;padding:4px 8px;">Type</th><th style="text-align:right;padding:4px 8px;">Size</th><th style="text-align:left;padding:4px 8px;">Path</th></tr></thead>
                    <tbody>
                      ${props.tedSharePointSearchResults.map(
                        (item) => html`
                        <tr style="border-bottom:1px solid var(--border-color,#333);">
                          <td style="padding:4px 8px;">${item.name}</td>
                          <td style="padding:4px 8px;">${item.isFolder ? "Folder" : item.mimeType || "File"}</td>
                          <td style="padding:4px 8px;text-align:right;">${item.isFolder ? "-" : formatFileSize(item.size)}</td>
                          <td style="padding:4px 8px;">${item.parentPath || "-"}</td>
                        </tr>
                      `,
                      )}
                    </tbody>
                  </table>
                `
                    : props.tedSharePointSearchResults !== null &&
                        props.tedSharePointSearchResults.length === 0
                      ? html`
                          <div class="muted" style="margin-top: 8px">No search results</div>
                        `
                      : nothing
                }

                ${props.tedSharePointUploadResult ? html`<div class="text-success" style="margin-top:8px;">${props.tedSharePointUploadResult}</div>` : nothing}
                ${props.tedSharePointUploadError ? html`<div class="text-danger" style="margin-top:8px;">${props.tedSharePointUploadError}</div>` : nothing}
                ${props.tedSharePointFolderResult ? html`<div class="text-success" style="margin-top:8px;">${props.tedSharePointFolderResult}</div>` : nothing}
                ${props.tedSharePointFolderError ? html`<div class="text-danger" style="margin-top:8px;">${props.tedSharePointFolderError}</div>` : nothing}
              </div>
              `
                  : nothing
              }

              ${
                showOperate || showBuild
                  ? html`<div class="card" style="margin-top: 16px; margin-bottom: 0;">
                <div class="row" style="justify-content: space-between; align-items: baseline;">
                  <div class="card-title">Execution Plan</div>
                  <div class="muted" style="font-size: 12px; opacity: 0.7; font-style: italic;">
                    Card family breakdown (classification, not filters):
                    GOV&nbsp;${familyCounts.GOV ?? 0} · MNT&nbsp;${familyCounts.MNT ?? 0} · ING&nbsp;${familyCounts.ING ?? 0} · LED&nbsp;${familyCounts.LED ?? 0} · OUT&nbsp;${familyCounts.OUT ?? 0}
                  </div>
                </div>
                <div class="card-sub">
                  Open a work item to see its outcome, constraints, and proof evidence. Run proof checks when ready, and use Suggest KPIs to build promotion confidence.
                </div>
                <div class="list" style="margin-top: 10px;">
                  ${
                    snapshot.job_cards.cards.length === 0
                      ? html`
                          <div class="muted">
                            No work items in the execution plan yet. Cards will appear as Ted processes the job board.
                          </div>
                        `
                      : snapshot.job_cards.cards.slice(0, 12).map(
                          (card) => html`<div class="list-item">
                      <div class="list-main">
                        <div class="list-title">${card.id} - ${card.title}</div>
                        <div class="list-sub">${card.operator_summary}</div>
                        <div class="list-sub mono">${card.path}</div>
                        <div class="muted" style="margin-top: 6px;">
                          deps:
                          ${card.dependencies.length > 0 ? card.dependencies.join(", ") : "none"}
                        </div>
                        <div class="muted" style="margin-top: 6px;">
                          KPI signals:
                          ${card.kpi_signals.length > 0 ? card.kpi_signals.join("; ") : "not defined yet"}
                        </div>
                      </div>
                      <div class="list-meta">
                        <span class="pill">${familyLabel(card.family)}</span>
                        <div class="muted mono" style="margin-top: 6px; text-align: right;">${card.family}</div>
                        <span class="pill ${toneForJobCardStatus(card.status)}"
                          >${labelForJobCardStatus(card.status)}</span
                        >
                        <span class="pill ${toneForConfidenceBand(card.promotion_confidence.band)}" style="margin-top: 6px;">
                          ${labelForConfidenceBand(card.promotion_confidence.band)}
                        </span>
                        <div class="muted mono" style="margin-top: 6px;">
                          promotion confidence: ${card.promotion_confidence.score}/100
                        </div>
                        <div class="muted mono" style="margin-top: 6px; max-width: 360px;">
                          ${card.proof_script ?? "No proof check linked yet"}
                        </div>
                        ${
                          card.proof_script
                            ? html`<button
                                class="btn ghost mono"
                                style="margin-top: 8px;"
                                aria-label="Run proof check"
                                ?disabled=${props.proofBusyKey !== null}
                                @click=${() => props.onRunProof(card.proof_script!)}
                              >
                                ${
                                  props.proofBusyKey === card.proof_script
                                    ? "Running..."
                                    : "Run proof"
                                }
                              </button>`
                            : nothing
                        }
                        <button
                          class="btn ghost mono"
                          style="margin-top: 8px;"
                          aria-label="View job card details"
                          @click=${() => props.onOpenJobCard(card.id)}
                        >
                          ${
                            props.jobCardDetailLoading && props.jobCardDetail?.id === card.id
                              ? "Loading..."
                              : "View Details"
                          }
                        </button>
                      </div>
                    </div>`,
                        )
                  }
                </div>
                ${
                  props.proofError
                    ? html`<pre class="callout danger mono" style="margin-top: 10px;">${props.proofError}</pre>`
                    : nothing
                }
                ${
                  props.proofResult
                    ? html`<pre class="mono" style="margin-top: 10px; white-space: pre-wrap;">${props.proofResult}</pre>`
                    : nothing
                }
              </div>`
                  : nothing
              }

              ${
                showOperate || showBuild
                  ? html`<div id="ted-job-card-detail" class="card" style="margin-top: 16px; margin-bottom: 0;">
                <div class="card-title">Work Item Details</div>
                <div class="card-sub">
                  Outcome, constraints, and evidence for this specific work item. Each card tracks what must be true (non-negotiables), what you deliver, proof evidence that validates the work, and KPI signals that drive promotion confidence.
                </div>
                ${
                  props.jobCardDetailError
                    ? html`<div class="callout danger" style="margin-top: 10px;">${props.jobCardDetailError}</div>`
                    : nothing
                }
                ${
                  props.jobCardDetail
                    ? html`
                        <div class="list" style="margin-top: 10px;">
                          <div class="list-item">
                            <div class="list-main">
                          <div class="list-title">
                                ${props.jobCardDetail.id} - ${props.jobCardDetail.title}
                              </div>
                              <div class="list-sub">${props.jobCardDetail.operator_summary}</div>
                              <div class="list-sub mono">${props.jobCardDetail.path}</div>
                            </div>
                            <div class="list-meta">
                              <span class="pill">${familyLabel(props.jobCardDetail.family)}</span>
                              <div class="muted mono" style="margin-top: 6px; text-align: right;">${props.jobCardDetail.family}</div>
                              <span class="pill ${toneForJobCardStatus(props.jobCardDetail.status)}"
                                >${labelForJobCardStatus(props.jobCardDetail.status)}</span
                              >
                            </div>
                          </div>
                        </div>
                        <div class="grid grid-cols-2" style="margin-top: 10px;">
                          <div>
                            <div class="card-sub">Outcome</div>
                            <div class="muted">${props.jobCardDetail.outcome ?? "Not specified. Add an outcome to the card markdown to define the goal."}</div>
                          </div>
                          <div>
                            <div class="card-sub">Dependencies</div>
                            <div class="muted">
                              ${
                                props.jobCardDetail.dependencies.length > 0
                                  ? props.jobCardDetail.dependencies.join(", ")
                                  : "No dependencies. This card can proceed independently."
                              }
                            </div>
                          </div>
                        </div>
                        <div class="grid grid-cols-2" style="margin-top: 10px;">
                          <div>
                            <div class="card-sub">Non-negotiables</div>
                            <div class="muted">
                              ${
                                props.jobCardDetail.non_negotiables.length > 0
                                  ? props.jobCardDetail.non_negotiables.join("; ")
                                  : "None defined. Add non_negotiables to the card markdown to set hard constraints."
                              }
                            </div>
                          </div>
                          <div>
                            <div class="card-sub">Deliverables</div>
                            <div class="muted">
                              ${
                                props.jobCardDetail.deliverables.length > 0
                                  ? props.jobCardDetail.deliverables.join("; ")
                                  : "None defined. Add deliverables to the card markdown to track outputs."
                              }
                            </div>
                          </div>
                        </div>
                        <div class="card-sub" style="margin-top: 10px;">Proof evidence</div>
                        <div class="muted">
                          ${
                            props.jobCardDetail.proof_evidence.length > 0
                              ? props.jobCardDetail.proof_evidence.join("; ")
                              : "No execution evidence section yet. Add a proof_script path to the card markdown to link a validation check."
                          }
                        </div>
                        <div class="card-sub" style="margin-top: 10px;">KPI signals for this card</div>
                        <div class="muted">
                          ${
                            props.jobCardDetail.kpi_signals.length > 0
                              ? props.jobCardDetail.kpi_signals.join("; ")
                              : "No KPI signals defined yet. Use Suggest KPIs below, or add a kpi_signals section to the card markdown."
                          }
                        </div>
                        ${
                          detailConfidence
                            ? html`
                                <div class="card-sub" style="margin-top: 10px;">Promotion confidence</div>
                                <div class="row" style="justify-content: space-between; align-items: center; margin-top: 4px;">
                                  <select
                                    class="input mono"
                                    style="width: auto; padding: 4px 8px; font-size: 12px; border-radius: 4px; border: 1px solid var(--color-border); background: var(--color-bg-secondary); cursor: pointer;"
                                    .value=${detailConfidence.band}
                                    @change=${(e: Event) => {
                                      const target = e.currentTarget as HTMLSelectElement;
                                      const newBand = target.value;
                                      if (
                                        newBand !== detailConfidence.band &&
                                        props.jobCardDetail
                                      ) {
                                        const md = props.jobCardEditorMarkdown;
                                        const override = `\n<!-- promotion_override: ${newBand} -->\n`;
                                        const overrideRegex =
                                          /\n<!-- promotion_override: \w+ -->\n/;
                                        const updated = overrideRegex.test(md)
                                          ? md.replace(overrideRegex, override)
                                          : md + override;
                                        props.onJobCardEditorChange(updated);
                                      }
                                    }}
                                  >
                                    <option value="hold" ?selected=${detailConfidence.band === "hold"}>Hold Promotion</option>
                                    <option value="watch" ?selected=${detailConfidence.band === "watch"}>Needs Monitoring</option>
                                    <option value="progressing" ?selected=${detailConfidence.band === "progressing"}>Building Confidence</option>
                                    <option value="ready" ?selected=${detailConfidence.band === "ready"}>Promotion Ready</option>
                                  </select>
                                  <span class="mono">${detailConfidence.score}/100</span>
                                </div>
                                <div class="muted" style="margin-top: 6px; font-style: italic;">
                                  ${guidanceForConfidenceBand(detailConfidence.band)}
                                </div>
                                <div class="muted" style="margin-top: 6px;">
                                  ${detailConfidence.drivers.join(" ")}
                                </div>
                                <div class="muted mono" style="margin-top: 6px;">
                                  recommendation outcomes: approved ${detailConfidence.recommendation_outcomes.approved}, dismissed ${detailConfidence.recommendation_outcomes.dismissed}
                                </div>
                              `
                            : nothing
                        }
                        <div class="row" style="justify-content: flex-end; gap: 8px; margin-top: 8px;">
                          <button
                            class="btn ghost"
                            aria-label="Suggest KPIs for this work item"
                            ?disabled=${props.jobCardKpiSuggestBusy}
                            @click=${props.onSuggestJobCardKpis}
                          >
                            ${props.jobCardKpiSuggestBusy ? "Suggesting..." : "Suggest KPIs"}
                          </button>
                          <button
                            class="btn ghost"
                            aria-label="Apply suggested KPIs to editor"
                            ?disabled=${!props.jobCardKpiSuggestion}
                            @click=${props.onApplySuggestedKpisToEditor}
                          >
                            Apply Suggested KPIs to Editor
                          </button>
                        </div>
                        ${
                          props.jobCardKpiSuggestError
                            ? html`<div class="callout danger" style="margin-top: 8px;">${props.jobCardKpiSuggestError}</div>`
                            : nothing
                        }
                        ${
                          props.jobCardKpiSuggestion
                            ? html`<div class="card" style="margin-top: 8px; margin-bottom: 0;">
                                <div class="card-title">Suggested KPIs</div>
                                <div class="card-sub">${props.jobCardKpiSuggestion.rationale}</div>
                                <div class="muted" style="margin-top: 8px;">${props.jobCardKpiSuggestion.suggestions.join("; ")}</div>
                              </div>`
                            : nothing
                        }
                        <div class="card-sub" style="margin-top: 12px;">Edit Work Item</div>
                        <textarea
                          class="input mono"
                          style="width: 100%; min-height: 220px; margin-top: 8px;"
                          .value=${props.jobCardEditorMarkdown}
                          @input=${(event: Event) =>
                            props.onJobCardEditorChange(
                              (event.currentTarget as HTMLTextAreaElement).value,
                            )}
                        ></textarea>
                        <div class="row" style="justify-content: flex-end; margin-top: 8px; gap: 8px;">
                          <button
                            class="btn ghost"
                            aria-label="Preview work item edit impact"
                            ?disabled=${props.jobCardPreviewBusy}
                            @click=${props.onPreviewJobCardUpdate}
                          >
                            ${props.jobCardPreviewBusy ? "Analyzing..." : "Preview Impact"}
                          </button>
                          <button
                            class="btn"
                            aria-label="Save work item changes"
                            ?disabled=${props.jobCardSaveBusy}
                            @click=${props.onSaveJobCardDetail}
                          >
                            ${props.jobCardSaveBusy ? "Saving..." : "Save Changes"}
                          </button>
                        </div>
                        ${
                          props.jobCardSaveError
                            ? html`<div class="callout danger" style="margin-top: 8px;">${props.jobCardSaveError}</div>`
                            : nothing
                        }
                        ${
                          props.jobCardPreviewError
                            ? html`<div class="callout danger" style="margin-top: 8px;">${props.jobCardPreviewError}</div>`
                            : nothing
                        }
                        ${
                          props.jobCardPreview
                            ? html`<div class="card" style="margin-top: 8px; margin-bottom: 0;">
                                <div class="card-title">Impact Preview</div>
                                <div class="card-sub">
                                  Ted checks how your edits change this work item before save.
                                </div>
                                <div class="muted" style="margin-top: 8px;">
                                  ${props.jobCardPreview.impact_summary.join("; ")}
                                </div>
                                ${
                                  props.jobCardPreview.warnings.length > 0
                                    ? html`<div class="callout warn" style="margin-top: 8px;">
                                        ${props.jobCardPreview.warnings.join(" ")}
                                      </div>`
                                    : nothing
                                }
                              </div>`
                            : nothing
                        }
                        ${
                          props.jobCardSaveResult
                            ? html`<pre class="mono" style="margin-top: 8px; white-space: pre-wrap;">${props.jobCardSaveResult}</pre>`
                            : nothing
                        }
                      `
                    : html`
                        <div class="muted" style="margin-top: 10px">Select a job card to inspect details.</div>
                      `
                }
              </div>`
                  : nothing
              }

              ${
                showIntake || showBuild
                  ? html`<div class="card" style="margin-top: 16px; margin-bottom: 0;">
                <div class="card-title">Create New Work Item</div>
                <div class="card-sub">
                  Describe the job and Ted will recommend a safe starting configuration.
                </div>
                <div class="row" style="gap: 8px; margin-top: 10px; flex-wrap: wrap;">
                  <button class="btn btn--sm active" aria-label="Apply daily ops brief example" @click=${() => props.onApplyIntakeExample("ops-brief")}>
                    Example: Daily Ops Brief
                  </button>
                  <button class="btn btn--sm" aria-label="Apply deal follow-up example" @click=${() => props.onApplyIntakeExample("deal-followup")}>
                    Example: Deal Follow-up
                  </button>
                  <button class="btn btn--sm" aria-label="Apply governance hardening example" @click=${() => props.onApplyIntakeExample("governance-hardening")}>
                    Example: Governance Hardening
                  </button>
                </div>
                <div class="grid grid-cols-2" style="margin-top: 10px;">
                  <label>
                    <div class="card-sub">Title</div>
                    <input
                      class="input"
                      .value=${props.intakeTitle}
                      @input=${(event: Event) =>
                        props.onIntakeFieldChange(
                          "title",
                          (event.currentTarget as HTMLInputElement).value,
                        )}
                    />
                  </label>
                  <label>
                    <div class="card-sub">Job Family</div>
                    <select
                      class="input"
                      .value=${props.intakeJobFamily}
                      @change=${(event: Event) =>
                        props.onIntakeFieldChange(
                          "job_family",
                          (event.currentTarget as HTMLSelectElement).value,
                        )}
                    >
                      <option value="GOV">Governance and Safety (GOV)</option>
                      <option value="MNT">Reliability and Operations (MNT)</option>
                      <option value="ING">Connectors and Intake (ING)</option>
                      <option value="LED">Deal and Work Ledger (LED)</option>
                      <option value="OUT">Outbound Drafting and Scheduling (OUT)</option>
                    </select>
                  </label>
                </div>
                <label style="display:block; margin-top: 10px;">
                  <div class="card-sub">Outcome</div>
                  <textarea
                    class="input"
                    style="width: 100%; min-height: 90px;"
                    .value=${props.intakeOutcome}
                    @input=${(event: Event) =>
                      props.onIntakeFieldChange(
                        "outcome",
                        (event.currentTarget as HTMLTextAreaElement).value,
                      )}
                  ></textarea>
                </label>
                <div class="grid grid-cols-2" style="margin-top: 10px;">
                  <label>
                    <div class="card-sub">Risk</div>
                    <select
                      class="input"
                      .value=${props.intakeRiskLevel}
                      @change=${(event: Event) =>
                        props.onIntakeFieldChange(
                          "risk_level",
                          (event.currentTarget as HTMLSelectElement).value,
                        )}
                    >
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                    </select>
                  </label>
                  <label>
                    <div class="card-sub">Automation</div>
                    <select
                      class="input"
                      .value=${props.intakeAutomationLevel}
                      @change=${(event: Event) =>
                        props.onIntakeFieldChange(
                          "automation_level",
                          (event.currentTarget as HTMLSelectElement).value,
                        )}
                    >
                      <option value="draft-only">Draft only</option>
                      <option value="approval-first">Approval first</option>
                    </select>
                  </label>
                </div>
                <div class="row" style="justify-content: flex-end; margin-top: 10px;">
                  <button
                    class="btn"
                    aria-label="Generate recommended work item setup"
                    ?disabled=${props.intakeBusy}
                    @click=${props.onRunIntakeRecommendation}
                  >
                    ${props.intakeBusy ? "Generating..." : "Generate Recommended Setup"}
                  </button>
                </div>
                ${
                  props.intakeError
                    ? html`<div class="callout danger" style="margin-top: 10px;">${props.intakeError}</div>`
                    : nothing
                }
                ${
                  props.intakeRecommendation
                    ? html`<div class="list" style="margin-top: 10px;">
                        <div class="list-item">
                          <div class="list-main">
                            <div class="list-title">Suggested config</div>
                            <div class="list-sub">
                              priority ${props.intakeRecommendation.priority} | release
                              ${props.intakeRecommendation.release_target} | tier
                              ${props.intakeRecommendation.governance_tier}
                            </div>
                          </div>
                          <div class="list-meta mono">
                            ${props.intakeRecommendation.suggested_path}
                          </div>
                        </div>
                        <div class="list-item">
                          <div class="list-main">
                            <div class="list-title">Recommended KPIs</div>
                            <div class="list-sub">
                              ${props.intakeRecommendation.recommended_kpis.join("; ")}
                            </div>
                          </div>
                        </div>
                        <div class="list-item">
                          <div class="list-main">
                            <div class="list-title">Hard bans</div>
                            <div class="list-sub">
                              ${props.intakeRecommendation.hard_bans.join("; ")}
                            </div>
                          </div>
                        </div>
                      </div>
                      <pre class="mono" style="margin-top: 10px; white-space: pre-wrap;">${props.intakeRecommendation.draft_markdown}</pre>
                      <div class="row" style="justify-content: flex-end; margin-top: 10px; gap: 8px;">
                        ${props.intakeSaveError ? html`<span class="danger" style="font-size: 12px;">${props.intakeSaveError}</span>` : nothing}
                        ${
                          props.intakeSaveResult
                            ? html`
                                <span class="muted" style="font-size: 12px">Job card created.</span>
                              `
                            : nothing
                        }
                        <button
                          class="btn"
                          aria-label="Create job card from intake recommendation"
                          ?disabled=${props.intakeSaveBusy}
                          @click=${props.onSaveIntakeJobCard}
                        >
                          ${props.intakeSaveBusy ? "Creating..." : "Create Job Card"}
                        </button>
                      </div>`
                    : nothing
                }
              </div>`
                  : nothing
              }

              ${
                showBuild || showGovern
                  ? html`<div class="card" style="margin-top: 16px; margin-bottom: 0;">
                <div class="card-title">Persona Rules Validator</div>
                <div class="card-sub">
                  Validate persona rules before using them in production.
                </div>
                <textarea
                  class="input mono"
                  style="width: 100%; min-height: 180px; margin-top: 12px;"
                  .value=${props.roleCardJson}
                  @input=${(event: Event) =>
                    props.onRoleCardJsonChange((event.currentTarget as HTMLTextAreaElement).value)}
                ></textarea>
                <div class="row" style="justify-content: flex-end; margin-top: 10px;">
                  <button
                    class="btn"
                    aria-label="Validate persona rules"
                    ?disabled=${props.roleCardBusy}
                    @click=${props.onRoleCardValidate}
                  >
                    ${props.roleCardBusy ? "Validating..." : "Validate Rules"}
                  </button>
                </div>
                ${
                  props.roleCardError
                    ? html`<pre class="callout danger mono" style="margin-top: 10px;">${props.roleCardError}</pre>`
                    : nothing
                }
                ${
                  props.roleCardResult
                    ? html`<pre class="mono" style="margin-top: 10px; white-space: pre-wrap;">${props.roleCardResult}</pre>`
                    : nothing
                }
              </div>`
                  : nothing
              }

              ${
                showGovern
                  ? html`<div class="card" style="margin-top: 16px; margin-bottom: 0;">
                      <div class="card-title">Pending Decisions</div>
                      <div class="card-sub">
                        Items that need your decision before moving forward.
                      </div>
                      <div class="list" style="margin-top: 10px;">
                        ${
                          snapshot.approval_queue.length === 0
                            ? html`
                                <div class="muted">No pending approvals in queue.</div>
                              `
                            : snapshot.approval_queue.map(
                                (entry) => html`<div class="list-item">
                                <div class="list-main">
                                  <div class="list-title">${entry.id}</div>
                                  <div class="list-sub">${entry.summary}</div>
                                  <div class="muted mono" style="margin-top: 6px;">
                                    reason: ${entry.reason_code}
                                  </div>
                                </div>
                                <div class="list-meta">
                                  <span class="pill ${toneForSeverity(entry.severity)}"
                                    >${entry.status}</span
                                  >
                                  <div class="muted" style="margin-top: 6px; max-width: 360px;">
                                    ${entry.next_safe_step}
                                  </div>
                                  <div class="row" style="justify-content: flex-end; gap: 6px; margin-top: 8px;">
                                    <button
                                      class="btn ghost"
                                      aria-label="Approve pending decision"
                                      ?disabled=${props.recommendationBusyId !== null}
                                      @click=${() => props.onRecommendationDecision(entry.id, "approved")}
                                    >
                                      ${props.recommendationBusyId === entry.id ? "Approving..." : "Approve"}
                                    </button>
                                    <button
                                      class="btn ghost"
                                      aria-label="Dismiss pending decision"
                                      ?disabled=${props.recommendationBusyId !== null}
                                      @click=${() => props.onRecommendationDecision(entry.id, "dismissed")}
                                    >
                                      Dismiss
                                    </button>
                                  </div>
                                </div>
                              </div>`,
                              )
                        }
                      </div>
                      ${props.recommendationError ? html`<div class="callout danger" style="margin-top: 10px;">${props.recommendationError}</div>` : nothing}
                    </div>`
                  : nothing
              }

              ${
                showGovern
                  ? html`<div class="card" style="margin-top: 16px; margin-bottom: 0;">
                      <div class="card-title">Decision Impact Ledger</div>
                      <div class="card-sub">
                        Correlates recommendation decisions to linked work items and current promotion confidence.
                      </div>
                      <div class="list" style="margin-top: 10px;">
                        ${
                          snapshot.approval_ledger.recent.length === 0
                            ? html`
                                <div class="muted">No approval ledger entries yet.</div>
                              `
                            : snapshot.approval_ledger.recent.map(
                                (entry) => html`<div class="list-item">
                                  <div class="list-main">
                                    <div class="list-title">${entry.summary}</div>
                                    <div class="list-sub mono">
                                      ${entry.source}${
                                        entry.recommendation_id
                                          ? ` | ${entry.recommendation_id}`
                                          : ""
                                      }${entry.decided_at ? ` | ${entry.decided_at}` : ""}
                                    </div>
                                    <div class="muted mono" style="margin-top: 6px;">
                                      reason: ${entry.reason_code}
                                    </div>
                                    ${
                                      entry.linked_cards.length > 0
                                        ? html`<div class="muted" style="margin-top: 6px;">
                                            linked cards: ${entry.linked_cards.join(", ")}
                                          </div>`
                                        : nothing
                                    }
                                    ${
                                      entry.linked_card_confidence.length > 0
                                        ? html`<div class="muted" style="margin-top: 6px;">
                                            ${entry.linked_card_confidence
                                              .map(
                                                (confidence) =>
                                                  `${confidence.card_id} score ${confidence.score} (${labelForConfidenceBand(confidence.band)})`,
                                              )
                                              .join(" | ")}
                                          </div>`
                                        : nothing
                                    }
                                  </div>
                                  <div class="list-meta">
                                    <span
                                      class="pill ${
                                        entry.decision === "dismissed"
                                          ? "danger"
                                          : entry.decision === "pending"
                                            ? "warn"
                                            : ""
                                      }"
                                      >${entry.decision}</span
                                    >
                                    <div class="muted" style="margin-top: 6px; max-width: 360px;">
                                      ${entry.next_safe_step}
                                    </div>
                                    ${
                                      entry.linked_cards[0]
                                        ? html`<button
                                            class="btn ghost btn--sm"
                                            style="margin-top: 8px;"
                                            aria-label="Open linked job card"
                                            @click=${() => props.onOpenJobCard(entry.linked_cards[0])}
                                          >
                                            Open ${entry.linked_cards[0]}
                                          </button>`
                                        : nothing
                                    }
                                  </div>
                                </div>`,
                              )
                        }
                      </div>
                    </div>`
                  : nothing
              }

              ${
                showGovern
                  ? html`<div class="card" style="margin-top: 16px; margin-bottom: 0;">
                      <div class="card-title">Safety Timeline</div>
                      <div class="card-sub">
                        Recent allow/block decisions and what to do next.
                      </div>
                      <div class="list" style="margin-top: 10px;">
                        ${
                          snapshot.governance_timeline_preview.length === 0
                            ? html`
                                <div class="muted">No governance events captured yet.</div>
                              `
                            : snapshot.governance_timeline_preview.map(
                                (entry) => html`<div class="list-item">
                                <div class="list-main">
                                  <div class="list-title">${entry.action}</div>
                                  <div class="list-sub mono">${entry.ts}</div>
                                  <div class="muted mono" style="margin-top: 6px;">
                                    reason: ${entry.reason_code}
                                  </div>
                                </div>
                                <div class="list-meta">
                                  <span class="pill ${entry.outcome === "blocked" ? "danger" : ""}"
                                    >${entry.outcome}</span
                                  >
                                  <div class="muted" style="margin-top: 6px; max-width: 360px;">
                                    ${entry.next_safe_step}
                                  </div>
                                </div>
                              </div>`,
                              )
                        }
                      </div>
                    </div>`
                  : nothing
              }

              ${
                showEvals
                  ? html`<div class="card" style="margin-top: 16px; margin-bottom: 0;">
                      <div class="card-title">Trend Snapshot</div>
                      <div class="card-sub">
                        Recent performance trajectory to support promotion decisions.
                      </div>
                      <div class="list" style="margin-top: 10px;">
                        ${
                          snapshot.kpi_history_preview.length === 0
                            ? html`
                                <div class="muted">No KPI history entries yet.</div>
                              `
                            : snapshot.kpi_history_preview
                                .toReversed()
                                .slice(0, 12)
                                .map(
                                  (entry) => html`<div class="list-item">
                                  <div class="list-main">
                                    <div class="list-title mono">${entry.ts}</div>
                                    <div class="list-sub">
                                      manual<=${entry.manual_minutes_per_day_max}m,
                                      approval<=${entry.approval_queue_oldest_minutes_max}m,
                                      triage<=${entry.unresolved_triage_eod_max},
                                      explainability<=${entry.blocked_actions_missing_explainability_max}
                                    </div>
                                  </div>
                                </div>`,
                                )
                        }
                      </div>
                    </div>`
                  : nothing
              }

              ${
                showEvals
                  ? html`<div class="card" style="margin-top: 16px; margin-bottom: 0;">
                      <div class="row" style="justify-content: space-between; align-items: center;">
                        <div class="card-title">Proof Check History</div>
                        <button class="btn" aria-label="Refresh proof history" ?disabled=${props.loading} @click=${props.onRefresh}>
                          ${props.loading ? "Refreshing..." : "Refresh"}
                        </button>
                      </div>
                      <div class="card-sub">
                        Pass/fail history from executed proof checks.
                      </div>
                      <div class="list" style="margin-top: 10px;">
                        ${
                          snapshot.eval_history_preview.length === 0
                            ? html`
                                <div class="muted">No proof runs captured yet.</div>
                              `
                            : snapshot.eval_history_preview.slice(0, 12).map(
                                (entry) => html`<div class="list-item">
                                <div class="list-main">
                                  <div class="list-title mono">${entry.proof_script}</div>
                                  <div class="list-sub mono">
                                    ${entry.ts} | exit=${entry.exit_code}
                                  </div>
                                </div>
                                <div class="list-meta">
                                  <span class="pill ${entry.ok ? "" : "danger"}"
                                    >${entry.ok ? "pass" : "fail"}</span
                                  >
                                </div>
                              </div>`,
                              )
                        }
                      </div>
                    </div>`
                  : nothing
              }

              ${showEvals || showGovern || showBuild ? renderEvaluationPipeline(props) : nothing}
              ${showEvals || showGovern || showBuild ? renderQaDashboard(props) : nothing}
              ${showEvals || showGovern || showBuild ? renderSelfHealingDashboard(props) : nothing}
              ${showEvals || showGovern || showBuild ? renderBuilderLaneDashboard(props) : nothing}
              ${showEvals || showGovern || showBuild ? renderImprovementProposalsCard(props) : nothing}
              ${showEvals || showGovern || showBuild ? renderTrustAutonomyCard(props) : nothing}
            `
          : html`
              <div class="muted" style="margin-top: 12px">No workbench data yet. Click refresh.</div>
            `
      }
    </section>
  `;
}
