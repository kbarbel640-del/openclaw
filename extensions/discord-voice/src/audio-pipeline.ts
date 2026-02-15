import type { VoiceReceiver } from "@discordjs/voice";
import { EndBehaviorType } from "@discordjs/voice";
import { EventEmitter } from "node:events";
import OpusScript from "opusscript";
import type { LoggerLike } from "./types.js";

export interface VADConfig {
  silenceThresholdMs: number;
  minSpeechMs: number;
  energyThreshold: number;
}

export interface UtteranceEvent {
  userId: string;
  audio: Buffer;
  durationMs: number;
}

enum VADState {
  Silence = "silence",
  MaybeSpeech = "maybe_speech",
  Speech = "speech",
  MaybeSilence = "maybe_silence",
}

export class VADProcessor {
  private state: VADState = VADState.Silence;
  private config: VADConfig;
  private speechStartTime = 0;
  private silenceStartTime = 0;

  constructor(config: VADConfig) {
    this.config = {
      silenceThresholdMs: config.silenceThresholdMs ?? 1500,
      minSpeechMs: config.minSpeechMs ?? 250,
      energyThreshold: config.energyThreshold ?? 0.01,
    };
  }

  processChunk(pcm: Buffer, timestampMs: number): "silence" | "speech" | "speech_end" {
    const isSpeech = VADProcessor.calculateEnergy(pcm) > this.config.energyThreshold;

    switch (this.state) {
      case VADState.Silence: {
        if (isSpeech) {
          this.state = VADState.MaybeSpeech;
          this.speechStartTime = timestampMs;
        }
        return "silence";
      }

      case VADState.MaybeSpeech: {
        if (!isSpeech) {
          this.state = VADState.Silence;
          this.speechStartTime = 0;
          return "silence";
        }

        if (timestampMs - this.speechStartTime >= this.config.minSpeechMs) {
          this.state = VADState.Speech;
          return "speech";
        }

        return "silence";
      }

      case VADState.Speech: {
        if (!isSpeech) {
          this.state = VADState.MaybeSilence;
          this.silenceStartTime = timestampMs;
        }
        return "speech";
      }

      case VADState.MaybeSilence: {
        if (isSpeech) {
          this.state = VADState.Speech;
          this.silenceStartTime = 0;
          return "speech";
        }

        if (timestampMs - this.silenceStartTime >= this.config.silenceThresholdMs) {
          this.state = VADState.Silence;
          this.speechStartTime = 0;
          this.silenceStartTime = 0;
          return "speech_end";
        }

        return "speech";
      }
    }
  }

  reset(): void {
    this.state = VADState.Silence;
    this.speechStartTime = 0;
    this.silenceStartTime = 0;
  }

  static calculateEnergy(pcm: Buffer): number {
    const sampleCount = Math.floor(pcm.length / 2);
    if (sampleCount === 0) {
      return 0;
    }

    let sumSquares = 0;
    for (let i = 0; i < sampleCount; i += 1) {
      const sample = pcm.readInt16LE(i * 2) / 32768;
      sumSquares += sample * sample;
    }

    return Math.sqrt(sumSquares / sampleCount);
  }
}

type ReceiveStreamLike = EventEmitter & {
  destroy?: () => void;
};

interface UserState {
  vad: VADProcessor;
  buffer: Buffer[];
  bufferBytes: number;
  preSpeechBuffer: Buffer[];
  preSpeechBytes: number;
  isSpeaking: boolean;
  stream: ReceiveStreamLike;
  onData: (packet: Buffer) => void;
  onError: (error: unknown) => void;
  onEnd: () => void;
}

const INPUT_SAMPLE_RATE = 48_000;
const INPUT_CHANNELS = 2;
const OUTPUT_SAMPLE_RATE = 16_000;
const OUTPUT_CHANNELS = 1;
const BYTES_PER_SAMPLE = 2;
const OUTPUT_BYTES_PER_MS = (OUTPUT_SAMPLE_RATE * OUTPUT_CHANNELS * BYTES_PER_SAMPLE) / 1000;
const PRE_SPEECH_BYTES = Math.floor(300 * OUTPUT_BYTES_PER_MS);
const MAX_UTTERANCE_BYTES = Math.floor(60_000 * OUTPUT_BYTES_PER_MS);

