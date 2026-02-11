import { describe, expect, it } from "vitest";

import type { MoltbotConfig } from "../config/config.js";
import {
  filterToolsByPolicy,
  isToolAllowedByPolicyName,
  resolveEffectiveToolPolicy,
} from "./pi-tools.policy.js";
import { SOPHIE_AGENT_TOOL_DENY } from "./tool-policy.js";
import type { AnyAgentTool } from "./pi-tools.types.js";

function stubTool(name: string): AnyAgentTool {
  return {
    name,
    label: name,
    description: `stub ${name}`,
    parameters: {},
    execute: async () => ({ content: [{ type: "text", text: "ok" }] }),
  } as unknown as AnyAgentTool;
}

describe("Sophie tool lockdown", () => {
  it("SOPHIE_AGENT_TOOL_DENY includes exec and process", () => {
    expect(SOPHIE_AGENT_TOOL_DENY).toContain("exec");
    expect(SOPHIE_AGENT_TOOL_DENY).toContain("process");
  });

  it("resolveEffectiveToolPolicy denies exec for sophie agent", () => {
    const cfg: MoltbotConfig = {
      agents: {
        list: [{ id: "sophie", default: true }],
      },
    };
    const policy = resolveEffectiveToolPolicy({
      config: cfg,
      sessionKey: "agent:sophie:main",
    });
    expect(policy.agentId).toBe("sophie");
    expect(policy.agentPolicy).toBeDefined();
    expect(policy.agentPolicy!.deny).toContain("exec");
    expect(policy.agentPolicy!.deny).toContain("process");
  });

  it("resolveEffectiveToolPolicy does NOT deny exec for non-sophie agents", () => {
    const cfg: MoltbotConfig = {
      agents: {
        list: [{ id: "dev", default: true }],
      },
    };
    const policy = resolveEffectiveToolPolicy({
      config: cfg,
      sessionKey: "agent:dev:main",
    });
    expect(policy.agentId).toBe("dev");
    // agentPolicy should be undefined (no deny, no allow configured)
    const denyList = policy.agentPolicy?.deny ?? [];
    expect(denyList).not.toContain("exec");
  });

  it("filterToolsByPolicy removes exec/process for sophie policy", () => {
    const tools = [
      stubTool("read"),
      stubTool("write"),
      stubTool("exec"),
      stubTool("process"),
      stubTool("list_local_files"),
      stubTool("ingest_local_file"),
    ];
    const cfg: MoltbotConfig = {
      agents: {
        list: [{ id: "sophie", default: true }],
      },
    };
    const policy = resolveEffectiveToolPolicy({
      config: cfg,
      sessionKey: "agent:sophie:main",
    });
    const filtered = filterToolsByPolicy(tools, policy.agentPolicy);
    const names = filtered.map((t) => t.name);
    expect(names).toContain("read");
    expect(names).toContain("write");
    expect(names).toContain("list_local_files");
    expect(names).toContain("ingest_local_file");
    expect(names).not.toContain("exec");
    expect(names).not.toContain("process");
  });

  it("sophie deny list cannot be overridden by config allow", () => {
    const cfg: MoltbotConfig = {
      agents: {
        list: [
          {
            id: "sophie",
            default: true,
            tools: { allow: ["exec", "read", "write"] },
          },
        ],
      },
    };
    const policy = resolveEffectiveToolPolicy({
      config: cfg,
      sessionKey: "agent:sophie:main",
    });
    // exec should still be denied (hardcoded deny takes precedence)
    expect(policy.agentPolicy!.deny).toContain("exec");
    // The policy matcher checks deny first, so exec is blocked even if allow includes it
    expect(isToolAllowedByPolicyName("exec", policy.agentPolicy)).toBe(false);
    expect(isToolAllowedByPolicyName("read", policy.agentPolicy)).toBe(true);
  });

  it("dev agent retains exec access", () => {
    const cfg: MoltbotConfig = {
      agents: {
        list: [{ id: "dev", default: true }, { id: "sophie" }],
      },
    };
    const devPolicy = resolveEffectiveToolPolicy({
      config: cfg,
      sessionKey: "agent:dev:main",
    });
    expect(isToolAllowedByPolicyName("exec", devPolicy.agentPolicy)).toBe(true);

    const sophiePolicy = resolveEffectiveToolPolicy({
      config: cfg,
      sessionKey: "agent:sophie:main",
    });
    expect(isToolAllowedByPolicyName("exec", sophiePolicy.agentPolicy)).toBe(false);
  });

  it("sophie attempting exec via bash alias is also denied", () => {
    const cfg: MoltbotConfig = {
      agents: {
        list: [{ id: "sophie", default: true }],
      },
    };
    const policy = resolveEffectiveToolPolicy({
      config: cfg,
      sessionKey: "agent:sophie:main",
    });
    // "bash" normalizes to "exec" via TOOL_NAME_ALIASES
    expect(isToolAllowedByPolicyName("bash", policy.agentPolicy)).toBe(false);
  });
});
