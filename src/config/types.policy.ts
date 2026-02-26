export type PolicyGuardrailsConfig = {
  /** Enable signed policy guardrails. Default: false. */
  enabled?: boolean;
  /** Path to signed policy JSON. Default: ~/.openclaw/POLICY.json */
  policyPath?: string;
  /** Path to detached policy signature (base64). Default: ~/.openclaw/POLICY.sig */
  sigPath?: string;
  /** Base64 ed25519 public key used to verify POLICY.sig for POLICY.json. */
  publicKey?: string;
  /** Enforce lockdown on missing/invalid signature when enabled. Default: true. */
  failClosed?: boolean;
};
