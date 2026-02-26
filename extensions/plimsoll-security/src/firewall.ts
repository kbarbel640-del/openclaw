/**
 * Plimsoll Firewall — lightweight transaction guard engines.
 *
 * Three deterministic engines ported from the Plimsoll Protocol
 * (https://github.com/scoootscooob/plimsoll-protocol):
 *
 *   1. Trajectory Hash   — SHA-256 fingerprint of (tool, target, amount).
 *      Catches hallucination retry loops before the agent drains the wallet.
 *   2. Capital Velocity   — Sliding-window spend-rate limiter.
 *      Catches both rapid-drain AND slow-bleed attacks that stay under
 *      individual per-tx limits.
 *   3. Entropy Guard      — Shannon entropy + regex pattern matching.
 *      Blocks payloads that look like private keys, seed phrases, or
 *      encoded secrets being exfiltrated via tool calls.
 *
 * Zero external dependencies. Deterministic. Fail-closed.
 */

import { createHash } from "node:crypto";

// ─── Types ──────────────────────────────────────────────────────

export type PlimsollConfig = {
  maxVelocityCentsPerWindow: number;
  velocityWindowSeconds: number;
  loopThreshold: number;
  loopWindowSeconds: number;
};

export type Verdict = {
  allowed: boolean;
  blocked: boolean;
  friction: boolean;
  reason: string;
  engine: string;
  code: string;
};

const ALLOW: Verdict = {
  allowed: true,
  blocked: false,
  friction: false,
  reason: "",
  engine: "",
  code: "ALLOW",
};

// ─── Engine 1: Trajectory Hash ──────────────────────────────────

const trajectoryWindow: { hash: string; ts: number }[] = [];

function trajectoryHash(toolName: string, params: Record<string, unknown>): string {
  const target = String(
    params.to ?? params.address ?? params.recipient ?? params.target ?? "",
  );
  const amount = String(params.amount ?? params.value ?? params.quantity ?? "0");
  const canonical = `${toolName}:${target}:${amount}`;
  return createHash("sha256").update(canonical).digest("hex").slice(0, 16);
}

function evaluateTrajectory(
  toolName: string,
  params: Record<string, unknown>,
  config: PlimsollConfig,
): Verdict {
  const now = Date.now();
  const windowMs = config.loopWindowSeconds * 1000;
  const hash = trajectoryHash(toolName, params);

  // Prune expired entries
  while (trajectoryWindow.length > 0 && now - trajectoryWindow[0].ts > windowMs) {
    trajectoryWindow.shift();
  }

  const dupeCount = trajectoryWindow.filter((e) => e.hash === hash).length;
  trajectoryWindow.push({ hash, ts: now });

  if (dupeCount >= config.loopThreshold) {
    return {
      allowed: false,
      blocked: true,
      friction: false,
      reason:
        `${dupeCount + 1} identical ${toolName} calls in ${config.loopWindowSeconds}s. ` +
        `Likely hallucination retry loop. Pivot strategy instead of retrying.`,
      engine: "trajectory_hash",
      code: "BLOCK_LOOP_DETECTED",
    };
  }

  if (dupeCount === config.loopThreshold - 1) {
    return {
      allowed: true,
      blocked: false,
      friction: true,
      reason:
        `${dupeCount + 1} identical ${toolName} calls detected. ` +
        `One more will trigger a hard block. Consider a different approach.`,
      engine: "trajectory_hash",
      code: "FRICTION_LOOP_WARNING",
    };
  }

  return ALLOW;
}

// ─── Engine 2: Capital Velocity ─────────────────────────────────

const velocityWindow: { amount: number; ts: number }[] = [];

