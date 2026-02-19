/**
 * `openclaw fabric status` — CLI handler
 *
 * Reuses the same logic as /status_agents plugin.
 */

import { getAgentStatus } from "../ai-fabric/agent-status.js";
import { getAgentSystemStatus } from "../ai-fabric/agent-system-status.js";
import { getMcpServerStatus } from "../ai-fabric/mcp-status.js";
import { resolveIamSecret } from "../ai-fabric/resolve-iam-secret.js";
import { loadConfig } from "../config/config.js";
import { defaultRuntime } from "../runtime.js";

export async function runFabricStatus(nameFilter?: string): Promise<void> {
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

  const authParams = { keyId, secret };

  const [agentResult, mcpResult, systemResult] = await Promise.all([
    getAgentStatus({
      projectId,
      auth: authParams,
      configuredAgents: aiFabric.agents ?? [],
      nameFilter,
    }),
    getMcpServerStatus({ projectId, auth: authParams, nameFilter }),
    getAgentSystemStatus({ projectId, auth: authParams, nameFilter }),
  ]);

  // Import formatter dynamically to avoid circular deps
  const { formatStatusOutput } = await import("../../extensions/status-agents/index.js");
  defaultRuntime.log(formatStatusOutput(agentResult, mcpResult, systemResult));
}
