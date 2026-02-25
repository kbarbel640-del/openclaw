# Ted System Blueprint (5-Plane Architecture Reference)

**Status:** Active
**Version:** v3
**Purpose:** Complete architectural reference mapping Ted's 5 boxes + 2 cross-cutting planes, closed loops, ownership, config inventory, and M365 integration. Pairs with `Future-State-Framing.md` (Design Laws) and `Planes-Artifacts-Owners.md` (ledger mapping).

**Canonical source docs:**

- `docs/architecture/Future-State-Framing.md` -- Design Laws (11 non-negotiables) + North Star
- `docs/ted-profile/Planes-Artifacts-Owners.md` -- One-page Council view: planes -> artifacts -> owners -> ledger reads/writes

---

## Reframed single clear thought (updated with future-state planes)

### One sentence (North Star)

**Ted is a governed co-work kernel: OpenClaw/MCP capture intent, the Sidecar enforces policy + tenant firewalls, event-driven connectors stream M365/DealOps signals into an event-sourced diary, and contract-bound models (Codex included) generate validated briefs and ready-to-approve drafts -- so the client stays organized and accountable without risking compliance.**

### 15-second version (what you say out loud)

**Everything routes through the Sidecar. Events from M365 and deal systems become a canonical ledger. Templates define 'correct' outputs; models fill them. Ted produces daily briefs and draft deliverables; humans approve. Codex improves the system through gated change requests, not uncontrolled self-modification.**

### Why this wording matters

It keeps "agentic growth" inside governance:

autonomy comes from state + contracts + tool gating + review, not from "a smarter model."

---

## Future-state architecture

5 boxes + 2 cross-cutting planes (easy to see how it all interrelates)

Below each box you'll see:

- **JTBD:** Job To Be Done
- **Owned by:** who is accountable
- **Configured by:** which of your real configs/routes/tools are involved

---

### Box 1 -- Experience & Entry Paths

**What it is:** Where humans (and IDEs) interact with Ted.

**Inside (your reality):**

- MCP Server (P0): `POST /mcp` exposing 44 MCP tools + resources
- OpenClaw UI (P1): `ted.workbench` + 89+ gateway methods; 20+ operator surface cards across Operate/Configure/Plan/Monitor
- Agent Tools: 51 tools registered via `api.registerTool()` in the extension
- Legacy Copilot Webhook (P2): optional fallback integration

**JTBD:**
Capture intent ("do this", "summarize that", "prep this meeting") and present outputs (briefs, drafts, alerts, dashboards) without exposing internal complexity.

**Owned by:** OpenClaw platform engineer + UX lead

**Configured by (your inventory):**

- UI surfaces — 20+ operator surface cards (Operate/Configure/Plan/Monitor)
- Extension gateway methods (89+)
- Agent tools (51) via `api.registerTool()`
- MCP tools (44) via `POST /mcp`

---

### Box 2 -- Sidecar Co-Work Kernel

**What it is:** The single governance choke-point and operational kernel. This is where "requests become actions," and where "events become work."

**Inside (implemented — `server.mjs` ~10,600+ lines, 90+ route handlers):**

- Auth + session management (`/auth/mint`, MCP session handling) with token refresh using per-profile mutex (`ensureValidToken`, 17 auth guards)
- Policy enforcement: hard bans, autonomy ladder, urgency rules, notification budget, onboarding ramp
- Scheduler system: `cronMatchesNow`, `schedulerTick` with 6 gates, `pending_delivery.jsonl`, 4 scheduler routes, auto-start
- Draft state machine (6 states: drafted, pending_review, edited, approved, executed, archived) with submit-review route, idempotent edit, archived terminal state
- Reconciliation engine: Planner/To Do sync with dedup (plannerFetchOk/todoFetchOk gates, existingProposalSet)
- Commitment extraction from emails (LLM-based, status: ok/none_found/extraction_failed) with never-dark fallback
- Job queue + state machines:
  - Draft Queue lifecycle (6-state)
  - Commitments lifecycle
  - Deal stage workflows + deal gateway
  - Facility alert lifecycle
