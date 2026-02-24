import type { WebSocket } from "ws";
import type { SupabaseUser } from "../auth.js";
import type { ConnectParams } from "../protocol/index.js";

export type GatewayWsClient = {
  socket: WebSocket;
  connect: ConnectParams;
  connId: string;
  presenceKey?: string;
  clientIp?: string;
  canvasCapability?: string;
  canvasCapabilityExpiresAtMs?: number;
  /** Present when the client authenticated via Supabase JWT. */
  supabaseUser?: SupabaseUser;
};
