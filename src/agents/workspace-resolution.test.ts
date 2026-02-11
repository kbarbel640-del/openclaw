import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import type { MoltbotConfig } from "../config/config.js";
import { resolveAgentWorkspaceDir, resolveAgentWorkspaceDirWithSource } from "./agent-scope.js";
import { resolveDefaultAgentWorkspaceDir } from "./workspace.js";

async function withTempDir<T>(prefix: string, fn: (dir: string) => Promise<T>) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), prefix));
  try {
    return await fn(dir);
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
}

describe("workspace resolution — CLAWDBOT_WORKSPACE env", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("resolveDefaultAgentWorkspaceDir prefers CLAWDBOT_WORKSPACE over ~/clawd", () => {
    const env = { CLAWDBOT_WORKSPACE: "/tmp/my-repo" } as NodeJS.ProcessEnv;
    const result = resolveDefaultAgentWorkspaceDir(env, () => "/home/user");
    expect(result).toBe(path.resolve("/tmp/my-repo"));
  });

  it("resolveDefaultAgentWorkspaceDir falls back to ~/clawd when env is unset", () => {
    const env = {} as NodeJS.ProcessEnv;
    const result = resolveDefaultAgentWorkspaceDir(env, () => "/home/user");
    expect(result).toBe(path.join("/home/user", "clawd"));
  });

  it("resolveDefaultAgentWorkspaceDir still respects CLAWDBOT_PROFILE when no WORKSPACE", () => {
    const env = { CLAWDBOT_PROFILE: "dev" } as NodeJS.ProcessEnv;
    const result = resolveDefaultAgentWorkspaceDir(env, () => "/home/user");
    expect(result).toBe(path.join("/home/user", "clawd-dev"));
  });

  it("CLAWDBOT_WORKSPACE takes precedence over CLAWDBOT_PROFILE", () => {
    const env = {
      CLAWDBOT_WORKSPACE: "/opt/repo-root",
      CLAWDBOT_PROFILE: "dev",
    } as NodeJS.ProcessEnv;
    const result = resolveDefaultAgentWorkspaceDir(env, () => "/home/user");
    expect(result).toBe(path.resolve("/opt/repo-root"));
  });

  it("resolveAgentWorkspaceDir prefers env over stale config defaults.workspace", () => {
    vi.stubEnv("CLAWDBOT_WORKSPACE", "/tmp/active-repo");
    const cfg: MoltbotConfig = {
      agents: {
        defaults: { workspace: "/Users/old/clawd-dev" },
        list: [{ id: "main", default: true }],
      },
    };
    const result = resolveAgentWorkspaceDir(cfg, "main");
    expect(result).toBe(path.resolve("/tmp/active-repo"));
  });

  it("CLAWDBOT_WORKSPACE wins over per-agent config for default agent", async () => {
    await withTempDir("moltbot-agent-ws-", async (existingDir) => {
      vi.stubEnv("CLAWDBOT_WORKSPACE", "/tmp/env-repo");
      const cfg: MoltbotConfig = {
        agents: {
          list: [{ id: "main", default: true, workspace: existingDir }],
        },
      };
      const result = resolveAgentWorkspaceDir(cfg, "main");
      // Env wins for default agent even if per-agent dir exists
      expect(result).toBe(path.resolve("/tmp/env-repo"));
    });
  });

  it("per-agent workspace config still works for non-default agents", async () => {
    await withTempDir("moltbot-agent-ws-", async (existingDir) => {
      vi.stubEnv("CLAWDBOT_WORKSPACE", "/tmp/env-repo");
      const cfg: MoltbotConfig = {
        agents: {
          list: [
            { id: "main", default: true },
            { id: "sophie", workspace: existingDir },
          ],
        },
      };
      const result = resolveAgentWorkspaceDir(cfg, "sophie");
      // Non-default agent still uses its per-agent config
      expect(result).toBe(path.resolve(existingDir));
    });
  });

  it("does not attempt stale path when CLAWDBOT_WORKSPACE is set", () => {
    vi.stubEnv("CLAWDBOT_WORKSPACE", "/Users/agentsophie/Documents/clawdbot");
    const cfg: MoltbotConfig = {
      agents: {
        defaults: { workspace: "/Users/agentsophie/clawd-dev" },
        list: [{ id: "main", default: true }],
      },
    };
    const result = resolveAgentWorkspaceDir(cfg, "main");
    expect(result).not.toContain("clawd-dev");
    expect(result).toBe(path.resolve("/Users/agentsophie/Documents/clawdbot"));
  });
});

