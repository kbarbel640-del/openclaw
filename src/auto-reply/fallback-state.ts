import type { SessionEntry } from "../config/sessions.js";
import { formatProviderModelRef } from "./model-runtime.js";
import type { RuntimeFallbackAttempt } from "./reply/agent-runner-execution.js";

const FALLBACK_REASON_PART_MAX = 80;

export type FallbackNoticeState = Pick<
  SessionEntry,
  | "fallbackNoticeSelectedModel"
  | "fallbackNoticeActiveModel"
  | "fallbackNoticeReason"
  | "fallbackNoticeStartedAt"
>;

export function normalizeFallbackModelRef(value?: string): string | undefined {
  const trimmed = String(value ?? "").trim();
  return trimmed || undefined;
}

export function normalizeFallbackStartedAt(value?: number): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    return undefined;
  }
  return Math.floor(value);
}

function truncateFallbackReasonPart(value: string, max = FALLBACK_REASON_PART_MAX): string {
  const text = String(value ?? "")
    .replace(/\s+/g, " ")
    .trim();
  if (text.length <= max) {
    return text;
  }
  return `${text.slice(0, Math.max(0, max - 1)).trimEnd()}…`;
}

export function formatFallbackAttemptReason(attempt: RuntimeFallbackAttempt): string {
  const reason = attempt.reason?.trim();
  if (reason) {
    return reason.replace(/_/g, " ");
  }
  const code = attempt.code?.trim();
  if (code) {
    return code;
  }
  if (typeof attempt.status === "number") {
    return `HTTP ${attempt.status}`;
  }
  return truncateFallbackReasonPart(attempt.error || "error");
}

function formatFallbackAttemptSummary(attempt: RuntimeFallbackAttempt): string {
  return `${formatProviderModelRef(attempt.provider, attempt.model)} ${formatFallbackAttemptReason(attempt)}`;
}

export function buildFallbackReasonSummary(attempts: RuntimeFallbackAttempt[]): string {
  const firstAttempt = attempts[0];
  const firstReason = firstAttempt
    ? formatFallbackAttemptReason(firstAttempt)
    : "selected model unavailable";
  const moreAttempts = attempts.length > 1 ? ` (+${attempts.length - 1} more attempts)` : "";
  return `${truncateFallbackReasonPart(firstReason)}${moreAttempts}`;
}

export function buildFallbackAttemptSummaries(attempts: RuntimeFallbackAttempt[]): string[] {
  return attempts.map((attempt) =>
    truncateFallbackReasonPart(formatFallbackAttemptSummary(attempt)),
  );
}

export function buildFallbackNotice(params: {
  selectedProvider: string;
  selectedModel: string;
  activeProvider: string;
  activeModel: string;
  attempts: RuntimeFallbackAttempt[];
}): string | null {
  const selected = formatProviderModelRef(params.selectedProvider, params.selectedModel);
  const active = formatProviderModelRef(params.activeProvider, params.activeModel);
  if (selected === active) {
    return null;
  }
  const reasonSummary = buildFallbackReasonSummary(params.attempts);
  return `↪️ Model Fallback: ${active} (selected ${selected}; ${reasonSummary})`;
}

export function buildFallbackStartedNotice(params: {
  selectedModelRef: string;
  activeModelRef: string;
  reasonSummary?: string;
}): string | null {
  const selected = normalizeFallbackModelRef(params.selectedModelRef);
  const active = normalizeFallbackModelRef(params.activeModelRef);
  if (!selected || !active || selected === active) {
    return null;
  }
  const reason = normalizeFallbackModelRef(params.reasonSummary);
  return reason
    ? `↪️ Model Fallback started: ${active} (selected ${selected}; ${reason})`
    : `↪️ Model Fallback started: ${active} (selected ${selected})`;
}

export function buildFallbackClearedNotice(params: {
  selectedProvider: string;
  selectedModel: string;
  previousActiveModel?: string;
}): string {
  const selected = formatProviderModelRef(params.selectedProvider, params.selectedModel);
  const previous = normalizeFallbackModelRef(params.previousActiveModel);
  if (previous && previous !== selected) {
    return `↪️ Model Fallback cleared: ${selected} (was ${previous})`;
  }
  return `↪️ Model Fallback cleared: ${selected}`;
}

