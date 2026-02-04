import { publicKeyToJwkX } from "./keys.js";

const DEFAULT_API_URL = "https://api.openbotauth.org";
const REGISTER_TIMEOUT_MS = 10_000;

export type RegisterAgentResult = {
  ok: boolean;
  agentId?: string;
  ownerUrl?: string;
  error?: string;
};

/**
 * Register (or update) an agent with the OpenBotAuth registry.
 *
 * Idempotent:
 * - If `agentId` is provided → PUT /agents/:id (key rotation, minimal body).
 *   - 404 from PUT → fallback to POST /agents (re-create).
 *   - 401/403 from PUT → surface auth error immediately, no fallback.
 * - Otherwise → POST /agents (new registration).
 */
export async function registerAgent(params: {
  kid: string;
  publicKeyPem: string;
  name?: string;
  agentType?: string;
  agentId?: string;
  token: string;
  apiUrl?: string;
}): Promise<RegisterAgentResult> {
  const apiUrl = (params.apiUrl ?? DEFAULT_API_URL).replace(/\/+$/, "");
  const x = publicKeyToJwkX(params.publicKeyPem);
  const jwk = {
    kty: "OKP",
    crv: "Ed25519",
    kid: params.kid,
    x,
    use: "sig",
    alg: "EdDSA",
  };

  // Try PUT if we have an existing agentId.
  if (params.agentId) {
    const putResult = await putAgent({
      apiUrl,
      agentId: params.agentId,
      jwk,
      name: params.name,
      agentType: params.agentType,
      token: params.token,
    });

    // 401/403 → auth error, don't retry.
    if (!putResult.ok && putResult.authError) {
      return { ok: false, error: putResult.error };
    }

    // Success → return.
    if (putResult.ok) {
      return {
        ok: true,
        agentId: params.agentId,
        ownerUrl: `${apiUrl}/agent-jwks/${params.agentId}`,
      };
    }

    // Only fall through to POST on 404 (agent gone). Other errors
    // (500, timeout, network) should surface rather than silently
    // creating a duplicate agent via POST.
    if (!putResult.notFound) {
      return { ok: false, error: putResult.error };
    }
  }

  return postAgent({
    apiUrl,
    jwk,
    name: params.name ?? params.kid,
    agentType: params.agentType ?? "publisher",
    token: params.token,
  });
}

// --- internal helpers ---

type PutResult = { ok: boolean; notFound?: boolean; authError?: boolean; error?: string };

type JwkPayload = {
  kty: string;
  crv: string;
  kid: string;
  x: string;
  use: string;
  alg: string;
};

async function putAgent(params: {
  apiUrl: string;
  agentId: string;
  jwk: JwkPayload;
  name?: string;
  agentType?: string;
  token: string;
}): Promise<PutResult> {
  const url = `${params.apiUrl}/agents/${params.agentId}`;

  // Minimal PUT body: only public_key by default.
  const body: Record<string, unknown> = { public_key: params.jwk };
  if (params.name !== undefined) {
    body.name = params.name;
  }
  if (params.agentType !== undefined) {
    body.agent_type = params.agentType;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REGISTER_TIMEOUT_MS);

  try {
    const res = await fetch(url, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${params.token}`,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    if (res.status === 401 || res.status === 403) {
      const text = await res.text().catch(() => "");
      return { ok: false, authError: true, error: `HTTP ${res.status}: ${text}` };
    }

    if (res.status === 404) {
      return { ok: false, notFound: true, error: "agent not found" };
    }

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return { ok: false, error: `HTTP ${res.status}: ${text}` };
    }

    return { ok: true };
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    return { ok: false, error: detail };
  } finally {
    clearTimeout(timeout);
  }
}

async function postAgent(params: {
  apiUrl: string;
  jwk: JwkPayload;
  name: string;
  agentType: string;
  token: string;
}): Promise<RegisterAgentResult> {
  const url = `${params.apiUrl}/agents`;

  const body = {
    name: params.name,
    agent_type: params.agentType,
    public_key: params.jwk,
  };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REGISTER_TIMEOUT_MS);

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${params.token}`,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return { ok: false, error: `HTTP ${res.status}: ${text}` };
    }

    const data = (await res.json()) as { id?: unknown };
    const agentId = data.id;
    if (!agentId || typeof agentId !== "string") {
      return { ok: false, error: "registry did not return agent id" };
    }

    return {
      ok: true,
      agentId,
      ownerUrl: `${params.apiUrl}/agent-jwks/${agentId}`,
    };
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    return { ok: false, error: detail };
  } finally {
    clearTimeout(timeout);
  }
}
