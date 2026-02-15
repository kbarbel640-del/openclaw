// DiscordVoiceConfig is inferred from the Zod schema in config.ts
// Re-export it from there to avoid circular imports
export type { DiscordVoiceConfig } from "./config.js";

export interface LoggerLike {
  info: Function;
  warn: Function;
  error: Function;
  debug?: Function;
}

export enum VoiceSessionState {
  Idle = "idle",
  Connecting = "connecting",
  Ready = "ready",
  Listening = "listening",
  Processing = "processing",
  Speaking = "speaking",
}

export interface VoiceChannelSession {
  guildId: string;
  channelId: string;
  state: VoiceSessionState;
  speakers: Map<string, { userId: string; userName?: string }>;
  startedAt: number;
}

export interface TranscriptionResult {
  text: string;
  userId: string;
  userName?: string;
  language?: string;
  duration?: number;
}

export interface AgentResponse {
  text: string;
  sessionKey: string;
}
