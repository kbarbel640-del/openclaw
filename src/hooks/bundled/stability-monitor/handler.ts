/**
 * Stability Monitor hook handler
 *
 * Provides real-time session health monitoring through:
 * - Entropy tracking (conversation instability detection)
 * - Loop detection (repetitive tool calls)
 * - Topic fixation tracking (perseveration warnings)
 *
 * Injects [MEMORY CONTEXT] block before each agent turn.
 */

import {
  DEFAULT_MEMORY_ALT_FILENAME,
  type WorkspaceBootstrapFile,
} from "../../../agents/workspace.js";
import { createSubsystemLogger } from "../../../logging/subsystem.js";
import { resolveHookConfig } from "../../config.js";
import { isAgentBootstrapEvent, type HookHandler } from "../../hooks.js";

const HOOK_KEY = "stability-monitor";
const MAX_SESSION_STATES = 1000;
const log = createSubsystemLogger("hooks/stability-monitor");

// ============================================================================
// Configuration Types
// ============================================================================

interface EntropyConfig {
  warningThreshold: number;
  criticalThreshold: number;
  sustainedMinutes: number;
  historySize: number;
}

interface LoopDetectionConfig {
  consecutiveToolThreshold: number;
  fileRereadThreshold: number;
  outputRepetitionThreshold: number;
  historySize: number;
}

interface TopicTrackingConfig {
  enabled: boolean;
  windowSize: number;
  fixationThreshold: number;
  minWordLength: number;
  stopWords: string[];
}

interface ContextConfig {
  maxTopics: number;
  maxNotes: number;
}

interface StabilityMonitorConfig {
  entropy: EntropyConfig;
  loopDetection: LoopDetectionConfig;
  topicTracking: TopicTrackingConfig;
  context: ContextConfig;
}

const DEFAULT_CONFIG: StabilityMonitorConfig = {
  entropy: {
    warningThreshold: 0.8,
    criticalThreshold: 1.0,
    sustainedMinutes: 45,
    historySize: 6,
  },
  loopDetection: {
    consecutiveToolThreshold: 5,
    fileRereadThreshold: 3,
    outputRepetitionThreshold: 3,
    historySize: 20,
  },
  topicTracking: {
    enabled: true,
    windowSize: 6,
    fixationThreshold: 3,
    minWordLength: 5,
    stopWords: [],
  },
  context: {
    maxTopics: 5,
    maxNotes: 3,
  },
};

type StabilityMonitorHookConfig = Partial<StabilityMonitorConfig> & {
  enabled?: boolean;
};

function resolveStabilityMonitorConfig(cfg: { hooks?: unknown } | undefined): StabilityMonitorConfig {
  const hookConfig = resolveHookConfig(
    cfg as Parameters<typeof resolveHookConfig>[0],
    HOOK_KEY,
  ) as StabilityMonitorHookConfig | undefined;

  return {
    ...DEFAULT_CONFIG,
    entropy: {
      ...DEFAULT_CONFIG.entropy,
      ...(hookConfig?.entropy ?? {}),
    },
    loopDetection: {
      ...DEFAULT_CONFIG.loopDetection,
      ...(hookConfig?.loopDetection ?? {}),
    },
    topicTracking: {
      ...DEFAULT_CONFIG.topicTracking,
      ...(hookConfig?.topicTracking ?? {}),
    },
    context: {
      ...DEFAULT_CONFIG.context,
      ...(hookConfig?.context ?? {}),
    },
  };
}

// ============================================================================
// Entropy Monitor
// ============================================================================

class EntropyMonitor {
  private config: EntropyConfig;
  private lastScore = 0;
  private sustainedTurns = 0;
  private sustainedStartTs: number | null = null;
  private history: Array<{ score: number; ts: number }> = [];

  constructor(config: Partial<EntropyConfig>) {
    this.config = { ...DEFAULT_CONFIG.entropy, ...config };
  }

  calculate(userMessage: string, assistantMessage: string): number {
    const user = (userMessage || "").toLowerCase();
    const assistant = (assistantMessage || "").toLowerCase();

    let entropy = 0;

    // User corrections increase entropy
    if (this.containsAny(user, ["actually", "correction", "you're wrong", "incorrect", "not quite"])) {
      entropy += 0.4;
    }

    // Emotional escalation
    if (this.containsAny(user, ["concerned", "worried", "breakthrough", "significant"])) {
      entropy += 0.3;
    }

    // Agent uncertainty/contradiction
    if (this.containsAny(assistant, ["both are true", "paradox", "tension", "integrating"])) {
      entropy += 0.2;
    }

    // Agent self-correction
    if (this.containsAny(assistant, ["i realize", "i see now", "i learned", "i understand now"])) {
      entropy += 0.2;
    }

    // Temporal mismatch
    if (this.isTemporalMismatch(user, assistant)) {
      entropy += 0.3;
    }

    this.lastScore = entropy;
    this.trackHistory(entropy);
    return entropy;
  }

