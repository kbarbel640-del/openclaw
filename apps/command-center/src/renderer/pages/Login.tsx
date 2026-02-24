/**
 * Login Page — entry point for authenticated access.
 *
 * Three auth paths:
 *   1. Biometric (Touch ID / Windows Hello) — fastest, shown if enrolled
 *   2. Password + optional TOTP 2FA
 *   3. First-run redirect → SetupAccount
 */

import React, { useState, useEffect, useCallback } from "react";
import type { OcccBridge, AuthSession } from "../../shared/ipc-types.js";

const occc = (window as unknown as { occc: OcccBridge }).occc;

interface LoginPageProps {
  onAuthenticated: (session: AuthSession, token: string) => void;
  onFirstRun: () => void;
}

type LoginStep = "idle" | "loading" | "totp" | "error";

export function LoginPage({ onAuthenticated, onFirstRun }: LoginPageProps) {
  const [step, setStep] = useState<LoginStep>("idle");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [totpCode, setTotpCode] = useState("");
  const [pendingNonce, setPendingNonce] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [isFirstRun, setIsFirstRun] = useState(false);

  // Check first-run and biometric availability on mount
  useEffect(() => {
    const occcUnknown = occc as unknown as { invoke: (ch: string) => Promise<boolean> };
    void Promise.all([
      occcUnknown.invoke("occc:auth:is-first-run"),
      occcUnknown.invoke("occc:auth:biometric-available"),
    ]).then(([firstRun, biometric]) => {
      setIsFirstRun(firstRun);
      setBiometricAvailable(biometric);
      if (firstRun) { onFirstRun(); }
    }).catch(() => {});
  }, [onFirstRun]);

  const handleBiometric = useCallback(async () => {
    if (!username) {
      setError("Enter your username first, then use Touch ID");
      return;
    }
    setStep("loading");
    setError(null);
    try {
      const result = await occc.biometricAuth();
      if (result && "token" in result) {
        onAuthenticated(result.session, result.token);
      } else {
        setError("Biometric authentication failed. Try your password.");
        setStep("idle");
      }
    } catch {
      setError("Biometric unavailable.");
      setStep("idle");
    }
  }, [username, onAuthenticated]);

  const handleLogin = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setStep("loading");
    setError(null);
    try {
      const result = await occc.login(username, password);
      if (!result) {
        setError("Invalid username or password.");
        setStep("idle");
        return;
      }
      const res = result as unknown as { requiresTotp: boolean; nonce: string; session: AuthSession; token: string };
      if (res.requiresTotp) {
        setPendingNonce(res.nonce);
        setStep("totp");
        return;
      }
      onAuthenticated(res.session, res.token);
    } catch {
      setError("Login failed. Please try again.");
      setStep("idle");
    }
  }, [username, password, onAuthenticated]);

  const handleTotp = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pendingNonce) {return;}
    setStep("loading");
    setError(null);
    try {
      const result = await occc.verifyTotp(totpCode) as unknown as { session: AuthSession; token: string } | null;
      if (!result) {
        setError("Invalid authentication code. Try again.");
        setStep("totp");
        return;
      }
      onAuthenticated(result.session, result.token);
    } catch {
      setError("Verification failed.");
      setStep("totp");
    }
  }, [pendingNonce, totpCode, onAuthenticated]);

  if (isFirstRun) {return null;}

  return (
    <div style={styles.page}>
      {/* Background gradient orbs */}
      <div style={styles.orb1} />
      <div style={styles.orb2} />

      <div style={styles.card}>
        {/* Logo */}
        <div style={styles.logoArea}>
          <div style={styles.logoMark}>⬡</div>
          <h1 style={styles.appName}>OpenClaw</h1>
          <p style={styles.appSub}>Command Center</p>
        </div>

        {(["idle", "loading", "error"] as string[]).includes(step) ? (
          <form onSubmit={handleLogin} style={styles.form}>
            <div style={styles.field}>
              <label style={styles.label}>Username</label>
              <input
                style={styles.input}
                type="text"
                autoComplete="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="admin"
                required
              />
            </div>

            <div style={styles.field}>
              <label style={styles.label}>Password</label>
              <input
                style={styles.input}
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
              />
            </div>

            {error && <p style={styles.error}>{error}</p>}

            <button
              type="submit"
              style={styles.btnPrimary}
              disabled={step === "loading"}
            >
              {step === "loading" ? <span style={styles.spinner} /> : "Sign In"}
            </button>

            {biometricAvailable && (
              <button
                type="button"
                style={styles.btnBiometric}
                onClick={handleBiometric}
                disabled={step === "loading"}
              >
                <span style={{ fontSize: "18px" }}>&#9684;</span>
                Touch ID
              </button>
            )}
          </form>
        ) : (
          <form onSubmit={handleTotp} style={styles.form}>
            <div style={styles.totpInfo}>
              <div style={{ fontSize: "32px", marginBottom: "8px" }}>🔐</div>
              <p style={{ color: "var(--text-secondary)", textAlign: "center", lineHeight: 1.5 }}>
                Enter the 6-digit code from your authenticator app
              </p>
            </div>

            <div style={styles.field}>
              <label style={styles.label}>Authentication Code</label>
              <input
                style={{ ...styles.input, textAlign: "center", fontSize: "22px", letterSpacing: "8px" }}
                type="text"
                inputMode="numeric"
                pattern="[0-9]{6}"
                maxLength={6}
                value={totpCode}
                onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, ""))}
                placeholder="000000"
                autoFocus
                required
              />
            </div>

            {error && <p style={styles.error}>{error}</p>}

            <button
              type="submit"
              style={styles.btnPrimary}
              disabled={step === "loading" || totpCode.length !== 6}
            >
              {step === "loading" ? <span style={styles.spinner} /> : "Verify"}
            </button>

            <button
              type="button"
              style={styles.btnLink}
              onClick={() => { setStep("idle"); setTotpCode(""); setError(null); }}
            >
              ← Back
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

