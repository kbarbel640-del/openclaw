import type { SlackEventMiddlewareArgs } from "@slack/bolt";
import type { SlackMonitorContext } from "../context.js";
import { danger, logVerbose } from "../../../globals.js";
import { VERSION } from "../../../version.js";
import { hasCurrentHomeTab, hasCustomHomeTab, markHomeTabPublished } from "../../home-tab-state.js";

/** @internal Exported for testing only. */
export function buildHomeTabBlocks(params: {
  botUserId: string;
  slashCommand?: string;
}): Record<string, unknown>[] {
  const cmd = params.slashCommand ?? "/openclaw";
  return [
    {
      type: "header",
      text: { type: "plain_text", text: "OpenClaw", emoji: true },
    },
    {
      type: "section",
      fields: [
        { type: "mrkdwn", text: `*Version:*\n\`${VERSION}\`` },
        { type: "mrkdwn", text: `*Bot:*\n<@${params.botUserId}>` },
      ],
    },
    { type: "divider" },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: "*Getting Started*\nSend me a DM or mention me in a channel to start a conversation.",
      },
    },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: [
          "*Slash Commands*",
          `• \`${cmd}\` — Main command`,
          `• \`${cmd} status\` — Check status`,
          `• \`${cmd} help\` — Show help`,
        ].join("\n"),
      },
    },
    { type: "divider" },
    {
      type: "context",
      elements: [
        {
          type: "mrkdwn",
          text: "<https://docs.openclaw.ai|Docs> · <https://github.com/openclaw/openclaw|GitHub> · <https://discord.com/invite/clawd|Community>",
        },
      ],
    },
  ];
}

export function registerSlackHomeTabEvents(params: { ctx: SlackMonitorContext }) {
  const { ctx } = params;

  ctx.app.event(
    "app_home_opened",
    async ({ event, body }: SlackEventMiddlewareArgs<"app_home_opened">) => {
      try {
        if (ctx.shouldDropMismatchedSlackEvent(body)) {
          return;
        }

        // Only handle the "home" tab (not "messages")
        if (event.tab !== "home") {
          return;
        }

        if (!ctx.botUserId) {
          logVerbose("slack: skipping home tab publish — botUserId not available");
          return;
        }

        const userId = event.user;

        // If the user has a custom (agent-pushed) view, don't overwrite it.
        if (hasCustomHomeTab(userId)) {
          logVerbose(`slack: home tab has custom view for ${userId}, skipping default publish`);
          return;
        }

        // Skip re-publish if this user already has the current version rendered
        if (hasCurrentHomeTab(userId, VERSION)) {
          logVerbose(`slack: home tab already published for ${userId}, skipping`);
          return;
        }

        const blocks = buildHomeTabBlocks({
          botUserId: ctx.botUserId,
          slashCommand: ctx.slashCommand.name ? `/${ctx.slashCommand.name}` : undefined,
        });

        await ctx.app.client.views.publish({
          token: ctx.botToken,
          user_id: userId,
          view: {
            type: "home",
            blocks,
          },
        });

        markHomeTabPublished(userId, VERSION);
      } catch (err) {
        ctx.runtime.error?.(danger(`slack app_home_opened handler failed: ${String(err)}`));
      }
    },
  );
}
