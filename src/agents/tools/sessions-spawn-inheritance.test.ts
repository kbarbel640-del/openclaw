import { describe, expect, it, vi, beforeEach } from "vitest";
import type { ModelRef } from "../model-selection.js";
import { getCurrentSessionModel } from "../../sessions/current-model-query.js";
import { createSessionsSpawnTool } from "./sessions-spawn-tool.js";

// Mock dependencies
vi.mock("../../sessions/current-model-query.js");
vi.mock("../../config/config.js");
vi.mock("../../gateway/call.js");
vi.mock("../agent-scope.js");
vi.mock("../subagent-registry.js");

const mockGetCurrentSessionModel = vi.mocked(getCurrentSessionModel);

describe("sessions-spawn-tool inheritance", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockConfig = {
    agents: {
      defaults: {
        subagents: {
          inheritProvider: true,
          upgradeModel: true,
        },
      },
    },
  };

  it("should inherit and upgrade anthropic models", async () => {
    // Mock parent session using claude-haiku
    const parentModel: ModelRef = { provider: "anthropic", model: "claude-haiku-4-5" };
    mockGetCurrentSessionModel.mockResolvedValue(parentModel);

    const tool = createSessionsSpawnTool({
      agentSessionKey: "agent:main:main",
    });

    const result = await tool.execute("test-call-id", {
      task: "Test task",
    });

    expect(result.data).toMatchObject({
      status: "accepted",
      inheritanceApplied: true,
    });

    // Should try to apply claude-opus-4-5 (most advanced anthropic model)
    expect(vi.mocked(require("../../gateway/call.js").callGateway)).toHaveBeenCalledWith(
      expect.objectContaining({
        method: "sessions.patch",
        params: expect.objectContaining({
          model: "anthropic/claude-opus-4-5",
        }),
      }),
    );
  });

  it("should inherit and upgrade openai models", async () => {
    // Mock parent session using gpt-4o
    const parentModel: ModelRef = { provider: "openai", model: "gpt-4o" };
    mockGetCurrentSessionModel.mockResolvedValue(parentModel);

    const tool = createSessionsSpawnTool({
      agentSessionKey: "agent:main:main",
    });

    const result = await tool.execute("test-call-id", {
      task: "Test task",
    });

    expect(result.data).toMatchObject({
      status: "accepted",
      inheritanceApplied: true,
    });

    // Should try to apply gpt-5.2 (most advanced openai model)
    expect(vi.mocked(require("../../gateway/call.js").callGateway)).toHaveBeenCalledWith(
      expect.objectContaining({
        method: "sessions.patch",
        params: expect.objectContaining({
          model: "openai/gpt-5.2",
        }),
      }),
    );
  });

  it("should respect explicit model override", async () => {
    // Mock parent session
    const parentModel: ModelRef = { provider: "anthropic", model: "claude-haiku-4-5" };
    mockGetCurrentSessionModel.mockResolvedValue(parentModel);

    const tool = createSessionsSpawnTool({
      agentSessionKey: "agent:main:main",
    });

    const result = await tool.execute("test-call-id", {
      task: "Test task",
      model: "openai/gpt-4o", // Explicit override
    });

    expect(result.data).toMatchObject({
      status: "accepted",
      inheritanceApplied: false, // Override prevented inheritance
    });

    // Should use the explicit override, not inheritance
    expect(vi.mocked(require("../../gateway/call.js").callGateway)).toHaveBeenCalledWith(
      expect.objectContaining({
        method: "sessions.patch",
        params: expect.objectContaining({
          model: "openai/gpt-4o",
        }),
      }),
    );
  });

  it("should fallback when inheritance is disabled", async () => {
    const configWithInheritanceDisabled = {
      agents: {
        defaults: {
          subagents: {
            inheritProvider: false,
            upgradeModel: true,
            model: "anthropic/claude-sonnet-4-5", // Fallback model
          },
        },
      },
    };

    vi.mocked(require("../../config/config.js").loadConfig).mockReturnValue(
      configWithInheritanceDisabled,
    );

    const tool = createSessionsSpawnTool({
      agentSessionKey: "agent:main:main",
    });

    const result = await tool.execute("test-call-id", {
      task: "Test task",
    });

    expect(result.data).toMatchObject({
      status: "accepted",
      inheritanceApplied: false,
    });

    // Should use fallback config model
    expect(vi.mocked(require("../../gateway/call.js").callGateway)).toHaveBeenCalledWith(
      expect.objectContaining({
        method: "sessions.patch",
        params: expect.objectContaining({
          model: "anthropic/claude-sonnet-4-5",
        }),
      }),
    );
  });

  it("should fallback when parent session query fails", async () => {
    // Mock session query failure
    mockGetCurrentSessionModel.mockRejectedValue(new Error("Session not found"));

    const configWithFallback = {
      agents: {
        defaults: {
          subagents: {
            inheritProvider: true,
            upgradeModel: true,
            model: "anthropic/claude-haiku-4-5", // Fallback
          },
        },
      },
    };

    vi.mocked(require("../../config/config.js").loadConfig).mockReturnValue(configWithFallback);

    const tool = createSessionsSpawnTool({
      agentSessionKey: "agent:main:main",
    });

    const result = await tool.execute("test-call-id", {
      task: "Test task",
    });

    expect(result.data).toMatchObject({
      status: "accepted",
      inheritanceApplied: false,
    });

    // Should use fallback model when inheritance fails
    expect(vi.mocked(require("../../gateway/call.js").callGateway)).toHaveBeenCalledWith(
      expect.objectContaining({
        method: "sessions.patch",
        params: expect.objectContaining({
          model: "anthropic/claude-haiku-4-5",
        }),
      }),
    );
  });

  it("should fallback for unsupported providers", async () => {
    // Mock parent with unsupported provider
    const parentModel: ModelRef = { provider: "unsupported-provider", model: "some-model" };
    mockGetCurrentSessionModel.mockResolvedValue(parentModel);

    const configWithFallback = {
      agents: {
        defaults: {
          subagents: {
            inheritProvider: true,
            upgradeModel: true,
            model: "anthropic/claude-sonnet-4-5", // Fallback
          },
        },
      },
    };

    vi.mocked(require("../../config/config.js").loadConfig).mockReturnValue(configWithFallback);

    const tool = createSessionsSpawnTool({
      agentSessionKey: "agent:main:main",
    });

    const result = await tool.execute("test-call-id", {
      task: "Test task",
    });

    expect(result.data).toMatchObject({
      status: "accepted",
      inheritanceApplied: false,
    });

    // Should fallback when provider is unsupported
    expect(vi.mocked(require("../../gateway/call.js").callGateway)).toHaveBeenCalledWith(
      expect.objectContaining({
        method: "sessions.patch",
        params: expect.objectContaining({
          model: "anthropic/claude-sonnet-4-5",
        }),
      }),
    );
  });

  it("should handle upgrade disabled but inheritance enabled", async () => {
    // Mock parent session
    const parentModel: ModelRef = { provider: "anthropic", model: "claude-haiku-4-5" };
    mockGetCurrentSessionModel.mockResolvedValue(parentModel);

    const configWithUpgradeDisabled = {
      agents: {
        defaults: {
          subagents: {
            inheritProvider: true,
            upgradeModel: false, // Disabled - should keep same model
          },
        },
      },
    };

    vi.mocked(require("../../config/config.js").loadConfig).mockReturnValue(
      configWithUpgradeDisabled,
    );

    const tool = createSessionsSpawnTool({
      agentSessionKey: "agent:main:main",
    });

    const result = await tool.execute("test-call-id", {
      task: "Test task",
    });

    expect(result.data).toMatchObject({
      status: "accepted",
      inheritanceApplied: false, // No upgrade = no inheritance applied
    });

    // Should use fallback since upgrade is disabled
    // In real implementation, this would need more sophisticated handling
  });

  it("should not apply inheritance for subagent sessions", async () => {
    const tool = createSessionsSpawnTool({
      agentSessionKey: "agent:main:subagent:uuid", // Subagent session
    });

    const result = await tool.execute("test-call-id", {
      task: "Test task",
    });

    expect(result.data).toMatchObject({
      status: "forbidden",
      error: "sessions_spawn is not allowed from sub-agent sessions",
    });

    // Should never reach inheritance logic
    expect(mockGetCurrentSessionModel).not.toHaveBeenCalled();
  });

  it("should handle multiple provider hierarchies correctly", async () => {
    const testCases = [
      {
        parent: { provider: "google", model: "gemini-1.5-flash" },
        expectedUpgrade: "google/gemini-exp-1206",
      },
      {
        parent: { provider: "openai-codex", model: "gpt-4o" },
        expectedUpgrade: "openai-codex/gpt-5.2",
      },
      {
        parent: { provider: "xai", model: "grok-1" },
        expectedUpgrade: "xai/grok-2",
      },
    ];

    for (const testCase of testCases) {
      vi.clearAllMocks();
      mockGetCurrentSessionModel.mockResolvedValue(testCase.parent);

      const tool = createSessionsSpawnTool({
        agentSessionKey: "agent:main:main",
      });

      await tool.execute("test-call-id", {
        task: "Test task",
      });

      expect(vi.mocked(require("../../gateway/call.js").callGateway)).toHaveBeenCalledWith(
        expect.objectContaining({
          method: "sessions.patch",
          params: expect.objectContaining({
            model: testCase.expectedUpgrade,
          }),
        }),
      );
    }
  });
});
