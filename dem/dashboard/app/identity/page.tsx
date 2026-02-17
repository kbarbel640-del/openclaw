"use client";

import type { DIDIdentity, DIDProof } from "@six-fingered-man/governance/identity";
import type { DIDDocument } from "@six-fingered-man/governance/types";
import {
  generateDID,
  resolveDID,
  signWithDID,
  verifyWithDID,
  toHex,
} from "@six-fingered-man/governance/identity";
import {
  Fingerprint,
  KeyRound,
  FileText,
  PenLine,
  ShieldCheck,
  ShieldX,
  Copy,
  Check,
  ChevronLeft,
  RefreshCw,
  Eye,
  EyeOff,
  Users,
} from "lucide-react";
import Link from "next/link";
import { useState, useCallback } from "react";
import { cn } from "@/lib/cn";

// ── Clipboard helper ─────────────────────────────────────────────────────────

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const copy = useCallback(() => {
    void navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }, [text]);

  return (
    <button
      onClick={copy}
      className="text-[var(--color-text-muted)] hover:text-[var(--color-accent)] transition-colors"
      title="Copy to clipboard"
    >
      {copied ? (
        <Check className="h-3.5 w-3.5 text-[var(--color-success)]" />
      ) : (
        <Copy className="h-3.5 w-3.5" />
      )}
    </button>
  );
}

// ── Section card wrapper ─────────────────────────────────────────────────────

function Section({
  icon: Icon,
  title,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-[var(--color-border)] bg-[var(--color-surface-hover)]">
        <Icon className="h-4 w-4 text-[var(--color-accent)]" />
        <h2 className="text-xs font-bold tracking-widest uppercase">{title}</h2>
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

// ── Labeled field ────────────────────────────────────────────────────────────

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="space-y-1">
      <div className="text-[10px] uppercase tracking-widest text-[var(--color-text-muted)]">
        {label}
      </div>
      <div className="flex items-start gap-2">
        <div className={cn("flex-1 text-xs break-all leading-relaxed", mono && "font-mono")}>
          {value}
        </div>
        <CopyButton text={value} />
      </div>
    </div>
  );
}

// ── Main page ────────────────────────────────────────────────────────────────

