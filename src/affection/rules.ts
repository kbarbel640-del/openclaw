import type { TriggerKind, TriggerMatch } from "./triggers";
import { clamp01, clamp11 } from "../util/math.js";
import type { AffectionStateV3b } from "./v3b-engine";

export type Delta = {
  closeness?: number;
  trust?: number;
  reliabilityTrust?: number;
  irritation?: number;
  affGain?: number;
  // optional: open a repair case (not implemented yet)
  repairCase?: { type: "insult" | "dismissive"; severity: 1 | 2 | 3 };
};

export type ApplyResult = {
  applied: boolean;
  reason?: string;
  delta: Required<Pick<Delta, "closeness" | "trust" | "reliabilityTrust" | "irritation" | "affGain">>;
  kind: TriggerKind;
};

export const DEFAULTS = {
  rewardCooldownMinutes: 30,
  dailyAffGainCap: 12,
  dailyNegBudgetCap: 6, // max negative "points" per day (soft)
};

function nowIso() {
  return new Date().toISOString();
}

function todayDate(): string {
  const d = new Date();
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export function ensureDaily(state: any) {
  if (!state.today || typeof state.today !== "object") {
    state.today = { date: todayDate(), affGain: 0, negBudgetUsed: 0 };
    return;
  }
  if (state.today.date !== todayDate()) {
    state.today = { date: todayDate(), affGain: 0, negBudgetUsed: 0 };
    return;
  }
  if (typeof state.today.affGain !== "number") state.today.affGain = 0;
  if (typeof state.today.negBudgetUsed !== "number") state.today.negBudgetUsed = 0;
}

function cooldownActive(state: any): boolean {
  const until = state.cooldownUntil ? Date.parse(state.cooldownUntil) : NaN;
  if (!Number.isFinite(until)) return false;
  return Date.now() < until;
}

function setCooldown(state: any, minutes: number) {
  const ms = minutes * 60_000;
  state.cooldownUntil = new Date(Date.now() + ms).toISOString();
}

function clampDelta(
  delta: Delta
): Required<Pick<Delta, "closeness" | "trust" | "reliabilityTrust" | "irritation" | "affGain">> {
  return {
    closeness: delta.closeness ?? 0,
    trust: delta.trust ?? 0,
    reliabilityTrust: delta.reliabilityTrust ?? 0,
    irritation: delta.irritation ?? 0,
    affGain: delta.affGain ?? 0,
  };
}

export function deltaForTrigger(match: TriggerMatch): Delta {
  switch (match.kind) {
    case "praise":
      return { trust: 0.01, closeness: 0.004, affGain: 2 };
    case "gratitude":
      return { trust: 0.006, closeness: 0.002, affGain: 1 };
    case "success":
      return { trust: 0.008, closeness: 0.001, affGain: 1 };
    case "insult":
      return {
        irritation: 0.06,
        reliabilityTrust: -0.05,
        affGain: 0,
        repairCase: { type: "insult", severity: 3 },
      };
    case "dismissive":
      return {
        irritation: match.confidence === "high" ? 0.03 : 0.01,
        reliabilityTrust: match.confidence === "high" ? -0.02 : -0.01,
        affGain: 0,
        repairCase: { type: "dismissive", severity: match.confidence === "high" ? 2 : 1 },
      };
  }
}

export function applyTriggerToState(opts: {
  state: AffectionStateV3b & any;
  match: TriggerMatch;
}): ApplyResult {
  const { state, match } = opts;

  ensureDaily(state);

  // Only enforce cooldown + daily cap for positives. Negatives should still land (but are budgeted).
  const positive = match.kind === "praise" || match.kind === "gratitude" || match.kind === "success";
  if (positive) {
    if (cooldownActive(state)) {
      return { applied: false, reason: "cooldown", delta: clampDelta({}), kind: match.kind };
    }
    if ((state.today?.affGain ?? 0) >= DEFAULTS.dailyAffGainCap) {
      return { applied: false, reason: "daily_cap", delta: clampDelta({}), kind: match.kind };
    }
  } else {
    // Negative soft budget (prevents dogpiling)
    const used = Number(state.today?.negBudgetUsed ?? 0);
    if (used >= DEFAULTS.dailyNegBudgetCap) {
return { applied: false, reason: "neg_budget", delta: clampDelta({}), kind: match.kind };
    }
  }

  const delta = deltaForTrigger(match);
  const d = clampDelta(delta);

  // Apply deltas
  state.closeness = clamp01((state.closeness ?? 0) + d.closeness);
  state.trust = clamp01((state.trust ?? 0) + d.trust);
  state.reliabilityTrust = clamp11((state.reliabilityTrust ?? 0) + d.reliabilityTrust);
  state.irritation = clamp01((state.irritation ?? 0) + d.irritation);
  state.lastMessageAt = nowIso();

  if (positive) {
    state.today.affGain = Number(state.today.affGain ?? 0) + d.affGain;
    setCooldown(state, DEFAULTS.rewardCooldownMinutes);
  } else {
    // count negative budget usage by severity
    const sev = delta.repairCase?.severity ?? 1;
    state.today.negBudgetUsed = Number(state.today.negBudgetUsed ?? 0) + sev;
  }

  return { applied: true, delta: d, kind: match.kind };
}
