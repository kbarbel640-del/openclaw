export type AuthProfileConfig = {
  provider: string;
  /**
   * Credential type expected in auth-profiles.json for this profile id.
   * - api_key: static provider API key
   * - oauth: refreshable OAuth credentials (access+refresh+expires)
   * - token: static bearer-style token (optionally expiring; no refresh)
   */
  mode: "api_key" | "oauth" | "token";
  email?: string;
};

export type AuthConfig = {
  profiles?: Record<string, AuthProfileConfig>;
  order?: Record<string, string[]>;
  cooldowns?: {
    /** Default billing backoff (hours). Default: 5. */
    billingBackoffHours?: number;
    /** Optional per-provider billing backoff (hours). */
    billingBackoffHoursByProvider?: Record<string, number>;
    /** Billing backoff cap (hours). Default: 24. */
    billingMaxHours?: number;
    /**
     * Failure window for backoff counters (hours). If no failures occur within
     * this window, counters reset. Default: 24.
     */
    failureWindowHours?: number;
    /**
     * Number of consecutive timeouts before escalated cooldown kicks in.
     * Default: 2.
     */
    timeoutEscalationThreshold?: number;
    /**
     * Cooldown duration (minutes) applied when consecutive timeouts reach the
     * escalation threshold.  Default: 15.
     */
    timeoutEscalationMinutes?: number;
    /**
     * Maximum cooldown (minutes) for escalated consecutive timeouts.
     * Applied when consecutive timeouts exceed the threshold by more than 1.
     * Default: 30.
     */
    timeoutEscalationMaxMinutes?: number;
  };
};
