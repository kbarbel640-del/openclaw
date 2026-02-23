import path from "node:path";
import { loadConfig } from "../config/config.js";
import { resolveStateDir } from "../config/paths.js";
import type { OpenClawConfig } from "../config/types.openclaw.js";
import { resolveUserPath } from "../utils.js";
import { loadSignedPolicy } from "./policy.load.js";
import type { SignedPolicy } from "./policy.schema.js";

const POLICY_CACHE_TTL_MS = 5_000;

export type ResolvedPolicyRuntimeConfig = {
  enabled: boolean;
  policyPath: string;
  sigPath: string;
  publicKey: string;
  failClosed: boolean;
};

export type PolicyManagerState = {
  enabled: boolean;
  valid: boolean;
  lockdown: boolean;
  failClosed: boolean;
  policyPath: string;
  sigPath: string;
  publicKey: string;
  policy?: SignedPolicy;
  reason?: string;
};

type PolicyStateCache = {
  fingerprint: string;
  expiresAtMs: number;
  state: PolicyManagerState;
};

let cache: PolicyStateCache | null = null;

function normalizePathOrDefault(raw: string | undefined, fallback: string): string {
  const trimmed = raw?.trim();
  if (!trimmed) {
    return fallback;
  }
  return resolveUserPath(trimmed);
}

export function resolvePolicyRuntimeConfig(config?: OpenClawConfig): ResolvedPolicyRuntimeConfig {
  const cfg = config ?? loadConfig();
  const stateDir = resolveStateDir();
  const policy = cfg.policy;
  return {
    enabled: policy?.enabled === true,
    policyPath: normalizePathOrDefault(policy?.policyPath, path.join(stateDir, "POLICY.json")),
    sigPath: normalizePathOrDefault(policy?.sigPath, path.join(stateDir, "POLICY.sig")),
    publicKey: policy?.publicKey?.trim() ?? "",
    failClosed: policy?.failClosed !== false,
  };
}

function isExpiredPolicy(policy: SignedPolicy, nowMs: number): boolean {
  const expiresAt = policy.expiresAt?.trim();
  if (!expiresAt) {
    return false;
  }
  const expiryTs = Date.parse(expiresAt);
  if (!Number.isFinite(expiryTs)) {
    return false;
  }
  return nowMs > expiryTs;
}

async function computePolicyState(config: ResolvedPolicyRuntimeConfig): Promise<PolicyManagerState> {
  const baseState: PolicyManagerState = {
    enabled: config.enabled,
    valid: true,
    lockdown: false,
    failClosed: config.failClosed,
    policyPath: config.policyPath,
    sigPath: config.sigPath,
    publicKey: config.publicKey,
  };

  if (!config.enabled) {
    return baseState;
  }

  if (!config.publicKey) {
    return {
      ...baseState,
      valid: false,
      lockdown: config.failClosed,
      reason: "policy publicKey is required when policy.enabled=true",
    };
  }

  const loaded = await loadSignedPolicy({
    policyPath: config.policyPath,
    sigPath: config.sigPath,
    publicKey: config.publicKey,
  });

  if (!loaded.ok) {
    return {
      ...baseState,
      valid: false,
      lockdown: config.failClosed,
      reason: loaded.error,
    };
  }

  if (isExpiredPolicy(loaded.policy, Date.now())) {
    return {
      ...baseState,
      valid: false,
      lockdown: config.failClosed,
      reason: `policy expired at ${loaded.policy.expiresAt}`,
    };
  }

  return {
    ...baseState,
    valid: true,
    lockdown: false,
    policy: loaded.policy,
  };
}

function buildFingerprint(config: ResolvedPolicyRuntimeConfig): string {
  return JSON.stringify([
    config.enabled,
    config.policyPath,
    config.sigPath,
    config.publicKey,
    config.failClosed,
  ]);
}

export async function getPolicyManagerState(opts?: {
  config?: OpenClawConfig;
  forceReload?: boolean;
}): Promise<PolicyManagerState> {
  const resolved = resolvePolicyRuntimeConfig(opts?.config);
  const fingerprint = buildFingerprint(resolved);
  const nowMs = Date.now();
  if (!opts?.forceReload && cache && cache.fingerprint === fingerprint && cache.expiresAtMs > nowMs) {
    return cache.state;
  }
  const state = await computePolicyState(resolved);
  cache = {
    fingerprint,
    expiresAtMs: nowMs + POLICY_CACHE_TTL_MS,
    state,
  };
  return state;
}

export async function refreshPolicyManager(opts?: { config?: OpenClawConfig }): Promise<PolicyManagerState> {
  return await getPolicyManagerState({ config: opts?.config, forceReload: true });
}

export function clearPolicyManagerCacheForTests(): void {
  cache = null;
}
