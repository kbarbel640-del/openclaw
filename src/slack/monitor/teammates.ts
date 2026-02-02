import type { WebClient } from "@slack/web-api";
import { logVerbose } from "../../globals.js";

export type TeammateInfo = {
  userId: string;
  name: string;
  displayName: string;
  isBot: boolean;
  deleted: boolean;
};

const MAX_PAGES = 10;

export async function discoverTeammates(params: {
  client: WebClient;
  token: string;
  selfUserId: string;
}): Promise<TeammateInfo[]> {
  const { client, token, selfUserId } = params;
  const teammates: TeammateInfo[] = [];

  try {
    let cursor: string | undefined;
    let page = 0;

    while (page < MAX_PAGES) {
      const response = await client.users.list({
        token,
        cursor,
        limit: 200,
      });

      if (!response.ok || !response.members) {
        break;
      }

      for (const member of response.members) {
        if (!member.is_bot || member.deleted || member.id === selfUserId) {
          continue;
        }

        teammates.push({
          userId: member.id ?? "",
          name: member.name ?? "",
          displayName:
            member.profile?.display_name || member.profile?.real_name || member.name || "",
          isBot: true,
          deleted: false,
        });
      }

      cursor = response.response_metadata?.next_cursor;
      if (!cursor) {
        break;
      }
      page++;
    }
  } catch (err) {
    logVerbose(`slack teammates discovery failed: ${String(err)}`);
    return [];
  }

  return teammates;
}

export function formatTeammateRoster(teammates: TeammateInfo[]): string {
  if (teammates.length === 0) {
    return "";
  }

  const lines = teammates.map((t) => `- @${t.name} (${t.userId}): ${t.displayName || "Bot user"}`);

  return `## Your Teammates (other bots in this workspace)\n${lines.join("\n")}\nWhen someone mentions a teammate, that message may not be for you.`;
}
