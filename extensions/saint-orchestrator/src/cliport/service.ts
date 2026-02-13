import type { OpenClawPluginService } from "openclaw/plugin-sdk";
import path from "node:path";
import { createCliportDaemon } from "./daemon.js";

const DEFAULT_SOCKET_PATH = "/var/run/cliport.sock";

export function createCliportService(): OpenClawPluginService {
  let stopDaemon: (() => Promise<void>) | null = null;

  return {
    id: "cliport",
    start: async (ctx) => {
      const workspaceDir = ctx.workspaceDir?.trim();
      if (!workspaceDir) {
        ctx.logger.warn("[cliport] workspaceDir missing; service disabled");
        return;
      }

      const socketPath = process.env.CLIPORT_SOCKET_PATH?.trim() || DEFAULT_SOCKET_PATH;
      const registryPath =
        process.env.CLIPORT_REGISTRY?.trim() || path.join(ctx.stateDir, "cliport", "registry.json");
      const defaultToken = process.env.CLIPORT_TOKEN?.trim();

      const daemon = createCliportDaemon({
        socketPath,
        registryPath,
        stateDir: ctx.stateDir,
        workspaceDir,
        defaultTokens: defaultToken ? [defaultToken] : [],
        logger: {
          info: ctx.logger.info,
          warn: ctx.logger.warn,
          error: ctx.logger.error,
        },
      });

      await daemon.start();
      stopDaemon = async () => {
        await daemon.stop();
      };
    },
    stop: async () => {
      if (!stopDaemon) {
        return;
      }
      await stopDaemon();
      stopDaemon = null;
    },
  };
}