// Inline styles — avoids any CSP issues with className resolution at login time
const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "var(--bg-primary)",
    position: "relative",
    overflow: "hidden",
  },
  orb1: {
    position: "absolute",
    width: "500px",
    height: "500px",
    borderRadius: "50%",
    background: "radial-gradient(circle, rgba(99,102,241,0.12) 0%, transparent 70%)",
    top: "-150px",
    left: "-100px",
    pointerEvents: "none",
  },
  orb2: {
    position: "absolute",
    width: "400px",
    height: "400px",
    borderRadius: "50%",
    background: "radial-gradient(circle, rgba(34,197,94,0.06) 0%, transparent 70%)",
    bottom: "-100px",
    right: "-80px",
    pointerEvents: "none",
  },
  card: {
    width: "360px",
    background: "rgba(26, 26, 36, 0.85)",
    backdropFilter: "blur(20px)",
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: "20px",
    padding: "40px 32px",
    boxShadow: "0 24px 80px rgba(0,0,0,0.6)",
    position: "relative",
    zIndex: 1,
  },
  logoArea: {
    textAlign: "center",
    marginBottom: "32px",
  },
  logoMark: {
    fontSize: "48px",
    background: "linear-gradient(135deg, #6366f1, #22c55e)",
    WebkitBackgroundClip: "text",
    WebkitTextFillColor: "transparent",
    lineHeight: 1,
    marginBottom: "8px",
  },
  appName: {
    fontSize: "22px",
    fontWeight: 700,
    color: "var(--text-primary)",
    margin: 0,
  },
  appSub: {
    fontSize: "12px",
    color: "var(--text-tertiary)",
    letterSpacing: "0.1em",
    textTransform: "uppercase",
    margin: "4px 0 0",
  },
  form: {
    display: "flex",
    flexDirection: "column",
    gap: "16px",
  },
  field: {
    display: "flex",
    flexDirection: "column",
    gap: "6px",
  },
  label: {
    fontSize: "12px",
    fontWeight: 600,
    color: "var(--text-tertiary)",
    textTransform: "uppercase",
    letterSpacing: "0.04em",
  },
  input: {
    background: "rgba(30,30,42,0.8)",
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: "10px",
    padding: "10px 14px",
    fontSize: "14px",
    color: "var(--text-primary)",
    outline: "none",
    transition: "border-color 150ms",
    fontFamily: "inherit",
  },
  btnPrimary: {
    background: "linear-gradient(135deg, #6366f1, #4f46e5)",
    border: "none",
    borderRadius: "10px",
    padding: "11px",
    fontSize: "14px",
    fontWeight: 600,
    color: "white",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "8px",
    marginTop: "4px",
    transition: "opacity 150ms",
  },
  btnBiometric: {
    background: "rgba(30,30,42,0.6)",
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: "10px",
    padding: "10px",
    fontSize: "13px",
    fontWeight: 500,
    color: "var(--text-secondary)",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "8px",
  },
  btnLink: {
    background: "none",
    border: "none",
    color: "var(--text-tertiary)",
    cursor: "pointer",
    fontSize: "13px",
    padding: "4px",
    textAlign: "center",
  },
  error: {
    color: "var(--accent-danger)",
    fontSize: "13px",
    textAlign: "center",
    margin: 0,
  },
  totpInfo: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    padding: "8px 0",
  },
  spinner: {
    display: "inline-block",
    width: "16px",
    height: "16px",
    border: "2px solid rgba(255,255,255,0.3)",
    borderTopColor: "white",
    borderRadius: "50%",
    animation: "spin 0.7s linear infinite",
  },
};
