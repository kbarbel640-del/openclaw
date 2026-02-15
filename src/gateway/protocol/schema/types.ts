import type { z } from "zod";
import type {
  AgentEventSchema,
  AgentIdentityParamsSchema,
  AgentIdentityResultSchema,
  AgentWaitParamsSchema,
  PollParamsSchema,
  WakeParamsSchema,
} from "./agent.js";
import type {
  AgentModelInfoSchema,
  AgentSummarySchema,
  AgentsFileEntrySchema,
  AgentsFilesGetParamsSchema,
  AgentsFilesGetResultSchema,
  AgentsFilesListParamsSchema,
  AgentsFilesListResultSchema,
  AgentsFilesSetParamsSchema,
  AgentsFilesSetResultSchema,
  AgentsListParamsSchema,
  AgentsListResultSchema,
  AgentsModelSetParamsSchema,
  AgentsModelSetResultSchema,
  ModelCooldownSchema,
  ModelChoiceSchema,
  ModelsCooldownsParamsSchema,
  ModelsCooldownsResultSchema,
  ModelsListParamsSchema,
  ModelsListResultSchema,
  SkillsBinsParamsSchema,
  SkillsBinsResultSchema,
  SkillsInstallParamsSchema,
  SkillsStatusParamsSchema,
  SkillsUpdateParamsSchema,
} from "./agents-models-skills.js";
import type {
  ChannelsLogoutParamsSchema,
  ChannelsStatusParamsSchema,
  ChannelsStatusResultSchema,
  TalkModeParamsSchema,
  WebLoginStartParamsSchema,
  WebLoginWaitParamsSchema,
} from "./channels.js";
import type {
  ConfigApplyParamsSchema,
  ConfigGetParamsSchema,
  ConfigPatchParamsSchema,
  ConfigSchemaParamsSchema,
  ConfigSchemaResponseSchema,
  ConfigSetParamsSchema,
  UpdateRunParamsSchema,
} from "./config.js";
import type {
  CronAddParamsSchema,
  CronJobSchema,
  CronListParamsSchema,
  CronRemoveParamsSchema,
  CronRunLogEntrySchema,
  CronRunParamsSchema,
  CronRunsParamsSchema,
  CronStatusParamsSchema,
  CronUpdateParamsSchema,
} from "./cron.js";
import type {
  DevicePairApproveParamsSchema,
  DevicePairListParamsSchema,
  DevicePairRejectParamsSchema,
  DeviceTokenRevokeParamsSchema,
  DeviceTokenRotateParamsSchema,
} from "./devices.js";
import type {
  ExecApprovalsGetParamsSchema,
  ExecApprovalsNodeGetParamsSchema,
  ExecApprovalsNodeSetParamsSchema,
  ExecApprovalsSetParamsSchema,
  ExecApprovalsSnapshotSchema,
  ExecApprovalRequestParamsSchema,
  ExecApprovalResolveParamsSchema,
} from "./exec-approvals.js";
import type {
  ConnectParamsSchema,
  ErrorShapeSchema,
  EventFrameSchema,
  GatewayFrameSchema,
  HelloOkSchema,
  RequestFrameSchema,
  ResponseFrameSchema,
  ShutdownEventSchema,
  TickEventSchema,
} from "./frames.js";
import type { FsPickDirectoryParamsSchema } from "./fs.js";
import type {
  ChatAbortParamsSchema,
  ChatEventSchema,
  ChatInjectParamsSchema,
  LogsTailParamsSchema,
  LogsTailResultSchema,
} from "./logs-chat.js";
import type {
  NodeDescribeParamsSchema,
  NodeEventParamsSchema,
  NodeInvokeParamsSchema,
  NodeInvokeResultParamsSchema,
  NodeListParamsSchema,
  NodePairApproveParamsSchema,
  NodePairListParamsSchema,
  NodePairRejectParamsSchema,
  NodePairRequestParamsSchema,
  NodePairVerifyParamsSchema,
  NodeRenameParamsSchema,
} from "./nodes.js";
import type { ProjectsListParamsSchema } from "./projects.js";
import type {
  SessionsCompactParamsSchema,
  SessionsDeleteParamsSchema,
  SessionsListParamsSchema,
  SessionsPatchParamsSchema,
  SessionsPreviewParamsSchema,
  SessionsResetParamsSchema,
  SessionsResolveParamsSchema,
} from "./sessions.js";
import type { PresenceEntrySchema, SnapshotSchema, StateVersionSchema } from "./snapshot.js";
import type {
  WizardCancelParamsSchema,
  WizardNextParamsSchema,
  WizardNextResultSchema,
  WizardStartParamsSchema,
  WizardStartResultSchema,
  WizardStatusParamsSchema,
  WizardStatusResultSchema,
  WizardStepSchema,
} from "./wizard.js";

