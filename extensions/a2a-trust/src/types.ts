// ── Request / Response types for the Kevros trust gateway ───────────────

export interface VerifyRequest {
  action_type: string;
  action_payload: Record<string, unknown>;
  agent_id: string;
  policy_context?: {
    max_values?: Record<string, number>;
    forbidden_keys?: string[];
  };
  idempotency_key?: string;
}

export interface VerifyResponse {
  decision: "ALLOW" | "CLAMP" | "DENY";
  verification_id: string;
  release_token: string | null;
  applied_action: Record<string, unknown> | null;
  policy_applied: Record<string, unknown> | null;
  reason: string;
  epoch: number;
  provenance_hash: string;
  hash_prev: string;
  timestamp_utc: string;
}

export interface AttestRequest {
  agent_id: string;
  action_description: string;
  action_payload: Record<string, unknown>;
  context?: Record<string, unknown>;
  prior_attestation_hash?: string;
}

export interface AttestResponse {
  attestation_id: string;
  epoch: number;
  hash_prev: string;
  hash_curr: string;
  pqc_block_ref: string | null;
  timestamp_utc: string;
  chain_length: number;
}

export type IntentType =
  | "NAVIGATION"
  | "MANIPULATION"
  | "SENSING"
  | "COMMUNICATION"
  | "MAINTENANCE"
  | "EMERGENCY"
  | "OPERATOR_COMMAND"
  | "AI_GENERATED"
  | "AUTOMATED";

export type IntentSource =
  | "HUMAN_OPERATOR"
  | "AI_PLANNER"
  | "MISSION_SCRIPT"
  | "REMOTE_API"
  | "SENSOR_TRIGGER"
  | "INTERNAL";

export interface BindRequest {
  agent_id: string;
  intent_type: IntentType;
  intent_description: string;
  command_payload: Record<string, unknown>;
  intent_source?: IntentSource;
  goal_state?: Record<string, unknown>;
  max_duration_ms?: number;
  parent_intent_id?: string;
}

export interface BindResponse {
  intent_id: string;
  intent_hash: string;
  binding_id: string;
  binding_hmac: string;
  command_hash: string;
  epoch: number;
  timestamp_utc: string;
}

export interface VerifyOutcomeRequest {
  agent_id: string;
  intent_id: string;
  binding_id: string;
  actual_state: Record<string, unknown>;
  tolerance?: number;
}

export interface VerifyOutcomeResponse {
  verification_id: string;
  intent_id: string;
  status: "ACHIEVED" | "PARTIALLY_ACHIEVED" | "FAILED" | "BLOCKED" | "TIMEOUT";
  achieved_percentage: number;
  discrepancy: Record<string, unknown> | null;
  evidence_hash: string;
  timestamp_utc: string;
}

export interface BundleRequest {
  agent_id: string;
  time_range_start?: string;
  time_range_end?: string;
  max_records?: number;
  include_intent_chains?: boolean;
  include_pqc_signatures?: boolean;
  include_verification_instructions?: boolean;
}

export interface BundleResponse {
  bundle_id: string;
  agent_id: string;
  record_count: number;
  truncated: boolean;
  chain_integrity: boolean;
  time_range: { start: string; end: string };
  records: Record<string, unknown>[];
  intent_chains: Record<string, unknown>[];
  pqc_signatures: Record<string, unknown>[];
  verification_instructions: string;
  bundle_hash: string;
  timestamp_utc: string;
}

export interface ReputationResponse {
  agent_id: string;
  trust_score: number;
  chain_length: number;
  attestation_count: number;
  outcome_count: number;
  achieved_count: number;
  chain_intact: boolean;
}

export interface SignupResponse {
  api_key: string;
  tier: string;
  monthly_limit: number;
  rate_limit_per_minute: number;
  upgrade_url: string;
}

export interface VerifyTokenRequest {
  release_token: string;
  token_preimage: string;
}

export interface VerifyTokenResponse {
  valid: boolean;
  decision: string;
  epoch: number;
  chain_found: boolean;
}

// ── Plugin config ───────────────────────────────────────────────────────

export interface TrustPluginConfig {
  gatewayUrl: string;
  apiKey?: string;
  agentId: string;
  autoVerify: boolean;
  autoAttest: boolean;
  trustServerPort: number;
}
