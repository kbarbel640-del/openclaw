import type { VoiceConnection, AudioPlayer } from "@discordjs/voice";

export type VoiceConnectionState = "disconnected" | "connecting" | "connected" | "ready" | "error";

export type VoiceSessionState = "idle" | "listening" | "speaking" | "transcribing";

export interface VoiceChannelUser {
  userId: string;
  username?: string;
  discriminator?: string;
  avatar?: string;
  mute: boolean;
  deaf: boolean;
  selfMute: boolean;
  selfDeaf: boolean;
  speaking: boolean;
  joinTimestamp: number;
}

export interface VoiceChannelSession {
  sessionId: string;
  guildId: string;
  channelId: string;
  channelName?: string;
  guildName?: string;
  connection: VoiceConnection | null;
  player: AudioPlayer | null;
  state: VoiceSessionState;
  users: Map<string, VoiceChannelUser>;
  startedAt: number;
  endedAt?: number;
  transcript: TranscriptEntry[];
  metadata?: Record<string, unknown>;
}

export interface TranscriptEntry {
  timestamp: number;
  speaker: "bot" | "user";
  speakerId?: string;
  speakerName?: string;
  text: string;
  isFinal: boolean;
}

export interface VoiceJoinOptions {
  guildId: string;
  channelId: string;
  selfMute?: boolean;
  selfDeaf?: boolean;
}

export interface VoiceLeaveOptions {
  guildId: string;
  reason?: string;
}

export interface VoiceSpeakOptions {
  guildId: string;
  text: string;
  interrupt?: boolean;
}

export interface VoiceStatusResult {
  connected: boolean;
  guildId?: string;
  channelId?: string;
  channelName?: string;
  guildName?: string;
  state: VoiceConnectionState;
  sessionState: VoiceSessionState;
  users: VoiceChannelUser[];
  duration?: number;
  transcriptLength: number;
}

export interface AudioConfig {
  sampleRate: number;
  channels: number;
  bitrate: number;
}

export const DEFAULT_AUDIO_CONFIG: AudioConfig = {
  sampleRate: 48000,
  channels: 2,
  bitrate: 64,
};

export interface DiscordVoiceConfig {
  enabled: boolean;
  autoJoinChannels?: string[];
  transcriptionEnabled: boolean;
  ttsEnabled: boolean;
  silenceTimeoutMs: number;
  maxRecordingDurationMs?: number;
  audioConfig?: Partial<AudioConfig>;
  /** Groq API key for Whisper transcription. Falls back to GROQ_API_KEY env. */
  groqApiKey?: string;
  /** Channel ID where transcription threads will be created. */
  transcriptionChannelId?: string;
  /** Whisper model to use for transcription. Default: whisper-large-v3-turbo */
  whisperModel?: string;
  /** LLM model for session summarization. Default: llama-3.3-70b-versatile */
  summarizationModel?: string;
  /** Auto-join voice channels when a user enters. Default: false */
  autoJoin?: boolean;
  /** Restrict auto-join to these guild IDs. Omit = all guilds. */
  autoJoinGuilds?: string[];
}

export interface VoiceEventManager {
  onUserJoin: (session: VoiceChannelSession, user: VoiceChannelUser) => void;
  onUserLeave: (session: VoiceChannelSession, userId: string) => void;
  onUserSpeaking: (session: VoiceChannelSession, userId: string, speaking: boolean) => void;
  onTranscript: (session: VoiceChannelSession, entry: TranscriptEntry) => void;
  onSilence: (session: VoiceChannelSession, durationMs: number) => void;
  onError: (session: VoiceChannelSession, error: Error) => void;
  onStateChange: (session: VoiceChannelSession, state: VoiceSessionState) => void;
}

export type VoiceEventCallback<K extends keyof VoiceEventManager> = Parameters<
  NonNullable<VoiceEventManager[K]>
>;

/** A single transcribed speech segment from a voice session. */
export interface SpeakerTranscription {
  userId: string;
  userName: string;
  text: string;
  timestamp: number;
}

/** Tracks the state of a voice transcription session. */
export interface VoiceTranscriptionSession {
  sessionId: string;
  guildId: string;
  channelId: string;
  threadId?: string;
  transcriptions: SpeakerTranscription[];
  /** Maps userId to display name. */
  userNames: Map<string, string>;
  startedAt: number;
}

export interface DiscordVoiceRuntime {
  sessions: Map<string, VoiceChannelSession>;
  getActiveSession: (guildId: string) => VoiceChannelSession | undefined;
  joinChannel: (options: VoiceJoinOptions) => Promise<VoiceChannelSession>;
  leaveChannel: (options: VoiceLeaveOptions) => Promise<void>;
  speak: (options: VoiceSpeakOptions) => Promise<void>;
  getStatus: (guildId?: string) => VoiceStatusResult | VoiceStatusResult[];
  startTranscription: (guildId: string) => Promise<void>;
  stopTranscription: (guildId: string) => Promise<void>;
  on: <K extends keyof VoiceEventManager>(
    event: K,
    callback: (...args: VoiceEventCallback<K>) => void,
  ) => void;
  off: <K extends keyof VoiceEventManager>(
    event: K,
    callback: (...args: VoiceEventCallback<K>) => void,
  ) => void;
}