export function resolveActiveFallbackState(params: {
  selectedModelRef: string;
  activeModelRef: string;
  state?: FallbackNoticeState;
}): { active: boolean; reason?: string; startedAt?: number } {
  const selected = normalizeFallbackModelRef(params.state?.fallbackNoticeSelectedModel);
  const active = normalizeFallbackModelRef(params.state?.fallbackNoticeActiveModel);
  const reason = normalizeFallbackModelRef(params.state?.fallbackNoticeReason);
  const startedAt = normalizeFallbackStartedAt(params.state?.fallbackNoticeStartedAt);
  const fallbackActive =
    params.selectedModelRef !== params.activeModelRef &&
    selected === params.selectedModelRef &&
    active === params.activeModelRef;
  return {
    active: fallbackActive,
    reason: fallbackActive ? reason : undefined,
    startedAt: fallbackActive ? startedAt : undefined,
  };
}

export type ResolvedFallbackTransition = {
  selectedModelRef: string;
  activeModelRef: string;
  fallbackActive: boolean;
  fallbackTransitioned: boolean;
  fallbackCleared: boolean;
  reasonSummary: string;
  attemptSummaries: string[];
  previousState: {
    selectedModel?: string;
    activeModel?: string;
    reason?: string;
    startedAt?: number;
  };
  nextState: {
    selectedModel?: string;
    activeModel?: string;
    reason?: string;
    startedAt?: number;
  };
  stateChanged: boolean;
};

export function resolveFallbackTransition(params: {
  selectedProvider: string;
  selectedModel: string;
  activeProvider: string;
  activeModel: string;
  attempts: RuntimeFallbackAttempt[];
  state?: FallbackNoticeState;
  nowMs?: number;
}): ResolvedFallbackTransition {
  const selectedModelRef = formatProviderModelRef(params.selectedProvider, params.selectedModel);
  const activeModelRef = formatProviderModelRef(params.activeProvider, params.activeModel);
  const previousState = {
    selectedModel: normalizeFallbackModelRef(params.state?.fallbackNoticeSelectedModel),
    activeModel: normalizeFallbackModelRef(params.state?.fallbackNoticeActiveModel),
    reason: normalizeFallbackModelRef(params.state?.fallbackNoticeReason),
    startedAt: normalizeFallbackStartedAt(params.state?.fallbackNoticeStartedAt),
  };
  const fallbackActive = selectedModelRef !== activeModelRef;
  const fallbackTransitioned =
    fallbackActive &&
    (previousState.selectedModel !== selectedModelRef ||
      previousState.activeModel !== activeModelRef);
  const fallbackCleared =
    !fallbackActive &&
    Boolean(previousState.selectedModel || previousState.activeModel || previousState.startedAt);
  const reasonSummary = buildFallbackReasonSummary(params.attempts);
  const attemptSummaries = buildFallbackAttemptSummaries(params.attempts);
  const nowMs = normalizeFallbackStartedAt(params.nowMs) ?? Date.now();
  const nextStartedAt = fallbackActive
    ? fallbackTransitioned
      ? nowMs
      : (previousState.startedAt ?? nowMs)
    : undefined;
  const nextState = fallbackActive
    ? {
        selectedModel: selectedModelRef,
        activeModel: activeModelRef,
        reason: reasonSummary,
        startedAt: nextStartedAt,
      }
    : {
        selectedModel: undefined,
        activeModel: undefined,
        reason: undefined,
        startedAt: undefined,
      };
  const stateChanged =
    previousState.selectedModel !== nextState.selectedModel ||
    previousState.activeModel !== nextState.activeModel ||
    previousState.reason !== nextState.reason ||
    previousState.startedAt !== nextState.startedAt;
  return {
    selectedModelRef,
    activeModelRef,
    fallbackActive,
    fallbackTransitioned,
    fallbackCleared,
    reasonSummary,
    attemptSummaries,
    previousState,
    nextState,
    stateChanged,
  };
}
