/**
 * Elevation Modal — prompts biometric or TOTP re-auth for sensitive operations.
 *
 * Shown automatically when the user tries to edit config, install a skill,
 * or perform any operation marked ALWAYS_REQUIRE_ELEVATE.
 */

import React, { useState, useCallback } from "react";
import type { OcccBridge } from "../../shared/ipc-types.js";

const occc = (window as unknown as { occc: OcccBridge }).occc;

interface ElevateModalProps {
  /** Description of what the user is trying to do ("edit configuration"). */
  operationLabel: string;
  sessionToken: string;
  biometricAvailable: boolean;
  onSuccess: () => void;
  onCancel: () => void;
}

export function ElevateModal({
  operationLabel,
  sessionToken,
  biometricAvailable,
  onSuccess,
  onCancel,
}: ElevateModalProps) {
  const [totpCode, setTotpCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showTotp, setShowTotp] = useState(!biometricAvailable);

  const handleBiometric = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await occc.elevate(sessionToken);
      if (result?.ok) {
        onSuccess();
      } else if (result?.reason === "biometric-cancelled") {
        setLoading(false);
      } else {
        // Biometric failed — fall back to TOTP
        setShowTotp(true);
        setLoading(false);
      }
    } catch {
      setShowTotp(true);
      setLoading(false);
    }
  }, [sessionToken, onSuccess]);

  const handleTotp = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const result = await occc.elevate(sessionToken, totpCode);
      if (result?.ok) {
        onSuccess();
      } else {
        setError("Invalid code. Try again.");
        setLoading(false);
      }
    } catch {
      setError("Verification failed.");
      setLoading(false);
    }
  }, [sessionToken, totpCode, onSuccess]);

  return (
    <div style={overlay}>
      <div style={modal}>
        <div style={{ textAlign: "center", marginBottom: "24px" }}>
          <div style={{ fontSize: "36px", marginBottom: "12px" }}>🔒</div>
          <h2 style={{ fontSize: "17px", fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>
            Authentication Required
          </h2>
          <p style={{ fontSize: "13px", color: "var(--text-secondary)", margin: "8px 0 0" }}>
            Re-authenticate to <strong style={{ color: "var(--text-primary)" }}>{operationLabel}</strong>
          </p>
        </div>

        {!showTotp && biometricAvailable ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            <button
              style={btnBiometric}
              onClick={handleBiometric}
              disabled={loading}
            >
              {loading ? <Spinner /> : <span style={{ fontSize: "20px" }}>&#9684;</span>}
              Use Touch ID
            </button>
            <button style={btnLink} onClick={() => setShowTotp(true)} disabled={loading}>
              Use authenticator code instead
            </button>
            <button style={btnCancel} onClick={onCancel} disabled={loading}>
              Cancel
            </button>
          </div>
        ) : (
          <form onSubmit={handleTotp} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
            <div>
              <label style={labelStyle}>Authentication Code</label>
              <input
                style={inputStyle}
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
            {error && <p style={{ color: "var(--accent-danger)", fontSize: "13px", textAlign: "center", margin: 0 }}>{error}</p>}
            <button type="submit" style={btnPrimary} disabled={loading || totpCode.length !== 6}>
              {loading ? <Spinner /> : "Verify"}
            </button>
            {biometricAvailable && (
              <button type="button" style={btnLink} onClick={() => { setShowTotp(false); setTotpCode(""); }}>
                ← Use Touch ID instead
              </button>
            )}
            <button type="button" style={btnCancel} onClick={onCancel}>
              Cancel
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

function Spinner() {
  return (
    <span style={{ display: "inline-block", width: 16, height: 16, border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "white", borderRadius: "50%" }} />
  );
}

const overlay: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "rgba(0,0,0,0.7)",
  backdropFilter: "blur(8px)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 9999,
};
const modal: React.CSSProperties = {
  width: "340px",
  background: "rgba(26,26,36,0.95)",
  border: "1px solid rgba(255,255,255,0.1)",
  borderRadius: "16px",
  padding: "32px 28px",
  boxShadow: "0 24px 80px rgba(0,0,0,0.8)",
};
const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: "12px",
  fontWeight: 600,
  color: "var(--text-tertiary)",
  textTransform: "uppercase",
  letterSpacing: "0.04em",
  marginBottom: "6px",
};
const inputStyle: React.CSSProperties = {
  width: "100%",
  background: "rgba(30,30,42,0.8)",
  border: "1px solid rgba(255,255,255,0.1)",
  borderRadius: "10px",
  padding: "10px 14px",
  fontSize: "22px",
  letterSpacing: "8px",
  color: "var(--text-primary)",
  outline: "none",
  textAlign: "center",
  fontFamily: "inherit",
  boxSizing: "border-box",
};
const btnPrimary: React.CSSProperties = {
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
};
const btnBiometric: React.CSSProperties = {
  background: "rgba(30,30,42,0.6)",
  border: "1px solid rgba(255,255,255,0.12)",
  borderRadius: "10px",
  padding: "12px",
  fontSize: "14px",
  fontWeight: 500,
  color: "var(--text-primary)",
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: "10px",
};
const btnLink: React.CSSProperties = {
  background: "none",
  border: "none",
  color: "var(--text-tertiary)",
  cursor: "pointer",
  fontSize: "13px",
  padding: "4px",
  textAlign: "center",
};
const btnCancel: React.CSSProperties = {
  background: "transparent",
  border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: "10px",
  padding: "10px",
  fontSize: "13px",
  color: "var(--text-tertiary)",
  cursor: "pointer",
};
