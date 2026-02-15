import {
  type AgentEvent,
  AgentEventSchema,
  type AgentIdentityParams,
  AgentIdentityParamsSchema,
  type AgentIdentityResult,
  AgentIdentityResultSchema,
  AgentParamsSchema,
  type AgentModelInfo,
  AgentModelInfoSchema,
  type AgentSummary,
  AgentSummarySchema,
  type AgentsFileEntry,
  AgentsFileEntrySchema,
  type AgentsFilesGetParams,
  AgentsFilesGetParamsSchema,
  type AgentsFilesGetResult,
  AgentsFilesGetResultSchema,
  type AgentsFilesListParams,
  AgentsFilesListParamsSchema,
  type AgentsFilesListResult,
  AgentsFilesListResultSchema,
  type AgentsFilesSetParams,
  AgentsFilesSetParamsSchema,
  type AgentsFilesSetResult,
  AgentsFilesSetResultSchema,
  type AgentsListParams,
  AgentsListParamsSchema,
  type AgentsListResult,
  AgentsListResultSchema,
  type AgentsModelSetParams,
  AgentsModelSetParamsSchema,
  type AgentsModelSetResult,
  AgentsModelSetResultSchema,
  type AgentWaitParams,
  AgentWaitParamsSchema,
  type ChannelsLogoutParams,
  ChannelsLogoutParamsSchema,
  type ChannelsStatusParams,
  ChannelsStatusParamsSchema,
  type ChannelsStatusResult,
  ChannelsStatusResultSchema,
  type ChatAbortParams,
  ChatAbortParamsSchema,
  type ChatEvent,
  ChatEventSchema,
  ChatHistoryParamsSchema,
  type ChatInjectParams,
  ChatInjectParamsSchema,
  ChatSendParamsSchema,
  type ConfigApplyParams,
  ConfigApplyParamsSchema,
  type ConfigGetParams,
  ConfigGetParamsSchema,
  type ConfigPatchParams,
  ConfigPatchParamsSchema,
  type ConfigSchemaParams,
  ConfigSchemaParamsSchema,
  type ConfigSchemaResponse,
  ConfigSchemaResponseSchema,
  type ConfigSetParams,
  ConfigSetParamsSchema,
  type ConnectParams,
  ConnectParamsSchema,
  type CronAddParams,
  CronAddParamsSchema,
  type CronJob,
  CronJobSchema,
  type CronListParams,
  CronListParamsSchema,
  type CronRemoveParams,
  CronRemoveParamsSchema,
  type CronRunLogEntry,
  type CronRunParams,
  CronRunParamsSchema,
  type CronRunsParams,
  CronRunsParamsSchema,
  type CronStatusParams,
  CronStatusParamsSchema,
  type CronUpdateParams,
  CronUpdateParamsSchema,
  type DevicePairApproveParams,
  DevicePairApproveParamsSchema,
  type DevicePairListParams,
  DevicePairListParamsSchema,
  type DevicePairRejectParams,
  DevicePairRejectParamsSchema,
  type DeviceTokenRevokeParams,
  DeviceTokenRevokeParamsSchema,
  type DeviceTokenRotateParams,
  DeviceTokenRotateParamsSchema,
  type ExecApprovalsGetParams,
  ExecApprovalsGetParamsSchema,
  type ExecApprovalsNodeGetParams,
  ExecApprovalsNodeGetParamsSchema,
  type ExecApprovalsNodeSetParams,
  ExecApprovalsNodeSetParamsSchema,
  type ExecApprovalsSetParams,
  ExecApprovalsSetParamsSchema,
  type ExecApprovalsSnapshot,
  type ExecApprovalRequestParams,
  ExecApprovalRequestParamsSchema,
  type ExecApprovalResolveParams,
  ExecApprovalResolveParamsSchema,
  type FsPickDirectoryParams,
  FsPickDirectoryParamsSchema,
  ErrorCodes,
  type ErrorShape,
  ErrorShapeSchema,
  type EventFrame,
  EventFrameSchema,
  errorShape,
  type GatewayFrame,
  GatewayFrameSchema,
  type HelloOk,
  HelloOkSchema,
  type LogsTailParams,
  LogsTailParamsSchema,
  type LogsTailResult,
  LogsTailResultSchema,
  type ModelsListParams,
  ModelsListParamsSchema,
  type NodeDescribeParams,
  NodeDescribeParamsSchema,
  type ModelsCooldownsParams,
  ModelsCooldownsParamsSchema,
  type NodeEventParams,
  NodeEventParamsSchema,
  type NodeInvokeParams,
  NodeInvokeParamsSchema,
  type NodeInvokeResultParams,
  NodeInvokeResultParamsSchema,
  type NodeListParams,
  NodeListParamsSchema,
  type NodePairApproveParams,
  NodePairApproveParamsSchema,
  type NodePairListParams,
  NodePairListParamsSchema,
  type NodePairRejectParams,
  NodePairRejectParamsSchema,
  type NodePairRequestParams,
  NodePairRequestParamsSchema,
  type NodePairVerifyParams,
  NodePairVerifyParamsSchema,
  type NodeRenameParams,
  NodeRenameParamsSchema,
  type PollParams,
  PollParamsSchema,
  PROTOCOL_VERSION,
  type ProjectsListParams,
  ProjectsListParamsSchema,
  type PresenceEntry,
  PresenceEntrySchema,
  ProtocolSchemas,
  type RequestFrame,
  RequestFrameSchema,
  type ResponseFrame,
  ResponseFrameSchema,
  SendParamsSchema,
  type SessionsCompactParams,
  SessionsCompactParamsSchema,
  type SessionsDeleteParams,
  SessionsDeleteParamsSchema,
  type SessionsListParams,
  SessionsListParamsSchema,
  type SessionsPatchParams,
  SessionsPatchParamsSchema,
  type SessionsPreviewParams,
  SessionsPreviewParamsSchema,
  type SessionsResetParams,
  SessionsResetParamsSchema,
  type SessionsResolveParams,
  SessionsResolveParamsSchema,
  type ShutdownEvent,
  ShutdownEventSchema,
  type SkillsBinsParams,
  SkillsBinsParamsSchema,
  type SkillsBinsResult,
  type SkillsInstallParams,
  SkillsInstallParamsSchema,
  type SkillsStatusParams,
  SkillsStatusParamsSchema,
  type SkillsUpdateParams,
  SkillsUpdateParamsSchema,
  type Snapshot,
  SnapshotSchema,
  type StateVersion,
  StateVersionSchema,
  type TalkModeParams,
  TalkModeParamsSchema,
  type TickEvent,
  TickEventSchema,
  type UpdateRunParams,
  UpdateRunParamsSchema,
  type WakeParams,
  WakeParamsSchema,
  type WebLoginStartParams,
  WebLoginStartParamsSchema,
  type WebLoginWaitParams,
  WebLoginWaitParamsSchema,
  type WizardCancelParams,
  WizardCancelParamsSchema,
  type WizardNextParams,
  WizardNextParamsSchema,
  type WizardNextResult,
  WizardNextResultSchema,
  type WizardStartParams,
  WizardStartParamsSchema,
  type WizardStartResult,
  WizardStartResultSchema,
  type WizardStatusParams,
  WizardStatusParamsSchema,
  type WizardStatusResult,
  WizardStatusResultSchema,
  type WizardStep,
  WizardStepSchema,
  type ProvidersListParams,
  ProvidersListParamsSchema,
  type ProvidersListResult,
  ProvidersListResultSchema,
  type ProvidersUsageParams,
  ProvidersUsageParamsSchema,
  type ProvidersUsageResult,
  ProvidersUsageResultSchema,
  type ProviderStatus,
  ProviderStatusSchema,
  type ProviderUsage,
  ProviderUsageSchema,
  type UsageTotals,
  UsageTotalsSchema,
  type ProvidersHealthParams,
  ProvidersHealthParamsSchema,
  type ProvidersHealthResult,
  ProvidersHealthResultSchema,
  type ProviderHealthEntry,
  ProviderHealthEntrySchema,
  type UsageWindow as HealthUsageWindow,
  UsageWindowSchema as HealthUsageWindowSchema,
} from "./schema.js";
import { createValidator, type AjvLikeError } from "./zod-validator.js";

