import { afterEach, describe, expect, it, vi } from "vitest";
import { TTSProvider } from "./tts.js";

type MockResponse = {
  ok: boolean;
  status: number;
  arrayBuffer: () => Promise<ArrayBuffer>;
  text: () => Promise<string>;
};

const toArrayBuffer = (buffer: Buffer): ArrayBuffer => {
  return buffer.buffer.slice(
    buffer.byteOffset,
    buffer.byteOffset + buffer.byteLength,
  ) as ArrayBuffer;
};

describe("TTSProvider", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("ElevenLabs uses correct API URL and headers", async () => {
    const audio = Buffer.from("elevenlabs-audio");
    const fetchMock = vi.fn(async (url: string, init?: RequestInit): Promise<MockResponse> => {
      expect(url).toBe("https://api.elevenlabs.io/v1/text-to-speech/voice-123/stream");
      const headers = init?.headers as Record<string, string>;
      expect(headers["xi-api-key"]).toBe("eleven-key");
      expect(headers["Content-Type"]).toBe("application/json");
      return {
        ok: true,
        status: 200,
        arrayBuffer: async () => toArrayBuffer(audio),
        text: async () => "",
      };
    });
    vi.stubGlobal("fetch", fetchMock);

    const provider = new TTSProvider({
      provider: "elevenlabs",
      elevenlabsApiKey: "eleven-key",
      voiceId: "voice-123",
    });

    await provider.synthesize("hello");
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("ElevenLabs sends the expected request body", async () => {
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit): Promise<MockResponse> => {
      const body = JSON.parse(String(init?.body)) as {
        text: string;
        model_id: string;
        voice_settings: {
          stability: number;
          similarity_boost: number;
          speed: number;
        };
      };

      expect(body).toEqual({
        text: "body test",
        model_id: "eleven_turbo_v2_5",
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.75,
          speed: 1.0,
        },
      });

      return {
        ok: true,
        status: 200,
        arrayBuffer: async () => toArrayBuffer(Buffer.from("ok")),
        text: async () => "",
      };
    });
    vi.stubGlobal("fetch", fetchMock);

    const provider = new TTSProvider({
      provider: "elevenlabs",
      elevenlabsApiKey: "eleven-key",
      voiceId: "voice-123",
    });

    await provider.synthesize("body test");
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("ElevenLabs returns MP3 buffer on success", async () => {
    const mp3 = Buffer.from("mp3-bytes");
    const fetchMock = vi.fn(
      async (): Promise<MockResponse> => ({
        ok: true,
        status: 200,
        arrayBuffer: async () => toArrayBuffer(mp3),
        text: async () => "",
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const provider = new TTSProvider({
      provider: "elevenlabs",
      elevenlabsApiKey: "eleven-key",
      voiceId: "voice-123",
    });

    await expect(provider.synthesize("hello world")).resolves.toEqual({
      audio: mp3,
      format: "mp3",
    });
  });

  it("ElevenLabs handles API error responses", async () => {
    const fetchMock = vi.fn(
      async (): Promise<MockResponse> => ({
        ok: false,
        status: 401,
        arrayBuffer: async () => toArrayBuffer(Buffer.alloc(0)),
        text: async () => JSON.stringify({ error: { message: "Invalid API key" } }),
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const provider = new TTSProvider({
      provider: "elevenlabs",
      elevenlabsApiKey: "bad-key",
      voiceId: "voice-123",
    });

    await expect(provider.synthesize("hello")).rejects.toThrow(
      "ElevenLabs TTS request failed with status 401: Invalid API key",
    );
  });

  it("OpenAI uses correct API URL and headers", async () => {
    const fetchMock = vi.fn(async (url: string, init?: RequestInit): Promise<MockResponse> => {
      expect(url).toBe("https://api.openai.com/v1/audio/speech");
      const headers = init?.headers as Record<string, string>;
      expect(headers.Authorization).toBe("Bearer openai-key");
      expect(headers["Content-Type"]).toBe("application/json");
      return {
        ok: true,
        status: 200,
        arrayBuffer: async () => toArrayBuffer(Buffer.from("ok")),
        text: async () => "",
      };
    });
    vi.stubGlobal("fetch", fetchMock);

    const provider = new TTSProvider({
      provider: "openai",
      openaiApiKey: "openai-key",
    });

    await provider.synthesize("hello");
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("OpenAI returns MP3 buffer on success", async () => {
    const mp3 = Buffer.from("openai-audio");
    const fetchMock = vi.fn(
      async (): Promise<MockResponse> => ({
        ok: true,
        status: 200,
        arrayBuffer: async () => toArrayBuffer(mp3),
        text: async () => "",
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const provider = new TTSProvider({
      provider: "openai",
      openaiApiKey: "openai-key",
      openaiModel: "gpt-4o-mini-tts",
      openaiVoice: "nova",
    });

    await expect(provider.synthesize("testing")).resolves.toEqual({
      audio: mp3,
      format: "mp3",
    });
  });

  it("selects provider based on config", async () => {
    const fetchMock = vi.fn(
      async (url: string): Promise<MockResponse> => ({
        ok: true,
        status: 200,
        arrayBuffer: async () => toArrayBuffer(Buffer.from(url)),
        text: async () => "",
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const eleven = new TTSProvider({
      provider: "elevenlabs",
      elevenlabsApiKey: "eleven-key",
      voiceId: "voice-abc",
    });
    const openai = new TTSProvider({
      provider: "openai",
      openaiApiKey: "openai-key",
    });

    await eleven.synthesize("provider check");
    await openai.synthesize("provider check");

    expect(String(fetchMock.mock.calls[0][0])).toContain("api.elevenlabs.io");
    expect(String(fetchMock.mock.calls[1][0])).toContain("api.openai.com");
  });
});
