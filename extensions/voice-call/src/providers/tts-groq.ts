/**
 * Groq Orpheus TTS Provider
 *
 * Generates speech audio using Groq's Orpheus text-to-speech API.
 * Handles audio format conversion for telephony (mu-law 8kHz).
 *
 * Key features:
 * - Uses Canopy Labs Orpheus model for expressive TTS
 * - Supports vocal directions like [briskly low playful]
 * - Handles 200-char limit by chunking at sentence boundaries
 * - Converts WAV (24kHz) to mu-law (8kHz) for Twilio
 *
 * @see https://console.groq.com/docs/text-to-speech/orpheus
 */

import { convertPcmToMulaw8k } from "../telephony-audio.js";

/**
 * Groq Orpheus TTS configuration.
 */
export interface GroqTTSConfig {
  /** Groq API key (uses GROQ_API_KEY env if not set) */
  apiKey?: string;
  /**
   * Voice persona to use.
   * Male: troy, austin, daniel
   * Female: autumn, diana, hannah
   */
  voice?: GroqTTSVoice;
  /**
   * Vocal direction to prepend to text.
   * Examples: "[briskly low playful]", "[confident]", "[whisper]"
   * Controls speech style and pace.
   */
  vocalDirection?: string;
}

/**
 * Supported Groq Orpheus voices (English).
 */
export const GROQ_TTS_VOICES = [
  "troy",
  "austin",
  "daniel",
  "autumn",
  "diana",
  "hannah",
] as const;

export type GroqTTSVoice = (typeof GROQ_TTS_VOICES)[number];

/** Maximum characters per Groq TTS request */
const MAX_CHARS_PER_REQUEST = 200;

/** Reserve space for vocal direction prefix */
const DIRECTION_BUFFER = 30;

/**
 * Groq Orpheus TTS Provider for generating speech audio.
 */
export class GroqTTSProvider {
  private apiKey: string;
  private voice: GroqTTSVoice;
  private vocalDirection: string;

  constructor(config: GroqTTSConfig = {}) {
    this.apiKey = config.apiKey || process.env.GROQ_API_KEY || "";
    this.voice = config.voice || "troy";
    this.vocalDirection = config.vocalDirection || "";

    if (!this.apiKey) {
      throw new Error(
        "Groq API key required (set GROQ_API_KEY or pass apiKey)",
      );
    }
  }

