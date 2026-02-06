# Roadmap and Phases

## Overview

SIOE development follows a phased approach. Each phase has:
- Clear objectives
- Explicit constraints (what is NOT allowed)
- Exit criteria (what must be true before moving forward)

## Phase 0: Local Reliability (CURRENT)

**Status:** In Progress

**Objective:** Ensure local-first operation is stable and debuggable

**What is allowed:**
- Local Ollama auto-discovery with `auth: "none"`
- Startup validation with fail-fast
- Context window enforcement (>= 16000)
- Static model selection (primary + fallbacks)
- Basic TUI and CLI operation

**What is NOT allowed:**
- Task-based model routing
- CRE-specific extraction tools
- Spine/memory layer
- Multi-agent orchestration
- Production CRE deployments

**Exit criteria:**
- [ ] Gateway starts reliably with local Ollama
- [ ] Startup fails fast with clear errors when misconfigured
- [ ] Auth resolution works for local (`none`) and hosted (`api-key`)
- [ ] TUI connects and sends messages successfully
- [ ] All tests pass

**Current blockers:**
- Test failures being fixed (startup validation mocks)
- TUI reconnection after gateway restart

## Phase 1: Stable Extraction

**Status:** Not Started

**Objective:** Build reliable document processing for CRE inputs

**What is allowed:**
- Rent roll extraction tool
- OM text extraction
- PDF/Excel parsing pipeline
- Structured output validation
- Local model for extraction tasks

**What is NOT allowed:**
- Deal analysis (planning)
- Market research automation
- Spine/memory persistence
- Task lane routing (still static)

**Exit criteria:**
- [ ] Rent roll extraction produces valid JSON
- [ ] OM extraction handles 200-page PDFs
- [ ] Extraction errors are caught and reported
- [ ] Local model handles 95% of extraction tasks
- [ ] Fallback to Kimi works when local fails

**Dependencies:**
- Phase 0 complete
- PDF parsing library selected
- Test rent rolls available

## Phase 2: Hybrid Reasoning (Kimi Integration)

**Status:** Not Started

**Objective:** Add hosted model capabilities for tasks that exceed local

**What is allowed:**
- Kimi as fallback for extraction
- Kimi as primary for planning tasks
- OM summarization with Kimi
- Deal analysis workflows
- Cost tracking for hosted usage

**What is NOT allowed:**
- Automatic model selection (routing is still config-driven)
- Spine/memory layer
- Multi-agent workflows
- Production without operator oversight

**Exit criteria:**
- [ ] Kimi integration works via Moonshot API
- [ ] Fallback from local to Kimi is seamless
- [ ] Deal analysis produces useful output
- [ ] Cost per workflow is tracked
- [ ] Operator can force local-only mode

**Dependencies:**
- Phase 1 complete
- Moonshot API key available
- Kimi model performance validated

## Phase 3: Spine / Memory Layer

**Status:** Not Started

**Objective:** Add persistent memory for cross-session context

**What is allowed:**
- Entity storage (properties, tenants, leases)
- Cross-document reference
- Workflow state persistence
- Session memory beyond context window
- Vector search for relevant context

**What is NOT allowed:**
- Autonomous agent behavior
- Automatic workflow triggers
- Multi-tenant data mixing
- Production without data governance

**Exit criteria:**
- [ ] Entities persist across sessions
- [ ] Relevant context is retrieved automatically
- [ ] Data can be deleted (GDPR compliance)
- [ ] Performance is acceptable (< 500ms retrieval)
- [ ] Storage is encrypted at rest

**Dependencies:**
- Phase 2 complete
- Vector database selected
- Data model finalized

## Phase 4: Full SIOE Agent Behavior

**Status:** Not Started

**Objective:** Enable autonomous CRE workflows with operator oversight

**What is allowed:**
- Task lane routing (automatic)
- Multi-step workflows
- Scheduled reports
- Alert triggers
- Multi-agent coordination

**What is NOT allowed:**
- Actions without approval (deals, emails)
- Data sharing across tenants
- Unlogged decisions

**Exit criteria:**
- [ ] Weekly market reports generate automatically
- [ ] Lease expiration alerts work
- [ ] Deal pipeline tracking is accurate
- [ ] All agent actions are logged
- [ ] Operator can pause/override any workflow

**Dependencies:**
- Phase 3 complete
- Approval workflow implemented
- Audit logging complete

## Decision Log

Record significant architectural decisions here:

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-02 | `auth: "none"` for local | Avoid fake API keys, explicit policy |
| 2026-02 | 16000 min context | Embedded agent requirement |
| 2026-02 | Fail-fast startup | Don't accept connections if broken |
| TBD | Task lane routing | Deterministic, not agentic |
| TBD | Spine storage | TBD |

## What We Are NOT Building

To maintain focus, explicitly NOT in scope:

1. **Multi-tenant SaaS**
   - One gateway per operator
   - No shared infrastructure

2. **Model training**
   - Inference only
   - No fine-tuning pipeline

3. **Document storage system**
   - Process documents, don't own them
   - Integrate with existing DMS

4. **General-purpose AI assistant**
   - CRE-focused
   - Resist feature creep

5. **Agentic model selection**
   - Routing is config-driven
   - No "AI picks the AI"

## Invariants Across All Phases

1. **Local-first is the default**
   - Every phase must work with local models
   - Hosted is enhancement, not requirement

2. **Operator controls behavior**
   - No autonomous actions without approval
   - Config-driven, not magic

3. **Failures are clear**
   - Errors include remediation steps
   - No silent failures

4. **Data stays local**
   - Sensitive data on gateway host
   - Only send to hosted what's necessary
