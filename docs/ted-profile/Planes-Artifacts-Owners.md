# Planes → Artifacts → Owners (one-page Council view)

**Status:** Active
**Version:** v4
**Purpose:** Provide a one-glance map of **what lives where**, **who owns it**, and **which event/ledger objects** each surface reads/writes.

---

## Canonical objects (used below)

### Event log

- **Append-only:** `event_log`

### Materialized ledgers / views (26+)

- `audit_trail`
- `commitments_ledger`
- `deals_ledger`
- `meetings_prep_ledger`
- `trust_ledger`
- `triage_ledger`
- `mail_actions_ledger`
- `gtd_actions_ledger`
- `gtd_waiting_for_ledger`
- `facility_alerts_ledger`
- `planner_ledger`
- `todo_ledger`
- `sync_proposals_ledger`
- `improvement_proposals_ledger`
- `draft_queue_ledger`
- `deep_work_sessions_ledger`
- `graph_sync_ledger`
- `policy_ledger`
- `scheduler_config`
- `pending_delivery`
- `correction_signals_ledger` (Builder Lane — edit deltas, accepts, rejects, reclassifications)
- `style_deltas_ledger` (Builder Lane — per-dimension voice/style drift + confidence scores)
- `builder_lane_status_ledger` (Builder Lane — fatigue state, cold-start phase, calibration events)
- `shadow_eval_ledger` (Builder Lane — shadow mode parallel config evaluation)
- `evaluation_corrections_ledger` (Dynamic QA — auto-generated golden fixtures from Builder Lane correction signals)

> **Rule of thumb:** any **write** action emits an event to `event_log` and updates one or more ledgers; any **read** action should prefer ledgers first, then query systems of record as needed.

---

## Plane 1 — Experience & Entry Paths (OpenClaw UI + MCP + Gateway Methods)

**Owner:** Platform/UX Lead (primary), OpenClaw Platform Engineer

| Artifact                                                         | Reads                                                                    | Writes                                        | Primary Owner              |
| ---------------------------------------------------------------- | ------------------------------------------------------------------------ | --------------------------------------------- | -------------------------- |
| UI Surfaces — 28 operator cards (Operate/Configure/Plan/Monitor) | all ledgers (esp. `draft_queue_ledger`, `trust_ledger`, `policy_ledger`) | approval actions → `event_log`, `audit_trail` | Platform/UX Lead           |
| Extension Gateway Methods (89+)                                  | mapped to Sidecar routes + ledgers                                       | mapped writes emit events                     | OpenClaw Platform Engineer |
| Agent Tools (51)                                                 | mapped to Sidecar routes + ledgers                                       | tool writes emit events                       | OpenClaw Platform Engineer |
| MCP Tools + Resources (`POST /mcp`, 44 tools)                    | tools read from ledgers/resources                                        | tool writes emit events                       | OpenClaw Platform Engineer |

---

## Plane 2 — Control Plane (Ted Sidecar Co‑Work Kernel / Orchestrator)

**Owner:** Co‑Work Systems Architect (primary), Reliability Engineer, Security Lead

### Config files (34) — “policy + runtime knobs”

