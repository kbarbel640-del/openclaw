// --- Scaffolds ------------------------------------------------------------

export type ReasoningScaffoldsPhase0Config = {
  /** Gate for Phase 0 scaffolds (no-op placeholder in this phase). */
  enabled?: boolean;
  /** Reserved for forward compatibility; must be 0 when set. */
  phase?: 0;
};

export type ScaffoldsConfig = {
  reasoning?: ReasoningScaffoldsPhase0Config;
  /** Phase 1 kill switch: enables executor-based routing for skills with manifests. */
  executorsEnabled?: boolean;
};
