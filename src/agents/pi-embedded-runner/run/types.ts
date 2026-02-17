import type { AgentMessage } from "@mariozechner/pi-agent-core";
import type { Api, AssistantMessage, Model } from "@mariozechner/pi-ai";
import type { ThinkLevel } from "../../../auto-reply/thinking.js";
import type { SessionSystemPromptReport } from "../../../config/sessions/types.js";
import type { PluginHookBeforeAgentStartResult } from "../../../plugins/types.js";
import type { MessagingToolSend } from "../../pi-embedded-messaging.js";
import type { AuthStorage, ModelRegistry } from "../../pi-model-discovery.js";
import type { NormalizedUsage } from "../../usage.js";
import type { RunEmbeddedPiAgentParams } from "./params.js";

type EmbeddedRunAttemptBase = Omit<
  RunEmbeddedPiAgentParams,
  "provider" | "model" | "authProfileId" | "authProfileIdSource" | "thinkLevel" | "lane" | "enqueue"
>;

export type EmbeddedRunAttemptParams = EmbeddedRunAttemptBase & {
  provider: string;
  modelId: string;
  model: Model<Api>;
  authStorage: AuthStorage;
  modelRegistry: ModelRegistry;
  thinkLevel: ThinkLevel;
  verboseLevel?: VerboseLevel;
  reasoningLevel?: ReasoningLevel;
  toolResultFormat?: ToolResultFormat;
  execOverrides?: Pick<ExecToolDefaults, "host" | "security" | "ask" | "node">;
  bashElevated?: ExecElevatedDefaults;
  timeoutMs: number;
  runId: string;
  abortSignal?: AbortSignal;
  shouldEmitToolResult?: () => boolean;
  shouldEmitToolOutput?: () => boolean;
  onPartialReply?: (payload: { text?: string; mediaUrls?: string[] }) => void | Promise<void>;
  onAssistantMessageStart?: () => void | Promise<void>;
  onBlockReply?: (payload: {
    text?: string;
    mediaUrls?: string[];
    audioAsVoice?: boolean;
    replyToId?: string;
    replyToTag?: boolean;
    replyToCurrent?: boolean;
  }) => void | Promise<void>;
  onBlockReplyFlush?: () => void | Promise<void>;
  blockReplyBreak?: "text_end" | "message_end";
  blockReplyChunking?: BlockReplyChunking;
  onReasoningStream?: (payload: { text?: string; mediaUrls?: string[] }) => void | Promise<void>;
  onToolResult?: (payload: { text?: string; mediaUrls?: string[] }) => void | Promise<void>;
  onAgentEvent?: (evt: { stream: string; data: Record<string, unknown> }) => void;
  /** Require explicit message tool targets (no implicit last-route sends). */
  requireExplicitMessageTarget?: boolean;
  /** If true, omit the message tool from the tool list. */
  disableMessageTool?: boolean;
  extraSystemPrompt?: string;
  streamParams?: AgentStreamParams;
  ownerNumbers?: string[];
  enforceFinalTag?: boolean;
  /**
   * Force-prepend an opening `<think>` tag to the model's response.
   * Useful for reasoning models that don't reliably emit think tags.
   */
  forcePrependThinkTag?: boolean;
  /** Pre-computed hook result from run.ts to avoid double-firing before_agent_start. */
  earlyHookResult?: PluginHookBeforeAgentStartResult;
};

export type EmbeddedRunAttemptResult = {
  aborted: boolean;
  timedOut: boolean;
  /** True if the timeout occurred while compaction was in progress or pending. */
  timedOutDuringCompaction: boolean;
  promptError: unknown;
  sessionIdUsed: string;
  systemPromptReport?: SessionSystemPromptReport;
  messagesSnapshot: AgentMessage[];
  assistantTexts: string[];
  toolMetas: Array<{ toolName: string; meta?: string }>;
  lastAssistant: AssistantMessage | undefined;
  lastToolError?: {
    toolName: string;
    meta?: string;
    error?: string;
    mutatingAction?: boolean;
    actionFingerprint?: string;
  };
  didSendViaMessagingTool: boolean;
  messagingToolSentTexts: string[];
  messagingToolSentMediaUrls: string[];
  messagingToolSentTargets: MessagingToolSend[];
  successfulCronAdds?: number;
  cloudCodeAssistFormatError: boolean;
  attemptUsage?: NormalizedUsage;
  compactionCount?: number;
  /** Client tool call detected (OpenResponses hosted tools). */
  clientToolCall?: { name: string; params: Record<string, unknown> };
};
