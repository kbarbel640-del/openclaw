import { describe, expect, it, vi } from "vitest";
import { PermissionFlagsBits } from "discord-api-types/v10";
import type { DiscordActionConfig } from "../../config/config.js";
import { handleDiscordModerationAction } from "./discord-actions-moderation.js";

const discordSendMocks = vi.hoisted(() => ({
  banMemberDiscord: vi.fn(async () => ({})),
  kickMemberDiscord: vi.fn(async () => ({})),
  timeoutMemberDiscord: vi.fn(async () => ({ id: "user123" })),
  hasGuildPermissionDiscord: vi.fn(async () => false),
}));

const { banMemberDiscord, kickMemberDiscord, timeoutMemberDiscord, hasGuildPermissionDiscord } =
  discordSendMocks;

vi.mock("../../discord/send.js", () => ({
  ...discordSendMocks,
}));

const enableAllActions = () => true;

describe("Discord Moderation Action Authorization", () => {
  describe("ban action", () => {
    it("rejects when sender lacks BAN_MEMBERS permission", async () => {
      hasGuildPermissionDiscord.mockResolvedValueOnce(false);

      await expect(
        handleDiscordModerationAction(
          "ban",
          {
            guildId: "guild123",
            userId: "user456",
            senderUserId: "sender789",
            reason: "test ban",
          },
          enableAllActions,
        ),
      ).rejects.toThrow("does not have required permissions");

      expect(hasGuildPermissionDiscord).toHaveBeenCalledWith(
        "guild123",
        "sender789",
        [PermissionFlagsBits.BanMembers],
        undefined,
      );
      expect(banMemberDiscord).not.toHaveBeenCalled();
    });

    it("rejects with 'missing sender user ID' error when senderUserId is not provided", async () => {
      await expect(
        handleDiscordModerationAction(
          "ban",
          {
            guildId: "guild123",
            userId: "user456",
            reason: "test ban",
          },
          enableAllActions,
        ),
      ).rejects.toThrow("Sender user ID required");
    });

    it("executes ban when sender has BAN_MEMBERS permission", async () => {
      hasGuildPermissionDiscord.mockResolvedValueOnce(true);
      banMemberDiscord.mockResolvedValueOnce({ ok: true });

      const result = await handleDiscordModerationAction(
        "ban",
        {
          guildId: "guild123",
          userId: "user456",
          senderUserId: "sender789",
          reason: "test ban",
          deleteMessageDays: 7,
        },
        enableAllActions,
      );

      expect(result.content).toEqual({ ok: true });
      expect(hasGuildPermissionDiscord).toHaveBeenCalledWith(
        "guild123",
        "sender789",
        [PermissionFlagsBits.BanMembers],
        undefined,
      );
      expect(banMemberDiscord).toHaveBeenCalledWith(
        {
          guildId: "guild123",
          userId: "user456",
          reason: "test ban",
          deleteMessageDays: 7,
        },
        undefined,
      );
    });

    it("executes ban with accountId when sender has BAN_MEMBERS permission", async () => {
      hasGuildPermissionDiscord.mockResolvedValueOnce(true);
      banMemberDiscord.mockResolvedValueOnce({ ok: true });

      const result = await handleDiscordModerationAction(
        "ban",
        {
          guildId: "guild123",
          userId: "user456",
          senderUserId: "sender789",
          accountId: "account999",
          reason: "test ban",
        },
        enableAllActions,
      );

      expect(result.content).toEqual({ ok: true });
      expect(hasGuildPermissionDiscord).toHaveBeenCalledWith(
        "guild123",
        "sender789",
        [PermissionFlagsBits.BanMembers],
        { accountId: "account999" },
      );
      expect(banMemberDiscord).toHaveBeenCalledWith(
        {
          guildId: "guild123",
          userId: "user456",
          reason: "test ban",
          deleteMessageDays: undefined,
        },
        { accountId: "account999" },
      );
    });
  });

  describe("kick action", () => {
    it("rejects when sender lacks KICK_MEMBERS permission", async () => {
      hasGuildPermissionDiscord.mockResolvedValueOnce(false);

      await expect(
        handleDiscordModerationAction(
          "kick",
          {
            guildId: "guild123",
            userId: "user456",
            senderUserId: "sender789",
            reason: "test kick",
          },
          enableAllActions,
        ),
      ).rejects.toThrow("does not have required permissions");

      expect(hasGuildPermissionDiscord).toHaveBeenCalledWith(
        "guild123",
        "sender789",
        [PermissionFlagsBits.KickMembers],
        undefined,
      );
      expect(kickMemberDiscord).not.toHaveBeenCalled();
    });

    it("executes kick when sender has KICK_MEMBERS permission", async () => {
      hasGuildPermissionDiscord.mockResolvedValueOnce(true);
      kickMemberDiscord.mockResolvedValueOnce({ ok: true });

      const result = await handleDiscordModerationAction(
        "kick",
        {
          guildId: "guild123",
          userId: "user456",
          senderUserId: "sender789",
          reason: "test kick",
        },
        enableAllActions,
      );

      expect(result.content).toEqual({ ok: true });
      expect(hasGuildPermissionDiscord).toHaveBeenCalledWith(
        "guild123",
        "sender789",
        [PermissionFlagsBits.KickMembers],
        undefined,
      );
      expect(kickMemberDiscord).toHaveBeenCalledWith(
        { guildId: "guild123", userId: "user456", reason: "test kick" },
        undefined,
      );
    });
  });

  describe("timeout action", () => {
    it("rejects when sender lacks MODERATE_MEMBERS permission", async () => {
      hasGuildPermissionDiscord.mockResolvedValueOnce(false);

      await expect(
        handleDiscordModerationAction(
          "timeout",
          {
            guildId: "guild123",
            userId: "user456",
            senderUserId: "sender789",
            durationMinutes: 60,
          },
          enableAllActions,
        ),
      ).rejects.toThrow("does not have required permissions");

      expect(hasGuildPermissionDiscord).toHaveBeenCalledWith(
        "guild123",
        "sender789",
        [PermissionFlagsBits.ModerateMembers],
        undefined,
      );
      expect(timeoutMemberDiscord).not.toHaveBeenCalled();
    });

    it("executes timeout when sender has MODERATE_MEMBERS permission", async () => {
      hasGuildPermissionDiscord.mockResolvedValueOnce(true);
      timeoutMemberDiscord.mockResolvedValueOnce({ id: "user456" });

      const result = await handleDiscordModerationAction(
        "timeout",
        {
          guildId: "guild123",
          userId: "user456",
          senderUserId: "sender789",
          durationMinutes: 60,
          reason: "test timeout",
        },
        enableAllActions,
      );

      expect(result.content).toEqual({ ok: true, member: { id: "user456" } });
      expect(hasGuildPermissionDiscord).toHaveBeenCalledWith(
        "guild123",
        "sender789",
        [PermissionFlagsBits.ModerateMembers],
        undefined,
      );
      expect(timeoutMemberDiscord).toHaveBeenCalledWith(
        {
          guildId: "guild123",
          userId: "user456",
          durationMinutes: 60,
          until: undefined,
          reason: "test timeout",
        },
        undefined,
      );
    });

    it("allows timeout with until instead of durationMinutes", async () => {
      hasGuildPermissionDiscord.mockResolvedValueOnce(true);
      timeoutMemberDiscord.mockResolvedValueOnce({ id: "user456" });

      const result = await handleDiscordModerationAction(
        "timeout",
        {
          guildId: "guild123",
          userId: "user456",
          senderUserId: "sender789",
          until: "2024-12-31T23:59:59Z",
        },
        enableAllActions,
      );

      expect(result.content).toEqual({ ok: true, member: { id: "user456" } });
      expect(timeoutMemberDiscord).toHaveBeenCalledWith(
        {
          guildId: "guild123",
          userId: "user456",
          durationMinutes: undefined,
          until: "2024-12-31T23:59:59Z",
          reason: undefined,
        },
        undefined,
      );
    });
  });

  describe("disabled moderation", () => {
    const moderationDisabled = (key: keyof DiscordActionConfig) => key !== "moderation";

    it("rejects ban when moderation is disabled", async () => {
      await expect(
        handleDiscordModerationAction(
          "ban",
          {
            guildId: "guild123",
            userId: "user456",
            senderUserId: "sender789",
          },
          moderationDisabled,
        ),
      ).rejects.toThrow("Discord moderation is disabled");

      expect(hasGuildPermissionDiscord).not.toHaveBeenCalled();
      expect(banMemberDiscord).not.toHaveBeenCalled();
    });

    it("rejects kick when moderation is disabled", async () => {
      await expect(
        handleDiscordModerationAction(
          "kick",
          {
            guildId: "guild123",
            userId: "user456",
            senderUserId: "sender789",
          },
          moderationDisabled,
        ),
      ).rejects.toThrow("Discord moderation is disabled");

      expect(kickMemberDiscord).not.toHaveBeenCalled();
    });

    it("rejects timeout when moderation is disabled", async () => {
      await expect(
        handleDiscordModerationAction(
          "timeout",
          {
            guildId: "guild123",
            userId: "user456",
            senderUserId: "sender789",
          },
          moderationDisabled,
        ),
      ).rejects.toThrow("Discord moderation is disabled");

      expect(timeoutMemberDiscord).not.toHaveBeenCalled();
    });
  });
});
