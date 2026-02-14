# Technician Job Packet v0 Spec

## Purpose
Define the minimum packet required for technicians to execute work, capture evidence, and complete closeout without policy violations.

## Primary User
- field technician

## Packet Structure
### Header
- `ticket_id`
- `priority`
- `incident_type`
- `current_state`
- `scheduled_window`
- `assigned_provider_id`
- `assigned_tech_id`

### Site & Access
- site name/address
- access instructions
- onsite contact name + phone
- safety notes / hazards

### Work Scope
- issue summary
- customer description
- authorized scope constraints
- NTE value and approval constraints

### Execution Checklist (Required)
- arrival confirmed
- work performed summary
- parts used or needed
- resolution status
- onsite photos captured
- billing authorization captured

## Evidence Checklist Mapping
The packet must display template-bound required evidence keys for the incident type.

Example (`CANNOT_SECURE_ENTRY`):
- `photo_before_security_risk`
- `photo_after_temporary_or_permanent_securement`
- `note_risk_mitigation_and_customer_handoff`
- `signature_or_no_signature_reason`

## Signature Requirement
- Preferred: customer signature artifact attached.
- If signature is unavailable, packet requires explicit `no_signature_reason` entry before completion submission.

## Timeline + Update Expectations
- tech actions must append updates to timeline context:
  - significant onsite findings
  - temporary mitigation actions
  - completion attempt outcome (accepted/rejected)
- packet UI should show latest timeline events to avoid duplicate notes.

## Closeout Gate Behavior
Before enabling `Complete Work`:
- required checklist flags must be true
- required evidence keys must be present
- unresolved missing requirements must be shown inline

If missing requirements exist:
- completion action is blocked (fail closed)
- packet displays explicit missing evidence/checklist items

## Mobile Wireframe (ASCII)
```text
+----------------------------------------------+
| Ticket T-75ca03d5... | EMERGENCY | 00:18 SLA |
+----------------------------------------------+
| Site: Main St Storefront                     |
| Contact: Alex (555-0107)                     |
| Access: Rear gate keypad 4472                |
+----------------------------------------------+
| Required Evidence                             |
| [ ] photo_before_security_risk               |
| [ ] photo_after_temporary_or_permanent_...   |
| [ ] note_risk_mitigation_and_customer_...    |
| [ ] signature_or_no_signature_reason         |
+----------------------------------------------+
| Checklist                                    |
| [x] work_performed                           |
| [x] parts_used_or_needed                     |
| [x] resolution_status                        |
| [ ] onsite_photos_after                      |
| [ ] billing_authorization                    |
+----------------------------------------------+
| [Add Photo] [Add Note] [Add Signature]       |
| [Complete Work] (disabled until complete)    |
+----------------------------------------------+
```

## Acceptance Checklist
- packet defines required fields for onsite execution
- evidence and checklist gates are explicit and incident-template aligned
- no-signature reason path is mandatory when signature is absent