export const validateConnectParams = createValidator<ConnectParams>(ConnectParamsSchema);
export const validateRequestFrame = createValidator<RequestFrame>(RequestFrameSchema);
export const validateResponseFrame = createValidator<ResponseFrame>(ResponseFrameSchema);
export const validateEventFrame = createValidator<EventFrame>(EventFrameSchema);
export const validateSendParams = createValidator(SendParamsSchema);
export const validatePollParams = createValidator<PollParams>(PollParamsSchema);
export const validateAgentParams = createValidator(AgentParamsSchema);
export const validateAgentIdentityParams =
  createValidator<AgentIdentityParams>(AgentIdentityParamsSchema);
export const validateAgentWaitParams = createValidator<AgentWaitParams>(AgentWaitParamsSchema);
export const validateWakeParams = createValidator<WakeParams>(WakeParamsSchema);
export const validateAgentsListParams = createValidator<AgentsListParams>(AgentsListParamsSchema);
export const validateAgentsModelSetParams = createValidator<AgentsModelSetParams>(
  AgentsModelSetParamsSchema,
);
export const validateAgentsFilesListParams = createValidator<AgentsFilesListParams>(
  AgentsFilesListParamsSchema,
);
export const validateAgentsFilesGetParams = createValidator<AgentsFilesGetParams>(
  AgentsFilesGetParamsSchema,
);
export const validateAgentsFilesSetParams = createValidator<AgentsFilesSetParams>(
  AgentsFilesSetParamsSchema,
);
export const validateNodePairRequestParams = createValidator<NodePairRequestParams>(
  NodePairRequestParamsSchema,
);
export const validateNodePairListParams =
  createValidator<NodePairListParams>(NodePairListParamsSchema);
