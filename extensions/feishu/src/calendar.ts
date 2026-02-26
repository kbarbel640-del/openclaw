import { Type } from "@sinclair/typebox";
import type { OpenClawPluginApi } from "openclaw/plugin-sdk";

function json(data: unknown) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
    details: data,
  };
}
import { listEnabledFeishuAccounts } from "./accounts.js";
import { FeishuCalendarSchema, type FeishuCalendarParams } from "./calendar-schema.js";
import { createFeishuClient } from "./client.js";
import { resolveToolsConfig } from "./tools-config.js";

/**
 * Minimal Calendar tool.
 *
 * NOTE: v1 only supports create_event and defaults to dry_run=true.
 * Added: update_event_attendees for adding/overwriting attendees on an existing event.
 */

async function listCalendars(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Lark SDK client type
  client: any,
) {
  const res = await client.calendar.v4.calendar.list({});
  if (res.code !== 0) {
    throw new Error(res.msg);
  }
  const items =
    res.data?.calendar_list?.map((c: any) => ({
      calendar_id: c.calendar_id,
      summary: c.summary,
      description: c.description,
      permissions: c.permissions,
    })) ?? [];
  return { calendars: items };
}

async function getPrimaryCalendar(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Lark SDK client type
  client: any,
) {
  const res = await client.calendar.v4.calendar.primary({});
  if (res.code !== 0) {
    throw new Error(res.msg);
  }
  // API returns calendars[] for primary; normalize to a single calendar
  const c: any = res.data?.calendar ?? res.data?.calendars?.[0]?.calendar;
  return {
    calendar_id: c?.calendar_id,
    summary: c?.summary,
    description: c?.description,
    raw: res.data,
  };
}

async function listChatMembers(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Lark SDK client type
  client: any,
  chatId: string,
) {
  const openIds: string[] = [];
  let pageToken: string | undefined;

  // Iterate through all chat members
  // API: im.v1.chatMembers.getWithIterator
  // https://open.feishu.cn/document/server-docs/im-v1/chat-members/get
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const res = await client.im.v1.chatMembers.get({
      path: { chat_id: chatId },
      params: {
        page_size: 100,
        page_token: pageToken,
      },
    });
    if (res.code !== 0) {
      throw new Error(res.msg);
    }

    const items: any[] = res.data?.items ?? [];
    for (const it of items) {
      const id = it?.member_id;
      if (typeof id === "string" && id) openIds.push(id);
    }

    if (!res.data?.has_more) break;
    pageToken = res.data?.page_token;
    if (!pageToken) break;
  }

  return { chat_id: chatId, member_open_ids: openIds, count: openIds.length };
}

async function createEvent(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Lark SDK client type
  client: any,
  params: Extract<FeishuCalendarParams, { action: "create_event" }>,
) {
  const dryRun = params.dry_run ?? true;

  const desc =
    params.meeting_url && params.description
      ? `${params.description}\n\nMeeting: ${params.meeting_url}`
      : params.meeting_url
        ? `Meeting: ${params.meeting_url}`
        : params.description;

  // Resolve calendar_id (primary by default)
  let calendarId = params.calendar_id;
  if (!calendarId) {
    const primary = await getPrimaryCalendar(client);
    calendarId = primary.calendar_id;
  }
  if (!calendarId) {
    throw new Error("Failed to resolve calendar_id (primary calendar not found)");
  }

  // Resolve attendees from chat_id (optional)
  let attendeeOpenIds: string[] | undefined;
  if (params.chat_id) {
    // Accept both formats: "oc_xxx" and "chat:oc_xxx"
    const chatId = params.chat_id.replace(/^chat:/, "");
    const members = await listChatMembers(client, chatId);
    attendeeOpenIds = members.member_open_ids;
  }

  const payload: any = {
    summary: params.summary,
    description: desc,
    start_time: {
      timestamp: String(Math.floor(Date.parse(params.start) / 1000)),
      timezone: params.timezone,
    },
    end_time: {
      timestamp: String(Math.floor(Date.parse(params.end) / 1000)),
      timezone: params.timezone,
    },
  };

  if (attendeeOpenIds && attendeeOpenIds.length > 0) {
    // Calendar API expects attendee list items to use attendee_id with attendee_type
    // (open_id is not accepted directly)
    payload.attendees = attendeeOpenIds.map((open_id) => ({
      attendee_id: open_id,
      attendee_type: "open_id",
    }));
  }

  if (dryRun) {
    return {
      dry_run: true,
      calendar_id: calendarId,
      attendees_count: attendeeOpenIds?.length ?? 0,
      payload,
      hint: "dry_run=true: set dry_run=false to create event.",
    };
  }

  // Create event
  const res = await client.calendar.v4.calendarEvent.create({
    path: { calendar_id: calendarId },
    data: payload,
  });

  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
  const data = res?.data;
  if (!data) {
    throw new Error("Create event failed: empty response");
  }

  return {
    dry_run: false,
    calendar_id: params.calendar_id,
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    event_id: data.event?.event_id,
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    html_link: data.event?.html_link,
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    raw: data,
  };
}

