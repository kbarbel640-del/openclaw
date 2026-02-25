/**
 * Sophie's Brain — the core conversation engine.
 *
 * Routes user messages to the appropriate backend modules and generates
 * Sophie's responses. This is the bridge between the UI and the engine.
 */

import { randomUUID } from "node:crypto";
import type { StyleDatabase, ScenarioProfile } from "../learning/style-db.js";
import { parseIntent } from "./intent-parser.js";
import type {
  SophieMessage,
  SophieState,
  UserIntent,
  ActiveSessionState,
  MessageType,
} from "./types.js";

export interface SophieBrainDeps {
  styleDb: StyleDatabase;
  onStartEditing?: (params: UserIntent & { type: "start_editing" }) => void;
  onStopEditing?: () => void;
  onPauseEditing?: () => void;
  onResumeEditing?: () => void;
  onStartLearning?: (params: UserIntent & { type: "start_learning" }) => void;
  onToggleObservation?: (enabled: boolean) => void;
  onFlagAction?: (imageId: string, action: string) => void;
}

/**
 * Sophie's conversational brain. Processes user messages, maintains
 * conversation state, and generates contextual responses.
 */
export class SophieBrain {
  private state: SophieState;
  private deps: SophieBrainDeps;

  constructor(deps: SophieBrainDeps) {
    this.deps = deps;
    this.state = {
      conversationId: randomUUID(),
      messages: [],
      activeSession: null,
      learningActive: false,
      observing: false,
    };
  }

  getState(): SophieState {
    return { ...this.state };
  }

  getMessages(): SophieMessage[] {
    return [...this.state.messages];
  }

  /**
   * Process a user message and return Sophie's response(s).
   */
  async processMessage(text: string): Promise<SophieMessage[]> {
    const userMsg = this.createMessage("user", "text", text);
    this.state.messages.push(userMsg);

    const intent = parseIntent(text);
    const responses = await this.handleIntent(intent);

    for (const msg of responses) {
      this.state.messages.push(msg);
    }

    return responses;
  }

  /**
   * Push a system-generated message (progress update, flag, etc.)
   * without user input.
   */
  pushUpdate(
    type: MessageType,
    content: string,
    metadata?: Record<string, unknown>,
  ): SophieMessage {
    const msg = this.createMessage("sophie", type, content, metadata);
    this.state.messages.push(msg);
    return msg;
  }

  /**
   * Update the active session state (called by the editing loop).
   */
  updateSession(update: Partial<ActiveSessionState>): void {
    if (this.state.activeSession) {
      Object.assign(this.state.activeSession, update);
    }
  }

  /**
   * Mark the session as started.
   */
  startSession(sessionId: string, totalImages: number): void {
    this.state.activeSession = {
      sessionId,
      totalImages,
      completedImages: 0,
      flaggedImages: 0,
      startedAt: new Date().toISOString(),
      status: "running",
    };
  }

  /**
   * Mark the session as complete.
   */
  endSession(): ActiveSessionState | null {
    const session = this.state.activeSession;
    this.state.activeSession = null;
    return session;
  }

  private async handleIntent(intent: UserIntent): Promise<SophieMessage[]> {
    switch (intent.type) {
      case "greeting":
        return [this.respondGreeting()];

      case "start_editing":
        return this.handleStartEditing(intent);

      case "stop_editing":
        return this.handleStopEditing();

      case "pause_editing":
        return this.handlePauseEditing();

      case "resume_editing":
        return this.handleResumeEditing();

      case "start_learning":
        return this.handleStartLearning(intent);

      case "toggle_observation":
        return this.handleToggleObservation(intent.enabled);

      case "show_progress":
        return [this.respondProgress()];

      case "show_flagged":
        return [this.respondFlagged()];

      case "show_profile":
        return [this.respondProfile(intent.scenario)];

      case "adjust_style":
        return [this.respondStyleAdjust(intent.params.adjustments, intent.params.scenario)];

      case "flag_action":
        return this.handleFlagAction(intent.params.imageId, intent.params.action);

      case "question":
        return [this.respondQuestion(intent.text)];

      case "unknown":
        return [this.respondUnknown(intent.text)];
    }
  }