- Ops controls: pause/resume, retry, rate, dispatch, onboarding activation, setup validation (`/ops/*`)
- Governance services: contradictions, confidence rules, escalations, repair, output contract validation (`/governance/*`)
- REQUIRES_OPERATOR_CONFIRMATION set (7 tools) with `before_tool_call` hook blocking self-approve
- Top-level try/catch + `process.on` unhandledRejection/uncaughtException
- Audit log + progressive disclosure shaping
- 25+ JSONL ledgers with dual-write pattern (domain write + `appendEvent()`)
- Improvement proposals (Codex Builder Lane)
- Builder Lane subsystems: correction signal ledger, confidence accumulator, fatigue monitor, cold-start archetypes, proactive calibration, shadow mode, constitution check, config interactions matrix, rubber-stamping detection, preference drift/time decay

**JTBD:**
Turn intent + events into governed workflows that reliably produce: briefs, drafts, ledgers, escalations, and proof of correctness.

**Owned by:** Co-work systems architect + reliability engineer + security lead

**Configured by (your inventory):**

- `hard_bans.json`
- `autonomy_ladder.json`
- `urgency_rules.json`
- `notification_budget.json`
- `onboarding_ramp.json`
- `operator_profile.json`
- `ted_agent.json` (cron templates)
- `scheduler_config` (cron rules + scheduler gates)
- `/ops/*`, `/governance/*`, `/reporting/*`, `/meeting/*`, `/planning/*`, `/commitments/*`, `/gtd/*`, `/triage/*`, `/drafts/*`, `/scheduler/*`, `/planner/*`, `/improvement/*`, `/deep-work/*`

---

### Box 3 -- Contract & Intelligence Fabric

**What it is:** How Ted stays smart without going off-rails. This is the layer that makes "agentic" safe.

**Inside (implemented):**

- Template-as-contract definitions per route/output (briefs, digests, drafts, deal snapshots)
- Validators (schema/required sections/banned phrases/signature rules)
- LLM provider cascade with entity overrides: per-job -> entity override -> default, with timeouts + fallback
- HIPAA hard gate + PHI redaction (Everest)
- Golden fixture validation: 7 fixtures (draft_email, triage_classify, commitment_extract, improvement_proposal, morning_brief, eod_digest, meeting_prep) validated at startup via `validateLlmOutputContract`
- Trust validation with `failure_reasons` in metrics
- Commitment extraction from emails (LLM-based, status field: ok/none_found/extraction_failed)
- Two Codex lanes (explicit):
  - **Runtime Synthesis Lane (co-work):** fills contracts to generate briefs, drafts, extraction, formatting
  - **Builder / Improvement Lane:** generates change requests (new validators, new routes, connector improvements, proof harness upgrades) -- gated by spec -> tests/evals -> review -> rollout, tracked in `improvement_proposals_ledger`
  - **Builder Lane subsystems (SDD 56):** correction signal capture (edit deltas, accepts, rejects, reclassifications), confidence accumulator (per-dimension logistic curve, >0.90 = exclude from proposals), correction fatigue monitor (3-state: healthy/fatigued/improved), cold-start archetype selection + automated voice extraction, proactive calibration prompts (post-meeting, post-send, EOD), shadow mode (7-day parallel config with separate `shadow_eval.jsonl`), constitution check (validates proposals against `hard_bans.json`), config interactions matrix, rubber-stamping detection (overtrust monitor), preference drift with exponential time decay, improvement dashboard (correction rate trend, draft acceptance rate, monthly summary)

**JTBD:**
Produce consistent, compliant outputs at scale and improve over time without creating a governance bypass.

**Owned by:** AI/LLM architect + security lead + council (policy owners)

**Configured by (your inventory):**

- `llm_provider.json` (router + cascade)
- `brief_config.json` (brief/digest/report preferences)
- `draft_style.json`, `style_guide.json` (tone/style constraints)
- `planning_preferences.json` (time-block planning targets)
- `para_rules.json` (classification rules)
- `/governance/output`, `/governance/confidence`, `/ops/llm-provider` (GET/POST), `/reporting/*`, `/graph/drafts/generate`, `ted_draft_generate`

