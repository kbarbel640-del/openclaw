import { useState, useCallback } from "react";
import { useIPCSend, useIPCOn, useIPCInvoke } from "./useIPC";

export interface SophieMessage {
  id: string;
  type: "sophie" | "user" | "progress" | "flag" | "question";
  content: string;
  timestamp: string;
  data?: Record<string, unknown>;
}

export function useSophie() {
  const [messages, setMessages] = useState<SophieMessage[]>([]);
  const [isThinking, setIsThinking] = useState(false);
  const send = useIPCSend();
  const invoke = useIPCInvoke();

  useIPCOn("sophie:message", (msg: unknown) => {
    const message = msg as SophieMessage;
    setMessages((prev) => [...prev, message]);
    setIsThinking(false);
  });

  const sendMessage = useCallback(
    async (text: string) => {
      const userMsg: SophieMessage = {
        id: crypto.randomUUID(),
        type: "user",
        content: text,
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, userMsg]);
      setIsThinking(true);

      send("user:message", { text });

      const response = await invoke<SophieMessage>("sophie:query", { query: text });
      if (response) {
        setMessages((prev) => [...prev, response]);
        setIsThinking(false);
      }
    },
    [send, invoke],
  );

  const clearMessages = useCallback(() => {
    setMessages([]);
  }, []);

  return {
    messages,
    isThinking,
    sendMessage,
    clearMessages,
  };
}
