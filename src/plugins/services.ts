import type { OpenClawConfig } from "../config/config.js";
import { STATE_DIR } from "../config/paths.js";
import { createSubsystemLogger } from "../logging/subsystem.js";
import type { PluginRegistry } from "./registry.js";
import type { OpenClawPluginServiceContext, PluginLogger } from "./types.js";

const log = createSubsystemLogger("plugins");

function createPluginLogger(): PluginLogger {
  return {
    info: (msg) => log.info(msg),
    warn: (msg) => log.warn(msg),
    error: (msg) => log.error(msg),
    debug: (msg) => log.debug(msg),
  };
}

function createServiceContext(params: {
  registry: PluginRegistry;
  config: OpenClawConfig;
  workspaceDir?: string;
}): OpenClawPluginServiceContext {
  const embeddingProviders = new Map(
    params.registry.embeddingProviders.map((entry) => [entry.provider.id, entry.provider]),
  );
  return {
    config: params.config,
    workspaceDir: params.workspaceDir,
    stateDir: STATE_DIR,
    logger: createPluginLogger(),
    resolveEmbeddingProvider: (id: string) => {
      const key = id.trim();
      if (!key) {
        return null;
      }
      return embeddingProviders.get(key) ?? null;
    },
  };
}

export type PluginServicesHandle = {
  stop: () => Promise<void>;
};

export async function startPluginServices(params: {
  registry: PluginRegistry;
  config: OpenClawConfig;
  workspaceDir?: string;
}): Promise<PluginServicesHandle> {
  const running: Array<{
    id: string;
    stop?: () => void | Promise<void>;
  }> = [];
  const serviceContext = createServiceContext({
    registry: params.registry,
    config: params.config,
    workspaceDir: params.workspaceDir,
  });

  for (const entry of params.registry.services) {
    const service = entry.service;
    try {
      await service.start(serviceContext);
      running.push({
        id: service.id,
        stop: service.stop ? () => service.stop?.(serviceContext) : undefined,
      });
    } catch (err) {
      log.error(`plugin service failed (${service.id}): ${String(err)}`);
    }
  }

  return {
    stop: async () => {
      for (const entry of running.toReversed()) {
        if (!entry.stop) {
          continue;
        }
        try {
          await entry.stop();
        } catch (err) {
          log.warn(`plugin service stop failed (${entry.id}): ${String(err)}`);
        }
      }
    },
  };
}
