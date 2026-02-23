import type { MatrixClient } from "@vector-im/matrix-bot-sdk";
import { POLL_END_TYPES, POLL_RESPONSE_TYPES } from "../poll-types.js";
import {
  EventType,
  type MatrixMessageSummary,
  type MatrixRawEvent,
  type RoomMessageEventContent,
  type RoomPinnedEventsEventContent,
} from "./types.js";

function getRelatesTo(content: Record<string, unknown>): MatrixMessageSummary["relatesTo"] {
  const relates = content["m.relates_to"] as
    | {
        rel_type?: string;
        event_id?: string;
        key?: string;
        "m.in_reply_to"?: { event_id?: string };
      }
    | undefined;

  let relType: string | undefined;
  let eventId: string | undefined;
  let key: string | undefined;

  if (relates) {
    relType = relates.rel_type;
    eventId = relates.event_id ?? relates["m.in_reply_to"]?.event_id;
    key = relates.key;
  }

  return relType || eventId || key
    ? {
        relType,
        eventId,
        key,
      }
    : undefined;
}

function summarizePollResponse(event: MatrixRawEvent): { body: string; msgtype: string } {
  const content = event.content as Record<string, unknown>;

  // Responses can be legacy key ("m.poll.response") or MSC key (event.type)
  const responseObj =
    (content[event.type] as { answers?: unknown } | undefined) ??
    (content["m.poll.response"] as { answers?: unknown } | undefined) ??
    (content["org.matrix.msc3381.poll.response"] as { answers?: unknown } | undefined);

  const answers = Array.isArray(responseObj?.answers)
    ? responseObj?.answers.filter((x): x is string => typeof x === "string")
    : [];

  const answersText = answers.length ? answers.join(", ") : "(no answers)";
  return {
    body: `[Poll vote] ${answersText}`,
    msgtype: "m.poll.response",
  };
}

export function summarizeMatrixRawEvent(event: MatrixRawEvent): MatrixMessageSummary {
  const content = event.content as Record<string, unknown>;
  const relatesTo = getRelatesTo(content);

  // Most events are m.room.message and have {body,msgtype}. Poll response/end events do not.
  const maybeRoomMsg = content as unknown as Partial<RoomMessageEventContent>;
  if (typeof maybeRoomMsg.body === "string" && typeof maybeRoomMsg.msgtype === "string") {
    return {
      eventId: event.event_id,
      sender: event.sender,
      body: maybeRoomMsg.body,
      msgtype: maybeRoomMsg.msgtype,
      timestamp: event.origin_server_ts,
      relatesTo,
    };
  }

  if (POLL_RESPONSE_TYPES.includes(event.type as (typeof POLL_RESPONSE_TYPES)[number])) {
    const summarized = summarizePollResponse(event);
    return {
      eventId: event.event_id,
      sender: event.sender,
      body: summarized.body,
      msgtype: summarized.msgtype,
      timestamp: event.origin_server_ts,
      relatesTo,
    };
  }

  if (POLL_END_TYPES.includes(event.type as (typeof POLL_END_TYPES)[number])) {
    return {
      eventId: event.event_id,
      sender: event.sender,
      body: "[Poll ended]",
      msgtype: "m.poll.end",
      timestamp: event.origin_server_ts,
      relatesTo,
    };
  }

  return {
    eventId: event.event_id,
    sender: event.sender,
    body: `[${event.type}]`,
    msgtype: event.type,
    timestamp: event.origin_server_ts,
    relatesTo,
  };
}

export async function readPinnedEvents(client: MatrixClient, roomId: string): Promise<string[]> {
  try {
    const content = (await client.getRoomStateEvent(
      roomId,
      EventType.RoomPinnedEvents,
      "",
    )) as RoomPinnedEventsEventContent;
    const pinned = content.pinned;
    return pinned.filter((id) => id.trim().length > 0);
  } catch (err: unknown) {
    const errObj = err as { statusCode?: number; body?: { errcode?: string } };
    const httpStatus = errObj.statusCode;
    const errcode = errObj.body?.errcode;
    if (httpStatus === 404 || errcode === "M_NOT_FOUND") {
      return [];
    }
    throw err;
  }
}

export async function fetchEventSummary(
  client: MatrixClient,
  roomId: string,
  eventId: string,
): Promise<MatrixMessageSummary | null> {
  try {
    const raw = (await client.getEvent(roomId, eventId)) as unknown as MatrixRawEvent;
    if (raw.unsigned?.redacted_because) {
      return null;
    }
    return summarizeMatrixRawEvent(raw);
  } catch {
    // Event not found, redacted, or inaccessible - return null
    return null;
  }
}