  private respondGreeting(): SophieMessage {
    const editCount = this.deps.styleDb.getEditCount();
    const scenarios = this.deps.styleDb.listScenarios();

    if (editCount === 0) {
      return this.createMessage(
        "sophie",
        "text",
        "Hey! I'm Sophie, your AI photo editor. I don't know your style yet — " +
          'want me to study your Lightroom catalog? Just say "learn" and point me ' +
          "at your catalog, or start editing and I'll watch and learn as you go.",
      );
    }

    const topScenarios = scenarios
      .slice(0, 3)
      .map((s) => s.label)
      .join(", ");
    return this.createMessage(
      "sophie",
      "text",
      `Hey! I've studied ${editCount.toLocaleString()} of your edits across ` +
        `${scenarios.length} scenarios. Your strongest profiles are ${topScenarios}. ` +
        `What are we working on?`,
    );
  }

  private handleStartEditing(intent: UserIntent & { type: "start_editing" }): SophieMessage[] {
    if (this.state.activeSession?.status === "running") {
      return [
        this.createMessage(
          "sophie",
          "text",
          "I'm already editing — " +
            `${this.state.activeSession.completedImages}/${this.state.activeSession.totalImages} done. ` +
            "Want me to stop the current session first?",
        ),
      ];
    }

    const editCount = this.deps.styleDb.getEditCount();
    if (editCount < 10) {
      return [
        this.createMessage(
          "sophie",
          "text",
          `I only have ${editCount} edits in my profile — that's not enough to be confident. ` +
            'I\'d recommend letting me study your catalog first (say "learn"), or edit ' +
            "a few dozen photos while I watch so I can learn your style.",
        ),
      ];
    }

    const { params } = intent;
    const parts: string[] = [];

    if (params.targetCount) {
      parts.push(`targeting ${params.targetCount.toLocaleString()} images`);
    }
    if (params.skipScenarios?.length) {
      parts.push(`skipping ${params.skipScenarios.join(", ")} shots`);
    }
    if (params.cullFirst) {
      parts.push("culling first");
    }

    const detail = parts.length > 0 ? ` — ${parts.join(", ")}` : "";

    this.deps.onStartEditing?.(intent);

    return [
      this.createMessage(
        "sophie",
        "text",
        `Got it, starting up${detail}. I'll flag anything I'm not confident about.`,
      ),
    ];
  }

  private handleStopEditing(): SophieMessage[] {
    if (!this.state.activeSession) {
      return [
        this.createMessage("sophie", "text", "No active session to stop. Want to start one?"),
      ];
    }

    const session = this.state.activeSession;
    this.deps.onStopEditing?.();

    return [
      this.createMessage(
        "sophie",
        "session_card",
        `Session stopped. ${session.completedImages}/${session.totalImages} edited, ` +
          `${session.flaggedImages} flagged for your review.`,
        {
          action: "completed",
          totalImages: session.totalImages,
          completedImages: session.completedImages,
          flaggedImages: session.flaggedImages,
        },
      ),
    ];
  }

  private handlePauseEditing(): SophieMessage[] {
    if (!this.state.activeSession || this.state.activeSession.status !== "running") {
      return [this.createMessage("sophie", "text", "Nothing running to pause right now.")];
    }

    this.state.activeSession.status = "paused";
    this.deps.onPauseEditing?.();

    return [
      this.createMessage(
        "sophie",
        "text",
        `Paused at ${this.state.activeSession.completedImages}/${this.state.activeSession.totalImages}. ` +
          'Say "continue" when you\'re ready.',
      ),
    ];
  }

  private handleResumeEditing(): SophieMessage[] {
    if (!this.state.activeSession || this.state.activeSession.status !== "paused") {
      return [
        this.createMessage(
          "sophie",
          "text",
          "Nothing paused to resume. Want to start a new session?",
        ),
      ];
    }

    this.state.activeSession.status = "running";
    this.deps.onResumeEditing?.();

    return [
      this.createMessage(
        "sophie",
        "text",
        `Resuming from ${this.state.activeSession.completedImages}/${this.state.activeSession.totalImages}. ` +
          "Back at it.",
      ),
    ];
  }

  private handleStartLearning(intent: UserIntent & { type: "start_learning" }): SophieMessage[] {
    this.state.learningActive = true;
    this.deps.onStartLearning?.(intent);

    return [
      this.createMessage(
        "sophie",
        "text",
        "Studying your catalog now. This might take a few minutes depending on how many " +
          "edited photos you have. I'll let you know what I find.",
      ),
    ];
  }