async function updateEventAttendees(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Lark SDK client type
  client: any,
  params: Extract<FeishuCalendarParams, { action: "update_event_attendees" }>,
) {
  const dryRun = params.dry_run ?? true;

  // Resolve attendee open_ids
  let attendeeOpenIds: string[] = [];
  if (params.attendee_open_ids?.length) {
    attendeeOpenIds = params.attendee_open_ids;
  } else if (params.chat_id) {
    const chatId = params.chat_id.replace(/^chat:/, "");
    const members = await listChatMembers(client, chatId);
    attendeeOpenIds = members.member_open_ids;
  } else {
    throw new Error("Either attendee_open_ids or chat_id is required");
  }

  const toCreateAttendeesPayload = (openIds: string[]) => ({
    need_notification: false,
    attendees: openIds.map((open_id) => ({ type: "user", user_id: open_id })),
  });

  // Overwrite: list existing attendees then batchDelete all before create
  if (params.overwrite) {
    const idsToDelete: string[] = [];
    let pageTokenDel: string | undefined;
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const listRes = await client.calendar.v4.calendarEventAttendee.list({
        path: { calendar_id: params.calendar_id, event_id: params.event_id },
        params: { page_size: 100, page_token: pageTokenDel },
      });
      if (listRes.code !== 0) throw new Error(listRes.msg);

      const items: any[] = listRes.data?.items ?? [];
      for (const it of items) {
        const attendeeId = it?.attendee_id;
        if (typeof attendeeId === "string" && attendeeId) idsToDelete.push(attendeeId);
      }

      if (!listRes.data?.has_more) break;
      pageTokenDel = listRes.data?.page_token;
      if (!pageTokenDel) break;
    }

    const toAdd = attendeeOpenIds;
    const payloadAdd = toCreateAttendeesPayload(toAdd);

    if (dryRun) {
      return {
        dry_run: true,
        calendar_id: params.calendar_id,
        event_id: params.event_id,
        overwrite: true,
        delete_count: idsToDelete.length,
        add_count: toAdd.length,
        payload_add: payloadAdd,
        hint: "dry_run=true: set dry_run=false to overwrite attendees (batchDelete then create).",
      };
    }

    if (idsToDelete.length > 0) {
      const delRes = await client.calendar.v4.calendarEventAttendee.batchDelete({
        path: { calendar_id: params.calendar_id, event_id: params.event_id },
        data: { attendee_ids: idsToDelete },
      });
      if (delRes.code !== 0) throw new Error(delRes.msg);
    }

    const addRes = await client.calendar.v4.calendarEventAttendee.create({
      path: { calendar_id: params.calendar_id, event_id: params.event_id },
      data: payloadAdd,
    });
    if (addRes.code !== 0) throw new Error(addRes.msg);

    return {
      dry_run: false,
      calendar_id: params.calendar_id,
      event_id: params.event_id,
      overwrite: true,
      deleted: idsToDelete.length,
      added: toAdd.length,
      raw: addRes.data,
    };
  }

  // Merge mode: list existing attendee user_ids (open_id), compute delta, then create
  const existingOpenIds: string[] = [];
  let pageToken: string | undefined;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const listRes = await client.calendar.v4.calendarEventAttendee.list({
      path: { calendar_id: params.calendar_id, event_id: params.event_id },
      params: { page_size: 100, page_token: pageToken },
    });
    if (listRes.code !== 0) throw new Error(listRes.msg);

    const items: any[] = listRes.data?.items ?? [];
    for (const it of items) {
      const t = it?.type;
      const uid = it?.user_id;
      if (t === "user" && typeof uid === "string" && uid) existingOpenIds.push(uid);
    }

    if (!listRes.data?.has_more) break;
    pageToken = listRes.data?.page_token;
    if (!pageToken) break;
  }

  const existingSet = new Set(existingOpenIds);
  const toAdd = attendeeOpenIds.filter((id) => !existingSet.has(id));
  const payloadAdd = toCreateAttendeesPayload(toAdd);

  if (dryRun) {
    return {
      dry_run: true,
      calendar_id: params.calendar_id,
      event_id: params.event_id,
      overwrite: false,
      existing_count: existingOpenIds.length,
      add_count: toAdd.length,
      payload_add: payloadAdd,
      hint: "dry_run=true: set dry_run=false to add attendees.",
    };
  }

  if (toAdd.length === 0) {
    return {
      dry_run: false,
      calendar_id: params.calendar_id,
      event_id: params.event_id,
      overwrite: false,
      added: 0,
      note: "No new attendees to add (already present)",
    };
  }

  const addRes = await client.calendar.v4.calendarEventAttendee.create({
    path: { calendar_id: params.calendar_id, event_id: params.event_id },
    data: payloadAdd,
  });
  if (addRes.code !== 0) throw new Error(addRes.msg);

  return {
    dry_run: false,
    calendar_id: params.calendar_id,
    event_id: params.event_id,
    overwrite: false,
    added: toAdd.length,
    raw: addRes.data,
  };
}

