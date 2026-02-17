/**
 * Core channel commands implementation.
 * Provides standard slash commands for channel management.
 */

import {
  addMember,
  removeMember,
  updateMember,
  updateChannel,
  archiveChannel,
  pinMessage,
  unpinMessage,
  muteAgent,
  unmuteAgent,
  getChannel,
} from "../store/channel-store.js";
import type { AgentChannelMemberRole, AgentListeningMode } from "../types/channels.js";
import {
  registerCommand,
  type CommandContext,
  type CommandResult,
  getAllCommandsHelp,
  getCommandHelp,
} from "./registry.js";

// /help command
registerCommand({
  name: "help",
  aliases: ["h", "?"],
  description: "Show help for commands",
  usage: "/help [command]",
  examples: ["/help", "/help invite"],
  handler: async (ctx: CommandContext): Promise<CommandResult> => {
    if (ctx.args.length === 0) {
      return {
        success: true,
        message: getAllCommandsHelp(),
      };
    }

    const cmdName = ctx.args[0];
    const help = getCommandHelp(cmdName);
    if (!help) {
      return {
        success: false,
        error: `Unknown command: ${cmdName}`,
      };
    }

    return {
      success: true,
      message: help,
    };
  },
});

// /invite command
registerCommand({
  name: "invite",
  aliases: ["add"],
  description: "Invite an agent to the channel",
  usage: "/invite @agent [role]",
  examples: ["/invite @agent:coder", "/invite @Coder admin"],
  requiredPermission: "invite_agents",
  minArgs: 1,
  handler: async (ctx: CommandContext): Promise<CommandResult> => {
    const agentArg = ctx.args[0];
    const role = (ctx.args[1] as AgentChannelMemberRole) ?? "member";

    // Parse agent ID from mention format
    const agentId = parseAgentFromArg(agentArg);
    if (!agentId) {
      return {
        success: false,
        error: "Invalid agent format. Use @agent:id or @AgentName",
      };
    }

    // Validate role
    const validRoles: AgentChannelMemberRole[] = ["admin", "member", "observer"];
    if (!validRoles.includes(role)) {
      return {
        success: false,
        error: `Invalid role. Must be one of: ${validRoles.join(", ")}`,
      };
    }

    // Cannot assign owner role
    if (role === "owner") {
      return {
        success: false,
        error: "Cannot assign owner role. Use /transfer to transfer ownership.",
      };
    }

    const member = await addMember(ctx.channelId, agentId, { role });

    return {
      success: true,
      message: `Invited ${agentId} as ${role}`,
      data: member,
    };
  },
});

// /kick command
registerCommand({
  name: "kick",
  aliases: ["remove"],
  description: "Remove an agent from the channel",
  usage: "/kick @agent [reason]",
  examples: ["/kick @agent:coder", "/kick @Coder no longer needed"],
  requiredPermission: "kick_agents",
  minArgs: 1,
  handler: async (ctx: CommandContext): Promise<CommandResult> => {
    const agentArg = ctx.args[0];
    const reason = ctx.args.slice(1).join(" ") || undefined;

    const agentId = parseAgentFromArg(agentArg);
    if (!agentId) {
      return {
        success: false,
        error: "Invalid agent format. Use @agent:id or @AgentName",
      };
    }

    // Cannot kick yourself
    if (agentId === ctx.executorId) {
      return {
        success: false,
        error: "Cannot kick yourself. Use /leave to leave the channel.",
      };
    }

    // Check if target exists and their role
    const targetMember = ctx.channel.members.find((m) => m.agentId === agentId);
    if (!targetMember) {
      return {
        success: false,
        error: `Agent ${agentId} is not in this channel`,
      };
    }

    // Cannot kick owner
    if (targetMember.role === "owner") {
      return {
        success: false,
        error: "Cannot kick the channel owner",
      };
    }

    // Admin can only kick members/observers
    if (ctx.executorMember.role === "admin" && targetMember.role === "admin") {
      return {
        success: false,
        error: "Admins cannot kick other admins",
      };
    }

    const removed = await removeMember(ctx.channelId, agentId);
    if (!removed) {
      return {
        success: false,
        error: "Failed to remove agent",
      };
    }

    return {
      success: true,
      message: reason ? `Kicked ${agentId}: ${reason}` : `Kicked ${agentId}`,
    };
  },
});

// /topic command
registerCommand({
  name: "topic",
  description: "Set the channel topic",
  usage: "/topic <text>",
  examples: ["/topic Welcome to the coding channel!"],
  requiredPermission: "set_topic",
  minArgs: 1,
  handler: async (ctx: CommandContext): Promise<CommandResult> => {
    const topic = ctx.rawArgs;

    await updateChannel(ctx.channelId, { topic });

    return {
      success: true,
      message: `Topic set to: ${topic}`,
    };
  },
});

