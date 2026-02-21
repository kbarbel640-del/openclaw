import path from "node:path";
import { describe, expect, it } from "vitest";
import { resolveRunWorkspaceDir } from "./workspace-run.js";

const PARENT_WORKSPACE = "/home/user/workspace-parent";
const SDR_WORKSPACE = "/home/user/workspace-sdr";
const OTHER_WORKSPACE = "/home/user/workspace-other";

const configWithSdrWorkspace = {
  agents: {
    list: [
      { id: "sdr", workspace: SDR_WORKSPACE },
      { id: "parent", workspace: PARENT_WORKSPACE },
    ],
  },
};

describe("resolveRunWorkspaceDir", () => {
  describe("subagent workspace isolation", () => {
    it("uses agent configured workspace instead of inherited parent workspaceDir", () => {
      // Simulates a subagent (sdr) being spawned by a parent agent whose
      // workspaceDir gets forwarded as the workspaceDir param.
      const result = resolveRunWorkspaceDir({
        workspaceDir: PARENT_WORKSPACE,
        agentId: "sdr",
        config: configWithSdrWorkspace,
      });
      expect(result.workspaceDir).toBe(path.resolve(SDR_WORKSPACE));
      expect(result.usedFallback).toBe(false);
      expect(result.agentId).toBe("sdr");
    });

    it("uses agent configured workspace even when a different workspaceDir is provided", () => {
      const result = resolveRunWorkspaceDir({
        workspaceDir: OTHER_WORKSPACE,
        agentId: "sdr",
        config: configWithSdrWorkspace,
      });
      expect(result.workspaceDir).toBe(path.resolve(SDR_WORKSPACE));
      expect(result.usedFallback).toBe(false);
    });
  });

  describe("no agent workspace configured", () => {
    it("uses the provided workspaceDir when agent has no configured workspace", () => {
      const result = resolveRunWorkspaceDir({
        workspaceDir: OTHER_WORKSPACE,
        agentId: "sdr",
        config: { agents: { list: [{ id: "sdr" }] } },
      });
      expect(result.workspaceDir).toBe(path.resolve(OTHER_WORKSPACE));
      expect(result.usedFallback).toBe(false);
    });

    it("uses the provided workspaceDir when config has no agents list", () => {
      const result = resolveRunWorkspaceDir({
        workspaceDir: OTHER_WORKSPACE,
      });
      expect(result.workspaceDir).toBe(path.resolve(OTHER_WORKSPACE));
      expect(result.usedFallback).toBe(false);
    });
  });

  describe("fallback when no workspaceDir provided", () => {
    it("falls back when workspaceDir is missing, reports reason", () => {
      const result = resolveRunWorkspaceDir({
        workspaceDir: undefined,
        agentId: "sdr",
        config: configWithSdrWorkspace,
      });
      // Falls back to resolveAgentWorkspaceDir which reads the configured workspace
      expect(result.workspaceDir).toBe(path.resolve(SDR_WORKSPACE));
      expect(result.usedFallback).toBe(true);
      expect(result.fallbackReason).toBe("missing");
    });

    it("falls back when workspaceDir is blank, reports reason", () => {
      const result = resolveRunWorkspaceDir({
        workspaceDir: "   ",
        agentId: "sdr",
        config: configWithSdrWorkspace,
      });
      expect(result.workspaceDir).toBe(path.resolve(SDR_WORKSPACE));
      expect(result.usedFallback).toBe(true);
      expect(result.fallbackReason).toBe("blank");
    });

    it("falls back when workspaceDir is invalid type, reports reason", () => {
      const result = resolveRunWorkspaceDir({
        workspaceDir: 42,
        agentId: "sdr",
        config: configWithSdrWorkspace,
      });
      expect(result.workspaceDir).toBe(path.resolve(SDR_WORKSPACE));
      expect(result.usedFallback).toBe(true);
      expect(result.fallbackReason).toBe("invalid_type");
    });
  });
});
