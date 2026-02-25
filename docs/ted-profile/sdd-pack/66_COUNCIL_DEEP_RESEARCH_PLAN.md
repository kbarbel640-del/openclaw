# SDD 66: Council Deep Research Plan — AI Co-Work Critical Assessment

**Status:** Active
**Version:** v1
**Date:** 2026-02-25
**Council Mandate:** All 10 seats convened for comprehensive feature audit + industry benchmarking
**Purpose:** Deep research into AI co-work landscape, critique of TED features, identification of gaps, and architectural resilience patterns for non-destructive evolution.

---

## Research Mandate

The Council is tasked with answering five questions:

1. **What is the state of the art in AI co-work systems?** Who are the leading minds, what are they building, and what patterns have emerged?
2. **What is TED doing well?** Which features and architectural decisions are genuinely strong vs. the industry?
3. **What needs to change?** Where are we behind, misaligned, or over-engineered?
4. **What is missing?** What capabilities do leading co-work systems have that TED lacks?
5. **How do others handle non-destructive evolution?** How do competing systems allow code updates, feature additions, and architecture migrations without destroying user-built plans, workstreams, and configuration?

---

## Research Streams (6 parallel investigations)

### Stream 1: AI Co-Work Landscape Survey

**Assigned to:** Seat 1 (Systems Integration), Seat 2 (Deal Intelligence)
**Scope:**

- Survey leading AI co-work / AI assistant platforms (2024-2026):
  - Microsoft Copilot (M365 ecosystem integration)
  - Google Duet AI / Workspace AI
  - Notion AI + Notion Projects
  - Linear AI (project management)
  - Asana Intelligence
  - Monday AI
  - Dust.tt (custom AI assistants for teams)
  - Langchain/LangGraph agent frameworks
  - CrewAI, AutoGen, OpenAI Assistants API
  - Anthropic's Claude for Work / tool use patterns
- Identify: architecture patterns, governance models, integration strategies
- Compare: entry paths, state management, approval workflows

### Stream 2: Leading Minds & Research

**Assigned to:** Seat 3 (Output Quality), Seat 4 (Compliance)
**Scope:**

- Key researchers and practitioners:
  - Harrison Chase (LangChain) — agent architectures, tool use
  - Lilian Weng (OpenAI) — agent patterns, planning
  - Andrew Ng — agentic workflows, AI agents in enterprises
  - Ethan Mollick — organizational AI adoption, co-intelligence
  - Simon Willison — LLM tool use, datasette patterns
  - Swyx (Latent Space) — AI engineering patterns
  - Chip Huyen — ML systems design, real-time AI
  - Kanjun Qiu (Imbue) — reasoning agents
- Key papers/frameworks:
  - ReAct pattern, Reflexion, Plan-and-Execute
  - Human-in-the-loop agent design
  - Constitutional AI applied to enterprise workflows
- Extract: principles that validate or challenge TED's approach

### Stream 3: Feature Critique — Strengths Analysis

**Assigned to:** Seat 5 (GTD & Workflow), Seat 6 (Graph Integration)
**Scope:**

- Audit each TED subsystem against industry best practices:
  - Event-sourced ledger architecture (vs. CRUD approaches)
  - Draft state machine (6-state lifecycle vs. simple save/send)
  - Governance choke-point (single sidecar vs. distributed policy)
  - Builder Lane / self-improvement loop (vs. static systems)
  - Multi-tenant boundaries (vs. shared-context approaches)
  - Approval-gated writes (vs. autonomous action)
  - HIPAA hard gate (vs. opt-in compliance)
  - Progressive autonomy ladder (vs. binary on/off)
  - Contract-bound LLM outputs (vs. free-form generation)
  - Reconciliation engine (vs. one-way sync)

### Stream 4: Feature Critique — Weakness & Gap Analysis

**Assigned to:** Seat 7 (Risk & Escalation), Seat 8 (Adoption & Friction)
**Scope:**

- Identify where TED falls short:
  - Real-time collaboration (multi-user)
  - Natural language interface quality
  - Mobile / cross-platform experience
  - Onboarding complexity vs. time-to-value
  - Integration breadth (beyond M365)
  - Observability and debugging experience
  - Performance at scale (JSONL ledger limitations)
  - AI model evaluation and A/B testing
  - User feedback loops (beyond correction signals)
  - Knowledge base / RAG capabilities
  - Voice/multimodal interaction
  - Workflow automation depth (triggers, conditions, branching)

### Stream 5: Non-Destructive Evolution Patterns

**Assigned to:** Seat 9 (Healthcare Ops), Seat 10 (PHI Specialist)
**Scope:**

- How do co-work systems handle updates without destroying user data:
  - Database migration patterns (schema evolution)
  - Event sourcing versioning (event upcasting, schema registry)
  - Configuration migration (backward compat, feature flags)
  - Plugin/extension architecture (isolation boundaries)
  - State serialization and replay (ledger format evolution)
  - Blue/green deployment for AI behavior changes
  - Shadow mode / canary releases for LLM prompt changes
  - User workspace preservation during code updates
  - API versioning strategies
  - Rollback and recovery patterns
- Specific platforms to study:
  - Notion's block-based architecture (additive, never destructive)
  - Linear's real-time sync architecture
  - Temporal.io's workflow versioning
  - Event Store's projection evolution
  - Kubernetes operator patterns for stateful workloads

### Stream 6: Meta-Research — Improving Our Research Process

**Assigned to:** All seats (cross-cutting)
**Scope:**

- How should an AI-governed council conduct ongoing research?
  - Structured literature review methodologies
  - Technology radar / capability mapping frameworks
  - Competitive intelligence gathering patterns
  - Research debt management
  - Knowledge graph construction from findings
  - Continuous benchmarking against evolving landscape
  - Research cadence and freshness policies

---

## Deliverables

1. **SDD 67: Council Industry Benchmark Report** — Comprehensive findings from Streams 1-2
2. **SDD 68: TED Feature Strength/Weakness Assessment** — Findings from Streams 3-4
3. **SDD 69: Non-Destructive Evolution Recommendations** — Findings from Stream 5
4. **SDD 70: Research Process Improvements** — Meta-findings from Stream 6
5. **SDD 71: Council Recommendations — Priority Action Items** — Synthesized recommendations with priority, effort, and impact ratings

---

## Execution Plan

### Wave 1 — Parallel Web Research (6 agents)

```
Agent 1: Stream 1 — AI co-work landscape survey
Agent 2: Stream 2 — Leading minds & research papers
Agent 3: Stream 5 — Non-destructive evolution patterns
Agent 4: Stream 6 — Meta-research process improvement
```

### Wave 2 — Internal Audit (2 agents, informed by Wave 1)

```
Agent 5: Stream 3 — Strengths analysis (TED features vs. Wave 1 findings)
Agent 6: Stream 4 — Weakness/gap analysis (TED features vs. Wave 1 findings)
```

### Wave 3 — Synthesis

```
Compile all findings into SDD 67-71
Council vote on priority recommendations
```

---

## Success Criteria

- Minimum 15 external sources cited with URLs
- Every TED subsystem evaluated against at least 2 industry comparisons
- At least 10 specific, actionable recommendations with priority ratings
- At least 5 non-destructive evolution patterns documented with applicability to TED
- Research process improvements documented for future council research cycles
