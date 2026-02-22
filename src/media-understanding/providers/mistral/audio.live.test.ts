import { describe, expect, it } from "vitest";
import { isTruthyEnvValue } from "../../../infra/env.js";
import { mistralProvider } from "./index.js";

const MISTRAL_KEY = process.env.MISTRAL_API_KEY ?? "";
const MISTRAL_MODEL = process.env.MISTRAL_AUDIO_MODEL?.trim() || "voxtral-mini-latest";
const MISTRAL_BASE_URL = process.env.MISTRAL_BASE_URL?.trim();
const SAMPLE_URL =
  process.env.MISTRAL_SAMPLE_URL?.trim() ||
  "https://static.deepgram.com/examples/Bueller-Life-moves-pretty-fast.wav";
const LIVE =
  isTruthyEnvValue(process.env.MISTRAL_LIVE_TEST) ||
  isTruthyEnvValue(process.env.LIVE) ||
  isTruthyEnvValue(process.env.OPENCLAW_LIVE_TEST);

const describeLive = LIVE && MISTRAL_KEY ? describe : describe.skip;

async function fetchSampleBuffer(url: string, timeoutMs: number): Promise<Buffer> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), Math.max(1, timeoutMs));
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) {
      throw new Error(`Sample download failed (HTTP ${res.status})`);
    }
    const data = await res.arrayBuffer();
    return Buffer.from(data);
  } finally {
    clearTimeout(timer);
  }
}

describeLive("mistral live", () => {
  it("transcribes sample audio with voxtral", async () => {
    const buffer = await fetchSampleBuffer(SAMPLE_URL, 15000);
    const result = await mistralProvider.transcribeAudio!({
      buffer,
      fileName: "sample.wav",
      mime: "audio/wav",
      apiKey: MISTRAL_KEY,
      model: MISTRAL_MODEL,
      baseUrl: MISTRAL_BASE_URL,
      timeoutMs: 20000,
    });
    expect(result.text.trim().length).toBeGreaterThan(0);
  }, 30000);
});