export const validateNodePairApproveParams = createValidator<NodePairApproveParams>(
  NodePairApproveParamsSchema,
);
export const validateNodePairRejectParams = createValidator<NodePairRejectParams>(
  NodePairRejectParamsSchema,
);
export const validateNodePairVerifyParams = createValidator<NodePairVerifyParams>(
  NodePairVerifyParamsSchema,
);
export const validateNodeRenameParams = createValidator<NodeRenameParams>(NodeRenameParamsSchema);
export const validateNodeListParams = createValidator<NodeListParams>(NodeListParamsSchema);
export const validateNodeDescribeParams =
  createValidator<NodeDescribeParams>(NodeDescribeParamsSchema);
export const validateNodeInvokeParams = createValidator<NodeInvokeParams>(NodeInvokeParamsSchema);
export const validateNodeInvokeResultParams = createValidator<NodeInvokeResultParams>(
  NodeInvokeResultParamsSchema,
);
export const validateNodeEventParams = createValidator<NodeEventParams>(NodeEventParamsSchema);
export const validateSessionsListParams =
  createValidator<SessionsListParams>(SessionsListParamsSchema);
export const validateSessionsPreviewParams = createValidator<SessionsPreviewParams>(
  SessionsPreviewParamsSchema,
);
export const validateSessionsResolveParams = createValidator<SessionsResolveParams>(
  SessionsResolveParamsSchema,
);
export const validateSessionsPatchParams =
  createValidator<SessionsPatchParams>(SessionsPatchParamsSchema);
export const validateProjectsListParams =
  createValidator<ProjectsListParams>(ProjectsListParamsSchema);
export const validateSessionsResetParams =
  createValidator<SessionsResetParams>(SessionsResetParamsSchema);
export const validateSessionsDeleteParams = createValidator<SessionsDeleteParams>(
  SessionsDeleteParamsSchema,
);
export const validateSessionsCompactParams = createValidator<SessionsCompactParams>(
  SessionsCompactParamsSchema,
);
export const validateConfigGetParams = createValidator<ConfigGetParams>(ConfigGetParamsSchema);
export const validateConfigSetParams = createValidator<ConfigSetParams>(ConfigSetParamsSchema);
export const validateConfigApplyParams =
  createValidator<ConfigApplyParams>(ConfigApplyParamsSchema);
export const validateConfigPatchParams =
  createValidator<ConfigPatchParams>(ConfigPatchParamsSchema);
export const validateConfigSchemaParams =
  createValidator<ConfigSchemaParams>(ConfigSchemaParamsSchema);
export const validateWizardStartParams =
  createValidator<WizardStartParams>(WizardStartParamsSchema);
