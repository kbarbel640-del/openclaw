import { DEFAULT_FAREWELL_TEXT, type ThreadBindingRecord } from "./thread-bindings.types.js";

function normalizeDurationMs(raw: unknown): number {
  if (typeof raw !== "number" || !Number.isFinite(raw)) {
    return 0;
  }
  const durationMs = Math.floor(raw);
  if (durationMs < 0) {
    return 0;
  }
  return durationMs;
}

export function formatThreadBindingDurationLabel(durationMs: number): string {
  if (durationMs <= 0) {
    return "disabled";
  }
  if (durationMs < 60_000) {
    return "<1m";
  }
  const totalMinutes = Math.floor(durationMs / 60_000);
  if (totalMinutes % 60 === 0) {
    return `${Math.floor(totalMinutes / 60)}h`;
  }
  return `${totalMinutes}m`;
}

export function resolveThreadBindingThreadName(params: {
  agentId?: string;
  label?: string;
}): string {
  const label = params.label?.trim();
  const base = label || params.agentId?.trim() || "agent";
  const raw = `🤖 ${base}`.replace(/\s+/g, " ").trim();
  return raw.slice(0, 100);
}

export function resolveThreadBindingIntroText(params: {
  agentId?: string;
  label?: string;
  idleTimeoutMs?: number;
  maxAgeMs?: number;
}): string {
  const label = params.label?.trim();
  const base = label || params.agentId?.trim() || "agent";
  const normalized = base.replace(/\s+/g, " ").trim().slice(0, 100) || "agent";
  const idleTimeoutMs = normalizeDurationMs(params.idleTimeoutMs);
  const maxAgeMs = normalizeDurationMs(params.maxAgeMs);

  let lifecycleHint = "";
  if (idleTimeoutMs > 0 && maxAgeMs > 0) {
    lifecycleHint = ` (idle auto-unfocus after ${formatThreadBindingDurationLabel(idleTimeoutMs)} inactivity; max age ${formatThreadBindingDurationLabel(maxAgeMs)})`;
  } else if (idleTimeoutMs > 0) {
    lifecycleHint = ` (idle auto-unfocus after ${formatThreadBindingDurationLabel(idleTimeoutMs)} inactivity)`;
  } else if (maxAgeMs > 0) {
    lifecycleHint = ` (max age ${formatThreadBindingDurationLabel(maxAgeMs)})`;
  }

  return `🤖 ${normalized} session active${lifecycleHint}. Messages here go directly to this session.`;
}

export function resolveThreadBindingFarewellText(params: {
  reason?: string;
  farewellText?: string;
  idleTimeoutMs: number;
  maxAgeMs: number;
}): string {
  const custom = params.farewellText?.trim();
  if (custom) {
    return custom;
  }
  if (params.reason === "idle-expired") {
    return `Session unfocused after ${formatThreadBindingDurationLabel(params.idleTimeoutMs)} of inactivity. Messages here will no longer be routed.`;
  }
  if (params.reason === "max-age-expired") {
    return `Session unfocused after reaching max age of ${formatThreadBindingDurationLabel(params.maxAgeMs)}. Messages here will no longer be routed.`;
  }
  return DEFAULT_FAREWELL_TEXT;
}

export function summarizeBindingPersona(record: ThreadBindingRecord): string {
  const label = record.label?.trim();
  const base = label || record.agentId;
  return (`🤖 ${base}`.trim() || "🤖 agent").slice(0, 80);
}