// /pin command
registerCommand({
  name: "pin",
  description: "Pin a message to the channel",
  usage: "/pin <message_id>",
  requiredPermission: "pin_messages",
  minArgs: 1,
  maxArgs: 1,
  handler: async (ctx: CommandContext): Promise<CommandResult> => {
    const messageId = ctx.args[0];

    await pinMessage(ctx.channelId, messageId);

    return {
      success: true,
      message: `Message pinned`,
    };
  },
});

// /unpin command
registerCommand({
  name: "unpin",
  description: "Unpin a message from the channel",
  usage: "/unpin <message_id>",
  requiredPermission: "pin_messages",
  minArgs: 1,
  maxArgs: 1,
  handler: async (ctx: CommandContext): Promise<CommandResult> => {
    const messageId = ctx.args[0];

    await unpinMessage(ctx.channelId, messageId);

    return {
      success: true,
      message: `Message unpinned`,
    };
  },
});

// /mute command
registerCommand({
  name: "mute",
  description: "Mute an agent in the channel",
  usage: "/mute @agent [duration]",
  examples: ["/mute @agent:coder", "/mute @Coder 1h", "/mute @Coder 30m"],
  requiredPermission: "mute_agents",
  minArgs: 1,
  handler: async (ctx: CommandContext): Promise<CommandResult> => {
    const agentArg = ctx.args[0];
    const durationArg = ctx.args[1];

    const agentId = parseAgentFromArg(agentArg);
    if (!agentId) {
      return {
        success: false,
        error: "Invalid agent format",
      };
    }

    // Parse duration
    let durationSeconds: number | undefined;
    if (durationArg) {
      durationSeconds = parseDuration(durationArg) ?? undefined;
      if (!durationSeconds) {
        return {
          success: false,
          error: "Invalid duration format. Use: 30m, 1h, 1d, etc.",
        };
      }
    }

    await muteAgent(ctx.channelId, agentId, durationSeconds);

    const durationText = durationSeconds
      ? `for ${formatDuration(durationSeconds)}`
      : "indefinitely";

    return {
      success: true,
      message: `Muted ${agentId} ${durationText}`,
    };
  },
});

// /unmute command
registerCommand({
  name: "unmute",
  description: "Unmute an agent in the channel",
  usage: "/unmute @agent",
  requiredPermission: "mute_agents",
  minArgs: 1,
  maxArgs: 1,
  handler: async (ctx: CommandContext): Promise<CommandResult> => {
    const agentArg = ctx.args[0];

    const agentId = parseAgentFromArg(agentArg);
    if (!agentId) {
      return {
        success: false,
        error: "Invalid agent format",
      };
    }

    await unmuteAgent(ctx.channelId, agentId);

    return {
      success: true,
      message: `Unmuted ${agentId}`,
    };
  },
});

// /archive command
registerCommand({
  name: "archive",
  description: "Archive the channel",
  usage: "/archive",
  requiredPermission: "archive_channel",
  handler: async (ctx: CommandContext): Promise<CommandResult> => {
    await archiveChannel(ctx.channelId, ctx.executorId);

    return {
      success: true,
      message: "Channel archived",
    };
  },
});

// /leave command
registerCommand({
  name: "leave",
  description: "Leave the channel",
  usage: "/leave",
  handler: async (ctx: CommandContext): Promise<CommandResult> => {
    // Owner cannot leave without transferring ownership
    if (ctx.executorMember.role === "owner") {
      return {
        success: false,
        error: "Channel owner cannot leave. Use /transfer first.",
      };
    }

    await removeMember(ctx.channelId, ctx.executorId);

    return {
      success: true,
      message: "You have left the channel",
    };
  },
});

// /role command
registerCommand({
  name: "role",
  description: "Change an agent's role in the channel",
  usage: "/role @agent <role>",
  examples: ["/role @agent:coder admin", "/role @Coder member"],
  requiredPermission: "manage_settings",
  minArgs: 2,
  maxArgs: 2,
  handler: async (ctx: CommandContext): Promise<CommandResult> => {
    const agentArg = ctx.args[0];
    const role = ctx.args[1] as AgentChannelMemberRole;

    const agentId = parseAgentFromArg(agentArg);
    if (!agentId) {
      return {
        success: false,
        error: "Invalid agent format",
      };
    }

    const validRoles: AgentChannelMemberRole[] = ["admin", "member", "observer"];
    if (!validRoles.includes(role)) {
      return {
        success: false,
        error: `Invalid role. Must be one of: ${validRoles.join(", ")}`,
      };
    }

    // Only owner can promote to admin
    if (role === "admin" && ctx.executorMember.role !== "owner") {
      return {
        success: false,
        error: "Only the owner can promote to admin",
      };
    }

    await updateMember(ctx.channelId, agentId, { role });

    return {
      success: true,
      message: `Changed ${agentId}'s role to ${role}`,
    };
  },
});

