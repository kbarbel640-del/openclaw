export const HIGH_RISK_AUTHORIZATION_ACTION_VALUES = [
  "high_risk_relay",
  "scm_push_pr",
  "deploy_release",
  "destructive_system",
  "credential_access",
  "financial_transfer",
] as const;

export type HighRiskAuthorizationAction = (typeof HIGH_RISK_AUTHORIZATION_ACTION_VALUES)[number];

const AUTHORIZATION_SIGNAL_RE =
  /\b(?:authorized|authorization|approve|approved|approval|go|green\s*light)\b/i;
const PUSH_AUTHORIZED_RE = /\bpush\s+authorized\b/i;
const SCM_ACTION_RE = /\b(?:push|pull\s+request|pr|merge|rebase|cherry-?pick)\b/i;
const DEPLOY_RELEASE_ACTION_RE = /\b(?:deploy|release|publish|ship|promote)\b/i;
const DESTRUCTIVE_SYSTEM_ACTION_RE =
  /\b(?:delete|destroy|shutdown|restart|terminate|revoke|rotate)\b/i;
const CREDENTIAL_ACTION_RE = /\b(?:credential|token|key|secret)\b/i;
const FINANCIAL_ACTION_RE = /\b(?:payment|wire|transfer|payout|invoice)\b/i;
const AUTHZ_TOKEN_INLINE_RE = /\bAUTHZ_TOKEN\s*:\s*(ag_[A-Za-z0-9]{12,})\b/i;

function normalizeText(message: string): string {
  return message.replace(/\s+/g, " ").trim();
}

function isHighRiskActionMessage(normalized: string): boolean {
  return (
    SCM_ACTION_RE.test(normalized) ||
    DEPLOY_RELEASE_ACTION_RE.test(normalized) ||
    DESTRUCTIVE_SYSTEM_ACTION_RE.test(normalized) ||
    CREDENTIAL_ACTION_RE.test(normalized) ||
    FINANCIAL_ACTION_RE.test(normalized)
  );
}

function inferAction(normalized: string): HighRiskAuthorizationAction {
  if (SCM_ACTION_RE.test(normalized)) {
    return "scm_push_pr";
  }
  if (DEPLOY_RELEASE_ACTION_RE.test(normalized)) {
    return "deploy_release";
  }
  if (DESTRUCTIVE_SYSTEM_ACTION_RE.test(normalized)) {
    return "destructive_system";
  }
  if (CREDENTIAL_ACTION_RE.test(normalized)) {
    return "credential_access";
  }
  if (FINANCIAL_ACTION_RE.test(normalized)) {
    return "financial_transfer";
  }
  return "high_risk_relay";
}

export function classifyHighRiskAuthorizationMessage(message: string): {
  isHighRiskAuthorization: boolean;
  action?: HighRiskAuthorizationAction;
  normalizedMessage: string;
} {
  const normalizedMessage = normalizeText(message);
  if (!normalizedMessage) {
    return { isHighRiskAuthorization: false, normalizedMessage };
  }
  if (PUSH_AUTHORIZED_RE.test(normalizedMessage)) {
    return {
      isHighRiskAuthorization: true,
      action: "scm_push_pr",
      normalizedMessage,
    };
  }
  if (
    AUTHORIZATION_SIGNAL_RE.test(normalizedMessage) &&
    isHighRiskActionMessage(normalizedMessage)
  ) {
    return {
      isHighRiskAuthorization: true,
      action: inferAction(normalizedMessage),
      normalizedMessage,
    };
  }
  return { isHighRiskAuthorization: false, normalizedMessage };
}

export function normalizeHighRiskAuthorizationAction(
  value: unknown,
): HighRiskAuthorizationAction | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const normalized = value.trim().toLowerCase();
  return (HIGH_RISK_AUTHORIZATION_ACTION_VALUES as readonly string[]).includes(normalized)
    ? (normalized as HighRiskAuthorizationAction)
    : undefined;
}

export function extractAuthorizationGrantToken(message: string): string | undefined {
  const match = AUTHZ_TOKEN_INLINE_RE.exec(message);
  const token = match?.[1]?.trim();
  return token || undefined;
}

export function stripAuthorizationGrantTokenMarker(message: string): string {
  const lines = message.split(/\r?\n/);
  const filtered = lines.filter((line) => !/\bAUTHZ_TOKEN\s*:/i.test(line));
  return filtered.join("\n").trim();
}
