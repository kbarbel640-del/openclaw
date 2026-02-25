import { useState, useCallback } from "react";
import { useIPCSend, useIPCOn, useIPCInvoke } from "./useIPC";

export interface SessionProgress {
  current: number;
  total: number;
  flagged: number;
  eta: string;
  scenario?: string;
  confidence?: number;
}

export interface SessionRecord {
  id: string;
  name: string;
  date: string;
  edited: number;
  flagged: number;
  duration: string;
}

export function useSession() {
  const [progress, setProgress] = useState<SessionProgress | null>(null);
  const [isActive, setIsActive] = useState(false);
  const send = useIPCSend();
  const invoke = useIPCInvoke();

  useIPCOn("session:progress", (data: unknown) => {
    setProgress(data as SessionProgress);
  });

  useIPCOn("session:complete", () => {
    setIsActive(false);
    setProgress(null);
  });

  const startSession = useCallback(
    (paths?: string[], options?: Record<string, unknown>) => {
      setIsActive(true);
      send("session:start", { paths, options });
    },
    [send],
  );

  const controlSession = useCallback(
    (action: "pause" | "stop" | "resume") => {
      send("session:control", { action });
      if (action === "stop") {
        setIsActive(false);
        setProgress(null);
      }
    },
    [send],
  );

  const getHistory = useCallback(async () => {
    const result = await invoke<SessionRecord[]>("session:list");
    return result ?? [];
  }, [invoke]);

  return {
    progress,
    isActive,
    startSession,
    controlSession,
    getHistory,
  };
}
