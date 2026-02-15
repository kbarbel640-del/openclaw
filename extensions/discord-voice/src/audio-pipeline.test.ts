import { EventEmitter } from "node:events";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { LoggerLike } from "./types.js";
import { AudioPipeline, VADProcessor } from "./audio-pipeline.js";

const voiceMock = vi.hoisted(() => ({
  EndBehaviorType: { Manual: "manual" },
}));

const opusMock = vi.hoisted(() => {
  const instances: Array<{ decode: ReturnType<typeof vi.fn>; delete: ReturnType<typeof vi.fn> }> =
    [];

  class MockOpusScript {
    static Application = { VOIP: 2048 };
    decode = vi.fn((packet: Buffer) => packet);
    delete = vi.fn();

    constructor() {
      instances.push(this);
    }
  }

  return { MockOpusScript, instances };
});

vi.mock("@discordjs/voice", () => ({
  EndBehaviorType: voiceMock.EndBehaviorType,
}));

vi.mock("opusscript", () => ({
  default: opusMock.MockOpusScript,
}));

class MockReceiveStream extends EventEmitter {
  destroy = vi.fn();
}

class MockVoiceReceiver {
  streams = new Map<string, MockReceiveStream>();
  subscribe = vi.fn((userId: string) => {
    const stream = new MockReceiveStream();
    this.streams.set(userId, stream);
    return stream;
  });

  stream(userId: string): MockReceiveStream {
    const stream = this.streams.get(userId);
    if (!stream) {
      throw new Error(`missing stream for ${userId}`);
    }
    return stream;
  }
}

const createLogger = (): LoggerLike => ({
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
});

function createStereoPcm48k({
  frameCount = 960,
  left = 0,
  right = 0,
}: {
  frameCount?: number;
  left?: number;
  right?: number;
}): Buffer {
  const out = Buffer.alloc(frameCount * 4);
  for (let i = 0; i < frameCount; i += 1) {
    const offset = i * 4;
    out.writeInt16LE(left, offset);
    out.writeInt16LE(right, offset + 2);
  }
  return out;
}

function emitAt(stream: MockReceiveStream, timestampMs: number, packet: Buffer): void {
  vi.setSystemTime(new Date(timestampMs));
  stream.emit("data", packet);
}

describe("VADProcessor", () => {
  it("calculateEnergy returns 0 for silence buffer", () => {
    const energy = VADProcessor.calculateEnergy(Buffer.alloc(320));
    expect(energy).toBe(0);
  });

  it("calculateEnergy returns expected RMS for known PCM values", () => {
    const pcm = Buffer.alloc(4);
    pcm.writeInt16LE(16_384, 0);
    pcm.writeInt16LE(-16_384, 2);

    const energy = VADProcessor.calculateEnergy(pcm);
    expect(energy).toBeCloseTo(0.5, 5);
  });

  it("transitions silence -> maybe_speech -> speech", () => {
    const vad = new VADProcessor({
      silenceThresholdMs: 500,
      minSpeechMs: 100,
      energyThreshold: 0.01,
    });
    const speech = createStereoPcm48k({ frameCount: 320, left: 10_000, right: 10_000 });

    expect(vad.processChunk(speech, 0)).toBe("silence");
    expect(vad.processChunk(speech, 50)).toBe("silence");
    expect(vad.processChunk(speech, 120)).toBe("speech");
  });

  it("transitions speech -> maybe_silence -> speech_end", () => {
    const vad = new VADProcessor({
      silenceThresholdMs: 200,
      minSpeechMs: 50,
      energyThreshold: 0.01,
    });
    const speech = createStereoPcm48k({ frameCount: 320, left: 10_000, right: 10_000 });
    const silence = createStereoPcm48k({ frameCount: 320, left: 0, right: 0 });

    expect(vad.processChunk(speech, 0)).toBe("silence");
    expect(vad.processChunk(speech, 60)).toBe("speech");
    expect(vad.processChunk(silence, 100)).toBe("speech");
    expect(vad.processChunk(silence, 320)).toBe("speech_end");
  });

  it("handles false starts (silence -> maybe_speech -> silence)", () => {
    const vad = new VADProcessor({
      silenceThresholdMs: 300,
      minSpeechMs: 100,
      energyThreshold: 0.01,
    });
    const speech = createStereoPcm48k({ frameCount: 320, left: 12_000, right: 12_000 });
    const silence = createStereoPcm48k({ frameCount: 320, left: 0, right: 0 });

    expect(vad.processChunk(speech, 0)).toBe("silence");
    expect(vad.processChunk(silence, 40)).toBe("silence");
    expect(vad.processChunk(speech, 80)).toBe("silence");
  });
});

