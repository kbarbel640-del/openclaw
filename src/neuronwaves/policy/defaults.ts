import type { NeuronWavesPolicy } from "./types.js";

export function defaultNeuronWavesPolicy(): NeuronWavesPolicy {
  return {
    mode: "safe",
    rules: {
      "run.command": "auto",
      "edit.files": "auto",
      "git.commit": "auto",
      "git.push": "auto",
      "pr.comment": "auto",

      "draft.email": "auto",
      "send.email": "ask",

      "draft.post": "auto",
      "post.x": "ask",

      "spend.money": "ask",
    },
    limits: {
      outboundPerHour: 5,
      spendUsdPerDay: 0,
    },
  };
}
