/**
 * Sync manager for external channel bindings.
 * Handles bidirectional message synchronization between agent channels and external platforms.
 */

import { getChatDbClient, toJsonb, fromJsonb } from "../db/client.js";
import { createMessage } from "../store/message-store.js";
import type {
  BindingDirection,
  BindingEvent,
  ChannelBinding,
  CreateBindingParams,
  ExternalMessage,
  ExternalPlatform,
  IPlatformAdapter,
  MessageMapping,
  SyncOptions,
  SyncStatus,
} from "./types.js";

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

// Registered platform adapters
const adapters = new Map<ExternalPlatform, IPlatformAdapter>();

// Event listeners
const eventListeners = new Set<(event: BindingEvent) => void>();

// Message mappings cache (internal ID -> external ID)
const messageMappings = new Map<string, MessageMapping>();

function generateBindingId(): string {
  return `bind_${crypto.randomUUID()}`;
}

function rowToBinding(row: BindingRow): ChannelBinding {
  return {
    bindingId: row.binding_id,
    agentChannelId: row.channel_id,
    platform: row.platform as ExternalPlatform,
    externalAccountId: row.external_account_id,
    externalChannelId: row.external_target_id,
    direction: row.direction as BindingDirection,
    syncOptions: fromJsonb<SyncOptions>(row.sync_options) ?? {
      syncMessages: true,
      syncThreads: false,
      syncReactions: false,
      syncEdits: false,
      syncDeletes: false,
    },
    status: row.enabled ? "active" : "paused",
    lastSyncAt: row.last_sync_at ? new Date(row.last_sync_at).getTime() : undefined,
    syncCursor: row.sync_cursor ?? undefined,
    createdAt: new Date(row.created_at).getTime(),
  };
}

function emitEvent(event: BindingEvent): void {
  for (const listener of eventListeners) {
    try {
      listener(event);
    } catch {
      // Ignore listener errors
    }
  }
}

/**
 * Register a platform adapter.
 */
export function registerAdapter(adapter: IPlatformAdapter): void {
  adapters.set(adapter.platform, adapter);
}

/**
 * Get a registered adapter.
 */
export function getAdapter(platform: ExternalPlatform): IPlatformAdapter | undefined {
  return adapters.get(platform);
}

/**
 * Create a new channel binding.
 */
export async function createBinding(params: CreateBindingParams): Promise<ChannelBinding> {
  const db = getChatDbClient();
  const bindingId = generateBindingId();
  const now = new Date();

  const defaultSyncOptions: SyncOptions = {
    syncMessages: true,
    syncThreads: false,
    syncReactions: false,
    syncEdits: false,
    syncDeletes: false,
    ...params.syncOptions,
  };

  await db.execute(
    `INSERT INTO external_bindings (
      binding_id, channel_id, platform, external_account_id, external_target_id,
      direction, sync_options, created_at, enabled
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, TRUE)`,
    [
      bindingId,
      params.agentChannelId,
      params.platform,
      params.externalAccountId,
      params.externalChannelId,
      params.direction ?? "bidirectional",
      toJsonb(defaultSyncOptions),
      now,
    ],
  );

  const binding: ChannelBinding = {
    bindingId,
    agentChannelId: params.agentChannelId,
    platform: params.platform,
    externalAccountId: params.externalAccountId,
    externalChannelId: params.externalChannelId,
    direction: params.direction ?? "bidirectional",
    syncOptions: defaultSyncOptions,
    status: "active",
    createdAt: now.getTime(),
  };

  // Sync history if enabled
  if (defaultSyncOptions.syncHistory) {
    await syncHistory(binding);
  }

  return binding;
}

/**
 * Get a binding by ID.
 */
export async function getBinding(bindingId: string): Promise<ChannelBinding | null> {
  const db = getChatDbClient();

  const row = await db.queryOne<BindingRow>(
    `SELECT * FROM external_bindings WHERE binding_id = $1`,
    [bindingId],
  );

  return row ? rowToBinding(row) : null;
}

/**
 * Get bindings for a channel.
 */
export async function getBindingsForChannel(agentChannelId: string): Promise<ChannelBinding[]> {
  const db = getChatDbClient();

  const rows = await db.query<BindingRow>(
    `SELECT * FROM external_bindings WHERE channel_id = $1 AND enabled = TRUE`,
    [agentChannelId],
  );

  return rows.map(rowToBinding);
}

/**
 * Get bindings for an external channel.
 */
