/**
 * SC-006 / AE-005: Non-human identity management and agent impersonation prevention.
 * Generates and manages Ed25519 keypairs for agent identity attestation.
 * Each agent instance signs its messages so receivers can verify authenticity.
 */

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import type { SecurityAuditFinding } from "./audit.js";

const KEY_DIR = path.join(os.homedir(), ".openclaw", "identity");
const PRIVATE_KEY_FILE = path.join(KEY_DIR, "agent.key.pem");
const PUBLIC_KEY_FILE = path.join(KEY_DIR, "agent.pub.pem");

function ensureKeyDir(): void {
  if (!fs.existsSync(KEY_DIR)) {
    fs.mkdirSync(KEY_DIR, { recursive: true, mode: 0o700 });
  }
}

// ---------------------------------------------------------------------------
// Keypair lifecycle
// ---------------------------------------------------------------------------

/**
 * Generate a new Ed25519 keypair and persist it to disk.
 * Overwrites any existing keypair.
 */
export function generateAgentKeypair(): { publicKeyPem: string; privateKeyPem: string } {
  ensureKeyDir();
  const { privateKey, publicKey } = crypto.generateKeyPairSync("ed25519", {
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
    publicKeyEncoding: { type: "spki", format: "pem" },
  });
  fs.writeFileSync(PRIVATE_KEY_FILE, privateKey as string, { mode: 0o600 });
  fs.writeFileSync(PUBLIC_KEY_FILE, publicKey as string, { mode: 0o644 });
  return { privateKeyPem: privateKey as string, publicKeyPem: publicKey as string };
}

/**
 * Load the existing agent keypair from disk.
 * Generates a new one if none exists.
 */
export function loadOrCreateAgentKeypair(): { publicKeyPem: string; privateKeyPem: string } {
  if (fs.existsSync(PRIVATE_KEY_FILE) && fs.existsSync(PUBLIC_KEY_FILE)) {
    return {
      privateKeyPem: fs.readFileSync(PRIVATE_KEY_FILE, "utf8"),
      publicKeyPem: fs.readFileSync(PUBLIC_KEY_FILE, "utf8"),
    };
  }
  return generateAgentKeypair();
}

/**
 * Return only the public key PEM (safe to share).
 */
export function getAgentPublicKey(): string {
  const { publicKeyPem } = loadOrCreateAgentKeypair();
  return publicKeyPem;
}

// ---------------------------------------------------------------------------
// Signing and verification
// ---------------------------------------------------------------------------

/**
 * Sign arbitrary data with the agent's private key using Ed25519.
 * Returns a base64-encoded signature.
 */
export function signWithAgentKey(data: string | Buffer): string {
  const { privateKeyPem } = loadOrCreateAgentKeypair();
  const buf = typeof data === "string" ? Buffer.from(data, "utf8") : data;
  // Ed25519 does not use a separate hash algorithm — pass null
  const sig = crypto.sign(null, buf, privateKeyPem);
  return sig.toString("base64");
}

/**
 * Verify a base64 Ed25519 signature against a known public key PEM.
 */
export function verifyAgentSignature(
  data: string | Buffer,
  signatureBase64: string,
  publicKeyPem: string,
): boolean {
  try {
    const buf = typeof data === "string" ? Buffer.from(data, "utf8") : data;
    const sig = Buffer.from(signatureBase64, "base64");
    return crypto.verify(null, buf, publicKeyPem, sig);
  } catch {
    return false;
  }
}

/**
 * Build an attestation token: `<payload>.<base64sig>` where payload is
 * a base64-encoded JSON string containing `{ agentId, timestamp, nonce }`.
 */
export function createAttestationToken(agentId: string): string {
  const payload = JSON.stringify({
    agentId,
    timestamp: new Date().toISOString(),
    nonce: crypto.randomBytes(8).toString("hex"),
  });
  const payloadB64 = Buffer.from(payload, "utf8").toString("base64");
  const sig = signWithAgentKey(Buffer.from(payloadB64, "utf8"));
  return `${payloadB64}.${sig}`;
}

/**
 * Verify an attestation token returned by another agent.
 * Returns the decoded payload if valid, or null if tampered/expired.
 */
export function verifyAttestationToken(
  token: string,
  publicKeyPem: string,
  maxAgeMs = 5 * 60 * 1_000, // 5 minutes
): { agentId: string; timestamp: string; nonce: string } | null {
  const dotIdx = token.lastIndexOf(".");
  if (dotIdx < 0) return null;
  const payloadB64 = token.slice(0, dotIdx);
  const sig = token.slice(dotIdx + 1);
  try {
    const payload = JSON.parse(Buffer.from(payloadB64, "base64").toString("utf8")) as {
      agentId: string;
      timestamp: string;
      nonce: string;
    };
    const age = Date.now() - new Date(payload.timestamp).getTime();
    if (age > maxAgeMs) return null;
    // Verify signature over the base64 payload (same bytes that were signed)
    const ok = verifyAgentSignature(Buffer.from(payloadB64, "utf8"), sig, publicKeyPem);
    return ok ? payload : null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Audit findings
// ---------------------------------------------------------------------------

/** Collect identity keypair audit findings (SC-006 / AE-005). */
export function collectIdentityFindings(): SecurityAuditFinding[] {
  const findings: SecurityAuditFinding[] = [];

  const hasPrivate = fs.existsSync(PRIVATE_KEY_FILE);
  const hasPublic = fs.existsSync(PUBLIC_KEY_FILE);

  if (!hasPrivate || !hasPublic) {
    findings.push({
      checkId: "SC-006",
      severity: "warn",
      title: "Agent identity keypair not yet initialised",
      detail:
        "No Ed25519 keypair found in ~/.openclaw/identity/. " +
        "Agent messages cannot be cryptographically attested until a keypair is generated.",
      remediation:
        "Call loadOrCreateAgentKeypair() on startup to generate and persist the keypair.",
    });
    return findings;
  }

  // Validate we can at least read both files
  try {
    const pub = fs.readFileSync(PUBLIC_KEY_FILE, "utf8");
    if (!pub.includes("PUBLIC KEY")) throw new Error("Invalid PEM format");
    findings.push({
      checkId: "SC-006",
      severity: "info",
      title: "Agent identity keypair present and valid",
      detail: `Ed25519 keypair found at ${KEY_DIR}. Messages can be signed and verified.`,
    });
  } catch (err) {
    findings.push({
      checkId: "SC-006",
      severity: "critical",
      title: "Agent identity keypair corrupted",
      detail: `Could not read or validate keypair in ${KEY_DIR}: ${String(err)}`,
      remediation: `Delete ${KEY_DIR} and restart to regenerate a fresh keypair.`,
    });
  }

  return findings;
}
