/**
 * Channel store for multi-agent chat system.
 * Handles CRUD operations for channels and members using PostgreSQL + Redis.
 */

import {
  getChatDbClient,
  REDIS_KEYS,
  REDIS_TTL,
  fromJsonb,
  fromTimestamp,
  toJsonb,
} from "../db/client.js";
import type {
  AgentChannel,
  AgentChannelMember,
  AgentChannelMemberRole,
  AgentListeningMode,
  ChannelMemberUpdate,
  CreateChannelParams,
  ExternalBinding,
  UpdateChannelParams,
} from "../types/channels.js";
import { generateChannelId } from "../types/channels.js";

// Database row types
type ChannelRow = {
  id: string;
  type: string;
  name: string;
  topic: string | null;
  description: string | null;
  created_at: Date;
  created_by: string;
  default_agent_id: string | null;
  archived: boolean;
  archived_at: Date | null;
  archived_by: string | null;
  settings: string | null;
  pinned_message_ids: string[] | null;
};

type MemberRow = {
  channel_id: string;
  agent_id: string;
  role: string;
  listening_mode: string;
  receive_broadcasts: boolean;
  custom_name: string | null;
  joined_at: Date;
  muted_until: Date | null;
};

type BindingRow = {
  binding_id: string;
  channel_id: string;
  platform: string;
  external_account_id: string;
  external_target_id: string;
  direction: string;
  sync_options: string;
  created_at: Date;
  enabled: boolean;
  last_sync_at: Date | null;
  sync_cursor: string | null;
};

// Transform functions
function rowToChannel(row: ChannelRow, members: AgentChannelMember[] = []): AgentChannel {
  return {
    id: row.id,
    type: row.type as AgentChannel["type"],
    name: row.name,
    topic: row.topic ?? undefined,
    description: row.description ?? undefined,
    createdAt: fromTimestamp(row.created_at) ?? Date.now(),
    createdBy: row.created_by,
    members,
    defaultAgentId: row.default_agent_id ?? undefined,
    archived: row.archived,
    archivedAt: fromTimestamp(row.archived_at) ?? undefined,
    archivedBy: row.archived_by ?? undefined,
    settings: fromJsonb(row.settings) ?? undefined,
    pinnedMessageIds: row.pinned_message_ids ?? undefined,
  };
}

function rowToMember(row: MemberRow): AgentChannelMember {
  return {
    agentId: row.agent_id,
    role: row.role as AgentChannelMemberRole,
    listeningMode: row.listening_mode as AgentListeningMode,
    joinedAt: fromTimestamp(row.joined_at) ?? Date.now(),
    receiveBroadcasts: row.receive_broadcasts,
    customName: row.custom_name ?? undefined,
  };
}

function rowToBinding(row: BindingRow): ExternalBinding {
  return {
    bindingId: row.binding_id,
    platform: row.platform as ExternalBinding["platform"],
    externalAccountId: row.external_account_id,
    externalTargetId: row.external_target_id,
    direction: row.direction as ExternalBinding["direction"],
    syncOptions: fromJsonb(row.sync_options) ?? {
      syncMessages: true,
      syncThreads: false,
      syncReactions: false,
    },
    createdAt: fromTimestamp(row.created_at) ?? Date.now(),
    enabled: row.enabled,
  };
}

// Channel operations
export async function createChannel(params: CreateChannelParams): Promise<AgentChannel> {
  const db = getChatDbClient();
  const id = generateChannelId();
  const now = new Date();

  return db.transaction(async (tx) => {
    // Insert channel
    await tx.execute(
      `INSERT INTO agent_channels (id, type, name, topic, description, created_at, created_by, default_agent_id, settings)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        id,
        params.type,
        params.name,
        params.topic ?? null,
        params.description ?? null,
        now,
        params.createdBy,
        params.defaultAgentId ?? null,
        params.settings ? toJsonb(params.settings) : null,
      ],
    );

    // Add creator as owner
    await tx.execute(
      `INSERT INTO channel_members (channel_id, agent_id, role, listening_mode, joined_at)
       VALUES ($1, $2, 'owner', 'active', $3)`,
      [id, params.createdBy, now],
    );

    // Add initial members if provided
    if (params.initialMembers) {
      for (const member of params.initialMembers) {
        if (member.agentId === params.createdBy) {
          continue; // Skip creator, already added
        }
        await tx.execute(
          `INSERT INTO channel_members (channel_id, agent_id, role, listening_mode, receive_broadcasts, custom_name, joined_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [
            id,
            member.agentId,
            member.role,
            member.listeningMode,
            member.receiveBroadcasts ?? true,
            member.customName ?? null,
            now,
          ],
        );
      }
    }

    // Fetch the created channel with members
    const channel = await getChannel(id);
    if (!channel) {
      throw new Error("Failed to create channel");
    }

    return channel;
  });
}

