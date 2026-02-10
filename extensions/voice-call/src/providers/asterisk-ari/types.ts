import type { RemoteInfo } from "node:dgram";
import type { VoiceCallConfig } from "../../config.js";
import type { MediaGraph } from "./ari-media.js";

type AriConfigInner = NonNullable<VoiceCallConfig["asteriskAri"]>;
export type AriConfig = AriConfigInner;

export type CoreSttSession = {
  onAudio: (mulaw: Buffer) => void;
  close: () => void;
};

export type CallState = {
  callId: string;
  providerCallId: string;
  sipChannelId: string;
  media?: MediaGraph;
  speaking: boolean;
  ttsTimer?: NodeJS.Timeout;
  stt?: CoreSttSession;
  sttMessageHandler?: (msg: Buffer) => void;
  rtpMessageHandler?: (msg: Buffer, rinfo: RemoteInfo) => void;
  pendingMulaw?: Buffer;
  pendingSpeakText?: string;
  rtpPeer?: { address: string; port: number };
  answeredEmitted?: boolean;
  rtpSeen?: boolean;
  rtpState?: { seq: number; ts: number; ssrc: number };
};