describe("AudioPipeline", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(0));
    opusMock.instances.length = 0;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("pre-speech buffer captures the start of an utterance", () => {
    const logger = createLogger();
    const receiver = new MockVoiceReceiver();
    const pipeline = new AudioPipeline(
      {
        silenceThresholdMs: 40,
        minSpeechMs: 30,
        energyThreshold: 0.01,
      },
      logger,
    );

    const utterances: Array<{ audio: Buffer; userId: string }> = [];
    pipeline.on("utterance", (event) => utterances.push(event));

    pipeline.subscribeUser("u1", receiver as never);
    const stream = receiver.stream("u1");
    const silence = createStereoPcm48k({ left: 0, right: 0 });
    const speech = createStereoPcm48k({ left: 12_000, right: 12_000 });

    emitAt(stream, 0, silence);
    emitAt(stream, 20, speech);
    emitAt(stream, 50, speech);
    emitAt(stream, 70, speech);
    emitAt(stream, 90, silence);
    emitAt(stream, 140, silence);

    expect(utterances).toHaveLength(1);
    expect(utterances[0]?.userId).toBe("u1");
    expect(utterances[0]?.audio.length).toBe(640 * 5);
    expect(utterances[0]?.audio.subarray(0, 640).equals(Buffer.alloc(640))).toBe(true);
  });

  it("max utterance length triggers segmentation", () => {
    const logger = createLogger();
    const receiver = new MockVoiceReceiver();
    const pipeline = new AudioPipeline(
      {
        silenceThresholdMs: 40,
        minSpeechMs: 0,
        energyThreshold: 0.01,
      },
      logger,
    );

    const utterances: Array<{ durationMs: number; userId: string }> = [];
    pipeline.on("utterance", (event) => utterances.push(event));

    pipeline.subscribeUser("u1", receiver as never);
    const stream = receiver.stream("u1");
    const speechPrimer = createStereoPcm48k({ left: 12_000, right: 12_000, frameCount: 960 });
    const longSpeech = createStereoPcm48k({
      left: 12_000,
      right: 12_000,
      frameCount: 2_900_000,
    });
    const silence = createStereoPcm48k({ left: 0, right: 0, frameCount: 960 });

    emitAt(stream, 0, speechPrimer);
    emitAt(stream, 20, longSpeech);
    emitAt(stream, 50, silence);
    emitAt(stream, 100, silence);

    expect(utterances.length).toBeGreaterThanOrEqual(2);
    expect(utterances[0]?.durationMs).toBe(60_000);
    expect(utterances.every((u) => u.userId === "u1")).toBe(true);
  });

  it("maintains isolated VAD state per user", () => {
    const logger = createLogger();
    const receiver = new MockVoiceReceiver();
    const pipeline = new AudioPipeline(
      {
        silenceThresholdMs: 40,
        minSpeechMs: 30,
        energyThreshold: 0.01,
      },
      logger,
    );

    const utterances: Array<{ userId: string }> = [];
    pipeline.on("utterance", (event) => utterances.push(event));

    pipeline.subscribeUser("u1", receiver as never);
    pipeline.subscribeUser("u2", receiver as never);

    const speech = createStereoPcm48k({ left: 12_000, right: 12_000 });
    const silence = createStereoPcm48k({ left: 0, right: 0 });

    emitAt(receiver.stream("u1"), 0, speech);
    emitAt(receiver.stream("u2"), 5, speech);
    emitAt(receiver.stream("u1"), 40, speech);
    emitAt(receiver.stream("u2"), 45, speech);
    emitAt(receiver.stream("u1"), 70, silence);
    emitAt(receiver.stream("u2"), 75, silence);
    emitAt(receiver.stream("u1"), 120, silence);
    emitAt(receiver.stream("u2"), 125, silence);

    expect(utterances).toHaveLength(2);
    expect(new Set(utterances.map((u) => u.userId))).toEqual(new Set(["u1", "u2"]));
  });

  it("unsubscribeUser cleans up state and detaches stream listeners", () => {
    const logger = createLogger();
    const receiver = new MockVoiceReceiver();
    const pipeline = new AudioPipeline(
      {
        silenceThresholdMs: 40,
        minSpeechMs: 0,
        energyThreshold: 0.01,
      },
      logger,
    );

    const utteranceSpy = vi.fn();
    pipeline.on("utterance", utteranceSpy);

    pipeline.subscribeUser("u1", receiver as never);
    const stream = receiver.stream("u1");
    pipeline.unsubscribeUser("u1");

    stream.emit("data", createStereoPcm48k({ left: 12_000, right: 12_000 }));

    expect((pipeline as unknown as { userStates: Map<string, unknown> }).userStates.size).toBe(0);
    expect(stream.destroy).toHaveBeenCalledTimes(1);
    expect(utteranceSpy).not.toHaveBeenCalled();
  });

  it("destroy unsubscribes all users and releases decoder", () => {
    const logger = createLogger();
    const receiver = new MockVoiceReceiver();
    const pipeline = new AudioPipeline(
      {
        silenceThresholdMs: 40,
        minSpeechMs: 0,
        energyThreshold: 0.01,
      },
      logger,
    );

    pipeline.subscribeUser("u1", receiver as never);
    pipeline.subscribeUser("u2", receiver as never);
    const stream1 = receiver.stream("u1");
    const stream2 = receiver.stream("u2");
    const decoderInstance = opusMock.instances[0];

    pipeline.destroy();

    expect((pipeline as unknown as { userStates: Map<string, unknown> }).userStates.size).toBe(0);
    expect(stream1.destroy).toHaveBeenCalledTimes(1);
    expect(stream2.destroy).toHaveBeenCalledTimes(1);
    expect(decoderInstance?.delete).toHaveBeenCalledTimes(1);
  });
});
