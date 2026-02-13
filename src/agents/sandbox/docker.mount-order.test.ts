import { describe, expect, it } from "vitest";
import { SANDBOX_AGENT_WORKSPACE_MOUNT } from "./constants.js";
import { buildSandboxContainerCreateArgs } from "./docker.js";

describe("buildSandboxContainerCreateArgs", () => {
  it("appends custom binds after workspace mounts for masking", () => {
    const workspaceDir = "/tmp/sandbox-copy";
    const agentWorkspaceDir = "/tmp/agent-workspace";
    const workdir = "/workspace";
    const customBind = "/opt/empty:/agent/config:ro";

    const args = buildSandboxContainerCreateArgs({
      name: "openclaw-test",
      cfg: {
        image: "debian:bookworm-slim",
        containerPrefix: "openclaw-sandbox-",
        workdir,
        readOnlyRoot: true,
        tmpfs: ["/tmp"],
        network: "none",
        capDrop: ["ALL"],
        env: {},
        binds: [customBind],
      },
      workspaceDir,
      workspaceAccess: "ro",
      agentWorkspaceDir,
      scopeKey: "main",
      configHash: "hash",
    });

    const mounts: string[] = [];
    for (let index = 0; index < args.length; index += 1) {
      if (args[index] === "-v") {
        mounts.push(args[index + 1] ?? "");
      }
    }

    expect(mounts[0]).toBe(`${workspaceDir}:${workdir}`);
    expect(mounts[1]).toBe(`${agentWorkspaceDir}:${SANDBOX_AGENT_WORKSPACE_MOUNT}:ro`);
    expect(mounts[2]).toBe(customBind);
  });

  it("includes runtime extra env vars (e.g. cliport token) at container create time", () => {
    const args = buildSandboxContainerCreateArgs({
      name: "openclaw-test-env",
      cfg: {
        image: "debian:bookworm-slim",
        containerPrefix: "openclaw-sandbox-",
        workdir: "/workspace",
        readOnlyRoot: true,
        tmpfs: ["/tmp"],
        network: "none",
        capDrop: ["ALL"],
        env: { LANG: "C.UTF-8" },
      },
      workspaceDir: "/tmp/workspace",
      workspaceAccess: "rw",
      agentWorkspaceDir: "/tmp/workspace",
      scopeKey: "main",
      extraEnv: { CLIPORT_TOKEN: "token-abc" },
    });

    expect(args).toContain("-e");
    expect(args).toContain("CLIPORT_TOKEN=token-abc");
    expect(args).toContain("LANG=C.UTF-8");
  });
});
