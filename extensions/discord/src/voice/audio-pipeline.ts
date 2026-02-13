import { createAudioResource, StreamType, type AudioResource } from "@discordjs/voice";
import { EventEmitter } from "node:events";
import {} from "node:stream";
import { opus } from "prism-media";
import type { AudioConfig } from "./types.js";

const DEFAULT_AUDIO_CONFIG: AudioConfig = {
  sampleRate: 48000,
  channels: 2,
  bitrate: 64,
};

const OPUS_FRAME_SIZE = 960;
const OPUS_SAMPLE_RATE = 48000;
const OPUS_CHANNELS = 2;

/** Creates a prism-media Opus decoder Transform stream. */
function createOpusDecoder(): opus.Decoder {
  return new opus.Decoder({
    channels: OPUS_CHANNELS,
    frameSize: OPUS_FRAME_SIZE,
    rate: OPUS_SAMPLE_RATE,
  });
}

/** Creates a prism-media Opus encoder Transform stream. */
function createOpusEncoder(): opus.Encoder {
  return new opus.Encoder({
    channels: OPUS_CHANNELS,
    frameSize: OPUS_FRAME_SIZE,
    rate: OPUS_SAMPLE_RATE,
  });
}

export interface AudioBuffer {
  data: Buffer;
  timestamp: number;
  userId?: string;
}

/** Bytes per second for 48kHz stereo 16-bit PCM. */
const PCM_BYTES_PER_SECOND = 48000 * 2 * 2;

export class IncomingAudioHandler extends EventEmitter {
  private buffers: Map<string, Buffer[]> = new Map();
  private bufferBytes: Map<string, number> = new Map();
  private config: AudioConfig;
  private silenceThreshold: number = 0.01;
  private silenceTimeoutMs: number = 2000;
  /** Max accumulated audio per user before auto-flush (default 10s). */
  private maxBufferDurationMs: number = 10_000;
  private silenceTimers: Map<string, NodeJS.Timeout> = new Map();

  constructor(config: Partial<AudioConfig> = {}, opts?: { maxBufferDurationMs?: number }) {
    super();
    this.config = { ...DEFAULT_AUDIO_CONFIG, ...config };
    if (opts?.maxBufferDurationMs) {
      this.maxBufferDurationMs = opts.maxBufferDurationMs;
    }
  }

  private _decoders?: Map<string, opus.Decoder>;

  handleAudioChunk(userId: string, opusChunk: Buffer): void {
    // Get or create a persistent decoder for this user (reuse across packets)
    if (!this._decoders) this._decoders = new Map();
    let decoder = this._decoders.get(userId);
    if (!decoder) {
      decoder = createOpusDecoder();
      this._decoders.set(userId, decoder);
      decoder.on("data", (pcm: Buffer) => {
        this.processDecodedAudio(userId, pcm);
      });
      decoder.on("error", (err: Error) => {
        console.error(`[audio-pipeline] opus decode error for ${userId}:`, err.message);
      });
    }
    decoder.write(opusChunk);
  }

  private processDecodedAudio(userId: string, pcmData: Buffer): void {
    if (!this.buffers.has(userId)) {
      this.buffers.set(userId, []);
      this.bufferBytes.set(userId, 0);
    }

    const userBuffers = this.buffers.get(userId)!;
    userBuffers.push(pcmData);
    const totalBytes = (this.bufferBytes.get(userId) ?? 0) + pcmData.length;
    this.bufferBytes.set(userId, totalBytes);

    this.resetSilenceTimer(userId);

    // Auto-flush when accumulated audio exceeds maxBufferDurationMs
    const maxBytes = (this.maxBufferDurationMs / 1000) * PCM_BYTES_PER_SECOND;
    if (totalBytes >= maxBytes) {
      console.log(
        `[audio-pipeline] periodic flush for user ${userId}: ${(totalBytes / PCM_BYTES_PER_SECOND).toFixed(1)}s accumulated`,
      );
      this.flushUserAudio(userId);
      return;
    }

    if (this.isSilent(pcmData)) {
      this.emit("silence", { userId, partial: true });
    } else {
      this.emit("audio", { userId, data: pcmData });
    }
  }

