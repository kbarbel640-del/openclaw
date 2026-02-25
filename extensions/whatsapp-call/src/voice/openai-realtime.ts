/**
 * OpenAI Realtime API client over WebRTC (node-datachannel / libdatachannel).
 *
 * Connects to OpenAI's Realtime endpoint, establishes a bidirectional audio
 * channel and a data channel for events.  Forwards AI audio as raw RTP
 * packets and accepts user audio as raw RTP packets.
 */

import ndc from "node-datachannel";

const CLIENT_SECRETS_URL = "https://api.openai.com/v1/realtime/client_secrets";
const REALTIME_CALLS_PATH = "/v1/realtime/calls";
const OPENAI_BASE_URL = "https://api.openai.com";

export type OnRtpPacket = (rtp: Buffer) => void;
export type OnEvent = (event: Record<string, unknown>) => void;

export class OpenAIRealtimeClient {
  private pc: InstanceType<typeof ndc.PeerConnection> | null = null;
  private track: ReturnType<InstanceType<typeof ndc.PeerConnection>["addTrack"]> | null = null;
  private dc: ReturnType<InstanceType<typeof ndc.PeerConnection>["createDataChannel"]> | null =
    null;
  private dcReady = false;
  private closed = false;
  /** The SSRC used in our SDP offer — outgoing RTP must use this value. */
  readonly localSsrc: number;

  onModelAudio: OnRtpPacket | null = null;
  onEvent: OnEvent | null = null;

  constructor(
    private apiKey: string,
    private model: string,
    private voice: string,
    private speed: number,
    private lang: string,
    private instructions: string,
    private logger: (msg: string) => void,
  ) {
    this.localSsrc = randomSSRC();
  }

  async connect(signal?: AbortSignal): Promise<void> {
    const token = await this.mintEphemeralToken();
    this.logger("[openai] ephemeral token acquired");

    this.pc = new ndc.PeerConnection("openai-peer", {
      iceServers: ["stun:stun.l.google.com:19302"],
    });

    this.pc.onStateChange((state: string) => {
      this.logger(`[openai] conn: ${state}`);
      if (state === "failed" || state === "closed") {
        this.dcReady = false;
      }
    });

    const audio = new ndc.Audio("0", "SendRecv");
    audio.addOpusCodec(111);
    audio.addSSRC(this.localSsrc, "oai-audio", "oai-stream", "oai-audio-track");

    this.track = this.pc.addTrack(audio);
    this.track.onOpen(() => {
      this.logger("[openai] track open");
    });

    this.track.onMessage((msg: Buffer) => {
      try {
        if (this.closed || !this.onModelAudio) return;
        if (msg.length < 12) return;
        this.onModelAudio(Buffer.from(msg));
      } catch {}
    });

    this.dc = this.pc.createDataChannel("oai-events");
    const dcOpenPromise = new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("data channel open timeout")), 30_000);
      this.dc!.onOpen(() => {
        clearTimeout(timer);
        this.dcReady = true;
        this.logger("[openai] data channel open");
        resolve();
      });
      this.dc!.onMessage((msg: string | Buffer | ArrayBuffer) => {
        if (!this.onEvent) return;
        try {
          const text = typeof msg === "string" ? msg : Buffer.from(msg as ArrayBuffer).toString();
          const event = JSON.parse(text);
          this.onEvent(event);
        } catch {}
      });
    });

    const localSdp = await gatherSdp(this.pc);

    const answerSdp = await this.exchangeSDP(localSdp, token, signal);
    this.pc.setRemoteDescription(answerSdp, "answer");

    await dcOpenPromise;
    this.logger("[openai] WebRTC connection established");
  }

  writeRtp(rtpPacket: Buffer): void {
    if (!this.track || this.closed) return;
    try {
      this.track.sendMessageBinary(rtpPacket);
    } catch {}
  }

  sendEvent(event: Record<string, unknown>): void {
    if (!this.dc || !this.dcReady) return;
    this.dc.sendMessage(JSON.stringify(event));
  }

  /** Update session-level instructions (language, persona, etc.) */
  updateSession(instructions: string): void {
    this.sendEvent({
      type: "session.update",
      session: { instructions },
    });
  }

  triggerGreeting(greeting: string): void {
    this.sendEvent({
      type: "response.create",
      response: { instructions: greeting },
    });
  }

  close(): void {
    this.closed = true;
    this.dcReady = false;
    if (this.track) {
      try {
        this.track.close();
      } catch {}
      this.track = null;
    }
    if (this.dc) {
      try {
        this.dc.close();
      } catch {}
      this.dc = null;
    }
    if (this.pc) {
      try {
        this.pc.close();
      } catch {}
      this.pc = null;
    }
  }

  get connected(): boolean {
    return this.dcReady && !this.closed;
  }

  // --- private ---

  private async mintEphemeralToken(): Promise<string> {
    const sessionCfg: Record<string, unknown> = {
      session: {
        type: "realtime",
        model: this.model,
        ...(this.instructions ? { instructions: this.instructions } : {}),
        audio: {
          output: { voice: this.voice, speed: this.speed },
          input: {
            format: { type: "audio/pcm", rate: 24000 },
            noise_reduction: { type: "near_field" },
            transcription: {
              model: "gpt-4o-transcribe",
              ...(this.lang ? { language: this.lang } : {}),
            },
            turn_detection: {
              type: "server_vad",
              threshold: 0.5,
              prefix_padding_ms: 300,
              silence_duration_ms: 700,
            },
          },
        },
        include: ["item.input_audio_transcription.logprobs"],
      },
    };

    const res = await fetch(CLIENT_SECRETS_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(sessionCfg),
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`client_secrets ${res.status}: ${body}`);
    }
    const data = (await res.json()) as { value?: string };
    return data.value ?? "";
  }

  private async exchangeSDP(
    sdpOffer: string,
    token: string,
    signal?: AbortSignal,
  ): Promise<string> {
    const url = `${OPENAI_BASE_URL}${REALTIME_CALLS_PATH}?model=${this.model}`;
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/sdp",
      },
      body: sdpOffer,
      signal,
    });
    const body = await res.text();
    if (!res.ok) throw new Error(`realtime/calls ${res.status}: ${body}`);
    return body;
  }
}

// --- helpers ---

function randomSSRC(): number {
  return (Math.random() * 0xffffffff) >>> 0;
}

function gatherSdp(pc: InstanceType<typeof ndc.PeerConnection>): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("SDP gathering timeout")), 30_000);
    pc.onGatheringStateChange((state: string) => {
      if (state === "complete") {
        clearTimeout(timer);
        const desc = pc.localDescription();
        if (desc?.sdp) {
          resolve(desc.sdp);
        } else {
          reject(new Error("no local description after gathering"));
        }
      }
    });
    pc.setLocalDescription("offer");
  });
}
