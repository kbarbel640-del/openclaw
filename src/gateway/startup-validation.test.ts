import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import type { MoltbotConfig } from "../config/config.js";
import {
  formatValidationError,
  validateGatewayStartup,
  type StartupValidationResult,
} from "./startup-validation.js";

// Mock dependencies
vi.mock("../agents/models-config.js", () => ({
  ensureMoltbotModelsJson: vi.fn().mockResolvedValue({ agentDir: "/tmp/agent", wrote: true }),
}));

vi.mock("../agents/model-selection.js", () => ({
  resolveConfiguredModelRef: vi.fn().mockReturnValue({
    provider: "ollama",
    model: "llama3:chat",
  }),
}));

// We need to control resolveModel's behavior per test
const mockResolveModel = vi.fn();
vi.mock("../agents/pi-embedded-runner/model.js", () => ({
  resolveModel: (...args: unknown[]) => mockResolveModel(...args),
}));

describe("validateGatewayStartup", () => {
  const mockCfg: MoltbotConfig = {};
  const mockAgentDir = "/tmp/agent";

  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.CLAWDBOT_SKIP_STARTUP_VALIDATION;
  });

  afterEach(() => {
    delete process.env.CLAWDBOT_SKIP_STARTUP_VALIDATION;
  });

  it("returns ok when model resolves successfully", async () => {
    mockResolveModel.mockReturnValue({
      model: { id: "llama3:chat", provider: "ollama" },
      error: undefined,
    });

    const result = await validateGatewayStartup(mockCfg, mockAgentDir);

    expect(result.ok).toBe(true);
    expect(result.defaultModel).toEqual({ provider: "ollama", model: "llama3:chat" });
  });

  it("returns error when model resolution fails", async () => {
    mockResolveModel.mockReturnValue({
      model: undefined,
      error: "Unknown model: ollama/llama3:chat (agentDir: /tmp/agent)",
    });

    const result = await validateGatewayStartup(mockCfg, mockAgentDir);

    expect(result.ok).toBe(false);
    expect(result.error).toContain("Unknown model");
    expect(result.defaultModel).toEqual({ provider: "ollama", model: "llama3:chat" });
    expect(result.suggestions).toBeDefined();
    expect(result.suggestions?.length).toBeGreaterThan(0);
  });

  it("skips validation when CLAWDBOT_SKIP_STARTUP_VALIDATION is set", async () => {
    process.env.CLAWDBOT_SKIP_STARTUP_VALIDATION = "1";
    mockResolveModel.mockReturnValue({
      model: undefined,
      error: "Unknown model",
    });

    const result = await validateGatewayStartup(mockCfg, mockAgentDir);

    expect(result.ok).toBe(true);
    // resolveModel should not have been called
    expect(mockResolveModel).not.toHaveBeenCalled();
  });

  it("provides Ollama-specific suggestions for Ollama errors", async () => {
    mockResolveModel.mockReturnValue({
      model: undefined,
      error: "Unknown model: ollama/llama3:chat",
    });

    const result = await validateGatewayStartup(mockCfg, mockAgentDir);

    expect(result.suggestions).toBeDefined();
    const suggestions = result.suggestions?.join("\n") ?? "";
    expect(suggestions).toContain("ollama serve");
    expect(suggestions).toContain("ollama pull");
  });
});

describe("formatValidationError", () => {
  it("returns empty string for ok result", () => {
    const result: StartupValidationResult = { ok: true };
    expect(formatValidationError(result)).toBe("");
  });

  it("formats error message with model info", () => {
    const result: StartupValidationResult = {
      ok: false,
      error: "Unknown model: ollama/llama3:chat",
      defaultModel: { provider: "ollama", model: "llama3:chat" },
      suggestions: ["Start Ollama: ollama serve", "Pull the model: ollama pull llama3:chat"],
    };

    const formatted = formatValidationError(result);

    expect(formatted).toContain("Gateway startup validation failed");
    expect(formatted).toContain("Unknown model: ollama/llama3:chat");
    expect(formatted).toContain("Configured model: ollama/llama3:chat");
    expect(formatted).toContain("Suggestions:");
    expect(formatted).toContain("ollama serve");
    expect(formatted).toContain("ollama pull");
  });

  it("formats error without suggestions", () => {
    const result: StartupValidationResult = {
      ok: false,
      error: "Some error",
    };

    const formatted = formatValidationError(result);

    expect(formatted).toContain("Gateway startup validation failed");
    expect(formatted).toContain("Some error");
  });
});