export async function getBindingsForExternal(
  platform: ExternalPlatform,
  externalChannelId: string,
): Promise<ChannelBinding[]> {
  const db = getChatDbClient();

  const rows = await db.query<BindingRow>(
    `SELECT * FROM external_bindings WHERE platform = $1 AND external_target_id = $2 AND enabled = TRUE`,
    [platform, externalChannelId],
  );

  return rows.map(rowToBinding);
}

/**
 * Update binding status.
 */
export async function updateBindingStatus(
  bindingId: string,
  status: SyncStatus,
  error?: string,
): Promise<void> {
  const db = getChatDbClient();
  const binding = await getBinding(bindingId);

  if (!binding) {
    return;
  }

  const oldStatus = binding.status;

  await db.execute(`UPDATE external_bindings SET enabled = $1 WHERE binding_id = $2`, [
    status === "active",
    bindingId,
  ]);

  if (oldStatus !== status) {
    emitEvent({
      type: "status.changed",
      binding: { ...binding, status, lastError: error },
      oldStatus,
      newStatus: status,
    });
  }
}

/**
 * Delete a binding.
 */
export async function deleteBinding(bindingId: string): Promise<void> {
  const db = getChatDbClient();

  await db.execute(`DELETE FROM external_bindings WHERE binding_id = $1`, [bindingId]);
}

/**
 * Sync a message from external platform to agent channel (inbound).
 */
export async function syncInbound(
  binding: ChannelBinding,
  externalMessage: ExternalMessage,
): Promise<string | null> {
  if (binding.direction === "outbound") {
    return null; // Skip inbound sync for outbound-only bindings
  }

  // Check if already synced
  const existingMapping = await getMessageMappingByExternal(
    binding.platform,
    externalMessage.externalId,
  );
  if (existingMapping) {
    return existingMapping.internalId;
  }

  // Apply content transform if configured
  let content = externalMessage.content;
  if (binding.syncOptions.contentTransform) {
    content = binding.syncOptions.contentTransform(content, "inbound");
  }

  // Add external user prefix if configured
  let authorName = externalMessage.authorName;
  if (binding.syncOptions.externalUserPrefix) {
    authorName = `${binding.syncOptions.externalUserPrefix}${authorName}`;
  }

  // Create internal message
  const message = await createMessage({
    channelId: binding.agentChannelId,
    authorId: `external:${binding.platform}:${externalMessage.authorId}`,
    authorType: "external",
    authorName,
    content,
    externalSourceId: externalMessage.externalId,
    externalPlatform: binding.platform,
    threadId: externalMessage.threadId
      ? await mapThreadId(binding, externalMessage.threadId)
      : undefined,
  });

  // Save mapping
  await saveMessageMapping({
    internalId: message.id,
    externalId: externalMessage.externalId,
    platform: binding.platform,
    bindingId: binding.bindingId,
    createdAt: Date.now(),
  });

  emitEvent({
    type: "message.received",
    binding,
    message: externalMessage,
  });

  return message.id;
}

/**
 * Sync a message from agent channel to external platform (outbound).
 */
export async function syncOutbound(
  binding: ChannelBinding,
  internalMessageId: string,
  content: string,
  options?: {
    threadId?: string;
    replyToId?: string;
  },
): Promise<string | null> {
  if (binding.direction === "inbound") {
    return null; // Skip outbound sync for inbound-only bindings
  }

  const adapter = getAdapter(binding.platform);
  if (!adapter || !adapter.isConnected()) {
    await updateBindingStatus(binding.bindingId, "disconnected");
    return null;
  }

  try {
    // Apply content transform if configured
    let transformedContent = content;
    if (binding.syncOptions.contentTransform) {
      transformedContent = binding.syncOptions.contentTransform(content, "outbound");
    }

    // Map thread ID if provided
    let externalThreadId: string | undefined;
    if (options?.threadId) {
      const threadMapping = await getMessageMappingByInternal(options.threadId);
      externalThreadId = threadMapping?.externalId;
    }

    // Send to external platform
    const externalId = await adapter.sendMessage(binding.externalChannelId, transformedContent, {
      threadId: externalThreadId,
      replyToId: options?.replyToId,
    });

    // Save mapping
    await saveMessageMapping({
      internalId: internalMessageId,
      externalId,
      platform: binding.platform,
      bindingId: binding.bindingId,
      createdAt: Date.now(),
    });

    emitEvent({
      type: "message.sent",
      binding,
      messageId: internalMessageId,
      externalId,
    });

    return externalId;
  } catch (error) {
    await updateBindingStatus(
      binding.bindingId,
      "error",
      error instanceof Error ? error.message : "Unknown error",
    );
    emitEvent({
      type: "sync.error",
      binding,
      error: error instanceof Error ? error.message : "Unknown error",
    });
    return null;
  }
}

