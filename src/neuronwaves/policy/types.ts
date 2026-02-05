export type NeuronWavesMode = "safe" | "dev";

export type NeuronWavesActionKind =
  | "draft.email"
  | "send.email"
  | "draft.post"
  | "post.x"
  | "run.command"
  | "edit.files"
  | "git.commit"
  | "git.push"
  | "pr.comment"
  | "spend.money";

export type NeuronWavesDecision = "auto" | "ask" | "deny";

export type NeuronWavesPolicy = {
  /** Safety profile for this agent. */
  mode: NeuronWavesMode;

  /** Per-action decisions. */
  rules: Partial<Record<NeuronWavesActionKind, NeuronWavesDecision>>;

  /** Hard limits (always enforced even when mode=dev). */
  limits: {
    /** Max external messages/posts per hour (send.email, post.x). */
    outboundPerHour: number;
    /** Daily spend cap in USD. Default 0. */
    spendUsdPerDay: number;
  };
};

export type NeuronWavesAction = {
  kind: NeuronWavesActionKind;
  summary: string;
  /** Whether this action leaves the machine / impacts the outside world. */
  external: boolean;
  /** Simple risk label to help reporting and policy defaults. */
  risk: "low" | "medium" | "high";
  /**
   * If true, the action can be performed in two phases: prepare artifacts first,
   * then ask before final external execution.
   */
  supportsPrepareThenAct?: boolean;
  /** Optional metadata for later enforcement/allowlisting. */
  meta?: Record<string, unknown>;
};
