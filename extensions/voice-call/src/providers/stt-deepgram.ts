/**
 * Deepgram STT Provider
 *
 * Uses the Deepgram API for streaming transcription with:
 * - Real-time WebSocket streaming
 * - Nova-2 model support
 * - Built-in VAD and endpointing
 * - Word-level timestamps
 * - Partial transcript callbacks for real-time UI updates
 */

import WebSocket from "ws";

/**
 * Configuration for Deepgram STT.
 */
export interface DeepgramSTTConfig {
  /** Deepgram API key */
  apiKey: string;
  /** Model to use (default: nova-2) */
  model?: string;
  /** Language code (default: en-US) */
  language?: string;
  /** Silence duration in ms before considering speech ended (default: 1500) */
  utteranceEndMs?: number;
  /** Enable interim/partial results (default: true) */
  interimResults?: boolean;
}

/**
 * Session for streaming audio and receiving transcripts.
 */
export interface DeepgramSTTSession {
  /** Connect to the transcription service */
  connect(): Promise<void>;
  /** Send audio data (linear16/PCM or mu-law) */
  sendAudio(audio: Buffer): void;
  /** Wait for next complete transcript (after VAD detects end of speech) */
  waitForTranscript(timeoutMs?: number): Promise<string>;
  /** Set callback for partial transcripts (streaming) */
  onPartial(callback: (partial: string) => void): void;
  /** Set callback for final transcripts */
  onTranscript(callback: (transcript: string) => void): void;
  /** Set callback when speech starts */
  onSpeechStart(callback: () => void): void;
  /** Close the session */
  close(): void;
  /** Check if session is connected */
  isConnected(): boolean;
}

/**
 * Provider factory for Deepgram STT sessions.
 */
export class DeepgramSTTProvider {
  readonly name = "deepgram";
  private apiKey: string;
  private model: string;
  private language: string;
  private utteranceEndMs: number;
  private interimResults: boolean;

  constructor(config: DeepgramSTTConfig) {
    if (!config.apiKey) {
      throw new Error("Deepgram API key required for STT");
    }
    this.apiKey = config.apiKey;
    this.model = config.model || "nova-2";
    this.language = config.language || "en-US";
    this.utteranceEndMs = config.utteranceEndMs || 1500;
    this.interimResults = config.interimResults ?? true;
  }

  /**
   * Create a new realtime transcription session.
   */
  createSession(options?: {
    encoding?: "linear16" | "mulaw";
    sampleRate?: number;
  }): DeepgramSTTSession {
    return new DeepgramSTTSessionImpl(this.apiKey, {
      model: this.model,
      language: this.language,
      utteranceEndMs: this.utteranceEndMs,
      interimResults: this.interimResults,
      encoding: options?.encoding || "mulaw",
      sampleRate: options?.sampleRate || 8000,
    });
  }
}

interface DeepgramSessionOptions {
  model: string;
  language: string;
  utteranceEndMs: number;
  interimResults: boolean;
  encoding: "linear16" | "mulaw";
  sampleRate: number;
}

/**
 * WebSocket-based session for real-time speech-to-text.
 */
class DeepgramSTTSessionImpl implements DeepgramSTTSession {
  private static readonly MAX_RECONNECT_ATTEMPTS = 3;
  private static readonly RECONNECT_DELAY_MS = 1000;

  private ws: WebSocket | null = null;
  private connected = false;
  private closed = false;
  private reconnectAttempts = 0;
  private pendingTranscript = "";
  private onTranscriptCallback: ((transcript: string) => void) | null = null;
  private onPartialCallback: ((partial: string) => void) | null = null;
  private onSpeechStartCallback: (() => void) | null = null;
  private speechStarted = false;

  constructor(
    private readonly apiKey: string,
    private readonly options: DeepgramSessionOptions,
  ) {}

  async connect(): Promise<void> {
    this.closed = false;
    this.reconnectAttempts = 0;
    return this.doConnect();
  }

  private async doConnect(): Promise<void> {
    return new Promise((resolve, reject) => {
      const params = new URLSearchParams({
        model: this.options.model,
        language: this.options.language,
        encoding: this.options.encoding,
        sample_rate: String(this.options.sampleRate),
        channels: "1",
        punctuate: "true",
        interim_results: String(this.options.interimResults),
        smart_format: "true",
        utterance_end_ms: String(this.options.utteranceEndMs),
        vad_events: "true",
      });

      const url = `wss://api.deepgram.com/v1/listen?${params.toString()}`;

      this.ws = new WebSocket(url, {
        headers: {
          Authorization: `Token ${this.apiKey}`,
        },
      });

      this.ws.on("open", () => {
        console.log("[DeepgramSTT] WebSocket connected");
        this.connected = true;
        this.reconnectAttempts = 0;
        resolve();
      });

      this.ws.on("message", (data: Buffer) => {
        try {
          const event = JSON.parse(data.toString());
          this.handleEvent(event);
        } catch (e) {
          console.error("[DeepgramSTT] Failed to parse event:", e);
        }
      });

      this.ws.on("error", (error) => {
        console.error("[DeepgramSTT] WebSocket error:", error);
        if (!this.connected) {
          reject(error);
        }
      });

      this.ws.on("close", (code, reason) => {
        console.log(
          `[DeepgramSTT] WebSocket closed (code: ${code}, reason: ${reason?.toString() || "none"})`,
        );
        this.connected = false;

        // Attempt reconnection if not intentionally closed
        if (!this.closed) {
          void this.attemptReconnect();
        }
      });

      setTimeout(() => {
        if (!this.connected) {
          reject(new Error("Deepgram STT connection timeout"));
        }
      }, 10000);
    });
  }

