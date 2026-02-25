/**
 * WhatsApp-side WebRTC peer connection (node-datachannel / libdatachannel).
 *
 * Generates an SDP offer to send to WATI/Meta, then processes the SDP answer
 * returned via webhook.  Emits raw RTP packets received from WhatsApp and
 * accepts raw RTP packets to send back.
 */

import ndc from "node-datachannel";
import type { ICEServer } from "./types.js";

export type OnRtpPacket = (rtp: Buffer) => void;

export class WhatsAppPeer {
  private pc: InstanceType<typeof ndc.PeerConnection> | null = null;
  private track: ReturnType<InstanceType<typeof ndc.PeerConnection>["addTrack"]> | null = null;
  private closed = false;
  onRemoteAudio: OnRtpPacket | null = null;
  /** The SSRC used in our SDP offer — outgoing RTP must use this value. */
  readonly localSsrc: number;

  constructor(private logger: (msg: string) => void) {
    this.localSsrc = randomSSRC();
  }

  /**
   * Create peer connection, generate SDP offer for WhatsApp.
   * Returns the offer SDP string to send to WATI/Meta.
   */
  async generateOffer(iceServers: ICEServer[]): Promise<string> {
    const ndcIceServers = toNdcIceServers(iceServers);

    this.pc = new ndc.PeerConnection("wa-peer", {
      iceServers: ndcIceServers,
      disableAutoNegotiation: true,
    });

    this.pc.onStateChange((state: string) => {
      this.logger(`[wa-peer] conn: ${state}`);
    });
    this.pc.onIceStateChange((state: string) => {
      this.logger(`[wa-peer] ICE: ${state}`);
    });

    const audio = new ndc.Audio("0", "SendRecv");
    audio.addOpusCodec(111);
    audio.addSSRC(this.localSsrc, "wa-audio", "wa-stream", "wa-audio-track");

    this.track = this.pc.addTrack(audio);
    this.track.onOpen(() => {
      this.logger("[wa-peer] track open");
    });

    this.track.onMessage((msg: Buffer) => {
      try {
        if (this.closed || !this.onRemoteAudio) return;
        if (msg.length < 12) return;
        this.onRemoteAudio(Buffer.from(msg));
      } catch {}
    });

    const sdp = await gatherSdp(this.pc);
    this.logger(`[wa-peer] SDP offer ready (${sdp.length} bytes)`);
    return sdp;
  }

  /**
   * Apply the SDP answer received from WhatsApp (via WATI/Meta webhook).
   */
  async applyAnswer(answerSdp: string): Promise<void> {
    if (!this.pc) throw new Error("peer not initialized");
    this.pc.setRemoteDescription(answerSdp, "answer");
    this.logger("[wa-peer] SDP answer applied, WebRTC up");
  }

  /**
   * Write a raw RTP packet to the WhatsApp audio track.
   */
  writeRtp(rtpPacket: Buffer): void {
    if (!this.track || this.closed) return;
    try {
      this.track.sendMessageBinary(rtpPacket);
    } catch {}
  }

  close(): void {
    this.closed = true;
    if (this.track) {
      try {
        this.track.close();
      } catch {}
      this.track = null;
    }
    if (this.pc) {
      try {
        this.pc.close();
      } catch {}
      this.pc = null;
    }
  }
}

// --- helpers ---

function toNdcIceServers(servers: ICEServer[]): (string | ndc.IceServer)[] {
  const result: (string | ndc.IceServer)[] = [];
  for (const s of servers) {
    for (const url of s.urls) {
      if (url.startsWith("stun:")) {
        result.push(url);
      } else if (url.startsWith("turn:") || url.startsWith("turns:")) {
        const m = url.match(/^(turns?):([^:?]+):(\d+)/);
        if (m && s.username && s.credential) {
          result.push({
            hostname: m[2],
            port: parseInt(m[3], 10),
            username: s.username,
            password: s.credential,
            relayType: m[1] === "turns" ? "TurnTls" : "TurnUdp",
          });
        }
      }
    }
  }
  if (result.length === 0) {
    result.push("stun:stun.l.google.com:19302");
  }
  return result;
}

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