| Config                        | Reads                                                                  | Writes                                                                                                                       | Primary Owner                   |
| ----------------------------- | ---------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- | ------------------------------- |
| `autonomy_ladder.json`        | —                                                                      | influences `policy_ledger` (effective capability gates)                                                                      | Council Policy Owner + Security |
| `brief_config.json`           | `commitments_ledger`, `deals_ledger`, `meetings_ledger`, `mail_ledger` | brief generation events → `event_log`, `audit_ledger`                                                                        | EA/CoS Operator + Product       |
| `draft_style.json`            | —                                                                      | influences `policy_ledger` (draft constraints)                                                                               | EA/CoS Operator + Product       |
| `graph.profiles.json`         | —                                                                      | drives `graph_sync_ledger` (per-tenant state)                                                                                | M365/Graph Architect            |
| `graph.profiles.example.json` | —                                                                      | —                                                                                                                            | M365/Graph Architect            |
| `hard_bans.json`              | —                                                                      | influences `policy_ledger` (blocked actions/providers)                                                                       | Security/Compliance Lead        |
| `llm_provider.json`           | —                                                                      | influences `policy_ledger` (routing + fallback)                                                                              | AI/LLM Architect                |
| `notification_budget.json`    | —                                                                      | updates `ops_ledger` (quiet hours/budget)                                                                                    | EA/CoS Operator + Reliability   |
| `onboarding_ramp.json`        | —                                                                      | updates `ops_ledger` (phase unlocks)                                                                                         | Product + Reliability           |
| `operator_profile.json`       | —                                                                      | updates `policy_ledger` (preferences/constraints)                                                                            | Product + EA/CoS Operator       |
| `para_rules.json`             | `para_index`                                                           | updates filing decisions → `event_log`                                                                                       | PKM/Data Architect              |
| `planning_preferences.json`   | `calendar_ledger`, `commitments_ledger`                                | updates `planning_ledger`                                                                                                    | EA/CoS Operator                 |
| `style_guide.json`            | —                                                                      | influences `policy_ledger`                                                                                                   | Product                         |
| `ted_agent.json`              | `ops_ledger` (schedules)                                               | cron dispatch events → `event_log`                                                                                           | Co‑Work Systems Architect       |
| `urgency_rules.json`          | `event_log` (signals), `trust_ledger`                                  | updates `ops_ledger` (escalations)                                                                                           | Security + EA/CoS Operator      |
| `builder_lane_config.json`    | —                                                                      | influences Builder Lane thresholds (decay rates, fatigue windows, cold-start archetypes, shadow duration, proposal minimums) | Platform Eng + Council          |
| `config_interactions.json`    | —                                                                      | static matrix: which config changes affect which downstream routes/behaviors                                                 | Platform Eng + Council          |
| `evaluation_graders.json`     | —                                                                      | multi-grader evaluation composition per intent (20 intents, 4 grader types)                                                  | AI/LLM Architect + Reliability  |
| `synthetic_canaries.json`     | —                                                                      | 10 synthetic health check canaries, scheduled hourly                                                                         | Reliability Eng                 |

### Route families (164 handlers total) — “capability surfaces”

