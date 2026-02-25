/**
 * Sophie's conversation types — message formats, intents, and state.
 */

export type MessageRole = "sophie" | "user" | "system";

export type MessageType =
  | "text"
  | "image_flag"
  | "session_card"
  | "progress_update"
  | "question_card";

export interface SophieMessage {
  id: string;
  role: MessageRole;
  type: MessageType;
  content: string;
  timestamp: string;
  metadata?: Record<string, unknown>;
}

export interface ImageFlagMessage extends SophieMessage {
  type: "image_flag";
  metadata: {
    imagePath: string;
    imageId: string;
    scenario: string;
    confidence: number;
    reason: string;
    suggestedAdjustments?: Record<string, number>;
  };
}

export interface SessionCardMessage extends SophieMessage {
  type: "session_card";
  metadata: {
    action: "started" | "completed" | "paused" | "resumed";
    totalImages?: number;
    completedImages?: number;
    flaggedImages?: number;
    elapsedMs?: number;
    scenariosUsed?: string[];
  };
}

export interface ProgressUpdateMessage extends SophieMessage {
  type: "progress_update";
  metadata: {
    completed: number;
    total: number;
    flagged: number;
    currentImage?: string;
    currentScenario?: string;
    etaMs?: number;
  };
}

export interface QuestionCardMessage extends SophieMessage {
  type: "question_card";
  metadata: {
    questionId: string;
    options: Array<{ label: string; value: string }>;
  };
}

/**
 * Parsed intent from a user message.
 */
export type UserIntent =
  | { type: "start_editing"; params: StartEditingParams }
  | { type: "stop_editing" }
  | { type: "pause_editing" }
  | { type: "resume_editing" }
  | { type: "start_learning"; params: StartLearningParams }
  | { type: "toggle_observation"; enabled: boolean }
  | { type: "show_progress" }
  | { type: "show_flagged" }
  | { type: "show_profile"; scenario?: string }
  | { type: "adjust_style"; params: AdjustStyleParams }
  | { type: "flag_action"; params: FlagActionParams }
  | { type: "question"; text: string }
  | { type: "greeting" }
  | { type: "unknown"; text: string };

export interface StartEditingParams {
  targetCount?: number;
  skipScenarios?: string[];
  onlyScenarios?: string[];
  cullFirst?: boolean;
}

export interface StartLearningParams {
  catalogPath?: string;
  reingest?: boolean;
}

export interface AdjustStyleParams {
  scenario?: string;
  adjustments: Record<string, string>;
}

export interface FlagActionParams {
  imageId: string;
  action: "approve" | "edit_manually" | "skip";
}

/**
 * Sophie's internal state for a conversation session.
 */
export interface SophieState {
  conversationId: string;
  messages: SophieMessage[];
  activeSession: ActiveSessionState | null;
  learningActive: boolean;
  observing: boolean;
}

export interface ActiveSessionState {
  sessionId: string;
  totalImages: number;
  completedImages: number;
  flaggedImages: number;
  startedAt: string;
  status: "running" | "paused" | "completing";
  currentImage?: string;
  currentScenario?: string;
}
