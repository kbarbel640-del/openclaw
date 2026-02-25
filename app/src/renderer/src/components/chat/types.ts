export type ContentBlock =
  | { kind: "text"; value: string }
  | { kind: "scenario-bar"; name: string; filled: number; total: number; count: number }
  | { kind: "spec"; rows: Array<{ label: string; value: string; accent?: boolean }> }
  | { kind: "stat"; value: string; label: string };

export interface ChatMessage {
  id: string;
  type: "sophie" | "user" | "progress" | "flag" | "question";
  content: string;
  timestamp: string;
  data?: Record<string, unknown>;
  blocks?: ContentBlock[];
}

export interface FlagData {
  filename: string;
  scenario: string;
  confidence: number;
  confidenceLabel: string;
  reason: string;
  thumbnailUrl?: string;
}

export interface QuestionData {
  options: string[];
}

export interface ProgressData {
  current: number;
  total: number;
  flagged: number;
  eta: string;
}

export function formatTimestamp(iso: string): string {
  const d = new Date(iso);
  const h = d.getHours().toString().padStart(2, "0");
  const m = d.getMinutes().toString().padStart(2, "0");
  const s = d.getSeconds().toString().padStart(2, "0");
  return `${h}:${m}:${s}`;
}

export function makeId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}