export function registerFeishuCalendarTools(api: OpenClawPluginApi) {
  if (!api.config) {
    api.logger.debug?.("feishu_calendar: No config available, skipping calendar tools");
    return;
  }

  const accounts = listEnabledFeishuAccounts(api.config);
  if (accounts.length === 0) {
    api.logger.debug?.("feishu_calendar: No Feishu accounts configured, skipping calendar tools");
    return;
  }

  const firstAccount = accounts[0];
  const toolsCfg = resolveToolsConfig(firstAccount.config.tools);
  const getClient = () => createFeishuClient(firstAccount);

  if (!toolsCfg.calendar) {
    api.logger.info?.("feishu_calendar: Disabled by config (channels.feishu.tools.calendar=false)");
    return;
  }

  api.registerTool(
    {
      name: "feishu_calendar",
      label: "Feishu Calendar",
      description:
        "Feishu calendar operations. Actions: create_event, update_event_attendees, list_calendars, get_primary_calendar, list_chat_members",
      parameters: FeishuCalendarSchema,
      async execute(_toolCallId, params) {
        const p = params as FeishuCalendarParams;
        try {
          const client = getClient();
          switch (p.action) {
            case "create_event":
              return json(await createEvent(client, p));
            case "update_event_attendees":
              return json(await updateEventAttendees(client, p));
            case "list_calendars":
              return json(await listCalendars(client));
            case "get_primary_calendar":
              return json(await getPrimaryCalendar(client));
            case "list_chat_members":
              return json(await listChatMembers(client, p.chat_id));
            default:
              // eslint-disable-next-line @typescript-eslint/no-explicit-any -- exhaustive check fallback
              return json({ error: `Unknown action: ${(p as any).action}` });
          }
        } catch (err) {
          return json({ error: err instanceof Error ? err.message : String(err) });
        }
      },
    },
    { name: "feishu_calendar" },
  );

  api.logger.info?.("feishu_calendar: Registered feishu_calendar");
}

// Avoid unused import in case of tree-shaking (Type used sometimes by tool registries)
void Type;