/**
 * Sync message history from external platform.
 */
export async function syncHistory(binding: ChannelBinding): Promise<number> {
  const adapter = getAdapter(binding.platform);
  if (!adapter || !adapter.isConnected()) {
    return 0;
  }

  emitEvent({ type: "sync.started", binding });

  try {
    const limit = binding.syncOptions.historySyncLimit ?? 100;
    const messages = await adapter.getMessages(binding.externalChannelId, {
      limit,
      after: binding.syncCursor,
    });

    let syncedCount = 0;
    for (const message of messages) {
      const result = await syncInbound(binding, message);
      if (result) {
        syncedCount++;
      }
    }

    // Update sync cursor
    if (messages.length > 0) {
      const lastMessage = messages[messages.length - 1];
      await updateSyncCursor(binding.bindingId, lastMessage.externalId);
    }

    emitEvent({
      type: "sync.completed",
      binding,
      messageCount: syncedCount,
    });

    return syncedCount;
  } catch (error) {
    emitEvent({
      type: "sync.error",
      binding,
      error: error instanceof Error ? error.message : "Unknown error",
    });
    return 0;
  }
}

/**
 * Subscribe to binding events.
 */
export function onBindingEvent(listener: (event: BindingEvent) => void): () => void {
  eventListeners.add(listener);
  return () => eventListeners.delete(listener);
}

// Message mapping helpers
async function saveMessageMapping(mapping: MessageMapping): Promise<void> {
  messageMappings.set(mapping.internalId, mapping);
  // Also save to database for persistence
  const db = getChatDbClient();
  await db
    .execute(
      `INSERT INTO message_mappings (internal_id, external_id, platform, binding_id, created_at)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (internal_id) DO NOTHING`,
      [
        mapping.internalId,
        mapping.externalId,
        mapping.platform,
        mapping.bindingId,
        new Date(mapping.createdAt),
      ],
    )
    .catch(() => {
      // Table might not exist yet, ignore
    });
}

async function getMessageMappingByInternal(internalId: string): Promise<MessageMapping | null> {
  const cached = messageMappings.get(internalId);
  if (cached) {
    return cached;
  }

  // Check database
  const db = getChatDbClient();
  const row = await db
    .queryOne<{
      internal_id: string;
      external_id: string;
      platform: string;
      binding_id: string;
      created_at: Date;
    }>(`SELECT * FROM message_mappings WHERE internal_id = $1`, [internalId])
    .catch(() => null);

  if (row) {
    const mapping: MessageMapping = {
      internalId: row.internal_id,
      externalId: row.external_id,
      platform: row.platform as ExternalPlatform,
      bindingId: row.binding_id,
      createdAt: new Date(row.created_at).getTime(),
    };
    messageMappings.set(internalId, mapping);
    return mapping;
  }

  return null;
}

async function getMessageMappingByExternal(
  platform: ExternalPlatform,
  externalId: string,
): Promise<MessageMapping | null> {
  // Check cache
  for (const mapping of messageMappings.values()) {
    if (mapping.platform === platform && mapping.externalId === externalId) {
      return mapping;
    }
  }

  // Check database
  const db = getChatDbClient();
  const row = await db
    .queryOne<{
      internal_id: string;
      external_id: string;
      platform: string;
      binding_id: string;
      created_at: Date;
    }>(`SELECT * FROM message_mappings WHERE platform = $1 AND external_id = $2`, [
      platform,
      externalId,
    ])
    .catch(() => null);

  if (row) {
    const mapping: MessageMapping = {
      internalId: row.internal_id,
      externalId: row.external_id,
      platform: row.platform as ExternalPlatform,
      bindingId: row.binding_id,
      createdAt: new Date(row.created_at).getTime(),
    };
    messageMappings.set(mapping.internalId, mapping);
    return mapping;
  }

  return null;
}

async function mapThreadId(
  binding: ChannelBinding,
  externalThreadId: string,
): Promise<string | undefined> {
  const mapping = await getMessageMappingByExternal(binding.platform, externalThreadId);
  return mapping?.internalId;
}

async function updateSyncCursor(bindingId: string, cursor: string): Promise<void> {
  const db = getChatDbClient();
  await db.execute(
    `UPDATE external_bindings SET sync_cursor = $1, last_sync_at = NOW() WHERE binding_id = $2`,
    [cursor, bindingId],
  );
}