  private handleToggleObservation(enabled: boolean): SophieMessage[] {
    this.state.observing = enabled;
    this.deps.onToggleObservation?.(enabled);

    if (enabled) {
      return [
        this.createMessage(
          "sophie",
          "text",
          "Watching mode on. I'll quietly observe your edits and learn from them. " +
            "Just edit normally — I won't interfere.",
        ),
      ];
    }

    return [
      this.createMessage("sophie", "text", "Watching mode off. I'll stop observing your edits."),
    ];
  }

  private respondProgress(): SophieMessage {
    if (!this.state.activeSession) {
      return this.createMessage(
        "sophie",
        "text",
        "No active session right now. Want to start one?",
      );
    }

    const s = this.state.activeSession;
    const pct = Math.round((s.completedImages / s.totalImages) * 100);
    const scenarioNote = s.currentScenario
      ? ` Currently working on a ${s.currentScenario} shot.`
      : "";

    return this.createMessage(
      "sophie",
      "progress_update",
      `${s.completedImages}/${s.totalImages} done (${pct}%). ` +
        `${s.flaggedImages} flagged for your review.${scenarioNote}`,
      {
        completed: s.completedImages,
        total: s.totalImages,
        flagged: s.flaggedImages,
        currentImage: s.currentImage,
        currentScenario: s.currentScenario,
      },
    );
  }

  private respondFlagged(): SophieMessage {
    if (!this.state.activeSession) {
      return this.createMessage(
        "sophie",
        "text",
        "No active session. Start editing and I'll flag anything I'm unsure about.",
      );
    }

    const count = this.state.activeSession.flaggedImages;
    if (count === 0) {
      return this.createMessage(
        "sophie",
        "text",
        "Nothing flagged so far — I've been confident on everything. That's a good sign.",
      );
    }

    return this.createMessage(
      "sophie",
      "text",
      `${count} images flagged for your review. Check the Edit tab to see them with my notes on each one.`,
    );
  }

  private respondProfile(scenarioHint?: string): SophieMessage {
    const scenarios = this.deps.styleDb.listScenarios();

    if (scenarios.length === 0) {
      return this.createMessage(
        "sophie",
        "text",
        'I haven\'t learned your style yet. Let me study your catalog first — say "learn."',
      );
    }

    if (scenarioHint) {
      const match = scenarios.find(
        (s) => s.key.includes(scenarioHint) || s.label.toLowerCase().includes(scenarioHint),
      );

      if (match) {
        const profile = this.deps.styleDb.getProfile(match.key);
        if (profile) {
          return this.createMessage("sophie", "text", this.formatProfileSummary(profile));
        }
      }

      return this.createMessage(
        "sophie",
        "text",
        `I don't have enough data for "${scenarioHint}" scenarios yet. ` +
          `I have profiles for: ${scenarios
            .slice(0, 5)
            .map((s) => s.label)
            .join(", ")}.`,
      );
    }

    const topScenarios = scenarios.slice(0, 5);
    const lines = topScenarios.map((s) => `  ${s.label}: ${s.sampleCount} samples`);

    return this.createMessage(
      "sophie",
      "text",
      `Your editing DNA across ${scenarios.length} scenarios:\n\n` +
        lines.join("\n") +
        "\n\nAsk about a specific scenario for the full breakdown, or check the DNA tab.",
    );
  }

  private respondStyleAdjust(
    adjustments: Record<string, string>,
    scenario?: string,
  ): SophieMessage {
    const changes = Object.entries(adjustments)
      .map(([control, dir]) => `${dir === "+" ? "increase" : "decrease"} ${control}`)
      .join(", ");

    const scope = scenario ? ` for ${scenario} shots` : " across the board";

    return this.createMessage(
      "sophie",
      "text",
      `Got it — I'll ${changes}${scope}. ` +
        "I'll apply this to the rest of the current batch and update my profile for next time.",
    );
  }

  private handleFlagAction(imageId: string, action: string): SophieMessage[] {
    this.deps.onFlagAction?.(imageId, action);

    const responses: Record<string, string> = {
      approve: `Noted — keeping my edit on ${imageId}. I'll remember this for similar shots.`,
      edit_manually: `Leaving ${imageId} for you to handle. I'll watch what you do and learn from it.`,
      skip: `Skipping ${imageId}. Moving on.`,
    };

    return [
      this.createMessage(
        "sophie",
        "text",
        responses[action] ?? `Action "${action}" applied to ${imageId}.`,
      ),
    ];
  }

