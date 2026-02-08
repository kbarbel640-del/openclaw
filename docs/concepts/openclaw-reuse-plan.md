---
summary: "Structured reuse plan for keeping OpenClaw as control plane and Real Dispatch as system of record."
read_when:
  - Planning the migration from scaffold-first to dispatch-first architecture
  - Defining hard boundaries between orchestration and operational data
title: "OpenClaw Reuse Plan"
---

# OpenClaw to Real Dispatch reuse plan

This plan maps OpenClaw control-plane components (gateway, runtime orchestration, scheduler, sessioning, routing, and messaging surfaces) to Real Dispatch requirements (intake, scheduling, technician coordination, closeout, and billing records) for homelab Docker deployments with strict safety constraints.

Contract lock for this plan is documented in [RFC 0001 dispatch core contracts](/rfcs/0001-dispatch-core-contracts-v0).

## Adopt directly

### Gateway control plane

- Why it maps: dispatch is a multi-surface inbox and orchestration problem.
- Keep: channel adapters, routing, session ownership, operator surfaces.
- Value: very high.
- Risk: medium.

### Scheduler and cron wakeups

- Why it maps: dispatch needs deterministic timers for follow-up and escalation.
- Keep: wake and nudge workflows.
- Constraint: do not let scheduler jobs bypass the closed toolset.
- Value: high.
- Risk: low to medium.

### Agent runtime orchestration

- Why it maps: you need consistent, session-bound turns with tool streaming.
- Keep: runtime execution framework, not memory as source of truth.
- Constraint: role-scoped permissions and explicit tool allowlists only.
- Value: high.
- Risk: medium.

## Refactor and extract

### Two-tier memory model

- Policy memory: SOPs, playbooks, templates, escalation policy.
- Case state: tickets, customers, technicians, schedules, attachments, audit.
- Rule: case state must be authoritative in structured storage.

Implementation pattern:

1. Keep markdown injection for policy guidance.
2. Store operational truth in dispatch database and object store.
3. Generate case summary payload from database before each turn.

### Closed dispatch toolset

Replace open-ended tool patterns with explicit dispatch actions:

- `ticket.create`
- `ticket.add_message`
- `ticket.set_priority`
- `schedule.propose_slots`
- `schedule.confirm`
- `dispatch.assign_tech`
- `dispatch.set_eta`
- `closeout.add_photo`
- `closeout.add_note`
- `closeout.checklist_complete`
- `billing.generate_invoice_draft`
- `billing.compile_closeout_packet`

Every tool must:

- validate inputs
- enforce legal state transitions
- write audit events
- return canonical updated case state

### Inbound normalization through dispatch API

Even when OpenClaw receives inbound events, dispatch API should:

- dedupe inbound messages
- attach messages to the correct ticket
- persist raw payload and normalized text
- run abuse and spam controls
- decide new ticket versus existing ticket attachment

## Rebuild as Real Dispatch primitives

### Dispatch state machine

Example lifecycle:

`lead -> intake -> scheduled -> dispatched -> onsite -> work_performed -> closeout_ready -> invoice_ready -> paid_or_ar`

Only legal transitions are allowed, and each transition is auditable.

### Identity roles and permissions

Required role boundaries:

- customer
- technician
- admin and operator
- agent roles (intake, scheduling, tech liaison, closeout)

### Audit log and evidence chain

Every mutation records:

- actor identity
- timestamp
- source channel
- before and after diff
- attachment references and hashes (recommended)

### Closeout packet generator

Dispatch output should compile:

- before and after photos
- technician notes
- labor and parts
- signatures and approvals
- invoice draft
- customer-facing summary

## Docker topology (homelab first)

### Minimal v0

- `openclaw-gateway` for control plane
- `dispatch-api` for system of record and closed tool endpoints
- `postgres` for structured dispatch state
- `minio` for attachment and packet artifacts
- optional `dispatch-worker` for background tasks

### Network policy

- `openclaw-gateway` can reach only:
  - `dispatch-api`
  - required model/provider endpoints
  - required channel endpoints
- deny default shell and OS execution paths in production.
- avoid broad outbound internet permissions.

## Interface boundaries

### Boundary 1: control plane to data plane

OpenClaw interacts only through:

- closed dispatch tool endpoints
- case-summary read endpoints

### Boundary 2: data plane to external integrations

Only dispatch API and workers call:

- payments
- email
- mapping and geolocation
- parts and vendor systems

This prevents agent-level direct integration drift.

## State handling rule

The model never owns state. It reads state, proposes actions, and the system commits state.

Per turn:

1. Load authoritative case state from database.
2. Generate compact case summary for model context.
3. Execute proposed actions through closed tools.
4. Validate and commit state transitions.
5. Return outbound messages using committed facts only.

## Extensibility plan

Start with a minimal stable toolset and expand only after audit and reliability targets are met.

### v0 toolset

- create ticket
- attach inbound message
- ask intake questions
- propose slots
- confirm schedule
- assign technician
- send customer and technician updates
- capture photos and notes
- complete checklist items
- compile closeout packet draft

Everything else is phase-two scope.
