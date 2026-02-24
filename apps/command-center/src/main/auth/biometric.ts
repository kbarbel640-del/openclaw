/**
 * Biometric Auth — wraps OS-native biometric authentication.
 *
 * macOS:   Touch ID via systemPreferences.promptTouchID()
 * Windows: Windows Hello via electron's systemPreferences (future)
 * Linux:   Falls back gracefully — not supported natively in Electron
 */

import { systemPreferences } from "electron";

export type BiometricResult =
  | { ok: true }
  | { ok: false; reason: "not-available" | "not-enrolled" | "failed" | "cancelled" };

/**
 * Check if biometric auth is available on this system.
 */
export async function isBiometricAvailable(): Promise<boolean> {
  if (process.platform === "darwin") {
    try {
      const canPrompt = systemPreferences.canPromptTouchID();
      return canPrompt;
    } catch {
      return false;
    }
  }
  // Windows Hello / Linux PAM — not yet implemented, future phase
  return false;
}

/**
 * Prompt the user for biometric authentication.
 *
 * @param reason - Text shown in the biometric prompt (e.g., "to unlock configuration")
 */
export async function promptBiometric(reason: string): Promise<BiometricResult> {
  if (process.platform === "darwin") {
    return promptTouchId(reason);
  }

  // Fallback: biometric not available
  return { ok: false, reason: "not-available" };
}

async function promptTouchId(reason: string): Promise<BiometricResult> {
  try {
    const available = systemPreferences.canPromptTouchID();
    if (!available) {
      return { ok: false, reason: "not-available" };
    }

    await systemPreferences.promptTouchID(`OpenClaw — ${reason}`);
    return { ok: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("cancelled") || msg.includes("userCancel")) {
      return { ok: false, reason: "cancelled" };
    }
    return { ok: false, reason: "failed" };
  }
}
