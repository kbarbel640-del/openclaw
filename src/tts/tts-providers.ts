/**
 * TTS provider implementations: ElevenLabs, OpenAI, and Edge TTS.
 *
 * Extracted from tts.ts to keep file sizes manageable.
 */

import { EdgeTTS } from "node-edge-tts";
import type { ResolvedTtsConfig } from "./tts.js";
import {
  isValidVoiceId,
  normalizeLanguageCode,
  normalizeApplyTextNormalization,
  normalizeSeed,
  isValidOpenAIModel,
  isValidOpenAIVoice,
  getOpenAITtsBaseUrl,
} from "./tts-directives.js";

// ── Provider-specific constants ──────────────────────────────────────────────

export const DEFAULT_ELEVENLABS_BASE_URL = "https://api.elevenlabs.io";
export const DEFAULT_ELEVENLABS_VOICE_ID = "pMsXgVXv3BLzUgSXRplE";
export const DEFAULT_ELEVENLABS_MODEL_ID = "eleven_multilingual_v2";
export const DEFAULT_OPENAI_MODEL = "gpt-4o-mini-tts";
export const DEFAULT_OPENAI_VOICE = "alloy";
export const DEFAULT_EDGE_VOICE = "en-US-MichelleNeural";
export const DEFAULT_EDGE_LANG = "en-US";
export const DEFAULT_EDGE_OUTPUT_FORMAT = "audio-24khz-48kbitrate-mono-mp3";

export const DEFAULT_ELEVENLABS_VOICE_SETTINGS = {
  stability: 0.5,
  similarityBoost: 0.75,
  style: 0.0,
  useSpeakerBoost: true,
  speed: 1.0,
};

export const TELEGRAM_OUTPUT = {
  openai: "opus" as const,
  // ElevenLabs output formats use codec_sample_rate_bitrate naming.
  // Opus @ 48kHz/64kbps is a good voice-note tradeoff for Telegram.
  elevenlabs: "opus_48000_64",
  extension: ".opus",
  voiceCompatible: true,
};

export const DEFAULT_OUTPUT = {
  openai: "mp3" as const,
  elevenlabs: "mp3_44100_128",
  extension: ".mp3",
  voiceCompatible: false,
};

export const TELEPHONY_OUTPUT = {
  openai: { format: "pcm" as const, sampleRate: 24000 },
  elevenlabs: { format: "pcm_22050", sampleRate: 22050 },
};

// ── ElevenLabs helpers ───────────────────────────────────────────────────────

export function normalizeElevenLabsBaseUrl(baseUrl: string): string {
  const trimmed = baseUrl.trim();
  if (!trimmed) {
    return DEFAULT_ELEVENLABS_BASE_URL;
  }
  return trimmed.replace(/\/+$/, "");
}

function requireInRange(value: number, min: number, max: number, label: string): void {
  if (!Number.isFinite(value) || value < min || value > max) {
    throw new Error(`${label} must be between ${min} and ${max}`);
  }
}

export function assertElevenLabsVoiceSettings(
  settings: ResolvedTtsConfig["elevenlabs"]["voiceSettings"],
) {
  requireInRange(settings.stability, 0, 1, "stability");
  requireInRange(settings.similarityBoost, 0, 1, "similarityBoost");
  requireInRange(settings.style, 0, 1, "style");
  requireInRange(settings.speed, 0.5, 2, "speed");
}

// ── ElevenLabs TTS ───────────────────────────────────────────────────────────

export async function elevenLabsTTS(params: {
  text: string;
  apiKey: string;
  baseUrl: string;
  voiceId: string;
  modelId: string;
  outputFormat: string;
  seed?: number;
  applyTextNormalization?: "auto" | "on" | "off";
  languageCode?: string;
  voiceSettings: ResolvedTtsConfig["elevenlabs"]["voiceSettings"];
  timeoutMs: number;
}): Promise<Buffer> {
  const {
    text,
    apiKey,
    baseUrl,
    voiceId,
    modelId,
    outputFormat,
    seed,
    applyTextNormalization,
    languageCode,
    voiceSettings,
    timeoutMs,
  } = params;
  if (!isValidVoiceId(voiceId)) {
    throw new Error("Invalid voiceId format");
  }
  assertElevenLabsVoiceSettings(voiceSettings);
  const normalizedLanguage = normalizeLanguageCode(languageCode);
  const normalizedNormalization = normalizeApplyTextNormalization(applyTextNormalization);
  const normalizedSeed = normalizeSeed(seed);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const url = new URL(`${normalizeElevenLabsBaseUrl(baseUrl)}/v1/text-to-speech/${voiceId}`);
    if (outputFormat) {
      url.searchParams.set("output_format", outputFormat);
    }

    const response = await fetch(url.toString(), {
      method: "POST",
      headers: {
        "xi-api-key": apiKey,
        "Content-Type": "application/json",
        Accept: "audio/mpeg",
      },
      body: JSON.stringify({
        text,
        model_id: modelId,
        seed: normalizedSeed,
        apply_text_normalization: normalizedNormalization,
        language_code: normalizedLanguage,
        voice_settings: {
          stability: voiceSettings.stability,
          similarity_boost: voiceSettings.similarityBoost,
          style: voiceSettings.style,
          use_speaker_boost: voiceSettings.useSpeakerBoost,
          speed: voiceSettings.speed,
        },
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`ElevenLabs API error (${response.status})`);
    }

    return Buffer.from(await response.arrayBuffer());
  } finally {
    clearTimeout(timeout);
  }
}

// ── OpenAI TTS ───────────────────────────────────────────────────────────────

export async function openaiTTS(params: {
  text: string;
  apiKey: string;
  model: string;
  voice: string;
  responseFormat: "mp3" | "opus" | "pcm";
  timeoutMs: number;
}): Promise<Buffer> {
  const { text, apiKey, model, voice, responseFormat, timeoutMs } = params;

  if (!isValidOpenAIModel(model)) {
    throw new Error(`Invalid model: ${model}`);
  }
  if (!isValidOpenAIVoice(voice)) {
    throw new Error(`Invalid voice: ${voice}`);
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(`${getOpenAITtsBaseUrl()}/audio/speech`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        input: text,
        voice,
        response_format: responseFormat,
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`OpenAI TTS API error (${response.status})`);
    }

    return Buffer.from(await response.arrayBuffer());
  } finally {
    clearTimeout(timeout);
  }
}

// ── Edge TTS ─────────────────────────────────────────────────────────────────

export function inferEdgeExtension(outputFormat: string): string {
  const normalized = outputFormat.toLowerCase();
  if (normalized.includes("webm")) {
    return ".webm";
  }
  if (normalized.includes("ogg")) {
    return ".ogg";
  }
  if (normalized.includes("opus")) {
    return ".opus";
  }
  if (normalized.includes("wav") || normalized.includes("riff") || normalized.includes("pcm")) {
    return ".wav";
  }
  return ".mp3";
}

export async function edgeTTS(params: {
  text: string;
  outputPath: string;
  config: ResolvedTtsConfig["edge"];
  timeoutMs: number;
}): Promise<void> {
  const { text, outputPath, config, timeoutMs } = params;
  const tts = new EdgeTTS({
    voice: config.voice,
    lang: config.lang,
    outputFormat: config.outputFormat,
    saveSubtitles: config.saveSubtitles,
    proxy: config.proxy,
    rate: config.rate,
    pitch: config.pitch,
    volume: config.volume,
    timeout: config.timeoutMs ?? timeoutMs,
  });
  await tts.ttsPromise(text, outputPath);
}