export const validateWizardNextParams = createValidator<WizardNextParams>(WizardNextParamsSchema);
export const validateWizardCancelParams =
  createValidator<WizardCancelParams>(WizardCancelParamsSchema);
export const validateWizardStatusParams =
  createValidator<WizardStatusParams>(WizardStatusParamsSchema);
export const validateTalkModeParams = createValidator<TalkModeParams>(TalkModeParamsSchema);
export const validateChannelsStatusParams = createValidator<ChannelsStatusParams>(
  ChannelsStatusParamsSchema,
);
export const validateChannelsLogoutParams = createValidator<ChannelsLogoutParams>(
  ChannelsLogoutParamsSchema,
);
export const validateModelsListParams = createValidator<ModelsListParams>(ModelsListParamsSchema);
export const validateModelsCooldownsParams = createValidator<ModelsCooldownsParams>(
  ModelsCooldownsParamsSchema,
);
export const validateSkillsStatusParams =
  createValidator<SkillsStatusParams>(SkillsStatusParamsSchema);
export const validateSkillsBinsParams = createValidator<SkillsBinsParams>(SkillsBinsParamsSchema);
export const validateSkillsInstallParams =
  createValidator<SkillsInstallParams>(SkillsInstallParamsSchema);
export const validateSkillsUpdateParams =
  createValidator<SkillsUpdateParams>(SkillsUpdateParamsSchema);
export const validateCronListParams = createValidator<CronListParams>(CronListParamsSchema);
export const validateCronStatusParams = createValidator<CronStatusParams>(CronStatusParamsSchema);
export const validateCronAddParams = createValidator<CronAddParams>(CronAddParamsSchema);
export const validateCronUpdateParams = createValidator<CronUpdateParams>(CronUpdateParamsSchema);
export const validateCronRemoveParams = createValidator<CronRemoveParams>(CronRemoveParamsSchema);
export const validateCronRunParams = createValidator<CronRunParams>(CronRunParamsSchema);
export const validateCronRunsParams = createValidator<CronRunsParams>(CronRunsParamsSchema);
export const validateDevicePairListParams = createValidator<DevicePairListParams>(
  DevicePairListParamsSchema,
);
export const validateDevicePairApproveParams = createValidator<DevicePairApproveParams>(
  DevicePairApproveParamsSchema,
);
export const validateDevicePairRejectParams = createValidator<DevicePairRejectParams>(
  DevicePairRejectParamsSchema,
);
export const validateDeviceTokenRotateParams = createValidator<DeviceTokenRotateParams>(
  DeviceTokenRotateParamsSchema,
);
export const validateDeviceTokenRevokeParams = createValidator<DeviceTokenRevokeParams>(
  DeviceTokenRevokeParamsSchema,
);
export const validateExecApprovalsGetParams = createValidator<ExecApprovalsGetParams>(
  ExecApprovalsGetParamsSchema,
);
export const validateExecApprovalsSetParams = createValidator<ExecApprovalsSetParams>(
  ExecApprovalsSetParamsSchema,
);
export const validateExecApprovalRequestParams = createValidator<ExecApprovalRequestParams>(
  ExecApprovalRequestParamsSchema,
);
export const validateExecApprovalResolveParams = createValidator<ExecApprovalResolveParams>(
  ExecApprovalResolveParamsSchema,
);
export const validateFsPickDirectoryParams = createValidator<FsPickDirectoryParams>(
  FsPickDirectoryParamsSchema,
);
export const validateExecApprovalsNodeGetParams = createValidator<ExecApprovalsNodeGetParams>(
  ExecApprovalsNodeGetParamsSchema,
);
export const validateExecApprovalsNodeSetParams = createValidator<ExecApprovalsNodeSetParams>(
  ExecApprovalsNodeSetParamsSchema,
);
export const validateLogsTailParams = createValidator<LogsTailParams>(LogsTailParamsSchema);
export const validateChatHistoryParams = createValidator(ChatHistoryParamsSchema);
export const validateChatSendParams = createValidator(ChatSendParamsSchema);
export const validateChatAbortParams = createValidator<ChatAbortParams>(ChatAbortParamsSchema);
export const validateChatInjectParams = createValidator<ChatInjectParams>(ChatInjectParamsSchema);
export const validateChatEvent = createValidator(ChatEventSchema);
export const validateUpdateRunParams = createValidator<UpdateRunParams>(UpdateRunParamsSchema);
export const validateWebLoginStartParams =
  createValidator<WebLoginStartParams>(WebLoginStartParamsSchema);