  private resetSilenceTimer(userId: string): void {
    const existing = this.silenceTimers.get(userId);
    if (existing) {
      clearTimeout(existing);
    }

    const timer = setTimeout(() => {
      this.flushUserAudio(userId);
    }, this.silenceTimeoutMs);

    this.silenceTimers.set(userId, timer);
  }

  private isSilent(pcmData: Buffer): boolean {
    if (pcmData.length < 2) return true;

    let sum = 0;
    for (let i = 0; i < pcmData.length; i += 2) {
      const sample = pcmData.readInt16LE(i);
      sum += Math.abs(sample);
    }
    const avg = sum / (pcmData.length / 2);
    const normalizedAvg = avg / 32768;

    return normalizedAvg < this.silenceThreshold;
  }

  flushUserAudio(userId: string): Buffer | null {
    const userBuffers = this.buffers.get(userId);
    if (!userBuffers || userBuffers.length === 0) {
      return null;
    }

    const combined = Buffer.concat(userBuffers);
    userBuffers.length = 0;
    this.bufferBytes.set(userId, 0);

    this.emit("audioComplete", { userId, data: combined });
    this.emit("silence", { userId, durationMs: this.silenceTimeoutMs });

    return combined;
  }

  clearUser(userId: string): void {
    this.buffers.delete(userId);
    this.bufferBytes.delete(userId);
    const timer = this.silenceTimers.get(userId);
    if (timer) {
      clearTimeout(timer);
      this.silenceTimers.delete(userId);
    }
    const decoder = this._decoders?.get(userId);
    if (decoder) {
      decoder.destroy();
      this._decoders!.delete(userId);
    }
  }

  destroy(): void {
    for (const timer of this.silenceTimers.values()) {
      clearTimeout(timer);
    }
    this.silenceTimers.clear();
    this.buffers.clear();
    this.bufferBytes.clear();
    if (this._decoders) {
      for (const d of this._decoders.values()) d.destroy();
      this._decoders.clear();
    }
    this.removeAllListeners();
  }
}

export class OutgoingAudioHandler {
  private encoder: opus.Encoder | null = null;
  private config: AudioConfig;

  constructor(config: Partial<AudioConfig> = {}) {
    this.config = { ...DEFAULT_AUDIO_CONFIG, ...config };
  }

  createAudioResourceFromPcm(pcmStream: NodeJS.ReadableStream): AudioResource {
    const encoder = createOpusEncoder();
    const opusStream = pcmStream.pipe(encoder);

    return createAudioResource(opusStream, {
      inputType: StreamType.Opus,
    });
  }

  async encodePcmToOpus(pcmData: Buffer): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const encoder = createOpusEncoder();
      const chunks: Buffer[] = [];

      encoder.on("data", (chunk: Buffer) => {
        chunks.push(chunk);
      });

      encoder.on("end", () => {
        resolve(Buffer.concat(chunks));
      });

      encoder.on("error", reject);

      encoder.write(pcmData);
      encoder.end();
    });
  }

  destroy(): void {
    if (this.encoder) {
      this.encoder.destroy();
      this.encoder = null;
    }
  }
}

export class AudioPipeline {
  private incoming: IncomingAudioHandler;
  private outgoing: OutgoingAudioHandler;

  constructor(config: Partial<AudioConfig> = {}) {
    this.incoming = new IncomingAudioHandler(config);
    this.outgoing = new OutgoingAudioHandler(config);
  }

  getIncoming(): IncomingAudioHandler {
    return this.incoming;
  }

  getOutgoing(): OutgoingAudioHandler {
    return this.outgoing;
  }

  destroy(): void {
    this.incoming.destroy();
    this.outgoing.destroy();
  }
}
