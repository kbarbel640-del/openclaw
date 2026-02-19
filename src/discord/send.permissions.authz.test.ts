import { describe, expect, it, vi } from "vitest";
import { PermissionFlagsBits, Routes } from "discord-api-types/v10";
import type { RequestClient } from "@buape/carbon";
import { fetchMemberGuildPermissionsDiscord, hasGuildPermissionDiscord } from "./send.permissions.js";

const mockRest = vi.hoisted(() => ({
  get: vi.fn(),
}));

vi.mock("./client.js", () => ({
  resolveDiscordRest: () => mockRest as RequestClient,
}));

describe("Discord Guild Permissions Authorization", () => {
  describe("fetchMemberGuildPermissionsDiscord", () => {
    it("returns null when member is not in guild", async () => {
      mockRest.get.mockRejectedValueOnce(new Error("404 Member not found"));

      const result = await fetchMemberGuildPermissionsDiscord("guild123", "user456");

      expect(result).toBeNull();
    });

    it("calculates permissions from guild @everyone role and member roles", async () => {
      const guildId = "guild123";
      const userId = "user456";
      const everyoneRoleId = guildId; // @everyone role has same ID as guild

      mockRest.get
        .mockResolvedValueOnce({
          id: guildId,
          roles: [
            {
              id: everyoneRoleId,
              name: "@everyone",
              permissions: PermissionFlagsBits.ViewChannel.toString(),
            },
            {
              id: "role-moderator",
              name: "Moderator",
              permissions: PermissionFlagsBits.KickMembers.toString(),
            },
          ],
        })
        .mockResolvedValueOnce({
          id: userId,
          roles: ["role-moderator"],
        });

      const result = await fetchMemberGuildPermissionsDiscord(guildId, userId);

      expect(result).toBeDefined();
      expect(result).not.toBeNull();
      // Should have both ViewChannel and KickMembers permissions
      const hasViewChannel = (result! & PermissionFlagsBits.ViewChannel) === PermissionFlagsBits.ViewChannel;
      const hasKickMembers = (result! & PermissionFlagsBits.KickMembers) === PermissionFlagsBits.KickMembers;
      expect(hasViewChannel).toBe(true);
      expect(hasKickMembers).toBe(true);
    });

    it("handles user with ADMINISTRATOR permission", async () => {
      const guildId = "guild123";
      const userId = "user456";

      mockRest.get
        .mockResolvedValueOnce({
          id: guildId,
          roles: [
            {
              id: guildId,
              permissions: PermissionFlagsBits.ViewChannel.toString(),
            },
            {
              id: "role-admin",
              name: "Admin",
              permissions: PermissionFlagsBits.Administrator.toString(),
            },
          ],
        })
        .mockResolvedValueOnce({
          id: userId,
          roles: ["role-admin"],
        });

      const result = await fetchMemberGuildPermissionsDiscord(guildId, userId);

      expect(result).toBeDefined();
      expect(result).not.toBeNull();
      const hasAdmin = (result! & PermissionFlagsBits.Administrator) === PermissionFlagsBits.Administrator;
      expect(hasAdmin).toBe(true);
    });
  });

  describe("hasGuildPermissionDiscord", () => {
    it("returns false when user is not a guild member", async () => {
      mockRest.get.mockRejectedValueOnce(new Error("404 Member not found"));

      const result = await hasGuildPermissionDiscord("guild123", "user456", [PermissionFlagsBits.KickMembers]);

      expect(result).toBe(false);
    });

    it("returns true when user has required permission", async () => {
      const guildId = "guild123";
      const userId = "user456";

      mockRest.get
        .mockResolvedValueOnce({
          id: guildId,
          roles: [
            {
              id: guildId,
              permissions: "0",
            },
            {
              id: "role-moderator",
              permissions: PermissionFlagsBits.KickMembers.toString(),
            },
          ],
        })
        .mockResolvedValueOnce({
          id: userId,
          roles: ["role-moderator"],
        });

      const result = await hasGuildPermissionDiscord(guildId, userId, [PermissionFlagsBits.KickMembers]);

      expect(result).toBe(true);
    });

    it("returns true when user has ADMINISTRATOR permission", async () => {
      const guildId = "guild123";
      const userId = "user456";

      mockRest.get
        .mockResolvedValueOnce({
          id: guildId,
          roles: [
            {
              id: guildId,
              permissions: "0",
            },
            {
              id: "role-admin",
              permissions: PermissionFlagsBits.Administrator.toString(),
            },
          ],
        })
        .mockResolvedValueOnce({
          id: userId,
          roles: ["role-admin"],
        });

      const result = await hasGuildPermissionDiscord(guildId, userId, [
        PermissionFlagsBits.KickMembers,
        PermissionFlagsBits.BanMembers,
      ]);

      expect(result).toBe(true);
    });

    it("returns false when user lacks required permission", async () => {
      const guildId = "guild123";
      const userId = "user456";

      mockRest.get
        .mockResolvedValueOnce({
          id: guildId,
          roles: [
            {
              id: guildId,
              permissions: PermissionFlagsBits.ViewChannel.toString(),
            },
          ],
        })
        .mockResolvedValueOnce({
          id: userId,
          roles: [],
        });

      const result = await hasGuildPermissionDiscord(guildId, userId, [PermissionFlagsBits.KickMembers]);

      expect(result).toBe(false);
    });

    it("returns true when user has any of multiple required permissions", async () => {
      const guildId = "guild123";
      const userId = "user456";

      mockRest.get
        .mockResolvedValueOnce({
          id: guildId,
          roles: [
            {
              id: guildId,
              permissions: "0",
            },
            {
              id: "role-moderator",
              permissions: PermissionFlagsBits.KickMembers.toString(),
            },
          ],
        })
        .mockResolvedValueOnce({
          id: userId,
          roles: ["role-moderator"],
        });

      const result = await hasGuildPermissionDiscord(guildId, userId, [
        PermissionFlagsBits.BanMembers,
        PermissionFlagsBits.KickMembers,
      ]);

      expect(result).toBe(true);
    });

    it("returns false when user lacks all required permissions", async () => {
      const guildId = "guild123";
      const userId = "user456";

      mockRest.get
        .mockResolvedValueOnce({
          id: guildId,
          roles: [
            {
              id: guildId,
              permissions: PermissionFlagsBits.ViewChannel.toString(),
            },
          ],
        })
        .mockResolvedValueOnce({
          id: userId,
          roles: [],
        });

      const result = await hasGuildPermissionDiscord(guildId, userId, [
        PermissionFlagsBits.BanMembers,
        PermissionFlagsBits.KickMembers,
      ]);

      expect(result).toBe(false);
    });
  });
});
