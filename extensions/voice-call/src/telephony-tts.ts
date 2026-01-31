import type { CoreConfig } from "./core-bridge.js";
import type { VoiceCallTtsConfig } from "./config.js";
import { convertPcmToMulaw8k } from "./telephony-audio.js";
import { GroqTTSProvider } from "./providers/tts-groq.js";

export type TelephonyTtsRuntime = {
  textToSpeechTelephony: (params: {
    text: string;
    cfg: CoreConfig;
    prefsPath?: string;
  }) => Promise<{
    success: boolean;
    audioBuffer?: Buffer;
    sampleRate?: number;
    provider?: string;
    error?: string;
  }>;
};

export type TelephonyTtsProvider = {
  synthesizeForTelephony: (text: string) => Promise<Buffer>;
};

export function createTelephonyTtsProvider(params: {
  coreConfig: CoreConfig;
  ttsOverride?: VoiceCallTtsConfig;
  runtime: TelephonyTtsRuntime;
  groqApiKey?: string;
}): TelephonyTtsProvider {
  const { coreConfig, ttsOverride, runtime, groqApiKey } = params;

  // Check if Groq TTS is configured
  if (ttsOverride?.provider === "groq") {
    const groqConfig = ttsOverride.groq;
    const apiKey = groqConfig?.apiKey || groqApiKey || process.env.GROQ_API_KEY;

    if (!apiKey) {
      throw new Error(
        "Groq TTS requires API key (set in tts.groq.apiKey, providers.groq.apiKey, or GROQ_API_KEY env)",
      );
    }

    const provider = new GroqTTSProvider({
      apiKey,
      voice: groqConfig?.voice as "troy" | "austin" | "daniel" | "autumn" | "diana" | "hannah",
      vocalDirection: groqConfig?.vocalDirection,
    });

    return {
      synthesizeForTelephony: (text: string) => provider.synthesizeForTwilio(text),
    };
  }

  // Fall through to core runtime delegation for other providers
  const mergedConfig = applyTtsOverride(coreConfig, ttsOverride);

  return {
    synthesizeForTelephony: async (text: string) => {
      const result = await runtime.textToSpeechTelephony({
        text,
        cfg: mergedConfig,
      });

      if (!result.success || !result.audioBuffer || !result.sampleRate) {
        throw new Error(result.error ?? "TTS conversion failed");
      }

      return convertPcmToMulaw8k(result.audioBuffer, result.sampleRate);
    },
  };
}

function applyTtsOverride(
  coreConfig: CoreConfig,
  override?: VoiceCallTtsConfig,
): CoreConfig {
  if (!override) return coreConfig;

  const base = coreConfig.messages?.tts;
  const merged = mergeTtsConfig(base, override);
  if (!merged) return coreConfig;

  return {
    ...coreConfig,
    messages: {
      ...(coreConfig.messages ?? {}),
      tts: merged,
    },
  };
}

function mergeTtsConfig(
  base?: VoiceCallTtsConfig,
  override?: VoiceCallTtsConfig,
): VoiceCallTtsConfig | undefined {
  if (!base && !override) return undefined;
  if (!override) return base;
  if (!base) return override;
  return deepMerge(base, override);
}

function deepMerge<T>(base: T, override: T): T {
  if (!isPlainObject(base) || !isPlainObject(override)) {
    return override;
  }
  const result: Record<string, unknown> = { ...base };
  for (const [key, value] of Object.entries(override)) {
    if (value === undefined) continue;
    const existing = (base as Record<string, unknown>)[key];
    if (isPlainObject(existing) && isPlainObject(value)) {
      result[key] = deepMerge(existing, value);
    } else {
      result[key] = value;
    }
  }
  return result as T;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
