import type { NeuronWavesAction, NeuronWavesDecision, NeuronWavesPolicy } from "./types.js";

const DEV_DEFAULT: NeuronWavesDecision = "auto";
const SAFE_DEFAULT: NeuronWavesDecision = "ask";

export function resolvePolicyDecision(params: {
  policy: NeuronWavesPolicy;
  action: NeuronWavesAction;
}): NeuronWavesDecision {
  const { policy, action } = params;
  const explicit = policy.rules[action.kind];
  if (explicit) {
    return explicit;
  }

  // Mode defaults: safe is conservative; dev is permissive.
  if (policy.mode === "dev") {
    return DEV_DEFAULT;
  }

  // In safe mode, internal low-risk actions default to auto.
  if (!action.external && action.risk === "low") {
    return "auto";
  }

  return SAFE_DEFAULT;
}

export function shouldPrepareThenAsk(params: {
  decision: NeuronWavesDecision;
  action: NeuronWavesAction;
}): boolean {
  // User-selected behavior: when decision=ask, we still prepare artifacts when possible.
  return params.decision === "ask" && params.action.supportsPrepareThenAct === true;
}