| Route Family         | Primary JTBD                                                                                                                 | Reads                                                                                                                                  | Writes                                                                                                                                              | Primary Owner              |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------- |
| `/auth/*`            | mint sessions/tokens, token refresh with per-profile mutex (`ensureValidToken`)                                              | `policy_ledger`                                                                                                                        | `event_log`, `audit_trail`                                                                                                                          | Platform Eng + Security    |
| `/ops/*`             | pause/resume/dispatch/rate/retry, onboarding activation, setup validation                                                    | `policy_ledger`, `trust_ledger`                                                                                                        | `event_log`, `policy_ledger`, `audit_trail`                                                                                                         | Reliability Eng            |
| `/ops/qa/*`          | QA dashboard, canary status/run, drift status/run (5 routes)                                                                 | `evaluation_corrections_ledger`, `synthetic_canaries.json`, drift metrics                                                              | `event_log`, `evaluation_corrections_ledger`                                                                                                        | Reliability Eng            |
| `/governance/*`      | policy checks, confidence, contradictions, repair, output contract validation                                                | `policy_ledger`, `trust_ledger`, domain ledgers                                                                                        | `event_log`, `trust_ledger`, `audit_trail`                                                                                                          | Security/Compliance Lead   |
| `/reporting/*`       | briefs/digests/metrics/deep-work-metrics/trust-metrics                                                                       | all ledgers                                                                                                                            | `event_log`, `audit_trail`                                                                                                                          | EA/CoS Operator            |
| `/meeting/*`         | upcoming/prep/debrief                                                                                                        | Graph calendar, `meetings_prep_ledger`, `mail_actions_ledger`                                                                          | `event_log`, `meetings_prep_ledger`, `draft_queue_ledger`                                                                                           | EA/CoS Operator            |
| `/planning/*`        | timeblock generation                                                                                                         | Graph calendar, `commitments_ledger`                                                                                                   | `planner_ledger`, `event_log`                                                                                                                       | EA/CoS Operator            |
| `/commitments/*`     | commitment lifecycle + LLM-based extraction from emails                                                                      | `commitments_ledger`                                                                                                                   | `commitments_ledger`, `event_log`                                                                                                                   | EA/CoS Operator            |
| `/gtd/*`             | next actions + waiting-for                                                                                                   | `gtd_actions_ledger`, `gtd_waiting_for_ledger`                                                                                         | `gtd_actions_ledger`, `gtd_waiting_for_ledger`, `event_log`                                                                                         | EA/CoS Operator            |
| `/triage/*`          | ingest/classify/link/approve                                                                                                 | `mail_actions_ledger`, `triage_ledger`, `policy_ledger`                                                                                | `triage_ledger`, `draft_queue_ledger`, `event_log`                                                                                                  | Co‑Work Systems Architect  |
| `/deals/*`           | deal pipeline + milestones + gateway workflow                                                                                | `deals_ledger`, `commitments_ledger`                                                                                                   | `deals_ledger`, `event_log`                                                                                                                         | Deal Ops Lead              |
| `/filing/*`          | PARA suggestions + approval                                                                                                  | `para_index`, `mail_actions_ledger`, `deals_ledger`                                                                                    | `para_index`, `event_log`                                                                                                                           | PKM/Data Architect         |
| `/graph/*`           | M365 read + draft/write (gated), sync status                                                                                 | `graph_sync_ledger`, `mail_actions_ledger`, Graph calendar                                                                             | `event_log`, `mail_actions_ledger`, `graph_sync_ledger`                                                                                             | M365/Graph Architect       |
| `/drafts/*`          | draft state machine (6 states: drafted→pending_review→edited→approved→executed→archived), submit-review                      | `draft_queue_ledger`                                                                                                                   | `draft_queue_ledger`, `event_log`, `audit_trail`                                                                                                    | EA/CoS Operator            |
| `/learning/*`        | modifiers/affinity/meetings learnings                                                                                        | `event_log`, `audit_trail`                                                                                                             | `trust_ledger` (learned prefs), `event_log`                                                                                                         | Product + AI/LLM Architect |
| `/extraction/*`      | extract deadlines, commitment extraction (LLM-based with ok/none_found/extraction_failed status)                             | `mail_actions_ledger`, `deals_ledger`                                                                                                  | `commitments_ledger`, `event_log`                                                                                                                   | AI/LLM Architect           |
| `/scheduler/*`       | cron matching, pending delivery, scheduler tick with 6 gates                                                                 | `scheduler_config`, `pending_delivery`                                                                                                 | `pending_delivery`, `event_log`                                                                                                                     | Reliability Eng            |
| `/planner/*`         | Planner/To Do reconciliation engine, sync proposals                                                                          | `planner_ledger`, `todo_ledger`, `sync_proposals_ledger`                                                                               | `sync_proposals_ledger`, `event_log`                                                                                                                | EA/CoS Operator            |
| `/improvement/*`     | Codex Builder Lane: proposals, apply, generate, correction signals, shadow mode, calibration, confidence, fatigue, dashboard | `improvement_proposals_ledger`, `correction_signals_ledger`, `style_deltas_ledger`, `builder_lane_status_ledger`, `shadow_eval_ledger` | `improvement_proposals_ledger`, `correction_signals_ledger`, `style_deltas_ledger`, `builder_lane_status_ledger`, `shadow_eval_ledger`, `event_log` | Platform Eng + Council     |
| `/deep-work/*`       | deep work session recording                                                                                                  | `deep_work_sessions_ledger`                                                                                                            | `deep_work_sessions_ledger`, `event_log`                                                                                                            | EA/CoS Operator            |
| `/mcp`               | tool gateway (44 MCP tools)                                                                                                  | tool-specific                                                                                                                          | tool-specific                                                                                                                                       | Platform Eng               |
| `/status`, `/doctor` | health checks, LLM output contract golden fixture validation at startup                                                      | `policy_ledger`, `graph_sync_ledger`                                                                                                   | `event_log` (optional)                                                                                                                              | Reliability Eng            |

---

## Plane 3 — Contract & Intelligence Fabric (Templates + Validators + Router + Codex lanes)

**Owner:** AI/LLM Architect (primary), Security/Compliance Lead