**Expert note (important correction):**
Codex is not "between OpenClaw and Sidecar." Codex lives inside this fabric behind Sidecar governance, and separately in the builder lane.

---

### Box 4 -- Connector Plane + Event Ingestion

**What it is:** "Signals in, drafts out" -- but done in a way that preserves tenant boundaries and supports event-sourcing.

**Inside (your current + recommended formalization):**

- Microsoft Graph connectors (two tenants)
  - separate auth, scopes, caches, partitions
  - profiles managed via `graph.profiles.json`
- Source connectors: Monday.com, DocuSign, Zoom/Teams meeting capture, PACER/CMS (as approved)
- Event ingestion/normalization (recommended to formalize): Convert raw signals into normalized events like:
  - `mail.received`, `mail.thread.updated`, `calendar.meeting.ending`, `meeting.transcript.ready`
  - `deal.stage.changed`, `docusign.status.changed`, `monday.item.updated`
  - `facility.alert.warning/crisis`, `oig.check.hit/clear`

**JTBD:**
Provide reliable, tenant-safe input streams and controlled draft outputs that feed the event log and ledgers.

**Owned by:** M365/Graph architect + integration engineer + security lead

**Configured by (your inventory):**

- `graph.profiles.json` + `/graph/auth/*`, `/graph/status`, `/graph/diagnostics`
- `/graph/mail/*`, `/graph/calendar/*`, `/graph/sync/status`
- `/triage/ingest` (current ingestion endpoint)
- Token refresh: `refreshAccessToken` + `ensureValidToken` with per-profile mutex, 17 auth guards updated
- Mail.Send scope added; config ready for operator GUIDs
- `graph_message_id` stored in JSONL + replayed; `draftQueueExecute` calls Graph send API

---

### Box 5 -- State Plane + Client Command Center

**What it is:** Where "truth" lives and where the client experiences value. This box turns your UI + routes into a cockpit over a canonical ledger.

**Inside (implemented — 25+ JSONL ledgers, dual-write pattern):**

- Append-only event log (every signal, action, approval, escalation) via `appendEvent()`
- Materialized ledgers/views (25+ queryable "current truth"):
  - `audit_trail` (compliance + UI review)
  - `commitments_ledger` (owner/due/evidence/status)
  - `draft_queue_ledger` (6-state machine: drafted/pending_review/edited/approved/executed/archived)
  - `deals_ledger` (dates, investors, counsel, tasks/checklists, milestones)
  - `triage_ledger` (classifications, patterns, linkages)
  - `facility_alerts_ledger` (scores, alerts history)
  - `trust_ledger` (proof checks, validator failures with failure_reasons, overrides)
  - `meetings_prep_ledger` (prep/debrief workflows)
  - `mail_actions_ledger` (mail ingestion + moves/drafts)
  - `gtd_actions_ledger` (next actions)
  - `gtd_waiting_for_ledger` (waiting-for items)
  - `planner_ledger` (Planner sync state)
  - `todo_ledger` (To Do sync state)
  - `sync_proposals_ledger` (Planner/To Do reconciliation proposals, dedup via existingProposalSet)
  - `improvement_proposals_ledger` (Codex Builder Lane)
  - `correction_signals_ledger` (Builder Lane — edit deltas, accepts, rejects, reclassifications with context)
  - `style_deltas_ledger` (Builder Lane — per-dimension voice/style drift tracking with confidence scores)
  - `builder_lane_status_ledger` (Builder Lane — fatigue state, cold-start phase, calibration events, dashboard metrics)
  - `shadow_eval_ledger` (Builder Lane — shadow mode parallel config evaluation, never contaminates production)
  - `deep_work_sessions_ledger` (session recording + metrics)
  - `graph_sync_ledger` (connector health + sync history)
  - `policy_ledger` (governance checks, config change events)
  - `scheduler_config` (cron rules)
  - `pending_delivery` (scheduled delivery queue)
