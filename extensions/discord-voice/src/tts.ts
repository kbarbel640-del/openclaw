import type { LoggerLike } from "./types.js";

const DEFAULT_ELEVENLABS_VOICE_ID = "pFZP5JQG7iQjIQuC4Bku";
const DEFAULT_ELEVENLABS_MODEL_ID = "eleven_turbo_v2_5";
const DEFAULT_OPENAI_VOICE = "nova";
const DEFAULT_OPENAI_MODEL = "gpt-4o-mini-tts";

export interface TTSConfig {
  provider: "elevenlabs" | "openai";
  // ElevenLabs
  elevenlabsApiKey?: string;
  voiceId?: string; // default: pFZP5JQG7iQjIQuC4Bku (Lily)
  modelId?: string; // default: eleven_turbo_v2_5
  // OpenAI
  openaiApiKey?: string;
  openaiVoice?: string; // default: nova
  openaiModel?: string; // default: gpt-4o-mini-tts
}

export interface TTSResult {
  audio: Buffer;
  format: "mp3" | "pcm" | "opus";
  durationMs?: number;
}

type Logger = {
  info: (...args: unknown[]) => void;
  warn: (...args: unknown[]) => void;
  error: (...args: unknown[]) => void;
  debug: (...args: unknown[]) => void;
};

export class TTSProvider {
  private readonly config: TTSConfig;
  private readonly logger: Logger;

  constructor(config: TTSConfig, logger?: LoggerLike) {
    this.config = config;
    this.logger = {
      info: (...args: unknown[]) => logger?.info?.(...args),
      warn: (...args: unknown[]) => logger?.warn?.(...args),
      error: (...args: unknown[]) => logger?.error?.(...args),
      debug: (...args: unknown[]) => logger?.debug?.(...args),
    };
  }

  async synthesize(text: string): Promise<TTSResult> {
    if (!text || !text.trim()) {
      throw new Error("TTS text cannot be empty");
    }

    if (this.config.provider === "elevenlabs") {
      try {
        return await this.synthesizeWithElevenLabs(text);
      } catch (error) {
        if (!this.config.openaiApiKey) {
          throw error;
        }

        const reason = error instanceof Error ? error.message : String(error);
        this.logger.warn(`ElevenLabs TTS failed, falling back to OpenAI: ${reason}`);
        return this.synthesizeWithOpenAI(text);
      }
    }

    return this.synthesizeWithOpenAI(text);
  }

  private async synthesizeWithElevenLabs(text: string): Promise<TTSResult> {
    if (!this.config.elevenlabsApiKey) {
      throw new Error("Missing ElevenLabs API key for TTS");
    }

    const voiceId = this.config.voiceId ?? DEFAULT_ELEVENLABS_VOICE_ID;
    const modelId = this.config.modelId ?? DEFAULT_ELEVENLABS_MODEL_ID;
    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}/stream`,
      {
        method: "POST",
        headers: {
          "xi-api-key": this.config.elevenlabsApiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text,
          model_id: modelId,
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.75,
            speed: 1.0,
          },
        }),
      },
    );

    if (!response.ok) {
      const detail = await this.extractErrorMessage(response);
      throw new Error(`ElevenLabs TTS request failed with status ${response.status}: ${detail}`);
    }

    const audio = Buffer.from(await response.arrayBuffer());
    this.logger.debug(`Synthesized ElevenLabs TTS (${audio.length} bytes)`);
    return { audio, format: "mp3" };
  }

  private async synthesizeWithOpenAI(text: string): Promise<TTSResult> {
    if (!this.config.openaiApiKey) {
      throw new Error("Missing OpenAI API key for TTS");
    }

    const response = await fetch("https://api.openai.com/v1/audio/speech", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.config.openaiApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: this.config.openaiModel ?? DEFAULT_OPENAI_MODEL,
        voice: this.config.openaiVoice ?? DEFAULT_OPENAI_VOICE,
        input: text,
        response_format: "mp3",
      }),
    });

    if (!response.ok) {
      const detail = await this.extractErrorMessage(response);
      throw new Error(`OpenAI TTS request failed with status ${response.status}: ${detail}`);
    }

    const audio = Buffer.from(await response.arrayBuffer());
    this.logger.debug(`Synthesized OpenAI TTS (${audio.length} bytes)`);
    return { audio, format: "mp3" };
  }

  private async extractErrorMessage(response: Response): Promise<string> {
    const body = await response.text().catch(() => "");
    if (!body) {
      return "No response body";
    }

    try {
      const parsed = JSON.parse(body) as {
        error?: { message?: string };
        message?: string;
        detail?: string;
      };
      return parsed.error?.message ?? parsed.message ?? parsed.detail ?? body;
    } catch {
      return body;
    }
  }
}
