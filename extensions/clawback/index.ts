import { emptyPluginConfigSchema } from "openclaw/plugin-sdk";
import type { RoutingProfile } from "./src/types.js";
import { PROFILES, SERVER_HOST, SERVER_PORT } from "./src/config.js";
import { setProfile, startServer, stopServer } from "./src/server.js";
import { getStats, resetStats, setActiveProfile } from "./src/stats.js";

const VIRTUAL_MODELS = ["clawback/auto", "clawback/eco", "clawback/premium", "clawback/free"];
const DEFAULT_CONTEXT_WINDOW = 128_000;
const DEFAULT_MAX_TOKENS = 8192;

function buildModelDef(id: string) {
  return {
    id,
    name: id,
    api: "openai-completions",
    reasoning: false,
    input: ["text", "image"],
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
    contextWindow: DEFAULT_CONTEXT_WINDOW,
    maxTokens: DEFAULT_MAX_TOKENS,
  };
}

function extractProviderConfigs(
  config: Record<string, unknown>,
): Record<string, { baseUrl?: string; apiKey?: string }> {
  const providers: Record<string, { baseUrl?: string; apiKey?: string }> = {};
  const modelsConfig = config.models as Record<string, unknown> | undefined;
  const providerMap = modelsConfig?.providers as
    | Record<string, Record<string, unknown>>
    | undefined;

  if (providerMap) {
    for (const [name, pConfig] of Object.entries(providerMap)) {
      providers[name] = {
        baseUrl: typeof pConfig.baseUrl === "string" ? pConfig.baseUrl : undefined,
        apiKey: typeof pConfig.apiKey === "string" ? pConfig.apiKey : undefined,
      };
    }
  }
  return providers;
}

function formatStats(): string {
  const s = getStats();
  const cacheRate =
    s.totalRequests > 0 ? ((s.cacheHits / (s.cacheHits + s.cacheMisses)) * 100).toFixed(1) : "0.0";

  const lines = [
    `Profile: ${s.activeProfile}`,
    `Total requests: ${s.totalRequests}`,
    "",
    "Requests by tier:",
    ...Object.entries(s.requestsByTier).map(([tier, count]) => `  ${tier}: ${count}`),
    "",
    "Requests by provider:",
    ...Object.entries(s.requestsByProvider).map(([prov, count]) => `  ${prov}: ${count}`),
    "",
    `Cache hit rate: ${cacheRate}% (${s.cacheHits} hits, ${s.cacheMisses} misses)`,
    `Dedup hits: ${s.dedupHits}`,
    `Agentic overrides: ${s.agenticOverrides}`,
  ];
  return lines.join("\n");
}

const clawbackPlugin = {
  id: "clawback",
  name: "ClawBack",
  description: "Intelligent model router: classifies prompts and routes to the optimal provider",
  configSchema: emptyPluginConfigSchema(),
  register(api: import("openclaw/plugin-sdk").OpenClawPluginApi) {
    // -----------------------------------------------------------------------
    // Register provider with virtual models
    // -----------------------------------------------------------------------
    api.registerProvider({
      id: "clawback",
      label: "ClawBack (Smart Router)",
      docsPath: "/providers/models",
      auth: [
        {
          id: "local",
          label: "Local router",
          hint: "Routes requests to the best provider based on prompt complexity",
          kind: "custom",
          run: async () => {
            const baseUrl = `http://${SERVER_HOST}:${SERVER_PORT}/v1`;
            return {
              profiles: [
                {
                  profileId: "clawback:local",
                  credential: { type: "token", provider: "clawback", token: "clawback-internal" },
                },
              ],
              configPatch: {
                models: {
                  providers: {
                    clawback: {
                      baseUrl,
                      apiKey: "clawback-internal",
                      api: "openai-completions",
                      authHeader: false,
                      models: VIRTUAL_MODELS.map((id) =>
                        buildModelDef(id.replace("clawback/", "")),
                      ),
                    },
                  },
                },
                agents: {
                  defaults: {
                    models: Object.fromEntries(VIRTUAL_MODELS.map((id) => [id, {}])),
                  },
                },
              },
              defaultModel: "clawback/auto",
              notes: [
                "ClawBack routes requests to the optimal model based on prompt complexity.",
                "Use clawback/auto (balanced), clawback/eco (cost-saving), clawback/premium (quality), or clawback/free (local only).",
                "Run /clawback stats to see routing statistics.",
              ],
            };
          },
        },
      ],
    });

    // -----------------------------------------------------------------------
    // Register /clawback command
    // -----------------------------------------------------------------------
    api.registerCommand({
      name: "clawback",
      description: "ClawBack router stats and profile switching",
      acceptsArgs: true,
      handler: (ctx) => {
        const args = (ctx.args ?? "").trim().split(/\s+/);
        const subcommand = args[0]?.toLowerCase();

        if (subcommand === "stats") {
          return { text: formatStats() };
        }

        if (subcommand === "profile") {
          const profileName = args[1]?.toLowerCase() as RoutingProfile | undefined;
          if (!profileName || !PROFILES[profileName]) {
            const available = Object.keys(PROFILES).join(", ");
            return { text: `Usage: /clawback profile <${available}>` };
          }
          setProfile(profileName);
          setActiveProfile(profileName);
          const p = PROFILES[profileName];
          return { text: `Switched to ${p.label} profile: ${p.description}` };
        }

        if (subcommand === "reset") {
          resetStats();
          return { text: "Routing statistics reset." };
        }

        return {
          text: [
            "ClawBack - Intelligent Model Router",
            "",
            "Commands:",
            "  /clawback stats           - Show routing statistics",
            "  /clawback profile <name>  - Switch routing profile (auto, eco, premium, free)",
            "  /clawback reset           - Reset statistics",
          ].join("\n"),
        };
      },
    });

    // -----------------------------------------------------------------------
    // Register CLI subcommands
    // -----------------------------------------------------------------------
    api.registerCli(
      ({ program }) => {
        const cmd = program.command("clawback").description("ClawBack intelligent model router");

        cmd
          .command("stats")
          .description("Show routing statistics")
          .action(() => {
            console.log(formatStats());
          });

        cmd
          .command("profile")
          .description("Switch routing profile")
          .argument("<name>", "Profile name: auto, eco, premium, free")
          .action((name: string) => {
            const profileName = name.toLowerCase() as RoutingProfile;
            if (!PROFILES[profileName]) {
              console.error(
                `Unknown profile: ${name}. Available: ${Object.keys(PROFILES).join(", ")}`,
              );
              process.exitCode = 1;
              return;
            }
            setProfile(profileName);
            setActiveProfile(profileName);
            console.log(`Switched to ${PROFILES[profileName].label} profile`);
          });
      },
      { commands: ["clawback"] },
    );

    // -----------------------------------------------------------------------
    // Register service (HTTP proxy lifecycle)
    // -----------------------------------------------------------------------
    api.registerService({
      id: "clawback",
      start: async () => {
        const providers = extractProviderConfigs(api.config as unknown as Record<string, unknown>);
        await startServer({
          profile: "auto",
          providers,
          logger: api.logger,
        });
      },
      stop: async () => {
        await stopServer();
      },
    });
  },
};

export default clawbackPlugin;
