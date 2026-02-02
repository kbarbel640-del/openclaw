/**
 * Voice mode orchestrator.
 *
 * Primary mode: PersonaPlex S2S (native speech-to-speech)
 * Fallback mode: STT → LLM → TTS pipeline
 *
 * PersonaPlex is used as the primary path when available.
 * The traditional pipeline is only used when PersonaPlex is unavailable or fails.
 */

import type {
  VoiceConfig,
  VoiceMode,
  VoiceSessionState,
  ResolvedVoiceConfig,
} from "../config/types.voice.js";
import {
  resolveWhisperConfig,
  transcribeWithWhisper,
  isWhisperAvailable,
  isFfmpegAvailable,
} from "./local-stt.js";
import {
  resolveLocalTtsConfig,
  synthesizeWithLocalTts,
  synthesizeWithMacos,
  isSagAvailable,
  type LocalTtsResult,
} from "./local-tts.js";
import { resolveRouterConfig, routeVoiceRequest, type RouterDecision } from "./router.js";
import {
  checkPersonaPlexDependencies,
  getPersonaPlexStatus,
  resolvePersonaPlexConfig,
  isPersonaPlexInstalled,
  processWithPersonaPlex,
} from "./personaplex.js";

const DEFAULT_MODE: VoiceMode = "personaplex"; // PersonaPlex as default
const DEFAULT_BUFFER_MS = 100;
const DEFAULT_MAX_RECORDING_SECONDS = 60;
const DEFAULT_VAD_SENSITIVITY = 0.5;

export type VoiceProcessResult = {
  success: boolean;
  sessionId: string;
  transcription?: string;
  response?: string;
  audioPath?: string;
  audioBuffer?: Buffer;
  routerDecision?: RouterDecision;
  error?: string;
  timings?: {
    sttMs?: number;
    routingMs?: number;
    llmMs?: number;
    ttsMs?: number;
    totalMs: number;
  };
};

export type VoiceCapabilities = {
  whisperAvailable: boolean;
  ffmpegAvailable: boolean;
  sagAvailable: boolean;
  sagAuthenticated: boolean;
  macosSayAvailable: boolean;
  personaplexAvailable: boolean;
  personaplexInstalled: boolean;
  personaplexRunning: boolean;
  personaplexDeps: {
    opus: boolean;
    moshi: boolean;
    accelerate: boolean;
  };
};

/**
 * Resolve voice configuration with defaults.
 * PersonaPlex S2S is the default mode - STT/TTS are only fallbacks.
 */
export function resolveVoiceConfig(config?: VoiceConfig): ResolvedVoiceConfig {
  const resolvedPersonaPlex = resolvePersonaPlexConfig(config?.personaplex);
  return {
    mode: config?.mode ?? DEFAULT_MODE, // "personaplex" is default
    enabled: config?.enabled ?? false,
    sttProvider: config?.sttProvider ?? "whisper", // Fallback STT
    ttsProvider: config?.ttsProvider ?? "macos", // Fallback TTS (macos say is reliable)
    streaming: config?.streaming ?? false,
    bufferMs: config?.bufferMs ?? DEFAULT_BUFFER_MS,
    maxRecordingSeconds: config?.maxRecordingSeconds ?? DEFAULT_MAX_RECORDING_SECONDS,
    vadSensitivity: config?.vadSensitivity ?? DEFAULT_VAD_SENSITIVITY,
    whisper: resolveWhisperConfig(config?.whisper),
    localTts: resolveLocalTtsConfig(config?.localTts),
    router: resolveRouterConfig(config?.router),
    personaplex: {
      ...resolvedPersonaPlex,
      enabled: config?.personaplex?.enabled ?? true, // Enabled by default
      autoStart: config?.personaplex?.autoStart ?? true, // Auto-start by default
    },
  };
}

/**
 * Check voice mode capabilities.
 */
export async function checkVoiceCapabilities(
  config: ResolvedVoiceConfig,
): Promise<VoiceCapabilities> {
  const [whisperAvailable, ffmpegAvailable, sagStatus, personaplexDeps, personaplexStatus] =
    await Promise.all([
      isWhisperAvailable(config.whisper),
      isFfmpegAvailable(),
      isSagAvailable(),
      checkPersonaPlexDependencies(config.personaplex),
      getPersonaPlexStatus(config.personaplex),
    ]);

  // Check for macOS say
  const { isMacosSayAvailable } = await import("./local-tts.js");
  const macosSayAvailable = isMacosSayAvailable();

  const personaplexInstalled = personaplexStatus.installed;
  const personaplexRunning = personaplexStatus.running;
  const depsOk =
    personaplexDeps.opus &&
    personaplexDeps.moshi &&
    (!config.personaplex.cpuOffload || personaplexDeps.accelerate);
  const personaplexAvailable =
    config.personaplex.enabled && personaplexInstalled && depsOk && personaplexStatus.hasToken;

  return {
    whisperAvailable,
    ffmpegAvailable,
    sagAvailable: sagStatus.available,
    sagAuthenticated: sagStatus.authenticated,
    macosSayAvailable,
    personaplexAvailable,
    personaplexInstalled,
    personaplexRunning,
    personaplexDeps,
  };
}

