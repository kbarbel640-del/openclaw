import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { WhisperSTT } from "./stt";

type MockResponse = {
  ok: boolean;
  status: number;
  json: () => Promise<unknown>;
  text: () => Promise<string>;
};

describe("WhisperSTT", () => {
  beforeEach(() => {
    vi.useRealTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("createWavBuffer produces valid WAV header", () => {
    const pcm = Buffer.alloc(3200, 1);
    const wav = WhisperSTT.createWavBuffer(pcm);

    expect(wav.length).toBe(44 + pcm.length);
    expect(wav.toString("ascii", 0, 4)).toBe("RIFF");
    expect(wav.toString("ascii", 8, 12)).toBe("WAVE");
    expect(wav.toString("ascii", 12, 16)).toBe("fmt ");
    expect(wav.readUInt16LE(20)).toBe(1);
    expect(wav.readUInt16LE(22)).toBe(1);
    expect(wav.readUInt32LE(24)).toBe(16000);
    expect(wav.readUInt16LE(34)).toBe(16);
    expect(wav.toString("ascii", 36, 40)).toBe("data");
    expect(wav.readUInt32LE(40)).toBe(pcm.length);
  });

  it("transcribe returns empty text for empty audio", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const stt = new WhisperSTT({ apiKey: "test-key" });
    await expect(stt.transcribe(Buffer.alloc(0))).resolves.toEqual({ text: "" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("transcribe returns empty text for very short audio", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const stt = new WhisperSTT({ apiKey: "test-key" });
    await expect(stt.transcribe(Buffer.alloc(499, 1))).resolves.toEqual({ text: "" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("transcribe builds correct multipart request", async () => {
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit): Promise<MockResponse> => {
      expect(init?.method).toBe("POST");

      const headers = init?.headers as Record<string, string>;
      expect(headers.Authorization).toBe("Bearer test-key");
      expect(headers["Content-Type"]).toContain("multipart/form-data; boundary=");
      expect(headers["Content-Length"]).toBeDefined();

      const body = init?.body as Buffer;
      const text = body.toString("utf8");
      expect(text).toContain('name="model"');
      expect(text).toContain("whisper-1");
      expect(text).toContain('name="language"');
      expect(text).toContain("en");
      expect(text).toContain('name="response_format"');
      expect(text).toContain("json");
      expect(text).toContain('name="file"; filename="audio.wav"');
      expect(text).toContain("Content-Type: audio/wav");
      expect(body.includes(Buffer.from("RIFF"))).toBe(true);
      expect(body.includes(Buffer.from("WAVE"))).toBe(true);

      return {
        ok: true,
        status: 200,
        json: async () => ({ text: "hello world", language: "en", duration: 1.23 }),
        text: async () => "",
      };
    });

    vi.stubGlobal("fetch", fetchMock);

    const stt = new WhisperSTT({ apiKey: "test-key" });
    const result = await stt.transcribe(Buffer.alloc(3200, 1));

    expect(result).toEqual({ text: "hello world", language: "en", duration: 1.23 });
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.openai.com/v1/audio/transcriptions",
      expect.any(Object),
    );
  });

  it("transcribe handles API error response", async () => {
    const fetchMock = vi.fn(
      async (): Promise<MockResponse> => ({
        ok: false,
        status: 401,
        json: async () => ({}),
        text: async () => JSON.stringify({ error: { message: "Invalid API key" } }),
      }),
    );

    vi.stubGlobal("fetch", fetchMock);

    const stt = new WhisperSTT({ apiKey: "bad-key" });
    await expect(stt.transcribe(Buffer.alloc(3200, 1))).rejects.toThrow(
      "Whisper transcription failed: Invalid API key",
    );
  });

  it("transcribe handles network timeout", async () => {
    vi.useFakeTimers();

    const fetchMock = vi.fn((_: string, init?: RequestInit) => {
      const signal = init?.signal as AbortSignal;
      return new Promise((_resolve, reject) => {
        signal.addEventListener("abort", () => {
          const err = new Error("The operation was aborted");
          (err as Error & { name?: string }).name = "AbortError";
          reject(err);
        });
      });
    });

    vi.stubGlobal("fetch", fetchMock);

    const stt = new WhisperSTT({ apiKey: "test-key", timeoutMs: 10 });
    const pending = stt.transcribe(Buffer.alloc(3200, 1));
    const assertion = expect(pending).rejects.toThrow("OpenAI STT request timed out after 10ms");

    await vi.advanceTimersByTimeAsync(20);
    await assertion;
  });

  it("transcribe parses successful response correctly", async () => {
    const fetchMock = vi.fn(
      async (): Promise<MockResponse> => ({
        ok: true,
        status: 200,
        json: async () => ({ text: "transcribed text", language: "en", duration: 2.5 }),
        text: async () => "",
      }),
    );

    vi.stubGlobal("fetch", fetchMock);

    const stt = new WhisperSTT({ apiKey: "test-key", model: "whisper-1", language: "en" });
    await expect(stt.transcribe(Buffer.alloc(4000, 2))).resolves.toEqual({
      text: "transcribed text",
      language: "en",
      duration: 2.5,
    });
  });
});
