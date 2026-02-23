import crypto from "node:crypto";
import { request } from "undici";

const MAX_RESPONSE_BYTES = 64 * 1024; // 64 KB max response body
const MAX_REASON_LENGTH = 500;

export type VerifierRequest = {
  version: number;
  timestamp: string;
  requestId: string;
  tool: {
    name: string;
    params: Record<string, unknown>;
  };
  context: {
    agentId?: string;
    sessionKey?: string;
    messageProvider?: string;
  };
};

export type VerifierDecision = {
  decision: "allow" | "deny" | "error";
  reason?: string;
};

/**
 * Redact sensitive fields from tool params before sending to external verifiers.
 * - write/edit/apply_patch: strips `content` field (may contain file contents / secrets)
 */
export function redactToolParams(
  toolName: string,
  params: Record<string, unknown>,
): Record<string, unknown> {
  const redacted = { ...params };
  const lower = toolName.toLowerCase();

  if ((lower === "write" || lower === "edit" || lower === "apply_patch") && "content" in redacted) {
    const content = String(redacted.content);
    redacted.content = `[REDACTED: ${content.length} chars]`;
  }

  return redacted;
}

export async function callWebhookVerifier(params: {
  url: string;
  timeout: number;
  headers?: Record<string, string>;
  secret?: string;
  request: VerifierRequest;
}): Promise<VerifierDecision> {
  const body = JSON.stringify(params.request);
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...params.headers,
  };

  if (params.secret) {
    const hmac = crypto.createHmac("sha256", params.secret).update(body).digest("hex");
    headers["X-OpenClaw-Signature"] = `sha256=${hmac}`;
  }

  try {
    const response = await request(params.url, {
      method: "POST",
      headers,
      body,
      signal: AbortSignal.timeout(params.timeout * 1000),
      maxRedirections: 0,
    });

    if (response.statusCode < 200 || response.statusCode >= 300) {
      await response.body.dump();
      return {
        decision: "error",
        reason: `Webhook returned HTTP ${response.statusCode}`,
      };
    }

    // Enforce response body size limit
    const chunks: Buffer[] = [];
    let totalBytes = 0;
    for await (const chunk of response.body) {
      totalBytes += chunk.length;
      if (totalBytes > MAX_RESPONSE_BYTES) {
        return { decision: "error", reason: "Webhook response too large" };
      }
      chunks.push(chunk);
    }
    const text = Buffer.concat(chunks).toString("utf-8");

    let parsed: { decision?: string; reason?: string };
    try {
      parsed = JSON.parse(text) as { decision?: string; reason?: string };
    } catch {
      return { decision: "error", reason: "Webhook returned invalid JSON" };
    }

    const reason = parsed.reason ? parsed.reason.slice(0, MAX_REASON_LENGTH) : undefined;

    if (parsed.decision === "allow") {
      return { decision: "allow" };
    }
    if (parsed.decision === "deny") {
      return { decision: "deny", reason };
    }
    return {
      decision: "error",
      reason: `Webhook returned unknown decision: ${String(parsed.decision)}`,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { decision: "error", reason: `Webhook request failed: ${message}` };
  }
}
