import type { TeammateInfo } from "./teammates.js";
import { formatTeammateRoster } from "./teammates.js";

export type IdentityContextParams = {
  botUserId: string;
  botName?: string;
  displayName?: string;
  teammates?: TeammateInfo[];
};

export function buildIdentityContext(params: IdentityContextParams): string {
  const { botUserId, botName, displayName, teammates } = params;
  const name = displayName || botName || "Assistant";

  const identityBlock = [
    "## Your Identity",
    `- Name: ${name}`,
    `- Slack User ID: ${botUserId}`,
    `- Mention format: <@${botUserId}>`,
  ].join("\n");

  const teammatesBlock = teammates && teammates.length > 0 ? formatTeammateRoster(teammates) : "";

  return [identityBlock, teammatesBlock].filter(Boolean).join("\n\n");
}