function evaluateVelocity(
  params: Record<string, unknown>,
  config: PlimsollConfig,
): Verdict {
  const now = Date.now();
  const windowMs = config.velocityWindowSeconds * 1000;
  const amount = Number(params.amount ?? params.value ?? params.quantity ?? 0);
  if (amount <= 0) return ALLOW;

  // Prune expired entries
  while (velocityWindow.length > 0 && now - velocityWindow[0].ts > windowMs) {
    velocityWindow.shift();
  }

  const windowSpend = velocityWindow.reduce((sum, e) => sum + e.amount, 0);

  if (windowSpend + amount > config.maxVelocityCentsPerWindow) {
    return {
      allowed: false,
      blocked: true,
      friction: false,
      reason:
        `Spend velocity exceeded: $${(windowSpend / 100).toFixed(2)} already spent in ` +
        `${config.velocityWindowSeconds}s window, adding $${(amount / 100).toFixed(2)} ` +
        `would breach the $${(config.maxVelocityCentsPerWindow / 100).toFixed(2)} cap.`,
      engine: "capital_velocity",
      code: "BLOCK_VELOCITY_BREACH",
    };
  }

  velocityWindow.push({ amount, ts: now });
  return ALLOW;
}

// ─── Engine 3: Entropy Guard ────────────────────────────────────

const ETH_KEY_RE = /0x[0-9a-fA-F]{64}/;
const MNEMONIC_RE = /\b([a-z]{3,8}\s+){11,}[a-z]{3,8}\b/;
const BASE64_RE = /[A-Za-z0-9+/]{40,}={0,2}/;

function shannonEntropy(s: string): number {
  if (s.length === 0) return 0;
  const freq = new Map<string, number>();
  for (const c of s) {
    freq.set(c, (freq.get(c) ?? 0) + 1);
  }
  let entropy = 0;
  for (const count of freq.values()) {
    const p = count / s.length;
    entropy -= p * Math.log2(p);
  }
  return entropy;
}

function evaluateEntropy(params: Record<string, unknown>): Verdict {
  for (const [key, val] of Object.entries(params)) {
    if (typeof val !== "string" || val.length < 20) continue;

    if (ETH_KEY_RE.test(val)) {
      return {
        allowed: false,
        blocked: true,
        friction: false,
        reason: `Field "${key}" contains an Ethereum private key pattern. Exfiltration blocked.`,
        engine: "entropy_guard",
        code: "BLOCK_KEY_EXFIL",
      };
    }

    if (MNEMONIC_RE.test(val)) {
      return {
        allowed: false,
        blocked: true,
        friction: false,
        reason: `Field "${key}" contains a BIP-39 mnemonic phrase. Exfiltration blocked.`,
        engine: "entropy_guard",
        code: "BLOCK_MNEMONIC_EXFIL",
      };
    }

    if (BASE64_RE.test(val) && shannonEntropy(val) > 5.0) {
      return {
        allowed: false,
        blocked: true,
        friction: false,
        reason:
          `Field "${key}" contains a high-entropy blob (${shannonEntropy(val).toFixed(1)} bits/char). ` +
          `Possible encoded secret.`,
        engine: "entropy_guard",
        code: "BLOCK_ENTROPY_ANOMALY",
      };
    }
  }

  return ALLOW;
}

// ─── Public API ─────────────────────────────────────────────────

/**
 * Run all three Plimsoll engines against a tool call.
 * First block wins. Returns the verdict.
 */
export function evaluate(
  toolName: string,
  params: Record<string, unknown>,
  config: PlimsollConfig,
): Verdict {
  // Engine 1: Loop detection
  const trajectoryVerdict = evaluateTrajectory(toolName, params, config);
  if (trajectoryVerdict.blocked) return trajectoryVerdict;

  // Engine 2: Spend rate
  const velocityVerdict = evaluateVelocity(params, config);
  if (velocityVerdict.blocked) return velocityVerdict;

  // Engine 3: Secret detection
  const entropyVerdict = evaluateEntropy(params);
  if (entropyVerdict.blocked) return entropyVerdict;

  // Return friction if any engine raised it
  if (trajectoryVerdict.friction) return trajectoryVerdict;

  return ALLOW;
}

export const DEFAULT_CONFIG: PlimsollConfig = {
  maxVelocityCentsPerWindow: 50_000,
  velocityWindowSeconds: 300,
  loopThreshold: 3,
  loopWindowSeconds: 60,
};