export type ConnectParams = z.infer<typeof ConnectParamsSchema>;
export type HelloOk = z.infer<typeof HelloOkSchema>;
export type RequestFrame = z.infer<typeof RequestFrameSchema>;
export type ResponseFrame = z.infer<typeof ResponseFrameSchema>;
export type EventFrame = z.infer<typeof EventFrameSchema>;
export type GatewayFrame = z.infer<typeof GatewayFrameSchema>;
export type Snapshot = z.infer<typeof SnapshotSchema>;
export type PresenceEntry = z.infer<typeof PresenceEntrySchema>;
export type ErrorShape = z.infer<typeof ErrorShapeSchema>;
export type StateVersion = z.infer<typeof StateVersionSchema>;
export type AgentEvent = z.infer<typeof AgentEventSchema>;
export type AgentIdentityParams = z.infer<typeof AgentIdentityParamsSchema>;
export type AgentIdentityResult = z.infer<typeof AgentIdentityResultSchema>;
export type PollParams = z.infer<typeof PollParamsSchema>;
export type AgentWaitParams = z.infer<typeof AgentWaitParamsSchema>;
export type WakeParams = z.infer<typeof WakeParamsSchema>;
export type NodePairRequestParams = z.infer<typeof NodePairRequestParamsSchema>;
export type NodePairListParams = z.infer<typeof NodePairListParamsSchema>;
export type NodePairApproveParams = z.infer<typeof NodePairApproveParamsSchema>;
export type NodePairRejectParams = z.infer<typeof NodePairRejectParamsSchema>;
export type NodePairVerifyParams = z.infer<typeof NodePairVerifyParamsSchema>;
export type NodeRenameParams = z.infer<typeof NodeRenameParamsSchema>;
export type NodeListParams = z.infer<typeof NodeListParamsSchema>;
export type NodeDescribeParams = z.infer<typeof NodeDescribeParamsSchema>;
export type NodeInvokeParams = z.infer<typeof NodeInvokeParamsSchema>;
export type NodeInvokeResultParams = z.infer<typeof NodeInvokeResultParamsSchema>;
export type NodeEventParams = z.infer<typeof NodeEventParamsSchema>;
export type SessionsListParams = z.infer<typeof SessionsListParamsSchema>;
export type SessionsPreviewParams = z.infer<typeof SessionsPreviewParamsSchema>;
export type SessionsResolveParams = z.infer<typeof SessionsResolveParamsSchema>;
export type SessionsPatchParams = z.infer<typeof SessionsPatchParamsSchema>;
export type SessionsResetParams = z.infer<typeof SessionsResetParamsSchema>;
export type SessionsDeleteParams = z.infer<typeof SessionsDeleteParamsSchema>;
export type SessionsCompactParams = z.infer<typeof SessionsCompactParamsSchema>;
export type ProjectsListParams = z.infer<typeof ProjectsListParamsSchema>;
export type ConfigGetParams = z.infer<typeof ConfigGetParamsSchema>;
export type ConfigSetParams = z.infer<typeof ConfigSetParamsSchema>;
export type ConfigApplyParams = z.infer<typeof ConfigApplyParamsSchema>;
export type ConfigPatchParams = z.infer<typeof ConfigPatchParamsSchema>;
export type ConfigSchemaParams = z.infer<typeof ConfigSchemaParamsSchema>;
export type ConfigSchemaResponse = z.infer<typeof ConfigSchemaResponseSchema>;
export type WizardStartParams = z.infer<typeof WizardStartParamsSchema>;
export type WizardNextParams = z.infer<typeof WizardNextParamsSchema>;
export type WizardCancelParams = z.infer<typeof WizardCancelParamsSchema>;
export type WizardStatusParams = z.infer<typeof WizardStatusParamsSchema>;
export type WizardStep = z.infer<typeof WizardStepSchema>;
export type WizardNextResult = z.infer<typeof WizardNextResultSchema>;
export type WizardStartResult = z.infer<typeof WizardStartResultSchema>;
export type WizardStatusResult = z.infer<typeof WizardStatusResultSchema>;
export type TalkModeParams = z.infer<typeof TalkModeParamsSchema>;
export type ChannelsStatusParams = z.infer<typeof ChannelsStatusParamsSchema>;
export type ChannelsStatusResult = z.infer<typeof ChannelsStatusResultSchema>;
export type ChannelsLogoutParams = z.infer<typeof ChannelsLogoutParamsSchema>;
export type WebLoginStartParams = z.infer<typeof WebLoginStartParamsSchema>;
export type WebLoginWaitParams = z.infer<typeof WebLoginWaitParamsSchema>;
export type AgentModelInfo = z.infer<typeof AgentModelInfoSchema>;
export type AgentSummary = z.infer<typeof AgentSummarySchema>;
export type AgentsFileEntry = z.infer<typeof AgentsFileEntrySchema>;
export type AgentsFilesListParams = z.infer<typeof AgentsFilesListParamsSchema>;
export type AgentsFilesListResult = z.infer<typeof AgentsFilesListResultSchema>;
export type AgentsFilesGetParams = z.infer<typeof AgentsFilesGetParamsSchema>;
export type AgentsFilesGetResult = z.infer<typeof AgentsFilesGetResultSchema>;
export type AgentsFilesSetParams = z.infer<typeof AgentsFilesSetParamsSchema>;
export type AgentsFilesSetResult = z.infer<typeof AgentsFilesSetResultSchema>;
export type AgentsListParams = z.infer<typeof AgentsListParamsSchema>;
export type AgentsListResult = z.infer<typeof AgentsListResultSchema>;
export type AgentsModelSetParams = z.infer<typeof AgentsModelSetParamsSchema>;
export type AgentsModelSetResult = z.infer<typeof AgentsModelSetResultSchema>;
export type ModelChoice = z.infer<typeof ModelChoiceSchema>;
export type ModelsListParams = z.infer<typeof ModelsListParamsSchema>;
export type ModelsListResult = z.infer<typeof ModelsListResultSchema>;
export type ModelCooldown = z.infer<typeof ModelCooldownSchema>;
export type ModelsCooldownsParams = z.infer<typeof ModelsCooldownsParamsSchema>;
export type ModelsCooldownsResult = z.infer<typeof ModelsCooldownsResultSchema>;
export type SkillsStatusParams = z.infer<typeof SkillsStatusParamsSchema>;
export type SkillsBinsParams = z.infer<typeof SkillsBinsParamsSchema>;
export type SkillsBinsResult = z.infer<typeof SkillsBinsResultSchema>;
export type SkillsInstallParams = z.infer<typeof SkillsInstallParamsSchema>;
export type SkillsUpdateParams = z.infer<typeof SkillsUpdateParamsSchema>;
export type CronJob = z.infer<typeof CronJobSchema>;
export type CronListParams = z.infer<typeof CronListParamsSchema>;
export type CronStatusParams = z.infer<typeof CronStatusParamsSchema>;
export type CronAddParams = z.infer<typeof CronAddParamsSchema>;
export type CronUpdateParams = z.infer<typeof CronUpdateParamsSchema>;
export type CronRemoveParams = z.infer<typeof CronRemoveParamsSchema>;
export type CronRunParams = z.infer<typeof CronRunParamsSchema>;
export type CronRunsParams = z.infer<typeof CronRunsParamsSchema>;
export type CronRunLogEntry = z.infer<typeof CronRunLogEntrySchema>;
export type LogsTailParams = z.infer<typeof LogsTailParamsSchema>;
export type LogsTailResult = z.infer<typeof LogsTailResultSchema>;
export type ExecApprovalsGetParams = z.infer<typeof ExecApprovalsGetParamsSchema>;
export type ExecApprovalsSetParams = z.infer<typeof ExecApprovalsSetParamsSchema>;
export type ExecApprovalsNodeGetParams = z.infer<typeof ExecApprovalsNodeGetParamsSchema>;
export type ExecApprovalsNodeSetParams = z.infer<typeof ExecApprovalsNodeSetParamsSchema>;
export type ExecApprovalsSnapshot = z.infer<typeof ExecApprovalsSnapshotSchema>;
export type ExecApprovalRequestParams = z.infer<typeof ExecApprovalRequestParamsSchema>;
export type ExecApprovalResolveParams = z.infer<typeof ExecApprovalResolveParamsSchema>;
export type FsPickDirectoryParams = z.infer<typeof FsPickDirectoryParamsSchema>;
export type DevicePairListParams = z.infer<typeof DevicePairListParamsSchema>;
export type DevicePairApproveParams = z.infer<typeof DevicePairApproveParamsSchema>;
export type DevicePairRejectParams = z.infer<typeof DevicePairRejectParamsSchema>;
export type DeviceTokenRotateParams = z.infer<typeof DeviceTokenRotateParamsSchema>;
export type DeviceTokenRevokeParams = z.infer<typeof DeviceTokenRevokeParamsSchema>;
export type ChatAbortParams = z.infer<typeof ChatAbortParamsSchema>;
export type ChatInjectParams = z.infer<typeof ChatInjectParamsSchema>;
export type ChatEvent = z.infer<typeof ChatEventSchema>;
export type UpdateRunParams = z.infer<typeof UpdateRunParamsSchema>;
export type TickEvent = z.infer<typeof TickEventSchema>;
export type ShutdownEvent = z.infer<typeof ShutdownEventSchema>;
