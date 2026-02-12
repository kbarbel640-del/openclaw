import { matrixFetch } from "./client/http.js";
import { sendMatrixMessage } from "./client/send.js";
import { resolveMatrixTarget } from "./client/targets.js";
import { getTrackedRoomIds, getRoomName, isDmRoom } from "./client/rooms.js";
import { getMachine } from "./crypto/machine.js";
import { RoomId } from "@matrix-org/matrix-sdk-crypto-nodejs";

/**
 * Build an AgentToolResult matching the jsonResult() format from openclaw/plugin-sdk.
 * content must be an array of content blocks — NOT a plain object.
 */
function jsonResult(payload: unknown): {
  content: Array<{ type: "text"; text: string }>;
  details: unknown;
} {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(payload, null, 2) }],
    details: payload,
  };
}

/**
 * Handle Matrix message actions from OpenClaw's message tool.
 * Phase 1: send, read, channel-list only.
 */
export async function handleMatrixAction(ctx: {
  action: string;
  params: Record<string, unknown>;
  cfg: unknown;
  accountId?: string | null;
}): Promise<{ content: Array<{ type: "text"; text: string }>; details: unknown }> {
  switch (ctx.action) {
    case "send":
      return handleSend(ctx.params, ctx.cfg);
    case "read":
      return handleRead(ctx.params);
    case "channel-list":
      return handleChannelList();
    default:
      throw new Error(`Not implemented (Phase 2): ${ctx.action}`);
  }
}

// ── Send ─────────────────────────────────────────────────────────────
async function handleSend(
  params: Record<string, unknown>,
  cfg: unknown
) {
  const target = params.target as string | undefined;
  const message = params.message as string | undefined;

  if (!target) throw new Error("Missing 'target' (room ID or user ID)");
  if (!message) throw new Error("Missing 'message' text");

  const replyTo = params.replyTo as string | undefined;
  const userId = (cfg as any)?.channels?.matrix?.userId ?? "";
  const roomId = await resolveMatrixTarget(target, userId);

  const result = await sendMatrixMessage({
    roomId,
    text: message,
    replyToId: replyTo,
  });

  return jsonResult({
    ok: true,
    eventId: result.eventId,
    roomId,
  });
}

// ── Read ─────────────────────────────────────────────────────────────
async function handleRead(
  params: Record<string, unknown>
) {
  const target = params.target as string | undefined;
  const limit = Math.min((params.limit as number) ?? 20, 100);

  if (!target) throw new Error("Missing 'target' room ID");

  const response = await matrixFetch<{
    chunk: Array<{
      event_id: string;
      sender: string;
      origin_server_ts: number;
      type: string;
      content: Record<string, unknown>;
    }>;
    end?: string;
  }>(
    "GET",
    `/_matrix/client/v3/rooms/${encodeURIComponent(target)}/messages?dir=b&limit=${limit}`
  );

  // Decrypt encrypted events before returning
  const machine = getMachine();
  const matrixRoomId = new RoomId(target);

  const messages: Array<{
    id: string;
    sender: string;
    timestamp: number;
    body: string;
  }> = [];

  for (const event of response.chunk ?? []) {
    if (event.type === "m.room.encrypted") {
      // Attempt decryption
      try {
        const decrypted = await machine.decryptRoomEvent(
          JSON.stringify(event),
          matrixRoomId
        );
        const decryptedContent = JSON.parse(decrypted.event);
        if (decryptedContent.type === "m.room.message") {
          messages.push({
            id: event.event_id,
            sender: event.sender,
            timestamp: event.origin_server_ts,
            body:
              typeof decryptedContent.content?.body === "string"
                ? decryptedContent.content.body
                : "[no text]",
          });
        }
      } catch {
        // Decryption failed — include as placeholder
        messages.push({
          id: event.event_id,
          sender: event.sender,
          timestamp: event.origin_server_ts,
          body: "[encrypted — unable to decrypt]",
        });
      }
    } else if (event.type === "m.room.message") {
      messages.push({
        id: event.event_id,
        sender: event.sender,
        timestamp: event.origin_server_ts,
        body:
          typeof event.content?.body === "string"
            ? event.content.body
            : "[no text]",
      });
    }
  }

  return jsonResult({
    ok: true,
    roomId: target,
    count: messages.length,
    messages,
  });
}

// ── Channel List ─────────────────────────────────────────────────────
async function handleChannelList() {
  // Use tracked rooms from our state + /joined_rooms API
  let joinedRooms: string[] = [];
  try {
    const response = await matrixFetch<{ joined_rooms: string[] }>(
      "GET",
      "/_matrix/client/v3/joined_rooms"
    );
    joinedRooms = response.joined_rooms ?? [];
  } catch {
    // Fallback to locally tracked rooms
    joinedRooms = getTrackedRoomIds();
  }

  const rooms = joinedRooms.map((roomId) => ({
    id: roomId,
    name: getRoomName(roomId) ?? roomId,
    type: isDmRoom(roomId) ? "dm" : "group",
  }));

  return jsonResult({
    ok: true,
    count: rooms.length,
    rooms,
  });
}
