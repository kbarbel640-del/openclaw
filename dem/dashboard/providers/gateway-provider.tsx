"use client";

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  type ReactNode,
} from "react";
import { GatewayClient } from "@/lib/gateway-client";
import { useDashboardStore } from "@/lib/store";
import type { AgentId, GatewayMessage } from "@/lib/types";

const GATEWAY_URL = "ws://127.0.0.1:18789";

const GatewayContext = createContext<GatewayClient | null>(null);

export function useGateway(): GatewayClient | null {
  return useContext(GatewayContext);
}

const AGENT_ID_MAP: Record<string, AgentId> = {
  imperator: "ceo",
  praetor: "coo",
  quaestor: "cfo",
  explorator: "research",
  ceo: "ceo",
  coo: "coo",
  cfo: "cfo",
  research: "research",
};

function resolveAgentId(raw: string): AgentId | null {
  const normalized = raw.toLowerCase().trim();
  return AGENT_ID_MAP[normalized] ?? null;
}

function resolveAgentName(agentId: AgentId): string {
  const names: Record<AgentId, string> = {
    ceo: "Imperator",
    coo: "Praetor",
    cfo: "Quaestor",
    research: "Explorator",
  };
  return names[agentId];
}

function generateEventId(): string {
  return `evt-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function GatewayProvider({ children }: { children: ReactNode }) {
  const clientRef = useRef<GatewayClient | null>(null);
  const { setConnectionStatus, updateAgent, addEvent } =
    useDashboardStore.getState();

  useEffect(() => {
    const client = new GatewayClient(GATEWAY_URL);
    clientRef.current = client;

    const unsubStatus = client.onStatus((status) => {
      useDashboardStore.getState().setConnectionStatus(status);
    });

    const unsubEvents = client.onEvent((message: GatewayMessage) => {
      routeGatewayEvent(message);
    });

    client.connect();

    return () => {
      unsubStatus();
      unsubEvents();
      client.disconnect();
      clientRef.current = null;
    };
  }, []);

  function routeGatewayEvent(message: GatewayMessage): void {
    const store = useDashboardStore.getState();

    if (message.type === "event" && message.event && message.payload) {
      const eventName = message.event;
      const payload = message.payload;

      if (eventName === "agent.status") {
        const rawAgent = (payload.agent as string) ?? "";
        const agentId = resolveAgentId(rawAgent);
        if (agentId) {
          const status = (payload.status as string) ?? "idle";
          const task = payload.task as string | undefined;
          store.updateAgent(agentId, {
            status: status as "idle" | "busy" | "offline" | "error",
            currentTask: task,
          });

          store.addEvent({
            id: generateEventId(),
            timestamp: Date.now(),
            agentId,
            agentName: resolveAgentName(agentId),
            type: "status",
            content: `Status changed to ${status}${task ? `: ${task}` : ""}`,
            metadata: payload,
          });
        }
      } else if (eventName === "agent.message") {
        const rawAgent = (payload.agent as string) ?? (payload.from as string) ?? "";
        const agentId = resolveAgentId(rawAgent);
        if (agentId) {
          store.addEvent({
            id: generateEventId(),
            timestamp: Date.now(),
            agentId,
            agentName: resolveAgentName(agentId),
            type: "message",
            content: (payload.content as string) ?? (payload.message as string) ?? JSON.stringify(payload),
            metadata: payload,
          });
        }
      } else if (eventName === "agent.delegation") {
        const rawFrom = (payload.from as string) ?? "";
        const agentId = resolveAgentId(rawFrom);
        if (agentId) {
          const rawTo = (payload.to as string) ?? "unknown";
          store.addEvent({
            id: generateEventId(),
            timestamp: Date.now(),
            agentId,
            agentName: resolveAgentName(agentId),
            type: "delegation",
            content: `Delegated task to ${rawTo}: ${(payload.task as string) ?? ""}`,
            metadata: payload,
          });
        }
      } else if (eventName === "agent.validation") {
        const rawAgent = (payload.agent as string) ?? "";
        const agentId = resolveAgentId(rawAgent);
        if (agentId) {
          store.addEvent({
            id: generateEventId(),
            timestamp: Date.now(),
            agentId,
            agentName: resolveAgentName(agentId),
            type: "validation",
            content: (payload.result as string) ?? "Validation completed",
            metadata: payload,
          });
        }
      } else if (eventName === "agent.error") {
        const rawAgent = (payload.agent as string) ?? "";
        const agentId = resolveAgentId(rawAgent);
        if (agentId) {
          store.updateAgent(agentId, { status: "error" });
          store.addEvent({
            id: generateEventId(),
            timestamp: Date.now(),
            agentId,
            agentName: resolveAgentName(agentId),
            type: "error",
            content: (payload.error as string) ?? (payload.message as string) ?? "Unknown error",
            metadata: payload,
          });
        }
      } else if (eventName === "auth" || eventName === "connect.ack") {
        store.addEvent({
          id: generateEventId(),
          timestamp: Date.now(),
          agentId: "ceo",
          agentName: "System",
          type: "auth",
          content: `Gateway: ${eventName}`,
          metadata: payload,
        });
      }
    }
  }

  return (
    <GatewayContext.Provider value={clientRef.current}>
      {children}
    </GatewayContext.Provider>
  );
}
