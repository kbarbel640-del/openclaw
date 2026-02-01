// Query hooks barrel export

// Agents
export {
  useAgents,
  useAgent,
  useAgentsByStatus,
  agentKeys,
} from "./useAgents";
export type { Agent, AgentStatus } from "./useAgents";

// Conversations
export {
  useConversations,
  useConversation,
  useConversationsByAgent,
  useMessages,
  conversationKeys,
} from "./useConversations";
export type { Conversation, Message } from "./useConversations";

// Goals
export {
  useGoals,
  useGoal,
  useGoalsByStatus,
  goalKeys,
} from "./useGoals";
export type { Goal, GoalStatus, Milestone } from "./useGoals";

// Memories
export {
  useMemories,
  useMemory,
  useMemoriesByType,
  useMemoriesByTag,
  useMemorySearch,
  memoryKeys,
} from "./useMemories";
export type { Memory, MemoryType } from "./useMemories";

// Rituals
export {
  useRituals,
  useRitual,
  useRitualsByStatus,
  useRitualsByAgent,
  useRitualExecutions,
  ritualKeys,
} from "./useRituals";
export type {
  Ritual,
  RitualStatus,
  RitualFrequency,
  RitualExecution,
} from "./useRituals";

// Workstreams
export {
  useWorkstreams,
  useWorkstream,
  useWorkstreamsByStatus,
  useWorkstreamsByOwner,
  useTasks,
  useTasksByStatus,
  workstreamKeys,
} from "./useWorkstreams";
export type {
  Workstream,
  WorkstreamStatus,
  Task,
  TaskStatus,
  TaskPriority,
} from "./useWorkstreams";

// Config
export { useConfig, useConfigSchema, configKeys } from "./useConfig";
export type { ConfigSnapshot } from "./useConfig";

// Channels
export {
  useChannelsStatus,
  useChannelsStatusFast,
  useChannelsStatusDeep,
  channelKeys,
} from "./useChannels";
export type {
  ChannelStatusResponse,
  ChannelAccountSnapshot,
  ChannelSummary,
  ChannelMetaEntry,
} from "./useChannels";

// Models
export { useModels, useModelsByProvider, modelKeys } from "./useModels";
export type { ModelsListResponse, ModelEntry } from "./useModels";

// Gateway
export {
  useGatewayHealth,
  useGatewayStatus,
  useGatewayConnected,
  gatewayKeys,
} from "./useGateway";
export type { HealthResponse, StatusResponse } from "./useGateway";

// User Settings
export {
  useUserProfile,
  useUserPreferences,
  useUserSettings,
  usePrefetchUserSettings,
  userSettingsKeys,
} from "./useUserSettings";
export type {
  UserProfile,
  UserPreferences,
  UserSettings,
  NotificationPreference,
} from "./useUserSettings";

// Sessions
export {
  useSessions,
  useAgentSessions,
  useChatHistory,
  useChatEventSubscription,
  sessionKeys,
} from "./useSessions";
