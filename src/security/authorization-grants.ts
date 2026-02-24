import crypto from "node:crypto";
import type { InputProvenanceKind } from "../sessions/input-provenance.js";
import type { HighRiskAuthorizationAction } from "./high-risk-authorization.js";

const MIN_TTL_SECONDS = 30;
const MAX_TTL_SECONDS = 600;
const DEFAULT_TTL_SECONDS = 120;

export type AuthorizationGrant = {
  token: string;
  action: HighRiskAuthorizationAction;
  issuerSessionKey?: string;
  issuerProvenanceKind?: InputProvenanceKind;
  targetSessionKey?: string;
  issuedAtMs: number;
  expiresAtMs: number;
  consumedAtMs?: number;
  consumedBySessionKey?: string;
};

type ConsumeGrantStatus =
  | "ok"
  | "missing"
  | "expired"
  | "consumed"
  | "issuer_mismatch"
  | "target_mismatch"
  | "action_mismatch"
  | "provenance_mismatch";

export type ConsumeGrantResult = {
  ok: boolean;
  status: ConsumeGrantStatus;
  error?: string;
  grant?: AuthorizationGrant;
};

const grantStore = new Map<string, AuthorizationGrant>();

function nowMs(): number {
  return Date.now();
}

function clampTtlSeconds(ttlSeconds: number | undefined): number {
  if (typeof ttlSeconds !== "number" || !Number.isFinite(ttlSeconds)) {
    return DEFAULT_TTL_SECONDS;
  }
  const rounded = Math.floor(ttlSeconds);
  return Math.min(MAX_TTL_SECONDS, Math.max(MIN_TTL_SECONDS, rounded));
}

function actionMatches(
  required: HighRiskAuthorizationAction | undefined,
  actual: HighRiskAuthorizationAction,
) {
  if (!required) {
    return true;
  }
  if (required === actual) {
    return true;
  }
  return required === "high_risk_relay" || actual === "high_risk_relay";
}

function pruneExpired(currentMs = nowMs()): void {
  for (const [token, grant] of grantStore.entries()) {
    if (grant.expiresAtMs <= currentMs) {
      grantStore.delete(token);
    }
  }
}

export function issueAuthorizationGrant(params: {
  action: HighRiskAuthorizationAction;
  issuerSessionKey?: string;
  issuerProvenanceKind?: InputProvenanceKind;
  targetSessionKey?: string;
  ttlSeconds?: number;
  nowMsOverride?: number;
}): AuthorizationGrant {
  const issuedAtMs = params.nowMsOverride ?? nowMs();
  const ttlSeconds = clampTtlSeconds(params.ttlSeconds);
  const token = `ag_${crypto.randomUUID().replace(/-/g, "")}`;
  const grant: AuthorizationGrant = {
    token,
    action: params.action,
    issuerSessionKey: params.issuerSessionKey,
    issuerProvenanceKind: params.issuerProvenanceKind,
    targetSessionKey: params.targetSessionKey,
    issuedAtMs,
    expiresAtMs: issuedAtMs + ttlSeconds * 1000,
  };
  grantStore.set(token, grant);
  pruneExpired(issuedAtMs);
  return grant;
}

export function consumeAuthorizationGrant(params: {
  token: string;
  requiredAction?: HighRiskAuthorizationAction;
  requesterSessionKey?: string;
  targetSessionKey?: string;
  requiredProvenanceKind?: InputProvenanceKind;
  nowMsOverride?: number;
}): ConsumeGrantResult {
  const currentMs = params.nowMsOverride ?? nowMs();
  const grant = grantStore.get(params.token);
  if (!grant) {
    pruneExpired(currentMs);
    return {
      ok: false,
      status: "missing",
      error: "Authorization grant token not found. Issue a fresh grant and retry.",
    };
  }
  if (grant.expiresAtMs <= currentMs) {
    grantStore.delete(params.token);
    return {
      ok: false,
      status: "expired",
      error: "Authorization grant token expired. Issue a fresh grant and retry.",
    };
  }
  pruneExpired(currentMs);
  if (grant.consumedAtMs) {
    return {
      ok: false,
      status: "consumed",
      error: "Authorization grant token already consumed. Issue a fresh grant and retry.",
    };
  }
  if (
    params.requesterSessionKey &&
    grant.issuerSessionKey &&
    params.requesterSessionKey !== grant.issuerSessionKey
  ) {
    return {
      ok: false,
      status: "issuer_mismatch",
      error: "Authorization grant issuer mismatch.",
      grant,
    };
  }
  if (
    params.targetSessionKey &&
    grant.targetSessionKey &&
    params.targetSessionKey !== grant.targetSessionKey
  ) {
    return {
      ok: false,
      status: "target_mismatch",
      error: "Authorization grant target mismatch.",
      grant,
    };
  }
  if (!actionMatches(params.requiredAction, grant.action)) {
    return {
      ok: false,
      status: "action_mismatch",
      error: `Authorization grant action mismatch (grant=${grant.action}).`,
      grant,
    };
  }
  if (
    params.requiredProvenanceKind &&
    grant.issuerProvenanceKind &&
    params.requiredProvenanceKind !== grant.issuerProvenanceKind
  ) {
    return {
      ok: false,
      status: "provenance_mismatch",
      error: "Authorization grant provenance mismatch.",
      grant,
    };
  }
  grant.consumedAtMs = currentMs;
  grant.consumedBySessionKey = params.requesterSessionKey;
  return {
    ok: true,
    status: "ok",
    grant,
  };
}

export function clearAuthorizationGrantsForTests() {
  grantStore.clear();
}
