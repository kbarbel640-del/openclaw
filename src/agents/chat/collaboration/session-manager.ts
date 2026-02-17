/**
 * Session manager for multi-agent collaboration.
 * Handles session lifecycle, participant management, and mode execution.
 */

import { getChatDbClient, toJsonb, fromJsonb } from "../db/client.js";
import type {
  AgentResponse,
  CollaborationConfig,
  CollaborationEvent,
  CollaborationMode,
  CollaborationParticipant,
  CollaborationSession,
  CollaborationStatus,
  CreateSessionParams,
  ParticipantRole,
} from "./types.js";

type SessionRow = {
  session_id: string;
  channel_id: string;
  mode: string;
  coordinator_id: string | null;
  status: string;
  config: string;
  created_at: Date;
  updated_at: Date | null;
  completed_at: Date | null;
};

type ParticipantRow = {
  session_id: string;
  agent_id: string;
  role: string;
  expertise: string[] | null;
  joined_at: Date;
  left_at: Date | null;
  contribution_count: number;
};

// Event listeners
const eventListeners = new Set<(event: CollaborationEvent) => void>();

function generateSessionId(): string {
  return `collab_${crypto.randomUUID()}`;
}

function rowToSession(
  row: SessionRow,
  participants: CollaborationParticipant[] = [],
): CollaborationSession {
  return {
    sessionId: row.session_id,
    channelId: row.channel_id,
    mode: row.mode as CollaborationMode,
    coordinator: row.coordinator_id ?? undefined,
    participants,
    status: row.status as CollaborationStatus,
    config: fromJsonb<CollaborationConfig>(row.config) ?? {},
    createdAt: new Date(row.created_at).getTime(),
    updatedAt: row.updated_at ? new Date(row.updated_at).getTime() : undefined,
    completedAt: row.completed_at ? new Date(row.completed_at).getTime() : undefined,
    roundCount: 0, // Calculated from messages
  };
}

function rowToParticipant(row: ParticipantRow): CollaborationParticipant {
  return {
    agentId: row.agent_id,
    role: row.role as ParticipantRole,
    expertise: row.expertise ?? undefined,
    joinedAt: new Date(row.joined_at).getTime(),
    leftAt: row.left_at ? new Date(row.left_at).getTime() : undefined,
    contributionCount: row.contribution_count,
  };
}

function emitEvent(event: CollaborationEvent): void {
  for (const listener of eventListeners) {
    try {
      listener(event);
    } catch {
      // Ignore listener errors
    }
  }
}

/**
 * Create a new collaboration session.
 */
export async function createSession(params: CreateSessionParams): Promise<CollaborationSession> {
  const db = getChatDbClient();
  const sessionId = generateSessionId();
  const now = new Date();

  // Insert session
  await db.execute(
    `INSERT INTO collaboration_sessions (session_id, channel_id, mode, coordinator_id, status, config, created_at)
     VALUES ($1, $2, $3, $4, 'active', $5, $6)`,
    [
      sessionId,
      params.channelId,
      params.mode,
      params.coordinatorId ?? null,
      toJsonb(params.config ?? {}),
      now,
    ],
  );

  // Add participants
  const participants: CollaborationParticipant[] = [];

  for (const agentId of params.participantIds) {
    const role: ParticipantRole = agentId === params.coordinatorId ? "coordinator" : "participant";

    await db.execute(
      `INSERT INTO collaboration_participants (session_id, agent_id, role, joined_at)
       VALUES ($1, $2, $3, $4)`,
      [sessionId, agentId, role, now],
    );

    participants.push({
      agentId,
      role,
      joinedAt: now.getTime(),
      contributionCount: 0,
    });
  }

  const session: CollaborationSession = {
    sessionId,
    channelId: params.channelId,
    mode: params.mode,
    coordinator: params.coordinatorId,
    participants,
    status: "active",
    config: params.config ?? {},
    createdAt: now.getTime(),
    roundCount: 0,
  };

  emitEvent({ type: "session.started", session });

  return session;
}

/**
 * Get a collaboration session.
 */
