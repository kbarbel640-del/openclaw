export interface SessionProgress {
  current: number;
  total: number;
  flagged: number;
  eta: string;
  scenario?: string;
  confidence?: number;
}

export type SophieStatus = "idle" | "editing" | "learning" | "paused" | "waiting" | "complete";