export const validateWebLoginWaitParams =
  createValidator<WebLoginWaitParams>(WebLoginWaitParamsSchema);
export const validateProvidersListParams =
  createValidator<ProvidersListParams>(ProvidersListParamsSchema);
export const validateProvidersUsageParams = createValidator<ProvidersUsageParams>(
  ProvidersUsageParamsSchema,
);
export const validateProvidersHealthParams = createValidator<ProvidersHealthParams>(
  ProvidersHealthParamsSchema,
);

export function formatValidationErrors(errors: AjvLikeError[] | null | undefined) {
  if (!errors?.length) {
    return "unknown validation error";
  }

  const parts: string[] = [];

  for (const err of errors) {
    const keyword = typeof err?.keyword === "string" ? err.keyword : "";
    const instancePath = typeof err?.instancePath === "string" ? err.instancePath : "";

    if (keyword === "additionalProperties") {
      const params = err?.params as { additionalProperty?: unknown } | undefined;
      const additionalProperty = params?.additionalProperty;
      if (typeof additionalProperty === "string" && additionalProperty.trim()) {
        const where = instancePath ? `at ${instancePath}` : "at root";
        parts.push(`${where}: unexpected property '${additionalProperty}'`);
        continue;
      }
    }

    const message =
      typeof err?.message === "string" && err.message.trim() ? err.message : "validation error";
    const where = instancePath ? `at ${instancePath}: ` : "";
    parts.push(`${where}${message}`);
  }

  // De-dupe while preserving order.
  const unique = Array.from(new Set(parts.filter((part) => part.trim())));
  if (!unique.length) {
    const fallback = errors.map((e) => e.message).join("; ");
    return fallback || "unknown validation error";
  }
  return unique.join("; ");
}

export {
  ConnectParamsSchema,
  HelloOkSchema,
  RequestFrameSchema,
  ResponseFrameSchema,
  EventFrameSchema,
  GatewayFrameSchema,
  PresenceEntrySchema,
  SnapshotSchema,
  ErrorShapeSchema,
  StateVersionSchema,
  AgentEventSchema,
  ChatEventSchema,
  SendParamsSchema,
  PollParamsSchema,
  AgentParamsSchema,
  AgentIdentityParamsSchema,
  AgentIdentityResultSchema,
  WakeParamsSchema,
  NodePairRequestParamsSchema,
  NodePairListParamsSchema,
  NodePairApproveParamsSchema,
  NodePairRejectParamsSchema,
  NodePairVerifyParamsSchema,
  NodeListParamsSchema,
  NodeInvokeParamsSchema,
  SessionsListParamsSchema,
  SessionsPreviewParamsSchema,
  SessionsPatchParamsSchema,
  SessionsResetParamsSchema,
  SessionsDeleteParamsSchema,
  SessionsCompactParamsSchema,
  ConfigGetParamsSchema,
  ConfigSetParamsSchema,
  ConfigApplyParamsSchema,
  ConfigPatchParamsSchema,
  ConfigSchemaParamsSchema,
  ConfigSchemaResponseSchema,
  WizardStartParamsSchema,
  WizardNextParamsSchema,
  WizardCancelParamsSchema,
  WizardStatusParamsSchema,
  WizardStepSchema,
  WizardNextResultSchema,
  WizardStartResultSchema,
  WizardStatusResultSchema,
  ChannelsStatusParamsSchema,
  ChannelsStatusResultSchema,
  ChannelsLogoutParamsSchema,
  WebLoginStartParamsSchema,
  WebLoginWaitParamsSchema,
  AgentModelInfoSchema,
  AgentSummarySchema,
  AgentsFileEntrySchema,
  AgentsFilesListParamsSchema,
  AgentsFilesListResultSchema,
  AgentsFilesGetParamsSchema,
  AgentsFilesGetResultSchema,
  AgentsFilesSetParamsSchema,
  AgentsFilesSetResultSchema,
  AgentsListParamsSchema,
  AgentsListResultSchema,
  AgentsModelSetParamsSchema,
  AgentsModelSetResultSchema,
  ModelsListParamsSchema,
  SkillsStatusParamsSchema,
  SkillsInstallParamsSchema,
  SkillsUpdateParamsSchema,
  CronJobSchema,
  CronListParamsSchema,
  CronStatusParamsSchema,
  CronAddParamsSchema,
  CronUpdateParamsSchema,
  CronRemoveParamsSchema,
  CronRunParamsSchema,
  CronRunsParamsSchema,
  LogsTailParamsSchema,
  LogsTailResultSchema,
  ChatHistoryParamsSchema,
  ChatSendParamsSchema,
  ChatInjectParamsSchema,
  UpdateRunParamsSchema,
  TickEventSchema,
  ShutdownEventSchema,
  ProtocolSchemas,
  PROTOCOL_VERSION,
  ErrorCodes,
  errorShape,
  ProvidersListParamsSchema,
  ProvidersListResultSchema,
  ProvidersUsageParamsSchema,
  ProvidersUsageResultSchema,
  ProviderStatusSchema,
  ProviderUsageSchema,
  UsageTotalsSchema,
  ProvidersHealthParamsSchema,
  ProvidersHealthResultSchema,
  ProviderHealthEntrySchema,
  HealthUsageWindowSchema,
};

