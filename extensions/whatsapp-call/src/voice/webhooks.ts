export type ParsedEvent = {
  source: "wati" | "meta";
  callId: string;
  contactNumber: string;
  businessNumber: string;
  phase: string;
  status: string;
  sdpAnswer?: string;
  hasPermission?: boolean;
};

// --- WATI webhook parsing ---

type WatiPayload = {
  event?: string;
  callId?: string;
  status?: string;
  tenantId?: string;
  businessNumber?: string;
  contact?: { ContactName?: string; ContactNumber?: string };
  sdp?: unknown;
  hasPermission?: boolean;
};

function parseWati(data: WatiPayload): ParsedEvent {
  const event = (data.event ?? "").trim().toLowerCase();
  const rawStatus = (data.status ?? "").trim().toLowerCase();

  let phase = "call";
  let status = rawStatus || "update";

  switch (event) {
    case "call.start":
      if (!rawStatus) status = "ringing";
      break;
    case "call.end":
      status = "ended";
      break;
    case "permission":
      phase = "permission";
      if (data.hasPermission != null) {
        status = data.hasPermission ? "granted" : "denied";
      }
      break;
  }

  let sdpAnswer: string | undefined;
  if (data.sdp != null && String(data.sdp) !== "null") {
    sdpAnswer = typeof data.sdp === "string" ? data.sdp : JSON.stringify(data.sdp);
  }

  return {
    source: "wati",
    callId: data.callId ?? "",
    contactNumber: data.contact?.ContactNumber?.trim() ?? "",
    businessNumber: data.businessNumber ?? "",
    phase,
    status,
    sdpAnswer,
    hasPermission: data.hasPermission ?? undefined,
  };
}

// --- Meta webhook parsing ---

type MetaPayload = {
  object?: string;
  entry?: Array<{
    id?: string;
    changes?: Array<{ value?: unknown; field?: string }>;
  }>;
};

type MetaCallEvent = {
  call_id?: string;
  from?: string;
  to?: string;
  status?: string;
  sdp?: unknown;
  sdp_type?: string;
  has_permission?: boolean;
};

function parseMetaEvents(data: MetaPayload): ParsedEvent[] {
  const events: ParsedEvent[] = [];
  for (const entry of data.entry ?? []) {
    for (const change of entry.changes ?? []) {
      if (change.field !== "calls") continue;

      const items: MetaCallEvent[] = [];
      if (Array.isArray(change.value)) {
        items.push(...(change.value as MetaCallEvent[]));
      } else if (change.value && typeof change.value === "object") {
        items.push(change.value as MetaCallEvent);
      }

      for (const item of items) {
        if (!item.call_id) continue;

        let phase = "call";
        let status = (item.status ?? "").toLowerCase();

        switch (status) {
          case "connected":
          case "in_progress":
            status = "connected";
            break;
          case "ended":
          case "terminated":
          case "declined":
            status = "ended";
            break;
          case "":
            status = "update";
            break;
        }

        if (item.has_permission != null) {
          phase = "permission";
          status = item.has_permission ? "granted" : "denied";
        }

        let sdpAnswer: string | undefined;
        if (item.sdp_type === "answer" && item.sdp) {
          sdpAnswer = typeof item.sdp === "string" ? item.sdp : JSON.stringify(item.sdp);
          phase = "sdp_answer";
        }

        events.push({
          source: "meta",
          callId: item.call_id ?? "",
          contactNumber: item.from ?? "",
          businessNumber: item.to ?? "",
          phase,
          status,
          sdpAnswer,
          hasPermission: item.has_permission ?? undefined,
        });
      }
    }
  }
  return events;
}

/**
 * Parse a raw webhook body, detecting WATI or Meta format automatically.
 */
export function parseWebhookBody(body: string): ParsedEvent[] {
  const data = JSON.parse(body) as Record<string, unknown>;

  // Meta webhooks have an "entry" array
  if (Array.isArray(data.entry)) {
    return parseMetaEvents(data as unknown as MetaPayload);
  }

  // Otherwise treat as WATI
  return [parseWati(data as unknown as WatiPayload)];
}
