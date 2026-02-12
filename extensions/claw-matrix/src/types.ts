// Matrix event types for Phase 1

export interface MatrixError {
  errcode: string;
  error: string;
  soft_logout?: boolean;
}

export interface MatrixSyncResponse {
  next_batch: string;
  rooms?: {
    join?: Record<string, MatrixJoinedRoom>;
    invite?: Record<string, MatrixInvitedRoom>;
    leave?: Record<string, unknown>;
  };
  to_device?: { events: MatrixEvent[] };
  device_one_time_keys_count?: Record<string, number>;
  device_unused_fallback_key_types?: string[];
  device_lists?: { changed?: string[]; left?: string[] };
}

export interface MatrixJoinedRoom {
  timeline?: { events: MatrixEvent[]; limited?: boolean; prev_batch?: string };
  state?: { events: MatrixEvent[] };
  ephemeral?: { events: MatrixEvent[] };
  account_data?: { events: MatrixEvent[] };
}

export interface MatrixInvitedRoom {
  invite_state?: { events: MatrixEvent[] };
}

export interface MatrixEvent {
  type: string;
  event_id?: string;
  sender?: string;
  origin_server_ts?: number;
  content: Record<string, unknown>;
  unsigned?: { age?: number; transaction_id?: string; redacted_because?: MatrixEvent };
  state_key?: string;
  room_id?: string;
  /** Pre-v1.11: redaction target event ID (top-level field on m.room.redaction events) */
  redacts?: string;
}

export interface MatrixRoomMessage {
  msgtype: string;
  body: string;
  format?: string;
  formatted_body?: string;
}

export interface MatrixEncryptedContent {
  algorithm: string;
  sender_key: string;
  ciphertext: unknown;
  session_id: string;
  device_id: string;
}

export interface UTDQueueEntry {
  event: MatrixEvent;
  roomId: string;
  queuedAt: number;
  retries: number;
}

export interface SendResult {
  eventId: string;
  roomId: string;
}

export interface MatrixFilterResponse {
  filter_id: string;
}

export interface MatrixLoginResponse {
  user_id: string;
  access_token: string;
  device_id: string;
}