export type {
  GatewayFrame,
  ConnectParams,
  HelloOk,
  RequestFrame,
  ResponseFrame,
  EventFrame,
  PresenceEntry,
  Snapshot,
  ErrorShape,
  StateVersion,
  AgentEvent,
  AgentIdentityParams,
  AgentIdentityResult,
  AgentWaitParams,
  ChatEvent,
  TickEvent,
  ShutdownEvent,
  WakeParams,
  NodePairRequestParams,
  NodePairListParams,
  NodePairApproveParams,
  DevicePairListParams,
  DevicePairApproveParams,
  DevicePairRejectParams,
  ConfigGetParams,
  ConfigSetParams,
  ConfigApplyParams,
  ConfigPatchParams,
  ConfigSchemaParams,
  ConfigSchemaResponse,
  WizardStartParams,
  WizardNextParams,
  WizardCancelParams,
  WizardStatusParams,
  WizardStep,
  WizardNextResult,
  WizardStartResult,
  WizardStatusResult,
  TalkModeParams,
  ChannelsStatusParams,
  ChannelsStatusResult,
  ChannelsLogoutParams,
  WebLoginStartParams,
  WebLoginWaitParams,
  AgentModelInfo,
  AgentSummary,
  AgentsFileEntry,
  AgentsFilesListParams,
  AgentsFilesListResult,
  AgentsFilesGetParams,
  AgentsFilesGetResult,
  AgentsFilesSetParams,
  AgentsFilesSetResult,
  AgentsListParams,
  AgentsListResult,
  AgentsModelSetParams,
  AgentsModelSetResult,
  SkillsStatusParams,
  SkillsBinsParams,
  SkillsBinsResult,
  SkillsInstallParams,
  SkillsUpdateParams,
  NodePairRejectParams,
  NodePairVerifyParams,
  NodeListParams,
  NodeInvokeParams,
  NodeInvokeResultParams,
  NodeEventParams,
  SessionsListParams,
  SessionsPreviewParams,
  SessionsResolveParams,
  SessionsPatchParams,
  SessionsResetParams,
  SessionsDeleteParams,
  SessionsCompactParams,
  CronJob,
  CronListParams,
  CronStatusParams,
  CronAddParams,
  CronUpdateParams,
  CronRemoveParams,
  CronRunParams,
  CronRunsParams,
  CronRunLogEntry,
  ExecApprovalsGetParams,
  ExecApprovalsSetParams,
  ExecApprovalsSnapshot,
  LogsTailParams,
  LogsTailResult,
  PollParams,
  UpdateRunParams,
  ChatInjectParams,
  ProvidersListParams,
  ProvidersListResult,
  ProvidersUsageParams,
  ProvidersUsageResult,
  ProviderStatus,
  ProviderUsage,
  UsageTotals,
  ProvidersHealthParams,
  ProvidersHealthResult,
  ProviderHealthEntry,
  HealthUsageWindow,
};
