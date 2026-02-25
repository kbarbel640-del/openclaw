# MABOS Multi-Agent Cognitive Framework — BDI + SBVR Architecture Guide

> A complete technical reference for the Multi-Agent Business Operating System's cognitive architecture, multi-agent coordination patterns, and SBVR-grounded knowledge management. This document describes the framework in enough detail to reimplement the system independently.

---

**Document Path (remote):** `docs/plans/2026-02-24-bdi-sbvr-multiagent-framework.md`
**Date:** 2026-02-24
**Status:** Authoritative Reference

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [Tech Stack](#2-tech-stack)
3. [Architecture Layers](#3-architecture-layers)
4. [BDI Cognitive Architecture](#4-bdi-cognitive-architecture)
5. [Goal System](#5-goal-system)
6. [Desire Management](#6-desire-management)
7. [Planning System](#7-planning-system)
8. [SBVR Ontology](#8-sbvr-ontology)
9. [Multi-Agent Coordination](#9-multi-agent-coordination)
10. [Stakeholder Governance](#10-stakeholder-governance)
11. [Workforce Management](#11-workforce-management)
12. [Knowledge Management](#12-knowledge-management)
13. [Memory System](#13-memory-system)
14. [BPMN 2.0 Workflow Management](#14-bpmn-20-workflow-management)
15. [TypeDB Knowledge Graph](#15-typedb-knowledge-graph)
16. [Tool Catalog](#16-tool-catalog)
17. [File Layout](#17-file-layout)
18. [BDI Runtime Service](#18-bdi-runtime-service)
19. [Implementation Guide](#19-implementation-guide)

---

## 1. System Overview

MABOS (Multi-Agent Business Operating System) is a cognitive multi-agent framework where autonomous LLM-based agents collectively run businesses using a Belief-Desire-Intention (BDI) architecture grounded in SBVR (Semantics of Business Vocabulary and Rules) ontologies. The system models a full C-suite of AI agents, each holding its own cognitive state, communicating with peers via Agent Communication Language (ACL) messages, and operating over a shared SBVR-grounded knowledge graph.

### Core Design Principles

- **Cognitive Autonomy**: Every agent maintains private beliefs, desires, goals, intentions, and plans. No agent directly manipulates another agent's cognitive state — all coordination is via message passing.
- **Grounded Vocabulary**: All agent reasoning is anchored to SBVR business ontologies, ensuring that terms like "Customer", "Revenue", "Subscription", and "Engagement" have precise, shared definitions.
- **Transparent Reasoning**: The 5-phase BDI cycle (Perceive → Deliberate → Plan → Act → Learn) makes agent decision-making auditable and explainable.
- **Human-in-the-Loop Governance**: A configurable stakeholder profile controls approval thresholds, risk tolerance, and decision escalation, ensuring humans retain control over high-impact decisions.
- **Knowledge Accumulation**: Case-based reasoning, forward/backward inference, and a recursive-consolidation memory system ensure agents grow more capable over time.

### System Scale

| Dimension                 | Value                                                                                                                        |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Total registered tools    | 99 across 21 modules                                                                                                         |
| Agent roles (C-suite)     | 9 (CEO, CFO, COO, CMO, CTO, HR, Legal, Strategy, Knowledge)                                                                  |
| Cognitive files per agent | 12 (Persona, Capabilities, Beliefs, Desires, Goals, Intentions, Plans, Commitments, Playbooks, Knowledge, Learnings, Memory) |
| Reasoning methods         | 35 across 6 categories                                                                                                       |
| Domain ontologies         | 10 (JSON-LD/OWL)                                                                                                             |
| SBVR business concepts    | 170 concepts, 131 fact types, 8 rules                                                                                        |
| Process notation          | BPMN 2.0                                                                                                                     |

---

## 2. Tech Stack

| Component            | Version             | Purpose                                                      |
| -------------------- | ------------------- | ------------------------------------------------------------ |
| Node.js              | >= 22.12.0          | Runtime environment                                          |
| TypeScript           | >= 5.9              | Language (strict mode enabled)                               |
| @sinclair/typebox    | ^0.34               | Runtime type validation for tool schemas                     |
| SQLite (node:sqlite) | Built-in (Node 22+) | Native search: FTS5 full-text + sqlite-vec vector similarity |
| TypeDB               | 3.0+ (optional)     | Knowledge graph for multi-hop relation traversal             |
| Vitest               | >= 4.0              | Unit and integration testing                                 |
| pnpm                 | >= 10.23            | Package manager (workspace monorepo)                         |
| OpenClaw Plugin SDK  | latest              | Tool registration, service lifecycle management              |

### Storage Architecture

The system uses a three-tier storage model:

```
Tier 1 (Primary):   JSON + Markdown files on disk
Tier 2 (Secondary): SQLite with FTS5 + sqlite-vec (native search and vector ops)
Tier 3 (Tertiary):  TypeDB knowledge graph (optional, best-effort write-through)
```

All writes go to Tier 1 first. SQLite indexes are updated synchronously for search. TypeDB is updated asynchronously and is considered non-authoritative — the JSON files are always the source of truth.

---

## 3. Architecture Layers

The following ASCII diagram shows the complete system layering from user-facing stakeholder interfaces down to storage backends:

```
┌──────────────────────────────────────────────────────────────────────────┐
│  Stakeholder Layer (Human Owner)                                          │
│  stakeholder_profile · decision_review · decision_resolve                 │
│  governance_check                                                         │
├──────────────────────────────────────────────────────────────────────────┤
│  Multi-Agent Coordination Layer                                           │
│  ├── ACL Messaging (REQUEST · INFORM · QUERY · PROPOSE · ACCEPT/REJECT)  │
│  ├── Contract Net Protocol (CFP → PROPOSE → AWARD)                        │
│  ├── Decision Escalation (agent → decision_queue → stakeholder)           │
│  └── Workforce Management (work packages · handoffs · trust scoring)      │
├──────────────────────────────────────────────────────────────────────────┤
│  Agent Cognitive Layer (per agent, 9 agents)                              │
│  ├── BDI Cycle: PERCEIVE → DELIBERATE → PLAN → ACT → LEARN              │
│  ├── Beliefs (4 categories, certainty, revision log)                      │
│  ├── Desires (priority formula, conflict resolution, terminal/instrumental)│
│  ├── Goals (3-tier: strategic / tactical / operational)                    │
│  ├── Intentions (commitment strategies: single/open/cautious-minded)      │
│  └── Plans (HTN decomposition, CBR retrieval, step execution)             │
├──────────────────────────────────────────────────────────────────────────┤
│  Knowledge Management Layer                                               │
│  ├── Fact Store (SPO triples · confidence · temporal validity)            │
│  ├── Rule Engine (inference · constraint · policy rules)                  │
│  ├── Inference Engine (forward · backward · abductive)                    │
│  ├── CBR (S(B,D) = F(Sb ∩ Sd) retrieval · case storage)                 │
│  ├── Ontology Management (propose · validate · merge · scaffold)          │
│  └── Reasoning Engine (35 methods · meta-router · multi-method fusion)    │
├──────────────────────────────────────────────────────────────────────────┤
│  Memory System (RLM-Enhanced)                                             │
│  ├── Three-Store Model (working / short-term / long-term)                 │
│  ├── Recursive Consolidation (Jaccard grouping + summarization)           │
│  ├── Hierarchical Index (daily → weekly → monthly → quarterly)            │
│  ├── Pre-Compaction Checkpoints (structured session state)                │
│  ├── Recursive Search (iterative query refinement, depth 3)               │
│  └── Hybrid Search (FTS5 BM25 + vector cosine similarity)                │
├──────────────────────────────────────────────────────────────────────────┤
│  SBVR Ontology Layer                                                      │
│  ├── 10 domain ontologies (JSON-LD/OWL)                                   │
│  ├── 170 business concepts · 131 fact types · 8 rules                     │
│  └── TypeQL schema generation (JSON-LD → TypeQL)                          │
├──────────────────────────────────────────────────────────────────────────┤
│  Process Management Layer                                                 │
│  ├── BPMN 2.0 Workflows (tasks · gateways · events · lanes)              │
│  └── Workflow ↔ Goal linking                                              │
├──────────────────────────────────────────────────────────────────────────┤
│  Storage Backends                                                         │
│  ├── Primary: JSON + Markdown (files on disk)                             │
│  ├── Secondary: SQLite (FTS5 + sqlite-vec) — native search               │
│  └── Tertiary: TypeDB (knowledge graph) — best-effort                     │
├──────────────────────────────────────────────────────────────────────────┤
│  BDI Runtime (Background Heartbeat)                                       │
│  ├── Intention pruning (deadline + stall detection)                       │
│  ├── Desire re-prioritization                                             │
│  ├── Belief conflict detection                                            │
│  └── Chunked belief processing (R5)                                       │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## 4. BDI Cognitive Architecture

The BDI (Belief-Desire-Intention) architecture is the cognitive foundation of every MABOS agent. It originates from the philosophical theory of practical reasoning (Bratman, 1987) and is adapted here for LLM-based autonomous agents operating in a business context.

### 4.1 The 5-Phase Reasoning Cycle

Every agent operates on a continuous 5-phase reasoning cycle. The cycle can be triggered by an inbound ACL message, a scheduled heartbeat, or an explicit invocation via the `bdi_cycle` tool.

```
┌─────────┐    ┌───────────┐    ┌──────┐    ┌─────┐    ┌───────┐
│ PERCEIVE │───▶│ DELIBERATE│───▶│ PLAN │───▶│ ACT │───▶│ LEARN │
└─────────┘    └───────────┘    └──────┘    └─────┘    └───────┘
     ▲                                                       │
     └───────────────────────────────────────────────────────┘
                         (continuous loop)
```

#### Phase 1: PERCEIVE

The agent reads and integrates environmental state into its belief base:

- **External data sources**: Market prices, API responses, system metrics
- **ACL messages from peers**: INFORM messages update beliefs directly; QUERY messages trigger belief retrieval
- **Fact store queries**: SPO triples asserted by other agents or derived by the rule engine
- **Memory recall**: Retrieve relevant past observations from long-term memory

Beliefs are updated with a revision log — each change records: prior value, new value, source, certainty delta, and timestamp.

#### Phase 2: DELIBERATE

The agent evaluates its desires against its current beliefs to determine which goals to pursue:

**Priority Formula:**

```
priority = (base × 0.30) + (importance × 0.25) + (urgency × 0.25) + (alignment × 0.15) + (deps × 0.05)
```

Where:

- `base` — intrinsic value of the desire (0.0–1.0)
- `importance` — weight relative to business outcomes (0.0–1.0)
- `urgency` — time-sensitivity factor (0.0–1.0)
- `alignment` — alignment with the agent's strategic objectives (0.0–1.0)
- `deps` — dependency satisfaction score (0.0–1.0, averaged across dependencies)

**Desire Types:**

- `maintain` — sustain a current state (e.g., maintain cash runway > 6 months)
- `achieve` — reach a target state (e.g., achieve $100K MRR)
- `avoid` — prevent an undesirable state (e.g., avoid churn > 5%)
- `optimize` — maximize or minimize a metric (e.g., optimize CAC)

**Desire Categories:**

- **Terminal desires** — intrinsically valued; not in service of any other desire
- **Instrumental desires** — serve a terminal desire; can be dropped if the terminal is fulfilled or abandoned

Conflict resolution between competing desires uses three strategies:

1. **Priority-based** — higher-priority desire wins
2. **Resource-sharing** — both desires proceed with reduced resource allocation
3. **Temporal-scheduling** — desires are serialized by urgency

After deliberation, unfulfilled desires generate new goals if no existing active goal already addresses them.

#### Phase 3: PLAN

The agent creates or retrieves action plans for its active goals using three complementary methods:

1. **HTN Decomposition** — decomposes a compound task into sub-tasks recursively until all leaves are primitive (directly executable) actions
2. **CBR Retrieval** — searches the case base for past situations similar to the current belief-desire state: `S(B,D) = F(Sb ∩ Sd)`, weighted 60% beliefs / 40% desires
3. **Plan Library Search** — looks up domain-specific templates (e.g., "launch_saas_product", "acquire_enterprise_client")

If a retrieved plan does not perfectly fit the current situation, **case adaptation** modifies it:

- Parameter substitution (swap entity references)
- Step insertion or deletion (add/remove steps for context differences)
- Constraint relaxation (loosen deadlines or budgets if resources are constrained)

**Negative case checking** ensures the agent does not repeat past failures by filtering out plans whose stored outcomes were unsuccessful.

#### Phase 4: ACT

The agent executes its committed intentions:

- **Commit intentions** with a strategy (see Commitment Strategies below)
- **Execute primitive steps** — each step maps to a tool invocation (e.g., `email_send`, `crm_create_contact`, `fact_assert`)
- **Navigate decision points** — at branch points in a plan, the agent evaluates conditions and selects the appropriate path
- **Stakeholder escalation** — if an action's estimated cost or impact exceeds the configured governance threshold (default: $5,000), execution pauses and a decision is posted to the decision queue

#### Phase 5: LEARN

After acting, the agent consolidates its experience:

- **Store cases**: The situation (belief snapshot + desire state), solution (plan used), and outcome (success/failure metrics) are saved to the CBR case base for future reuse
- **Update beliefs**: Observations from execution revise the belief base (e.g., "API response time was 2.3s" updates a latency belief)
- **Write to memory**: New observations and lessons are stored across all three memory stores (working, short-term, long-term) with RLM enhancements
- **Log learnings**: Significant insights are appended to `Learnings.md` and indexed for future recall

### 4.2 Cognitive Files

Each agent maintains 12 markdown/JSON files in its `agents/{agent_id}/` directory:

| File              | Purpose                       | Key Fields                                                                                |
| ----------------- | ----------------------------- | ----------------------------------------------------------------------------------------- |
| `Persona.md`      | Role definition               | Title, department, autonomy level, reporting lines, communication style                   |
| `Capabilities.md` | Skills and access             | Tools available, proficiency levels (novice/competent/expert), domain expertise           |
| `Beliefs.md`      | Epistemic state               | Statements with certainty (0.0–1.0), categories, revision log                             |
| `Desires.md`      | Motivations                   | Priority score, desire type (achieve/maintain/avoid/optimize), terminal/instrumental flag |
| `Goals.md`        | Active objectives             | Level (strategic/tactical/operational), status, progress %, deadline, parent goal         |
| `Intentions.md`   | Committed actions             | Goal link, commitment strategy, start time, progress, stall detection                     |
| `Plans.md`        | Action plans                  | HTN steps, decision points, resource requirements, risk flags                             |
| `Commitments.md`  | External obligations          | Counterparty, terms, deadline, status, consequences of breach                             |
| `Playbooks.md`    | Standard operating procedures | Named playbooks with triggers, steps, and success criteria                                |
| `Knowledge.md`    | Agent knowledge base          | Curated facts, domain expertise, reference material                                       |
| `Learnings.md`    | Accumulated lessons           | Timestamped insights with context and applicability conditions                            |
| `Memory.md`       | Human-readable memory log     | Chronological narrative memory for LLM context                                            |

**Belief Categories:**

- `environment` — facts about the external world (market, customers, competition)
- `self` — facts about the agent's own capabilities and state
- `agent` — facts about other agents in the system
- `case` — facts derived from past cases in the CBR store

### 4.3 Commitment Strategies

When an agent commits to an intention, it selects a commitment strategy that governs when the intention may be abandoned:

| Strategy                | Stall Threshold | Behavior                                                                                    |
| ----------------------- | --------------- | ------------------------------------------------------------------------------------------- |
| `single-minded`         | Never stall     | Commitment expires only when the deadline passes — the agent never abandons due to stalling |
| `open-minded` (default) | 7 days          | Commitment expires if past deadline OR if progress has stalled for more than 7 days         |
| `cautious`              | 3 days          | Commitment expires if past deadline OR if progress has stalled for more than 3 days         |

The appropriate strategy is selected based on the criticality and reversibility of the goal:

- Use `single-minded` for regulatory compliance and hard contractual deadlines
- Use `open-minded` for standard operational objectives
- Use `cautious` for experimental initiatives where early abandonment is preferable

### 4.4 Reconsideration Triggers

Even after committing to an intention, an agent may reconsider it if certain triggers fire:

| Trigger               | Threshold         | Description                                                                  |
| --------------------- | ----------------- | ---------------------------------------------------------------------------- |
| `belief_change`       | severity > 0.3    | A significant new belief makes the current plan inappropriate                |
| `progress_stall`      | delta < 0.01      | Progress has not advanced meaningfully in the last monitoring interval       |
| `resource_constraint` | available < 50%   | Insufficient resources remain to continue                                    |
| `better_option`       | EV > 1.2× current | A newly discovered plan has expected value more than 20% higher              |
| `external_event`      | any               | An environment event (market shift, agent message, system alert) is relevant |

When a trigger fires, the agent runs `intention_reconsider`, which re-evaluates the intention against current beliefs and desires. The outcome may be: continue, modify (update plan), suspend (pause until conditions improve), or abandon (drop intention and re-deliberate).

---

## 5. Goal System

### 5.1 Three-Tier Hierarchy

Goals are organized in a strict three-tier hierarchy that maps to different planning horizons:

```
Strategic Goals (long-term, 6–24 months)
    ├── "Achieve $100K MRR"
    ├── "Establish market leadership in SMB SaaS segment"
    └── "Build a self-sustaining contractor network"
         │
         ▼
Tactical Goals (medium-term, 1–6 months)
    ├── "Launch enterprise pricing tier"
    ├── "Reduce churn below 3%"
    └── "Hire 3 senior engineers via contractor network"
         │
         ▼
Operational Goals (short-term, days to weeks)
    ├── "Set up Stripe enterprise pricing"
    ├── "Implement automated churn prediction alerts"
    └── "Post contractor brief on Toptal"
```

Each goal tracks:

- `level` — strategic / tactical / operational
- `priority` — inherited from the desire that generated it, plus urgency adjustments
- `desire_id` — the desire this goal serves
- `parent_goal_id` — for tactical/operational goals, the parent they serve
- `status` — pending / active / blocked / achieved / abandoned
- `target` — measurable success condition (e.g., "MRR >= 100000")
- `progress` — percentage complete (0.0–100.0)
- `deadline` — ISO 8601 timestamp
- `success_criteria` — ordered list of verifiable conditions

### 5.2 Goal Lifecycle

The complete goal lifecycle flows as follows:

```
desire_create
     │
     ▼
goal_create ──────────────────────────────────────────┐
     │                                                 │
     ▼                                                 │
htn_decompose  (compound task → sub-tasks)            │
     │                                                 │
     ▼                                                 │
plan_generate  (CBR retrieval + plan library search)  │
     │                                                 │
     ▼                                                 │
intention_commit  (select commitment strategy)         │
     │                                                 │
     ▼                                                 │
plan_execute_step  (tool invocations)                  │
     │              │                                  │
     │     [decision point]──────────────── branch ───┘
     │
     ▼
cbr_store  (situation + solution + outcome)
     │
     ▼
[goal achieved / abandoned / revised]
```

### 5.3 Goal Evaluation

The `goal_evaluate` tool cross-references a goal's state against:

- **Current beliefs** — are the preconditions still valid?
- **Active intentions** — is there a committed intention making progress?
- **Blockers** — are there belief-based or resource-based blockers?
- **Progress delta** — has progress advanced since the last evaluation?
- **Plan fit** — does the current plan still fit the situation?

Evaluation output: `achievable` (boolean), `progress_assessment` (text), `blockers` (list), `recommendation` (continue / revise / escalate / abandon).

---

## 6. Desire Management

### 6.1 Priority Formula

Desire priority is computed dynamically at each deliberation phase:

```
priority = (base × 0.30) + (importance × 0.25) + (urgency × 0.25) + (alignment × 0.15) + (deps × 0.05)
```

All input dimensions are normalized to [0.0, 1.0]. The output priority is also [0.0, 1.0].

**Dimension guidance:**

| Dimension    | Weight | How to set                                                               |
| ------------ | ------ | ------------------------------------------------------------------------ |
| `base`       | 0.30   | Intrinsic worth of the desire to the agent's identity/mission            |
| `importance` | 0.25   | Business impact if fulfilled (revenue, risk, compliance)                 |
| `urgency`    | 0.25   | Time pressure — does delay cause disproportionate harm?                  |
| `alignment`  | 0.15   | Degree to which this desire supports the agent's strategic direction     |
| `deps`       | 0.05   | Average dependency satisfaction (0 = all deps blocked, 1 = all deps met) |

### 6.2 Desire Adoption Rules

A new desire is adopted if:

1. It does not contradict an existing high-certainty belief
2. It is not already subsumed by an existing desire with the same or higher priority
3. It passes the conflict resolution check (see below)

### 6.3 Conflict Resolution

When two desires conflict (i.e., achieving one makes the other unachievable, or they compete for the same resource), the resolution strategy is selected by context:

| Strategy            | When Used                                       | Behavior                                            |
| ------------------- | ----------------------------------------------- | --------------------------------------------------- |
| Priority-based      | Desires require the same resource               | Higher priority desire proceeds; lower is suspended |
| Resource-sharing    | Resource is divisible                           | Both proceed with proportionally reduced allocation |
| Temporal-scheduling | Desires are time-sensitive but not simultaneous | Schedule by urgency; lower urgency desire waits     |

### 6.4 Desire Termination

A desire is dropped (`desire_drop`) when:

- The desire is **achieved** — the target state has been reached (belief confirms it)
- The desire is **infeasible** — no plan exists and belief update shows the goal is unreachable
- The desire is **superseded** — a higher-order desire now subsumes it
- The desire is **terminal and abandoned** — stakeholder or agent explicitly cancels it
- The desire is **instrumental and its terminal is gone** — the terminal desire it served has been dropped

When a desire is dropped, all goals generated from it are reviewed: goals in progress are either re-linked to a surviving desire or moved to `abandoned` status.

### 6.5 The Desire-Goal-Intention Chain

```
DESIRE (motivation) ──generates──▶ GOAL (objective) ──generates──▶ INTENTION (committed plan)
    │                                    │                                    │
    │ priority formula                   │ 3-tier level                       │ commitment strategy
    │ conflict resolution                │ progress tracking                  │ reconsideration triggers
    │ terminal/instrumental              │ deadline                           │ stall detection
    └────────────────────────────────────┴────────────────────────────────────┘
                                  (BDI cognitive chain)
```

---

## 7. Planning System

### 7.1 HTN Decomposition

Hierarchical Task Network (HTN) decomposition is the primary planning mechanism. The planner receives a goal and recursively decomposes it into tasks:

```
Goal: "Launch enterprise pricing tier"
  │
  ├── CompoundTask: "Configure billing infrastructure"
  │     ├── PrimitiveTask: stripe_create_product(name="Enterprise", ...)
  │     ├── PrimitiveTask: stripe_create_price(amount=99900, interval="month", ...)
  │     └── PrimitiveTask: fact_assert(S="enterprise_plan", P="status", O="active")
  │
  ├── CompoundTask: "Update marketing materials"
  │     ├── PrimitiveTask: content_generate(type="pricing_page", tier="enterprise")
  │     ├── PrimitiveTask: email_send(template="enterprise_launch", list="prospects")
  │     └── PrimitiveTask: crm_tag_contacts(tag="enterprise_prospect")
  │
  └── CompoundTask: "Set up sales workflow"
        ├── PrimitiveTask: workflow_create(name="Enterprise Sales", ...)
        ├── PrimitiveTask: bpmn_add_node(type="task", label="Demo Call")
        └── PrimitiveTask: bpmn_connect(from="Demo Call", to="Proposal")
```

**Primitive tasks** are leaf nodes that map directly to tool invocations. They are directly executable and have no sub-tasks.

**Compound tasks** have method libraries — multiple alternative decompositions. The planner selects the decomposition method that best fits current beliefs and available resources.

Each HTN node carries:

- `task_id` — unique identifier
- `type` — compound or primitive
- `tool` (primitive only) — tool name and input schema
- `preconditions` — belief conditions that must hold before execution
- `effects` — expected belief changes after execution
- `ordering` — sequence / parallel / choice

### 7.2 Plan Library

The plan library stores domain-specific plan templates. Templates are parameterized and retrieved by goal type, business domain, and agent role.

Built-in template categories:

- **SaaS operations**: `saas_launch_product`, `saas_reduce_churn`, `saas_upsell_campaign`
- **Financial**: `cash_flow_analysis`, `budget_revision`, `fundraising_prep`
- **Marketing**: `content_calendar_setup`, `paid_acquisition_launch`, `SEO_audit`
- **Hiring**: `contractor_brief_post`, `contractor_onboarding`, `performance_review`
- **Legal**: `contract_review`, `compliance_audit`, `ip_registration`

Templates are retrieved by `plan_library_search` using semantic similarity against the goal description and current agent role.

### 7.3 Case-Based Reasoning (CBR) Adaptation

When the plan library does not yield a direct match, the CBR engine retrieves the most similar past case and adapts it:

**Retrieval formula:**

```
S(B, D) = F(Sb ∩ Sd)

Where:
  Sb = similarity of situation beliefs to case beliefs (weight: 0.60)
  Sd = similarity of current desires to case desires (weight: 0.40)
  F  = aggregation function (weighted harmonic mean)
```

**Adaptation operations:**

| Operation              | Description                                                         |
| ---------------------- | ------------------------------------------------------------------- |
| Parameter substitution | Replace entity references (e.g., swap "Stripe" for "Paddle")        |
| Step insertion         | Add steps absent from the past case but required by current context |
| Step deletion          | Remove steps irrelevant to the current situation                    |
| Constraint relaxation  | Loosen deadlines or budget caps if resources differ                 |
| Constraint tightening  | Add stricter constraints required by current compliance rules       |

### 7.4 Negative Case Checking

Before committing to a plan, the planner checks for negative cases — past plan executions whose outcome was `failure` or `partial_failure`. If the current situation is similar to a negative case (similarity > 0.7), the planner:

1. Flags the risk in the plan
2. Attempts to adapt around the failure point
3. If no safe adaptation is found, presents the risk to the agent for deliberation or stakeholder escalation

### 7.5 Step Execution

`plan_execute_step` executes a single primitive task:

1. Validate preconditions against current beliefs
2. Invoke the mapped tool with parameters
3. Capture the result
4. Update beliefs with the effects
5. Advance the plan's `current_step` pointer
6. If a decision point is reached, evaluate the branch condition and select the next step
7. Return result to the BDI cycle for the LEARN phase

---

## 8. SBVR Ontology

### 8.1 What SBVR Provides

SBVR (Semantics of Business Vocabulary and Rules, OMG standard) provides a formal, natural-language-friendly vocabulary for describing business domains. In MABOS, SBVR grounds every agent's beliefs and reasoning in a shared, precise vocabulary. This prevents agents from using the same term to mean different things and enables cross-agent semantic interoperability.

The MABOS SBVR implementation contains:

| Element                                    | Count |
| ------------------------------------------ | ----- |
| Business concepts (classes)                | 170   |
| Fact types (relationships)                 | 131   |
| Business rules (constraints + obligations) | 8     |

### 8.2 Domain Ontologies

Ten domain ontologies are stored as JSON-LD/OWL files in `workspace/ontologies/`:

| Domain        | File                   | Scope                                                       |
| ------------- | ---------------------- | ----------------------------------------------------------- |
| MABOS Upper   | `mabos-upper.jsonld`   | Agent, Belief, Goal, Plan — the BDI meta-model itself       |
| Business Core | `business-core.jsonld` | Revenue, Cost, Profit, Market — universal business concepts |
| E-commerce    | `ecommerce.jsonld`     | Product, Cart, Order, Fulfillment, Return, Inventory        |
| SaaS          | `saas.jsonld`          | Subscription, Plan, Tier, MRR, ARR, Churn, Trial            |
| Consulting    | `consulting.jsonld`    | Engagement, Deliverable, Milestone, SOW, Retainer           |
| Marketplace   | `marketplace.jsonld`   | Listing, Seller, Buyer, Commission, Dispute                 |
| Retail        | `retail.jsonld`        | Store, POS, Inventory, Supplier, Shelf                      |
| Cross-Domain  | `cross-domain.jsonld`  | Shared relationships spanning multiple domain ontologies    |
| Shapes        | `shapes.jsonld`        | SHACL shapes for RDF graph validation                       |
| Shapes-SBVR   | `shapes-sbvr.jsonld`   | SBVR-specific validation shapes                             |

### 8.3 JSON-LD / OWL Format

All ontologies use JSON-LD with OWL semantics. Example class definition:

```json
{
  "@context": {
    "owl": "http://www.w3.org/2002/07/owl#",
    "rdfs": "http://www.w3.org/2000/01/rdf-schema#",
    "mabos": "http://mabos.ai/ontology/"
  },
  "@graph": [
    {
      "@id": "mabos:Customer",
      "@type": "owl:Class",
      "rdfs:label": "Customer",
      "rdfs:subClassOf": { "@id": "mabos:BusinessEntity" },
      "mabos:sbvr_definition": "A person or organization that purchases goods or services",
      "mabos:sbvr_synonyms": ["Client", "Buyer", "Account"]
    },
    {
      "@id": "mabos:buysProduct",
      "@type": "owl:ObjectProperty",
      "rdfs:domain": { "@id": "mabos:Customer" },
      "rdfs:range": { "@id": "mabos:Product" },
      "rdfs:label": "buys",
      "mabos:sbvr_fact_type": "Customer buys Product"
    }
  ]
}
```

Key ontology conventions:

- Classes use **PascalCase** (e.g., `BusinessEntity`, `SubscriptionPlan`)
- Properties use **camelCase** (e.g., `hasRevenue`, `buysProduct`)
- Every class must have a `mabos:sbvr_definition` (the formal SBVR definition)
- Every class must declare its `rdfs:subClassOf` up to a root in the upper ontology

### 8.4 Ontology Management Pipeline

The knowledge agent manages ontology evolution through a gated pipeline:

```
ontology_propose_concept
         │
         ▼
ontology_validate_proposal
    ├── Duplicate detection (Levenshtein distance < 3 from existing concepts)
    ├── Naming convention check (PascalCase for classes, camelCase for properties)
    ├── Parent class validity (must exist in an active ontology)
    ├── SBVR definition required (must be non-empty, natural language)
    └── Domain assignment (must map to an existing domain file)
         │
         ▼ (if valid)
[Proposal staged for review]
         │
         ▼
ontology_merge_approved
    ├── Append to target domain JSON-LD file
    ├── Re-index SQLite ontology tables
    ├── Trigger TypeDB schema sync (if TypeDB enabled)
    └── Notify Knowledge agent via ACL INFORM message
```

**Domain scaffolding** — `ontology_scaffold_domain` generates a complete domain ontology skeleton from a template (saas, ecommerce, consulting, agency). The scaffold includes:

- 15–30 core classes for the domain
- 20–40 object properties
- 5–10 SBVR business rules
- Matching SHACL shapes file

---

## 9. Multi-Agent Coordination

### 9.1 Agent Roles

When a business is created, 9 agents are provisioned with role-appropriate cognitive files:

| Role      | ID          | Primary Responsibilities                                              |
| --------- | ----------- | --------------------------------------------------------------------- |
| CEO       | `ceo`       | Overall strategy, vision, inter-agent coordination, final arbitration |
| CFO       | `cfo`       | Financial planning, budgeting, cash flow, investor reporting          |
| COO       | `coo`       | Daily operations, process optimization, resource allocation           |
| CMO       | `cmo`       | Marketing strategy, brand identity, customer acquisition              |
| CTO       | `cto`       | Technology strategy, architecture decisions, technical execution      |
| HR        | `hr`        | Freelancer/contractor relationships, talent pool management           |
| Legal     | `legal`     | Contracts, compliance, IP protection, regulatory monitoring           |
| Strategy  | `strategy`  | Market analysis, competitive intelligence, strategic planning         |
| Knowledge | `knowledge` | Ontology maintenance, case bases, organizational learning             |

Each agent's `Persona.md` defines: reporting lines (who it reports to, who reports to it), autonomy level (decisions it can make without escalation), communication style, and domain expertise.

### 9.2 ACL Messaging

Agents communicate via Agent Communication Language (ACL) messages stored as JSON in each agent's `inbox.json`:

**Performatives (speech act types):**

| Performative | Purpose                                                    |
| ------------ | ---------------------------------------------------------- |
| `REQUEST`    | Ask another agent to perform an action                     |
| `INFORM`     | Share a piece of information (updates recipient's beliefs) |
| `QUERY`      | Request information (triggers belief retrieval)            |
| `PROPOSE`    | Submit a proposal for consideration                        |
| `ACCEPT`     | Accept a proposal                                          |
| `REJECT`     | Decline a proposal (should include reason)                 |
| `CONFIRM`    | Confirm receipt or understanding                           |
| `CANCEL`     | Withdraw a previous REQUEST                                |

**Message structure:**

```typescript
interface ACLMessage {
  id: string; // "MSG-{timestamp}-{nonce}"
  from: string; // Sender agent ID (e.g., "ceo")
  to: string; // Recipient agent ID (e.g., "cfo")
  performative: string; // One of the performatives above
  content: string; // Natural language message body
  reply_to?: string; // ID of message being replied to (for threading)
  priority: "low" | "normal" | "high" | "urgent";
  timestamp: string; // ISO 8601
  read: boolean; // Has recipient processed this message?
  metadata?: Record<string, unknown>; // Domain-specific structured data
}
```

**Sending a message** (`agent_message` tool):

1. Sender writes message to recipient's `inbox.json`
2. If `priority = "urgent"`, the recipient's BDI cycle is triggered immediately
3. Recipient reads message during PERCEIVE phase
4. INFORM performatives update beliefs; QUERY performatives trigger belief lookup and an INFORM reply

### 9.3 Contract Net Protocol

The Contract Net Protocol enables decentralized task allocation among agents. It follows the FIPA Contract Net Interaction Protocol.

**Flow:**

```
Initiating Agent               Candidate Agents
       │                              │
       │── CFP (task, criteria) ─────▶│
       │                              │
       │◀── PROPOSE (bid A) ─────────│ (Agent A)
       │◀── PROPOSE (bid B) ─────────│ (Agent B)
       │◀── REFUSE ──────────────────│ (Agent C: cannot do it)
       │                              │
       │   [evaluate proposals]       │
       │                              │
       │── ACCEPT (winner: Agent A) ─▶│ (Agent A: gets the task)
       │── REJECT (Agent B) ──────────▶│ (Agent B: notified)
       │                              │
       │◀── INFORM (result) ─────────│ (Agent A: reports on completion)
```

**CFP (Call for Proposals)** includes:

- `task_description` — what needs to be done
- `evaluation_criteria` — how bids will be scored (cost, duration, confidence, approach)
- `deadline` — when proposals are due
- `task_constraints` — mandatory requirements

**Proposal** includes:

- `approach` — how the agent plans to do it
- `estimated_cost` — in USD or resource units
- `estimated_duration` — in hours or days
- `confidence` — 0.0–1.0 probability of successful completion
- `rationale` — brief explanation

**Award** selection: the initiator scores proposals using the evaluation criteria and awards to the highest scorer. Ties are broken by confidence score.

---

## 10. Stakeholder Governance

### 10.1 Stakeholder Profile

Every business has a single stakeholder profile (`stakeholder.json`) that governs how the human owner interacts with the agent system:

```json
{
  "approval_threshold_usd": 5000,
  "decision_style": "strategic-only",
  "risk_tolerance": "moderate",
  "report_frequency": "weekly",
  "auto_approve_categories": ["marketing_spend_under_500", "contractor_invoices_under_1000"],
  "notification_channels": ["email", "slack"],
  "escalation_contacts": [{ "name": "Jane Smith", "email": "jane@company.com", "role": "owner" }]
}
```

**Decision styles:**

- `hands-on` — owner wants to approve most decisions, even below threshold
- `strategic-only` — owner only reviews major strategic decisions
- `exception-based` — owner only sees decisions that fall outside auto-approve rules

**Risk tolerance:**

- `conservative` — agents prefer lower-risk options; escalate on any uncertainty
- `moderate` — agents balance risk and reward; escalate on high-impact uncertainty
- `aggressive` — agents bias toward higher-upside options; escalate only on existential risks

### 10.2 Decision Queue

When an agent determines that a pending action requires stakeholder approval, it posts to the decision queue (`decision-queue.json`):

```json
{
  "id": "DEC-20260224-001",
  "from_agent": "cfo",
  "subject": "Approve $12,000 annual contract with Salesforce",
  "description": "CFO recommends signing a Salesforce CRM contract at $12,000/year to support enterprise sales pipeline. This exceeds the $5,000 auto-approve threshold.",
  "options": [
    { "id": "A", "label": "Approve", "impact": "+$450K projected ARR in 12 months" },
    { "id": "B", "label": "Negotiate down", "impact": "Delay 2 weeks; possible 10% discount" },
    {
      "id": "C",
      "label": "Reject and use alternative",
      "impact": "Use HubSpot at $6,000/year; less enterprise-ready"
    }
  ],
  "recommendation": "A",
  "deadline": "2026-03-01T00:00:00Z",
  "status": "pending",
  "created_at": "2026-02-24T09:00:00Z"
}
```

### 10.3 Decision Resolution

The stakeholder resolves decisions using `decision_resolve`:

| Resolution | Outcome                                                             |
| ---------- | ------------------------------------------------------------------- |
| `approve`  | Agent proceeds with the recommended or stakeholder-specified option |
| `reject`   | Agent abandons the intention; logs the rejection in Learnings.md    |
| `defer`    | Decision is postponed; a reminder is set for a future date          |
| `modify`   | Stakeholder provides modified parameters (e.g., lower budget cap)   |

### 10.4 Governance Check

Before executing any high-impact action, agents run `governance_check` to determine whether stakeholder approval is needed. The check evaluates:

1. Estimated action cost vs. `approval_threshold_usd`
2. Whether the action category is in `auto_approve_categories`
3. The agent's configured autonomy level for this action type
4. The stakeholder's `decision_style`

If approval is needed, execution pauses and a decision is queued.

---

## 11. Workforce Management

### 11.1 Contractor Pool

The HR agent maintains a talent registry of human freelancers and contractors (`contractor-pool.json`):

```json
{
  "id": "CONT-001",
  "name": "Alex Rivera",
  "skills": ["React", "TypeScript", "UI/UX Design"],
  "hourly_rate_usd": 95,
  "availability": "part-time",
  "trust_score": 0.82,
  "completed_packages": 7,
  "active_packages": 1,
  "preferred_contact": "email",
  "timezone": "America/New_York"
}
```

Contractors are retrieved by the HR agent using `contractor_list` with skill and availability filters, then matched to work packages using a scoring function:

```
match_score = skill_overlap × 0.5 + trust_score × 0.3 + rate_fit × 0.2
```

### 11.2 Trust Scoring

Trust scores are maintained on a [0.0, 1.0] scale and updated after each work package completion:

```
new_trust = old_trust + (quality_score - 0.5) × 0.2

Where quality_score ∈ [0.0, 1.0]:
  - 0.9–1.0: Exceptional delivery (on-time, over-spec)
  - 0.7–0.89: Good delivery (on-time, meets spec)
  - 0.5–0.69: Acceptable (minor issues resolved)
  - 0.3–0.49: Substandard (late or partial)
  - 0.0–0.29: Failed delivery
```

Trust scores are capped at [0.0, 1.0]. Contractors whose trust score falls below 0.4 are flagged and require HR agent review before further assignment.

### 11.3 Work Packages

Work packages are scoped deliverables assigned to contractors:

```json
{
  "id": "WP-001",
  "title": "Build enterprise onboarding flow",
  "description": "Create a multi-step onboarding wizard for enterprise customers with SSO setup and team invitation features.",
  "required_skills": ["React", "TypeScript"],
  "budget_usd": 3500,
  "deadline": "2026-03-15T00:00:00Z",
  "status": "assigned",
  "assigned_to": "CONT-001",
  "goal_id": "GOAL-CTO-007",
  "deliverables": [
    "Onboarding wizard component (Storybook stories included)",
    "SSO configuration guide",
    "API integration tests"
  ]
}
```

Work package lifecycle:

```
work_package_create → work_package_assign → [contractor works] → work_package_update (status: complete) → contractor_trust_update
```

### 11.4 Handoff Protocol

When control transfers between an agent and a human contractor (or vice versa), a formal handoff is recorded in `handoff-log.json`:

```json
{
  "id": "HO-001",
  "from": "cto",
  "to": "CONT-001",
  "work_package_id": "WP-001",
  "handoff_type": "agent_to_human",
  "artifacts": [
    { "type": "spec", "path": "specs/enterprise-onboarding.md" },
    { "type": "design", "path": "designs/figma-link.txt" }
  ],
  "instructions": "Start with the SSO module. Use Okta as the primary provider. Refer to the API docs in the spec.",
  "context_summary": "This work package is part of the enterprise launch goal (GOAL-CTO-007). The deadline is firm due to a committed customer pilot starting March 16.",
  "created_at": "2026-02-24T10:00:00Z"
}
```

---

## 12. Knowledge Management

For a complete deep-dive into the memory and knowledge management implementation, see the companion document:

**[Memory & Knowledge Management Architecture Guide](./2026-02-24-memory-system-architecture.md)**

This section provides a high-level overview of all knowledge management components.

### 12.1 Fact Store (SPO Triples)

The fact store is the agent's structured knowledge base, implemented as Subject-Predicate-Object (SPO) triples:

```
Subject          Predicate           Object              Confidence  Valid Until
───────────────────────────────────────────────────────────────────────────────
"enterprise_plan" "status"           "active"            0.99        null (permanent)
"mrr"            "current_value_usd" "42000"             0.95        "2026-03-01"
"churn_rate"     "value_percent"     "4.2"               0.90        "2026-03-01"
"competitor_A"   "pricing_tier"      "enterprise_only"   0.75        "2026-06-01"
```

**Four core tools:**

| Tool           | Description                                                             |
| -------------- | ----------------------------------------------------------------------- |
| `fact_assert`  | Add or update a triple with confidence and optional temporal validity   |
| `fact_retract` | Remove a triple (or set its confidence to 0)                            |
| `fact_query`   | Retrieve triples matching a subject/predicate/object pattern            |
| `fact_explain` | Trace the derivation chain for a derived fact (why do we believe this?) |

Facts have derivation chains — if a fact is derived by a rule, `fact_explain` returns the rule ID, the input facts, and the confidence propagation calculation.

### 12.2 Rule Engine

The rule engine operates on fact triples and supports three rule types:

**Inference rules** — derive new facts from existing ones:

```
IF  ?customer has_status "enterprise"
AND ?customer subscription_value_usd > 10000
THEN ?customer is_strategic_account = true  [confidence: 0.9 × min(input confidences)]
```

**Constraint rules** — flag violations:

```
IF  cash_runway months < 3
THEN ALERT "Critical: Cash runway below 3 months"  [severity: critical]
```

**Policy rules** — trigger agent actions:

```
IF  churn_rate percent > 5
THEN REQUEST cmo "Initiate churn reduction campaign"
```

Variable binding uses `?variable` syntax. Rules are stored in `rules.json` and can be enabled/disabled individually with `rule_toggle`.

### 12.3 Inference Engine

Three reasoning modes are supported:

**Forward chaining** (`infer_forward`):

- Apply all enabled inference rules iteratively
- Continue until no new facts are derived (fixed-point)
- Best for proactive knowledge expansion

**Backward chaining** (`infer_backward`):

- Start from a target fact and work backward to find supporting evidence
- Identify knowledge gaps (facts needed but not present)
- Best for goal-directed reasoning and explainability

**Abductive reasoning** (`infer_abductive`):

- Given an observation, generate the most plausible explanations (hypotheses)
- Rank hypotheses by prior probability × likelihood
- Best for root cause analysis and anomaly explanation

### 12.4 Case-Based Reasoning (CBR)

The CBR engine stores and retrieves decision cases:

```json
{
  "id": "CASE-001",
  "situation": {
    "beliefs": { "mrr": 42000, "churn_rate": 4.2, "runway_months": 8 },
    "desires": { "reduce_churn": 0.85, "grow_mrr": 0.9 }
  },
  "solution": {
    "plan_id": "PLAN-007",
    "plan_summary": "Launched customer success program with 3 dedicated CSMs"
  },
  "outcome": {
    "status": "success",
    "churn_rate_after": 2.8,
    "mrr_after": 47000,
    "duration_days": 45
  },
  "stored_at": "2026-01-15T00:00:00Z",
  "agent_id": "cmo"
}
```

- Maximum 10,000 cases per agent
- Cases exceeding the limit are pruned by age and outcome quality (keep successes, keep recent failures)
- CBR retrieval uses the `S(B,D) = F(Sb ∩ Sd)` formula (60% beliefs, 40% desires)

### 12.5 Reasoning Engine

The reasoning engine provides 35 named reasoning methods across 6 categories, invoked via the `reason` tool:

**Formal reasoning (7 methods):**
`deductive`, `inductive`, `abductive`, `analogical`, `modal`, `deontic`, `temporal`

**Probabilistic reasoning (5 methods):**
`bayesian`, `decision-theory`, `expected-utility`, `info-theory`, `monte-carlo`

**Causal reasoning (5 methods):**
`causal`, `counterfactual`, `interventional`, `root-cause`, `systems-thinking`

**Experience-based reasoning (5 methods):**
`heuristic`, `case-based`, `pattern-recognition`, `satisficing`, `naturalistic`

**Social reasoning (5 methods):**
`game-theory`, `negotiation`, `social-choice`, `argumentation`, `stakeholder`

**Meta-reasoning (8 methods):**
`meta-cognitive`, `strategy-selection`, `learning-to-reason`, `reflection`, `calibration`, (+ 3 fusion methods)

**Meta-reasoning router** auto-selects the appropriate method(s) based on problem classification:

| Classification Dimension | High Value → Method                 |
| ------------------------ | ----------------------------------- |
| `uncertainty`            | Bayesian, Monte Carlo               |
| `complexity`             | Systems thinking, HTN decomposition |
| `domain`                 | Domain-specific heuristics          |
| `time_pressure`          | Satisficing, naturalistic           |
| `data_availability`      | Inductive, pattern-recognition      |
| `stakes`                 | Decision theory, expected utility   |

**Multi-method fusion**: When a problem benefits from multiple methods, the router runs them in parallel and synthesizes their outputs using a weighted ensemble.

---

## 13. Memory System

The MABOS memory system uses a Recursive Layer Memory (RLM) architecture with five enhancement layers (R1–R5) built on top of a three-store model.

For complete implementation details, see: **[Memory & Knowledge Management Architecture Guide](./2026-02-24-memory-system-architecture.md)**

### 13.1 Three-Store Model

| Store      | Capacity  | TTL       | Purpose                                      |
| ---------- | --------- | --------- | -------------------------------------------- |
| Working    | 7 items   | Session   | Active reasoning context (Miller's Law)      |
| Short-term | 200 items | 2 hours   | Recent observations and intermediate results |
| Long-term  | Unlimited | Permanent | Consolidated, summarized, indexed knowledge  |

### 13.2 RLM Enhancement Layers

| Layer | Name                       | Description                                                                                                          |
| ----- | -------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| R1    | Recursive Consolidation    | Groups related short-term memories by Jaccard similarity, summarizes each group into a single long-term entry        |
| R2    | Hierarchical Index         | Organizes long-term memories into time-based summaries: daily → weekly → monthly → quarterly                         |
| R3    | Pre-Compaction Checkpoints | Snapshots structured session state before memory compaction to prevent context loss                                  |
| R4    | Recursive Search           | Multi-pass query refinement: if initial search yields < threshold results, reformulates query and retries (depth: 3) |
| R5    | BDI Recursive Reasoning    | Processes large belief bases in 50-section chunks; detects belief conflicts across chunks                            |

### 13.3 Hybrid Search

Memory retrieval uses a hybrid of two signals:

```
final_score = (BM25_score × 0.3) + (cosine_similarity × 0.7)
```

- **BM25** (FTS5): Sparse keyword matching, good for precise term lookup
- **Cosine similarity** (sqlite-vec): Dense vector similarity, good for semantic retrieval

---

## 14. BPMN 2.0 Workflow Management

Agents can model, validate, and execute business processes using BPMN 2.0 notation. Workflows are linked to goals, enabling traceable process-to-objective mapping.

### 14.1 BPMN Elements

| Element     | Types                                                       | Description                                 |
| ----------- | ----------------------------------------------------------- | ------------------------------------------- |
| Events      | `startEvent`, `endEvent`, `intermediateEvent`               | Process start/end and intermediate triggers |
| Tasks       | `userTask`, `serviceTask`, `scriptTask`, `businessRuleTask` | Work items of different automation levels   |
| Gateways    | `exclusiveGateway`, `parallelGateway`, `inclusiveGateway`   | Flow control and branching                  |
| Containers  | `subProcess`, `lane`, `pool`                                | Grouping and responsibility assignment      |
| Connections | `sequenceFlow`, `messageFlow`, `dataAssociation`            | Element relationships                       |

### 14.2 Workflow Tool Set

| Tool                | Description                                                                             |
| ------------------- | --------------------------------------------------------------------------------------- |
| `workflow_create`   | Create a new BPMN workflow definition                                                   |
| `workflow_delete`   | Remove a workflow                                                                       |
| `workflow_status`   | Get current execution status                                                            |
| `workflow_inspect`  | Return the full workflow definition                                                     |
| `workflow_validate` | Check for structural errors (orphan nodes, missing connections, unreachable end events) |
| `bpmn_add_node`     | Add a BPMN element (task, gateway, event)                                               |
| `bpmn_remove_node`  | Remove an element and its connections                                                   |
| `bpmn_connect`      | Add a sequence flow between two elements                                                |
| `bpmn_add_lane`     | Add a swimlane for agent-role assignment                                                |

### 14.3 Workflow Validation

`workflow_validate` checks for:

- **Orphan nodes** — elements with no incoming or outgoing connections
- **Dead ends** — paths that never reach an end event
- **Unreachable nodes** — elements that cannot be reached from the start event
- **Gateway mismatches** — parallel gateways without matching convergence points
- **Lane assignment gaps** — tasks without an assigned responsible agent

### 14.4 Workflow-Goal Linking

Every workflow can be linked to one or more goals. This creates a traceable mapping:

```
Goal (strategic/tactical/operational)
  └──▶ BPMN Workflow
         └──▶ Task (mapped to agent + tool)
                └──▶ Plan step execution
```

This enables `goal_evaluate` to assess workflow progress as part of goal progress tracking.

---

## 15. TypeDB Knowledge Graph

TypeDB provides optional graph-based knowledge storage enabling multi-hop relation traversal that is difficult to express in flat SPO triples.

### 15.1 Integration Pattern

TypeDB uses a **write-through** pattern:

```
Agent writes fact
       │
       ├──▶ facts.json (primary — always written)
       │
       └──▶ TypeDB database (secondary — written asynchronously)
              └── If TypeDB unavailable, continues without error
```

TypeDB data is never the authoritative source. On startup or schema drift, `typedb_sync_data` re-populates TypeDB from the JSON facts.

### 15.2 Schema Generation

TypeDB schemas are auto-generated from SBVR ontologies using a JSON-LD → TypeQL transpiler:

```typeql
# Generated from mabos:Customer (mabos-upper.jsonld)
define
  Customer sub BusinessEntity,
    owns customer-id,
    owns email,
    plays buys-product:buyer;

  buys-product sub relation,
    relates buyer,
    relates product-purchased;
```

### 15.3 TypeDB Tools

| Tool                     | Description                                                           |
| ------------------------ | --------------------------------------------------------------------- |
| `typedb_status`          | Check TypeDB connection and database health                           |
| `typedb_sync_schema`     | Regenerate and push schema from current ontologies                    |
| `typedb_query`           | Execute a TypeQL read query and return results                        |
| `typedb_sync_agent_data` | Push all agent facts to TypeDB                                        |
| `goal_seed_business`     | Seed TypeDB with initial business entity graph from business manifest |

### 15.4 Database Naming

Each business gets its own TypeDB database: `mabos_{business_id}`

This ensures complete isolation between businesses and enables per-business schema customization.

### 15.5 Multi-Hop Query Example

TypeDB enables queries that would require multiple fact lookups in the SPO store:

```typeql
# Find all customers of a strategic account who have churn risk
match
  $account isa Customer, has is-strategic-account true;
  $subscription (subscriber: $account) isa Subscription;
  $subscription has churn-probability > 0.7;
  $contact (account: $account) isa Contact;
fetch $contact: email, name;
```

---

## 16. Tool Catalog

All 99 tools across 21 modules, registered via the OpenClaw Plugin SDK:

| Module                        | Tools                                                                                                                                                                  | Key Capabilities                                                    |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| **BDI Core**                  | `belief_get`, `belief_update`, `goal_create`, `goal_evaluate`, `intention_commit`, `bdi_cycle`                                                                         | Cognitive state management — the core BDI loop                      |
| **Desires**                   | `desire_create`, `desire_evaluate`, `desire_drop`, `intention_reconsider`                                                                                              | Priority formula computation, conflict resolution, desire lifecycle |
| **Planning**                  | `plan_generate`, `plan_execute_step`, `htn_decompose`, `plan_library_search`, `plan_adapt`                                                                             | HTN planning, plan library retrieval, CBR-based adaptation          |
| **Memory**                    | `memory_store_item`, `memory_recall`, `memory_consolidate`, `memory_checkpoint`, `memory_status`                                                                       | RLM-enhanced three-store memory management                          |
| **Memory Hierarchy**          | `memory_build_hierarchy`, `memory_hierarchy_search`                                                                                                                    | Time-based hierarchical memory summaries                            |
| **Facts**                     | `fact_assert`, `fact_retract`, `fact_query`, `fact_explain`                                                                                                            | SPO triple management with derivation chains                        |
| **Rules**                     | `rule_create`, `rule_list`, `rule_toggle`, `constraint_check`, `policy_eval`                                                                                           | Inference rules, constraint checking, policy evaluation             |
| **Inference**                 | `infer_forward`, `infer_backward`, `infer_abductive`, `knowledge_explain`                                                                                              | Forward/backward/abductive reasoning over the fact store            |
| **CBR**                       | `cbr_retrieve`, `cbr_store`                                                                                                                                            | Case-based decision support — retrieve and store cases              |
| **Knowledge**                 | `ontology_query`, `knowledge_infer`, `rule_evaluate`                                                                                                                   | Ontology querying and knowledge-based inference                     |
| **Ontology Mgmt**             | `ontology_propose_concept`, `ontology_validate_proposal`, `ontology_merge_approved`, `ontology_list_proposals`, `ontology_scaffold_domain`                             | Ontology evolution, concept proposal, validation and merging        |
| **Reasoning**                 | `reason` (35 sub-methods)                                                                                                                                              | Meta-reasoning router, multi-method fusion across all 35 methods    |
| **Communication**             | `agent_message`, `decision_request`, `contract_net_initiate`, `contract_net_propose`, `contract_net_award`                                                             | ACL messaging and Contract Net Protocol                             |
| **Stakeholder**               | `stakeholder_profile`, `decision_review`, `decision_resolve`, `governance_check`                                                                                       | Human governance — decision queue and approval workflow             |
| **Workforce**                 | `contractor_add`, `contractor_list`, `contractor_trust_update`, `work_package_create`, `work_package_assign`, `work_package_update`, `work_package_list`, `handoff`    | Human-AI workforce management                                       |
| **Workflows**                 | `workflow_create`, `workflow_delete`, `workflow_status`, `workflow_inspect`, `workflow_validate`, `bpmn_add_node`, `bpmn_remove_node`, `bpmn_connect`, `bpmn_add_lane` | BPMN 2.0 process modeling and execution                             |
| **TypeDB**                    | `typedb_status`, `typedb_sync_schema`, `typedb_query`, `typedb_sync_agent_data`, `goal_seed_business`                                                                  | TypeDB knowledge graph management                                   |
| **Business**                  | `business_create`, `business_list`, `business_status`                                                                                                                  | Business venture provisioning and status                            |
| **Marketing**                 | (various)                                                                                                                                                              | Campaign management, content strategy, paid acquisition             |
| **CRM**                       | (various)                                                                                                                                                              | Customer relationship management, contact and pipeline tracking     |
| **Email**                     | (various)                                                                                                                                                              | Email composition, template management, bulk sending                |
| **SEO Analytics**             | (various)                                                                                                                                                              | Search engine optimization and web analytics                        |
| **Metrics / Reporting**       | (various)                                                                                                                                                              | KPI tracking, dashboards, business intelligence reports             |
| **Integration**               | (various)                                                                                                                                                              | Third-party API integrations (Stripe, HubSpot, Slack, etc.)         |
| **Onboarding / Setup Wizard** | (various)                                                                                                                                                              | Guided business setup, agent initialization and configuration       |

---

## 17. File Layout

The complete workspace directory structure:

```
workspace/
├── businesses/
│   └── {business_id}/
│       ├── business.json              # Business manifest (name, domain, vertical, agents)
│       ├── decision-queue.json        # Pending stakeholder decisions
│       ├── work-packages.json         # Active and completed work packages
│       └── handoff-log.json           # Agent-human handoff records
│
├── agents/
│   └── {agent_id}/                    # One directory per agent (e.g., ceo, cfo, coo...)
│       ├── agent.json                 # Agent manifest (BDI config, role, tools)
│       ├── Persona.md                 # Role definition, reporting lines, style
│       ├── Capabilities.md            # Skills, tool access, proficiency
│       ├── Beliefs.md                 # Epistemic state (certainty, categories, revision log)
│       ├── Desires.md                 # Motivations with computed priorities
│       ├── Goals.md                   # 3-tier objectives with progress tracking
│       ├── Intentions.md              # Committed actions with strategy and progress
│       ├── Plans.md                   # HTN-decomposed plans with steps and risks
│       ├── Commitments.md             # External obligations and contractual commitments
│       ├── Playbooks.md               # Standard operating procedures
│       ├── Knowledge.md               # Agent-specific curated knowledge
│       ├── Learnings.md               # Accumulated lessons and insights
│       ├── Memory.md                  # Human-readable chronological memory log
│       ├── MEMORY.md                  # Native long-term memory store (LLM-readable)
│       ├── memory-store.json          # Three-store model (working/short-term/long-term)
│       ├── facts.json                 # SPO fact store (primary)
│       ├── rules.json                 # Rule engine rules (inference/constraint/policy)
│       ├── cases.json                 # CBR case base (max 10,000 cases)
│       ├── inbox.json                 # ACL message inbox
│       └── memory/                    # Materialized files and hierarchical summaries
│           ├── daily/                 # Daily memory summaries
│           ├── weekly/                # Weekly rollups
│           ├── monthly/              # Monthly rollups
│           ├── quarterly/             # Quarterly rollups
│           └── bdi-conflicts/         # Belief conflict reports (YYYY-MM-DD.md)
│
├── contract-net/                      # Active CFPs and proposals
│   └── {cfp_id}.json
│
├── ontologies/                        # Domain ontologies (JSON-LD/OWL)
│   ├── mabos-upper.jsonld
│   ├── business-core.jsonld
│   ├── ecommerce.jsonld
│   ├── saas.jsonld
│   ├── consulting.jsonld
│   ├── marketplace.jsonld
│   ├── retail.jsonld
│   ├── cross-domain.jsonld
│   ├── shapes.jsonld
│   └── shapes-sbvr.jsonld
│
├── contractor-pool.json               # Freelancer and contractor registry
├── stakeholder.json                   # Governance profile
└── decision-queue.json                # Global decision queue (mirrors per-business)
```

---

## 18. BDI Runtime Service

The BDI Runtime is a background service that maintains the cognitive health of all agents. It runs on a configurable interval (default: 30 minutes) and performs the following maintenance tasks.

### 18.1 Heartbeat Sequence

```
1. Discover all agent directories in workspace/agents/
2. For each agent directory:
   a. Read agent.json (manifest)
   b. Read Intentions.md (committed intentions)
   c. Read Desires.md (current desires)
   d. Read Beliefs.md (current beliefs)
   e. Prune stale intentions
   f. Re-sort desires by priority
   g. Detect belief conflicts
   h. Write maintenance report
3. Sleep until next interval
```

### 18.2 Intention Pruning

For each committed intention, the heartbeat checks:

**Deadline expiry:** If `deadline < now`, the intention is marked `expired` regardless of commitment strategy.

**Stall detection:** If `progress_delta < 0.01` over the stall window:

- `open-minded`: stall window = 7 days → mark `stalled`
- `cautious`: stall window = 3 days → mark `stalled`
- `single-minded`: never mark stalled due to progress

Stalled or expired intentions are removed from `Intentions.md` and the parent goal is re-evaluated. If the goal is still valid, a new intention is generated during the next DELIBERATE phase.

### 18.3 Desire Re-Prioritization

Desires are re-scored using the priority formula against current beliefs. Urgency values are recalculated based on deadline proximity:

```
urgency = 1 - (days_remaining / total_days)
```

Desires are re-sorted in descending priority order and written back to `Desires.md`.

### 18.4 Belief Conflict Detection

Beliefs are compared pairwise within each category. A conflict is flagged when:

- Two beliefs address the same subject and predicate with contradictory values
- Both beliefs have certainty > 0.7 (high-confidence conflict)

Conflicts are written to `memory/bdi-conflicts/YYYY-MM-DD.md`:

```markdown
## Belief Conflict Report — 2026-02-24

### Conflict #1

- **Belief A**: "churn_rate is 3.2%" (certainty: 0.92, source: analytics_api)
- **Belief B**: "churn_rate is 5.8%" (certainty: 0.85, source: crm_export)
- **Category**: environment
- **Resolution**: Belief A wins (higher certainty); Belief B flagged for review
```

### 18.5 Chunked Belief Processing (R5)

For agents with large belief bases (> 50 sections), beliefs are processed in chunks of 50 sections to avoid LLM context overflow. Conflict detection is run within each chunk and across chunk boundaries for high-certainty beliefs.

---

## 19. Implementation Guide

This section describes a phased approach for building the MABOS system from scratch. Each phase is independently deployable and adds meaningful capability.

### Phase 1: Storage and File Foundation (Week 1–2)

**Goal:** Establish the workspace file layout and basic JSON/Markdown I/O.

1. Implement workspace initialization: create `agents/`, `businesses/`, `ontologies/`, `contract-net/` directories
2. Implement agent provisioning: given a role, create the full set of cognitive files with role-appropriate starter content
3. Implement basic CRUD for all JSON stores: `facts.json`, `rules.json`, `cases.json`, `inbox.json`, `memory-store.json`
4. Load domain ontologies from JSON-LD files; build an in-memory concept index
5. Initialize SQLite with FTS5 for full-text search over Markdown files

**Validation:** All 9 agent directories provisioned with correct starter content; ontology concepts queryable by label.

### Phase 2: BDI Cognitive Layer (Week 3–5)

**Goal:** Implement the 5-phase BDI cycle for a single agent.

1. Implement `belief_update` with certainty tracking and revision log
2. Implement `desire_create` with the priority formula (base, importance, urgency, alignment, deps)
3. Implement `goal_create` with 3-tier level assignment and desire linkage
4. Implement HTN decomposition (`htn_decompose`) — compound tasks → sub-tasks → primitive tasks
5. Implement `intention_commit` with strategy selection (single/open/cautious-minded)
6. Implement `plan_execute_step` — primitive task → tool invocation → belief update
7. Implement `cbr_store` and `cbr_retrieve` with `S(B,D)` retrieval formula
8. Wire together into `bdi_cycle` tool

**Validation:** Single agent can complete a full BDI cycle from desire to executed plan to stored case.

### Phase 3: Knowledge Management (Week 6–8)

**Goal:** Implement fact store, rule engine, inference engine, and reasoning engine.

1. Implement `fact_assert`, `fact_retract`, `fact_query` with derivation chain tracking
2. Implement rule parser and executor for inference, constraint, and policy rules
3. Implement `infer_forward` (fixed-point forward chaining)
4. Implement `infer_backward` (goal-directed backward chaining with gap identification)
5. Implement `infer_abductive` (hypothesis generation and ranking)
6. Implement the `reason` tool router with at least 10 core reasoning methods
7. Implement CBR adaptation (parameter substitution, step insertion/deletion, constraint modification)

**Validation:** Given a set of seed facts and rules, the inference engine correctly derives new facts and the rule engine correctly flags constraint violations.

### Phase 4: Memory System (Week 9–10)

**Goal:** Implement the RLM-enhanced three-store memory model.

1. Implement three-store model: working (7 items, FIFO eviction to short-term), short-term (200 items, 2hr TTL → eviction to long-term), long-term (permanent)
2. Implement R1: Jaccard similarity grouping + LLM summarization for consolidation
3. Implement R2: hierarchical index builder (daily/weekly/monthly/quarterly rollups)
4. Implement R3: pre-compaction checkpoints
5. Implement R4: recursive search (query → results → if insufficient, reformulate → retry, depth 3)
6. Implement R5: chunked belief processing and cross-chunk conflict detection
7. Implement hybrid search: FTS5 BM25 (weight 0.3) + sqlite-vec cosine (weight 0.7)

**Validation:** Memory items correctly migrate across stores; hybrid search returns semantically relevant results; hierarchical rollups contain coherent summaries.

### Phase 5: Multi-Agent Coordination (Week 11–12)

**Goal:** Enable ACL messaging and Contract Net Protocol across all 9 agents.

1. Implement `agent_message` with inbox write and priority-triggered cycle
2. Implement all 8 ACL performatives with appropriate belief update semantics for INFORM
3. Implement Contract Net: `contract_net_initiate` (CFP broadcast), `contract_net_propose` (bid submission), `contract_net_award` (evaluation and award)
4. Implement `decision_request` with governance check (`governance_check`) and decision queue write
5. Implement `decision_resolve` with all four resolution types (approve/reject/defer/modify)

**Validation:** CEO can broadcast a CFP, multiple agents submit proposals, CEO awards to the highest-scoring bidder.

### Phase 6: Workforce and Stakeholder (Week 13)

**Goal:** Enable human-AI workforce management and stakeholder governance.

1. Implement contractor pool CRUD (`contractor_add`, `contractor_list`, `contractor_trust_update`)
2. Implement work package lifecycle (`work_package_create`, `work_package_assign`, `work_package_update`)
3. Implement handoff protocol with artifact and context transfer
4. Implement stakeholder profile management (`stakeholder_profile`)
5. Wire `governance_check` into all high-impact plan execution steps

**Validation:** HR agent can match a work package to a contractor by skill and trust score; a $10,000 action correctly pauses for stakeholder approval.

### Phase 7: BPMN and TypeDB (Week 14–15)

**Goal:** Implement BPMN 2.0 workflow management and optional TypeDB integration.

1. Implement BPMN element model (tasks, gateways, events, lanes, pools)
2. Implement `workflow_validate` with orphan detection, dead-end detection, lane gap detection
3. Implement workflow-goal linking
4. Implement TypeDB write-through: JSON-LD → TypeQL schema generation, async sync
5. Implement `typedb_query` with TypeQL passthrough
6. Implement `goal_seed_business` for initial business entity graph population

**Validation:** A complete enterprise sales workflow can be created, validated, and linked to a strategic goal; TypeDB multi-hop query returns correct results.

### Phase 8: BDI Runtime and Ontology Management (Week 16)

**Goal:** Implement the background heartbeat service and ontology evolution pipeline.

1. Implement heartbeat scheduler (configurable interval, default 30 min)
2. Implement intention pruning with per-strategy stall thresholds
3. Implement desire re-prioritization with deadline-adjusted urgency
4. Implement pairwise belief conflict detection and report writing
5. Implement chunked belief processing (50 sections per chunk, R5)
6. Implement `ontology_propose_concept` with validation pipeline
7. Implement `ontology_scaffold_domain` with domain templates

**Validation:** After 30 minutes, stalled intentions are pruned; belief conflicts are logged; a new ontology concept passes validation and is merged.

### Phase 9: Domain Tools and Integration (Week 17–20)

**Goal:** Implement the remaining 4+ domain-specific tool modules.

1. Implement Marketing tools (campaign management, content strategy)
2. Implement CRM tools (contact management, pipeline tracking)
3. Implement Email tools (composition, templates, sending)
4. Implement SEO Analytics tools
5. Implement Metrics and Reporting tools
6. Implement Integration tools (Stripe, HubSpot, Slack connectors)
7. Implement Setup Wizard and Onboarding tools

**Validation:** Full end-to-end scenario: business creation → agent provisioning → CEO delegates marketing campaign to CMO → CMO creates contractor brief → HR assigns contractor → contractor completes work → trust score updated → results logged in memory.

---

## Closing Notes

This document provides a complete technical reference for the MABOS Multi-Agent Business Operating System's BDI + SBVR cognitive framework. The system represents an integration of:

- **Formal agent theory** (BDI architecture, commitment strategies, reconsideration triggers)
- **Knowledge representation** (SBVR ontologies, SPO fact stores, rule-based inference)
- **Classical AI planning** (HTN decomposition, CBR retrieval and adaptation)
- **Multi-agent systems** (ACL messaging, Contract Net Protocol, trust scoring)
- **Modern LLM capabilities** (natural language cognitive files, semantic memory, hybrid search)

For detailed memory and knowledge management implementation (RLM layers R1–R5, hybrid search, hierarchical indexing, and inference chain tracing), refer to the companion document:

**[Memory & Knowledge Management Architecture Guide](./2026-02-24-memory-system-architecture.md)**

**System totals at a glance:**

- 99 tools across 21 modules
- 9 agent roles (full C-suite)
- 35 reasoning methods across 6 categories
- 10 domain ontologies (170 concepts, 131 fact types, 8 rules)
- 12 cognitive files per agent
- 3-tier goal hierarchy (strategic / tactical / operational)
- 5-phase BDI reasoning cycle (Perceive → Deliberate → Plan → Act → Learn)
