import type { AgentTool, AgentToolResult } from "@mariozechner/pi-agent-core";
import { describe, expect, it } from "vitest";
import type { OpenClawConfig } from "../config/config.js";
import {
  filterToolsByPolicy,
  isToolAllowedByPolicyName,
  resolveEffectiveToolPolicy,
} from "./pi-tools.policy.js";

function createStubTool(name: string): AgentTool<unknown, unknown> {
  return {
    name,
    label: name,
    description: "",
    parameters: {},
    execute: async () => ({}) as AgentToolResult<unknown>,
  };
}

describe("pi-tools.policy", () => {
  it("treats * in allow as allow-all", () => {
    const tools = [createStubTool("read"), createStubTool("exec")];
    const filtered = filterToolsByPolicy(tools, { allow: ["*"] });
    expect(filtered.map((tool) => tool.name)).toEqual(["read", "exec"]);
  });

  it("treats * in deny as deny-all", () => {
    const tools = [createStubTool("read"), createStubTool("exec")];
    const filtered = filterToolsByPolicy(tools, { deny: ["*"] });
    expect(filtered).toEqual([]);
  });

  it("supports wildcard allow/deny patterns", () => {
    expect(isToolAllowedByPolicyName("web_fetch", { allow: ["web_*"] })).toBe(true);
    expect(isToolAllowedByPolicyName("web_search", { deny: ["web_*"] })).toBe(false);
  });

  it("keeps apply_patch when exec is allowlisted", () => {
    expect(isToolAllowedByPolicyName("apply_patch", { allow: ["exec"] })).toBe(true);
  });

  it("denies tools in the agent deny list while allowing others", () => {
    const policy = { deny: ["browser", "exec", "write", "canvas"] };
    expect(isToolAllowedByPolicyName("browser", policy)).toBe(false);
    expect(isToolAllowedByPolicyName("exec", policy)).toBe(false);
    expect(isToolAllowedByPolicyName("write", policy)).toBe(false);
    expect(isToolAllowedByPolicyName("canvas", policy)).toBe(false);
    expect(isToolAllowedByPolicyName("sessions_spawn", policy)).toBe(true);
    expect(isToolAllowedByPolicyName("read", policy)).toBe(true);
    expect(isToolAllowedByPolicyName("message", policy)).toBe(true);
  });

  it("resolves agent policy when sessionKey is 'unknown' (non-agent format)", () => {
    const cfg: OpenClawConfig = {
      agents: {
        list: [
          {
            id: "main",
            workspace: "~/openclaw",
            tools: { deny: ["browser", "exec", "write"] },
          },
        ],
      },
    };
    const result = resolveEffectiveToolPolicy({
      config: cfg,
      sessionKey: "unknown",
    });
    expect(result.agentId).toBe("main");
    expect(result.agentPolicy).toBeDefined();
    expect(result.agentPolicy?.deny).toEqual(["browser", "exec", "write"]);
  });

  it("resolves agent policy when sessionKey is a UUID (sessionId fallback)", () => {
    const cfg: OpenClawConfig = {
      agents: {
        list: [
          {
            id: "main",
            workspace: "~/openclaw",
            tools: { deny: ["browser", "exec", "write"] },
          },
        ],
      },
    };
    const result = resolveEffectiveToolPolicy({
      config: cfg,
      sessionKey: "9cd05ea0-1234-5678-9012-abcdef123456",
    });
    expect(result.agentId).toBe("main");
    expect(result.agentPolicy).toBeDefined();
    expect(result.agentPolicy?.deny).toEqual(["browser", "exec", "write"]);
  });
});