export async function getSession(sessionId: string): Promise<CollaborationSession | null> {
  const db = getChatDbClient();

  const row = await db.queryOne<SessionRow>(
    `SELECT * FROM collaboration_sessions WHERE session_id = $1`,
    [sessionId],
  );

  if (!row) {
    return null;
  }

  const participantRows = await db.query<ParticipantRow>(
    `SELECT * FROM collaboration_participants WHERE session_id = $1`,
    [sessionId],
  );

  return rowToSession(row, participantRows.map(rowToParticipant));
}

/**
 * Get active session for a channel.
 */
export async function getActiveSession(channelId: string): Promise<CollaborationSession | null> {
  const db = getChatDbClient();

  const row = await db.queryOne<SessionRow>(
    `SELECT * FROM collaboration_sessions WHERE channel_id = $1 AND status = 'active'`,
    [channelId],
  );

  if (!row) {
    return null;
  }

  const participantRows = await db.query<ParticipantRow>(
    `SELECT * FROM collaboration_participants WHERE session_id = $1`,
    [row.session_id],
  );

  return rowToSession(row, participantRows.map(rowToParticipant));
}

/**
 * Pause a session.
 */
export async function pauseSession(sessionId: string, reason?: string): Promise<void> {
  const db = getChatDbClient();

  await db.execute(
    `UPDATE collaboration_sessions SET status = 'paused', updated_at = NOW() WHERE session_id = $1`,
    [sessionId],
  );

  emitEvent({ type: "session.paused", sessionId, reason });
}

/**
 * Resume a paused session.
 */
export async function resumeSession(sessionId: string): Promise<void> {
  const db = getChatDbClient();

  await db.execute(
    `UPDATE collaboration_sessions SET status = 'active', updated_at = NOW() WHERE session_id = $1`,
    [sessionId],
  );

  emitEvent({ type: "session.resumed", sessionId });
}

/**
 * Complete a session.
 */
export async function completeSession(sessionId: string, result?: unknown): Promise<void> {
  const db = getChatDbClient();

  await db.execute(
    `UPDATE collaboration_sessions SET status = 'completed', updated_at = NOW(), completed_at = NOW() WHERE session_id = $1`,
    [sessionId],
  );

  emitEvent({ type: "session.completed", sessionId, result });
}

/**
 * Cancel a session.
 */
export async function cancelSession(sessionId: string, reason?: string): Promise<void> {
  const db = getChatDbClient();

  await db.execute(
    `UPDATE collaboration_sessions SET status = 'cancelled', updated_at = NOW(), completed_at = NOW() WHERE session_id = $1`,
    [sessionId],
  );

  emitEvent({ type: "session.cancelled", sessionId, reason });
}

/**
 * Add a participant to a session.
 */
export async function addParticipant(
  sessionId: string,
  agentId: string,
  options?: { role?: ParticipantRole; expertise?: string[] },
): Promise<CollaborationParticipant> {
  const db = getChatDbClient();
  const now = new Date();

  await db.execute(
    `INSERT INTO collaboration_participants (session_id, agent_id, role, expertise, joined_at)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (session_id, agent_id) DO UPDATE SET
       role = COALESCE(EXCLUDED.role, collaboration_participants.role),
       expertise = COALESCE(EXCLUDED.expertise, collaboration_participants.expertise),
       left_at = NULL`,
    [sessionId, agentId, options?.role ?? "participant", options?.expertise ?? null, now],
  );

  const participant: CollaborationParticipant = {
    agentId,
    role: options?.role ?? "participant",
    expertise: options?.expertise,
    joinedAt: now.getTime(),
    contributionCount: 0,
  };

  emitEvent({ type: "participant.joined", sessionId, participant });

  return participant;
}

/**
 * Remove a participant from a session.
 */
export async function removeParticipant(sessionId: string, agentId: string): Promise<void> {
  const db = getChatDbClient();

  await db.execute(
    `UPDATE collaboration_participants SET left_at = NOW() WHERE session_id = $1 AND agent_id = $2`,
    [sessionId, agentId],
  );

  emitEvent({ type: "participant.left", sessionId, agentId });
}

/**
 * Record a contribution from a participant.
 */
