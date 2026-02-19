import type { AgentToolResult } from "@mariozechner/pi-agent-core";
import { PermissionFlagsBits } from "discord-api-types/v10";
import type { DiscordActionConfig } from "../../config/config.js";
import {
  banMemberDiscord,
  hasGuildPermissionDiscord,
  kickMemberDiscord,
  timeoutMemberDiscord,
} from "../../discord/send.js";
import { type ActionGate, jsonResult, readStringParam } from "./common.js";

/**
 * Verify sender has required permissions to execute moderation action
 * @param guildId - Guild ID where action is taking place
 * @param senderUserId - Discord user ID of the action sender
 * @param requiredPermissions - Array of permission bits (any one satisfies the check)
 * @param accountId - Optional Discord account ID for API calls
 * @throws Error if sender lacks required permissions
 */
async function verifySenderModerationPermission(
  guildId: string,
  senderUserId: string | undefined,
  requiredPermissions: bigint[],
  accountId?: string,
): Promise<void> {
  if (!senderUserId) {
    throw new Error("Sender user ID required for moderation action authorization check");
  }

  const hasPermission = await hasGuildPermissionDiscord(guildId, senderUserId, requiredPermissions, accountId ? { accountId } : undefined);
  if (!hasPermission) {
    throw new Error(
      `User does not have required permissions to execute this moderation action. Required: ${requiredPermissions.map((p) => p.toString()).join(" or ")}`,
    );
  }
}

export async function handleDiscordModerationAction(
  action: string,
  params: Record<string, unknown>,
  isActionEnabled: ActionGate<DiscordActionConfig>,
): Promise<AgentToolResult<unknown>> {
  const accountId = readStringParam(params, "accountId");
  const senderUserId = readStringParam(params, "senderUserId");

  switch (action) {
    case "timeout": {
      if (!isActionEnabled("moderation", false)) {
        throw new Error("Discord moderation is disabled.");
      }
      const guildId = readStringParam(params, "guildId", {
        required: true,
      });
      const userId = readStringParam(params, "userId", {
        required: true,
      });
      const durationMinutes =
        typeof params.durationMinutes === "number" && Number.isFinite(params.durationMinutes)
          ? params.durationMinutes
          : undefined;
      const until = readStringParam(params, "until");
      const reason = readStringParam(params, "reason");

      // Verify sender has required permissions (ADMINISTRATOR or MODERATE_MEMBERS)
      await verifySenderModerationPermission(
        guildId,
        senderUserId,
        [PermissionFlagsBits.ModerateMembers],
        accountId,
      );

      const member = accountId
        ? await timeoutMemberDiscord(
            {
              guildId,
              userId,
              durationMinutes,
              until,
              reason,
            },
            { accountId },
          )
        : await timeoutMemberDiscord({
            guildId,
            userId,
            durationMinutes,
            until,
            reason,
          });
      return jsonResult({ ok: true, member });
    }
    case "kick": {
      if (!isActionEnabled("moderation", false)) {
        throw new Error("Discord moderation is disabled.");
      }
      const guildId = readStringParam(params, "guildId", {
        required: true,
      });
      const userId = readStringParam(params, "userId", {
        required: true,
      });
      const reason = readStringParam(params, "reason");

      // Verify sender has required permissions (ADMINISTRATOR or KICK_MEMBERS)
      await verifySenderModerationPermission(
        guildId,
        senderUserId,
        [PermissionFlagsBits.KickMembers],
        accountId,
      );

      if (accountId) {
        await kickMemberDiscord({ guildId, userId, reason }, { accountId });
      } else {
        await kickMemberDiscord({ guildId, userId, reason });
      }
      return jsonResult({ ok: true });
    }
    case "ban": {
      if (!isActionEnabled("moderation", false)) {
        throw new Error("Discord moderation is disabled.");
      }
      const guildId = readStringParam(params, "guildId", {
        required: true,
      });
      const userId = readStringParam(params, "userId", {
        required: true,
      });
      const reason = readStringParam(params, "reason");
      const deleteMessageDays =
        typeof params.deleteMessageDays === "number" && Number.isFinite(params.deleteMessageDays)
          ? params.deleteMessageDays
          : undefined;

      // Verify sender has required permissions (ADMINISTRATOR or BAN_MEMBERS)
      await verifySenderModerationPermission(
        guildId,
        senderUserId,
        [PermissionFlagsBits.BanMembers],
        accountId,
      );

      if (accountId) {
        await banMemberDiscord(
          {
            guildId,
            userId,
            reason,
            deleteMessageDays,
          },
          { accountId },
        );
      } else {
        await banMemberDiscord({
          guildId,
          userId,
          reason,
          deleteMessageDays,
        });
      }
      return jsonResult({ ok: true });
    }
    default:
      throw new Error(`Unknown action: ${action}`);
  }
}