export async function getChannel(channelId: string): Promise<AgentChannel | null> {
  const db = getChatDbClient();

  // Try cache first
  const cached = await db.get(REDIS_KEYS.channel(channelId));
  if (cached) {
    const channel = fromJsonb<AgentChannel>(cached);
    if (channel) {
      return channel;
    }
  }

  // Query from PostgreSQL
  const channelRow = await db.queryOne<ChannelRow>(`SELECT * FROM agent_channels WHERE id = $1`, [
    channelId,
  ]);

  if (!channelRow) {
    return null;
  }

  // Get members
  const memberRows = await db.query<MemberRow>(
    `SELECT * FROM channel_members WHERE channel_id = $1 ORDER BY joined_at`,
    [channelId],
  );

  const members = memberRows.map(rowToMember);
  const channel = rowToChannel(channelRow, members);

  // Get external bindings
  const bindingRows = await db.query<BindingRow>(
    `SELECT * FROM external_bindings WHERE channel_id = $1`,
    [channelId],
  );

  if (bindingRows.length > 0) {
    channel.externalBindings = bindingRows.map(rowToBinding);
  }

  // Cache the channel
  await db.set(REDIS_KEYS.channel(channelId), toJsonb(channel), REDIS_TTL.channelCache);

  return channel;
}

export async function updateChannel(
  channelId: string,
  params: UpdateChannelParams,
): Promise<AgentChannel | null> {
  const db = getChatDbClient();

  const updates: string[] = [];
  const values: unknown[] = [];
  let paramIndex = 1;

  if (params.name !== undefined) {
    updates.push(`name = $${paramIndex++}`);
    values.push(params.name);
  }
  if (params.topic !== undefined) {
    updates.push(`topic = $${paramIndex++}`);
    values.push(params.topic);
  }
  if (params.description !== undefined) {
    updates.push(`description = $${paramIndex++}`);
    values.push(params.description);
  }
  if (params.defaultAgentId !== undefined) {
    updates.push(`default_agent_id = $${paramIndex++}`);
    values.push(params.defaultAgentId);
  }
  if (params.settings !== undefined) {
    updates.push(`settings = settings || $${paramIndex++}::jsonb`);
    values.push(toJsonb(params.settings));
  }

  if (updates.length === 0) {
    return getChannel(channelId);
  }

  values.push(channelId);
  await db.execute(
    `UPDATE agent_channels SET ${updates.join(", ")} WHERE id = $${paramIndex}`,
    values,
  );

  // Invalidate cache
  await db.del(REDIS_KEYS.channel(channelId));

  return getChannel(channelId);
}

export async function archiveChannel(
  channelId: string,
  archivedBy: string,
): Promise<AgentChannel | null> {
  const db = getChatDbClient();

  await db.execute(
    `UPDATE agent_channels SET archived = TRUE, archived_at = NOW(), archived_by = $1 WHERE id = $2`,
    [archivedBy, channelId],
  );

  // Invalidate cache
  await db.del(REDIS_KEYS.channel(channelId));

  return getChannel(channelId);
}

export async function deleteChannel(channelId: string): Promise<boolean> {
  const db = getChatDbClient();

  const result = await db.execute(`DELETE FROM agent_channels WHERE id = $1`, [channelId]);

  // Invalidate cache
  await db.del(REDIS_KEYS.channel(channelId));
  await db.del(REDIS_KEYS.channelMembers(channelId));

  return result.rowCount > 0;
}