// /mode command
registerCommand({
  name: "mode",
  description: "Change an agent's listening mode",
  usage: "/mode @agent <mode>",
  examples: ["/mode @agent:coder active", "/mode @Coder mention-only"],
  minArgs: 2,
  maxArgs: 2,
  handler: async (ctx: CommandContext): Promise<CommandResult> => {
    const agentArg = ctx.args[0];
    const mode = ctx.args[1] as AgentListeningMode;

    const agentId = parseAgentFromArg(agentArg);
    if (!agentId) {
      return {
        success: false,
        error: "Invalid agent format",
      };
    }

    // Can only change own mode unless admin/owner
    if (
      agentId !== ctx.executorId &&
      ctx.executorMember.role !== "owner" &&
      ctx.executorMember.role !== "admin"
    ) {
      return {
        success: false,
        error: "Can only change your own listening mode",
      };
    }

    const validModes: AgentListeningMode[] = ["active", "mention-only", "observer", "coordinator"];
    if (!validModes.includes(mode)) {
      return {
        success: false,
        error: `Invalid mode. Must be one of: ${validModes.join(", ")}`,
      };
    }

    await updateMember(ctx.channelId, agentId, { listeningMode: mode });

    return {
      success: true,
      message: `Changed ${agentId}'s mode to ${mode}`,
    };
  },
});

// /members command
registerCommand({
  name: "members",
  aliases: ["who"],
  description: "List channel members",
  usage: "/members",
  handler: async (ctx: CommandContext): Promise<CommandResult> => {
    const channel = await getChannel(ctx.channelId);
    if (!channel) {
      return {
        success: false,
        error: "Channel not found",
      };
    }

    const memberList = channel.members
      .map((m) => {
        const roleIcon = m.role === "owner" ? "👑" : m.role === "admin" ? "⭐" : "";
        const modeIcon =
          m.listeningMode === "active"
            ? "🟢"
            : m.listeningMode === "mention-only"
              ? "🔔"
              : m.listeningMode === "observer"
                ? "👁"
                : "🎯";
        return `${roleIcon}${modeIcon} ${m.customName ?? m.agentId} (${m.role}, ${m.listeningMode})`;
      })
      .join("\n");

    return {
      success: true,
      message: `**Channel Members (${channel.members.length})**\n\n${memberList}`,
    };
  },
});

// /transfer command
registerCommand({
  name: "transfer",
  description: "Transfer channel ownership",
  usage: "/transfer @agent",
  requiredPermission: "manage_settings", // Only owner has this permission effectively
  minArgs: 1,
  maxArgs: 1,
  handler: async (ctx: CommandContext): Promise<CommandResult> => {
    // Only owner can transfer
    if (ctx.executorMember.role !== "owner") {
      return {
        success: false,
        error: "Only the owner can transfer ownership",
      };
    }

    const agentArg = ctx.args[0];
    const agentId = parseAgentFromArg(agentArg);
    if (!agentId) {
      return {
        success: false,
        error: "Invalid agent format",
      };
    }

    // Check if target is a member
    const targetMember = ctx.channel.members.find((m) => m.agentId === agentId);
    if (!targetMember) {
      return {
        success: false,
        error: `Agent ${agentId} is not in this channel`,
      };
    }

    // Transfer ownership
    await updateMember(ctx.channelId, agentId, { role: "owner" });
    await updateMember(ctx.channelId, ctx.executorId, { role: "admin" });

    return {
      success: true,
      message: `Transferred ownership to ${agentId}`,
    };
  },
});

// Helper functions
function parseAgentFromArg(arg: string): string | null {
  // @agent:id format
  const explicitMatch = arg.match(/@agent:([a-zA-Z0-9_-]+)/);
  if (explicitMatch) {
    return explicitMatch[1];
  }

  // @AgentName format (just use as ID)
  const patternMatch = arg.match(/@([a-zA-Z0-9_-]+)/);
  if (patternMatch) {
    return patternMatch[1];
  }

  // Plain ID
  if (/^[a-zA-Z0-9_-]+$/.test(arg)) {
    return arg;
  }

  return null;
}

function parseDuration(input: string): number | null {
  const match = input.match(/^(\d+)(s|m|h|d|w)$/i);
  if (!match) {
    return null;
  }

  const value = Number.parseInt(match[1], 10);
  const unit = match[2].toLowerCase();

  const multipliers: Record<string, number> = {
    s: 1,
    m: 60,
    h: 60 * 60,
    d: 60 * 60 * 24,
    w: 60 * 60 * 24 * 7,
  };

  return value * multipliers[unit];
}

function formatDuration(seconds: number): string {
  if (seconds < 60) {
    return `${seconds}s`;
  }
  if (seconds < 3600) {
    return `${Math.floor(seconds / 60)}m`;
  }
  if (seconds < 86400) {
    return `${Math.floor(seconds / 3600)}h`;
  }
  return `${Math.floor(seconds / 86400)}d`;
}
