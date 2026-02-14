export type EveningAvailability = "unknown" | "yes" | "no" | "maybe";

export type EveningSessionStatus =
  | "active"
  | "awaiting_confirmation"
  | "completed"
  | "timed_out"
  | "cancelled";

export type TimelineState = "pending" | "running" | "done" | "fallback" | "blocked";

export type TimelineEntry = {
  ts: number;
  step: string;
  state: TimelineState;
  note?: string;
};

export type ShubhamState = {
  senderId?: string;
  username?: string;
  displayName: string;
  availability: EveningAvailability;
  etaMinutes?: number;
  confidence: number;
  followUpsAsked: number;
  lastMessage?: string;
  lastMessageAtMs?: number;
};

export type NegotiationState = {
  maxTurns: number;
  timeoutAtMs: number;
  lastPrompt?: string;
  lastPromptAtMs?: number;
};

export type BookingDraft = {
  restaurantId: string;
  restaurantName?: string;
  date: string;
  time: string;
  seats: number;
  preparedAtMs: number;
  command: string[];
};

export type BookingResult = {
  status: "none" | "prepared" | "booked" | "failed";
  mode?: "live" | "fixture";
  details?: unknown;
  error?: string;
  bookedAtMs?: number;
};

export type PlannerSessionState = {
  id: string;
  conversationId: string;
  createdAtMs: number;
  updatedAtMs: number;
  status: EveningSessionStatus;
  userDisplayName?: string;
  shubham: ShubhamState;
  negotiation: NegotiationState;
  bookingDraft?: BookingDraft;
  bookingResult?: BookingResult;
  timeline: TimelineEntry[];
};

export type PlannerStoreFile = {
  version: 1;
  sessions: PlannerSessionState[];
};

export type EveningPlannerConfig = {
  deterministicDemo: boolean;
  telegramAccountId?: string;
  timeoutSec: number;
  maxTurns: number;
  pollingIntervalSec: number;
  swiggy: {
    fixtureMode: boolean;
    command: string;
    timeoutMs: number;
  };
  shubhamDefaults: {
    senderId?: string;
    username?: string;
    displayName: string;
  };
};

