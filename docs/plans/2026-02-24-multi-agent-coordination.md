# Multi-Agent Coordination and Communication System

## OpenClaw-MABOS Technical Reference

| Field              | Value                                                                                                                                         |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Document ID        | MABOS-COORD-001                                                                                                                               |
| Version            | 1.0.0                                                                                                                                         |
| Last Updated       | 2026-02-24                                                                                                                                    |
| Status             | Authoritative Reference                                                                                                                       |
| Subsystem          | Multi-Agent Coordination and Communication                                                                                                    |
| Architecture Layer | Agent Coordination / Middleware                                                                                                               |
| Modules Covered    | communication-tools, workforce-tools, stakeholder-tools, workflow-tools, planning-tools, desire-tools, bdi-tools, business-tools, bdi-runtime |
| Tool Count         | 44 coordination tools (of 99 total)                                                                                                           |

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Theoretical Foundations](#2-theoretical-foundations)
3. [System Architecture Overview](#3-system-architecture-overview)
4. [Agent Architecture](#4-agent-architecture)
5. [BDI Cognitive Cycle](#5-bdi-cognitive-cycle)
6. [Goal and Desire Management](#6-goal-and-desire-management)
7. [Intention Management and Commitment Strategies](#7-intention-management-and-commitment-strategies)
8. [Planning System](#8-planning-system)
9. [ACL Messaging System](#9-acl-messaging-system)
10. [Contract Net Protocol](#10-contract-net-protocol)
11. [Decision Escalation and Governance](#11-decision-escalation-and-governance)
12. [Workforce Management](#12-workforce-management)
13. [Agent-to-Human Handoff Protocol](#13-agent-to-human-handoff-protocol)
14. [BPMN 2.0 Workflow Engine](#14-bpmn-20-workflow-engine)
15. [Business Venture System](#15-business-venture-system)
16. [BDI Runtime Service](#16-bdi-runtime-service)
17. [REST API Layer](#17-rest-api-layer)
18. [Real-Time Events and SSE Streaming](#18-real-time-events-and-sse-streaming)
19. [Data Flow Diagrams](#19-data-flow-diagrams)
20. [Tool Catalog](#20-tool-catalog)
21. [File Layout and Directory Structure](#21-file-layout-and-directory-structure)
22. [Integration with Other Subsystems](#22-integration-with-other-subsystems)
23. [Operational Considerations](#23-operational-considerations)
24. [References to Companion Architecture Documents](#24-references-to-companion-architecture-documents)

---

## 1. Executive Summary

The Multi-Agent Coordination and Communication System is the central nervous system of OpenClaw-MABOS (Multi-Agent Business Operating System). It governs how autonomous software agents communicate, negotiate, delegate work, make decisions, plan activities, and manage workflows within a simulated business venture.

### Purpose

MABOS addresses a fundamental challenge in multi-agent systems: how do multiple autonomous agents with distinct roles, beliefs, and goals coordinate effectively to achieve collective business objectives? The coordination subsystem provides the protocols, data structures, and runtime services that make this possible.

### Scope

The system encompasses 44 tools distributed across 9 modules, implementing:

- **Cognitive architecture** based on the Belief-Desire-Intention (BDI) model, giving each agent autonomous reasoning capabilities.
- **Inter-agent communication** using FIPA-compliant Agent Communication Language (ACL) with 8 performatives.
- **Task negotiation** via the Contract Net Protocol for competitive task allocation.
- **Hierarchical planning** through HTN decomposition and Case-Based Reasoning (CBR) adaptation.
- **Process management** with a BPMN 2.0 workflow engine supporting events, tasks, gateways, and lanes.
- **Governance workflows** enabling stakeholder oversight with configurable decision styles and approval thresholds.
- **Workforce delegation** with contractor management, trust scoring, and skill-based matching.
- **Business venture orchestration** spawning 9 C-suite agents with pre-configured personas and cognitive files.

### Design Philosophy

The system is built on three principles:

1. **Theoretical grounding**: Every coordination mechanism maps to an established multi-agent systems formalism (BDI, FIPA ACL, Contract Net, BPMN, HTN).
2. **Agent autonomy with human oversight**: Agents reason and act independently, but consequential decisions escalate to stakeholders through governance checks.
3. **File-based persistence with structured cognition**: Agent state lives in cognitive files (Markdown and JSON), making it inspectable, version-controllable, and recoverable.

---

## 2. Theoretical Foundations

The coordination system draws on five established theoretical frameworks from multi-agent systems research, distributed artificial intelligence, and business process management. This section provides the theoretical context necessary to understand the design decisions throughout the system.

### 2.1 Belief-Desire-Intention (BDI) Architecture

The BDI model, originally formalized by Rao and Georgeff (1995) building on Bratman's philosophical theory of practical reasoning (1987), provides the cognitive architecture for each agent.

**Core concepts:**

- **Beliefs** represent the agent's informational state about the world, itself, and other agents. Beliefs are revisable and carry certainty levels.
- **Desires** represent motivational states -- outcomes the agent would like to achieve. Desires may be mutually inconsistent; the agent need not pursue all of them.
- **Intentions** represent the agent's committed goals -- desires that the agent has decided to actively pursue and has allocated resources toward. Intentions constrain future deliberation by providing focus.

**The BDI reasoning cycle:**

```
Perceive -> Deliberate -> Plan -> Act -> Learn -> (repeat)
```

The agent perceives its environment to update beliefs, deliberates over desires to select intentions, generates plans to achieve intentions, executes plan steps as actions, and learns from outcomes. This cycle runs continuously (or on a configurable heartbeat in MABOS).

**Key properties:**

- **Means-end reasoning**: Given an intention, the agent reasons about which plans (means) can achieve it.
- **Commitment strategies**: Agents vary in how readily they abandon intentions. A single-minded agent persists until success or proven impossibility; an open-minded agent reconsiders when better options arise.
- **Bounded rationality**: The agent does not re-evaluate all desires at every step. Intentions provide stability and reduce computational overhead.

### 2.2 FIPA Agent Communication Language (ACL)

The Foundation for Intelligent Physical Agents (FIPA) standardized an Agent Communication Language based on speech act theory (Austin, Searle). Each message carries a performative that specifies the illocutionary force of the communication.

**MABOS implements 8 performatives:**

| Performative | Speech Act Category | Semantics                                          |
| ------------ | ------------------- | -------------------------------------------------- |
| REQUEST      | Directive           | Sender wants receiver to perform an action         |
| INFORM       | Assertive           | Sender asserts a proposition to receiver           |
| QUERY        | Interrogative       | Sender asks receiver for information               |
| PROPOSE      | Commissive          | Sender offers to do something under conditions     |
| ACCEPT       | Commissive          | Sender accepts a previous proposal                 |
| REJECT       | Assertive           | Sender refuses a previous proposal                 |
| CONFIRM      | Assertive           | Sender confirms a previously uncertain proposition |
| CANCEL       | Directive           | Sender cancels a previous request or commitment    |

**Message structure:**

Every ACL message contains: a unique message ID, sender (from), recipient (to), performative, content, optional reply_to (for threading), conversation_id (for grouping related messages), and a timestamp.

**Conversation protocols:**

Messages are threaded via `conversation_id` (grouping all messages in a negotiation or discussion) and `reply_to` (pointing to the specific message being responded to). This enables reconstruction of full conversation histories for audit and reasoning.

### 2.3 Contract Net Protocol (CNP)

The Contract Net Protocol (Smith, 1980) provides a market-based mechanism for task allocation among agents. It models the interaction as a negotiation between a manager (who has work to delegate) and contractors (who bid on the work).

**Protocol phases:**

1. **Announcement**: The manager broadcasts a Call For Proposals (CFP) describing the task, required skills, deadline, and evaluation criteria.
2. **Bidding**: Eligible agents evaluate the CFP against their capabilities and submit proposals with estimated effort, confidence levels, and conditions.
3. **Evaluation**: The manager evaluates proposals against the stated criteria.
4. **Award**: The manager selects a winner, sends ACCEPT to the winner and REJECT to all others.
5. **Execution**: The awarded agent performs the work and reports results.

**Properties:**

- Decentralized task allocation without a central scheduler.
- Competitive bidding ensures work goes to the most capable/available agent.
- Graceful degradation: if no suitable bidder exists, the manager retains the task.

### 2.4 BPMN 2.0 (Business Process Model and Notation)

BPMN 2.0 is the OMG standard for business process modeling. MABOS implements a subset sufficient for agent workflow coordination.

**Supported element categories:**

- **Events**: Start, End, Timer, Message, Signal, Error -- representing triggers and termination conditions.
- **Tasks**: User, Service, Script, Business Rule -- representing units of work.
- **Gateways**: Exclusive (XOR), Parallel (AND), Inclusive (OR) -- representing branching and merging of process flow.
- **Subprocesses**: Encapsulated process fragments that can be reused.
- **Pools and Lanes**: Organizational groupings mapping workflow responsibilities to agent roles.

**Execution semantics:**

Sequence flows connect elements to define execution order. Gateways control branching: exclusive gateways route to exactly one outgoing path based on conditions; parallel gateways fork execution to all outgoing paths simultaneously; inclusive gateways route to one or more paths.

### 2.5 Hierarchical Task Network (HTN) Planning

HTN planning (Erol, Hendler, Nau, 1994) decomposes complex tasks into simpler subtasks using decomposition methods.

**Core concepts:**

- **Compound tasks**: Abstract tasks that cannot be directly executed and must be decomposed.
- **Primitive tasks**: Concrete, executable actions.
- **Decomposition methods**: Rules specifying how a compound task can be broken into an ordered sequence of subtasks (which may themselves be compound or primitive).
- **Preconditions and effects**: Each task has conditions that must hold before execution and effects it produces upon completion.

**Integration with CBR:**

MABOS augments HTN planning with Case-Based Reasoning (CBR). When generating a plan, the system first searches a plan library for similar past plans. If a sufficiently similar plan is found, it is adapted to the new context rather than planned from scratch. This accelerates planning and leverages organizational learning.

---

## 3. System Architecture Overview

### 3.1 High-Level Architecture

The coordination system sits between the agent cognitive layer (individual agent reasoning) and the persistence/infrastructure layer (file system, TypeDB, REST API).

```
+=========================================================================+
|                        EXTERNAL INTERFACES                               |
|  +------------------+  +------------------+  +------------------------+  |
|  |   REST API       |  |   SSE Events     |  |   Dashboard Chat       |  |
|  |  /mabos/api/*    |  |  /api/chat/events|  |   /api/chat            |  |
|  +--------+---------+  +--------+---------+  +-----------+------------+  |
|           |                      |                        |              |
+=========================================================================+
            |                      |                        |
            v                      v                        v
+=========================================================================+
|                    COORDINATION MIDDLEWARE                                |
|                                                                          |
|  +---------------------+     +----------------------+                    |
|  |  Communication       |     |  Governance           |                   |
|  |  - ACL Messaging     |<--->|  - Decision Queue      |                   |
|  |  - Contract Net      |     |  - Stakeholder Profile |                   |
|  |  - Agent Inbox/Outbox|     |  - Approval Workflow   |                   |
|  +----------+----------+     +----------+-----------+                    |
|             |                            |                               |
|             v                            v                               |
|  +---------------------+     +----------------------+                    |
|  |  Workforce Mgmt      |     |  Workflow Engine       |                   |
|  |  - Contractor Pool   |     |  - BPMN 2.0 Elements  |                   |
|  |  - Work Packages     |     |  - Validation          |                   |
|  |  - Trust Scoring     |     |  - Lane Assignment     |                   |
|  |  - Skill Matching    |     |  - Execution Tracking  |                   |
|  +----------+----------+     +----------+-----------+                    |
|             |                            |                               |
+=========================================================================+
              |                            |
              v                            v
+=========================================================================+
|                     AGENT COGNITIVE LAYER                                |
|                                                                          |
|  +---------------------+     +----------------------+                    |
|  |  BDI Core            |     |  Planning System       |                   |
|  |  - Beliefs           |<--->|  - HTN Decomposition   |                   |
|  |  - Goals             |     |  - Plan Library (CBR)  |                   |
|  |  - Intentions        |     |  - Plan Adaptation     |                   |
|  |  - BDI Cycle Engine  |     |  - Risk Assessment     |                   |
|  +----------+----------+     +----------+-----------+                    |
|             |                            |                               |
|             v                            v                               |
|  +---------------------+     +----------------------+                    |
|  |  Desire Management    |     |  BDI Runtime Service   |                   |
|  |  - Terminal/Instrumntl|     |  - Heartbeat (30 min)  |                   |
|  |  - Priority Ranking   |     |  - Intention Pruning   |                   |
|  |  - Conflict Detection |     |  - Belief Conflict Det.|                   |
|  |  - Desire Dropping    |     |  - Agent Discovery     |                   |
|  +---------------------+     +----------------------+                    |
|                                                                          |
+=========================================================================+
              |
              v
+=========================================================================+
|                    PERSISTENCE AND INFRASTRUCTURE                        |
|                                                                          |
|  +-------------------+ +------------------+ +------------------------+   |
|  | File System        | | TypeDB           | | Memory/Knowledge       |   |
|  | - Cognitive Files  | | - Workflow Store  | | - Memory.md            |   |
|  | - inbox.json       | | - Fact Store     | | - Lessons.md           |   |
|  | - decision-queue   | | - Ontology       | | - Case Base            |   |
|  | - metrics.json     | |                  | |                        |   |
|  +-------------------+ +------------------+ +------------------------+   |
|                                                                          |
+=========================================================================+
```

### 3.2 Module Dependency Graph

The coordination modules have the following dependency relationships:

```
business-tools
    |
    +---> bdi-tools (creates agents with BDI cognitive files)
    |         |
    |         +---> desire-tools (desire evaluation feeds BDI deliberation)
    |         |
    |         +---> planning-tools (plan generation feeds BDI plan phase)
    |
    +---> communication-tools (agents need messaging from creation)
    |         |
    |         +---> contract_net (uses ACL messaging for CFP/proposals)
    |         |
    |         +---> decision_request (creates governance decisions)
    |
    +---> workforce-tools (work packages, contractor management)
    |         |
    |         +---> communication-tools (notifications to contractors)
    |         |
    |         +---> planning-tools (work packages from plan steps)
    |
    +---> stakeholder-tools (governance over business decisions)
    |         |
    |         +---> communication-tools (decision notifications)
    |
    +---> workflow-tools (BPMN processes for business operations)

bdi-runtime
    |
    +---> bdi-tools (runs maintenance on BDI state)
    +---> desire-tools (re-sorts desires)
    +---> Agent discovery (scans filesystem)
```

### 3.3 Data Flow Summary

All inter-agent data flows through three primary channels:

1. **Inbox/Outbox JSON files** — Asynchronous message passing between agents. Each agent has `agents/{id}/inbox.json`. Messages are written by senders and read by recipients.
2. **Decision queue** — Escalation channel from agents to stakeholders. Lives in `businesses/{id}/decision-queue.json`. Agents write pending decisions; stakeholders resolve them.
3. **Shared cognitive files** — Beliefs, goals, plans, and intentions are stored in per-agent Markdown files. The BDI runtime reads and writes these files during maintenance cycles.

---

## 4. Agent Architecture

### 4.1 The 10 Cognitive Files

Every agent in MABOS is equipped with 10 cognitive files that collectively represent its mental state, knowledge, capabilities, and history. These files are Markdown-formatted for human readability and structured with consistent heading conventions for machine parsing.

| File               | Purpose                                                         | BDI Component |
| ------------------ | --------------------------------------------------------------- | ------------- |
| `Persona.md`       | Agent identity, role description, behavioral guidelines         | Identity      |
| `Beliefs.md`       | Current beliefs about environment, self, and other agents       | Beliefs       |
| `Desires.md`       | Potential goals ranked by priority                              | Desires       |
| `Goals.md`         | Active goals organized by tier (strategic/tactical/operational) | Goals         |
| `Plans.md`         | Current execution plans with step tracking                      | Plans         |
| `Intentions.md`    | Committed goals with allocated resources                        | Intentions    |
| `Capabilities.md`  | Skills, tools, and competencies the agent possesses             | Self-model    |
| `Memory.md`        | Episodic memory of past interactions and outcomes               | Learning      |
| `Lessons.md`       | Extracted lessons learned from successes and failures           | Learning      |
| `Relationships.md` | Trust levels and interaction history with other agents          | Social model  |

**File lifecycle:**

1. At agent creation (via `business_create`), all 10 files are generated with role-specific initial content. For example, a CFO agent's Persona.md contains financial expertise, risk-assessment guidelines, and budget oversight responsibilities.
2. During operation, the BDI cycle reads and writes these files as the agent perceives, deliberates, plans, acts, and learns.
3. The BDI runtime service performs periodic maintenance, pruning stale data and detecting conflicts.

### 4.2 The 9 C-Suite Agent Roles

When a business venture is created, MABOS spawns 9 specialized agents:

| Role      | Agent ID Pattern     | Primary Responsibilities                                            |
| --------- | -------------------- | ------------------------------------------------------------------- |
| CEO       | `{biz_id}-ceo`       | Strategic direction, cross-functional coordination, final authority |
| CFO       | `{biz_id}-cfo`       | Financial planning, budgeting, risk assessment, reporting           |
| COO       | `{biz_id}-coo`       | Operations management, process optimization, supply chain           |
| CMO       | `{biz_id}-cmo`       | Marketing strategy, brand management, customer acquisition          |
| CTO       | `{biz_id}-cto`       | Technology strategy, architecture decisions, technical debt         |
| HR        | `{biz_id}-hr`        | Talent acquisition, team structure, culture, contractor mgmt        |
| Legal     | `{biz_id}-legal`     | Compliance, contracts, IP protection, regulatory affairs            |
| Strategy  | `{biz_id}-strategy`  | Market analysis, competitive intelligence, strategic planning       |
| Knowledge | `{biz_id}-knowledge` | Knowledge management, documentation, organizational learning        |

**Inter-role coordination patterns:**

- **CEO as coordinator**: The CEO agent typically initiates Contract Net negotiations for cross-functional tasks and serves as the default escalation point.
- **CFO as gatekeeper**: Financial decisions are routed through the CFO for budget impact assessment before stakeholder escalation.
- **CTO-COO axis**: Technology and operations agents coordinate on implementation feasibility and resource allocation.
- **HR-Workforce bridge**: The HR agent manages the contractor pool and evaluates workforce needs based on work package backlogs.
- **Knowledge as historian**: The Knowledge agent maintains the organization's case base and plan library, supporting CBR-based planning for all agents.

### 4.3 Agent Lifecycle

```
Creation                    Operation                           Termination
   |                           |                                     |
   v                           v                                     v
business_create  --->  BDI Cycle (continuous)  --->  Business archive
   |                     |   |   |   |   |
   +-- Spawn 9 agents    |   |   |   |   +-- Learn
   +-- Generate files     |   |   |   +-- Act
   +-- Initialize inbox   |   |   +-- Plan
   +-- Set beliefs        |   +-- Deliberate
   +-- Inject persona     +-- Perceive
```

**Creation phase:**

1. `business_create` is called with business name, type, and description.
2. For each of the 9 roles, the system creates an agent directory under `agents/`.
3. All 10 cognitive files are generated with role-specific initial content.
4. An empty `inbox.json` is created for inter-agent messaging.
5. The agent is registered in the business manifest.

**Operation phase:**

The agent enters the BDI cycle (Section 5), processing messages, pursuing goals, executing plans, and communicating with peers. The BDI runtime service provides background maintenance.

**Discovery:**

The `discoverAgents()` function in the BDI runtime scans the `agents/` directory for subdirectories containing `Persona.md` or `Beliefs.md`, dynamically discovering all active agents without requiring a central registry.

---

## 5. BDI Cognitive Cycle

The BDI cycle is the heartbeat of each agent's reasoning process. Implemented in the `bdi_cycle` tool, it executes five phases sequentially.

### 5.1 Cycle Overview

```
                    +------------------+
                    |                  |
                    v                  |
              +-----------+            |
              | PERCEIVE  |            |
              | Update    |            |
              | beliefs   |            |
              +-----+-----+           |
                    |                  |
                    v                  |
              +-----------+            |
              | DELIBERATE|            |
              | Evaluate  |            |
              | desires   |            |
              +-----+-----+           |
                    |                  |
                    v                  |
              +-----------+            |
              |   PLAN    |            |
              | Generate/ |            |
              | adapt     |            |
              +-----+-----+           |
                    |                  |
                    v                  |
              +-----------+            |
              |    ACT    |            |
              | Execute   |            |
              | steps     |            |
              +-----+-----+           |
                    |                  |
                    v                  |
              +-----------+            |
              |   LEARN   |            |
              | Record    |            |
              | outcomes  |            |
              +-----+-----+           |
                    |                  |
                    +------------------+
```

### 5.2 Phase 1: PERCEIVE

**Purpose:** Update the agent's belief base from all available information sources.

**Information sources:**

1. **Environment**: External data relevant to the agent's domain (market conditions, competitor actions, system metrics).
2. **Inbox messages**: Unread ACL messages from other agents, including requests, information updates, proposals, and decisions.
3. **Fact store**: Facts stored in TypeDB or the local knowledge base that have been updated since the last perception cycle.
4. **Business metrics**: Current KPIs from `businesses/{id}/metrics.json`.

**Process:**

```
For each information source:
    1. Fetch new/changed data since last perception
    2. Compare with existing beliefs
    3. If new information contradicts existing belief:
        a. Evaluate certainty of both
        b. Retain higher-certainty belief (or flag conflict)
        c. Log revision: old_value, new_value, reason, timestamp
    4. If new information is novel:
        a. Create new belief entry with initial certainty
    5. Update belief timestamp
```

**Belief categories:**

- `environment`: Facts about the external world (market data, regulations, technology trends).
- `self`: The agent's understanding of its own state (current workload, resource availability, performance).
- `agent`: Beliefs about other agents (their capabilities, reliability, current activities).
- `case`: Knowledge derived from past cases in the CBR system.

**Certainty management:**

Each belief carries a certainty value in [0.0, 1.0]. Certainty increases with corroborating evidence and decreases with contradictory information. The `belief_update` tool logs every revision for audit purposes.

### 5.3 Phase 2: DELIBERATE

**Purpose:** Evaluate desires, check consistency with current beliefs, and select intentions.

**Process:**

1. Load all active desires from `Desires.md`.
2. Filter desires that are inconsistent with current beliefs (e.g., a desire to "expand to European market" is filtered if beliefs indicate regulatory prohibition).
3. Rank remaining desires using the priority formula (see Section 6.2).
4. Compare top-ranked desires against current intentions.
5. If a desire outranks current intentions by the reconsideration threshold (see Section 7), trigger intention reconsideration.
6. Identify desires ready for commitment (high priority, no blockers, sufficient resources).

**Output:** An ordered list of desires, a set of recommended new intentions, and any reconsideration triggers.

### 5.4 Phase 3: PLAN

**Purpose:** Generate or adapt plans for committed intentions.

**Process:**

1. For each intention without an active plan:
   a. Search plan library for similar past plans (`plan_library_search`).
   b. If a similar plan is found (similarity > threshold):
   - Adapt it to current context via CBR (`plan_adapt`).
     c. Otherwise:
   - Generate a new plan via HTN decomposition (`htn_decompose`, `plan_generate`).
2. For each intention with an active plan:
   a. Check plan validity against current beliefs.
   b. If plan is invalid (preconditions violated, resources unavailable):
   - Re-plan or adapt.

**Plan structure:**

```
Plan
  +-- Phases (ordered)
       +-- Steps (ordered within phase)
            +-- id
            +-- description
            +-- type: compound | primitive
            +-- dependencies: [step_ids]
            +-- estimated_duration
            +-- assigned_to: agent_id | null
            +-- status: pending | executing | completed | failed
  +-- Decision Points
       +-- condition
       +-- branches: [step_ids]
  +-- Risks
       +-- description
       +-- impact: low | medium | high | critical
       +-- likelihood: float
       +-- mitigation: string
```

### 5.5 Phase 4: ACT

**Purpose:** Execute the next available plan steps and perform coordination actions.

**Actions include:**

1. **Execute primitive plan steps**: Mark the step as executing, perform the action, record the outcome.
2. **Send ACL messages**: Communicate with other agents as required by the plan (requests, queries, proposals).
3. **Delegate work**: Create work packages and assign them to contractors or other agents via the workforce management system.
4. **Initiate negotiations**: Start Contract Net protocols for tasks requiring competitive bidding.
5. **Escalate decisions**: Submit decisions to the stakeholder queue when governance checks indicate approval is required.
6. **Update workflows**: Advance BPMN workflow instances by completing tasks and triggering events.

**Governance check integration:**

Before executing any consequential action (budget expenditure, hiring, strategic commitment), the agent calls `governance_check` to determine if stakeholder approval is required. If approval is needed, the action is suspended and a `decision_request` is created.

### 5.6 Phase 5: LEARN

**Purpose:** Record outcomes, update beliefs, and extract lessons for future reference.

**Process:**

1. For each completed plan step:
   a. Record: actual_duration, outcome, artifacts_produced.
   b. Compare actual vs. estimated metrics.
   c. Update self-beliefs about capability and estimation accuracy.
2. For each completed plan:
   a. Store in plan library for future CBR retrieval.
   b. Extract lessons: what worked, what failed, what to do differently.
   c. Write lessons to `Lessons.md`.
3. For each interaction outcome:
   a. Update beliefs about other agents (reliability, responsiveness, capability).
   b. Update `Relationships.md` with interaction record.
4. Write episode to `Memory.md` with structured metadata (date, participants, context, outcome).

### 5.7 BDI Audit Trail

Every BDI cycle execution produces an audit record containing:

- Cycle timestamp and duration.
- Beliefs updated (count and categories).
- Desires evaluated (count, top 3 by priority).
- Plans generated/adapted (count).
- Actions taken (count and types).
- Lessons recorded (count).
- Conflicts detected (count and descriptions).

This trail supports debugging, performance analysis, and stakeholder reporting.

---

## 6. Goal and Desire Management

### 6.1 Desire Types

MABOS distinguishes two fundamental types of desires:

**Terminal desires** are ends in themselves -- outcomes valued for their own sake. Examples: "Achieve $1M annual revenue," "Establish market leadership in segment X," "Maintain 99.9% uptime."

**Instrumental desires** are means to achieve terminal desires. Examples: "Hire a senior engineer" (instrumental to the terminal desire of product quality), "Launch marketing campaign" (instrumental to revenue growth).

This distinction matters for:

- **Priority computation**: Terminal desires carry independent priority; instrumental desires derive part of their priority from the terminal desires they serve.
- **Desire dropping**: When a terminal desire is dropped, all instrumental desires that exclusively serve it are cascaded (automatically dropped).
- **Conflict resolution**: Conflicts between instrumental desires serving the same terminal desire are resolved by evaluating which is the more effective means.

### 6.2 Priority Formula

The `desire_evaluate` tool computes a composite priority score for each desire:

```
priority = base_priority    * 0.30
         + importance       * 0.25
         + urgency          * 0.25
         + strategic_align  * 0.15
         + dependency_status * 0.05
```

**Component definitions:**

| Component             | Range  | Description                                                               |
| --------------------- | ------ | ------------------------------------------------------------------------- |
| `base_priority`       | [0, 1] | Intrinsic importance of the desire, set at creation                       |
| `importance`          | [0, 1] | How much achieving this desire matters to overall business success        |
| `urgency`             | [0, 1] | Time sensitivity; increases as deadlines approach                         |
| `strategic_alignment` | [0, 1] | How well the desire aligns with the business's stated strategic direction |
| `dependency_status`   | [0, 1] | 1.0 if all dependencies are met, decreasing with unmet dependencies       |

**Weight rationale:**

- `base_priority` at 30% gives the agent's initial assessment the highest single weight.
- `importance` and `urgency` at 25% each balance long-term value against time pressure.
- `strategic_alignment` at 15% ensures desires that diverge from strategy are deprioritized but not eliminated.
- `dependency_status` at 5% is a minor tiebreaker that favors actionable desires.

### 6.3 Conflict Detection

When a new desire is created via `desire_create`, the system checks for conflicts with existing desires:

**Conflict types:**

1. **Resource conflict**: Two desires require the same scarce resource (budget, personnel, time).
2. **Goal conflict**: Achieving one desire makes the other impossible or significantly harder.
3. **Strategy conflict**: Desires pull the business in incompatible strategic directions.

**Detection mechanism:**

The system compares the new desire's description, type, and resource requirements against existing desires. Detected conflicts are reported to the agent, which can then:

- Drop the lower-priority desire.
- Reformulate one desire to avoid the conflict.
- Escalate to the stakeholder for resolution.

### 6.4 Desire Dropping

The `desire_drop` tool removes a desire from consideration and records the rationale:

**Cascade behavior:**

When a terminal desire is dropped, the system identifies all instrumental desires whose sole purpose was to serve that terminal desire. These are also dropped automatically, with the cascade recorded in each desire's drop record.

**Drop record:**

```json
{
  "desire_id": "d-001",
  "dropped_at": "2026-02-24T14:30:00Z",
  "reason": "Market analysis shows segment is declining; ROI insufficient",
  "related_desires_affected": ["d-003", "d-007"],
  "cascaded_drops": ["d-003"]
}
```

---

## 7. Intention Management and Commitment Strategies

### 7.1 From Desire to Intention

An intention is a desire that the agent has committed to pursuing. The `intention_commit` tool records this commitment:

**Commitment record:**

```json
{
  "intention_id": "i-001",
  "goal_id": "g-001",
  "plan_id": "p-001",
  "commitment_strategy": "open-minded",
  "resources_allocated": {
    "budget": 50000,
    "personnel": ["cto", "engineer-1"],
    "time_horizon": "90 days"
  },
  "committed_at": "2026-02-24T10:00:00Z"
}
```

The commitment is written to `Intentions.md` in the agent's cognitive files, making it visible to the BDI cycle and the runtime service.

### 7.2 Commitment Strategies

MABOS implements three commitment strategies that control how readily an agent abandons its intentions:

**Single-minded:**

- The agent persists with an intention until it is achieved or proven impossible.
- Reconsideration trigger: Only when the intention is logically impossible given current beliefs.
- Use case: Critical, non-negotiable goals (regulatory compliance, contractual obligations).

**Open-minded (default):**

- The agent reconsiders intentions when circumstances change significantly.
- Reconsideration triggers:
  - Intention has been stalled for more than 7 days without progress.
  - A new desire appears with priority exceeding the current intention's priority by a factor of 1.3.
- Use case: Most business goals where adaptability is valued.

**Cautious:**

- The agent reconsiders intentions more aggressively.
- Reconsideration triggers:
  - Intention has been stalled for more than 3 days without progress.
  - A new desire appears with priority exceeding the current intention's priority by a factor of 1.1.
- Use case: Fast-moving environments where conditions change rapidly.

### 7.3 Intention Reconsideration

The `intention_reconsider` tool evaluates current intentions and returns one of three recommendations for each:

| Recommendation | Meaning                         | Trigger Conditions                                                      |
| -------------- | ------------------------------- | ----------------------------------------------------------------------- |
| **keep**       | Continue pursuing the intention | Making progress, no better alternatives                                 |
| **suspend**    | Temporarily pause the intention | Resource conflict with higher-priority intention, external blocker      |
| **drop**       | Abandon the intention entirely  | Proven infeasible, superseded by better option, goal no longer relevant |

**Reconsideration process:**

```
For each active intention I:
    1. Check commitment strategy thresholds
    2. Evaluate progress:
        - Days since last progress update
        - Percentage complete vs. time elapsed
        - Blockers identified
    3. Compare against competing desires:
        - Any new desire with priority > I.priority * strategy_factor?
    4. Check belief consistency:
        - Do current beliefs still support I's feasibility?
    5. Return recommendation: keep | suspend | drop
```

### 7.4 Intention Pruning (Runtime)

The BDI runtime service performs periodic intention pruning during maintenance cycles:

- Identifies intentions with no progress updates beyond the strategy-specific threshold.
- Checks for intentions whose associated plans have all steps failed.
- Marks stale intentions for reconsideration on the next BDI cycle.
- Logs pruning actions to the agent's Memory.md.

---

## 8. Planning System

### 8.1 Plan Generation

The `plan_generate` tool creates a structured execution plan for a given goal:

**Input:**

- Goal description (what to achieve)
- Constraints (budget, timeline, resource limits)
- Context (current business state, relevant beliefs)

**Output:**

A plan containing phases, steps (compound and primitive), decision points, and a risk assessment.

**Generation process:**

1. Search plan library for similar past plans (`plan_library_search`).
2. If a highly similar plan is found, use `plan_adapt` to modify it.
3. Otherwise, decompose the goal using `htn_decompose`:
   a. Identify the goal as a compound task.
   b. Select an applicable decomposition method.
   c. Recursively decompose until all tasks are primitive.
4. Assign dependencies between steps.
5. Estimate durations based on historical data or heuristics.
6. Assess risks for each phase and step.
7. Identify decision points where human or inter-agent input may be needed.

### 8.2 HTN Decomposition

The `htn_decompose` tool is the core planning mechanism:

**Input:**

- A compound task description
- Current state (beliefs)
- Available decomposition methods

**Output:**

- An ordered list of subtasks, each with:
  - Description
  - Type (compound or primitive)
  - Preconditions (what must be true before execution)
  - Effects (what will be true after execution)
  - Estimated duration

**Decomposition example:**

```
Compound Task: "Launch e-commerce product line"
    |
    +-- Method: "Standard Product Launch"
         |
         +-- Subtask 1: "Market research" (compound)
         |      +-- 1.1: "Competitor analysis" (primitive)
         |      +-- 1.2: "Customer survey" (primitive)
         |      +-- 1.3: "Market sizing" (primitive)
         |
         +-- Subtask 2: "Product development" (compound)
         |      +-- 2.1: "Requirements specification" (primitive)
         |      +-- 2.2: "Design" (compound)
         |      |      +-- 2.2.1: "UI mockups" (primitive)
         |      |      +-- 2.2.2: "Architecture design" (primitive)
         |      +-- 2.3: "Implementation" (primitive)
         |      +-- 2.4: "Testing" (primitive)
         |
         +-- Subtask 3: "Go-to-market" (compound)
                +-- 3.1: "Marketing campaign" (primitive)
                +-- 3.2: "Sales channel setup" (primitive)
                +-- 3.3: "Launch event" (primitive)
```

**Recursive decomposition:**

Compound subtasks are further decomposed by calling `htn_decompose` recursively. The process terminates when all leaf nodes are primitive tasks.

### 8.3 Plan Library and CBR

The plan library stores completed plans as cases for future reuse:

**Case structure:**

```json
{
  "case_id": "case-001",
  "problem": {
    "goal": "Launch SaaS product",
    "context": { "business_type": "saas", "team_size": 5, "budget": 100000 }
  },
  "solution": {
    "plan": { "...full plan structure..." }
  },
  "outcome": {
    "success": true,
    "actual_duration": "120 days",
    "lessons": ["Underestimated QA time by 40%"]
  }
}
```

**Search mechanism (`plan_library_search`):**

1. Agent's own plan history (highest relevance, most context).
2. Domain-specific templates (plans tagged with the business type).
3. Base templates (generic plans applicable across domains).

Results are returned with similarity scores, allowing the agent to select the most appropriate starting point.

### 8.4 Plan Adaptation (CBR)

The `plan_adapt` tool modifies an existing plan to fit new circumstances:

**Adaptation process:**

1. **Retrieve**: Select source plan with highest similarity score.
2. **Compare**: Identify differences between source context and current context.
3. **Adapt**: Modify plan elements to account for differences:
   - Add steps for new requirements not in the source plan.
   - Remove steps irrelevant to the new context.
   - Adjust durations based on current resource availability.
   - Modify risk assessments based on current conditions.
4. **Validate**: Check that the adapted plan is coherent (no dangling dependencies, all preconditions met).
5. **Record**: Store adaptation provenance (source case, similarity score, adaptations made, negative cases consulted).

**Negative cases:**

The CBR system also tracks failed plans. When adapting, the system consults negative cases to avoid repeating known mistakes. The adaptation record includes `negative_cases: [case_ids]` -- plans that failed in similar contexts and whose failure patterns should be avoided.

### 8.5 Plan Execution

The `plan_execute_step` tool tracks step-level execution:

**Step state transitions:**

```
pending --> executing --> completed
                    \--> failed
```

**Execution record:**

- `actual_duration`: How long the step actually took (vs. estimate).
- `outcome`: Narrative description of what happened.
- `artifacts_produced`: Files, documents, or deliverables created.
- `notes`: Additional observations for the learning phase.

**Dependency management:**

Steps with unmet dependencies (predecessor steps not completed) cannot transition to `executing`. When a step completes, the system checks if any dependent steps are now unblocked and marks them as ready for execution.

### 8.6 Risk Assessment

Every generated plan includes a risk assessment:

**Risk structure:**

```json
{
  "risk_id": "r-001",
  "description": "Key contractor may become unavailable during critical phase",
  "impact": "high",
  "likelihood": 0.3,
  "mitigation": "Identify backup contractor and cross-train team member",
  "affected_steps": ["step-2.3", "step-2.4"],
  "owner": "coo"
}
```

**Impact levels:**

| Level    | Description                                                       |
| -------- | ----------------------------------------------------------------- |
| low      | Minor inconvenience, easily worked around                         |
| medium   | Noticeable delay or cost increase, requires plan adjustment       |
| high     | Significant impact on timeline or budget, may require re-planning |
| critical | Threatens plan viability, requires immediate escalation           |

---

## 9. ACL Messaging System

### 9.1 Message Format

Every ACL message in MABOS follows this structure:

```json
{
  "id": "msg-uuid-v4",
  "from": "biz1-ceo",
  "to": "biz1-cto",
  "performative": "REQUEST",
  "content": {
    "action": "evaluate_technical_feasibility",
    "subject": "AI-powered recommendation engine",
    "deadline": "2026-03-01",
    "context": "Board approved exploration of ML features"
  },
  "reply_to": null,
  "conversation_id": "conv-uuid-v4",
  "timestamp": "2026-02-24T10:30:00Z"
}
```

**Field semantics:**

| Field             | Type   | Required | Description                                 |
| ----------------- | ------ | -------- | ------------------------------------------- |
| `id`              | string | Yes      | UUID v4, globally unique message identifier |
| `from`            | string | Yes      | Sender agent ID                             |
| `to`              | string | Yes      | Recipient agent ID                          |
| `performative`    | enum   | Yes      | One of 8 speech act types (see Section 9.2) |
| `content`         | object | Yes      | Performative-specific payload               |
| `reply_to`        | string | No       | ID of message being replied to              |
| `conversation_id` | string | No       | Groups related messages into a conversation |
| `timestamp`       | string | Yes      | ISO 8601 timestamp                          |

### 9.2 Performatives in Detail

**REQUEST** -- Directive speech act

The sender asks the receiver to perform an action. The receiver may comply, refuse, or propose alternatives.

```json
{
  "performative": "REQUEST",
  "content": {
    "action": "prepare_budget_forecast",
    "parameters": { "quarter": "Q2-2026", "scenarios": ["optimistic", "pessimistic"] },
    "urgency": "high"
  }
}
```

**INFORM** -- Assertive speech act

The sender communicates factual information to the receiver. The receiver updates its beliefs accordingly.

```json
{
  "performative": "INFORM",
  "content": {
    "fact": "Q1 revenue exceeded target by 12%",
    "evidence": "metrics.json updated 2026-02-24",
    "certainty": 0.95
  }
}
```

**QUERY** -- Interrogative speech act

The sender asks the receiver for information. The expected response is an INFORM message.

```json
{
  "performative": "QUERY",
  "content": {
    "question": "What is the current customer acquisition cost?",
    "context": "Needed for marketing budget review"
  }
}
```

**PROPOSE** -- Commissive speech act

The sender offers to perform an action under specified conditions. Used in negotiations and Contract Net interactions.

```json
{
  "performative": "PROPOSE",
  "content": {
    "offer": "Develop recommendation engine prototype",
    "conditions": ["2 engineers for 6 weeks", "access to user data"],
    "deliverable": "Working prototype with API",
    "confidence": 0.85
  }
}
```

**ACCEPT** -- Commissive speech act

The sender accepts a previous proposal. Typically references the original message via `reply_to`.

```json
{
  "performative": "ACCEPT",
  "content": {
    "accepted_proposal": "msg-proposal-id",
    "acknowledgment": "Resources allocated as requested"
  }
}
```

**REJECT** -- Assertive speech act

The sender declines a previous proposal, optionally with a reason.

```json
{
  "performative": "REJECT",
  "content": {
    "rejected_proposal": "msg-proposal-id",
    "reason": "Budget constraints do not permit allocation of 2 engineers"
  }
}
```

**CONFIRM** -- Assertive speech act

The sender confirms something that was previously uncertain or provisional.

```json
{
  "performative": "CONFIRM",
  "content": {
    "confirmed": "Vendor contract signed",
    "reference": "contract-2026-001"
  }
}
```

**CANCEL** -- Directive speech act

The sender cancels a previous request or commitment.

```json
{
  "performative": "CANCEL",
  "content": {
    "cancelled_message": "msg-request-id",
    "reason": "Strategy pivot; no longer pursuing this feature"
  }
}
```

### 9.3 Conversation Threading

Messages are grouped into conversations using two mechanisms:

1. **`conversation_id`**: A UUID shared by all messages in a logical conversation. Set by the initiator and propagated by responders.
2. **`reply_to`**: Points to the specific message being responded to, creating a directed reply graph within the conversation.

**Thread reconstruction:**

Given a `conversation_id`, the full conversation can be reconstructed by:

1. Collecting all messages with that `conversation_id` from all agents' inboxes.
2. Sorting by timestamp.
3. Building a reply tree using `reply_to` references.

This supports both linear conversations and branching discussions (e.g., when a QUERY triggers multiple INFORM responses from different agents).

### 9.4 Inbox Model

Each agent has an inbox file at `agents/{id}/inbox.json`:

```json
{
  "agent_id": "biz1-cto",
  "messages": [
    { "id": "msg-001", "from": "biz1-ceo", "performative": "REQUEST", "...": "..." },
    { "id": "msg-002", "from": "biz1-cfo", "performative": "QUERY", "...": "..." }
  ]
}
```

**Inbox processing during BDI PERCEIVE phase:**

1. Read all unprocessed messages from inbox.
2. For each message:
   a. Update beliefs based on content (INFORM messages directly update beliefs).
   b. Add requests to pending actions (REQUEST messages create work items).
   c. Trigger negotiations (PROPOSE messages enter the deliberation queue).
   d. Resolve pending interactions (ACCEPT/REJECT/CONFIRM/CANCEL update tracked conversations).
3. Mark messages as processed (or archive to outbox history).

**Delivery model:**

Messages are written directly to the recipient's inbox file. There is no intermediate message broker. This provides simplicity and auditability at the cost of requiring file system access.

---

## 10. Contract Net Protocol

### 10.1 Protocol Implementation

MABOS implements the Contract Net Protocol through three dedicated tools that map to the protocol's phases.

### 10.2 CFP Lifecycle

```
Manager                          Contractors (All Agents)
   |                                      |
   |  contract_net_initiate (CFP)         |
   |------------------------------------->|
   |  (broadcast to all/filtered agents)  |
   |                                      |
   |          contract_net_propose         |
   |<-------------------------------------|  (Agent A)
   |<-------------------------------------|  (Agent B)
   |<-------------------------------------|  (Agent C)
   |                                      |
   |  [Evaluate proposals]                |
   |                                      |
   |  contract_net_award                  |
   |------------------------------------->|  (ACCEPT to winner)
   |------------------------------------->|  (REJECT to others)
   |                                      |
   |  [Work execution]                    |
   |                                      |
   |          INFORM (result)             |
   |<-------------------------------------|  (Winner reports)
   |                                      |
```

**Status lifecycle:**

```
open --> awarded --> completed
```

### 10.3 Call For Proposals (CFP)

The `contract_net_initiate` tool creates and broadcasts a CFP:

**CFP structure:**

```json
{
  "cfp_id": "cfp-uuid-v4",
  "initiator": "biz1-ceo",
  "task": {
    "description": "Develop customer analytics dashboard",
    "required_skills": ["data-visualization", "python", "sql"],
    "deliverables": ["Dashboard application", "Data pipeline documentation"],
    "deadline": "2026-04-01"
  },
  "criteria": {
    "weights": {
      "capability_match": 0.35,
      "estimated_effort": 0.25,
      "confidence": 0.25,
      "conditions": 0.15
    }
  },
  "status": "open",
  "proposals": [],
  "created_at": "2026-02-24T10:00:00Z"
}
```

**Broadcast mechanism:**

1. The system calls `discoverAgents()` to find all active agents.
2. Optionally filters by required skills (agents whose `Capabilities.md` mentions relevant skills).
3. Sends a PROPOSE-type notification to each eligible agent's inbox.
4. Stores the CFP in the initiator's outbox for tracking.

### 10.4 Proposal Submission

The `contract_net_propose` tool allows agents to respond to a CFP:

**Proposal structure:**

```json
{
  "proposal_id": "prop-uuid-v4",
  "cfp_id": "cfp-uuid-v4",
  "proposer": "biz1-cto",
  "capabilities_match": {
    "matched_skills": ["data-visualization", "python", "sql"],
    "additional_skills": ["machine-learning"],
    "match_percentage": 1.0
  },
  "estimated_effort": {
    "duration": "45 days",
    "resources": ["1 senior engineer", "1 data analyst"],
    "cost_estimate": 35000
  },
  "confidence": 0.82,
  "conditions": ["Access to production database read replica", "Design review at 50% completion"],
  "submitted_at": "2026-02-24T12:00:00Z"
}
```

Proposals are appended to the `proposals` array in the CFP record.

### 10.5 Award Process

The `contract_net_award` tool selects the winning proposal:

**Evaluation process:**

1. Score each proposal against the criteria weights:
   ```
   score = capability_match * 0.35
         + (1 - normalized_effort) * 0.25
         + confidence * 0.25
         + conditions_feasibility * 0.15
   ```
2. Select the highest-scoring proposal.
3. Update CFP status to `awarded`.
4. Send ACCEPT message to the winner via ACL.
5. Send REJECT messages to all other proposers via ACL.
6. Create a work package for the awarded task (bridging to workforce management).

**Post-award:**

The winning agent (or contractor) executes the work. Upon completion, the work package status is updated and the trust score is adjusted based on quality.

---

## 11. Decision Escalation and Governance

### 11.1 Governance Model

The governance system implements a configurable oversight framework that balances agent autonomy with stakeholder control. It ensures that consequential decisions receive appropriate human review while routine operations proceed without bottlenecks.

### 11.2 Stakeholder Profile

The `stakeholder_profile` tool configures governance preferences:

**Profile structure:**

```json
{
  "stakeholder_id": "owner-001",
  "business_id": "biz1",
  "decision_style": "strategic-only",
  "risk_tolerance": "moderate",
  "approval_thresholds": {
    "budget": { "amount": 10000, "currency": "USD" },
    "hiring": { "headcount": 3 },
    "strategy": "always"
  },
  "auto_approve_categories": ["operational_routine", "minor_procurement", "internal_communication"],
  "communication_preferences": {
    "frequency": "daily-digest",
    "channels": ["dashboard", "email"],
    "urgent_override": true
  }
}
```

**Decision styles:**

| Style             | Description                                           |
| ----------------- | ----------------------------------------------------- |
| `hands-on`        | Review all decisions, including operational ones      |
| `strategic-only`  | Only review strategic and high-impact decisions       |
| `exception-based` | Only review decisions that agents flag as exceptional |

**Risk tolerance levels:**

| Level          | Behavior                                          |
| -------------- | ------------------------------------------------- |
| `conservative` | Lower thresholds; more decisions require approval |
| `moderate`     | Standard thresholds as configured                 |
| `aggressive`   | Higher thresholds; agents have more autonomy      |

### 11.3 Governance Check

The `governance_check` tool is called by agents before taking consequential actions:

**Check process:**

```
Input: action_type, action_details, estimated_impact

1. Load stakeholder profile for the business
2. Determine action category (budget, hiring, strategy, operational)
3. Compare against approval thresholds:
   - Budget: estimated_cost > threshold.amount?
   - Hiring: headcount > threshold.headcount?
   - Strategy: always requires approval?
4. Check auto_approve_categories: is this category auto-approved?
5. Apply risk tolerance modifier:
   - conservative: threshold * 0.7
   - moderate: threshold * 1.0
   - aggressive: threshold * 1.5

Output:
{
  "requires_approval": true | false,
  "reason": "Budget exceeds threshold of $10,000",
  "relevant_threshold": { "category": "budget", "value": 10000 },
  "recommended_action": "Submit to decision queue"
}
```

### 11.4 Decision Request

The `decision_request` tool creates an entry in the decision queue:

**Decision record:**

```json
{
  "decision_id": "dec-uuid-v4",
  "agent_id": "biz1-cfo",
  "business_id": "biz1",
  "description": "Approve $25,000 marketing budget for Q2 campaign",
  "impact_analysis": {
    "financial": "25% of quarterly marketing budget",
    "strategic": "Supports customer acquisition goal",
    "risk": "Medium - ROI uncertain for new channel"
  },
  "options": [
    {
      "label": "Approve full budget",
      "description": "Fund the complete campaign as proposed",
      "risk_level": "medium"
    },
    {
      "label": "Approve reduced budget",
      "description": "Fund at 60% with milestone-based release",
      "risk_level": "low"
    },
    {
      "label": "Reject",
      "description": "Do not fund; redirect budget to proven channels",
      "risk_level": "low"
    }
  ],
  "recommended_option": "Approve reduced budget",
  "status": "pending",
  "created_at": "2026-02-24T14:00:00Z"
}
```

**Storage:** Decision records are appended to `businesses/{id}/decision-queue.json`.

**Visibility:** Pending decisions are surfaced through:

- The `business_status` tool (shows count per business).
- The REST API at `/mabos/api/decisions`.
- The dashboard (real-time via SSE).

### 11.5 Decision Review and Resolution

**Review (`decision_review`):**

1. Loads the stakeholder profile.
2. Loads the decision queue, filtering for pending decisions.
3. Enriches each decision with governance context (relevant thresholds, risk tolerance).
4. Returns decisions with recommended actions based on the profile.

**Resolution (`decision_resolve`):**

The stakeholder resolves a decision with one of four outcomes:

| Outcome    | Description                                                                  |
| ---------- | ---------------------------------------------------------------------------- |
| `approved` | Action proceeds as proposed                                                  |
| `rejected` | Action is denied; agent must find alternatives                               |
| `deferred` | Decision is postponed; agent should revisit later                            |
| `modified` | Action is approved with modifications (additional conditions, reduced scope) |

**Resolution record:**

```json
{
  "decision_id": "dec-uuid-v4",
  "outcome": "modified",
  "resolver": "owner-001",
  "rationale": "Approve with milestone gates: $10k initial, $15k upon 50% target achievement",
  "conditions": [
    "Monthly progress reports required",
    "Cancel authority if CAC exceeds $50 after 30 days"
  ],
  "modified_options": {
    "budget": 25000,
    "release_schedule": "milestone-based"
  },
  "resolved_at": "2026-02-24T16:00:00Z"
}
```

**Post-resolution:**

The requesting agent is notified via an INFORM message in its inbox. The agent's BDI cycle picks up the resolution during the PERCEIVE phase and updates beliefs accordingly.

### 11.6 Decision Flow

```
Agent identifies consequential action
         |
         v
governance_check(action)
         |
    +----+----+
    |         |
    v         v
 No approval  Requires approval
 needed       |
    |         v
    |    decision_request(...)
    |         |
    |         v
    |    Decision enters queue
    |         |
    |         v
    |    Stakeholder reviews
    |    (decision_review)
    |         |
    |    +----+----+----+
    |    |    |    |    |
    |    v    v    v    v
    |  Appr  Rej  Def  Mod
    |    |    |    |    |
    |    v    v    v    v
    |    decision_resolve(...)
    |         |
    |         v
    |    Agent notified (INFORM)
    |         |
    v         v
Agent proceeds with action
(or adjusts based on resolution)
```

---

## 12. Workforce Management

### 12.1 Overview

The workforce management subsystem provides tools for managing external contractors and delegating work through structured work packages. It bridges the agent coordination layer with human workforce operations.

### 12.2 Contractor Management

**Registration (`contractor_add`):**

```json
{
  "contractor_id": "cont-uuid-v4",
  "name": "Jane Smith",
  "skills": ["python", "data-analysis", "machine-learning"],
  "hourly_rate": 85,
  "availability": "part-time",
  "contact": "jane@example.com",
  "trust_score": 0.5,
  "trust_history": [],
  "registered_at": "2026-02-24T10:00:00Z"
}
```

**Initial trust score:** All contractors start with a trust score of 0.5 (neutral). This represents neither trust nor distrust -- the system has no evidence either way.

**Listing and filtering (`contractor_list`):**

Contractors can be filtered by:

- Required skills (intersection matching).
- Minimum trust score threshold.
- Availability status.

### 12.3 Trust Scoring System

The trust scoring system implements a simple but effective reputation mechanism:

**Trust update formula:**

```
new_trust = current_trust + (quality_adjustment * 0.1)
```

Where `quality_adjustment` is:

- `+1` for satisfactory or above work.
- `-1` for unsatisfactory work.
- `0` for neutral (no change).

The 0.1 step size means trust changes gradually -- it takes multiple positive interactions to build high trust, and multiple negative interactions to significantly reduce it.

**Score clamping:** Trust is always clamped to [0.0, 1.0].

**Trust history:**

Every trust update is recorded:

```json
{
  "timestamp": "2026-02-24T16:00:00Z",
  "previous_score": 0.5,
  "new_score": 0.6,
  "quality_rating": "satisfactory",
  "reason": "Completed analytics dashboard on time with good quality",
  "work_package_id": "wp-001"
}
```

**Trust thresholds:**

| Range     | Interpretation                                 |
| --------- | ---------------------------------------------- |
| 0.0 - 0.3 | Low trust; contractor has history of poor work |
| 0.3 - 0.5 | Below average; caution advised                 |
| 0.5       | Neutral (new contractor, no history)           |
| 0.5 - 0.7 | Positive track record                          |
| 0.7 - 1.0 | Highly trusted; consistently delivers quality  |

### 12.4 Work Packages

Work packages are the primary unit of work delegation:

**Work package structure:**

```json
{
  "work_package_id": "wp-uuid-v4",
  "title": "Customer Analytics Dashboard - Frontend",
  "description": "Build the React-based dashboard for customer analytics...",
  "required_skills": ["react", "typescript", "data-visualization"],
  "priority": "high",
  "deadline": "2026-04-01",
  "budget": 15000,
  "status": "draft",
  "contractor_id": null,
  "progress": 0,
  "notes": [],
  "created_at": "2026-02-24T10:00:00Z"
}
```

**Status lifecycle:**

```
draft --> open --> assigned --> in_progress --> review --> completed
  |                                              |
  +------- (any status can go to) -----> cancelled
```

| Status        | Description                                      |
| ------------- | ------------------------------------------------ |
| `draft`       | Work package is being defined; not yet available |
| `open`        | Available for assignment; auto-matching runs     |
| `assigned`    | Contractor selected; awaiting start              |
| `in_progress` | Work is actively being performed                 |
| `review`      | Work submitted for quality review                |
| `completed`   | Work accepted; trust score updated               |

### 12.5 Auto-Matching

When a work package enters the `open` status, the system automatically identifies suitable contractors:

**Matching algorithm:**

```
For each contractor C in contractor pool:
    1. Compute skill_overlap = |C.skills INTERSECT wp.required_skills| / |wp.required_skills|
    2. Check trust threshold: C.trust_score >= 0.5
    3. Check availability: C.availability != "unavailable"
    4. If skill_overlap > 0 AND trust >= 0.5 AND available:
        Add C to candidate list with score = skill_overlap * C.trust_score

Sort candidates by score descending
Return top candidates
```

### 12.6 Work Package Assignment and Tracking

**Assignment (`work_package_assign`):**

- Updates status to `assigned`.
- Records `contractor_id`.
- Sends notification to the contractor.

**Progress tracking (`work_package_update`):**

- `progress`: Integer percentage (0-100).
- `notes`: Timestamped progress notes.
- Status transitions tracked with timestamps.

**Completion trigger:**

When a work package reaches `completed` status, the system automatically triggers a trust score update based on the quality rating provided by the reviewing agent.

---

## 13. Agent-to-Human Handoff Protocol

### 13.1 Purpose

The handoff protocol enables smooth context transfer between agents and human operators. This is essential for:

- Human operators taking over from an agent when the agent's capabilities are exceeded.
- Agents resuming work after a human operator has made manual interventions.
- Shift changes or escalation scenarios.

### 13.2 Handoff Directions

| Direction        | Scenario                                       |
| ---------------- | ---------------------------------------------- |
| `agent_to_human` | Agent transfers work to a human operator       |
| `human_to_agent` | Human operator transfers work back to an agent |

### 13.3 Handoff Payload

The `handoff` tool transfers the following context:

```json
{
  "handoff_id": "ho-uuid-v4",
  "direction": "agent_to_human",
  "from": "biz1-coo",
  "to": "human-operator-1",
  "context_summary": "Operations review identified supply chain bottleneck affecting Q2 targets. Three vendors evaluated; negotiations stalled with preferred vendor on payment terms.",
  "active_tasks": [
    {
      "task_id": "t-001",
      "description": "Negotiate vendor payment terms",
      "status": "in_progress",
      "blockers": ["Vendor requires NET-15; company policy is NET-30"]
    }
  ],
  "open_decisions": [
    {
      "decision_id": "dec-005",
      "description": "Approve NET-15 exception for critical vendor",
      "status": "pending"
    }
  ],
  "artifacts": [
    {
      "name": "Vendor comparison matrix",
      "path": "businesses/biz1/artifacts/vendor-comparison.xlsx"
    },
    {
      "name": "Negotiation transcript",
      "path": "agents/biz1-coo/memory/vendor-negotiation-log.md"
    }
  ],
  "timestamp": "2026-02-24T17:00:00Z"
}
```

### 13.4 Handoff Recording

The handoff is recorded in two locations:

1. **Agent's Memory.md**: An episodic memory entry documenting the handoff context, reason, and state at time of transfer.
2. **Business decision log**: A record in the business's decision queue noting the handoff for governance audit purposes.

This dual recording ensures that:

- The agent can recall the handoff context if work is transferred back.
- The business has a complete audit trail of human-agent transitions.

---

## 14. BPMN 2.0 Workflow Engine

### 14.1 Overview

The workflow engine implements a subset of BPMN 2.0 sufficient for modeling and executing business processes within the multi-agent system. Workflows define the sequence of tasks, events, and decisions that agents follow to accomplish business objectives.

### 14.2 Workflow Structure

A workflow contains four primary collections:

```json
{
  "workflow_id": "wf-uuid-v4",
  "name": "Customer Onboarding Process",
  "description": "End-to-end process for onboarding new enterprise customers",
  "business_id": "biz1",
  "elements": [],
  "flows": [],
  "pools": [],
  "lanes": [],
  "status": "draft",
  "created_at": "2026-02-24T10:00:00Z"
}
```

### 14.3 BPMN Element Types

**Events:**

| Type           | Description           | Behavior                                     |
| -------------- | --------------------- | -------------------------------------------- |
| `startEvent`   | Process entry point   | Triggers process execution                   |
| `endEvent`     | Process termination   | Completes process, releases resources        |
| `timerEvent`   | Time-based trigger    | Fires at specified time or after duration    |
| `messageEvent` | Message-based trigger | Fires when specific ACL message is received  |
| `signalEvent`  | Broadcast trigger     | Fires when a named signal is emitted         |
| `errorEvent`   | Error handler         | Fires when an error occurs in connected task |

**Tasks:**

| Type               | Description            | Execution                                  |
| ------------------ | ---------------------- | ------------------------------------------ |
| `userTask`         | Requires human action  | Assigned to agent or human via lane        |
| `serviceTask`      | Automated service call | Executed by system/tool invocation         |
| `scriptTask`       | Script execution       | Runs embedded or referenced script         |
| `businessRuleTask` | Rule evaluation        | Evaluates business rules, returns decision |

**Gateways:**

| Type               | Symbol | Behavior                                                          |
| ------------------ | ------ | ----------------------------------------------------------------- |
| `exclusiveGateway` | XOR    | Routes to exactly one outgoing path based on conditions           |
| `parallelGateway`  | AND    | Forks: activates all outgoing paths; Join: waits for all incoming |
| `inclusiveGateway` | OR     | Routes to one or more outgoing paths based on conditions          |

**Subprocess:**

A subprocess encapsulates a group of elements that can be collapsed/expanded and potentially reused across workflows.

### 14.4 Element Structure

Each BPMN element follows this structure:

```json
{
  "id": "elem-uuid-v4",
  "type": "userTask",
  "name": "Review Contract Terms",
  "description": "Legal agent reviews and approves contract terms for new vendor",
  "lane": "Legal",
  "properties": {
    "assignee": "biz1-legal",
    "due_date": "2026-03-01",
    "form_fields": ["contract_type", "vendor_name", "total_value"]
  }
}
```

### 14.5 Sequence Flows

Flows connect elements to define execution order:

```json
{
  "id": "flow-uuid-v4",
  "source": "elem-gateway-1",
  "target": "elem-task-2",
  "condition": "contract_value > 50000"
}
```

**Conditional flows:**

Flows from gateways can carry conditions. For exclusive gateways, exactly one condition must evaluate to true. For inclusive gateways, one or more conditions may be true.

### 14.6 Pools and Lanes

**Pools** represent organizational boundaries (e.g., the business itself, an external partner).

**Lanes** subdivide pools by role:

```json
{
  "lane_id": "lane-uuid-v4",
  "pool_id": "pool-biz1",
  "name": "Legal",
  "role": "biz1-legal",
  "elements": ["elem-review-contract", "elem-approve-terms"]
}
```

Lanes map directly to agent roles, enabling clear responsibility assignment. When a task is in a lane, it is the responsibility of the agent assigned to that lane's role.

### 14.7 Workflow Validation

The `workflow_validate` tool performs structural validation:

**Checks performed:**

| Check               | Description                                                               | Severity |
| ------------------- | ------------------------------------------------------------------------- | -------- |
| Orphan nodes        | Elements with no incoming AND no outgoing flows (except start/end events) | Warning  |
| Missing start event | Workflow has no startEvent element                                        | Error    |
| Missing end event   | Workflow has no endEvent element                                          | Error    |
| Disconnected paths  | Elements not reachable from start event                                   | Warning  |
| Dead-end paths      | Paths that lead to neither an end event nor a gateway                     | Warning  |
| Gateway imbalance   | Parallel fork without corresponding join                                  | Warning  |

**Validation output:**

```json
{
  "valid": false,
  "errors": [
    {
      "type": "missing_end_event",
      "message": "Workflow has no endEvent",
      "element": null
    }
  ],
  "warnings": [
    {
      "type": "orphan_node",
      "message": "Element 'Review Budget' has no incoming or outgoing flows",
      "element": "elem-review-budget"
    }
  ]
}
```

### 14.8 TypeDB Persistence

Workflows can be persisted to TypeDB for rich querying and relationship modeling, or fall back to JSON file storage when TypeDB is unavailable:

- **TypeDB mode**: Workflow elements are stored as entities with relations for flows, lane assignments, and pool membership. This enables queries like "find all tasks assigned to the Legal role across all workflows."
- **JSON fallback**: The complete workflow structure is serialized to a JSON file under the business directory.

---

## 15. Business Venture System

### 15.1 Business Creation Pipeline

The `business_create` tool orchestrates the full creation of a multi-agent business venture:

**Input parameters:**

```json
{
  "name": "TechFlow Analytics",
  "type": "saas",
  "description": "B2B analytics platform for mid-market companies"
}
```

**Supported business types:**

| Type          | Description           | Specialized templates                            |
| ------------- | --------------------- | ------------------------------------------------ |
| `ecommerce`   | Online retail         | Inventory, logistics, customer service workflows |
| `saas`        | Software as a Service | Development, subscription, support workflows     |
| `consulting`  | Professional services | Client management, engagement, billing workflows |
| `marketplace` | Two-sided marketplace | Supply/demand matching, trust/safety workflows   |
| `retail`      | Physical retail       | Inventory, POS, supply chain workflows           |
| `other`       | Custom business type  | Generic business workflows                       |

**Creation sequence:**

```
1. Create business directory: businesses/{biz_id}/
2. Initialize shared files:
   - decision-queue.json (empty queue)
   - metrics.json (zeroed KPIs)
3. For each of 9 C-suite roles:
   a. Create agent directory: agents/{biz_id}-{role}/
   b. Generate 10 cognitive files with role-specific content
   c. Initialize inbox.json
   d. Register agent in business manifest
4. Return business ID and agent roster
```

### 15.2 Cognitive File Initialization

Each agent's cognitive files are pre-written with role-appropriate content.

**Example: CFO agent initial Persona.md:**

```markdown
# Persona: Chief Financial Officer

## Role

Financial steward of TechFlow Analytics, responsible for fiscal health,
budgeting, financial reporting, and risk management.

## Behavioral Guidelines

- Always evaluate decisions through a financial lens
- Maintain conservative projections; flag optimistic assumptions
- Require ROI analysis for expenditures exceeding $5,000
- Escalate budget overruns immediately to CEO and stakeholder

## Decision Authority

- Approve expenditures up to $10,000 independently
- Recommend (but not approve) expenditures above $10,000
- Authority over financial reporting format and frequency

## Communication Style

- Data-driven; cite numbers and trends
- Risk-aware; always mention downside scenarios
- Concise; lead with the bottom line
```

**Example: CFO agent initial Beliefs.md:**

```markdown
# Beliefs

## Environment

- Market conditions: [Awaiting initial market analysis]
- Regulatory environment: [Standard compliance requirements assumed]

## Self

- Available budget: $0 (awaiting initial capitalization)
- Financial reporting: Not yet established
- Risk assessment capability: Ready

## Other Agents

- CEO: Primary authority for strategic financial decisions
- COO: Key partner for operational cost management
- CMO: Requires budget approval for marketing expenditures
```

### 15.3 Business Status Monitoring

**`business_list`:**

Returns all businesses with:

- Business ID, name, type.
- Status (active, paused, archived).
- Count of pending decisions in the decision queue.

**`business_status`:**

Returns detailed status including:

- Business metadata.
- Per-agent inbox message counts (indicating communication activity).
- Pending decision count and summaries.
- Current metrics snapshot.

### 15.4 Onboarding Pipeline

The REST API endpoint `/mabos/api/onboard` provides a full onboarding flow:

1. Creates the business entity.
2. Spawns all 9 agents.
3. Injects initial personas and beliefs.
4. Optionally triggers an initial BDI cycle for each agent.
5. Creates default workflows based on business type.
6. Returns the complete business state for dashboard display.

---

## 16. BDI Runtime Service

### 16.1 Architecture

The BDI runtime is a background service that performs periodic maintenance on all agents' cognitive states. It is implemented in `bdi-runtime/index.ts` and integrated into the extension via `createBdiService()` and `registerService()`.

### 16.2 Heartbeat Configuration

- **Default interval:** 30 minutes.
- **Configurable:** Can be adjusted via extension settings.
- **Scope:** Runs across all discovered agents (not per-business).

### 16.3 Agent Discovery

The `discoverAgents()` function:

1. Scans the `agents/` directory for subdirectories.
2. Checks each subdirectory for the presence of `Persona.md` or `Beliefs.md`.
3. Returns a list of agent IDs and their directory paths.

This file-system-based discovery avoids the need for a central agent registry, supporting dynamic agent creation and removal.

### 16.4 Maintenance Cycle

The `runMaintenanceCycle()` function performs the following for each discovered agent:

**1. Intention Pruning:**

```
For each active intention:
    Load commitment strategy (single-minded | open-minded | cautious)
    Check last progress update timestamp
    If stalled beyond strategy-specific threshold:
        single-minded: only if proven impossible
        open-minded: 7 days without progress
        cautious: 3 days without progress
    Mark stale intentions for reconsideration
    Log pruning action to Memory.md
```

**2. Desire Re-sorting:**

```
Load all active desires
Recompute priorities using the priority formula
Sort by computed priority (descending)
Write updated order to Desires.md
```

**3. Belief Processing:**

For agents with large belief bases, processing is chunked:

```
Load Beliefs.md
Split into sections (by heading)
Process in chunks of 50 sections per cycle
For each chunk:
    Check for stale beliefs (last updated > threshold)
    Check for contradictory beliefs
    Flag inconsistencies
```

**4. Belief Conflict Detection:**

```
For each pair of beliefs (B1, B2) where:
    B1.subject == B2.subject AND
    B1.certainty > 0.7 AND
    B2.certainty > 0.7 AND
    B1.content conflicts with B2.content:

    Create conflict report:
        agent_id, belief_1, belief_2, detected_at

    Write to: memory/bdi-conflicts/YYYY-MM-DD.md
```

**Conflict report format:**

```markdown
# BDI Conflict Report - 2026-02-24

## Agent: biz1-cfo

### Conflict 1

- **Belief A**: "Market growth rate is 15% YoY" (certainty: 0.8)
- **Belief B**: "Market is contracting" (certainty: 0.75)
- **Detected**: 2026-02-24T14:30:00Z
- **Recommendation**: Reconcile with updated market data
```

### 16.5 Service Integration

The `createBdiService()` factory function returns a service object compatible with the extension's `registerService()` API:

```typescript
interface BdiService {
  start(): void; // Begin heartbeat interval
  stop(): void; // Clear interval
  runNow(): Promise<void>; // Trigger immediate maintenance cycle
  getStatus(): ServiceStatus; // Return running/stopped + last cycle timestamp
}
```

---

## 17. REST API Layer

### 17.1 Overview

The extension entry point (`index.ts`, 3270 lines) registers 99 tools and exposes a REST API with authentication and rate limiting. The following endpoints are relevant to the coordination subsystem.

### 17.2 Decision Endpoints

| Method | Path                               | Description                                  |
| ------ | ---------------------------------- | -------------------------------------------- |
| GET    | `/mabos/api/decisions`             | List pending decisions across all businesses |
| GET    | `/mabos/api/decisions/:id`         | Get a specific decision by ID                |
| POST   | `/mabos/api/decisions/:id/resolve` | Resolve a pending decision                   |

**GET `/mabos/api/decisions`** response:

```json
{
  "decisions": [
    {
      "decision_id": "dec-001",
      "business_id": "biz1",
      "agent_id": "biz1-cfo",
      "description": "Approve Q2 marketing budget",
      "status": "pending",
      "created_at": "2026-02-24T14:00:00Z",
      "options_count": 3,
      "recommended_option": "Approve reduced budget"
    }
  ],
  "total": 1,
  "pending": 1
}
```

### 17.3 Agent Endpoints

| Method | Path                            | Description                      |
| ------ | ------------------------------- | -------------------------------- |
| GET    | `/mabos/api/agents/:id`         | Get agent detail including inbox |
| GET    | `/mabos/api/agents/:id/inbox`   | Get agent inbox messages         |
| POST   | `/mabos/api/agents/:id/message` | Send a message to an agent       |

### 17.4 Business Endpoints

| Method | Path                               | Description                      |
| ------ | ---------------------------------- | -------------------------------- |
| GET    | `/mabos/api/businesses`            | List all businesses              |
| POST   | `/mabos/api/businesses`            | Create a new business            |
| GET    | `/mabos/api/businesses/:id`        | Get business detail              |
| GET    | `/mabos/api/businesses/:id/agents` | List agents in a business        |
| POST   | `/mabos/api/businesses/:id/agents` | Create a new agent in a business |
| GET    | `/mabos/api/businesses/:id/goals`  | Get Tropos goal model            |
| POST   | `/mabos/api/businesses/:id/goals`  | Create/update goal model         |
| GET    | `/mabos/api/businesses/:id/tasks`  | Get tasks parsed from Plans.md   |

### 17.5 Workflow Endpoints

| Method | Path                                | Description                 |
| ------ | ----------------------------------- | --------------------------- |
| GET    | `/mabos/api/workflows`              | List all workflows          |
| POST   | `/mabos/api/workflows`              | Create a new workflow       |
| GET    | `/mabos/api/workflows/:id`          | Get workflow detail         |
| PUT    | `/mabos/api/workflows/:id`          | Update workflow             |
| DELETE | `/mabos/api/workflows/:id`          | Delete workflow             |
| POST   | `/mabos/api/workflows/:id/validate` | Validate workflow structure |

### 17.6 BDI Endpoints

| Method | Path                    | Description                               |
| ------ | ----------------------- | ----------------------------------------- |
| POST   | `/mabos/api/bdi/cycle`  | Manually trigger a BDI cycle for an agent |
| GET    | `/mabos/api/bdi/status` | Get BDI runtime service status            |

### 17.7 Chat and Events Endpoints

| Method | Path                     | Description                                                  |
| ------ | ------------------------ | ------------------------------------------------------------ |
| POST   | `/mabos/api/chat`        | Send a message to the dashboard chat (routes to agent inbox) |
| GET    | `/mabos/api/chat/events` | SSE endpoint for real-time agent events                      |

### 17.8 Onboarding Endpoint

| Method | Path                 | Description                                  |
| ------ | -------------------- | -------------------------------------------- |
| POST   | `/mabos/api/onboard` | Full business onboarding with agent spawning |

**POST `/mabos/api/onboard`** request:

```json
{
  "business_name": "TechFlow Analytics",
  "business_type": "saas",
  "description": "B2B analytics platform",
  "stakeholder": {
    "decision_style": "strategic-only",
    "risk_tolerance": "moderate"
  }
}
```

### 17.9 Authentication and Rate Limiting

- All API endpoints require authentication (token-based).
- Rate limiting is applied per-endpoint to prevent abuse.
- Decision resolution endpoints have additional authorization checks to ensure only stakeholders can resolve decisions.

---

## 18. Real-Time Events and SSE Streaming

### 18.1 Server-Sent Events (SSE)

The `/mabos/api/chat/events` endpoint provides a real-time event stream using Server-Sent Events (SSE). This enables the dashboard and external systems to receive live updates about agent activities.

### 18.2 Event Types

| Event Type          | Trigger                                        | Payload                                  |
| ------------------- | ---------------------------------------------- | ---------------------------------------- |
| `agent_message`     | ACL message sent between agents                | Message summary (from, to, performative) |
| `decision_created`  | Agent creates a decision request               | Decision ID, description, agent          |
| `decision_resolved` | Stakeholder resolves a decision                | Decision ID, outcome                     |
| `work_assigned`     | Work package assigned to contractor            | Work package ID, contractor, title       |
| `work_completed`    | Work package completed                         | Work package ID, quality rating          |
| `bdi_cycle`         | BDI cycle completed                            | Agent ID, beliefs updated, actions taken |
| `contract_net`      | CFP created, proposal submitted, or award made | CFP ID, phase, participants              |
| `workflow_update`   | Workflow element state change                  | Workflow ID, element ID, new state       |
| `handoff`           | Agent-to-human or human-to-agent handoff       | Handoff direction, participants          |

### 18.3 Event Format

```
event: agent_message
data: {"type":"agent_message","from":"biz1-ceo","to":"biz1-cto","performative":"REQUEST","timestamp":"2026-02-24T10:30:00Z"}

event: decision_created
data: {"type":"decision_created","decision_id":"dec-001","agent":"biz1-cfo","description":"Approve Q2 budget","timestamp":"2026-02-24T14:00:00Z"}
```

### 18.4 Agent Event Bus

Internally, events are published to an agent event bus that:

1. Captures all coordination events (messages, decisions, work packages, BDI cycles).
2. Buffers events for SSE delivery.
3. Supports filtering by business ID or agent ID.
4. Provides replay capability for clients that reconnect.

---

## 19. Data Flow Diagrams

### 19.1 Message Flow

```
Agent A                    File System                   Agent B
   |                          |                             |
   | 1. agent_message()       |                             |
   |------------------------->|                             |
   |    Write to              |                             |
   |    agents/B/inbox.json   |                             |
   |                          |                             |
   |                          | 2. BDI PERCEIVE phase       |
   |                          |<----------------------------|
   |                          |    Read inbox.json           |
   |                          |                             |
   |                          | 3. Process message           |
   |                          |--------------------------->|
   |                          |    Update beliefs            |
   |                          |    Add to pending actions    |
   |                          |                             |
   |                          | 4. BDI ACT phase            |
   |                          |<----------------------------|
   | 5. Reply message          |    agent_message(reply)     |
   |<-------------------------|                             |
   |    Write to              |                             |
   |    agents/A/inbox.json   |                             |
   |                          |                             |
```

### 19.2 Decision Flow

```
Agent              Decision Queue          Stakeholder           Agent
  |                     |                      |                   |
  | governance_check()  |                      |                   |
  |--+                  |                      |                   |
  |  | requires_approval|                      |                   |
  |<-+                  |                      |                   |
  |                     |                      |                   |
  | decision_request()  |                      |                   |
  |-------------------->|                      |                   |
  |    Write to         |                      |                   |
  |    decision-queue   |                      |                   |
  |                     |                      |                   |
  |                     | decision_review()    |                   |
  |                     |<---------------------|                   |
  |                     |    Read + enrich     |                   |
  |                     |--------------------->|                   |
  |                     |                      |                   |
  |                     | decision_resolve()   |                   |
  |                     |<---------------------|                   |
  |                     |    Update queue       |                   |
  |                     |                      |                   |
  | INFORM (resolution) |                      |                   |
  |<--------------------|                      |                   |
  |    Via inbox        |                      |                   |
  |                     |                      |                   |
```

### 19.3 Work Delegation Flow

```
Manager Agent        Workforce System        Contractor Pool       Contractor
     |                    |                       |                     |
     | work_package_create|                       |                     |
     |------------------>|                       |                     |
     |                    |                       |                     |
     |                    | Auto-match            |                     |
     |                    |---+                   |                     |
     |                    |   | Find candidates   |                     |
     |                    |   | (skills + trust)  |                     |
     |                    |<--+                   |                     |
     |                    |                       |                     |
     | Candidates list    |                       |                     |
     |<------------------|                       |                     |
     |                    |                       |                     |
     | work_package_assign|                       |                     |
     |------------------>|                       |                     |
     |                    | Update status         |                     |
     |                    |---+                   |                     |
     |                    |   | "assigned"        |                     |
     |                    |<--+                   |                     |
     |                    |                       |                     |
     |                    | Notification          |                     |
     |                    |-------------------------------------->|
     |                    |                       |                     |
     |                    |                       |     Progress updates|
     |                    |<--------------------------------------|
     |                    |                       |                     |
     |                    | work_package_update   |                     |
     |                    |---+                   |                     |
     |                    |   | "completed"       |                     |
     |                    |<--+                   |                     |
     |                    |                       |                     |
     |                    | contractor_trust_update                     |
     |                    |---------------------->|                     |
     |                    |    Adjust score       |                     |
     |                    |                       |                     |
```

### 19.4 Full Coordination Cycle

This diagram shows how a single business objective flows through all coordination subsystems:

```
Stakeholder sets strategic goal
         |
         v
CEO agent receives goal (Beliefs update)
         |
         v
BDI Cycle: PERCEIVE
    Update beliefs from inbox, metrics, environment
         |
         v
BDI Cycle: DELIBERATE
    Create desire (desire_create)
    Evaluate priorities (desire_evaluate)
    Commit to intention (intention_commit)
         |
         v
BDI Cycle: PLAN
    Search plan library (plan_library_search)
    HTN decompose if needed (htn_decompose)
    Generate plan (plan_generate)
    Assess risks
         |
         v
BDI Cycle: ACT
    +---> governance_check: Does this need approval?
    |         |
    |    +----+----+
    |    |         |
    |    No        Yes --> decision_request --> [wait for resolution]
    |    |
    |    v
    +---> Delegate to other agents:
    |         |
    |    +----+----+
    |    |         |
    |    Direct    Competitive
    |    Request   Bidding
    |    (ACL      (contract_net_initiate
    |    REQUEST)   --> proposals --> award)
    |         |
    |         v
    +---> Create work packages:
    |    work_package_create --> auto-match --> assign
    |         |
    |         v
    +---> Execute primitive steps:
    |    plan_execute_step
    |         |
    |         v
    +---> Update workflows:
         bpmn workflow element state changes
         |
         v
BDI Cycle: LEARN
    Record outcomes
    Update beliefs (belief_update)
    Store lessons (Lessons.md)
    Update trust scores
    Store plan in library for CBR
         |
         v
    [Next cycle]
```

---

## 20. Tool Catalog

### 20.1 Overview

The coordination subsystem provides 44 tools across 9 modules. This catalog provides a quick reference with parameter summaries.

### 20.2 Communication Tools (5 tools)

**Module:** `communication-tools.ts`

| #   | Tool                    | Parameters                                                                                                                                                                    | Output                              |
| --- | ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------- |
| 1   | `agent_message`         | `from`: agent_id, `to`: agent_id, `performative`: enum(8), `content`: object, `reply_to?`: msg_id, `conversation_id?`: string                                                 | Message ID, delivery confirmation   |
| 2   | `decision_request`      | `agent_id`: string, `business_id`: string, `description`: string, `impact_analysis`: object, `options`: array[{label, description, risk_level}], `recommended_option`: string | Decision ID                         |
| 3   | `contract_net_initiate` | `initiator`: agent_id, `task`: {description, required_skills, deadline}, `criteria`: {weights}                                                                                | CFP ID                              |
| 4   | `contract_net_propose`  | `cfp_id`: string, `proposer`: agent_id, `capabilities_match`: object, `estimated_effort`: object, `confidence`: float, `conditions`: array                                    | Proposal ID                         |
| 5   | `contract_net_award`    | `cfp_id`: string, `winning_proposal_id`: string                                                                                                                               | Award confirmation, work package ID |

### 20.3 Workforce Tools (8 tools)

**Module:** `workforce-tools.ts`

| #   | Tool                      | Parameters                                                                                                                                                                     | Output                                 |
| --- | ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------- |
| 6   | `contractor_add`          | `name`: string, `skills`: array, `hourly_rate`: number, `availability`: string, `contact`: string                                                                              | Contractor ID                          |
| 7   | `contractor_list`         | `skill_filter?`: array, `min_trust?`: float                                                                                                                                    | Array of contractors                   |
| 8   | `contractor_trust_update` | `contractor_id`: string, `quality_rating`: string, `reason`: string, `work_package_id?`: string                                                                                | Updated trust score                    |
| 9   | `work_package_create`     | `title`: string, `description`: string, `required_skills`: array, `priority`: enum, `deadline`: string, `budget`: number                                                       | Work package ID, candidate contractors |
| 10  | `work_package_assign`     | `work_package_id`: string, `contractor_id`: string                                                                                                                             | Assignment confirmation                |
| 11  | `work_package_update`     | `work_package_id`: string, `status?`: enum, `progress?`: int, `notes?`: string                                                                                                 | Updated work package                   |
| 12  | `work_package_list`       | `status_filter?`: enum, `contractor_filter?`: string                                                                                                                           | Array of work packages                 |
| 13  | `handoff`                 | `direction`: enum(agent_to_human, human_to_agent), `from`: string, `to`: string, `context_summary`: string, `active_tasks`: array, `open_decisions`: array, `artifacts`: array | Handoff ID                             |

### 20.4 Stakeholder Tools (4 tools)

**Module:** `stakeholder-tools.ts`

| #   | Tool                  | Parameters                                                                                                                                                                                            | Output                                          |
| --- | --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------- |
| 14  | `stakeholder_profile` | `stakeholder_id`: string, `business_id`: string, `decision_style`: enum, `risk_tolerance`: enum, `approval_thresholds`: object, `auto_approve_categories`: array, `communication_preferences`: object | Profile confirmation                            |
| 15  | `decision_review`     | `business_id`: string, `stakeholder_id`: string                                                                                                                                                       | Array of enriched pending decisions             |
| 16  | `decision_resolve`    | `decision_id`: string, `outcome`: enum(approved, rejected, deferred, modified), `resolver`: string, `rationale`: string, `conditions?`: array, `modified_options?`: object                            | Resolution confirmation                         |
| 17  | `governance_check`    | `business_id`: string, `action_type`: string, `action_details`: object, `estimated_impact`: object                                                                                                    | {requires_approval, reason, relevant_threshold} |

### 20.5 Workflow Tools (9 tools)

**Module:** `workflow-tools.ts`

| #   | Tool                | Parameters                                                                                                 | Output                                         |
| --- | ------------------- | ---------------------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| 18  | `workflow_create`   | `name`: string, `description`: string, `business_id`: string                                               | Workflow ID                                    |
| 19  | `workflow_delete`   | `workflow_id`: string                                                                                      | Deletion confirmation                          |
| 20  | `workflow_status`   | `workflow_id`: string                                                                                      | Execution status                               |
| 21  | `workflow_inspect`  | `workflow_id`: string                                                                                      | Full structure (elements, flows, pools, lanes) |
| 22  | `workflow_validate` | `workflow_id`: string                                                                                      | {valid, errors, warnings}                      |
| 23  | `bpmn_add_node`     | `workflow_id`: string, `id`: string, `type`: enum, `name`: string, `description?`: string, `lane?`: string | Element confirmation                           |
| 24  | `bpmn_remove_node`  | `workflow_id`: string, `element_id`: string                                                                | Removal confirmation                           |
| 25  | `bpmn_connect`      | `workflow_id`: string, `id`: string, `source`: elem_id, `target`: elem_id, `condition?`: string            | Flow confirmation                              |
| 26  | `bpmn_add_lane`     | `workflow_id`: string, `pool_id`: string, `name`: string, `role`: string                                   | Lane ID                                        |

### 20.6 Planning Tools (5 tools)

**Module:** `planning-tools.ts`

| #   | Tool                  | Parameters                                                                                                                                           | Output                                      |
| --- | --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------- |
| 27  | `plan_generate`       | `goal`: string, `constraints`: object, `context`: object                                                                                             | Structured plan with phases, steps, risks   |
| 28  | `plan_execute_step`   | `plan_id`: string, `step_id`: string, `status`: enum, `actual_duration?`: string, `outcome?`: string, `artifacts_produced?`: array, `notes?`: string | Step update confirmation                    |
| 29  | `htn_decompose`       | `task`: string, `current_state`: object, `methods?`: array                                                                                           | Ordered subtasks with preconditions/effects |
| 30  | `plan_library_search` | `query`: string, `domain?`: string, `agent_id?`: string                                                                                              | Matching plans with similarity scores       |
| 31  | `plan_adapt`          | `source_plan_id`: string, `new_context`: object, `negative_cases?`: array                                                                            | Adapted plan with provenance                |

### 20.7 Desire Tools (4 tools)

**Module:** `desire-tools.ts`

| #   | Tool                   | Parameters                                                                                                                                               | Output                                            |
| --- | ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------- |
| 32  | `desire_create`        | `description`: string, `type`: enum(terminal, instrumental), `base_priority`: float, `importance`: float, `urgency`: float, `strategic_alignment`: float | Desire ID, conflict warnings                      |
| 33  | `desire_evaluate`      | `agent_id`: string                                                                                                                                       | Ranked desires with computed priorities           |
| 34  | `desire_drop`          | `desire_id`: string, `reason`: string                                                                                                                    | Drop confirmation, cascaded drops                 |
| 35  | `intention_reconsider` | `agent_id`: string                                                                                                                                       | Per-intention recommendations (keep/suspend/drop) |

### 20.8 BDI Tools (6 tools)

**Module:** `bdi-tools.ts`

| #   | Tool               | Parameters                                                                                                                                                         | Output                                                               |
| --- | ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------- |
| 36  | `belief_get`       | `agent_id`: string, `category?`: enum(environment, self, agent, case)                                                                                              | Structured beliefs with certainty                                    |
| 37  | `belief_update`    | `agent_id`: string, `category`: enum, `subject`: string, `content`: string, `certainty`: float, `reason`: string                                                   | Update confirmation with revision log                                |
| 38  | `goal_create`      | `agent_id`: string, `description`: string, `tier`: enum(strategic, tactical, operational), `success_criteria`: string, `deadline?`: string, `parent_goal?`: string | Goal ID                                                              |
| 39  | `goal_evaluate`    | `agent_id`: string, `goal_id`: string                                                                                                                              | {status: on_track/at_risk/blocked/completed/failed, details}         |
| 40  | `intention_commit` | `agent_id`: string, `goal_id`: string, `plan_id`: string, `commitment_strategy`: enum, `resources_allocated`: object                                               | Intention ID                                                         |
| 41  | `bdi_cycle`        | `agent_id`: string                                                                                                                                                 | Cycle audit record (phases executed, actions taken, beliefs updated) |

### 20.9 Business Tools (3 tools)

**Module:** `business-tools.ts`

| #   | Tool              | Parameters                                          | Output                                              |
| --- | ----------------- | --------------------------------------------------- | --------------------------------------------------- |
| 42  | `business_create` | `name`: string, `type`: enum, `description`: string | Business ID, 9 agent IDs                            |
| 43  | `business_list`   | (none)                                              | Array of businesses with status and decision counts |
| 44  | `business_status` | `business_id`: string                               | Detailed status with per-agent inbox counts         |

---

## 21. File Layout and Directory Structure

### 21.1 Agent Directory

```
agents/
  {business_id}-{role}/
    Persona.md              # Agent identity and behavioral guidelines
    Beliefs.md              # Current belief base
    Desires.md              # Active desires ranked by priority
    Goals.md                # Goals organized by tier
    Plans.md                # Current execution plans
    Intentions.md           # Committed intentions
    Capabilities.md         # Skills and competencies
    Memory.md               # Episodic memory
    Lessons.md              # Extracted lessons learned
    Relationships.md        # Trust and interaction history with other agents
    inbox.json              # ACL message inbox
```

### 21.2 Business Directory

```
businesses/
  {business_id}/
    manifest.json           # Business metadata and agent roster
    decision-queue.json     # Pending decisions for stakeholder review
    metrics.json            # Business KPIs and performance metrics
    artifacts/              # Business artifacts (documents, reports)
    workflows/              # BPMN workflow definitions (JSON fallback)
```

### 21.3 Shared Infrastructure

```
memory/
  bdi-conflicts/
    YYYY-MM-DD.md           # Daily belief conflict reports

contractors/
  pool.json                 # Contractor registry with trust scores

work-packages/
  {wp_id}.json              # Individual work package records

plan-library/
  cases/
    {case_id}.json          # CBR case base for plan reuse
  templates/
    {domain}/               # Domain-specific plan templates
    base/                   # Generic plan templates
```

### 21.4 Source Code Modules

```
src/
  communication-tools.ts    # 5 tools: ACL messaging, Contract Net, decisions
  workforce-tools.ts        # 8 tools: contractors, work packages, handoff
  stakeholder-tools.ts      # 4 tools: governance, approval workflows
  workflow-tools.ts         # 9 tools: BPMN 2.0 workflow engine
  planning-tools.ts         # 5 tools: HTN, CBR, plan generation
  desire-tools.ts           # 4 tools: desire management, priority ranking
  bdi-tools.ts              # 6 tools: BDI core (beliefs, goals, intentions, cycle)
  business-tools.ts         # 3 tools: business creation and monitoring
  bdi-runtime/
    index.ts                # Background heartbeat service
  index.ts                  # Extension entry point (3270 lines, 99 tools, REST API)
```

---

## 22. Integration with Other Subsystems

### 22.1 Memory Subsystem

The coordination system integrates deeply with the memory subsystem:

- **Memory.md** stores episodic memories of coordination events (messages sent/received, decisions made, negotiations conducted).
- **Lessons.md** captures coordination lessons (e.g., "Agent X consistently underestimates effort; add 30% buffer").
- The BDI LEARN phase writes to both files after every cycle.
- The BDI PERCEIVE phase reads Memory.md to recall past interactions relevant to current situations.

### 22.2 Knowledge and Ontology

- **Fact Store (TypeDB)**: Beliefs are partially sourced from the TypeDB fact store. During PERCEIVE, agents query for facts relevant to their domain.
- **Ontology**: The knowledge ontology defines domain concepts used in beliefs, desires, and plans. For example, the ontology defines what "market segment" means, enabling agents to communicate unambiguously about market-related goals.
- **Knowledge Agent**: The Knowledge Management agent specifically maintains the organizational knowledge base, indexing lessons, cases, and ontological entries.

### 22.3 TypeDB Integration

TypeDB serves as the structured knowledge store:

- **Workflow persistence**: BPMN workflows can be stored as TypeDB entities with rich relationships, enabling queries across workflows.
- **Fact storage**: Domain facts with typed attributes and relationships.
- **Case base**: Plan cases for CBR retrieval can be stored in TypeDB for similarity queries.
- **Fallback**: When TypeDB is unavailable, the system falls back to JSON file storage for all data.

### 22.4 Tropos Goal Model

The REST API exposes Tropos goal model endpoints (`/mabos/api/businesses/:id/goals`) that integrate with the BDI goal hierarchy:

- Strategic goals from the Tropos model map to strategic-tier BDI goals.
- Dependency relationships between agents in the Tropos model inform the ACL communication patterns.
- Goal decomposition in Tropos aligns with HTN decomposition in the planning system.

### 22.5 Dashboard Integration

The coordination system provides data to the MABOS dashboard through:

- REST API endpoints for all coordination entities (decisions, agents, workflows, work packages).
- SSE streaming for real-time updates.
- Chat endpoint for interactive communication with agents (messages routed to agent inboxes).
- Task parsing from Plans.md for visual task tracking.

---

## 23. Operational Considerations

### 23.1 Scalability

**Agent count scaling:**

- Agent discovery is file-system-based, scanning `agents/` for subdirectories. This scales linearly with agent count.
- The BDI runtime processes agents sequentially in each maintenance cycle. With a 30-minute heartbeat and multiple businesses, cycle duration may become a concern beyond approximately 50-100 agents.
- Belief processing is chunked (50 sections per cycle) to handle large belief bases without memory pressure.

**Message volume:**

- Inbox files grow with unread messages. The BDI PERCEIVE phase should archive processed messages to prevent unbounded inbox growth.
- Contract Net broadcasts generate O(n) messages for n eligible agents per CFP.

### 23.2 Consistency

**File-based persistence:**

- Multiple agents writing to the same business's decision queue can create race conditions. The implementation should use atomic file writes or file locking.
- Inbox writes by multiple senders targeting the same agent require similar serialization.

**Belief consistency:**

- The BDI runtime detects belief conflicts during maintenance cycles, but conflicts can exist between cycles.
- Conflict detection is pairwise, with O(n^2) comparisons for n beliefs with the same subject. This is mitigated by only comparing high-certainty beliefs (certainty > 0.7).

### 23.3 Failure Modes

| Failure                     | Impact                           | Mitigation                                                         |
| --------------------------- | -------------------------------- | ------------------------------------------------------------------ |
| Agent inbox file corruption | Agent cannot receive messages    | Maintain inbox backup; reconstruct from senders' outbox records    |
| BDI runtime crash           | No maintenance cycles            | Auto-restart via service registration; manual trigger via REST API |
| TypeDB unavailable          | Workflow/fact store inaccessible | Automatic fallback to JSON file storage                            |
| Belief conflict spiral      | Agent has contradictory beliefs  | Conflict detection + daily reports; force reconciliation           |
| Stale intentions            | Agent pursues outdated goals     | Intention pruning based on commitment strategy thresholds          |

### 23.4 Monitoring

Key metrics to track:

- **BDI cycle duration** per agent (detect slow agents).
- **Inbox depth** per agent (detect communication bottlenecks).
- **Decision queue depth** (detect stakeholder decision backlog).
- **Trust score distribution** across contractor pool (detect trust inflation/deflation).
- **Plan success rate** (detect planning quality issues).
- **Belief conflict frequency** (detect information inconsistency).

### 23.5 Security Considerations

- REST API endpoints require authentication tokens.
- Rate limiting prevents abuse of coordination endpoints.
- Decision resolution endpoints enforce authorization (only designated stakeholders can resolve decisions).
- Agent impersonation is prevented by validating the `from` field against the authenticated agent identity.
- Sensitive business data in cognitive files should be access-controlled at the file system level.

---

## 24. References to Companion Architecture Documents

This document covers the multi-agent coordination and communication subsystem. For complete system understanding, refer to the following companion documents:

| Document                               | Coverage                                                                            |
| -------------------------------------- | ----------------------------------------------------------------------------------- |
| MABOS System Architecture Overview     | High-level system architecture, module map, deployment model                        |
| Agent Cognitive Architecture Reference | Deep dive into the 10 cognitive files, persona injection, cognitive file parsing    |
| Knowledge and Ontology System          | TypeDB schema, fact store, ontological reasoning, knowledge management tools        |
| Memory and Learning System             | Episodic memory, lesson extraction, case-based reasoning detail, Memory.md format   |
| REST API Reference                     | Complete API specification with request/response schemas for all 99 tools           |
| Dashboard Integration Guide            | Frontend architecture, SSE event handling, chat integration, workflow visualization |
| Deployment and Operations Guide        | Installation, configuration, TypeDB setup, monitoring, backup procedures            |

---

## Appendix A: Glossary

| Term             | Definition                                                                                       |
| ---------------- | ------------------------------------------------------------------------------------------------ |
| **ACL**          | Agent Communication Language; standardized message format for inter-agent communication          |
| **BDI**          | Belief-Desire-Intention; cognitive architecture for autonomous agents                            |
| **BPMN**         | Business Process Model and Notation; standard for business process modeling                      |
| **CBR**          | Case-Based Reasoning; solving new problems by adapting solutions from similar past cases         |
| **CFP**          | Call For Proposals; the announcement phase of the Contract Net Protocol                          |
| **CNP**          | Contract Net Protocol; market-based mechanism for task allocation                                |
| **FIPA**         | Foundation for Intelligent Physical Agents; organization that standardized agent communication   |
| **HTN**          | Hierarchical Task Network; planning approach that decomposes compound tasks into primitive tasks |
| **Performative** | The speech act type of an ACL message (REQUEST, INFORM, etc.)                                    |
| **Tropos**       | Agent-oriented software engineering methodology for goal modeling                                |
| **TypeDB**       | Strongly-typed database used for knowledge and ontology storage                                  |

## Appendix B: Priority Formula Quick Reference

```
priority = base_priority      * 0.30    (intrinsic importance)
         + importance          * 0.25    (business impact)
         + urgency             * 0.25    (time sensitivity)
         + strategic_alignment * 0.15    (strategy fit)
         + dependency_status   * 0.05    (actionability)
```

All components are normalized to [0, 1]. The computed priority is also in [0, 1].

## Appendix C: Commitment Strategy Comparison

| Property                        | Single-minded           | Open-minded            | Cautious              |
| ------------------------------- | ----------------------- | ---------------------- | --------------------- |
| Reconsider threshold (stall)    | Impossible only         | 7 days                 | 3 days                |
| Reconsider threshold (priority) | Never                   | New > current \* 1.3   | New > current \* 1.1  |
| Persistence                     | Maximum                 | Moderate               | Low                   |
| Adaptability                    | Minimum                 | Moderate               | High                  |
| Best for                        | Regulatory, contractual | General business goals | Fast-changing markets |

## Appendix D: Work Package Status Transitions

```
                +----------+
                |  draft   |
                +----+-----+
                     |
                     v
                +----------+
                |   open   |  <-- auto-matching runs here
                +----+-----+
                     |
                     v
                +----------+
                | assigned |
                +----+-----+
                     |
                     v
              +-----------+
              |in_progress|
              +----+------+
                   |
                   v
              +----------+
              |  review  |
              +----+-----+
                   |
                   v
              +-----------+
              | completed |  <-- trust update triggered here
              +-----------+

Note: Any status can transition to "cancelled"
```

## Appendix E: BPMN Element Type Reference

**Events (6 types):**

- `startEvent` -- Process begins
- `endEvent` -- Process terminates
- `timerEvent` -- Time-based trigger
- `messageEvent` -- ACL message trigger
- `signalEvent` -- Broadcast signal trigger
- `errorEvent` -- Error condition handler

**Tasks (4 types):**

- `userTask` -- Requires agent/human action
- `serviceTask` -- Automated service invocation
- `scriptTask` -- Script execution
- `businessRuleTask` -- Business rule evaluation

**Gateways (3 types):**

- `exclusiveGateway` (XOR) -- One path selected
- `parallelGateway` (AND) -- All paths activated
- `inclusiveGateway` (OR) -- One or more paths activated

**Other:**

- `subprocess` -- Encapsulated process fragment

---

_End of document._

_Document ID: MABOS-COORD-001 | Version: 1.0.0 | Multi-Agent Coordination and Communication System_
