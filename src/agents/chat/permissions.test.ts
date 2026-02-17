import { describe, it, expect } from "vitest";
import {
  checkPermission,
  checkAgentAction,
  canSendMessage,
  canCreateThread,
  canDeleteMessage,
  getAgentPermissions,
  hasAnyPermission,
  hasAllPermissions,
  canAccessChannel,
} from "./permissions.js";
import type { AgentChannel } from "./types/channels.js";

describe("permissions", () => {
  const createChannel = (
    members: Array<{
      agentId: string;
      role: "owner" | "admin" | "member" | "observer";
    }>,
    options?: Partial<AgentChannel>,
  ): AgentChannel => ({
    id: "test-channel",
    type: "public",
    name: "Test Channel",
    createdAt: Date.now(),
    createdBy: "admin",
    members: members.map((m) => ({
      agentId: m.agentId,
      role: m.role,
      listeningMode: "mention-only" as const,
      joinedAt: Date.now(),
    })),
    ...options,
  });

  describe("checkPermission", () => {
    it("should allow owner all permissions", () => {
      const channel = createChannel([{ agentId: "owner", role: "owner" }]);

      expect(checkPermission(channel, "owner", "send_messages").allowed).toBe(true);
      expect(checkPermission(channel, "owner", "archive_channel").allowed).toBe(true);
      expect(checkPermission(channel, "owner", "manage_settings").allowed).toBe(true);
    });

    it("should check admin permissions correctly", () => {
      const channel = createChannel([{ agentId: "admin", role: "admin" }]);

      expect(checkPermission(channel, "admin", "send_messages").allowed).toBe(true);
      expect(checkPermission(channel, "admin", "invite_agents").allowed).toBe(true);
      expect(checkPermission(channel, "admin", "archive_channel").allowed).toBe(false);
    });

    it("should check member permissions correctly", () => {
      const channel = createChannel([{ agentId: "member", role: "member" }]);

      expect(checkPermission(channel, "member", "send_messages").allowed).toBe(true);
      expect(checkPermission(channel, "member", "create_threads").allowed).toBe(true);
      expect(checkPermission(channel, "member", "invite_agents").allowed).toBe(false);
    });

    it("should deny observer all permissions", () => {
      const channel = createChannel([{ agentId: "observer", role: "observer" }]);

      expect(checkPermission(channel, "observer", "send_messages").allowed).toBe(false);
    });

    it("should deny non-members", () => {
      const channel = createChannel([{ agentId: "member", role: "member" }]);

      const result = checkPermission(channel, "stranger", "send_messages");
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain("not a member");
    });
  });

  describe("checkAgentAction", () => {
    it("should allow owner to kick anyone except self", () => {
      const channel = createChannel([
        { agentId: "owner", role: "owner" },
        { agentId: "admin", role: "admin" },
        { agentId: "member", role: "member" },
      ]);

      expect(checkAgentAction(channel, "owner", "admin", "kick").allowed).toBe(true);
      expect(checkAgentAction(channel, "owner", "member", "kick").allowed).toBe(true);
      expect(checkAgentAction(channel, "owner", "owner", "kick").allowed).toBe(false);
    });

    it("should not allow kicking the owner", () => {
      const channel = createChannel([
        { agentId: "owner", role: "owner" },
        { agentId: "admin", role: "admin" },
      ]);

      const result = checkAgentAction(channel, "admin", "owner", "kick");
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain("owner");
    });

    it("should not allow admins to kick other admins", () => {
      const channel = createChannel([
        { agentId: "admin1", role: "admin" },
        { agentId: "admin2", role: "admin" },
      ]);

      expect(checkAgentAction(channel, "admin1", "admin2", "kick").allowed).toBe(false);
    });

    it("should allow owner to change own mode", () => {
      const channel = createChannel([{ agentId: "owner1", role: "owner" }]);

      expect(checkAgentAction(channel, "owner1", "owner1", "mode_change").allowed).toBe(true);
    });

    it("should deny member changing own mode (requires manage_settings)", () => {
      const channel = createChannel([{ agentId: "member", role: "member" }]);

      expect(checkAgentAction(channel, "member", "member", "mode_change").allowed).toBe(false);
    });
  });

  describe("canSendMessage", () => {
    it("should allow members to send messages", () => {
      const channel = createChannel([{ agentId: "member", role: "member" }]);
      expect(canSendMessage(channel, "member").allowed).toBe(true);
    });

    it("should deny sending to archived channels", () => {
      const channel = createChannel([{ agentId: "member", role: "member" }], { archived: true });

      const result = canSendMessage(channel, "member");
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain("archived");
    });
  });

  describe("canCreateThread", () => {
    it("should allow members to create threads by default", () => {
      const channel = createChannel([{ agentId: "member", role: "member" }]);
      expect(canCreateThread(channel, "member").allowed).toBe(true);
    });

    it("should deny when threads are disabled", () => {
      const channel = createChannel([{ agentId: "member", role: "member" }], {
        settings: { allowThreads: false },
      });

      const result = canCreateThread(channel, "member");
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain("disabled");
    });
  });

  describe("canDeleteMessage", () => {
    it("should allow users to delete own messages", () => {
      const channel = createChannel([{ agentId: "member", role: "member" }]);
      expect(canDeleteMessage(channel, "member", "member").allowed).toBe(true);
    });

    it("should require permission to delete others' messages", () => {
      const channel = createChannel([{ agentId: "member", role: "member" }]);

      expect(canDeleteMessage(channel, "member", "other").allowed).toBe(false);
    });

    it("should allow admins to delete any message", () => {
      const channel = createChannel([{ agentId: "admin", role: "admin" }]);

      expect(canDeleteMessage(channel, "admin", "other").allowed).toBe(true);
    });
  });

  describe("getAgentPermissions", () => {
    it("should return all permissions for owner", () => {
      const channel = createChannel([{ agentId: "owner", role: "owner" }]);
      const perms = getAgentPermissions(channel, "owner");

      expect(perms.length).toBeGreaterThan(0);
      expect(perms).toContain("send_messages");
    });

    it("should return limited permissions for member", () => {
      const channel = createChannel([{ agentId: "member", role: "member" }]);
      const perms = getAgentPermissions(channel, "member");

      expect(perms).toContain("send_messages");
      expect(perms).toContain("create_threads");
      expect(perms).not.toContain("kick_agents");
    });

    it("should return empty for non-members", () => {
      const channel = createChannel([{ agentId: "member", role: "member" }]);
      expect(getAgentPermissions(channel, "stranger")).toEqual([]);
    });
  });

  describe("hasAnyPermission", () => {
    it("should return true if agent has any of the permissions", () => {
      const channel = createChannel([{ agentId: "member", role: "member" }]);

      expect(hasAnyPermission(channel, "member", ["send_messages", "kick_agents"])).toBe(true);
    });

    it("should return false if agent has none of the permissions", () => {
      const channel = createChannel([{ agentId: "member", role: "member" }]);

      expect(hasAnyPermission(channel, "member", ["kick_agents", "archive_channel"])).toBe(false);
    });
  });

  describe("hasAllPermissions", () => {
    it("should return true if agent has all permissions", () => {
      const channel = createChannel([{ agentId: "member", role: "member" }]);

      expect(hasAllPermissions(channel, "member", ["send_messages", "create_threads"])).toBe(true);
    });

    it("should return false if agent is missing any permission", () => {
      const channel = createChannel([{ agentId: "member", role: "member" }]);

      expect(hasAllPermissions(channel, "member", ["send_messages", "kick_agents"])).toBe(false);
    });
  });

  describe("canAccessChannel", () => {
    it("should allow members to access public channels", () => {
      const channel = createChannel([{ agentId: "member", role: "member" }]);
      expect(canAccessChannel(channel, "member").allowed).toBe(true);
    });

    it("should deny non-members access to private channels", () => {
      const channel = createChannel([{ agentId: "member", role: "member" }], { type: "private" });

      const result = canAccessChannel(channel, "stranger");
      expect(result.allowed).toBe(false);
    });

    it("should deny non-members access to DM channels", () => {
      const channel = createChannel([{ agentId: "member", role: "member" }], { type: "dm" });

      const result = canAccessChannel(channel, "stranger");
      expect(result.allowed).toBe(false);
    });
  });
});
