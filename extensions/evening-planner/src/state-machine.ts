import { parseShubhamReply } from "./parse-reply.js";
import type {
  EveningAvailability,
  PlannerSessionState,
  ShubhamState,
  TimelineEntry,
} from "./types.js";

export type CreateSessionParams = {
  id: string;
  conversationId: string;
  nowMs: number;
  timeoutSec: number;
  maxTurns: number;
  userDisplayName?: string;
  shubham: {
    senderId?: string;
    username?: string;
    displayName: string;
  };
};

export type ApplyReplyResult = {
  state: PlannerSessionState;
  nextPrompt?: string;
  resolved: boolean;
  summary: string;
};

function timeline(step: string, state: TimelineEntry["state"], note?: string): TimelineEntry {
  return {
    ts: Date.now(),
    step,
    state,
    note,
  };
}

function withUpdated<T extends PlannerSessionState>(state: T): T {
  state.updatedAtMs = Date.now();
  return state;
}

function setAvailability(target: ShubhamState, value: EveningAvailability, confidence: number) {
  target.availability = value;
  target.confidence = Math.max(target.confidence, confidence);
}

function followUpForAvailability(state: PlannerSessionState): string {
  const name = state.shubham.displayName || "Shubham";
  return `${name}, quick confirm karo: aa rahe ho ya nahi? Agar aa rahe ho to ETA minutes me bhejo (example: yes 20 min).`;
}

function followUpForEta(state: PlannerSessionState): string {
  const name = state.shubham.displayName || "Shubham";
  return `${name}, approx kitne minute late hoge?`;
}

function followUpForMaybe(state: PlannerSessionState): string {
  const name = state.shubham.displayName || "Shubham";
  return `${name}, final confirm chahiye for booking: aa rahe ho (yes + ETA) ya nahi aa paoge (no).`;
}

export function createPlannerSession(params: CreateSessionParams): PlannerSessionState {
  return {
    id: params.id,
    conversationId: params.conversationId,
    createdAtMs: params.nowMs,
    updatedAtMs: params.nowMs,
    status: "active",
    userDisplayName: params.userDisplayName,
    shubham: {
      senderId: params.shubham.senderId,
      username: params.shubham.username,
      displayName: params.shubham.displayName,
      availability: "unknown",
      confidence: 0,
      followUpsAsked: 0,
    },
    negotiation: {
      maxTurns: Math.max(1, params.maxTurns),
      timeoutAtMs: params.nowMs + Math.max(15, params.timeoutSec) * 1000,
    },
    bookingResult: {
      status: "none",
    },
    timeline: [
      timeline("collect_preferences", "done"),
      timeline("coordinate_with_shubham", "running", "session_started"),
      timeline("booking_confirmation", "pending"),
      timeline("booking_execution", "pending"),
    ],
  };
}

export function markPromptSent(
  state: PlannerSessionState,
  prompt: string,
  nowMs: number,
  countsAsFollowUp = true,
): PlannerSessionState {
  state.negotiation.lastPrompt = prompt;
  state.negotiation.lastPromptAtMs = nowMs;
  if (countsAsFollowUp) {
    state.shubham.followUpsAsked += 1;
  }
  state.timeline.push(timeline("coordinate_with_shubham", "running", "prompt_sent"));
  return withUpdated(state);
}

function resolveWithSummary(
  state: PlannerSessionState,
  summary: string,
  status: PlannerSessionState["status"] = "awaiting_confirmation",
): ApplyReplyResult {
  state.status = status;
  state.timeline.push(timeline("coordinate_with_shubham", status === "timed_out" ? "fallback" : "done"));
  state.timeline.push(timeline("booking_confirmation", "running", "awaiting_user_confirmation"));
  withUpdated(state);
  return {
    state,
    resolved: true,
    summary,
  };
}

export function applyShubhamReply(
  input: PlannerSessionState,
  messageText: string,
  nowMs: number,
): ApplyReplyResult {
  const state: PlannerSessionState = {
    ...input,
    shubham: { ...input.shubham },
    negotiation: { ...input.negotiation },
    timeline: [...input.timeline],
  };

  state.shubham.lastMessage = messageText;
  state.shubham.lastMessageAtMs = nowMs;

  const parsed = parseShubhamReply(messageText);
  if (parsed.availability !== "unknown") {
    setAvailability(state.shubham, parsed.availability, parsed.confidence);
  }
  if (typeof parsed.etaMinutes === "number") {
    state.shubham.etaMinutes = parsed.etaMinutes;
  }

  const turnLimitReached = state.shubham.followUpsAsked >= state.negotiation.maxTurns;

  if (state.shubham.availability === "no") {
    return resolveWithSummary(state, `${state.shubham.displayName} cannot join. Fallback to solo booking.`);
  }

  if (state.shubham.availability === "yes") {
    if (typeof state.shubham.etaMinutes === "number") {
      return resolveWithSummary(
        state,
        `${state.shubham.displayName} will join and is ~${state.shubham.etaMinutes} min late.`,
      );
    }
    if (!turnLimitReached) {
      return {
        state: withUpdated(state),
        nextPrompt: followUpForEta(state),
        resolved: false,
        summary: "eta_requested",
      };
    }
    return resolveWithSummary(state, `${state.shubham.displayName} will join. ETA not confirmed.`, "awaiting_confirmation");
  }

  if (state.shubham.availability === "maybe") {
    if (!turnLimitReached) {
      return {
        state: withUpdated(state),
        nextPrompt: followUpForMaybe(state),
        resolved: false,
        summary: "final_confirmation_requested",
      };
    }
    setAvailability(state.shubham, "no", Math.max(state.shubham.confidence, 0.6));
    return resolveWithSummary(
      state,
      `${state.shubham.displayName} could not confirm in time. Using deterministic fallback: solo booking.`,
      "timed_out",
    );
  }

  if (!turnLimitReached) {
    return {
      state: withUpdated(state),
      nextPrompt: followUpForAvailability(state),
      resolved: false,
      summary: "availability_requested",
    };
  }

  setAvailability(state.shubham, "no", Math.max(state.shubham.confidence, 0.6));
  return resolveWithSummary(
    state,
    `${state.shubham.displayName} response unresolved in time. Using deterministic fallback: solo booking.`,
    "timed_out",
  );
}

export function applyTimeoutFallback(
  input: PlannerSessionState,
  nowMs: number,
): { changed: boolean; state: PlannerSessionState; summary?: string } {
  if (input.status !== "active" || nowMs < input.negotiation.timeoutAtMs) {
    return { changed: false, state: input };
  }
  const state: PlannerSessionState = {
    ...input,
    shubham: { ...input.shubham },
    timeline: [...input.timeline],
  };
  setAvailability(state.shubham, "no", Math.max(state.shubham.confidence, 0.6));
  state.status = "timed_out";
  state.timeline.push(timeline("coordinate_with_shubham", "fallback", "timeout"));
  state.timeline.push(timeline("booking_confirmation", "running", "awaiting_user_confirmation"));
  withUpdated(state);
  return {
    changed: true,
    state,
    summary: `${state.shubham.displayName} did not reply in time. Fallback to solo booking.`,
  };
}

export function recommendedSeats(state: PlannerSessionState): number {
  return state.shubham.availability === "yes" ? 2 : 1;
}

export function isSessionActive(state: PlannerSessionState): boolean {
  return state.status === "active";
}