| Artifact                                          | Reads                                                                                                                                           | Writes                                                                                                                                                                                                                                                          | Primary Owner              |
| ------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------- |
| Templates (per route/output)                      | ledgers relevant to output                                                                                                                      | `event_log` (generation), `audit_ledger`                                                                                                                                                                                                                        | Product + AI/LLM Architect |
| Validators (schema/sections/bans/signature)       | model outputs + `policy_ledger`                                                                                                                 | `trust_ledger` (pass/fail), `event_log`                                                                                                                                                                                                                         | Security + Reliability     |
| Provider Router (`llm_provider.json`)             | `policy_ledger`, entity context                                                                                                                 | `event_log` (routing decisions)                                                                                                                                                                                                                                 | AI/LLM Architect           |
| Codex **Runtime Lane** (contract-bound synthesis) | ledgers + source pointers                                                                                                                       | drafts → `draft_queue_ledger`, `event_log`                                                                                                                                                                                                                      | AI/LLM Architect           |
| Codex **Builder Lane** (gated improvements)       | repo + `AGENTS.md` + `audit_ledger` + `correction_signals_ledger` + `style_deltas_ledger` + `builder_lane_status_ledger` + `shadow_eval_ledger` | change requests (spec/tests/diff) → `event_log`, `improvement_proposals_ledger`; correction signals → `correction_signals_ledger`; style deltas → `style_deltas_ledger`; fatigue/calibration → `builder_lane_status_ledger`; shadow eval → `shadow_eval_ledger` | Platform Eng + Council     |

---

## Plane 4 — Connector Plane + Event Ingestion (dual-tenant)

**Owner:** M365/Graph Architect (primary), Integration Engineer, Security Lead

| Artifact                                             | Reads                            | Writes                                            | Primary Owner        |
| ---------------------------------------------------- | -------------------------------- | ------------------------------------------------- | -------------------- |
| Graph Tenant A profile                               | A-tenant sources                 | `event_log`, `graph_sync_ledger`                  | M365/Graph Architect |
| Graph Tenant B profile                               | B-tenant sources                 | `event_log`, `graph_sync_ledger`                  | M365/Graph Architect |
| Mail ingestion                                       | Outlook signals                  | `mail_ledger`, `triage_ledger`, `event_log`       | Integration Eng      |
| Calendar ingestion                                   | meetings/events                  | `calendar_ledger`, `meetings_ledger`, `event_log` | Integration Eng      |
| Draft output (Outlook drafts)                        | `draft_queue_ledger` + approvals | `mail_ledger`, `event_log`, `audit_ledger`        | M365/Graph Architect |
| (Future) Monday/DocuSign/Zoom/Teams/PACER connectors | system signals                   | `event_log`, domain ledgers                       | Integration Eng      |

---

## Plane 5 — State Plane (Event Log + Ledgers + Command Center projections)

**Owner:** PKM/Data Architect (primary), Reliability Engineer

| Object                          | Reads                                                                                                                     | Writes                                                   | Primary Owner                  |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- | ------------------------------ |
| `event_log`                     | (replay, audit, rebuild views)                                                                                            | append-only events from all planes (dual-write pattern)  | PKM/Data Architect             |
| `audit_trail`                   | UI + compliance review                                                                                                    | writes from Sidecar + approvals                          | Security/Compliance            |
| `policy_ledger`                 | governance checks, router                                                                                                 | derived from configs + config change events              | Council Policy Owner           |
| `graph_sync_ledger`             | connector health, sync history                                                                                            | connector writes                                         | M365/Graph Architect           |
| `mail_actions_ledger`           | triage, drafting, briefs                                                                                                  | ingestion + mail moves/drafts                            | Integration Eng                |
| `meetings_prep_ledger`          | prep/debrief                                                                                                              | meeting workflows                                        | EA/CoS Operator                |
| `triage_ledger`                 | inbox state                                                                                                               | triage workflows                                         | Co‑Work Systems Architect      |
| `commitments_ledger`            | briefs, GTD, planning                                                                                                     | extraction (LLM-based) + user actions                    | EA/CoS Operator                |
| `draft_queue_ledger`            | approvals/execution (6-state machine)                                                                                     | draft generation + submit-review + edits                 | EA/CoS Operator                |
| `deals_ledger`                  | deal views/status                                                                                                         | deal routes + connectors                                 | Deal Ops Lead                  |
| `trust_ledger`                  | proof checks + confidence + failure_reasons                                                                               | validators + learning                                    | Reliability + AI/LLM Architect |
| `gtd_actions_ledger`            | next actions                                                                                                              | GTD action workflows                                     | EA/CoS Operator                |
| `gtd_waiting_for_ledger`        | waiting-for items                                                                                                         | GTD waiting-for workflows                                | EA/CoS Operator                |
| `facility_alerts_ledger`        | facility scores/alerts                                                                                                    | facility alert lifecycle                                 | Reliability Eng                |
| `planner_ledger`                | Planner sync state                                                                                                        | reconciliation engine                                    | EA/CoS Operator                |
| `todo_ledger`                   | To Do sync state                                                                                                          | reconciliation engine                                    | EA/CoS Operator                |
| `sync_proposals_ledger`         | Planner/To Do proposals (dedup via existingProposalSet)                                                                   | reconciliation engine                                    | EA/CoS Operator                |
| `improvement_proposals_ledger`  | Codex Builder Lane proposals                                                                                              | improvement proposal workflows                           | Platform Eng + Council         |
| `correction_signals_ledger`     | Builder Lane correction evidence (edit deltas, accepts, rejects, reclassifications with context bucket + edit distance)   | correction signal capture from all operator interactions | Platform Eng + Council         |
| `style_deltas_ledger`           | Builder Lane per-dimension voice/style drift + confidence scores (logistic curve)                                         | pattern detection + proposal generation                  | AI/LLM Architect + Council     |
| `builder_lane_status_ledger`    | Builder Lane state: fatigue (3-state), cold-start phase, calibration events, dashboard metrics, rubber-stamping detection | fatigue monitor + calibration prompts + dashboard        | Reliability Eng + Council      |
| `shadow_eval_ledger`            | Builder Lane shadow mode: parallel config evaluation over 7-day windows (never contaminates production)                   | shadow mode evaluation runs                              | AI/LLM Architect + Council     |
| `evaluation_corrections_ledger` | Dynamic QA: auto-generated golden fixtures from Builder Lane correction signals                                           | QA pipeline fixture generation                           | Reliability Eng + AI/LLM       |
| `deep_work_sessions_ledger`     | deep work metrics                                                                                                         | session recording                                        | EA/CoS Operator                |
| `scheduler_config`              | cron rules + scheduler gates                                                                                              | scheduler configuration                                  | Reliability Eng                |
| `pending_delivery`              | pending scheduled deliveries                                                                                              | scheduler tick dispatch                                  | Reliability Eng                |

