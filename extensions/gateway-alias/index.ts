import type { OpenClawPluginApi } from "openclaw/plugin-sdk";
import type { GatewayAliasConfig } from "./src/config.js";
import { resolveConfig } from "./src/config.js";
import { syncHostsFile, removeHostsBlock } from "./src/hosts.js";
import { createAliasProxy, type AliasProxyHandle } from "./src/proxy.js";

export default function register(api: OpenClawPluginApi) {
  let proxy: AliasProxyHandle | null = null;

  api.registerService({
    id: "gateway-alias",
    start: async (ctx) => {
      const config = resolveConfig(api.pluginConfig);
      const log = ctx.logger;

      if (!config.aliases || Object.keys(config.aliases).length === 0) {
        log.info("gateway-alias: no aliases configured, skipping");
        return;
      }

      const aliasEntries = Object.entries(config.aliases)
        .map(([host, port]) => `${host} → :${port}`)
        .join(", ");

      log.info(`gateway-alias: starting proxy on :${config.port} for ${aliasEntries}`);

      // Sync /etc/hosts entries if enabled.
      if (config.manageHosts) {
        const ok = syncHostsFile(Object.keys(config.aliases), log);
        if (!ok) {
          log.warn(
            "gateway-alias: /etc/hosts update requires elevated privileges. " +
              "Run: openclaw gateway-alias setup",
          );
        }
      }

      // Start the reverse proxy.
      proxy = createAliasProxy({
        aliases: config.aliases,
        port: config.port,
        bind: config.bind,
        log,
      });

      proxy.start();
    },

    stop: async (ctx) => {
      if (proxy) {
        proxy.stop();
        proxy = null;
        ctx.logger.info("gateway-alias: proxy stopped");
      }
    },
  });

  // Register /aliases command for quick status check.
  api.registerCommand({
    name: "aliases",
    description: "Show configured gateway hostname aliases",
    handler: () => {
      const config = resolveConfig(api.pluginConfig);
      const aliases = config.aliases ?? {};

      if (Object.keys(aliases).length === 0) {
        return { text: "No gateway aliases configured." };
      }

      const lines = Object.entries(aliases).map(
        ([host, port]) => `• http://${host} → localhost:${port}`,
      );
      return {
        text: `Gateway Aliases (proxy on :${config.port})\n${lines.join("\n")}`,
      };
    },
  });

  // Register CLI subcommand for one-time setup (hosts + pfctl).
  api.registerCli(
    ({ program }) => {
      const cmd = program.command("gateway-alias").description("Manage gateway hostname aliases");

      cmd
        .command("setup")
        .description(
          "One-time setup: update /etc/hosts and configure port forwarding (requires sudo)",
        )
        .action(async () => {
          const config = resolveConfig(api.pluginConfig);
          const aliases = config.aliases ?? {};

          if (Object.keys(aliases).length === 0) {
            console.log("No aliases configured in plugins.entries.gateway-alias.config.aliases");
            process.exit(1);
          }

          const { runSetup } = await import("./src/setup.js");
          await runSetup({
            aliases,
            proxyPort: config.port,
          });
        });

      cmd
        .command("status")
        .description("Show current alias proxy status")
        .action(() => {
          const config = resolveConfig(api.pluginConfig);
          const aliases = config.aliases ?? {};

          if (Object.keys(aliases).length === 0) {
            console.log("No aliases configured.");
            return;
          }

          console.log(`Gateway Alias Proxy (port ${config.port}):`);
          for (const [host, port] of Object.entries(aliases)) {
            console.log(`  http://${host} → localhost:${port}`);
          }
        });
    },
    { commands: ["gateway-alias"] },
  );
}