  updateSustained(entropyScore: number): { sustained: boolean; turns: number; minutes: number } {
    const threshold = this.config.criticalThreshold * 0.8;
    const sustainedMs = this.config.sustainedMinutes * 60000;

    if (entropyScore > threshold) {
      this.sustainedTurns += 1;
      if (!this.sustainedStartTs) this.sustainedStartTs = Date.now();

      const elapsed = Date.now() - this.sustainedStartTs;
      return {
        sustained: elapsed >= sustainedMs,
        turns: this.sustainedTurns,
        minutes: Math.round(elapsed / 60000),
      };
    }

    this.sustainedTurns = 0;
    this.sustainedStartTs = null;
    return { sustained: false, turns: 0, minutes: 0 };
  }

  getStatusLabel(score: number = this.lastScore): string {
    if (score >= this.config.criticalThreshold) return "critical";
    if (score >= this.config.warningThreshold) return "elevated";
    if (score >= this.config.warningThreshold * 0.5) return "active";
    return "nominal";
  }

  getState() {
    return {
      lastScore: this.lastScore,
      sustainedTurns: this.sustainedTurns,
      sustainedMinutes: this.sustainedStartTs
        ? Math.round((Date.now() - this.sustainedStartTs) / 60000)
        : 0,
    };
  }

  reset() {
    this.lastScore = 0;
    this.sustainedTurns = 0;
    this.sustainedStartTs = null;
    this.history = [];
  }

  private isTemporalMismatch(user: string, assistant: string): boolean {
    const planPatterns = ["planning to", "we will", "going to build", "next we should"];
    const donePatterns = ["already implemented", "currently running", "already done"];
    return planPatterns.some((p) => user.includes(p)) && donePatterns.some((p) => assistant.includes(p));
  }

  private trackHistory(score: number) {
    this.history.push({ score, ts: Date.now() });
    if (this.history.length > this.config.historySize) {
      this.history.shift();
    }
  }

  private containsAny(text: string, patterns: string[]): boolean {
    return patterns.some((pattern) => text.includes(pattern));
  }
}

// ============================================================================
// Loop Detector
// ============================================================================

interface ToolHistoryEntry {
  toolName: string;
  hash: number;
  timestamp: number;
}

interface LoopResult {
  loopDetected: boolean;
  loopType?: string;
  message?: string;
}

class LoopDetector {
  private config: LoopDetectionConfig;
  private toolHistory: ToolHistoryEntry[] = [];
  private fileReadCounts = new Map<string, number>();

  constructor(config: Partial<LoopDetectionConfig>) {
    this.config = { ...DEFAULT_CONFIG.loopDetection, ...config };
  }

  recordAndCheck(
    toolName: string,
    output: string = "",
    params: Record<string, unknown> = {},
  ): LoopResult {
    const hash = this.djb2Hash(output || "");

    this.toolHistory.push({
      toolName: toolName || "unknown",
      hash,
      timestamp: Date.now(),
    });

    if (this.toolHistory.length > this.config.historySize) {
      this.toolHistory.shift();
    }

    // Track file reads
    const filePath = (params.file_path || params.path || params.filePath) as string | undefined;
    if (filePath && this.isReadTool(toolName)) {
      this.fileReadCounts.set(filePath, (this.fileReadCounts.get(filePath) || 0) + 1);
    }

    // Check for loop patterns
    const consecutive = this.checkConsecutive();
    if (consecutive) return consecutive;

    const reread = this.checkFileReread(filePath);
    if (reread) return reread;

    const repeatedOutput = this.checkOutputRepetition();
    if (repeatedOutput) return repeatedOutput;

    return { loopDetected: false };
  }

  reset() {
    this.toolHistory = [];
    this.fileReadCounts.clear();
  }

  private checkConsecutive(): LoopResult | null {
    const recent = this.toolHistory.slice(-this.config.consecutiveToolThreshold);
    if (recent.length < this.config.consecutiveToolThreshold) return null;

    const sameTool = recent.every((entry) => entry.toolName === recent[0].toolName);
    if (!sameTool) return null;

    return {
      loopDetected: true,
      loopType: "consecutive_tool",
      message: `You called '${recent[0].toolName}' ${this.config.consecutiveToolThreshold} times in a row. Step back and reassess.`,
    };
  }

