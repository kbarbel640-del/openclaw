import { Type, type Static } from "@sinclair/typebox";

/**
 * Minimal Feishu calendar tool schema.
 * v1: create_event only.
 */
export const FeishuCalendarSchema = Type.Union([
  Type.Object({
    action: Type.Literal("create_event"),
    /** Event title */
    summary: Type.String({ description: "Event title" }),
    /** ISO datetime, e.g. 2026-02-25T12:00:00+08:00 */
    start: Type.String({ description: "Start datetime (ISO 8601)" }),
    /** ISO datetime, e.g. 2026-02-25T13:00:00+08:00 */
    end: Type.String({ description: "End datetime (ISO 8601)" }),
    /** Optional timezone name, e.g. Asia/Shanghai */
    timezone: Type.Optional(Type.String({ description: "IANA timezone (optional)" })),
    /** Optional description */
    description: Type.Optional(Type.String({ description: "Event description (optional)" })),
    /** Optional meeting/VC link to include in location/description */
    meeting_url: Type.Optional(Type.String({ description: "Meeting URL (optional)" })),
    /** Target calendar id. If omitted, will resolve primary calendar automatically. */
    calendar_id: Type.Optional(Type.String({ description: "Calendar ID (optional)" })),
    /** Create for a specific chat: automatically add all chat members as attendees. */
    chat_id: Type.Optional(
      Type.String({
        description: "Feishu chat_id/open_chat_id (optional). Accepts oc_xxx or chat:oc_xxx",
      }),
    ),
    /** Dry-run (default true): validate and return payload without creating event. */
    dry_run: Type.Optional(Type.Boolean({ description: "Dry-run (default: true)" })),
  }),
  Type.Object({
    action: Type.Literal("update_event_attendees"),
    /** Target calendar id. */
    calendar_id: Type.String({ description: "Calendar ID" }),
    /** Event id, e.g. 7873e3c2-..._0 */
    event_id: Type.String({ description: "Event ID" }),
    /** Add attendees from a specific chat. */
    chat_id: Type.Optional(
      Type.String({
        description: "Feishu chat_id/open_chat_id (optional). Accepts oc_xxx or chat:oc_xxx",
      }),
    ),
    /** Or explicitly provide open_ids. */
    attendee_open_ids: Type.Optional(
      Type.Array(Type.String(), { description: "Attendee open_id list (optional)" }),
    ),
    /** If true, overwrite attendees; else merge with existing. Default: false (merge). */
    overwrite: Type.Optional(Type.Boolean({ description: "Overwrite attendees (default: false)" })),
    /** Dry-run (default true): validate and return payload without updating. */
    dry_run: Type.Optional(Type.Boolean({ description: "Dry-run (default: true)" })),
  }),
  Type.Object({
    action: Type.Literal("list_calendars"),
  }),
  Type.Object({
    action: Type.Literal("get_primary_calendar"),
  }),
  Type.Object({
    action: Type.Literal("list_chat_members"),
    chat_id: Type.String({ description: "Feishu chat_id" }),
  }),
]);

export type FeishuCalendarParams = Static<typeof FeishuCalendarSchema>;