  /**
   * Generate speech audio from text.
   * Returns raw PCM audio data (24kHz, mono, 16-bit).
   */
  async synthesize(text: string): Promise<Buffer> {
    // Prepend vocal direction if set
    const inputText = this.vocalDirection
      ? `${this.vocalDirection} ${text}`
      : text;

    const response = await fetch(
      "https://api.groq.com/openai/v1/audio/speech",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "canopylabs/orpheus-v1-english",
          input: inputText,
          voice: this.voice,
          response_format: "wav",
        }),
      },
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Groq TTS failed: ${response.status} - ${error}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const wavBuffer = Buffer.from(arrayBuffer);

    // Parse WAV and extract PCM data
    return parseWavToPcm(wavBuffer);
  }

  /**
   * Generate speech for potentially long text by chunking.
   * Handles 200-char limit by splitting at sentence boundaries.
   * Returns combined PCM audio buffer.
   */
  async synthesizeChunked(text: string): Promise<Buffer> {
    const chunks = splitTextForTTS(
      text,
      MAX_CHARS_PER_REQUEST - (this.vocalDirection ? this.vocalDirection.length + 1 : 0) - DIRECTION_BUFFER,
    );

    if (chunks.length === 0) {
      return Buffer.alloc(0);
    }

    // Synthesize all chunks
    const audioBuffers: Buffer[] = [];
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      // Only prepend vocal direction to first chunk
      const inputText =
        i === 0 && this.vocalDirection
          ? `${this.vocalDirection} ${chunk}`
          : chunk;

      const response = await fetch(
        "https://api.groq.com/openai/v1/audio/speech",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "canopylabs/orpheus-v1-english",
            input: inputText,
            voice: this.voice,
            response_format: "wav",
          }),
        },
      );

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Groq TTS failed on chunk ${i}: ${response.status} - ${error}`);
      }

      const arrayBuffer = await response.arrayBuffer();
      const wavBuffer = Buffer.from(arrayBuffer);
      const pcmBuffer = parseWavToPcm(wavBuffer);
      audioBuffers.push(pcmBuffer);
    }

    // Concatenate all PCM buffers
    return Buffer.concat(audioBuffers);
  }

  /**
   * Generate speech and convert to mu-law format for Twilio.
   * Twilio Media Streams expect 8kHz mono mu-law audio.
   */
  async synthesizeForTwilio(text: string): Promise<Buffer> {
    // Check if text needs chunking
    const effectiveLimit =
      MAX_CHARS_PER_REQUEST -
      (this.vocalDirection ? this.vocalDirection.length + 1 : 0);

    let pcm24k: Buffer;
    if (text.length <= effectiveLimit) {
      pcm24k = await this.synthesize(text);
    } else {
      pcm24k = await this.synthesizeChunked(text);
    }

    // Convert to mu-law 8kHz using existing utility
    // Groq Orpheus outputs 24kHz audio
    return convertPcmToMulaw8k(pcm24k, 24000);
  }
}

/**
 * Parse WAV file and extract raw PCM data.
 * Assumes 16-bit signed little-endian mono PCM.
 */
function parseWavToPcm(wavBuffer: Buffer): Buffer {
  // Validate RIFF header
  if (wavBuffer.toString("ascii", 0, 4) !== "RIFF") {
    throw new Error("Invalid WAV file: missing RIFF header");
  }

  // Validate WAVE format
  if (wavBuffer.toString("ascii", 8, 12) !== "WAVE") {
    throw new Error("Invalid WAV file: missing WAVE format");
  }

  // Find data chunk
  let offset = 12;
  while (offset < wavBuffer.length - 8) {
    const chunkId = wavBuffer.toString("ascii", offset, offset + 4);
    const chunkSize = wavBuffer.readUInt32LE(offset + 4);

    if (chunkId === "data") {
      // Found data chunk - extract PCM
      const pcmStart = offset + 8;
      const pcmEnd = pcmStart + chunkSize;
      return wavBuffer.subarray(pcmStart, Math.min(pcmEnd, wavBuffer.length));
    }

    offset += 8 + chunkSize;
    // Align to word boundary
    if (chunkSize % 2 !== 0) offset++;
  }

  throw new Error("Invalid WAV file: data chunk not found");
}

/**
 * Split text into chunks for TTS processing.
 * Splits at sentence boundaries (. ! ?) first, then at commas/clauses.
 */
function splitTextForTTS(text: string, maxChars: number): string[] {
  if (!text || text.length === 0) return [];
  if (text.length <= maxChars) return [text];

  const chunks: string[] = [];
  let remaining = text;

  while (remaining.length > 0) {
    if (remaining.length <= maxChars) {
      chunks.push(remaining.trim());
      break;
    }

    // Try to find sentence boundary within limit
    let splitIndex = -1;
    const sentenceEnders = [". ", "! ", "? "];

    for (const ender of sentenceEnders) {
      const lastIndex = remaining.lastIndexOf(ender, maxChars);
      if (lastIndex > splitIndex) {
        splitIndex = lastIndex + ender.length - 1; // Include the punctuation
      }
    }

    // If no sentence boundary, try comma
    if (splitIndex === -1 || splitIndex < maxChars / 2) {
      const commaIndex = remaining.lastIndexOf(", ", maxChars);
      if (commaIndex > maxChars / 3) {
        splitIndex = commaIndex + 1; // Include the comma
      }
    }

    // If still no good boundary, force split at space
    if (splitIndex === -1 || splitIndex < maxChars / 3) {
      const spaceIndex = remaining.lastIndexOf(" ", maxChars);
      if (spaceIndex > 0) {
        splitIndex = spaceIndex;
      } else {
        // No space found, force split (shouldn't happen with normal text)
        splitIndex = maxChars;
      }
    }

    chunks.push(remaining.substring(0, splitIndex).trim());
    remaining = remaining.substring(splitIndex).trim();
  }

  return chunks.filter((c) => c.length > 0);
}

/**
 * Create a Groq TTS provider from voice-call config.
 */
export function createGroqTTSProvider(config: {
  apiKey?: string;
  voice?: string;
  vocalDirection?: string;
}): GroqTTSProvider {
  return new GroqTTSProvider({
    apiKey: config.apiKey,
    voice: (config.voice as GroqTTSVoice) || "troy",
    vocalDirection: config.vocalDirection || "[briskly low playful]",
  });
}
