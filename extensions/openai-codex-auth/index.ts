import { loginOpenAICodex } from "@mariozechner/pi-ai";
import { emptyPluginConfigSchema } from "openclaw/plugin-sdk";

const PROVIDER_ID = "openai-codex";
const PROVIDER_LABEL = "OpenAI Codex";

const openaiCodexAuthPlugin = {
  id: "openai-codex-auth",
  name: "OpenAI Codex OAuth",
  description: "OAuth flow for OpenAI Codex (ChatGPT Plus/Pro subscription)",
  configSchema: emptyPluginConfigSchema(),
  register(api) {
    api.registerProvider({
      id: PROVIDER_ID,
      label: PROVIDER_LABEL,
      docsPath: "/providers/openai",
      aliases: ["openai"],
      auth: [
        {
          id: "oauth",
          label: "OpenAI Codex OAuth",
          hint: "Sign in with ChatGPT Plus/Pro",
          kind: "oauth",
          run: async (ctx) => {
            const spin = ctx.prompter.progress("Starting OpenAI Codex OAuth...");
            try {
              const { onAuth, onPrompt } = ctx.oauth.createVpsAwareHandlers({
                isRemote: ctx.isRemote,
                prompter: ctx.prompter,
                runtime: ctx.runtime,
                spin,
                openUrl: ctx.openUrl,
                localBrowserMessage: "Complete sign-in in browser...",
              });

              const creds = await loginOpenAICodex({
                onAuth,
                onPrompt,
                onProgress: (msg) => spin.update(msg),
              });

              spin.stop("OpenAI Codex OAuth complete");

              if (!creds) {
                throw new Error("OAuth flow returned no credentials");
              }

              const email =
                typeof creds.email === "string" && creds.email.trim()
                  ? creds.email.trim()
                  : "default";
              const profileId = `${PROVIDER_ID}:${email}`;

              return {
                profiles: [
                  {
                    profileId,
                    credential: {
                      type: "oauth",
                      provider: PROVIDER_ID,
                      access: creds.access,
                      refresh: creds.refresh,
                      expires: creds.expires,
                      ...(creds.email ? { email: creds.email } : {}),
                    },
                  },
                ],
                configPatch: {},
                notes: [
                  "OpenAI Codex OAuth tokens auto-refresh via pi-ai. Re-run login if refresh fails.",
                ],
              };
            } catch (err) {
              spin.stop("OpenAI Codex OAuth failed");
              throw err;
            }
          },
        },
      ],
    });
  },
};

export default openaiCodexAuthPlugin;