export default function IdentityDemoPage() {
  // Identity state
  const [identity, setIdentity] = useState<DIDIdentity | null>(null);
  const [showPrivateKey, setShowPrivateKey] = useState(false);
  const [didDoc, setDidDoc] = useState<DIDDocument | null>(null);

  // Signing state
  const [messageToSign, setMessageToSign] = useState("Hello, governed world!");
  const [proof, setProof] = useState<DIDProof | null>(null);
  const [signedMessage, setSignedMessage] = useState<string | null>(null);

  // Verification state
  const [verifyResult, setVerifyResult] = useState<boolean | null>(null);
  const [tamperMessage, setTamperMessage] = useState("");

  // Cross-identity state
  const [alice, setAlice] = useState<DIDIdentity | null>(null);
  const [bob, setBob] = useState<DIDIdentity | null>(null);
  const [crossProof, setCrossProof] = useState<DIDProof | null>(null);
  const [crossMessage, setCrossMessage] = useState("Permission granted to access Project Alpha");
  const [crossVerifyAlice, setCrossVerifyAlice] = useState<boolean | null>(null);
  const [crossVerifyBob, setCrossVerifyBob] = useState<boolean | null>(null);

  // ── Handlers ─────────────────────────────────────────────────────────────

  const handleGenerate = useCallback(() => {
    const id = generateDID();
    setIdentity(id);
    setDidDoc(resolveDID(id.did));
    setProof(null);
    setSignedMessage(null);
    setVerifyResult(null);
    setShowPrivateKey(false);
  }, []);

  const handleSign = useCallback(() => {
    if (!identity) {
      return;
    }
    const data = new TextEncoder().encode(messageToSign);
    const p = signWithDID(data, identity.privateKey, identity.did);
    setProof(p);
    setSignedMessage(messageToSign);
    setVerifyResult(null);
    setTamperMessage(messageToSign);
  }, [identity, messageToSign]);

  const handleVerify = useCallback(() => {
    if (!identity || !proof) {
      return;
    }
    const data = new TextEncoder().encode(tamperMessage);
    const valid = verifyWithDID(data, proof, identity.did);
    setVerifyResult(valid);
  }, [identity, proof, tamperMessage]);

  const handleCrossGenerate = useCallback(() => {
    setAlice(generateDID());
    setBob(generateDID());
    setCrossProof(null);
    setCrossVerifyAlice(null);
    setCrossVerifyBob(null);
  }, []);

  const handleCrossSign = useCallback(() => {
    if (!alice) {
      return;
    }
    const data = new TextEncoder().encode(crossMessage);
    const p = signWithDID(data, alice.privateKey, alice.did);
    setCrossProof(p);
    setCrossVerifyAlice(null);
    setCrossVerifyBob(null);
  }, [alice, crossMessage]);

  const handleCrossVerify = useCallback(() => {
    if (!alice || !bob || !crossProof) {
      return;
    }
    const data = new TextEncoder().encode(crossMessage);
    setCrossVerifyAlice(verifyWithDID(data, crossProof, alice.did));
    setCrossVerifyBob(verifyWithDID(data, crossProof, bob.did));
  }, [alice, bob, crossProof, crossMessage]);

  return (
    <div className="flex flex-col h-screen">
      {/* Header */}
      <header
        className={cn(
          "flex items-center justify-between px-6 py-3",
          "border-b border-[var(--color-border)]",
          "bg-[var(--color-surface)]",
        )}
      >
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors"
          >
            <ChevronLeft className="h-5 w-5" />
          </Link>
          <Fingerprint className="h-6 w-6 text-[var(--color-accent)]" />
          <h1 className="text-lg font-bold tracking-widest uppercase text-[var(--color-text)]">
            Identity Lab
          </h1>
          <span className="text-xs text-[var(--color-text-muted)] tracking-wider ml-2">
            DID GENERATION &amp; VERIFICATION
          </span>
        </div>
        <div className="text-[10px] text-[var(--color-text-muted)] tracking-wider uppercase">
          W3C did:key / Ed25519
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6 space-y-6">
        {/* Row 1: Generate + DID Document */}
        <div className="grid grid-cols-2 gap-6">
          {/* Generate DID */}
          <Section icon={KeyRound} title="Generate DID">
            <div className="space-y-4">
              <button
                onClick={handleGenerate}
                className={cn(
                  "flex items-center gap-2 px-4 py-2 rounded text-xs font-medium uppercase tracking-wider",
                  "bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)]",
                  "text-white transition-colors",
                )}
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Generate New Identity
              </button>

              {identity && (
                <div className="space-y-3 animate-slide-in">
                  <Field label="DID" value={identity.did} mono />
                  <Field label="Public Key (hex)" value={toHex(identity.publicKey)} mono />
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <div className="text-[10px] uppercase tracking-widest text-[var(--color-text-muted)]">
                        Private Key (hex)
                      </div>
                      <button
                        onClick={() => setShowPrivateKey(!showPrivateKey)}
                        className="text-[var(--color-text-muted)] hover:text-[var(--color-accent)] transition-colors"
                      >
                        {showPrivateKey ? (
                          <EyeOff className="h-3 w-3" />
                        ) : (
                          <Eye className="h-3 w-3" />
                        )}
                      </button>
                    </div>
                    <div className="text-xs font-mono break-all leading-relaxed">
                      {showPrivateKey ? toHex(identity.privateKey) : "\u2022".repeat(64)}
                    </div>
                  </div>
                </div>
              )}

              {!identity && (
                <div className="text-xs text-[var(--color-text-muted)] py-4 text-center">
                  Click above to generate a fresh Ed25519 keypair and derive a W3C did:key
                  identifier.
                </div>
              )}
            </div>
          </Section>

          {/* DID Document */}
          <Section icon={FileText} title="DID Document">
            {didDoc ? (
              <div className="space-y-3 animate-slide-in">
                <div className="flex items-center justify-between">
                  <div className="text-[10px] uppercase tracking-widest text-[var(--color-text-muted)]">
                    Resolved Document
                  </div>
                  <CopyButton text={JSON.stringify(didDoc, null, 2)} />
                </div>
                <pre className="text-[11px] font-mono leading-relaxed overflow-auto max-h-72 p-3 rounded bg-[var(--color-bg)] border border-[var(--color-border)]">
                  {JSON.stringify(didDoc, null, 2)}
                </pre>
                <div className="flex items-center gap-2 text-[10px] text-[var(--color-success)]">
                  <ShieldCheck className="h-3 w-3" />
                  <span>Deterministic resolution — no network call required</span>
                </div>
              </div>
            ) : (
              <div className="text-xs text-[var(--color-text-muted)] py-4 text-center">
                Generate a DID to see its resolved DID Document. For did:key, resolution is purely
                local and deterministic.
              </div>
            )}
          </Section>
        </div>

        {/* Row 2: Sign + Verify */}
        <div className="grid grid-cols-2 gap-6">
          {/* Sign */}
          <Section icon={PenLine} title="Sign Message">
            <div className="space-y-4">
              <div className="space-y-1">
                <div className="text-[10px] uppercase tracking-widest text-[var(--color-text-muted)]">
                  Message
                </div>
                <textarea
                  value={messageToSign}
                  onChange={(e) => setMessageToSign(e.target.value)}
                  disabled={!identity}
                  rows={3}
                  className={cn(
                    "w-full text-xs font-mono p-3 rounded resize-none",
                    "bg-[var(--color-bg)] border border-[var(--color-border)]",
                    "text-[var(--color-text)] placeholder:text-[var(--color-text-muted)]",
                    "focus:outline-none focus:border-[var(--color-accent)]",
                    "disabled:opacity-40",
                  )}
                  placeholder="Enter a message to sign..."
                />
              </div>
              <button
                onClick={handleSign}
                disabled={!identity}
                className={cn(
                  "flex items-center gap-2 px-4 py-2 rounded text-xs font-medium uppercase tracking-wider",
                  "bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)]",
                  "text-white transition-colors",
                  "disabled:opacity-40 disabled:cursor-not-allowed",
                )}
              >
                <PenLine className="h-3.5 w-3.5" />
                Sign with DID
              </button>

              {proof && (
                <div className="space-y-3 animate-slide-in">
                  <Field label="Proof Type" value={proof.type} />
                  <Field label="Verification Method" value={proof.verificationMethod} mono />
                  <Field label="Created" value={proof.created} />
                  <Field label="Proof Value (multibase)" value={proof.proofValue} mono />
                </div>
              )}
            </div>
          </Section>

          {/* Verify */}
          <Section icon={ShieldCheck} title="Verify Signature">
            <div className="space-y-4">
              {proof ? (
                <>
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <div className="text-[10px] uppercase tracking-widest text-[var(--color-text-muted)]">
                        Message to verify
                      </div>
                      <div className="text-[10px] text-[var(--color-text-muted)]">
                        Edit to test tamper detection
                      </div>
                    </div>
                    <textarea
                      value={tamperMessage}
                      onChange={(e) => {
                        setTamperMessage(e.target.value);
                        setVerifyResult(null);
                      }}
                      rows={3}
                      className={cn(
                        "w-full text-xs font-mono p-3 rounded resize-none",
                        "bg-[var(--color-bg)] border border-[var(--color-border)]",
                        "text-[var(--color-text)]",
                        "focus:outline-none focus:border-[var(--color-accent)]",
                        tamperMessage !== signedMessage && "border-[var(--color-warning)]/50",
                      )}
                    />
                    {tamperMessage !== signedMessage && (
                      <div className="flex items-center gap-1 text-[10px] text-[var(--color-warning)]">
                        <ShieldX className="h-3 w-3" />
                        Message has been modified from the signed original
                      </div>
                    )}
                  </div>

                  <button
                    onClick={handleVerify}
                    className={cn(
                      "flex items-center gap-2 px-4 py-2 rounded text-xs font-medium uppercase tracking-wider",
                      "bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)]",
                      "text-white transition-colors",
                    )}
                  >
                    <ShieldCheck className="h-3.5 w-3.5" />
                    Verify Signature
                  </button>

                  {verifyResult !== null && (
                    <div
                      className={cn(
                        "flex items-center gap-2 p-3 rounded text-xs font-medium animate-slide-in",
                        "border",
                        verifyResult
                          ? "bg-[var(--color-success)]/10 border-[var(--color-success)]/30 text-[var(--color-success)]"
                          : "bg-[var(--color-danger)]/10 border-[var(--color-danger)]/30 text-[var(--color-danger)]",
                      )}
                    >
                      {verifyResult ? (
                        <>
                          <ShieldCheck className="h-4 w-4" />
                          VALID — Signature verified against {identity?.did.slice(0, 24)}...
                        </>
                      ) : (
                        <>
                          <ShieldX className="h-4 w-4" />
                          INVALID — Signature does not match.{" "}
                          {tamperMessage !== signedMessage
                            ? "Data was tampered with."
                            : "Wrong signer or corrupted proof."}
                        </>
                      )}
                    </div>
                  )}
                </>
              ) : (
                <div className="text-xs text-[var(--color-text-muted)] py-4 text-center">
                  Sign a message first, then verify it here. You can edit the message text before
                  verifying to test tamper detection.
                </div>
              )}
            </div>
          </Section>
        </div>

        {/* Row 3: Cross-Identity Verification */}
        <Section icon={Users} title="Cross-Identity Verification">
          <div className="space-y-4">
            <p className="text-xs text-[var(--color-text-muted)]">
              Simulate a permission contract scenario: Alice signs a message, then verify it against
              both Alice&apos;s and Bob&apos;s DIDs. Only the signer&apos;s DID should verify.
            </p>

            <div className="flex items-center gap-3">
              <button
                onClick={handleCrossGenerate}
                className={cn(
                  "flex items-center gap-2 px-4 py-2 rounded text-xs font-medium uppercase tracking-wider",
                  "bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)]",
                  "text-white transition-colors",
                )}
              >
                <Users className="h-3.5 w-3.5" />
                Generate Alice + Bob
              </button>
            </div>

            {alice && bob && (
              <div className="space-y-4 animate-slide-in">
                {/* Alice and Bob cards */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-3 rounded border border-[var(--color-accent)]/30 bg-[var(--color-accent)]/5">
                    <div className="text-[10px] uppercase tracking-widest text-[var(--color-accent)] mb-2 font-bold">
                      Alice (Signer)
                    </div>
                    <div className="text-[11px] font-mono break-all text-[var(--color-text-muted)]">
                      {alice.did}
                    </div>
                  </div>
                  <div className="p-3 rounded border border-[var(--color-warning)]/30 bg-[var(--color-warning)]/5">
                    <div className="text-[10px] uppercase tracking-widest text-[var(--color-warning)] mb-2 font-bold">
                      Bob (Verifier)
                    </div>
                    <div className="text-[11px] font-mono break-all text-[var(--color-text-muted)]">
                      {bob.did}
                    </div>
                  </div>
                </div>

                {/* Message + Sign */}
                <div className="space-y-2">
                  <div className="text-[10px] uppercase tracking-widest text-[var(--color-text-muted)]">
                    Permission Contract Message
                  </div>
                  <textarea
                    value={crossMessage}
                    onChange={(e) => setCrossMessage(e.target.value)}
                    rows={2}
                    className={cn(
                      "w-full text-xs font-mono p-3 rounded resize-none",
                      "bg-[var(--color-bg)] border border-[var(--color-border)]",
                      "text-[var(--color-text)]",
                      "focus:outline-none focus:border-[var(--color-accent)]",
                    )}
                  />
                  <div className="flex items-center gap-3">
                    <button
                      onClick={handleCrossSign}
                      className={cn(
                        "flex items-center gap-2 px-4 py-2 rounded text-xs font-medium uppercase tracking-wider",
                        "bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)]",
                        "text-white transition-colors",
                      )}
                    >
                      <PenLine className="h-3.5 w-3.5" />
                      Alice Signs
                    </button>

                    {crossProof && (
                      <button
                        onClick={handleCrossVerify}
                        className={cn(
                          "flex items-center gap-2 px-4 py-2 rounded text-xs font-medium uppercase tracking-wider",
                          "bg-[var(--color-surface-hover)] hover:bg-[var(--color-border)]",
                          "text-[var(--color-text)] transition-colors",
                          "border border-[var(--color-border)]",
                        )}
                      >
                        <ShieldCheck className="h-3.5 w-3.5" />
                        Verify Against Both
                      </button>
                    )}
                  </div>
                </div>

                {/* Cross-verify results */}
                {crossVerifyAlice !== null && crossVerifyBob !== null && (
                  <div className="grid grid-cols-2 gap-4 animate-slide-in">
                    <div
                      className={cn(
                        "flex items-center gap-2 p-3 rounded text-xs font-medium border",
                        crossVerifyAlice
                          ? "bg-[var(--color-success)]/10 border-[var(--color-success)]/30 text-[var(--color-success)]"
                          : "bg-[var(--color-danger)]/10 border-[var(--color-danger)]/30 text-[var(--color-danger)]",
                      )}
                    >
                      {crossVerifyAlice ? (
                        <ShieldCheck className="h-4 w-4" />
                      ) : (
                        <ShieldX className="h-4 w-4" />
                      )}
                      <span>Alice: {crossVerifyAlice ? "VALID" : "INVALID"}</span>
                    </div>
                    <div
                      className={cn(
                        "flex items-center gap-2 p-3 rounded text-xs font-medium border",
                        crossVerifyBob
                          ? "bg-[var(--color-success)]/10 border-[var(--color-success)]/30 text-[var(--color-success)]"
                          : "bg-[var(--color-danger)]/10 border-[var(--color-danger)]/30 text-[var(--color-danger)]",
                      )}
                    >
                      {crossVerifyBob ? (
                        <ShieldCheck className="h-4 w-4" />
                      ) : (
                        <ShieldX className="h-4 w-4" />
                      )}
                      <span>Bob: {crossVerifyBob ? "VALID" : "INVALID"}</span>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </Section>

        {/* Info footer */}
        <div className="text-center text-[10px] text-[var(--color-text-muted)] tracking-wider pb-4 space-y-1">
          <div>All cryptographic operations run locally in the browser using @noble/ed25519</div>
          <div>
            W3C did:key resolution is deterministic — no blockchain or network calls required
          </div>
        </div>
      </div>
    </div>
  );
}
