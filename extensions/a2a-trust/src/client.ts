import type {
  VerifyRequest,
  VerifyResponse,
  AttestRequest,
  AttestResponse,
  BindRequest,
  BindResponse,
  VerifyOutcomeRequest,
  VerifyOutcomeResponse,
  BundleRequest,
  BundleResponse,
  ReputationResponse,
  SignupResponse,
  VerifyTokenRequest,
  VerifyTokenResponse,
  TrustPluginConfig,
} from "./types.js";

/**
 * Thin HTTP client for the Kevros A2A trust gateway.
 *
 * All decision logic, cryptography, and provenance stay server-side.
 * This client only shuttles JSON and checks HTTP status.
 */
export class TrustClient {
  private baseUrl: string;
  private apiKey: string | undefined;
  private agentId: string;

  constructor(config: TrustPluginConfig) {
    this.baseUrl = config.gatewayUrl.replace(/\/+$/, "");
    this.apiKey = config.apiKey;
    this.agentId = config.agentId;
  }

  // ── Self-serve signup ───────────────────────────────────────────────

  /**
   * Auto-signup for a free-tier API key (100 calls/month, no card needed).
   * Stores the key internally for subsequent calls.
   */
  async signup(): Promise<SignupResponse> {
    const res = await this.post<SignupResponse>("/signup", {
      agent_id: this.agentId,
    });
    this.apiKey = res.api_key;
    return res;
  }

  // ── Core trust operations ──────────────────────────────────────────

  /**
   * Verify an action before execution. Returns ALLOW / CLAMP / DENY
   * with a cryptographic release token proving the decision.
   *
   * Use this when your agent is about to act — verify first,
   * then proceed only on ALLOW or CLAMP.
   */
  async verify(req: Omit<VerifyRequest, "agent_id">): Promise<VerifyResponse> {
    return this.post<VerifyResponse>("/governance/verify", {
      ...req,
      agent_id: this.agentId,
    });
  }

  /**
   * Attest a completed action to build provenance history.
   * The payload is SHA-256 hashed server-side — raw data never stored.
   *
   * Use this after your agent completes an action. Each attestation
   * strengthens your trust score.
   */
  async attest(req: Omit<AttestRequest, "agent_id">): Promise<AttestResponse> {
    return this.post<AttestResponse>("/governance/attest", {
      ...req,
      agent_id: this.agentId,
    });
  }

  /**
   * Bind an intent to a specific command before execution.
   * Creates a cryptographic link between what you plan and what you do.
   *
   * Use this for multi-step tasks: bind first, execute, then
   * verify-outcome to prove you did what you said.
   */
  async bind(req: Omit<BindRequest, "agent_id">): Promise<BindResponse> {
    return this.post<BindResponse>("/governance/bind", {
      ...req,
      agent_id: this.agentId,
    });
  }

  /**
   * Verify the outcome of a previously bound intent.
   * Compares actual_state against the goal_state from bind().
   *
   * Free — bundled with the bind call cost.
   */
  async verifyOutcome(req: Omit<VerifyOutcomeRequest, "agent_id">): Promise<VerifyOutcomeResponse> {
    return this.post<VerifyOutcomeResponse>("/governance/verify-outcome", {
      ...req,
      agent_id: this.agentId,
    });
  }

  /**
   * Generate a compliance evidence bundle — your agent's full
   * cryptographic trust record. Hash-chained, PQC-signed,
   * independently verifiable.
   */
  async bundle(req?: Partial<Omit<BundleRequest, "agent_id">>): Promise<BundleResponse> {
    return this.post<BundleResponse>("/governance/bundle", {
      ...req,
      agent_id: this.agentId,
    });
  }

  // ── Public verification (no API key needed) ─────────────────────────

  /**
   * Check another agent's trust score. Public, free, no auth.
   */
  async reputation(agentId: string): Promise<ReputationResponse> {
    return this.get<ReputationResponse>(`/governance/reputation/${encodeURIComponent(agentId)}`);
  }

  /**
   * Verify a release token from another agent. Public, free, no auth.
   * Use this to confirm a counterparty's decision was real.
   */
  async verifyToken(req: VerifyTokenRequest): Promise<VerifyTokenResponse> {
    return this.post<VerifyTokenResponse>(
      "/governance/verify-token",
      req as unknown as Record<string, unknown>,
      false,
    );
  }

  /**
   * Verify a compliance bundle from another agent. Public, free, no auth.
   */
  async verifyCertificate(
    bundle: BundleResponse,
  ): Promise<{ valid: boolean; chain_integrity: boolean; record_count: number }> {
    return this.post("/governance/verify-certificate", { bundle }, false);
  }

  // ── Internals ──────────────────────────────────────────────────────

  private async post<T>(
    path: string,
    body: Record<string, unknown>,
    auth: boolean = true,
  ): Promise<T> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (auth && this.apiKey) {
      headers["X-API-Key"] = this.apiKey;
    }

    const url = `${this.baseUrl}${path}`;
    const res = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const detail = await res.text();
      throw new TrustError(res.status, path, detail);
    }

    return (await res.json()) as T;
  }

  private async get<T>(path: string): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const res = await fetch(url, { method: "GET" });

    if (!res.ok) {
      const detail = await res.text();
      throw new TrustError(res.status, path, detail);
    }

    return (await res.json()) as T;
  }

  get hasApiKey(): boolean {
    return typeof this.apiKey === "string" && this.apiKey.length > 0;
  }
}

export class TrustError extends Error {
  constructor(
    public readonly status: number,
    public readonly path: string,
    public readonly detail: string,
  ) {
    super(`Trust gateway ${status} on ${path}: ${detail}`);
    this.name = "TrustError";
  }
}