export async function recordContribution(sessionId: string, agentId: string): Promise<void> {
  const db = getChatDbClient();

  await db.execute(
    `UPDATE collaboration_participants SET contribution_count = contribution_count + 1 WHERE session_id = $1 AND agent_id = $2`,
    [sessionId, agentId],
  );
}

/**
 * Get active participants in a session.
 */
export async function getActiveParticipants(
  sessionId: string,
): Promise<CollaborationParticipant[]> {
  const db = getChatDbClient();

  const rows = await db.query<ParticipantRow>(
    `SELECT * FROM collaboration_participants WHERE session_id = $1 AND left_at IS NULL`,
    [sessionId],
  );

  return rows.map(rowToParticipant);
}

/**
 * Check if an agent is a participant in a session.
 */
export async function isParticipant(sessionId: string, agentId: string): Promise<boolean> {
  const db = getChatDbClient();

  const row = await db.queryOne<{ count: string }>(
    `SELECT COUNT(*) as count FROM collaboration_participants WHERE session_id = $1 AND agent_id = $2 AND left_at IS NULL`,
    [sessionId, agentId],
  );

  return row ? Number.parseInt(row.count, 10) > 0 : false;
}

/**
 * List sessions by channel.
 */
export async function listSessions(
  channelId: string,
  options?: { status?: CollaborationStatus; limit?: number },
): Promise<CollaborationSession[]> {
  const db = getChatDbClient();

  const conditions: string[] = ["channel_id = $1"];
  const values: unknown[] = [channelId];
  let paramIndex = 2;

  if (options?.status) {
    conditions.push(`status = $${paramIndex++}`);
    values.push(options.status);
  }

  const limit = options?.limit ?? 50;
  values.push(limit);

  const rows = await db.query<SessionRow>(
    `SELECT * FROM collaboration_sessions WHERE ${conditions.join(" AND ")} ORDER BY created_at DESC LIMIT $${paramIndex}`,
    values,
  );

  const sessions: CollaborationSession[] = [];
  for (const row of rows) {
    const participantRows = await db.query<ParticipantRow>(
      `SELECT * FROM collaboration_participants WHERE session_id = $1`,
      [row.session_id],
    );
    sessions.push(rowToSession(row, participantRows.map(rowToParticipant)));
  }

  return sessions;
}

/**
 * Update session configuration.
 */
export async function updateSessionConfig(
  sessionId: string,
  config: Partial<CollaborationConfig>,
): Promise<void> {
  const db = getChatDbClient();

  await db.execute(
    `UPDATE collaboration_sessions SET config = config || $1::jsonb, updated_at = NOW() WHERE session_id = $2`,
    [toJsonb(config), sessionId],
  );
}

/**
 * Subscribe to collaboration events.
 */
export function onCollaborationEvent(listener: (event: CollaborationEvent) => void): () => void {
  eventListeners.add(listener);
  return () => eventListeners.delete(listener);
}

/**
 * Emit a round started event.
 */
export function emitRoundStarted(
  sessionId: string,
  roundNumber: number,
  activeAgents: string[],
): void {
  emitEvent({
    type: "round.started",
    sessionId,
    roundNumber,
    activeAgents,
  });
}

/**
 * Emit a round completed event.
 */
export function emitRoundCompleted(
  sessionId: string,
  roundNumber: number,
  responses: AgentResponse[],
): void {
  emitEvent({
    type: "round.completed",
    sessionId,
    roundNumber,
    responses,
  });
}

/**
 * Emit expert activated event.
 */
export function emitExpertActivated(sessionId: string, agentId: string, topic: string): void {
  emitEvent({
    type: "expert.activated",
    sessionId,
    agentId,
    topic,
  });
}

/**
 * Emit handoff request event.
 */
export function emitHandoffRequested(
  sessionId: string,
  fromAgent: string,
  toAgent: string,
  context: string,
): void {
  emitEvent({
    type: "handoff.requested",
    sessionId,
    fromAgent,
    toAgent,
    context,
  });
}

/**
 * Emit handoff accepted event.
 */
export function emitHandoffAccepted(sessionId: string, toAgent: string): void {
  emitEvent({
    type: "handoff.accepted",
    sessionId,
    toAgent,
  });
}
