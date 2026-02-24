import { useState, useCallback } from "react";
import { Shell } from "./components/Shell";

export type Section = "chat" | "learn" | "edit" | "dna";

export type SophieStatus = "idle" | "editing" | "learning" | "paused" | "waiting" | "complete";

export interface SessionProgress {
  current: number;
  total: number;
  flagged: number;
  eta: string;
  scenario?: string;
  confidence?: number;
}

export interface AppContextType {
  activeSection: Section;
  setSection: (s: Section) => void;
  status: SophieStatus;
  setStatus: (s: SophieStatus) => void;
  progress: SessionProgress | null;
  setProgress: (p: SessionProgress | null) => void;
}

export function App() {
  const [activeSection, setSection] = useState<Section>("chat");
  const [status, setStatus] = useState<SophieStatus>("idle");
  const [progress, setProgress] = useState<SessionProgress | null>(null);

  const handleSectionChange = useCallback((section: Section) => {
    setSection(section);
  }, []);

  return (
    <Shell
      activeSection={activeSection}
      onSectionChange={handleSectionChange}
      status={status}
      progress={progress}
      onStatusChange={setStatus}
      onProgressChange={setProgress}
    />
  );
}
