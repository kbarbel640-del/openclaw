import { useEffect, useCallback, useRef } from "react";

type SendChannel =
  | "user:message"
  | "session:start"
  | "session:control"
  | "learn:start"
  | "learn:observe"
  | "flag:action";

type ReceiveChannel =
  | "sophie:message"
  | "session:progress"
  | "session:flag"
  | "session:complete"
  | "learn:status"
  | "profile:data";

type InvokeChannel = "sophie:query" | "sophie:state" | "profile:get" | "session:list";

function getSophieAPI() {
  if (typeof window !== "undefined" && window.sophie) {
    return window.sophie;
  }
  return null;
}

export function useIPCSend() {
  return useCallback((channel: SendChannel, data: unknown) => {
    const api = getSophieAPI();
    if (api) {
      api.send(channel, data);
    }
  }, []);
}

export function useIPCOn(channel: ReceiveChannel, callback: (...args: unknown[]) => void) {
  const callbackRef = useRef(callback);
  callbackRef.current = callback;

  useEffect(() => {
    const api = getSophieAPI();
    if (!api) {
      return;
    }

    const cleanup = api.on(channel, (...args: unknown[]) => {
      callbackRef.current(...args);
    });

    return cleanup;
  }, [channel]);
}

export function useIPCInvoke() {
  return useCallback(
    async <T = unknown>(channel: InvokeChannel, data?: unknown): Promise<T | null> => {
      const api = getSophieAPI();
      if (!api) {
        return null;
      }
      try {
        const result = await api.invoke(channel, data);
        return result as T;
      } catch {
        console.error(`IPC invoke failed: ${channel}`);
        return null;
      }
    },
    [],
  );
}
