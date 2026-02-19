import path from "node:path";
import type { AnyAgentTool, OpenClawPluginApi, OpenClawPluginService } from "openclaw/plugin-sdk";
import { KeepSession } from "./src/session.js";
import { createKeepTool } from "./src/tool.js";

type KeepPluginConfig = {
  listUrl?: string;
  profileDir?: string;
  timeoutMs?: number;
};

export default function register(api: OpenClawPluginApi): void {
  const cfg = (api.pluginConfig ?? {}) as KeepPluginConfig;
  const stateDir = api.runtime.state.resolveStateDir();
  const profileDir = cfg.profileDir ?? path.join(stateDir, "plugins", "google-keep", "profile");
  const timeoutMs = cfg.timeoutMs ?? 15_000;

  const session = new KeepSession({
    profileDir,
    timeoutMs,
    logger: api.logger,
  });

  const service: OpenClawPluginService = {
    id: "google-keep-session",
    start: async () => {
      // Lazy initialization — browser starts on first tool call
    },
    stop: async () => {
      await session.close();
    },
  };

  api.registerService(service);
  api.registerTool(createKeepTool(api, session) as unknown as AnyAgentTool, { optional: true });

  api.registerCommand({
    name: "keep",
    description: "Manage Google Keep browser session (login, status).",
    acceptsArgs: true,
    handler: async (ctx) => {
      const action = (ctx.args ?? "").trim().split(/\s+/)[0]?.toLowerCase() ?? "";

      if (action === "login") {
        let loginResult: Awaited<ReturnType<typeof session.openLoginBrowser>>;
        try {
          loginResult = await session.openLoginBrowser();
        } catch (err) {
          return {
            text: `Google Keep: failed to open browser — ${err instanceof Error ? err.message : String(err)}`,
          };
        }

        // Watch for successful login in the background, then close the browser
        void (async () => {
          const { context, page } = loginResult;
          try {
            await page.waitForURL((url) => !url.href.includes("accounts.google.com"), {
              timeout: 5 * 60_000,
            });
            await context.close();
            api.logger.info("google-keep: login completed, browser closed");
          } catch {
            // Timed out or browser was closed manually — that is fine
          }
        })();

        return {
          text: [
            "Google Keep: browser window opened.",
            "Sign in with your Google account — the window will close automatically once complete.",
            "Your session will be saved for future use.",
          ].join("\n"),
        };
      }

      if (action === "status") {
        return {
          text: "Google Keep: use /keep login to authenticate if tool calls fail with auth errors.",
        };
      }

      return {
        text: [
          "Google Keep commands:",
          "",
          "/keep login   — Open browser to sign in to Google Keep",
          "/keep status  — Show session status",
        ].join("\n"),
      };
    },
  });
}
