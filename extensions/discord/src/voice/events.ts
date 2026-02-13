import { randomUUID } from "node:crypto";
import type { NormalizedEvent } from "../../../voice-call/src/types.js";
import type { VoiceChannelSession, TranscriptEntry } from "./types.js";

/**
 * Maps Discord voice channel events into the NormalizedEvent schema used by
 * the voice-call extension, allowing the rest of the system to treat Discord
 * voice sessions like any other call provider.
 *
 * Discord sessions use the guildId as the "callId" for correlation.
 */

function baseEvent(session: VoiceChannelSession) {
  return {
    id: randomUUID(),
    callId: session.sessionId,
    providerCallId: `discord-${session.guildId}-${session.channelId}`,
    timestamp: Date.now(),
    direction: "inbound" as const,
  };
}

export function createInitiatedEvent(session: VoiceChannelSession): NormalizedEvent {
  return {
    ...baseEvent(session),
    type: "call.initiated",
    from: `discord:channel:${session.channelId}`,
    to: `discord:guild:${session.guildId}`,
  };
}

export function createActiveEvent(session: VoiceChannelSession): NormalizedEvent {
  return {
    ...baseEvent(session),
    type: "call.active",
  };
}

export function createSpeechEvent(
  session: VoiceChannelSession,
  transcript: string,
  isFinal: boolean,
  confidence?: number,
): NormalizedEvent {
  return {
    ...baseEvent(session),
    type: "call.speech",
    transcript,
    isFinal,
    confidence,
  };
}

export function createSpeakingEvent(session: VoiceChannelSession, text: string): NormalizedEvent {
  return {
    ...baseEvent(session),
    type: "call.speaking",
    text,
  };
}

export function createSilenceEvent(
  session: VoiceChannelSession,
  durationMs: number,
): NormalizedEvent {
  return {
    ...baseEvent(session),
    type: "call.silence",
    durationMs,
  };
}

export function createEndedEvent(
  session: VoiceChannelSession,
  reason: "completed" | "hangup-user" | "hangup-bot" | "error" = "completed",
): NormalizedEvent {
  return {
    ...baseEvent(session),
    type: "call.ended",
    reason,
  };
}

export function createErrorEvent(
  session: VoiceChannelSession,
  error: string,
  retryable?: boolean,
): NormalizedEvent {
  return {
    ...baseEvent(session),
    type: "call.error",
    error,
    retryable,
  };
}

/**
 * Converts a Discord VoiceChannelSession TranscriptEntry into a NormalizedEvent.
 * Useful for replaying transcripts through the event pipeline.
 */
export function transcriptEntryToEvent(
  session: VoiceChannelSession,
  entry: TranscriptEntry,
): NormalizedEvent {
  if (entry.speaker === "bot") {
    return createSpeakingEvent(session, entry.text);
  }
  return createSpeechEvent(session, entry.text, entry.isFinal);
}
