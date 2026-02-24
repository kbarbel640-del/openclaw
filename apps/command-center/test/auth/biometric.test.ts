/**
 * Biometric — unit tests for OS-native biometric auth helpers.
 *
 * These tests mock Electron's systemPreferences since no
 * real biometric hardware is available in CI.
 */

/* eslint-disable typescript-eslint/unbound-method */

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock electron before any imports touch it
vi.mock("electron", () => ({
  systemPreferences: {
    canPromptTouchID: vi.fn(),
    promptTouchID: vi.fn(),
  },
}));

import { isBiometricAvailable, promptBiometric } from "../../src/main/auth/biometric.js";
import { systemPreferences } from "electron";

const mockCanPrompt = vi.mocked(systemPreferences).canPromptTouchID;
const mockPrompt = vi.mocked(systemPreferences).promptTouchID;

beforeEach(() => {
  vi.resetAllMocks();
});

// ─── isBiometricAvailable() ──────────────────────────────────────────────

describe("isBiometricAvailable()", () => {
  it("returns true when Touch ID is available (macOS)", async () => {
    mockCanPrompt.mockReturnValue(true);
    // Only passes on darwin — test the function itself which checks process.platform
    const result = await isBiometricAvailable();
    if (process.platform === "darwin") {
      expect(result).toBe(true);
    } else {
      // Non-darwin always returns false regardless of mock
      expect(result).toBe(false);
    }
  });

  it("returns false when Touch ID throws", async () => {
    mockCanPrompt.mockImplementation(() => { throw new Error("no biometric"); });
    const result = await isBiometricAvailable();
    expect(result).toBe(false);
  });
});

// ─── promptBiometric() ──────────────────────────────────────────────────

describe("promptBiometric()", () => {
  it("returns not-available on non-darwin platforms", async () => {
    if (process.platform !== "darwin") {
      const result = await promptBiometric("test");
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.reason).toBe("not-available");
      }
    }
  });

  it("returns ok:true when Touch ID succeeds (darwin only)", async () => {
    if (process.platform !== "darwin") { return; }
    mockCanPrompt.mockReturnValue(true);
    mockPrompt.mockResolvedValue(undefined as never);
    const result = await promptBiometric("to test");
    expect(result.ok).toBe(true);
  });

  it("returns cancelled when user cancels Touch ID (darwin only)", async () => {
    if (process.platform !== "darwin") { return; }
    mockCanPrompt.mockReturnValue(true);
    mockPrompt.mockRejectedValue(new Error("userCancel"));
    const result = await promptBiometric("to test");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("cancelled");
    }
  });

  it("returns failed on generic Touch ID error (darwin only)", async () => {
    if (process.platform !== "darwin") { return; }
    mockCanPrompt.mockReturnValue(true);
    mockPrompt.mockRejectedValue(new Error("LAError.biometryNotAvailable"));
    const result = await promptBiometric("to test");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("failed");
    }
  });
});