describe("workspace resolution — stale config validation", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("env wins for default agent even with per-agent workspace config", () => {
    vi.stubEnv("CLAWDBOT_WORKSPACE", "/tmp/fallback");
    const cfg: MoltbotConfig = {
      agents: {
        list: [{ id: "main", default: true, workspace: "/some/agent/path" }],
      },
    };
    const result = resolveAgentWorkspaceDir(cfg, "main");
    // CLAWDBOT_WORKSPACE wins for the default agent
    expect(result).toBe(path.resolve("/tmp/fallback"));
  });

  it("ignores defaults.workspace when directory does not exist", () => {
    vi.stubEnv("CLAWDBOT_WORKSPACE", "");
    const cfg: MoltbotConfig = {
      agents: {
        defaults: { workspace: "/nonexistent/old/clawd-dev" },
        list: [{ id: "main", default: true }],
      },
    };
    const result = resolveAgentWorkspaceDir(cfg, "main");
    // Should fall through to DEFAULT_AGENT_WORKSPACE_DIR since path doesn't exist
    expect(result).not.toContain("nonexistent");
  });

  it("uses defaults.workspace when directory exists", async () => {
    await withTempDir("moltbot-defaults-ws-", async (existingDir) => {
      vi.stubEnv("CLAWDBOT_WORKSPACE", "");
      const cfg: MoltbotConfig = {
        agents: {
          defaults: { workspace: existingDir },
          list: [{ id: "main", default: true }],
        },
      };
      const result = resolveAgentWorkspaceDir(cfg, "main");
      expect(result).toBe(path.resolve(existingDir));
    });
  });
});

describe("workspace resolution — source tracking", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("reports source=env when CLAWDBOT_WORKSPACE is set", () => {
    vi.stubEnv("CLAWDBOT_WORKSPACE", "/tmp/repo-root");
    const cfg: MoltbotConfig = {
      agents: {
        list: [{ id: "main", default: true }],
      },
    };
    const { dir, source } = resolveAgentWorkspaceDirWithSource(cfg, "main");
    expect(dir).toBe(path.resolve("/tmp/repo-root"));
    expect(source).toBe("env");
  });

  it("reports source=agent-config for per-agent workspace", async () => {
    await withTempDir("moltbot-src-ws-", async (existingDir) => {
      vi.stubEnv("CLAWDBOT_WORKSPACE", "");
      const cfg: MoltbotConfig = {
        agents: {
          list: [{ id: "main", default: true, workspace: existingDir }],
        },
      };
      const { dir, source } = resolveAgentWorkspaceDirWithSource(cfg, "main");
      expect(dir).toBe(path.resolve(existingDir));
      expect(source).toBe("agent-config");
    });
  });

  it("reports source=config-defaults for defaults.workspace", async () => {
    await withTempDir("moltbot-cfg-ws-", async (existingDir) => {
      vi.stubEnv("CLAWDBOT_WORKSPACE", "");
      const cfg: MoltbotConfig = {
        agents: {
          defaults: { workspace: existingDir },
          list: [{ id: "main", default: true }],
        },
      };
      const { dir, source } = resolveAgentWorkspaceDirWithSource(cfg, "main");
      expect(dir).toBe(path.resolve(existingDir));
      expect(source).toBe("config-defaults");
    });
  });

  it("reports source=default when no config or env is set", () => {
    vi.stubEnv("CLAWDBOT_WORKSPACE", "");
    const cfg: MoltbotConfig = {
      agents: {
        list: [{ id: "main", default: true }],
      },
    };
    const { source } = resolveAgentWorkspaceDirWithSource(cfg, "main");
    expect(source).toBe("default");
  });
});

describe("workspace resolution — heartbeat path", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("heartbeat workspace resolves to env path, not stale config", () => {
    vi.stubEnv("CLAWDBOT_WORKSPACE", "/tmp/active-repo");
    const cfg: MoltbotConfig = {
      agents: {
        defaults: { workspace: "/Users/agentsophie/clawd-dev" },
        list: [{ id: "main", default: true }],
      },
    };
    // Heartbeat uses resolveAgentWorkspaceDir internally
    const wsDir = resolveAgentWorkspaceDir(cfg, "main");
    const heartbeatPath = path.join(wsDir, "HEARTBEAT.md");
    expect(heartbeatPath).not.toContain("clawd-dev");
    expect(heartbeatPath).toBe(path.resolve("/tmp/active-repo", "HEARTBEAT.md"));
  });
});

describe("workspace resolution — dev-up integration", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("with CLAWDBOT_WORKSPACE=cwd, workspace equals repo root regardless of config", () => {
    const repoRoot = process.cwd();
    vi.stubEnv("CLAWDBOT_WORKSPACE", repoRoot);
    const cfg: MoltbotConfig = {
      agents: {
        defaults: { workspace: "/Users/agentsophie/clawd-dev" },
        list: [{ id: "dev", workspace: "/Users/agentsophie/clawd-dev" }, { id: "sophie" }],
      },
    };
    // For the default agent ("dev"), env wins over stale config
    const { dir, source } = resolveAgentWorkspaceDirWithSource(cfg, "dev");
    // The stale /clawd-dev doesn't exist so it falls through to env
    expect(dir).toBe(path.resolve(repoRoot));
    expect(source).toBe("env");
  });
});