  private respondQuestion(text: string): SophieMessage {
    const editCount = this.deps.styleDb.getEditCount();
    const scenarios = this.deps.styleDb.listScenarios();

    if (/\b(?:who|what)\s+are\s+you\b/i.test(text)) {
      return this.createMessage(
        "sophie",
        "text",
        "I'm Sophie, your AI photo editor. I learn how you edit by studying your " +
          "Lightroom catalog and watching you work, then I edit new photos the way " +
          "you would. I flag anything I'm not sure about.",
      );
    }

    if (/\b(?:how\s+(?:do|does)\s+(?:you|this)\s+work|how\s+does\s+this\s+work)\b/i.test(text)) {
      return this.createMessage(
        "sophie",
        "text",
        "I study your past edits to build a profile of your style — what you typically " +
          "do for different types of photos (golden hour portraits, indoor flash, etc.). " +
          "When you tell me to edit, I classify each photo, look up your profile for that " +
          "scenario, and apply your style with per-image refinement. If I'm not confident, " +
          "I flag it for you.",
      );
    }

    if (/\b(?:ready|confident|good\s+enough)\b/i.test(text)) {
      if (editCount < 50) {
        return this.createMessage(
          "sophie",
          "text",
          `I have ${editCount} edits in my profile. That's thin — I'd want at least 50-100 ` +
            "before I'm confident across different scenarios. I can still edit, but expect " +
            "more flagged images.",
        );
      }

      const weakScenarios = scenarios.filter((s) => s.sampleCount < 10);
      if (weakScenarios.length > 0) {
        const weak = weakScenarios
          .slice(0, 3)
          .map((s) => s.label)
          .join(", ");
        return this.createMessage(
          "sophie",
          "text",
          `I'm solid on most scenarios, but thin on: ${weak}. ` +
            "I'll flag those more aggressively. Otherwise, I'm ready.",
        );
      }

      return this.createMessage(
        "sophie",
        "text",
        `${editCount.toLocaleString()} edits across ${scenarios.length} scenarios — I'm ready. ` +
          "Point me at a set and I'll get to work.",
      );
    }

    return this.createMessage(
      "sophie",
      "text",
      "I'm not sure I follow. You can ask me to edit photos, learn your style, " +
        "show your profile, or check on progress. What do you need?",
    );
  }

  private respondUnknown(text: string): SophieMessage {
    if (text.length < 3) {
      return this.createMessage("sophie", "text", "Hmm?");
    }

    return this.createMessage(
      "sophie",
      "text",
      "I'm not sure what you mean. Here's what I can do:\n\n" +
        '  "Go edit" — Start an editing session\n' +
        '  "Learn" — Study your Lightroom catalog\n' +
        '  "Watch me edit" — Learn from your live editing\n' +
        '  "How\'s it going?" — Check progress\n' +
        '  "Show flagged" — See images I flagged\n' +
        '  "Show my style" — See your editing profile\n' +
        '  "Make it warmer" — Adjust my approach',
    );
  }

  private formatProfileSummary(profile: ScenarioProfile): string {
    const lines: string[] = [`${profile.scenarioLabel} (${profile.sampleCount} samples):`, ""];

    const sorted = Object.values(profile.adjustments)
      .filter((a) => Math.abs(a.mean) > 0.5)
      .toSorted((a, b) => Math.abs(b.mean) - Math.abs(a.mean));

    for (const adj of sorted.slice(0, 8)) {
      const dir = adj.mean > 0 ? "+" : "";
      const variance = adj.stdDev > Math.abs(adj.mean) * 0.5 ? " (varies)" : "";
      lines.push(`  ${adj.control}: ${dir}${adj.mean.toFixed(1)}${variance}`);
    }

    if (profile.correlations.length > 0) {
      lines.push("");
      lines.push("Patterns I've noticed:");
      for (const corr of profile.correlations.slice(0, 3)) {
        const dir = corr.correlation > 0 ? "up together" : "opposite directions";
        lines.push(
          `  ${corr.controlA} + ${corr.controlB}: move ${dir} (r=${corr.correlation.toFixed(2)})`,
        );
      }
    }

    return lines.join("\n");
  }

  private createMessage(
    role: "sophie" | "user" | "system",
    type: MessageType,
    content: string,
    metadata?: Record<string, unknown>,
  ): SophieMessage {
    return {
      id: randomUUID(),
      role,
      type,
      content,
      timestamp: new Date().toISOString(),
      metadata,
    };
  }
}