- Client cockpit outputs (what they see — 20+ operator surface cards):
  - Morning Brief, EOD Digest, Meeting prep/debrief, Timeblock plan
  - Draft emails in Outlook drafts (with submit-review workflow)
  - Draft tasks to To Do / Planner (based on autonomy gate, with reconciliation)
  - Deal status & update drafts (Teams-ready)
  - Trust dashboard + deep work metrics + friction limits
  - Graph sync history viewer
  - Improvement proposals viewer
  - Scheduler status + pending delivery

**JTBD:**
Maintain durable organization and accountability by ensuring everything is captured, structured, and executable (as drafts) with proof and provenance.

**Owned by:** Data/PKM architect + reliability engineer + UX lead

**Configured by (your inventory):**

- `/reporting/morning-brief`, `/reporting/eod-digest`, `/reporting/deep-work-metrics`, `/reporting/trust-metrics`
- `/deals/*`, `/triage/*`, `/commitments/*`, `/gtd/*`, `/meeting/*`, `/filing/*`
- UI: Operate/Configure/Plan/Monitor tabs
- MCP resources: `ted://audit/recent` + config resources

---

## Cross-cutting planes (must be explicit in future state)

### Plane A -- Governance, Safety, and Tenant Firewall

**JTBD:** Make it impossible for Ted to do the wrong thing quietly.

**Mechanisms (already present, now enforced everywhere):**

- hard bans, autonomy ladder, urgency escalation, onboarding ramp
- tenant/context partitioning across: connectors, event log, ledgers, retrieval, drafts
- progressive disclosure in outputs (show less by default; reveal evidence on request)

**Configured by:**

- `hard_bans.json`, `autonomy_ladder.json`, `urgency_rules.json`, `onboarding_ramp.json`, `operator_profile.json`
- `/governance/*` suite + Policy Center UI surfaces

### Plane B -- Proof, Observability, and Evals

**JTBD:** Prevent regressions and enforce your pause conditions automatically.

**What is implemented:**

- String-presence scripts are BANNED; all proofs are behavioral (real HTTP calls)
- 7 golden fixtures validated at startup via `validateLlmOutputContract`: draft_email, triage_classify, commitment_extract, improvement_proposal, morning_brief, eod_digest, meeting_prep
- Trust metrics include `failure_reasons` for actionable diagnostics
- Output contract startup validation ensures contract compliance before serving

**Configured by:**

- Proof scripts rewrite + CI gates
- `/reporting/trust-metrics`, Monitor tab surfaces, `/ops/pause`, `/ops/retry`, `/ops/rate`

#### Dynamic QA System (SDD 75)

Four-layer automated quality assurance:

1. **L1 — Unit + Property Testing:** Pure functions extracted to `server-utils.mjs`, tested via Vitest + fast-check. 75 unit tests, 28 property-based tests, 16 JSONL round-trip tests.

2. **L2 — Contract + Integration:** `route_contracts.json` (164 routes) validated statically + live. Gateway methods cross-referenced with sidecar routes. 33 config files schema-validated. 1,198 tests total at this layer.

3. **L3 — LLM Evaluation:** Multi-grader pipeline (schema → keyword → constraint → pattern) with hard-fail early exit. `evaluation_graders.json` configures 20 intents. Golden fixtures in `output_contracts.json`. Correction-to-regression pipeline auto-generates fixtures from Builder Lane edits.

4. **L4 — Continuous Monitoring:** `synthetic_canaries.json` (10 canaries) run hourly via scheduler. Per-intent drift detection compares recent scores against 7-day rolling baseline. `GET /ops/qa/dashboard` aggregates all layers into unified health status.

Test infrastructure: `vitest.sidecar.config.ts`, 7 test files, 1,434 tests, ~670ms.

---

## How it all interrelates

### The three closed loops (updated for event sourcing + draft lifecycle)

**Loop 1 -- Signal -> Event Log -> Ledger**

Signals (M365 + deal systems) -> normalized events -> append-only event log -> materialized ledgers (commitments/drafts/deals/facility/trust)

_Client value:_ Nothing falls through the cracks; truth is replayable and auditable.

**Loop 2 -- Ledger -> Contract-Bound Drafts -> Approval -> Execution**