export class AudioPipeline extends EventEmitter {
  private opusDecoder: OpusScript;
  private userStates = new Map<string, UserState>();
  private config: VADConfig;
  private logger: LoggerLike;

  constructor(config: VADConfig, logger: LoggerLike) {
    super();

    this.config = {
      silenceThresholdMs: config.silenceThresholdMs ?? 1500,
      minSpeechMs: config.minSpeechMs ?? 250,
      energyThreshold: config.energyThreshold ?? 0.01,
    };
    this.logger = logger;
    this.opusDecoder = new OpusScript(
      INPUT_SAMPLE_RATE,
      INPUT_CHANNELS,
      OpusScript.Application.VOIP,
    );
  }

  subscribeUser(userId: string, receiver: VoiceReceiver): void {
    this.unsubscribeUser(userId);

    const stream = receiver.subscribe(userId, {
      end: { behavior: EndBehaviorType.Manual },
    }) as unknown as ReceiveStreamLike;

    const state: UserState = {
      vad: new VADProcessor(this.config),
      buffer: [],
      bufferBytes: 0,
      preSpeechBuffer: [],
      preSpeechBytes: 0,
      isSpeaking: false,
      stream,
      onData: () => undefined,
      onError: () => undefined,
      onEnd: () => undefined,
    };

    state.onData = (packet: Buffer) => {
      try {
        const decoded = this.opusDecoder.decode(packet);
        const pcm16k = AudioPipeline.downsample48kStereoTo16kMono(decoded);
        if (pcm16k.length === 0) {
          return;
        }

        this.processUserChunk(userId, state, pcm16k, Date.now());
      } catch (error) {
        const reason = error instanceof Error ? error.message : String(error);
        this.logger.warn?.(`Failed to process audio packet for user ${userId}: ${reason}`);
      }
    };

    state.onError = (error: unknown) => {
      const reason = error instanceof Error ? error.message : String(error);
      this.logger.warn?.(`Audio receive stream error for user ${userId}: ${reason}`);
    };

    state.onEnd = () => {
      if (state.isSpeaking) {
        this.emitUtterance(userId, state);
        state.isSpeaking = false;
        this.emit("speechEnd", { userId });
      }
    };

    stream.on("data", state.onData);
    stream.on("error", state.onError);
    stream.on("end", state.onEnd);
    stream.on("close", state.onEnd);

    this.userStates.set(userId, state);
    this.logger.debug?.(`Subscribed to audio for user ${userId}`);
  }

  unsubscribeUser(userId: string): void {
    const state = this.userStates.get(userId);
    if (!state) {
      return;
    }

    if (state.isSpeaking) {
      this.emitUtterance(userId, state);
      this.emit("speechEnd", { userId });
    }

    state.stream.off("data", state.onData);
    state.stream.off("error", state.onError);
    state.stream.off("end", state.onEnd);
    state.stream.off("close", state.onEnd);
    state.stream.destroy?.();
    state.vad.reset();

    this.userStates.delete(userId);
    this.logger.debug?.(`Unsubscribed audio for user ${userId}`);
  }

  destroy(): void {
    for (const userId of this.userStates.keys()) {
      this.unsubscribeUser(userId);
    }

    this.opusDecoder.delete();
    this.removeAllListeners();
  }

  private processUserChunk(
    userId: string,
    state: UserState,
    pcm16k: Buffer,
    timestampMs: number,
  ): void {
    const vadResult = state.vad.processChunk(pcm16k, timestampMs);

    if (state.isSpeaking) {
      if (vadResult === "speech") {
        this.appendSpeechChunk(state, pcm16k);
        this.segmentIfNeeded(userId, state);
        return;
      }

      if (vadResult === "speech_end") {
        this.emitUtterance(userId, state);
        state.isSpeaking = false;
        this.emit("speechEnd", { userId });
        this.pushPreSpeechChunk(state, pcm16k);
        return;
      }

      this.emitUtterance(userId, state);
      state.isSpeaking = false;
      this.emit("speechEnd", { userId });
      this.pushPreSpeechChunk(state, pcm16k);
      return;
    }

    if (vadResult === "speech") {
      state.isSpeaking = true;
      this.emit("speechStart", { userId });

      if (state.preSpeechBuffer.length > 0) {
        state.buffer.push(...state.preSpeechBuffer);
        state.bufferBytes += state.preSpeechBytes;
        state.preSpeechBuffer = [];
        state.preSpeechBytes = 0;
      }

      this.appendSpeechChunk(state, pcm16k);
      this.segmentIfNeeded(userId, state);
      return;
    }

    this.pushPreSpeechChunk(state, pcm16k);
  }

