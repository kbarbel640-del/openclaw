/**
 * First-Run Account Setup — creates the initial Super Admin account.
 *
 * Guides the user through:
 *   1. Username + password
 *   2. TOTP (2FA) setup with QR code — mandatory for Super Admin
 *   3. Biometric enrollment (optional)
 */

import React, { useState, useCallback } from "react";
import type { AuthSession, OcccBridge } from "../../shared/ipc-types.js";

const occc = (window as unknown as { occc: OcccBridge }).occc;

interface SetupAccountProps {
  onComplete: (session: AuthSession, token: string) => void;
}

type SetupStep = "credentials" | "totp-setup" | "biometric" | "done";

export function SetupAccount({ onComplete }: SetupAccountProps) {
  const [step, setStep] = useState<SetupStep>("credentials");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [totpSetup, setTotpSetup] = useState<{ secret: string; qrDataUrl: string; otpAuthUrl: string } | null>(null);
  const [totpCode, setTotpCode] = useState("");
  const [pendingSession, setPendingSession] = useState<{ session: AuthSession; token: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ─── Step 1: Create account ────────────────────────────────────────

  const handleCreateAccount = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password.length < 12) {
      setError("Password must be at least 12 characters.");
      return;
    }
    if (password !== passwordConfirm) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      const result = await occc.createInitialUser(username, password);
      setTotpSetup(result.totpSetup);
      setStep("totp-setup");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Setup failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [username, password, passwordConfirm]);

  // ─── Step 2: Verify TOTP ───────────────────────────────────────────

  const handleTotpConfirm = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!totpSetup) {return;}
    setLoading(true);
    setError(null);

    try {
      // Log in to get a session token
      const loginResult = await occc.login(username, password);
      if (!loginResult || !("token" in loginResult)) {throw new Error("Login failed after setup");}

      const confirmed = await occc.confirmTotp(loginResult.token, totpCode);
      if (!confirmed) {
        setError("Invalid code. Scan the QR again and try.");
        setLoading(false);
        return;
      }

      setPendingSession({ session: loginResult.session, token: loginResult.token });
      setStep("biometric");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "TOTP verification failed.");
    } finally {
      setLoading(false);
    }
  }, [totpSetup, username, password, totpCode]);

  // ─── Step 3: Biometric enrollment ─────────────────────────────────

  const handleBiometricEnroll = useCallback(async () => {
    if (!pendingSession) {return;}
    setLoading(true);
    try {
      await occc.enrollBiometric(pendingSession.token);
    } catch {
      // Non-fatal — biometric enrollment is optional
    } finally {
      setLoading(false);
      finishSetup();
    }
  }, [pendingSession]);

  const finishSetup = useCallback(() => {
    if (pendingSession) {
      onComplete(pendingSession.session, pendingSession.token);
    }
  }, [pendingSession, onComplete]);

  // ─── Render ────────────────────────────────────────────────────────

  const progress = step === "credentials" ? 1 : step === "totp-setup" ? 2 : step === "biometric" ? 3 : 4;

  return (
    <div style={styles.page}>
      <div style={styles.orb} />

      <div style={styles.card}>
        {/* Header */}
        <div style={styles.header}>
          <div style={styles.logoMark}>⬡</div>
          <h1 style={styles.title}>Welcome to OpenClaw</h1>
          <p style={styles.subtitle}>Let's set up your secure administrator account</p>
        </div>

        {/* Progress */}
        <div style={styles.progress}>
          {["Account", "2FA Setup", "Biometric"].map((label, i) => (
            <div key={label} style={styles.progressItem}>
              <div style={{
                ...styles.progressDot,
                background: i + 1 <= progress ? "var(--accent-primary)" : "var(--surface-2)",
                boxShadow: i + 1 === progress ? "0 0 12px rgba(99,102,241,0.5)" : "none",
              }}>
                {i + 1 < progress ? "✓" : i + 1}
              </div>
              <span style={{ fontSize: "11px", color: i + 1 <= progress ? "var(--text-secondary)" : "var(--text-muted)" }}>
                {label}
              </span>
            </div>
          ))}
        </div>

        {/* ── Step 1: Credentials ── */}
        {step === "credentials" && (
          <form onSubmit={handleCreateAccount} style={styles.form}>
            <div style={styles.stepInfo}>
              <p style={styles.stepDesc}>
                This account will have full administrator access to OpenClaw Command Center.
              </p>
            </div>

            <div style={styles.field}>
              <label style={styles.label}>Username</label>
              <input
                style={styles.input}
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="admin"
                autoComplete="username"
                minLength={3}
                required
              />
            </div>

            <div style={styles.field}>
              <label style={styles.label}>Password <span style={{ color: "var(--text-tertiary)" }}>(min. 12 characters)</span></label>
              <input
                style={styles.input}
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                autoComplete="new-password"
                minLength={12}
                required
              />
            </div>

            <div style={styles.field}>
              <label style={styles.label}>Confirm Password</label>
              <input
                style={styles.input}
                type="password"
                value={passwordConfirm}
                onChange={(e) => setPasswordConfirm(e.target.value)}
                placeholder="••••••••••••"
                autoComplete="new-password"
                required
              />
            </div>

            {error && <p style={styles.error}>{error}</p>}

            <button type="submit" style={styles.btnPrimary} disabled={loading}>
              {loading ? <Spinner /> : "Continue →"}
            </button>
          </form>
        )}

        {/* ── Step 2: TOTP Setup ── */}
        {step === "totp-setup" && totpSetup && (
          <form onSubmit={handleTotpConfirm} style={styles.form}>
            <div style={styles.stepInfo}>
              <p style={styles.stepDesc}>
                Scan this QR code with Google Authenticator, Authy, or 1Password, then enter the 6-digit code to confirm.
              </p>
            </div>

            {totpSetup.qrDataUrl ? (
              <div style={styles.qrContainer}>
                <img src={totpSetup.qrDataUrl} alt="TOTP QR Code" style={{ width: 200, height: 200, borderRadius: 8 }} />
              </div>
            ) : (
              <div style={styles.manualSecret}>
                <p style={{ fontSize: "11px", color: "var(--text-tertiary)", marginBottom: 6 }}>Manual entry key:</p>
                <code style={styles.code}>{totpSetup.secret}</code>
              </div>
            )}

            <div style={styles.field}>
              <label style={styles.label}>Verification Code</label>
              <input
                style={{ ...styles.input, textAlign: "center", fontSize: "24px", letterSpacing: "10px" }}
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

            <button type="submit" style={styles.btnPrimary} disabled={loading || totpCode.length !== 6}>
              {loading ? <Spinner /> : "Verify & Continue →"}
            </button>
          </form>
        )}

        {/* ── Step 3: Biometric ── */}
        {step === "biometric" && (
          <div style={styles.form}>
            <div style={styles.stepInfo}>
              <div style={{ fontSize: "48px", textAlign: "center" }}>&#9684;</div>
              <p style={styles.stepDesc}>
                Enable Touch ID / Windows Hello for quick, secure access without typing your password.
              </p>
            </div>

            <button
              style={styles.btnPrimary}
              onClick={handleBiometricEnroll}
              disabled={loading}
            >
              {loading ? <Spinner /> : "Enable Biometric"}
            </button>

            <button
              style={styles.btnSecondary}
              onClick={finishSetup}
              disabled={loading}
            >
              Skip for now
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function Spinner() {
  return (
    <span style={{
      display: "inline-block",
      width: "16px",
      height: "16px",
      border: "2px solid rgba(255,255,255,0.3)",
      borderTopColor: "white",
      borderRadius: "50%",
    }} />
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "var(--bg-primary)",
    position: "relative",
    overflow: "hidden",
    padding: "24px",
  },
  orb: {
    position: "absolute",
    width: "600px",
    height: "600px",
    borderRadius: "50%",
    background: "radial-gradient(circle, rgba(99,102,241,0.1) 0%, transparent 70%)",
    top: "-200px",
    left: "50%",
    transform: "translateX(-50%)",
    pointerEvents: "none",
  },
  card: {
    width: "460px",
    background: "rgba(26, 26, 36, 0.9)",
    backdropFilter: "blur(20px)",
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: "20px",
    padding: "40px 36px",
    boxShadow: "0 24px 80px rgba(0,0,0,0.6)",
    position: "relative",
    zIndex: 1,
  },
  header: {
    textAlign: "center",
    marginBottom: "28px",
  },
  logoMark: {
    fontSize: "40px",
    background: "linear-gradient(135deg, #6366f1, #22c55e)",
    WebkitBackgroundClip: "text",
    WebkitTextFillColor: "transparent",
    lineHeight: 1,
    marginBottom: "12px",
  },
  title: {
    fontSize: "20px",
    fontWeight: 700,
    color: "var(--text-primary)",
    margin: "0 0 6px",
  },
  subtitle: {
    fontSize: "13px",
    color: "var(--text-tertiary)",
    margin: 0,
  },
  progress: {
    display: "flex",
    justifyContent: "center",
    gap: "32px",
    marginBottom: "28px",
    padding: "0 8px",
  },
  progressItem: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "6px",
  },
  progressDot: {
    width: "28px",
    height: "28px",
    borderRadius: "50%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "11px",
    fontWeight: 700,
    color: "white",
    transition: "all 300ms",
  },
  form: {
    display: "flex",
    flexDirection: "column",
    gap: "16px",
  },
  stepInfo: {
    textAlign: "center",
    marginBottom: "4px",
  },
  stepDesc: {
    fontSize: "13px",
    color: "var(--text-secondary)",
    lineHeight: 1.6,
    margin: 0,
  },
  field: { display: "flex", flexDirection: "column", gap: "6px" },
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
    fontFamily: "inherit",
  },
  btnPrimary: {
    background: "linear-gradient(135deg, #6366f1, #4f46e5)",
    border: "none",
    borderRadius: "10px",
    padding: "12px",
    fontSize: "14px",
    fontWeight: 600,
    color: "white",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "8px",
    marginTop: "4px",
  },
  btnSecondary: {
    background: "transparent",
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: "10px",
    padding: "11px",
    fontSize: "13px",
    color: "var(--text-tertiary)",
    cursor: "pointer",
  },
  error: {
    color: "var(--accent-danger)",
    fontSize: "13px",
    textAlign: "center",
    margin: 0,
  },
  qrContainer: {
    display: "flex",
    justifyContent: "center",
    padding: "16px",
    background: "white",
    borderRadius: "12px",
  },
  manualSecret: {
    background: "var(--surface-1)",
    borderRadius: "10px",
    padding: "12px 16px",
  },
  code: {
    fontFamily: "var(--font-mono)",
    fontSize: "13px",
    color: "var(--accent-primary-hover)",
    wordBreak: "break-all",
  },
};
