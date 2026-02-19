import { listAgentIds } from "../agents/agent-scope.js";
import type { OpenClawConfig } from "../config/config.js";
import { resolveMemoryBackendConfig } from "../memory/backend-config.js";
import { getMemorySearchManager } from "../memory/index.js";

export async function startGatewayMemoryBackend(params: {
  cfg: OpenClawConfig;
  log: { info?: (msg: string) => void; warn: (msg: string) => void };
}): Promise<void> {
  const agentIds = listAgentIds(params.cfg);
  for (const agentId of agentIds) {
    const resolved = resolveMemoryBackendConfig({ cfg: params.cfg, agentId });
    const { manager, error } = await getMemorySearchManager({ cfg: params.cfg, agentId });
    if (!manager) {
      if (resolved.backend === "qmd" && resolved.qmd) {
        params.log.warn(
          `qmd memory startup initialization failed for agent "${agentId}": ${error ?? "unknown error"}`,
        );
      }
      continue;
    }
    if (resolved.backend === "qmd" && resolved.qmd) {
      params.log.info?.(`qmd memory startup initialization armed for agent "${agentId}"`);
    }
  }
}
