// Real Dispatch v0 contracts.
// Source of truth: docs/rfcs/0001-dispatch-core-contracts-v0.md

export const TicketStates = [
  "lead",
  "intake",
  "scheduled",
  "dispatched",
  "onsite",
  "work_performed",
  "closeout_ready",
  "invoice_ready",
  "paid",
  "canceled",
] as const;

export type TicketState = (typeof TicketStates)[number];

export const Roles = [
  "system_intake_agent",
  "system_scheduler_agent",
  "system_tech_liaison_agent",
  "system_closeout_agent",
  "operator_admin",
  "technician",
  "customer",
] as const;

export type Role = (typeof Roles)[number];

export type ISO8601 = string;
export type ULID = string;

export const CloseoutChecklistKeys = ["work_summary_note", "onsite_photos_after"] as const;
export type CloseoutChecklistKey = (typeof CloseoutChecklistKeys)[number];

export type ActorRef =
  | { role: "operator_admin"; operator_id: ULID }
  | { role: "technician"; technician_id: ULID }
  | { role: "customer"; customer_id: ULID }
  | {
      role:
        | "system_intake_agent"
        | "system_scheduler_agent"
        | "system_tech_liaison_agent"
        | "system_closeout_agent";
      agent_id: ULID;
    };

export type ChannelRef =
  | { kind: "whatsapp"; peer: string }
  | { kind: "telegram"; peer: string }
  | { kind: "sms"; peer: string }
  | { kind: "email"; peer: string }
  | { kind: "webchat"; peer: string }
  | { kind: "internal"; peer: "system" };

export type Money = { currency: "USD"; amount_cents: number };

export type Ticket = {
  ticket_id: ULID;
  state: TicketState;

  created_at: ISO8601;
  updated_at: ISO8601;

  customer_id: ULID;

  summary: string;
  location: {
    address_line1: string;
    address_line2?: string;
    city: string;
    region: string;
    postal_code: string;
    country: string;
    lat?: number;
    lon?: number;
  };

  priority: "normal" | "urgent" | "emergency";

  assigned_technician_id?: ULID;

  schedule?: {
    status: "proposed" | "confirmed";
    window_start: ISO8601;
    window_end: ISO8601;
    timezone: string;
  };

  closeout?: {
    checklist: Record<CloseoutChecklistKey, boolean>;
    completed_at?: ISO8601;
  };

  billing?: {
    closeout_packet_attachment_id?: ULID;
    invoice_total?: Money;
  };
};

export type Customer = {
  customer_id: ULID;
  display_name: string;
  phone?: string;
  email?: string;
};

export type Technician = {
  technician_id: ULID;
  display_name: string;
  phone?: string;
};

export type Attachment = {
  attachment_id: ULID;
  ticket_id: ULID;
  kind: "photo" | "pdf" | "audio" | "signature" | "packet";
  storage_key: string;
  sha256?: string;
  content_type: string;
  size_bytes: number;
  created_at: ISO8601;
  created_by: ActorRef;
};

export const AuditEventTypes = [
  "ticket.created",
  "ticket.message_added",
  "schedule.slots_proposed",
  "schedule.confirmed",
  "dispatch.tech_assigned",
  "closeout.note_added",
  "closeout.photo_added",
  "closeout.checklist_item_completed",
  "billing.closeout_packet_compiled",
  "ticket.state_changed",
] as const;

export type AuditEventType = (typeof AuditEventTypes)[number];

export type AuditEvent = {
  event_id: ULID;
  occurred_at: ISO8601;

  request_id: string;
  type: AuditEventType;

  ticket_id?: ULID;

  actor: ActorRef;
  channel?: ChannelRef;

  previous_state?: TicketState;
  next_state?: TicketState;

  payload: Record<string, unknown>;
};

// Explicit transition matrix for server-side enforcement.
export const AllowedStateTransitions: Readonly<Record<TicketState, readonly TicketState[]>> = {
  lead: ["intake", "canceled"],
  intake: ["scheduled", "canceled"],
  scheduled: ["scheduled", "dispatched", "canceled"],
  dispatched: ["onsite"],
  onsite: ["work_performed"],
  work_performed: ["closeout_ready"],
  closeout_ready: ["invoice_ready"],
  invoice_ready: ["paid"],
  paid: [],
  canceled: [],
};

export function isAllowedStateTransition(from: TicketState, to: TicketState): boolean {
  return AllowedStateTransitions[from].includes(to);
}

// ------------------------
// Tool contracts (v0)
// ------------------------

export type ToolResult<T> = {
  request_id: string;
  ticket: Ticket;
  emitted_event_ids: ULID[];
  data: T;
};

export type TicketCreateInput = {
  request_id: string;
  actor: ActorRef;
  channel?: ChannelRef;

  customer: {
    display_name: string;
    phone?: string;
    email?: string;
  };

  location: Ticket["location"];

  summary: string;
  priority?: Ticket["priority"];

  initial_message?: {
    raw: string;
    normalized: string;
  };
};

export type TicketCreateOutput = ToolResult<{
  customer_id: ULID;
  ticket_id: ULID;
}>;

export type TicketAddMessageInput = {
  request_id: string;
  actor: ActorRef;
  channel: ChannelRef;
  ticket_id: ULID;

  message: {
    raw: string;
    normalized: string;
    direction: "inbound" | "outbound";
  };
};

export type TicketAddMessageOutput = ToolResult<Record<string, never>>;

export type ScheduleProposeSlotsInput = {
  request_id: string;
  actor: ActorRef;
  ticket_id: ULID;

  windows: Array<{
    window_start: ISO8601;
    window_end: ISO8601;
    timezone: string;
  }>;
};

export type ScheduleProposeSlotsOutput = ToolResult<{
  proposed: ScheduleProposeSlotsInput["windows"];
}>;

export type ScheduleConfirmInput = {
  request_id: string;
  actor: ActorRef;
  channel?: ChannelRef;
  ticket_id: ULID;

  selected_window: {
    window_start: ISO8601;
    window_end: ISO8601;
    timezone: string;
  };
};

export type ScheduleConfirmOutput = ToolResult<{
  confirmed: ScheduleConfirmInput["selected_window"];
}>;

export type DispatchAssignTechInput = {
  request_id: string;
  actor: ActorRef;
  ticket_id: ULID;
  technician_id: ULID;
};

export type DispatchAssignTechOutput = ToolResult<{
  technician_id: ULID;
}>;

export type CloseoutAddNoteInput = {
  request_id: string;
  actor: ActorRef;
  ticket_id: ULID;
  note: {
    text: string;
  };
};

export type CloseoutAddNoteOutput = ToolResult<Record<string, never>>;

export type CloseoutAddPhotoInput = {
  request_id: string;
  actor: ActorRef;
  ticket_id: ULID;

  photo: {
    storage_key: string;
    sha256?: string;
    content_type: string;
    size_bytes: number;
  };
};

export type CloseoutAddPhotoOutput = ToolResult<{
  attachment_id: ULID;
}>;

export type CloseoutChecklistCompleteInput = {
  request_id: string;
  actor: ActorRef;
  ticket_id: ULID;
  item_key: CloseoutChecklistKey;
};

export type CloseoutChecklistCompleteOutput = ToolResult<{
  item_key: CloseoutChecklistKey;
}>;

export type BillingCompileCloseoutPacketInput = {
  request_id: string;
  actor: ActorRef;
  ticket_id: ULID;
};

export type BillingCompileCloseoutPacketOutput = ToolResult<{
  attachment_id: ULID;
}>;
