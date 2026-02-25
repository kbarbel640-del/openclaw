/**
 * Per-call audio bridge: ties a WhatsApp WebRTC peer to an OpenAI Realtime
 * client and forwards Opus audio between them.
 *
 * RTP packets received from one peer are re-packaged with the correct
 * SSRC / sequence / timestamp for the destination peer before sending.
 */

import { OpenAIRealtimeClient } from "./openai-realtime.js";
import type { ICEServer, WhatsAppCallVoiceConfig } from "./types.js";
import { WhatsAppPeer } from "./wa-peer.js";

/** Strip RTP header (min 12 bytes + CSRC + extensions) → Opus payload */
function extractOpusPayload(rtp: Buffer): Buffer | null {
  if (rtp.length < 12) return null;
  const cc = rtp[0] & 0x0f;
  const hasExtension = (rtp[0] & 0x10) !== 0;
  let offset = 12 + cc * 4;
  if (hasExtension) {
    if (rtp.length < offset + 4) return null;
    const extLen = rtp.readUInt16BE(offset + 2);
    offset += 4 + extLen * 4;
  }
  const hasPadding = (rtp[0] & 0x20) !== 0;
  let end = rtp.length;
  if (hasPadding && end > offset) {
    end -= rtp[end - 1];
  }
  if (end <= offset) return null;
  return rtp.subarray(offset, end);
}

/** Build a minimal RTP packet: 12-byte header + Opus payload */
function buildRtp(payload: Buffer, pt: number, seq: number, ts: number, ssrc: number): Buffer {
  const header = Buffer.alloc(12);
  header[0] = 0x80;
  header[1] = pt & 0x7f;
  header.writeUInt16BE(seq & 0xffff, 2);
  header.writeUInt32BE(ts >>> 0, 4);
  header.writeUInt32BE(ssrc >>> 0, 8);
  return Buffer.concat([header, payload]);
}

function randomSSRC(): number {
  return (Math.random() * 0xffffffff) >>> 0;
}

export class CallBridge {
  readonly connectionId: string;
  readonly callId: string;
  private waPeer: WhatsAppPeer;
  private ai: OpenAIRealtimeClient | null = null;
  private closed = false;
  private aiReady = false;
  private greetingSent = false;
  private firstFrame = false;
  private firstAiFrame = false;
  private waToAiCount = 0;
  private aiToWaCount = 0;

  // RTP re-packager state for WA→AI and AI→WA
  private toAiSeq = 0;
  private toAiTs = 0;
  private toWaSeq = 0;
  private toWaTs = 0;

  constructor(
    connectionId: string,
    callId: string,
    private config: WhatsAppCallVoiceConfig,
    private logger: (msg: string) => void,
  ) {
    this.connectionId = connectionId;
    this.callId = callId;
    this.waPeer = new WhatsAppPeer(logger);
  }

  /**
   * Step 1: Generate SDP offer for WhatsApp.
   */
  async generateOffer(iceServers: ICEServer[]): Promise<string> {
    return this.waPeer.generateOffer(iceServers);
  }

  /**
   * Step 2: Apply SDP answer from WhatsApp, then connect to OpenAI.
   */
  async handleSdpAnswer(answerSdp: string): Promise<void> {
    await this.waPeer.applyAnswer(answerSdp);
    this.logger(`[bridge] ${this.connectionId} WA WebRTC established`);

    // Wire WA → OpenAI: extract Opus payload from RTP, re-package for AI peer
    this.waPeer.onRemoteAudio = (rtp) => {
      if (!this.aiReady || !this.ai) return;
      const opus = extractOpusPayload(rtp);
      if (!opus || opus.length < 1) return;
      if (!this.firstFrame) {
        this.firstFrame = true;
        this.logger(
          `[bridge] ${this.connectionId} first WA→AI (rtp=${rtp.length}b opus=${opus.length}b)`,
        );
      }
      const pkt = buildRtp(opus, 111, this.toAiSeq++, this.toAiTs, this.ai!.localSsrc);
      this.toAiTs += 960; // 20ms at 48kHz
      this.waToAiCount++;
      this.ai.writeRtp(pkt);
    };

    // Connect to OpenAI Realtime in background
    this.connectOpenAI().catch((err) => {
      this.logger(`[bridge] ${this.connectionId} OpenAI connect failed: ${err}`);
    });
  }

