import {
  emptyPluginConfigSchema,
  type OpenClawPluginApi,
  type ProviderAuthContext,
} from "openclaw/plugin-sdk";
import { loginQwenAgentOAuth } from "./oauth.js";

const PROVIDER_ID = "qwen-agent";
const PROVIDER_LABEL = "Qwen Agent";
const DEFAULT_MODEL = "qwen-agent/coder-model";
const DEFAULT_BASE_URL = "https://portal.qwen.ai/v1";
const DEFAULT_CONTEXT_WINDOW = 128000;
const DEFAULT_MAX_TOKENS = 8192;
const OAUTH_PLACEHOLDER = "qwen-agent-oauth";

function normalizeBaseUrl(value: string | undefined): string {
  const raw = value?.trim() || DEFAULT_BASE_URL;
  const withProtocol = raw.startsWith("http") ? raw : `https://${raw}`;
  return withProtocol.endsWith("/v1") ? withProtocol : `${withProtocol.replace(/\/+$/, "")}/v1`;
}

function buildModelDefinition(params: {
  id: string;
  name: string;
  input: Array<"text" | "image">;
}) {
  return {
    id: params.id,
    name: params.name,
    reasoning: false,
    input: params.input,
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
    contextWindow: DEFAULT_CONTEXT_WINDOW,
    maxTokens: DEFAULT_MAX_TOKENS,
  };
}

const qwenAgentPlugin = {
  id: "qwen-agent-auth",
  name: "Qwen Agent OAuth",
  description: "OAuth flow for Qwen Agent models",
  configSchema: emptyPluginConfigSchema(),
  register(api: OpenClawPluginApi) {
    api.registerProvider({
      id: PROVIDER_ID,
      label: PROVIDER_LABEL,
      docsPath: "/providers/qwen",
      aliases: ["qwen-agent"],
      auth: [
        {
          id: "device",
          label: "Qwen Agent OAuth",
          hint: "Device code login",
          kind: "device_code",
          run: async (ctx: ProviderAuthContext) => {
            const progress = ctx.prompter.progress("Starting Qwen Agent OAuth…");
            try {
              const result = await loginQwenAgentOAuth({
                openUrl: ctx.openUrl,
                note: ctx.prompter.note,
                progress,
              });

              progress.stop("Qwen Agent OAuth complete");

              const profileId = `${PROVIDER_ID}:default`;
              const baseUrl = normalizeBaseUrl(result.resourceUrl);

              return {
                profiles: [
                  {
                    profileId,
                    credential: {
                      type: "oauth",
                      provider: PROVIDER_ID,
                      access: result.access,
                      refresh: result.refresh,
                      expires: result.expires,
                    },
                  },
                ],
                configPatch: {
                  models: {
                    providers: {
                      [PROVIDER_ID]: {
                        baseUrl,
                        apiKey: OAUTH_PLACEHOLDER,
                        api: "openai-completions",
                        models: [
                          buildModelDefinition({
                            id: "coder-model",
                            name: "Qwen Agent Coder",
                            input: ["text"],
                          }),
                          buildModelDefinition({
                            id: "vision-model",
                            name: "Qwen Agent Vision",
                            input: ["text", "image"],
                          }),
                        ],
                      },
                    },
                  },
                  agents: {
                    defaults: {
                      models: {
                        "qwen-agent/coder-model": { alias: "qwen" },
                        "qwen-agent/vision-model": {},
                      },
                    },
                  },
                },
                defaultModel: DEFAULT_MODEL,
                notes: [
                  "Qwen OAuth tokens auto-refresh. Re-run login if refresh fails or access is revoked.",
                  `Base URL defaults to ${DEFAULT_BASE_URL}. Override models.providers.${PROVIDER_ID}.baseUrl if needed.`,
                ],
              };
            } catch (err) {
              progress.stop("Qwen Agent OAuth failed");
              await ctx.prompter.note(
                "If OAuth fails, verify your Qwen account has agent access and try again.",
                "Qwen Agent OAuth",
              );
              throw err;
            }
          },
        },
      ],
    });
  },
};

export default qwenAgentPlugin;
