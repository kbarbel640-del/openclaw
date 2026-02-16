export type AgentId = "ceo" | "coo" | "cfo" | "research";

export type AgentStatus = "idle" | "busy" | "offline" | "error";

export interface AgentInfo {
  id: AgentId;
  name: string;
  codename: string;
  role: string;
  model: string;
  server: string;
  status: AgentStatus;
  currentTask?: string;
}

export interface ActivityEvent {
  id: string;
  timestamp: number;
  agentId: AgentId;
  agentName: string;
  type: "message" | "delegation" | "validation" | "status" | "auth" | "error";
  content: string;
  metadata?: Record<string, unknown>;
}

export interface GatewayMessage {
  type: "event" | "req" | "res";
  id?: string;
  event?: string;
  method?: string;
  params?: Record<string, unknown>;
  ok?: boolean;
  payload?: Record<string, unknown>;
  error?: string;
}

export type ConnectionStatus =
  | "connecting"
  | "connected"
  | "disconnected"
  | "error";