  private checkFileReread(filePath: string | undefined): LoopResult | null {
    if (!filePath) return null;
    const count = this.fileReadCounts.get(filePath) || 0;
    if (count < this.config.fileRereadThreshold) return null;

    return {
      loopDetected: true,
      loopType: "file_reread",
      message: `You re-read '${filePath}' ${count} times. Use the info you already extracted.`,
    };
  }

  private checkOutputRepetition(): LoopResult | null {
    const recent = this.toolHistory.slice(-this.config.outputRepetitionThreshold);
    if (recent.length < this.config.outputRepetitionThreshold) return null;

    const sameHash = recent.every((entry) => entry.hash === recent[0].hash);
    if (!sameHash || recent[0].hash === 0) return null;

    return {
      loopDetected: true,
      loopType: "output_repetition",
      message: `The last ${this.config.outputRepetitionThreshold} tool calls returned identical output. You may be in a loop.`,
    };
  }

  private isReadTool(toolName: string = ""): boolean {
    return ["read_file", "cat", "head", "tail", "read"].includes(toolName);
  }

  private djb2Hash(value: string): number {
    let hash = 5381;
    for (let i = 0; i < value.length; i++) {
      hash = ((hash << 5) + hash + value.charCodeAt(i)) & 0xffffffff;
    }
    return hash;
  }
}

// ============================================================================
// Topic Tracker
// ============================================================================

const DEFAULT_STOPWORDS = new Set([
  "about", "above", "after", "again", "against", "along", "already", "among",
  "another", "around", "because", "before", "being", "between", "could", "during",
  "either", "enough", "every", "first", "going", "having", "include", "instead",
  "itself", "maybe", "might", "other", "quite", "rather", "really", "since",
  "something", "still", "their", "there", "these", "thing", "those", "through",
  "under", "until", "using", "where", "which", "while", "whose", "without",
  "would", "your", "message", "system", "context", "content",
]);

interface TopicData {
  topic: string;
  mentions: number;
  firstSeen: number;
  lastSeen: number;
}

class TopicTracker {
  private config: TopicTrackingConfig;
  private topics = new Map<string, TopicData>();
  private exchangeIndex = 0;
  private stopWords: Set<string>;

  constructor(config: Partial<TopicTrackingConfig>) {
    this.config = { ...DEFAULT_CONFIG.topicTracking, ...config };
    this.stopWords = new Set([...(this.config.stopWords || []), ...DEFAULT_STOPWORDS]);
  }

  track(text: string) {
    if (!this.config.enabled || !text) return;

    this.exchangeIndex += 1;
    this.pruneWindow();

    const tokens = this.extractTopics(text);
    for (const token of tokens) {
      const existing = this.topics.get(token);
      if (existing) {
        existing.mentions += 1;
        existing.lastSeen = this.exchangeIndex;
      } else {
        this.topics.set(token, {
          topic: token,
          mentions: 1,
          firstSeen: this.exchangeIndex,
          lastSeen: this.exchangeIndex,
        });
      }
    }
  }

  getAllTopics(): Array<{ topic: string; mentions: number; lastSeen: number }> {
    const output: Array<{ topic: string; mentions: number; lastSeen: number }> = [];
    for (const data of this.topics.values()) {
      output.push({
        topic: data.topic,
        mentions: data.mentions,
        lastSeen: data.lastSeen,
      });
    }
    output.sort((a, b) => b.mentions - a.mentions);
    return output;
  }

  getFixatedTopics() {
    return this.getAllTopics().filter((t) => t.mentions >= this.config.fixationThreshold);
  }

  formatNotes(maxNotes: number = 3): string {
    const fixated = this.getFixatedTopics();
    if (!fixated.length) return "";

    return fixated
      .slice(0, maxNotes)
      .map((t) => `[TOPIC NOTE] '${t.topic}' has appeared ${t.mentions} times recently.`)
      .join("\n");
  }

  formatSummary(maxTopics: number = 5): string {
    const topics = this.getAllTopics().slice(0, maxTopics);
    if (!topics.length) return "";

    const formatted = topics.map((t) => {
      if (t.mentions >= this.config.fixationThreshold) {
        return `${t.topic} (fixated x${t.mentions})`;
      }
      return `${t.topic} (active)`;
    });

    return `Topics: ${formatted.join(", ")}`;
  }

  reset() {
    this.topics.clear();
    this.exchangeIndex = 0;
  }

  private extractTopics(text: string): string[] {
    const clean = text
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, " ")
      .split(/\s+/)
      .filter((t) => t.length >= this.config.minWordLength)
      .filter((t) => !this.stopWords.has(t));

    const frequencies = new Map<string, number>();
    for (const token of clean) {
      frequencies.set(token, (frequencies.get(token) || 0) + 1);
    }

    const extracted: string[] = [];
    for (const [token, count] of frequencies) {
      if (count >= 2 || this.topics.has(token)) {
        extracted.push(token);
      }
    }

