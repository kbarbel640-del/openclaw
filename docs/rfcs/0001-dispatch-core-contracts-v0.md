---
summary: "Authoritative v0 contracts for state machine, roles, audit events, and closed tool IO."
read_when:
  - Implementing dispatch-api mutations and validation
  - Wiring OpenClaw tools to dispatch data-plane endpoints
title: "RFC 0001 Dispatch Core Contracts v0"
---

# RFC 0001: Real Dispatch Core Contracts v0

Status: Draft
Owner: Zach
Last updated: 2026-02-08

## Purpose

Lock v0 contracts for Real Dispatch before implementing the dispatch data plane.

This RFC defines:

- v0 dispatch state machine (authoritative transitions)
- role and permission matrix (who can do what)
- canonical audit/event schema (append-only record)
- closed tool I/O contracts (the only mutation surface OpenClaw may use)

Non-goal:

- no UI design
- no provider integrations
- no pricing logic
- no AI memory state ownership

## Principles

- Source of truth is structured storage, not chat history.
- Model proposes actions; system validates and commits.
- Every mutation emits an audit event.
- All state-changing endpoints are idempotent.

## Entities (v0)

### Ticket

A unit of work from intake through closeout and billing.

### Customer

A person or organization requesting service.

### Technician

A worker who performs onsite work and provides evidence.

### Schedule

Represents proposed and confirmed time windows and assignments.

### Attachment

Photos, PDFs, voice notes, signatures, and generated packets.

### AuditEvent

Append-only record of every meaningful action.

## Dispatch state machine (v0)

### TicketState

- lead
- intake
- scheduled
- dispatched
- onsite
- work_performed
- closeout_ready
- invoice_ready
- paid
- canceled

### Allowed transitions

- lead -> intake
- intake -> scheduled
- scheduled -> dispatched
- dispatched -> onsite
- onsite -> work_performed
- work_performed -> closeout_ready
- closeout_ready -> invoice_ready
- invoice_ready -> paid

Cancellation:

- lead -> canceled
- intake -> canceled
- scheduled -> canceled

Reschedule:

- scheduled -> scheduled (self-transition allowed if schedule details change)

Notes:

- Any transition not listed is invalid.
- State must only change via dispatch-api endpoints that enforce this matrix.

## Roles and permissions (v0)

Roles:

- system_intake_agent
- system_scheduler_agent
- system_tech_liaison_agent
- system_closeout_agent
- operator_admin
- technician
- customer

Permission model:

- read and write are scoped to a ticket.
- write operations are also scoped by current TicketState.

High-level rules:

- Customers can only message, confirm schedule, and view their own ticket artifacts.
- Technicians can add notes/photos and acknowledgements for assigned tickets.
- System agents can mutate only via closed endpoints, and only within their scope.
- Admin can do everything, but still emits audit events.

## Canonical audit event schema (v0)

Audit events are append-only and never edited.
State is derived from the latest ticket snapshot and audit stream.

Each state-changing endpoint MUST:

1. validate input
2. validate transition permissions
3. apply mutation
4. write audit event(s)
5. return updated canonical state

Audit events MUST include:

- immutable event_id
- ticket_id (nullable for system events)
- actor (role and id)
- source channel (if applicable)
- request_id (idempotency key)
- type and payload (type-specific)
- timestamp
- previous_state and next_state (when state changes)

## Closed tool surface (v0)

OpenClaw may only call dispatch-api via these tools.

Ticket:

- ticket.create
- ticket.add_message

Scheduling:

- schedule.propose_slots
- schedule.confirm
- schedule.reschedule (optional v0.1)

Dispatch:

- dispatch.assign_tech
- dispatch.set_eta (optional v0.1)

Closeout:

- closeout.add_note
- closeout.add_photo
- closeout.checklist_complete

Billing:

- billing.compile_closeout_packet

All other mutations are out of scope for v0.

## Tool contracts (v0)

Each tool specifies:

- input schema
- output schema
- emitted audit event types
- state changes allowed

Authoritative code contracts are maintained under:

- src/contracts/v0.ts

## Idempotency

All state-changing endpoints require:

- request_id (string)
- ticket_id (when relevant)

If the same request_id is seen again for the same endpoint and scope,
the server MUST return the original response without duplicating events.

## Data integrity constraints (v0)

- ticket.state is only updated through allowed transitions.
- attachments are content-addressed (store hash) or have stable storage keys.
- every inbound message is stored raw and normalized, linked to a ticket.

## Closeout checklist decision (v0)

To keep v0 enforceable with minimal implementation risk, this RFC locks the conservative checklist set:

- work_summary_note
- onsite_photos_after

Additional checklist keys are deferred to v0.1.

## Tool I/O contracts

See code definitions in:

- src/contracts/v0.ts

## Rollout plan

1. Implement dispatch-api skeleton + DB + migrations.
2. Implement audit + idempotency middleware first.
3. Implement endpoints for v0 toolset.
4. Wire OpenClaw tool policy to only call these endpoints.
5. Add e2e tests: inbound -> ticket -> schedule -> onsite -> closeout packet.

## Open questions

- Are invoice_ready -> paid semantics immediate or linked to payment integration?
- Do we need quote_ready state pre-schedule in v0 or v0.1?
- Do we represent schedule as time windows or discrete appointments in v0?
