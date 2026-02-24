/**
 * WhatsApp voice call orchestrator.
 *
 * Manages the lifecycle of outbound calls: permission checks, SDP offer/answer
 * exchange, and audio bridging between WhatsApp and OpenAI Realtime.
 */

import { randomUUID } from "node:crypto";
import { CallBridge } from "./bridge.js";
import { MetaClient } from "./meta-api.js";
import { ConnectionStore } from "./state.js";
import { TwilioTurnProvider } from "./turn-provider.js";
import type {
  ICEServer,
  OutboundRequest,
  OutboundResult,
  WhatsAppCallVoiceConfig,
} from "./types.js";
import { WatiClient } from "./wati-api.js";
import { parseWebhookBody, type ParsedEvent } from "./webhooks.js";

const DEFAULT_STUN: ICEServer = { urls: ["stun:stun.l.google.com:19302"] };

export class WhatsAppCallService {
  private store = new ConnectionStore();
  private bridges = new Map<string, CallBridge>();
  private wati: WatiClient | null = null;
  private meta: MetaClient | null = null;
  private turn: TwilioTurnProvider | null = null;
  private running = false;

  constructor(
    private config: WhatsAppCallVoiceConfig,
    private logger: (msg: string) => void = console.log,
  ) {}

  async start(): Promise<void> {
    if (this.running) return;
    this.running = true;

    if (this.config.watiTenantId && this.config.watiApiToken) {
      this.wati = new WatiClient(
        this.config.watiBaseUrl || "https://live-mt-server.wati.io",
        this.config.watiOutboundUrl || this.config.watiBaseUrl || "https://live-mt-server.wati.io",
        this.config.watiTenantId,
        this.config.watiApiToken,
      );
    }
    if (this.config.metaPhoneNumberId && this.config.metaAccessToken) {
      this.meta = new MetaClient(
        this.config.metaPhoneNumberId,
        this.config.metaAccessToken,
        this.config.metaGraphBaseUrl,
      );
    }
    if (this.config.twilioAccountSid && this.config.twilioAuthToken) {
      this.turn = new TwilioTurnProvider(this.config.twilioAccountSid, this.config.twilioAuthToken);
    }

    const backend = this.meta?.configured ? "Meta" : this.wati?.configured ? "WATI" : "none";
    this.logger(
      `[wa-call] service started (backend=${backend}, turn=${this.turn?.configured ?? false})`,
    );
  }

  async stop(): Promise<void> {
    this.running = false;
    for (const [id, bridge] of this.bridges) {
      bridge.close();
      this.bridges.delete(id);
    }
    this.logger("[wa-call] service stopped");
  }

  /**
   * Initiate an outbound WhatsApp voice call.
   */
  async initiateCall(req: OutboundRequest): Promise<OutboundResult> {
    if (!this.running) throw new Error("service not running");

    // Permission check
    await this.checkPermission(req.whatsappNumber, req.channelPhone);

    const connectionId = randomUUID();
    const callId = randomUUID();
    const requestId = randomUUID();

    const bridge = new CallBridge(connectionId, callId, this.config, this.logger);
    this.bridges.set(connectionId, bridge);

    const iceServers = await this.getICEServers();
    const sdpOffer = await bridge.generateOffer(iceServers);

    this.store.save({
      connectionId,
      callId,
      contactWaid: req.whatsappNumber,
      channelPhone: req.channelPhone ?? "",
      agentId: req.agentId ?? "",
      callbackUrl: req.callbackUrl ?? "",
      requestId,
      status: "initiated",
      context: req.context ?? {},
      awaitingPermission: false,
      createdAt: new Date(),
    });

    this.logger(`[wa-call] initiated conn=${connectionId} waid=${req.whatsappNumber}`);

    // Send SDP to WhatsApp backend
    await this.sendSdpOffer(connectionId, req.whatsappNumber, req.channelPhone ?? "", sdpOffer);

    return { connectionId, requestId, status: "initiated" };
  }

  /**
   * Get call status by connection ID.
   */
  getCallStatus(connectionId: string): Record<string, unknown> | null {
    const conn = this.store.getById(connectionId);
    if (!conn) return null;
    return {
      found: true,
      connectionId: conn.connectionId,
      callId: conn.callId,
      status: conn.status,
      contactWaid: conn.contactWaid,
      createdAt: conn.createdAt,
    };
  }

  /**
   * Process a raw webhook body (WATI or Meta format).
   */
  handleWebhook(body: string): void {
    let events: ParsedEvent[];
    try {
      events = parseWebhookBody(body);
    } catch (err) {
      this.logger(`[wa-call] webhook parse error: ${err}`);
      return;
    }

    for (const evt of events) {
      this.processEvent(evt);
    }
  }