/**
 * Generate a unique session ID.
 */
export function generateSessionId(): string {
  return `voice-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Create a new voice session state.
 */
export function createVoiceSession(mode: VoiceMode): VoiceSessionState {
  return {
    sessionId: generateSessionId(),
    mode,
    isRecording: false,
    isProcessing: false,
    startedAt: Date.now(),
    lastActivityAt: Date.now(),
  };
}

/**
 * Process voice input through PersonaPlex S2S (primary) or fallback pipeline.
 *
 * Primary path: PersonaPlex S2S (audio in → audio out, native)
 * Fallback path: STT → LLM → TTS (only when PersonaPlex unavailable)
 *
 * @param audioBuffer - Raw audio data (WAV or webm format - auto-converted)
 * @param config - Voice configuration
 * @param llmInvoke - Function to invoke the LLM (only used in fallback mode)
 * @returns Processing result
 */
export async function processVoiceInput(
  audioBuffer: Buffer,
  config: ResolvedVoiceConfig,
  llmInvoke: (text: string, model?: string) => Promise<string>,
): Promise<VoiceProcessResult> {
  const sessionId = generateSessionId();
  const startTime = Date.now();
  const timings: VoiceProcessResult["timings"] = { totalMs: 0 };

  // PRIMARY PATH: Try PersonaPlex S2S first (native speech-to-speech)
  if (config.mode === "personaplex" || config.mode === "hybrid") {
    const personaplexConfig = resolvePersonaPlexConfig(config.personaplex);

    if (personaplexConfig.enabled && isPersonaPlexInstalled(personaplexConfig)) {
      const s2sStart = Date.now();
      const s2sResult = await processWithPersonaPlex(audioBuffer, personaplexConfig);
      const s2sMs = Date.now() - s2sStart;

      if (s2sResult.success && s2sResult.audioBuffer) {
        // PersonaPlex succeeded - return native S2S result
        return {
          success: true,
          sessionId,
          transcription: "[PersonaPlex S2S - native audio]",
          response: "[Native speech response]",
          audioPath: s2sResult.audioPath,
          audioBuffer: s2sResult.audioBuffer,
          timings: {
            totalMs: s2sMs,
            // S2S doesn't have separate STT/LLM/TTS timings
          },
        };
      }

      // PersonaPlex failed - log and fall through to fallback
      console.warn(`PersonaPlex S2S failed: ${s2sResult.error}, falling back to STT+LLM+TTS`);
    }
  }

  // FALLBACK PATH: STT → LLM → TTS (when PersonaPlex unavailable or failed)

  // Step 1: STT based on provider setting
  const sttStart = Date.now();
  let sttResult: { success: boolean; text?: string; error?: string };

  if (config.sttProvider === "whisper") {
    const whisperReady = await isWhisperAvailable(config.whisper);
    if (!whisperReady) {
      return {
        success: false,
        sessionId,
        error:
          "Whisper STT is not available, install whisper-cpp and the model file before using voice fallback.",
        timings: { ...timings, totalMs: Date.now() - startTime },
      };
    }
  }

  switch (config.sttProvider) {
    case "whisper":
      sttResult = await transcribeWithWhisper(audioBuffer, config.whisper);
      break;
    case "openai":
      // TODO: Implement OpenAI Whisper API STT
      // For now, fall back to local whisper
      sttResult = await transcribeWithWhisper(audioBuffer, config.whisper);
      break;
    default:
      // Default to local whisper
      sttResult = await transcribeWithWhisper(audioBuffer, config.whisper);
  }

  timings.sttMs = Date.now() - sttStart;

  if (!sttResult.success || !sttResult.text) {
    return {
      success: false,
      sessionId,
      error: sttResult.error ?? "STT failed with no error message",
      timings: { ...timings, totalMs: Date.now() - startTime },
    };
  }

  const transcription = sttResult.text;

  // Step 2: Route the request
  const routingStart = Date.now();
  const routerDecision = routeVoiceRequest(transcription, config.router);
  timings.routingMs = Date.now() - routingStart;

  // Step 3: Invoke LLM
  const llmStart = Date.now();
  let response: string;
  try {
    response = await llmInvoke(transcription, routerDecision.model);
  } catch (err) {
    return {
      success: false,
      sessionId,
      transcription,
      routerDecision,
      error: `LLM invocation failed: ${(err as Error).message}`,
      timings: { ...timings, totalMs: Date.now() - startTime },
    };
  }
  timings.llmMs = Date.now() - llmStart;

  // Step 4: TTS based on provider setting
  const ttsStart = Date.now();
  let ttsResult: LocalTtsResult;

  switch (config.ttsProvider) {
    case "elevenlabs":
      // Use synthesizeWithLocalTts which tries ElevenLabs sag first
      ttsResult = await synthesizeWithLocalTts(response, config.localTts);
      break;
    case "macos":
      // Use macOS say directly
      ttsResult = await synthesizeWithMacos(response, config.localTts);
      break;
    case "openai":
      // TODO: Implement OpenAI TTS
      // For now, fall back to local TTS
      ttsResult = await synthesizeWithLocalTts(response, config.localTts);
      break;
    case "edge":
      // TODO: Implement Edge TTS
      // For now, fall back to local TTS
      ttsResult = await synthesizeWithLocalTts(response, config.localTts);
      break;
    default:
      ttsResult = await synthesizeWithLocalTts(response, config.localTts);
  }

  timings.ttsMs = Date.now() - ttsStart;

  if (!ttsResult.success) {
    return {
      success: false,
      sessionId,
      transcription,
      response,
      routerDecision,
      error: `TTS failed: ${ttsResult.error}`,
      timings: { ...timings, totalMs: Date.now() - startTime },
    };
  }

  timings.totalMs = Date.now() - startTime;

  return {
    success: true,
    sessionId,
    transcription,
    response,
    audioPath: ttsResult.audioPath,
    audioBuffer: ttsResult.audioBuffer,
    routerDecision,
    timings,
  };
}

/**
 * Process text input (skip STT) through routing, LLM, and TTS.
 * Useful for testing or hybrid interactions.
 * Respects ttsProvider setting for output synthesis.
 */
export async function processTextToVoice(
  text: string,
  config: ResolvedVoiceConfig,
  llmInvoke: (text: string, model?: string) => Promise<string>,
): Promise<VoiceProcessResult> {
  const sessionId = generateSessionId();
  const startTime = Date.now();
  const timings: VoiceProcessResult["timings"] = { totalMs: 0 };

  // Route the request
  const routingStart = Date.now();
  const routerDecision = routeVoiceRequest(text, config.router);
  timings.routingMs = Date.now() - routingStart;

  // Invoke LLM
  const llmStart = Date.now();
  let response: string;
  try {
    response = await llmInvoke(text, routerDecision.model);
  } catch (err) {
    return {
      success: false,
      sessionId,
      transcription: text,
      routerDecision,
      error: `LLM invocation failed: ${(err as Error).message}`,
      timings: { ...timings, totalMs: Date.now() - startTime },
    };
  }
  timings.llmMs = Date.now() - llmStart;

  // TTS based on provider setting
  const ttsStart = Date.now();
  let ttsResult: LocalTtsResult;

  switch (config.ttsProvider) {
    case "elevenlabs":
      ttsResult = await synthesizeWithLocalTts(response, config.localTts);
      break;
    case "macos":
      ttsResult = await synthesizeWithMacos(response, config.localTts);
      break;
    case "openai":
      // TODO: Implement OpenAI TTS
      ttsResult = await synthesizeWithLocalTts(response, config.localTts);
      break;
    case "edge":
      // TODO: Implement Edge TTS
      ttsResult = await synthesizeWithLocalTts(response, config.localTts);
      break;
    default:
      ttsResult = await synthesizeWithLocalTts(response, config.localTts);
  }

  timings.ttsMs = Date.now() - ttsStart;

  if (!ttsResult.success) {
    return {
      success: false,
      sessionId,
      transcription: text,
      response,
      routerDecision,
      error: `TTS failed: ${ttsResult.error}`,
      timings: { ...timings, totalMs: Date.now() - startTime },
    };
  }

  timings.totalMs = Date.now() - startTime;

  return {
    success: true,
    sessionId,
    transcription: text,
    response,
    audioPath: ttsResult.audioPath,
    audioBuffer: ttsResult.audioBuffer,
    routerDecision,
    timings,
  };
}