### Dynamic QA System (SDD 75)

| Layer                     | Mechanism                               | Coverage                                |
| ------------------------- | --------------------------------------- | --------------------------------------- |
| L1 Unit + Property        | Vitest + fast-check                     | 75 unit + 28 property + 16 JSONL        |
| L2 Contract + Integration | Route contracts + gateway analysis      | 852 contract + 198 gateway + 148 config |
| L3 LLM Evaluation         | Multi-grader pipeline + golden fixtures | 117 evaluation tests, 20 intents        |
| L4 Continuous Monitoring  | Canaries + drift detection              | 10 canaries, hourly schedule            |
| **Total**                 | **7 test files**                        | **1,434 tests**                         |

---

## MCP Tools (44) + Agent Tools (51) — reads/writes by permission tier

> **Note:** 44 tools are exposed via MCP (`POST /mcp`). 51 agent tools are registered via `api.registerTool()` in the extension. 7 write tools are in the `REQUIRES_OPERATOR_CONFIRMATION` set and blocked by the `before_tool_call` hook unless approved via `X-Ted-Approval-Source` header.

### Read-only tools (representative subset)

| Tool                    | Reads                                     | Writes                                 | Primary Owner        |
| ----------------------- | ----------------------------------------- | -------------------------------------- | -------------------- |
| `ted_status`            | `policy_ledger`, `graph_sync_ledger`      | —                                      | Reliability Eng      |
| `ted_morning_brief`     | all ledgers                               | `event_log` (generated)                | EA/CoS Operator      |
| `ted_eod_digest`        | all ledgers                               | `event_log` (generated)                | EA/CoS Operator      |
| `ted_mail_list`         | `mail_actions_ledger` (+ Graph if needed) | —                                      | M365/Graph Architect |
| `ted_draft_generate`    | ledgers + source pointers                 | `draft_queue_ledger`, `event_log`      | AI/LLM Architect     |
| `ted_deadlines`         | `mail_actions_ledger`, `deals_ledger`     | —                                      | AI/LLM Architect     |
| `ted_deal_list`         | `deals_ledger`                            | —                                      | Deal Ops Lead        |
| `ted_deal_get`          | `deals_ledger`                            | —                                      | Deal Ops Lead        |
| `ted_meeting_upcoming`  | Graph calendar                            | —                                      | EA/CoS Operator      |
| `ted_commitments_list`  | `commitments_ledger`                      | —                                      | EA/CoS Operator      |
| `ted_actions_list`      | `gtd_actions_ledger`                      | —                                      | EA/CoS Operator      |
| `ted_waiting_for_list`  | `gtd_waiting_for_ledger`                  | —                                      | EA/CoS Operator      |
| `ted_timeblock_plan`    | Graph calendar, `commitments_ledger`      | `planner_ledger` (plan proposal event) | EA/CoS Operator      |
| `ted_deep_work_metrics` | `deep_work_sessions_ledger`               | —                                      | EA/CoS Operator      |
| `ted_trust_metrics`     | `trust_ledger`, `audit_trail`             | —                                      | Reliability Eng      |
| `ted_para_structure`    | `para_index`                              | —                                      | PKM/Data Architect   |
| `ted_planner_status`    | `planner_ledger`, `sync_proposals_ledger` | —                                      | EA/CoS Operator      |
| `ted_todo_status`       | `todo_ledger`, `sync_proposals_ledger`    | —                                      | EA/CoS Operator      |
| `ted_graph_sync_status` | `graph_sync_ledger`                       | —                                      | M365/Graph Architect |
| `ted_improvement_list`  | `improvement_proposals_ledger`            | —                                      | Platform Eng         |