    return extracted;
  }

  private pruneWindow() {
    const minWindow = this.exchangeIndex - this.config.windowSize * 2;
    for (const [topic, data] of this.topics) {
      if (data.lastSeen < minWindow) {
        this.topics.delete(topic);
      }
    }
  }
}

// ============================================================================
// Utilities
// ============================================================================

function formatDuration(ms: number): string {
  const minutes = Math.floor(ms / 60000);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
}

interface Message {
  role: string;
  content: string | Array<{ type: string; text?: string }>;
}

function getLastMessageByRole(messages: Message[], role: string): Message | null {
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role === role) return messages[i];
  }
  return null;
}

function extractText(message: Message | null): string {
  if (!message) return "";
  if (typeof message.content === "string") return message.content;
  if (Array.isArray(message.content)) {
    return message.content
      .filter((block) => block.type === "text")
      .map((block) => block.text || "")
      .join("\n");
  }
  return "";
}

// ============================================================================
// Session State (per-session instances)
// ============================================================================

interface SessionState {
  entropy: EntropyMonitor;
  loopDetector: LoopDetector;
  topicTracker: TopicTracker;
  sessionStartTs: number;
  exchangeCount: number;
  lastLoopWarning: { message: string; timestamp: number } | null;
}

const sessionStates = new Map<string, SessionState>();

function enforceSessionStateLimit(): void {
  while (sessionStates.size > MAX_SESSION_STATES) {
    const oldestSessionKey = sessionStates.keys().next().value;
    if (typeof oldestSessionKey !== "string") {
      break;
    }
    sessionStates.delete(oldestSessionKey);
  }
}

function getOrCreateSessionState(sessionKey: string, config: StabilityMonitorConfig): SessionState {
  let state = sessionStates.get(sessionKey);
  if (!state) {
    state = {
      entropy: new EntropyMonitor(config.entropy),
      loopDetector: new LoopDetector(config.loopDetection),
      topicTracker: new TopicTracker(config.topicTracking),
      sessionStartTs: Date.now(),
      exchangeCount: 0,
      lastLoopWarning: null,
    };
    sessionStates.set(sessionKey, state);
    enforceSessionStateLimit();
  }
  return state;
}

// ============================================================================
// Hook Handler
// ============================================================================

export const handler: HookHandler = async (event) => {
  if (!isAgentBootstrapEvent(event)) {
    return;
  }

  const context = event.context;
  const config = resolveStabilityMonitorConfig(context.cfg);
  const sessionKey = context.sessionKey || event.sessionKey || "unknown";
  const state = getOrCreateSessionState(sessionKey, config);

  state.exchangeCount += 1;

  // Extract messages from bootstrap context
  const messages = (context as unknown as { messages?: Message[] }).messages || [];
  const userMessage = extractText(getLastMessageByRole(messages, "user"));
  const assistantMessage = extractText(getLastMessageByRole(messages, "assistant"));

  // Track topics
  state.topicTracker.track(userMessage);
  state.topicTracker.track(assistantMessage);

  // Calculate entropy
  const entropyScore = state.entropy.calculate(userMessage, assistantMessage);
  state.entropy.updateSustained(entropyScore);
  const entropyState = state.entropy.getState();

  // Build context block
  const lines = ["[MEMORY CONTEXT]"];
  lines.push(
    `Session: ${state.exchangeCount} exchanges | Started: ${formatDuration(Date.now() - state.sessionStartTs)} ago`,
  );
  lines.push(
    `Entropy: ${entropyState.lastScore.toFixed(2)} (${state.entropy.getStatusLabel()}) | Sustained: ${entropyState.sustainedTurns} turns`,
  );

  const topicSummary = state.topicTracker.formatSummary(config.context.maxTopics);
  if (topicSummary) lines.push(topicSummary);

  const topicNotes = state.topicTracker.formatNotes(config.context.maxNotes);
  if (topicNotes) lines.push(topicNotes);

  // Add loop warning if recent
  if (state.lastLoopWarning && Date.now() - state.lastLoopWarning.timestamp < 5 * 60 * 1000) {
    lines.push(`Loop warning: ${state.lastLoopWarning.message}`);
  }

  const contextBlock = lines.join("\n");
  const stabilityContextFile: WorkspaceBootstrapFile = {
    name: DEFAULT_MEMORY_ALT_FILENAME,
    path: "_stability_context.memory.md",
    content: contextBlock,
    missing: false,
  };

  // Inject as a bootstrap file that gets prepended to user messages
  context.bootstrapFiles.push(stabilityContextFile);

  log.debug("Injected stability context", { sessionKey, entropy: entropyState.lastScore });
};

export default handler;