  /**
   * Send greeting once AI is ready.
   */
  sendGreeting(): void {
    if (this.greetingSent || !this.ai || !this.aiReady) return;
    this.greetingSent = true;
    const greeting =
      this.config.voiceGreeting || "Greet the user warmly. Keep it brief and natural.";
    this.ai.triggerGreeting(greeting);
    this.logger(`[bridge] ${this.connectionId} greeting sent`);
  }

  get isClosed(): boolean {
    return this.closed;
  }

  get isAiReady(): boolean {
    return this.aiReady;
  }

  close(): void {
    if (this.closed) return;
    this.closed = true;
    this.logger(
      `[bridge] ${this.connectionId} stats: WA→AI=${this.waToAiCount} AI→WA=${this.aiToWaCount}`,
    );
    this.waPeer.close();
    if (this.ai) this.ai.close();
    this.logger(`[bridge] ${this.connectionId} closed`);
  }

  // --- private ---

  private async connectOpenAI(): Promise<void> {
    const apiKey = this.config.openaiApiKey || process.env.OPENAI_API_KEY || "";
    const model = this.config.openaiModel || "gpt-4o-realtime-preview-2025-06-03";
    const voice = this.config.voice || "verse";
    const speed = this.config.voiceSpeed ?? 1.1;
    const lang = this.config.voiceLanguage || "";

    const greeting =
      this.config.voiceGreeting || "Greet the user warmly. Keep it brief and natural.";
    const instructions = greeting;

    this.ai = new OpenAIRealtimeClient(
      apiKey,
      model,
      voice,
      speed,
      lang,
      instructions,
      this.logger,
    );

    // Wire OpenAI → WA: extract Opus payload from RTP, re-package for WA peer
    this.ai.onModelAudio = (rtp) => {
      if (this.closed) return;
      const opus = extractOpusPayload(rtp);
      if (!opus || opus.length < 1) return;
      if (!this.firstAiFrame) {
        this.firstAiFrame = true;
        this.logger(
          `[bridge] ${this.connectionId} first AI→WA (rtp=${rtp.length}b opus=${opus.length}b)`,
        );
      }
      const pkt = buildRtp(opus, 111, this.toWaSeq++, this.toWaTs, this.waPeer.localSsrc);
      this.toWaTs += 960;
      this.aiToWaCount++;
      this.waPeer.writeRtp(pkt);
    };

    this.ai.onEvent = (event) => {
      const type = String(event.type ?? "");
      if (type.startsWith("input_audio_buffer")) {
        this.logger(`[openai] ${this.connectionId} ${type}`);
      } else if (type.startsWith("conversation.item.input_audio_transcription")) {
        const t = String(event.transcript ?? "");
        if (t) this.logger(`[openai] ${this.connectionId} user said: ${t}`);
      } else if (type.startsWith("response.audio_transcript")) {
        const t = String(event.transcript ?? "");
        if (t) this.logger(`[openai] ${this.connectionId} AI: ${t}`);
      } else if (type.startsWith("response.created") || type.startsWith("response.done")) {
        this.logger(`[openai] ${this.connectionId} ${type}`);
      } else if (type.startsWith("error")) {
        this.logger(`[openai] ${this.connectionId} error: ${JSON.stringify(event)}`);
      }
    };

    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 30_000);
    try {
      await this.ai.connect(ctrl.signal);
    } finally {
      clearTimeout(timer);
    }

    this.aiReady = true;
    this.logger(`[bridge] ${this.connectionId} OpenAI connected, AI ready`);

    // Auto-send greeting once AI is ready
    this.sendGreeting();
  }
}
