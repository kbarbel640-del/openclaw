import { applyTriggerToState } from "./rules";
import type { TriggerMatch } from "./triggers";
import { computeAff, labelForAff, appendAudit, saveState, loadOrInitState } from "./v3b-engine";

export type TriggerApply = {
  applied: boolean;
  reason?: string;
  kind: string;
};

export async function applyAffectionTrigger(opts: {
  workspace: string;
  match: TriggerMatch;
  sourceId: string; // e.g. telegram msg id
  note?: string;
}): Promise<TriggerApply> {
  const state = (await loadOrInitState(opts.workspace)) as any;

  const before = { ...state };
  const res = applyTriggerToState({ state, match: opts.match });

  if (!res.applied) {
    // still reply organically, but no state change
    await appendAudit(opts.workspace, {
      ts: new Date().toISOString(),
      action: "touch",
      note: `trigger:${opts.match.kind} (blocked:${res.reason ?? "unknown"})`,
      meta: { sourceId: opts.sourceId, phrase: opts.match.phrase },
    });
    return { applied: false, reason: res.reason, kind: opts.match.kind };
  }

  // recompute baseline
  state.aff = computeAff({ closeness: state.closeness, trust: state.trust });
  state.label = labelForAff(state.aff);

  await saveState(opts.workspace, state);

  const deltas = {
    closeness: state.closeness - before.closeness,
    trust: state.trust - before.trust,
    reliabilityTrust: state.reliabilityTrust - before.reliabilityTrust,
    irritation: state.irritation - before.irritation,
  };

  await appendAudit(opts.workspace, {
    ts: new Date().toISOString(),
    action:
      opts.match.kind === "praise" || opts.match.kind === "gratitude" || opts.match.kind === "success"
        ? "reward"
        : "penalty",
    note: `trigger:${opts.match.kind}${opts.note ? ` | ${opts.note}` : ""}`,
    meta: { sourceId: opts.sourceId, phrase: opts.match.phrase, kind: opts.match.kind },
    deltas,
  });

  return { applied: true, kind: opts.match.kind };
}
