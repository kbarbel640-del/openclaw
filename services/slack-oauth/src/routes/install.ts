import { Hono } from "hono";
import { generateState } from "../oauth/state.js";
import type { Env } from "../env.js";

const BOT_SCOPES = [
  "chat:write",
  "channels:history",
  "channels:read",
  "groups:history",
  "im:history",
  "mpim:history",
  "users:read",
  "app_mentions:read",
  "reactions:read",
  "reactions:write",
  "pins:read",
  "pins:write",
  "emoji:read",
  "commands",
  "files:read",
  "files:write",
].join(",");

export function createInstallRoute(env: Env) {
  const install = new Hono();

  install.get("/slack/install", (c) => {
    const state = generateState(env.STATE_SECRET);
    const params = new URLSearchParams({
      client_id: env.SLACK_CLIENT_ID,
      scope: BOT_SCOPES,
      redirect_uri: env.SLACK_OAUTH_REDIRECT_URI,
      state,
    });

    return c.redirect(`https://slack.com/oauth/v2/authorize?${params.toString()}`);
  });

  return install;
}