export async function listChannels(params?: {
  type?: AgentChannel["type"];
  archived?: boolean;
  agentId?: string;
  limit?: number;
  offset?: number;
}): Promise<AgentChannel[]> {
  const db = getChatDbClient();

  const conditions: string[] = [];
  const values: unknown[] = [];
  let paramIndex = 1;

  if (params?.type) {
    conditions.push(`c.type = $${paramIndex++}`);
    values.push(params.type);
  }

  if (params?.archived !== undefined) {
    conditions.push(`c.archived = $${paramIndex++}`);
    values.push(params.archived);
  }

  if (params?.agentId) {
    conditions.push(
      `EXISTS (SELECT 1 FROM channel_members m WHERE m.channel_id = c.id AND m.agent_id = $${paramIndex++})`,
    );
    values.push(params.agentId);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  const limit = params?.limit ?? 50;
  const offset = params?.offset ?? 0;

  values.push(limit, offset);

  const rows = await db.query<ChannelRow>(
    `SELECT c.* FROM agent_channels c ${whereClause} ORDER BY c.created_at DESC LIMIT $${paramIndex++} OFFSET $${paramIndex}`,
    values,
  );

  // Fetch members for each channel
  const channels: AgentChannel[] = [];
  for (const row of rows) {
    const memberRows = await db.query<MemberRow>(
      `SELECT * FROM channel_members WHERE channel_id = $1`,
      [row.id],
    );
    channels.push(rowToChannel(row, memberRows.map(rowToMember)));
  }

  return channels;
}

// Member operations
export async function addMember(
  channelId: string,
  agentId: string,
  options?: {
    role?: AgentChannelMemberRole;
    listeningMode?: AgentListeningMode;
    receiveBroadcasts?: boolean;
    customName?: string;
  },
): Promise<AgentChannelMember> {
  const db = getChatDbClient();
  const now = new Date();

  await db.execute(
    `INSERT INTO channel_members (channel_id, agent_id, role, listening_mode, receive_broadcasts, custom_name, joined_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (channel_id, agent_id) DO UPDATE SET
       role = EXCLUDED.role,
       listening_mode = EXCLUDED.listening_mode,
       receive_broadcasts = EXCLUDED.receive_broadcasts,
       custom_name = EXCLUDED.custom_name`,
    [
      channelId,
      agentId,
      options?.role ?? "member",
      options?.listeningMode ?? "mention-only",
      options?.receiveBroadcasts ?? true,
      options?.customName ?? null,
      now,
    ],
  );

  // Invalidate channel cache
  await db.del(REDIS_KEYS.channel(channelId));

  return {
    agentId,
    role: options?.role ?? "member",
    listeningMode: options?.listeningMode ?? "mention-only",
    joinedAt: now.getTime(),
    receiveBroadcasts: options?.receiveBroadcasts ?? true,
    customName: options?.customName,
  };
}

export async function removeMember(channelId: string, agentId: string): Promise<boolean> {
  const db = getChatDbClient();

  const result = await db.execute(
    `DELETE FROM channel_members WHERE channel_id = $1 AND agent_id = $2`,
    [channelId, agentId],
  );

  // Invalidate channel cache
  await db.del(REDIS_KEYS.channel(channelId));

  return result.rowCount > 0;
}

export async function updateMember(
  channelId: string,
  agentId: string,
  update: ChannelMemberUpdate,
): Promise<AgentChannelMember | null> {
  const db = getChatDbClient();

  const updates: string[] = [];
  const values: unknown[] = [];
  let paramIndex = 1;

  if (update.role !== undefined) {
    updates.push(`role = $${paramIndex++}`);
    values.push(update.role);
  }
  if (update.listeningMode !== undefined) {
    updates.push(`listening_mode = $${paramIndex++}`);
    values.push(update.listeningMode);
  }
  if (update.receiveBroadcasts !== undefined) {
    updates.push(`receive_broadcasts = $${paramIndex++}`);
    values.push(update.receiveBroadcasts);
  }
  if (update.customName !== undefined) {
    updates.push(`custom_name = $${paramIndex++}`);
    values.push(update.customName);
  }

  if (updates.length === 0) {
    return getMember(channelId, agentId);
  }

  values.push(channelId, agentId);
  await db.execute(
    `UPDATE channel_members SET ${updates.join(", ")} WHERE channel_id = $${paramIndex++} AND agent_id = $${paramIndex}`,
    values,
  );

  // Invalidate channel cache
  await db.del(REDIS_KEYS.channel(channelId));

  return getMember(channelId, agentId);
}

export async function getMember(
  channelId: string,
  agentId: string,
): Promise<AgentChannelMember | null> {
  const db = getChatDbClient();

  const row = await db.queryOne<MemberRow>(
    `SELECT * FROM channel_members WHERE channel_id = $1 AND agent_id = $2`,
    [channelId, agentId],
  );

  return row ? rowToMember(row) : null;
}

export async function getMembers(channelId: string): Promise<AgentChannelMember[]> {
  const db = getChatDbClient();

  const rows = await db.query<MemberRow>(
    `SELECT * FROM channel_members WHERE channel_id = $1 ORDER BY joined_at`,
    [channelId],
  );

  return rows.map(rowToMember);
}

export async function getMembersByListeningMode(
  channelId: string,
  mode: AgentListeningMode,
): Promise<AgentChannelMember[]> {
  const db = getChatDbClient();

  const rows = await db.query<MemberRow>(
    `SELECT * FROM channel_members WHERE channel_id = $1 AND listening_mode = $2`,
    [channelId, mode],
  );

  return rows.map(rowToMember);
}

export async function getChannelsForAgent(
  agentId: string,
  options?: { archived?: boolean },
): Promise<AgentChannel[]> {
  return listChannels({
    agentId,
    archived: options?.archived ?? false,
  });
}

// Muting
export async function muteAgent(
  channelId: string,
  agentId: string,
  durationSeconds?: number,
): Promise<void> {
  const db = getChatDbClient();

  const mutedUntil = durationSeconds ? new Date(Date.now() + durationSeconds * 1000) : null;

  await db.execute(
    `UPDATE channel_members SET muted_until = $1 WHERE channel_id = $2 AND agent_id = $3`,
    [mutedUntil, channelId, agentId],
  );

  // Also store in muted_channels for easier lookup
  await db.execute(
    `INSERT INTO muted_channels (agent_id, channel_id, muted_until)
     VALUES ($1, $2, $3)
     ON CONFLICT (agent_id, channel_id) DO UPDATE SET muted_until = EXCLUDED.muted_until`,
    [agentId, channelId, mutedUntil],
  );
}

export async function unmuteAgent(channelId: string, agentId: string): Promise<void> {
  const db = getChatDbClient();

  await db.execute(
    `UPDATE channel_members SET muted_until = NULL WHERE channel_id = $1 AND agent_id = $2`,
    [channelId, agentId],
  );

  await db.execute(`DELETE FROM muted_channels WHERE agent_id = $1 AND channel_id = $2`, [
    agentId,
    channelId,
  ]);
}

export async function isAgentMuted(channelId: string, agentId: string): Promise<boolean> {
  const db = getChatDbClient();

  const row = await db.queryOne<{ muted_until: Date | null }>(
    `SELECT muted_until FROM channel_members WHERE channel_id = $1 AND agent_id = $2`,
    [channelId, agentId],
  );

  if (!row || !row.muted_until) {
    return false;
  }

  return new Date(row.muted_until) > new Date();
}

// Pinned messages
export async function pinMessage(channelId: string, messageId: string): Promise<void> {
  const db = getChatDbClient();

  await db.execute(
    `UPDATE agent_channels SET pinned_message_ids = array_append(pinned_message_ids, $1) WHERE id = $2`,
    [messageId, channelId],
  );

  await db.del(REDIS_KEYS.channel(channelId));
}

export async function unpinMessage(channelId: string, messageId: string): Promise<void> {
  const db = getChatDbClient();

  await db.execute(
    `UPDATE agent_channels SET pinned_message_ids = array_remove(pinned_message_ids, $1) WHERE id = $2`,
    [messageId, channelId],
  );

  await db.del(REDIS_KEYS.channel(channelId));
}
