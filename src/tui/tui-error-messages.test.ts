import { describe, it, expect } from "vitest";
import { formatOllamaError, isRetryableError, suggestRecovery } from "./tui-error-messages.js";

describe("formatOllamaError", () => {
  const cases: Array<[string, string]> = [
    ["ECONNREFUSED", "Can't reach Ollama"],
    ["model not found", "Model not available locally"],
    ["out of memory", "Not enough RAM"],
    ["OOM killed", "Not enough RAM"],
    ["context length exceeded", "Conversation too long"],
    ["GPU out of memory", "GPU memory full"],
    ["CUDA out of memory", "GPU memory full"],
    ["503 Service Unavailable", "Model is loading"],
    ["model loading", "Model is loading"],
    ["timeout", "Response timed out"],
    ["ETIMEDOUT", "Response timed out"],
  ];

  for (const [input, expectedSubstring] of cases) {
    it(`maps "${input}" to friendly message`, () => {
      expect(formatOllamaError(input)).toContain(expectedSubstring);
    });

    it(`handles Error object for "${input}"`, () => {
      expect(formatOllamaError(new Error(input))).toContain(expectedSubstring);
    });
  }

  it("wraps unknown errors generically", () => {
    const result = formatOllamaError("some weird failure");
    expect(result).toBe("🌿 Something went wrong: some weird failure");
  });
});

describe("isRetryableError", () => {
  it("returns true for transient errors", () => {
    expect(isRetryableError("ECONNREFUSED")).toBe(true);
    expect(isRetryableError("503")).toBe(true);
    expect(isRetryableError("timeout")).toBe(true);
  });

  it("returns false for permanent errors", () => {
    expect(isRetryableError("model not found")).toBe(false);
    expect(isRetryableError("out of memory")).toBe(false);
    expect(isRetryableError("unknown error")).toBe(false);
  });
});

describe("suggestRecovery", () => {
  it("suggests ollama serve for connection refused", () => {
    expect(suggestRecovery("ECONNREFUSED")).toBe("ollama serve");
  });

  it("suggests pull for model not found", () => {
    expect(suggestRecovery("model not found")).toBe("ollama pull <model>");
  });

  it("suggests /compact for context length", () => {
    expect(suggestRecovery("context length exceeded")).toBe("/compact");
  });

  it("returns null for errors without recovery", () => {
    expect(suggestRecovery("503")).toBeNull();
    expect(suggestRecovery("unknown")).toBeNull();
  });
});
