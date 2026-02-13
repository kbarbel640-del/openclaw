export { DiscordVoiceProvider } from "./provider.js";
export { DiscordVoiceConnectionManager } from "./connection.js";
export {
  AudioPipeline,
  IncomingAudioHandler,
  OutgoingAudioHandler,
  OpusDecoder,
  OpusEncoder,
} from "./audio-pipeline.js";
export {
  parseDiscordVoiceConfig,
  mergeVoiceConfig,
  resolveVoiceConfigFromPluginConfig,
  resolveGroqApiKey,
  DiscordVoiceConfigSchema,
  DEFAULT_DISCORD_VOICE_CONFIG,
} from "./config.js";
export {
  createInitiatedEvent,
  createActiveEvent,
  createSpeechEvent,
  createSpeakingEvent,
  createSilenceEvent,
  createEndedEvent,
  createErrorEvent,
  transcriptEntryToEvent,
} from "./events.js";
export { wrapPcmInWav } from "./wav.js";
export { transcribeVoiceAudio } from "./transcription-service.js";
export { summarizeVoiceSession } from "./summarization-service.js";
export { VoiceThreadManager } from "./thread-manager.js";
export { DiscordVoiceStateListener } from "./voice-state-listener.js";
export { VoiceSessionOrchestrator } from "./session-orchestrator.js";
export type {
  VoiceChannelSession,
  VoiceChannelUser,
  VoiceConnectionState,
  VoiceSessionState,
  VoiceJoinOptions,
  VoiceLeaveOptions,
  VoiceSpeakOptions,
  VoiceStatusResult,
  VoiceEventManager,
  VoiceEventCallback,
  DiscordVoiceConfig,
  DiscordVoiceRuntime,
  AudioConfig,
  TranscriptEntry,
  SpeakerTranscription,
  VoiceTranscriptionSession,
} from "./types.js";
