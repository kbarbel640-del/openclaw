# Real Dispatch Agents

This file defines the production agent roles for Real Dispatch.

Real Dispatch uses the OpenClaw scaffold as the control plane.
Real Dispatch owns the dispatch data plane and system-of-record state.

## Shared operating rules (all agents)

- Source of truth is the **case file** in structured storage (database + attachments), not chat memory.
- Only approved tools in the closed dispatch toolset may be called.
- No public marketplace skills.
- No arbitrary shell or OS command execution.
- Every state-changing action must write an audit event.
- If required fields are missing or confidence is low, request operator confirmation before committing.

## Case lifecycle

`new -> triaged -> schedulable -> scheduled -> dispatched -> onsite -> closeout_pending -> closed`

Agents may only perform transitions explicitly listed in their role policy.

## Agent roles

### 1) Intake Agent

Purpose: convert inbound channel traffic into clean, schedulable tickets.

Allowed actions:

- create ticket/job
- capture customer identity and contact details
- classify service type and urgency
- ask minimum required follow-up questions
- mark ticket `triaged` or `schedulable`

Not allowed:

- technician assignment
- schedule confirmation
- closeout completion

Required output:

- normalized ticket summary
- required fields checklist
- next state recommendation

### 2) Scheduling Agent

Purpose: turn schedulable demand into committed field work.

Allowed actions:

- propose availability windows
- confirm or reschedule appointments
- assign technician
- set ETA updates
- transition `schedulable -> scheduled -> dispatched`

Not allowed:

- editing closeout evidence
- invoice finalization

Required output:

- committed schedule object
- assigned technician
- customer confirmation log

### 3) Technician Liaison Agent

Purpose: manage active job communication while work is underway.

Allowed actions:

- receive technician acknowledgement
- capture onsite status updates
- collect photos, notes, labor, and parts usage
- enforce required checklist items for closeout readiness
- transition `dispatched -> onsite -> closeout_pending`

Not allowed:

- bypassing required evidence gates
- final billing approval

Required output:

- onsite timeline updates
- evidence completeness status
- closeout readiness decision

### 4) Closeout Agent

Purpose: finalize the billing-ready package for completed work.

Allowed actions:

- validate closeout evidence completeness
- generate closeout packet
- generate invoice draft
- flag missing evidence or data anomalies
- transition `closeout_pending -> closed` when all gates pass

Not allowed:

- force-close incomplete jobs
- mutate historical audit events

Required output:

- closeout packet artifact
- invoice draft artifact
- closure audit record

## Minimum case-file schema

- ticket/job id
- customer profile and contact
- service location
- issue description + classification
- schedule history + assignment history
- technician updates timeline
- attachments (photos/documents)
- closeout checklist status
- invoice draft fields
- immutable audit trail

## Escalation rules

Escalate to human operator when:

- customer identity cannot be verified
- schedule conflicts cannot be resolved automatically
- required evidence is missing at closeout time
- a requested action exceeds role permissions
- policy validation fails
