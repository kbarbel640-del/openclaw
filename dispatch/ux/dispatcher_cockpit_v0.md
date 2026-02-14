# Dispatcher Cockpit v0 Spec

## Purpose
Provide dispatch operators with a single queue-first cockpit to triage urgency, prevent SLA breaches, and intervene safely when AI/tool automation needs override.

## Primary User
- dispatcher / operations coordinator

## Primary Views
1. Queue Grid (default)
2. Ticket Detail Panel
3. Timeline Panel

## Queue Grid (Required Columns)
- `ticket_id`
- `state`
- `priority`
- `incident_type`
- `site`
- `assigned_tech`
- `scheduled_start`
- `sla_timer_remaining`
- `sla_status` (`healthy|warning|breach`)
- `last_update_at`

## Queue Filters
- state (multi-select)
- priority
- SLA status
- assigned tech/provider
- incident type
- account/site

## SLA Timer Rules (UI)
- Timer color coding:
  - green: > 30 minutes remaining
  - amber: <= 30 minutes remaining
  - red: breached
- Breach rows pin to top of queue by default sort.
- Hover tooltip shows:
  - target SLA deadline
  - delay attribution (`customer`, `provider`, `unknown`)
  - last transition timestamp

## Assignment Override Flow
### Trigger
Dispatcher selects `Override Assignment` on a ticket row or detail panel.

### Required Inputs
- override type (`reassign_tech`, `reassign_provider`, `direct_dispatch_bypass`)
- reason code (`capacity`, `skill_mismatch`, `customer_request`, `safety`, `other`)
- free-text note (required, min 10 chars)

### Confirmation
- modal must show before/after assignment side-by-side
- modal warns that action will be audited
- submit remains disabled until required inputs are valid

### Output
- mutation request sent to dispatch-api command endpoint
- timeline receives audit event with actor/tool/payload
- queue row updates in place with transition result

## Timeline Panel
### Purpose
Expose immutable event history for operational decisioning.

### Required Fields Per Event
- created_at
- actor (`type/id/role`)
- tool_name
- before_state -> after_state
- request_id
- correlation_id
- summary payload preview

### Behavior
- order: `created_at ASC` with deterministic tie-breaker
- sticky filter options: state changes only / evidence events only / all
- click event opens raw payload drawer (read-only)

## Wireframe (ASCII)
```text
+----------------------------------------------------------------------------------+
| Dispatch Cockpit | Search [___________] | Filters | SLA: [All v] | Refresh      |
+----------------------------------------------------------------------------------+
| Queue Grid                                                                       |
|----------------------------------------------------------------------------------|
| Pri | SLA  | State        | Ticket           | Site      | Tech   | Last Update  |
| EMR | 00:08| DISPATCHED   | T-75ca03d5...    | Main St   | T-0073 | 03:12:18 PST |
| URG | 01:42| TRIAGED      | T-2401b397...    | Elm St    | -      | 03:10:01 PST |
| ...                                                                              |
+----------------------------------------------------------------------------------+
| Ticket Detail (right panel)                    | Timeline Panel                  |
|-------------------------------------------------|---------------------------------|
| Summary: Emergency - cannot secure storefront   | 03:12 actor:dispatcher         |
| State: DISPATCHED                               | TRIAGED -> DISPATCHED          |
| Priority: EMERGENCY                             | tool: assignment.dispatch       |
| [Assign] [Override Assignment] [Open Timeline]  | req: 8100... corr: story08...  |
+----------------------------------------------------------------------------------+
```

## Non-Goals (v0)
- bulk multi-ticket mutation actions
- custom per-user dashboard layouts
- predictive ETA model tuning UI

## Acceptance Checklist
- queue includes SLA timer and breach state at row level
- assignment override flow requires reason + audit warning
- timeline panel exposes immutable state/event chain with request/correlation IDs