  private async attemptReconnect(): Promise<void> {
    if (this.closed) {
      return;
    }

    if (this.reconnectAttempts >= DeepgramSTTSessionImpl.MAX_RECONNECT_ATTEMPTS) {
      console.error(
        `[DeepgramSTT] Max reconnect attempts (${DeepgramSTTSessionImpl.MAX_RECONNECT_ATTEMPTS}) reached`,
      );
      return;
    }

    this.reconnectAttempts++;
    const delay = DeepgramSTTSessionImpl.RECONNECT_DELAY_MS * 2 ** (this.reconnectAttempts - 1);
    console.log(
      `[DeepgramSTT] Reconnecting ${this.reconnectAttempts}/${DeepgramSTTSessionImpl.MAX_RECONNECT_ATTEMPTS} in ${delay}ms...`,
    );

    await new Promise((resolve) => setTimeout(resolve, delay));

    if (this.closed) {
      return;
    }

    try {
      await this.doConnect();
      console.log("[DeepgramSTT] Reconnected successfully");
    } catch (error) {
      console.error("[DeepgramSTT] Reconnect failed:", error);
    }
  }

  private handleEvent(event: {
    type?: string;
    channel?: {
      alternatives?: Array<{
        transcript?: string;
        confidence?: number;
        words?: Array<{
          word: string;
          start: number;
          end: number;
          confidence: number;
        }>;
      }>;
    };
    is_final?: boolean;
    speech_final?: boolean;
    metadata?: {
      model_info?: { language?: string };
      duration?: number;
    };
    error?: unknown;
  }): void {
    // Handle transcription results
    if (event.type === "Results" && event.channel?.alternatives) {
      const alternative = event.channel.alternatives[0];
      if (!alternative) {
        return;
      }

      const text = alternative.transcript?.trim();
      if (!text) {
        return;
      }

      // Detect speech start on first transcript
      if (!this.speechStarted) {
        this.speechStarted = true;
        this.onSpeechStartCallback?.();
      }

      if (event.is_final === false) {
        // Interim result
        this.pendingTranscript = text;
        this.onPartialCallback?.(text);
      } else {
        // Final result
        console.log(`[DeepgramSTT] Transcript: ${text}`);
        this.onTranscriptCallback?.(text);
        this.pendingTranscript = "";
        this.speechStarted = false;
      }
    }

    // Handle utterance end (silence detected)
    if (event.type === "UtteranceEnd") {
      console.log("[DeepgramSTT] Utterance end detected");
      // Final result should have already been emitted
      this.speechStarted = false;
    }

    // Handle speech started event
    if (event.type === "SpeechStarted") {
      console.log("[DeepgramSTT] Speech started");
      if (!this.speechStarted) {
        this.speechStarted = true;
        this.onSpeechStartCallback?.();
      }
    }

    // Handle errors
    if (event.type === "Error" || event.error) {
      console.error("[DeepgramSTT] Error:", event.error || event);
    }
  }

  sendAudio(audioData: Buffer): void {
    if (!this.connected || this.ws?.readyState !== WebSocket.OPEN) {
      return;
    }
    this.ws.send(audioData);
  }

  onPartial(callback: (partial: string) => void): void {
    this.onPartialCallback = callback;
  }

  onTranscript(callback: (transcript: string) => void): void {
    this.onTranscriptCallback = callback;
  }

  onSpeechStart(callback: () => void): void {
    this.onSpeechStartCallback = callback;
  }

  async waitForTranscript(timeoutMs = 30000): Promise<string> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.onTranscriptCallback = null;
        reject(new Error("Transcript timeout"));
      }, timeoutMs);

      this.onTranscriptCallback = (transcript) => {
        clearTimeout(timeout);
        this.onTranscriptCallback = null;
        resolve(transcript);
      };
    });
  }

  close(): void {
    this.closed = true;
    if (this.ws) {
      try {
        // Send close stream message
        if (this.ws.readyState === WebSocket.OPEN) {
          this.ws.send(JSON.stringify({ type: "CloseStream" }));
        }
        this.ws.close();
      } catch {
        // Best effort close
      }
      this.ws = null;
    }
    this.connected = false;
  }

  isConnected(): boolean {
    return this.connected;
  }
}
