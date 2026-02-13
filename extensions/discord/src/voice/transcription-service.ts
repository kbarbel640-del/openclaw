/**
 * Voice transcription service wrapping Groq Whisper via the existing
 * OpenAI-compatible transcription function.
 */
import { transcribeOpenAiCompatibleAudio } from "../../../../src/media-understanding/providers/openai/audio.js";
import { wrapPcmInWav } from "./wav.js";

const GROQ_BASE_URL = "https://api.groq.com/openai/v1";
const DEFAULT_WHISPER_MODEL = "whisper-large-v3-turbo";
/** Minimum audio duration in seconds to attempt transcription. */
const MIN_AUDIO_DURATION_S = 0.5;
/** Bytes per second for 48kHz stereo 16-bit PCM. */
const PCM_BYTES_PER_SECOND = 48000 * 2 * 2;

export interface TranscribeVoiceAudioParams {
  userId: string;
  userName: string;
  pcmData: Buffer;
  apiKey: string;
  model?: string;
  language?: string;
}

export interface TranscribeVoiceAudioResult {
  userId: string;
  userName: string;
  text: string;
  model: string;
}

/**
 * Transcribe a PCM audio buffer via Groq Whisper.
 * Returns `null` for short audio or on any failure (never throws).
 */
export async function transcribeVoiceAudio(
  params: TranscribeVoiceAudioParams,
): Promise<TranscribeVoiceAudioResult | null> {
  try {
    const durationS = params.pcmData.length / PCM_BYTES_PER_SECOND;
    if (durationS < MIN_AUDIO_DURATION_S) {
      return null;
    }

    const wavBuffer = wrapPcmInWav(params.pcmData);
    const model = params.model ?? DEFAULT_WHISPER_MODEL;

    const result = await transcribeOpenAiCompatibleAudio({
      buffer: wavBuffer,
      fileName: "voice.wav",
      mime: "audio/wav",
      apiKey: params.apiKey,
      baseUrl: GROQ_BASE_URL,
      model,
      language: params.language,
      timeoutMs: 30_000,
    });

    if (!result.text?.trim()) {
      return null;
    }

    return {
      userId: params.userId,
      userName: params.userName,
      text: result.text.trim(),
      model: result.model ?? model,
    };
  } catch (err) {
    console.error(`[transcription] error:`, err);
    return null;
  }
}
