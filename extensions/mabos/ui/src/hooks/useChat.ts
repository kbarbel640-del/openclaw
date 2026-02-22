import { useState, useCallback, useRef, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { ChatMessage } from "@/lib/types";

export type ChatStatus = "connected" | "connecting" | "disconnected";

/**
 * Chat hook that uses REST (POST /mabos/api/chat) for sending messages
 * and SSE (GET /mabos/api/chat/events) for receiving agent responses.
 */
export function useChat(businessId = "default") {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [status, setStatus] = useState<ChatStatus>("disconnected");
  const [activeAgent, setActiveAgent] = useState("ceo");

  const activeAgentRef = useRef(activeAgent);
  const eventSourceRef = useRef<EventSource | null>(null);

  // Keep the ref in sync so SSE callback always has the latest value
  useEffect(() => {
    activeAgentRef.current = activeAgent;
  }, [activeAgent]);

  // SSE connection for receiving agent events
  useEffect(() => {
    setStatus("connecting");

    const url = `/mabos/api/chat/events?agentId=${encodeURIComponent(activeAgent)}&businessId=${encodeURIComponent(businessId)}`;
    const es = new EventSource(url);
    eventSourceRef.current = es;

    es.onopen = () => {
      setStatus("connected");
    };

    es.onmessage = (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data as string);

        if (data.type === "connected") {
          // Initial connection acknowledgment — nothing to display
          return;
        }

        if (data.type === "agent_response" || data.type === "message") {
          const newMsg: ChatMessage = {
            id: String(data.id || Date.now()),
            role: "agent",
            agentId: String(data.agentId || data.from || activeAgentRef.current),
            agentName: String(data.agentName || data.from || "Agent"),
            content: String(data.content || data.text || ""),
            timestamp: new Date(),
          };
          setMessages((prev) => [...prev, newMsg]);
        } else if (data.type === "stream_token") {
          setMessages((prev) => {
            const last = prev[prev.length - 1];
            if (last?.role === "agent" && last.streaming) {
              return [
                ...prev.slice(0, -1),
                { ...last, content: last.content + String(data.token || "") },
              ];
            }
            return [
              ...prev,
              {
                id: String(data.id || Date.now()),
                role: "agent" as const,
                agentId: String(data.agentId || activeAgentRef.current),
                agentName: String(data.agentName || "Agent"),
                content: String(data.token || ""),
                timestamp: new Date(),
                streaming: true,
              },
            ];
          });
        } else if (data.type === "stream_end") {
          setMessages((prev) => {
            const last = prev[prev.length - 1];
            if (last?.streaming) {
              return [...prev.slice(0, -1), { ...last, streaming: false }];
            }
            return prev;
          });
        }
      } catch {
        // Ignore non-JSON SSE messages (e.g., heartbeat comments)
      }
    };

    es.onerror = () => {
      setStatus("disconnected");
      // EventSource auto-reconnects by default
    };

    return () => {
      es.close();
      eventSourceRef.current = null;
      setStatus("disconnected");
    };
  }, [activeAgent, businessId]);

  // REST mutation for sending messages
  const sendMutation = useMutation({
    mutationFn: (body: { agentId: string; message: string; businessId: string }) =>
      api.sendChatMessage(body),
  });

  const sendMessage = useCallback(
    (content: string) => {
      if (!content.trim()) return;

      // Add user message to local state immediately
      const userMsg: ChatMessage = {
        id: String(Date.now()),
        role: "user",
        content: content.trim(),
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, userMsg]);

      // Send via REST API
      sendMutation.mutate({
        agentId: activeAgent,
        message: content.trim(),
        businessId,
      });
    },
    [activeAgent, businessId, sendMutation],
  );

  const clearMessages = useCallback(() => {
    setMessages([]);
  }, []);

  return {
    messages,
    status,
    activeAgent,
    setActiveAgent,
    sendMessage,
    clearMessages,
    isSending: sendMutation.isPending,
  };
}