### Write tools (confirmation-gated, REQUIRES_OPERATOR_CONFIRMATION set)

| Tool                      | Reads                                  | Writes (always emits `event_log`)                                                 | Primary Owner        |
| ------------------------- | -------------------------------------- | --------------------------------------------------------------------------------- | -------------------- |
| `ted_mail_move`           | `mail_actions_ledger`                  | `mail_actions_ledger`, `audit_trail`                                              | M365/Graph Architect |
| `ted_calendar_create`     | Graph calendar                         | Graph calendar, `audit_trail`                                                     | M365/Graph Architect |
| `ted_deal_create`         | `deals_ledger`                         | `deals_ledger`, `audit_trail`                                                     | Deal Ops Lead        |
| `ted_deal_update`         | `deals_ledger`                         | `deals_ledger`, `audit_trail`                                                     | Deal Ops Lead        |
| `ted_deal_manage`         | `deals_ledger`                         | `deals_ledger`, `commitments_ledger`, `audit_trail`                               | Deal Ops Lead        |
| `ted_meeting_debrief`     | `meetings_prep_ledger`                 | `meetings_prep_ledger`, `commitments_ledger`, `draft_queue_ledger`, `audit_trail` | EA/CoS Operator      |
| `ted_meeting_prep`        | Graph calendar, `meetings_prep_ledger` | `draft_queue_ledger`, `meetings_prep_ledger`, `audit_trail`                       | EA/CoS Operator      |
| `ted_commitment_create`   | `commitments_ledger`                   | `commitments_ledger`, `audit_trail`                                               | EA/CoS Operator      |
| `ted_commitment_complete` | `commitments_ledger`                   | `commitments_ledger`, `audit_trail`                                               | EA/CoS Operator      |
| `ted_action_create`       | `gtd_actions_ledger`                   | `gtd_actions_ledger`, `audit_trail`                                               | EA/CoS Operator      |
| `ted_para_classify`       | `para_index`, source pointers          | `para_index`, `audit_trail`                                                       | PKM/Data Architect   |
| `ted_draft_submit_review` | `draft_queue_ledger`                   | `draft_queue_ledger`, `audit_trail`                                               | EA/CoS Operator      |
| `ted_deep_work_session`   | `deep_work_sessions_ledger`            | `deep_work_sessions_ledger`, `audit_trail`                                        | EA/CoS Operator      |

---

## Council validation checklist (quick)

- **Does every write tool emit an event + update a ledger + write an audit record?** (dual-write pattern enforced)
- **Do all entry paths converge into Sidecar before tool use?**
- **Are tenant boundaries enforced at connector + state layers (not just prompts)?**
- **Is Codex split into runtime lane vs builder lane with gated change requests?**
- **Are REQUIRES_OPERATOR_CONFIRMATION tools blocked by `before_tool_call` hook unless approved?**
- **Does token refresh use per-profile mutex (`ensureValidToken`) with 17 auth guards?**
- **Does the scheduler enforce 6 gates before dispatching pending deliveries?**
- **Do golden fixtures validate LLM output contracts at startup?** (7 fixtures)
- **Does reconciliation engine deduplicate sync proposals?** (plannerFetchOk/todoFetchOk gates, existingProposalSet)