  // --- private ---

  private processEvent(evt: ParsedEvent): void {
    let conn = evt.callId ? this.store.getByCallId(evt.callId) : undefined;
    if (!conn && evt.contactNumber) conn = this.store.getByContact(evt.contactNumber);

    if (!conn) {
      this.logger(`[wa-call] webhook for unknown call=${evt.callId} contact=${evt.contactNumber}`);
      return;
    }

    if (evt.callId) this.store.associateCallId(conn.connectionId, evt.callId);
    this.store.updateStatus(conn.connectionId, evt.status);
    this.logger(
      `[wa-call] event conn=${conn.connectionId} phase=${evt.phase} status=${evt.status}`,
    );

    // SDP answer → establish WebRTC + start AI
    if (evt.sdpAnswer) {
      const sdp = unquoteJson(evt.sdpAnswer);
      const bridge = this.bridges.get(conn.connectionId);
      if (bridge && sdp) {
        bridge.handleSdpAnswer(sdp).catch((err) => {
          this.logger(`[wa-call] SDP answer error: ${err}`);
        });
      }
    }

    // Call accepted → send greeting
    if (evt.phase === "call" && (evt.status === "accepted" || evt.status === "connected")) {
      const bridge = this.bridges.get(conn.connectionId);
      if (bridge) {
        this.waitForAiAndGreet(bridge);
      }
    }

    // Call ended → cleanup
    if (evt.phase === "call" && (evt.status === "ended" || evt.status === "rejected")) {
      const bridge = this.bridges.get(conn.connectionId);
      if (bridge) {
        bridge.close();
        this.bridges.delete(conn.connectionId);
      }
      this.store.delete(conn.connectionId);
    }
  }

  private waitForAiAndGreet(bridge: CallBridge): void {
    let attempts = 0;
    const interval = setInterval(() => {
      if (bridge.isClosed || attempts++ > 300) {
        clearInterval(interval);
        return;
      }
      if (bridge.isAiReady) {
        bridge.sendGreeting();
        clearInterval(interval);
      }
    }, 100);
  }

  private async checkPermission(waid: string, channelPhone?: string): Promise<void> {
    try {
      if (this.meta?.configured) {
        const outcome = await this.meta.checkPermissions(waid);
        if (!outcome.canStartCall) throw new Error("Meta: call permission denied");
        return;
      }
      if (this.wati?.configured) {
        const outcome = await this.wati.checkPermissions(waid, channelPhone);
        if (!outcome.canStartCall) {
          if (outcome.canRequestPermission) {
            await this.wati.sendCallPermissionRequest(waid, channelPhone);
            throw new Error("Permission requested — call will proceed on webhook grant");
          }
          // WATI permissions API can be flaky; proceed and let outbound call fail if truly denied
          this.logger(`[wa-call] permissions check inconclusive for ${waid}, proceeding anyway`);
        }
      }
    } catch (err) {
      if (err instanceof Error && err.message.includes("Permission requested")) throw err;
      this.logger(`[wa-call] permissions check failed: ${err}, proceeding anyway`);
    }
  }

  private async sendSdpOffer(
    connId: string,
    waid: string,
    channelPhone: string,
    sdp: string,
  ): Promise<void> {
    if (this.meta?.configured) {
      this.logger(`[wa-call] sending SDP offer to Meta for conn=${connId}`);
      const callId = await this.meta.makeOutboundCall(waid, sdp);
      if (callId) {
        this.store.associateCallId(connId, callId);
        this.logger(`[wa-call] Meta returned call_id=${callId}`);
      }
      return;
    }
    if (this.wati?.configured) {
      this.logger(`[wa-call] sending SDP offer to WATI for conn=${connId}`);
      await this.wati.makeOutboundCall(waid, channelPhone, sdp);
    }
  }

  private async getICEServers(): Promise<ICEServer[]> {
    const servers: ICEServer[] = [DEFAULT_STUN];
    if (this.turn?.configured) {
      try {
        const turnServers = await this.turn.getICEServers();
        servers.push(...turnServers);
        this.logger(`[wa-call] ${turnServers.length} TURN servers from Twilio`);
      } catch (err) {
        this.logger(`[wa-call] TURN fetch failed: ${err}`);
      }
    }
    return servers;
  }
}

function unquoteJson(s: string): string {
  try {
    const decoded = JSON.parse(s);
    if (typeof decoded === "string") return decoded;
  } catch {}
  return s;
}
