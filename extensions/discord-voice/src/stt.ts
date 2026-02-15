export interface STTConfig {
  apiKey: string;
  model?: string;
  language?: string;
  timeoutMs?: number;
}

export interface TranscriptionResult {
  text: string;
  language?: string;
  duration?: number;
}

type Logger = {
  info: (...args: unknown[]) => void;
  warn: (...args: unknown[]) => void;
  error: (...args: unknown[]) => void;
};

const DEFAULT_MODEL = "whisper-1";
const DEFAULT_LANGUAGE = "en";
const DEFAULT_TIMEOUT_MS = 30_000;
const MIN_PCM_BYTES = 500;

export class WhisperSTT {
  private readonly config: Required<Omit<STTConfig, "apiKey">> & Pick<STTConfig, "apiKey">;
  private readonly logger: Logger;

  constructor(config: STTConfig, logger?: { info: Function; warn: Function; error: Function }) {
    if (!config.apiKey) {
      throw new Error("WhisperSTT requires an OpenAI API key");
    }

    this.config = {
      apiKey: config.apiKey,
      model: config.model ?? DEFAULT_MODEL,
      language: config.language ?? DEFAULT_LANGUAGE,
      timeoutMs: config.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    };

    this.logger = {
      info: (...args: unknown[]) => logger?.info?.(...args),
      warn: (...args: unknown[]) => logger?.warn?.(...args),
      error: (...args: unknown[]) => logger?.error?.(...args),
    };
  }

  static createWavBuffer(pcm: Buffer): Buffer {
    const numChannels = 1;
    const sampleRate = 16_000;
    const bitsPerSample = 16;
    const byteRate = sampleRate * numChannels * (bitsPerSample / 8);
    const blockAlign = numChannels * (bitsPerSample / 8);
    const dataSize = pcm.length;

    const header = Buffer.alloc(44);
    header.write("RIFF", 0);
    header.writeUInt32LE(36 + dataSize, 4);
    header.write("WAVE", 8);
    header.write("fmt ", 12);
    header.writeUInt32LE(16, 16);
    header.writeUInt16LE(1, 20);
    header.writeUInt16LE(numChannels, 22);
    header.writeUInt32LE(sampleRate, 24);
    header.writeUInt32LE(byteRate, 28);
    header.writeUInt16LE(blockAlign, 32);
    header.writeUInt16LE(bitsPerSample, 34);
    header.write("data", 36);
    header.writeUInt32LE(dataSize, 40);

    return Buffer.concat([header, pcm]);
  }

  async transcribe(pcmAudio: Buffer): Promise<TranscriptionResult> {
    if (!pcmAudio || pcmAudio.length < MIN_PCM_BYTES) {
      return { text: "" };
    }

    const wavAudio = WhisperSTT.createWavBuffer(pcmAudio);
    const boundary = `----openclaw-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const body = this.buildMultipartBody(boundary, wavAudio);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.config.timeoutMs);

    try {
      const requestBody = body as unknown as BodyInit;
      const response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.config.apiKey}`,
          "Content-Type": `multipart/form-data; boundary=${boundary}`,
          "Content-Length": String(body.length),
        },
        body: requestBody,
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorBody = await response.text().catch(() => "");
        const message =
          this.extractApiErrorMessage(errorBody) ??
          `OpenAI STT request failed with status ${response.status}`;
        throw new Error(message);
      }

      const payload = (await response.json()) as {
        text?: string;
        language?: string;
        duration?: number;
      };
      if (!payload || typeof payload.text !== "string") {
        throw new Error("OpenAI STT returned an empty or invalid response");
      }

      return {
        text: payload.text,
        language: payload.language,
        duration: payload.duration,
      };
    } catch (error) {
      if (this.isAbortError(error)) {
        throw new Error(`OpenAI STT request timed out after ${this.config.timeoutMs}ms`);
      }

      const message = error instanceof Error ? error.message : String(error);
      this.logger.error("Whisper transcription failed", message);
      throw new Error(`Whisper transcription failed: ${message}`);
    } finally {
      clearTimeout(timeoutId);
    }
  }

  private buildMultipartBody(boundary: string, wavAudio: Buffer): Buffer {
    const chunks: Buffer[] = [];

    const addField = (name: string, value: string): void => {
      chunks.push(Buffer.from(`--${boundary}\r\n`));
      chunks.push(Buffer.from(`Content-Disposition: form-data; name="${name}"\r\n\r\n`));
      chunks.push(Buffer.from(`${value}\r\n`));
    };

    addField("model", this.config.model);
    if (this.config.language) {
      addField("language", this.config.language);
    }
    addField("response_format", "json");

    chunks.push(Buffer.from(`--${boundary}\r\n`));
    chunks.push(
      Buffer.from('Content-Disposition: form-data; name="file"; filename="audio.wav"\r\n'),
    );
    chunks.push(Buffer.from("Content-Type: audio/wav\r\n\r\n"));
    chunks.push(wavAudio);
    chunks.push(Buffer.from("\r\n"));
    chunks.push(Buffer.from(`--${boundary}--\r\n`));

    return Buffer.concat(chunks);
  }

  private isAbortError(error: unknown): boolean {
    if (!error || typeof error !== "object") {
      return false;
    }

    const candidate = error as { name?: string; message?: string };
    if (candidate.name === "AbortError") {
      return true;
    }

    return (
      typeof candidate.message === "string" && candidate.message.toLowerCase().includes("aborted")
    );
  }

  private extractApiErrorMessage(body: string): string | null {
    if (!body) {
      return null;
    }

    try {
      const parsed = JSON.parse(body) as { error?: { message?: string } };
      return parsed.error?.message ?? null;
    } catch {
      return body;
    }
  }
}
