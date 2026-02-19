/**
 * `openclaw fabric sync` — CLI handler
 *
 * Manually triggers AI Fabric resource sync (MCP servers + skills).
 */

import { resolveAgentWorkspaceDir, resolveDefaultAgentId } from "../agents/agent-scope.js";
import { resolveIamSecret } from "../ai-fabric/resolve-iam-secret.js";
import { loadConfig } from "../config/config.js";
import { defaultRuntime } from "../runtime.js";

export async function runFabricSync(): Promise<void> {
  const config = loadConfig();
  const aiFabric = config.aiFabric;

  if (!aiFabric?.enabled) {
    defaultRuntime.error("AI Fabric is not enabled. Run `openclaw onboard` to configure.");
    defaultRuntime.exit(1);
    return;
  }

  const projectId = aiFabric.projectId ?? "";
  const keyId = aiFabric.keyId ?? "";
  const secret = resolveIamSecret();

  if (!projectId || !keyId || !secret) {
    defaultRuntime.error(
      "AI Fabric credentials incomplete. Ensure aiFabric.projectId, aiFabric.keyId, and CLOUDRU_IAM_SECRET are set.",
    );
    defaultRuntime.exit(1);
    return;
  }

  const workspaceDir = resolveAgentWorkspaceDir(config, resolveDefaultAgentId(config));

  defaultRuntime.log("Syncing AI Fabric resources...");

  const { syncFabricResources } = await import("../ai-fabric/sync-fabric-resources.js");
  const result = await syncFabricResources({
    config,
    workspaceDir,
    projectId,
    auth: { keyId, secret },
  });

  if (!result.ok) {
    defaultRuntime.error(`Sync failed: ${result.error}`);
    defaultRuntime.exit(1);
    return;
  }

  const parts: string[] = [];
  if (result.mcpServers > 0) {
    parts.push(`${result.mcpServers} MCP servers`);
  }
  if (result.skills > 0) {
    parts.push(`${result.skills} skills`);
  }
  if (parts.length === 0) {
    parts.push("no new resources");
  }

  defaultRuntime.log(`Sync complete: ${parts.join(", ")}.`);
}