Ledgers + schedule + context -> model synthesis within contracts -> draft created (6-state machine: drafted -> pending_review -> edited -> approved -> executed -> archived) -> submit-review workflow with idempotent edit -> execution (if permitted, via Graph send API with `graph_message_id` stored) and event recorded. Never-dark fallback on commitment_extract. Hybrid mode event logging.

_Client value:_ Not reminders -- deliverables are pre-built and easy to approve.

**Loop 3 -- Operate -> Learn -> Improve (Codex Builder Lane, gated)**

Validator failures, edits, low approval rate, missed/late items -> Codex proposes improvement as change request -> spec -> tests/evals -> review -> staged rollout -> improved contracts/tools without uncontrolled agency

_Client value:_ The system gets better safely, without "mystery changes."

---

## Where Planner (and the rest of M365) fits -- enforced mapping

- **Outlook** = inbound commitments + meeting reality
- **To Do** = personal next actions
- **Planner** = shared workstreams + deal/facility execution plans
- **Teams** = updates/communication surface (drafts ready-to-post)
- **SharePoint/OneDrive** = evidence/artifacts (link, don't invent)
- **Event Log + Ledgers** = canonical truth that keeps everything consistent

This prevents drift between email, tasks, and updates.

---

## "Job to be done by who" (clear responsibilities)

### Human roles

**Client/Operator (Clint):**

- reviews briefs
- approves drafts
- rates suggestions (so learning is grounded)
- escalates policy changes through the Council, not ad hoc

**Council / Counselors:**

- maintain autonomy ladder + bans + escalation rules
- approve capability promotions
- own the proof/evals program and pause conditions

**Security/Compliance Lead:**

- owns tenant firewall, privilege allowlists, PHI redaction policy
- reviews audit and incident triggers

**M365/Graph Admin:**

- manages tenant identities/scopes, profile configs, connector health

**PKM/Data Architect:**

- owns event schema, ledger schema, provenance model, retention policies

**Platform/UX Lead:**

- keeps OpenClaw UI surfaces coherent, reduces cognitive load, ensures adoption

### System roles (software responsibilities)

- **OpenClaw:** interface, delivery, method routing (89+ gateway methods, 51 agent tools)
- **Sidecar:** governance enforcement + playbooks + state machines + scheduler + reconciliation (~10,600 lines, 90+ routes, 44 MCP tools)
- **Connectors:** ingest signals + create drafts (only as allowed) with token refresh + per-profile mutex
- **Event Log/Ledgers:** canonical truth and replay (21+ JSONL ledgers, dual-write pattern)
- **Models (incl. Codex runtime):** contract-bound synthesis with golden fixture validation
- **Codex builder lane:** gated improvement proposals (tracked in `improvement_proposals_ledger`)

---

## How it's configured (mapped to your real inventory)

### Config files by plane (15+ files, categorized)

**Control Plane (Sidecar kernel):**

- `autonomy_ladder.json`
- `hard_bans.json`
- `urgency_rules.json`
- `notification_budget.json`
- `onboarding_ramp.json`
- `operator_profile.json`
- `ted_agent.json`
- `evaluation_graders.json` (LLM evaluation grader pipeline configuration per intent)
- `synthetic_canaries.json` (canary definitions for continuous monitoring)

**Contract & Intelligence Fabric:**

- `llm_provider.json`
- `brief_config.json`
- `draft_style.json`
- `style_guide.json`
- `planning_preferences.json`
- `para_rules.json`

**Builder Lane (Codex self-improvement):**

- `builder_lane_config.json` (thresholds, decay rates, fatigue windows, cold-start archetypes, shadow mode duration)
- `config_interactions.json` (static matrix: which config changes affect which downstream routes/behaviors)

**Connector Plane:**

- `graph.profiles.json` (+ `graph.profiles.example.json` as template)

**Recommendation:** keep this organization intentional in-repo (folders or naming) so governance is obvious.

### Routes as "capability surfaces" (90+ handlers)

- **Governance + ops:** `/governance/*`, `/ops/*` are your control-plane APIs (incl. onboarding, setup validation, QA dashboard)
- **QA + monitoring:** `/ops/canary/*` (canary status and trigger), `/ops/drift/*` (drift detection status and trigger), `/ops/qa/dashboard` (unified QA health aggregator)
- **Ingestion + classification:** `/triage/*`, `/extraction/*` (commitment extraction with LLM)
- **Systems of record:** `/graph/*` (with token refresh + sync status)
- **Stateful domains:** `/deals/*`, `/commitments/*`, `/gtd/*`, `/meeting/*`, `/filing/*`
- **Draft lifecycle:** `/drafts/*` (6-state machine, submit-review)
- **Planner/To Do sync:** `/planner/*` (reconciliation engine, sync proposals)
- **Improvement proposals:** `/improvement/*` (Codex Builder Lane — proposals, apply, generate, dashboard, correction signals, shadow mode, calibration, confidence, fatigue status)
- **Deep work:** `/deep-work/*` (session recording)
- **Scheduler:** `/scheduler/*` (cron matching, pending delivery, tick with 6 gates)
- **Outputs/metrics:** `/reporting/*` (briefs, digests, deep work metrics, trust metrics)

### Tools as "permissioned actions"

- MCP tools (44): exposed via `POST /mcp`
- Agent tools (51): registered via `api.registerTool()` in the extension
- 7 tools in `REQUIRES_OPERATOR_CONFIRMATION` set, blocked by `before_tool_call` hook unless approved via `X-Ted-Approval-Source` header
- Read-only tools: safe, no confirmation
- Write tools: confirmation-gated (draft-only posture preserved)
- MCP parity maintained for future integrations

---

## The clean way to say "Codex in between" (updated so security won't object)

> "Codex runs behind the Sidecar inside the contract-and-governance fabric: it synthesizes and drafts within validated templates at runtime, and it proposes system improvements only through gated change requests."

That's the "in between" story that preserves your choke-point and still delivers agentic growth.

---

## Architecture diagram (planes + actual modules)

```
ENTRY & UX
OpenClaw UI (20+ cards) + 89 Gateway Methods + 51 Agent Tools + 44 MCP Tools (/mcp)
        |
        v
SIDECAR CO-WORK KERNEL (~10,600 lines, 90+ routes, Single Governance Choke-Point)
Auth (ensureValidToken + per-profile mutex) -> Hard Bans -> Autonomy Ladder -> Urgency Rules
-> Tenant/Context Firewall -> Notification Budget -> Onboarding Ramp
-> REQUIRES_OPERATOR_CONFIRMATION (7 tools, before_tool_call hook)
-> Draft State Machine (6 states) -> Scheduler (cron + 6 gates + pending delivery)
-> Reconciliation Engine (Planner/To Do sync) -> Commitment Extraction (LLM)
-> Audit Log -> Ops (pause/resume/retry/rate/setup/onboarding)
        |
        v
CONNECTOR PLANE + EVENT INGESTION
Graph Tenant A + Graph Tenant B (profiles/scopes partitioned)
Token refresh (refreshAccessToken + ensureValidToken, 17 auth guards)
+ Monday + DocuSign + Meetings + Research Sources
        |
        v
EVENT LOG (append-only, dual-write)  --->  25+ MATERIALIZED LEDGERS
(commitments / drafts / deals / facility / trust / planner / todo /
 sync_proposals / improvements / deep_work / scheduler / pending_delivery / ...)
        |
        v
CONTRACT & INTELLIGENCE FABRIC
Templates + Validators + LLM Provider Cascade (entity overrides + HIPAA gate + fallback)
7 Golden Fixtures (startup validation) + Trust failure_reasons
Runtime synthesis (drafts/briefs) + Builder lane (Codex change requests gated)
+ Correction signals + Confidence accumulator + Shadow mode + Constitution check
        |
        v
CLIENT COMMAND CENTER (20+ Operator Surface Cards)
Morning Brief / EOD Digest / Meeting Packs / Timeblocks
Draft Queue (6-state machine) -> Submit-Review -> Approvals -> Execution (Graph send)
Trust Dashboard + Deep Work Metrics + Graph Sync History + Scheduler Status
```
