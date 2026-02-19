import { Type } from "@sinclair/typebox";

export const ContinuityModeSchema = Type.Union([
  Type.Literal("full"),
  Type.Literal("summary"),
  Type.Literal("key_points"),
]);

export const SessionContinuityConfigSchema = Type.Object({
  enabled: Type.Boolean(),
  inheritMode: Type.Optional(ContinuityModeSchema),
  maxHistoricalSessions: Type.Optional(Type.Integer({ minimum: 1, maximum: 10 })),
  summaryPrompt: Type.Optional(Type.String()),
});

export interface SessionContinuityConfig {
  enabled: boolean;
  inheritMode: "full" | "summary" | "key_points";
  maxHistoricalSessions: number;
  summaryPrompt?: string;
}

export interface HistoricalSession {
  sessionId: string;
  sessionKey: string;
  lastMessage: string;
  summary?: string;
  keyPoints?: string[];
  timestamp: number;
}
