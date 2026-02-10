import type { OpenClawPluginApi } from "openclaw/plugin-sdk";
import { emptyPluginConfigSchema } from "openclaw/plugin-sdk";
import { loginGoogleDriveOAuth } from "./src/auth.js";
import { registerGoogleDriveTools } from "./src/tools.js";

const PROVIDER_ID = "google-drive";
const PROVIDER_LABEL = "Google Drive OAuth";
const ENV_VARS = [
  "GOOGLE_CLIENT_ID",
  "GOOGLE_CLIENT_SECRET",
  "GOOGLE_OAUTH_REDIRECT_URL",
  "GOOGLE_TOKEN_ENCRYPTION_KEY",
];

const plugin = {
  id: "google-drive",
  name: "Google Drive",
  description: "Google Drive plugin for browsing and downloading files",
  configSchema: emptyPluginConfigSchema(),
  register(api: OpenClawPluginApi) {
    // Register provider for OAuth authentication
    api.registerProvider({
      id: PROVIDER_ID,
      label: PROVIDER_LABEL,
      docsPath: "/providers/models",
      aliases: ["gdrive"],
      envVars: ENV_VARS,
      auth: [
        {
          id: "oauth",
          label: "Google OAuth",
          hint: "PKCE + localhost callback",
          kind: "oauth",
          run: async (ctx) => {
            const spin = ctx.prompter.progress("Starting Google Drive OAuth…");
            try {
              const result = await loginGoogleDriveOAuth({
                isRemote: ctx.isRemote,
                openUrl: ctx.openUrl,
                log: (msg) => ctx.runtime.log(msg),
                note: ctx.prompter.note,
                prompt: async (message) => String(await ctx.prompter.text({ message })),
                progress: spin,
              });

              spin.stop("Google Drive OAuth complete");
              const profileId = `google-drive:${result.email ?? "default"}`;
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
                      email: result.email,
                    },
                  },
                ],
                notes: [
                  "Google Drive tool is now available. Add 'google_drive' to your agent's tools.allow list to enable it.",
                ],
              };
            } catch (err) {
              spin.stop("Google Drive OAuth failed");
              await ctx.prompter.note(
                "Trouble with OAuth? Ensure your Google account has Drive API access enabled.",
                "OAuth help",
              );
              throw err;
            }
          },
        },
      ],
    });

    // Register tools
    registerGoogleDriveTools(api);
  },
};

export default plugin;