  private appendSpeechChunk(state: UserState, chunk: Buffer): void {
    state.buffer.push(chunk);
    state.bufferBytes += chunk.length;
  }

  private pushPreSpeechChunk(state: UserState, chunk: Buffer): void {
    if (chunk.length >= PRE_SPEECH_BYTES) {
      state.preSpeechBuffer = [chunk.subarray(chunk.length - PRE_SPEECH_BYTES)];
      state.preSpeechBytes = PRE_SPEECH_BYTES;
      return;
    }

    state.preSpeechBuffer.push(chunk);
    state.preSpeechBytes += chunk.length;

    while (state.preSpeechBytes > PRE_SPEECH_BYTES && state.preSpeechBuffer.length > 0) {
      const overflow = state.preSpeechBytes - PRE_SPEECH_BYTES;
      const first = state.preSpeechBuffer[0];
      if (first.length <= overflow) {
        state.preSpeechBuffer.shift();
        state.preSpeechBytes -= first.length;
        continue;
      }

      state.preSpeechBuffer[0] = first.subarray(overflow);
      state.preSpeechBytes -= overflow;
    }
  }

  private segmentIfNeeded(userId: string, state: UserState): void {
    if (state.bufferBytes < MAX_UTTERANCE_BYTES) {
      return;
    }

    let combined = Buffer.concat(state.buffer, state.bufferBytes);
    while (combined.length >= MAX_UTTERANCE_BYTES) {
      const segment = combined.subarray(0, MAX_UTTERANCE_BYTES);
      this.emit("utterance", {
        userId,
        audio: Buffer.from(segment),
        durationMs: AudioPipeline.durationMs(segment.length),
      } satisfies UtteranceEvent);
      combined = combined.subarray(MAX_UTTERANCE_BYTES);
    }

    state.buffer = combined.length > 0 ? [Buffer.from(combined)] : [];
    state.bufferBytes = combined.length;
  }

  private emitUtterance(userId: string, state: UserState): void {
    if (state.bufferBytes === 0) {
      return;
    }

    const audio = Buffer.concat(state.buffer, state.bufferBytes);
    this.emit("utterance", {
      userId,
      audio,
      durationMs: AudioPipeline.durationMs(audio.length),
    } satisfies UtteranceEvent);

    state.buffer = [];
    state.bufferBytes = 0;
  }

  private static durationMs(byteLength: number): number {
    return Math.round(byteLength / OUTPUT_BYTES_PER_MS);
  }

  private static downsample48kStereoTo16kMono(pcm48kStereo: Buffer): Buffer {
    const stereoFrames = Math.floor(pcm48kStereo.length / (INPUT_CHANNELS * BYTES_PER_SAMPLE));
    if (stereoFrames <= 0) {
      return Buffer.alloc(0);
    }

    // 48 kHz -> 16 kHz means 3:1 decimation. With interleaved stereo this is every 6 samples.
    const outputSamples = Math.floor(stereoFrames / 3);
    if (outputSamples <= 0) {
      return Buffer.alloc(0);
    }

    const output = Buffer.allocUnsafe(outputSamples * BYTES_PER_SAMPLE);
    for (let i = 0; i < outputSamples; i += 1) {
      const sourceFrame = i * 3;
      const sourceOffset = sourceFrame * INPUT_CHANNELS * BYTES_PER_SAMPLE;
      const left = pcm48kStereo.readInt16LE(sourceOffset);
      const right = pcm48kStereo.readInt16LE(sourceOffset + BYTES_PER_SAMPLE);
      const mono = Math.max(-32768, Math.min(32767, Math.round((left + right) / 2)));
      output.writeInt16LE(mono, i * BYTES_PER_SAMPLE);
    }

    return output;
  }
}
