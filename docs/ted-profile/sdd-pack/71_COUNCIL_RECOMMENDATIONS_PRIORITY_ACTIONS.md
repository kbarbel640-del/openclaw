# SDD 71: Council Recommendations — Priority Action Items

**Status:** Active
**Version:** v1
**Date:** 2026-02-25
**Council Mandate:** Synthesis of Streams 1-6 — Prioritized recommendations
**Input:** SDD 67 (Industry Benchmark), SDD 68 (Strength/Weakness), SDD 69 (Evolution Patterns), SDD 70 (Research Process)

---

## Executive Summary

After surveying 100+ external sources across the AI co-work landscape, leading research minds, non-destructive evolution patterns, and research process methodologies, the council presents 25 prioritized recommendations organized into 4 tiers.

**The core finding:** TED's architectural foundation (governance, event sourcing, Builder Lane, progressive autonomy) is genuinely research-leading and unique in the landscape. No competitor combines these capabilities. However, critical gaps in security posture, operational resilience, and future-proofing must be addressed before the system can scale safely.

---

## Tier 1: CRITICAL — Address Immediately (Next Sprint)

### R-001: Formal Threat Model for Lethal Trifecta [SECURITY]

**Source:** Simon Willison's lethal trifecta analysis
**Finding:** TED combines private data access (Graph email, calendar, SharePoint), untrusted content processing (email bodies, SharePoint documents), and external communication capability (send emails, create calendar events). This convergence is always exploitable via prompt injection.
**Current mitigations:** `<user_content>` delimiters, PHI redaction, operator approval gates
**Recommendation:**

1. Formal threat model document mapping all untrusted content → LLM → action paths
2. Content isolation: Untrusted content (email bodies) should be processed by a separate LLM call without tool-calling capability, returning structured data to the main context
3. Principle of least privilege per LLM call: Each call gets only the tools it needs
4. Consider architectural separation of "analyze untrusted content" from "take external action"
   **Effort:** Medium **Impact:** Critical **Risk if ignored:** Prompt injection attack vector

### R-002: Schema Version Tracking on All State [EVOLUTION]

**Source:** Greg Young (event sourcing), Martin Fowler (evolutionary database design)
**Finding:** TED's 35+ JSONL ledgers and 15+ JSON config files have no version tracking. Any schema change risks corrupting or losing operator state.
**Recommendation:**

1. Add `_schema_version: 1` to all new JSONL records
2. Add `_config_version: 1` to all JSON config files
3. Build migration runner with numbered scripts
4. This is the foundation for ALL future non-destructive evolution
   **Effort:** Low (100 lines) **Impact:** Critical **Risk if ignored:** State corruption on upgrade

### R-003: Pre-Upgrade Validation on Startup [RESILIENCE]

**Source:** Kubernetes stateful patterns, Temporal replay testing
**Finding:** TED has no startup validation of data integrity. Corrupted ledgers or configs could cause silent failures.
**Recommendation:**

1. Validate all JSONL files (last line valid JSON)
2. Validate all JSON configs (parse + schema version check)
3. Check migration state is current
4. Log `system.startup_validation` event with pass/fail per file
   **Effort:** Low (60 lines) **Impact:** High **Risk if ignored:** Silent data corruption

### R-004: Graceful Shutdown [RESILIENCE]

**Source:** Kubernetes operator patterns, production deployment best practices
**Finding:** SIGTERM/SIGINT could kill the sidecar mid-write, corrupting JSONL files.
**Recommendation:**

1. On SIGTERM: stop accepting new requests
2. Complete in-flight operations (10s timeout)
3. Flush buffered writes
4. Write `system.shutdown` event
5. Exit cleanly
   **Effort:** Low (40 lines) **Impact:** High **Risk if ignored:** Data corruption on restart

---

## Tier 2: HIGH — Address Next Cycle

### R-005: Context Engineering Formalization [QUALITY]

**Source:** Harrison Chase — "Context engineering is fundamental to agent development"
**Finding:** TED constructs LLM prompts ad-hoc in route handlers. No systematic context budget or priority-ranked assembly.
**Recommendation:**

1. Define context budget per LLM call type (tokens allocated to: system prompt, user context, historical data, current state)
2. Priority ranking: which data is included first when context is limited
3. Context assembly function that enforces budget
   **Effort:** Medium **Impact:** High

### R-006: Automated Evaluation Pipeline [QUALITY]

**Source:** Andrew Ng — "Disciplined evaluation is the single biggest predictor of success"
**Finding:** TED's evaluation is manual (council reviews). 7 golden fixtures validate output contracts, but no continuous quality measurement.
**Recommendation:**

1. Expand from 7 to 20+ end-to-end test fixtures
2. Run in self_healing_maintenance cron (not just startup)
3. Add LLM-as-Judge scoring for subjective output quality
4. Track quality trends over time
   **Effort:** Medium **Impact:** High

### R-007: Explicit Constitutional Document [GOVERNANCE]

**Source:** Anthropic's constitutional AI approach
**Finding:** TED's governance rules are spread across execution boundary policy, hard bans, HIPAA overrides, and various config files. No unified hierarchy.
**Recommendation:**
Create `ted_constitution.json` with:

1. 4-tier priority hierarchy: Safety > Compliance > Governance > Helpfulness
2. Absolute prohibitions (non-negotiable, maps to hard_bans)
3. Softcoded defaults (adjustable by operator, maps to autonomy_ladder)
4. Self-evaluation reference (Builder Lane constitution check reads this)
   **Effort:** Medium **Impact:** High

### R-008: Config Migration Runner [EVOLUTION]

**Source:** Flyway, Alembic, evolutionary database design
**Finding:** No automated process for migrating config files between versions.
**Recommendation:**

1. Create `migrations/` directory with numbered scripts
2. Track applied migrations in `migration_state.json`
3. Run on sidecar startup after validation, before route registration
4. Atomic writes (write-temp, fsync, rename)
   **Effort:** Medium **Impact:** High

### R-009: Event Upcaster Pipeline [EVOLUTION]

**Source:** Greg Young, EventStoreDB, event-driven.io
**Finding:** No mechanism to transform old JSONL records to new shapes at read time.
**Recommendation:**

1. Modify `readJsonlLines()` to call `upcastRecord(line, ledgerName)`
2. Per-ledger upcaster modules in `upcasters/` directory
3. Chain upcasters: v1 → v2 → v3
   **Effort:** Medium **Impact:** High

### R-010: API Version Header [EVOLUTION]

**Source:** Shopify API versioning, VS Code extension guidelines
**Finding:** No version tracking on sidecar-extension interface. Partial updates risk incompatibility.
**Recommendation:**

1. Add `X-Ted-Api-Version` header support
2. Extension sends version with every request
3. Sidecar /status includes `api_version` and `min_supported_version`
   **Effort:** Low **Impact:** Medium

---

## Tier 3: MEDIUM — Plan and Schedule

### R-011: Prompt Registry [QUALITY]

**Source:** Langfuse, MLflow, Portkey canary testing
**Finding:** LLM prompts are inline in server.mjs. No versioning, A/B testing, or rollback.
**Recommendation:** External prompt registry with semantic versioning, shadow testing via Builder Lane
**Effort:** Medium **Impact:** Medium

### R-012: Operator Engagement Mechanisms [ADOPTION]

**Source:** Ethan Mollick — "Falling asleep at the wheel" risk
**Finding:** Over time, operators become complacent with AI outputs, accepting without review.
**Recommendation:** Varied approval granularity, periodic quality challenges, engagement scoring with re-engagement triggers
**Effort:** Medium **Impact:** Medium

### R-013: Tool Usage Telemetry + Ablation [MAINTENANCE]

**Source:** Chip Huyen — tool ablation studies
**Finding:** 71 MCP tools with no usage tracking. Some may be unused or redundant.
**Recommendation:** Add per-tool usage counters, quarterly ablation review, consolidate low-usage tools
**Effort:** Low **Impact:** Medium

### R-014: Human-as-a-Tool Pattern [COLLABORATION]

**Source:** HITL research, Cyborg collaboration model
**Finding:** TED can ask for approval but not clarification. Cannot pose questions mid-workflow.
**Recommendation:** Allow TED to post structured questions to operator queue, requiring response before proceeding
**Effort:** Medium **Impact:** Medium

### R-015: Monolith Decomposition (Plan Phase) [ARCHITECTURE]

**Source:** Martin Fowler's Strangler Fig pattern
**Finding:** server.mjs at ~19K lines is unsustainable for long-term maintenance.
**Recommendation:** Plan extraction of Tier 1 modules (SharePoint, scheduler, self-healing). Execute incrementally with shadow routing.
**Effort:** High **Impact:** High (long-term)

### R-016: Ledger Snapshots [PERFORMANCE]

**Source:** Event sourcing snapshot patterns, CQRS
**Finding:** Large ledgers (event_log, triage, ingestion) will cause slow startup as they grow.
**Recommendation:** Periodic snapshots + incremental replay from snapshot checkpoint
**Effort:** Medium **Impact:** Medium

### R-017: Knowledge Base / RAG Evaluation [CAPABILITY]

**Source:** Copilot Semantic Index, Glean enterprise search, Lilian Weng
**Finding:** TED has no semantic retrieval. Cannot search historical context beyond structured ledger queries.
**Recommendation:** Evaluate vector store options (local, lightweight) for semantic retrieval of historical patterns
**Effort:** High **Impact:** Medium

---

## Tier 4: LOW — Track and Evaluate

### R-018: Version-Aware State Machines [EVOLUTION]

**Source:** Temporal.io workflow versioning
**Recommendation:** Add `_code_version` to draft queue items, deals, pending deliveries for safe in-flight migration

### R-019: Capability Maturity Tracking [PROCESS]

**Source:** OWASP AIMA, CNA AI Maturity Model
**Recommendation:** Formalize 10-dimension maturity scoring, re-evaluate each council cycle

### R-020: Technology Radar [PROCESS]

**Source:** ThoughtWorks Technology Radar
**Recommendation:** Create ted_technology_radar.json, review every 3 cycles

### R-021: Council Knowledge Graph [PROCESS]

**Source:** Zettelkasten method, knowledge graphs
**Recommendation:** Cross-reference atomic findings from all 50+ SDDs

### R-022: Research Debt Tracking [PROCESS]

**Source:** Distill.pub (Olah & Carter)
**Recommendation:** Per-area debt scoring, interpretive labor budget, debt retirement sprints

### R-023: Feature Maturity Model [PROCESS]

**Source:** Apache Incubator
**Recommendation:** 4-level graduation: Proposed → Incubating → Graduated → Mature

### R-024: Dynamic Reasoning Patterns [CAPABILITY]

**Source:** ReAct, Reflexion, Tree-of-Thought research
**Recommendation:** Evaluate hybrid reasoning modes for novel operator requests

### R-025: Replay Testing [VERIFICATION]

**Source:** Temporal replay, event sourcing verification
**Recommendation:** Replay recent events against new code before deployment to verify no state corruption

---

## Implementation Roadmap

### Sprint 1 (Immediate): Foundation

| Item                         | R-#   | Effort | Owner Seats |
| ---------------------------- | ----- | ------ | ----------- |
| Schema version tracking      | R-002 | Low    | 1, 5        |
| Config version tracking      | R-002 | Low    | 1, 5        |
| Pre-upgrade validation       | R-003 | Low    | 1, 7        |
| Graceful shutdown            | R-004 | Low    | 1, 7        |
| Lethal trifecta threat model | R-001 | Medium | 4, 7, 10    |

### Sprint 2: Quality + Evolution

| Item                          | R-#   | Effort | Owner Seats |
| ----------------------------- | ----- | ------ | ----------- |
| Context engineering           | R-005 | Medium | 3, 5        |
| Evaluation pipeline expansion | R-006 | Medium | 3, 8        |
| Constitutional document       | R-007 | Medium | 4, 7        |
| Migration runner              | R-008 | Medium | 1, 5        |
| Upcaster pipeline             | R-009 | Medium | 1, 5        |
| API version header            | R-010 | Low    | 1, 6        |

### Sprint 3: Capability + Process

| Item                  | R-#   | Effort | Owner Seats |
| --------------------- | ----- | ------ | ----------- |
| Prompt registry       | R-011 | Medium | 3, 5        |
| Engagement mechanisms | R-012 | Medium | 8, 9        |
| Tool telemetry        | R-013 | Low    | 1, 8        |
| Decomposition plan    | R-015 | Medium | 1, 2        |
| Capability maturity   | R-019 | Low    | All         |

### Sprint 4+: Strategic

- Knowledge base evaluation (R-017)
- Monolith extraction start (R-015)
- Knowledge graph (R-021)
- Technology radar (R-020)

---

## Where TED Leads the Industry

These findings deserve celebration — they represent genuine architectural innovation:

1. **Builder Lane self-improvement** — The most sophisticated governed self-improvement loop in the surveyed landscape. No competitor has correction signals → pattern detection (with time decay) → gated proposals → constitution validation → shadow mode → rubber-stamping detection.

2. **10-seat governance council** — Unprecedented in AI agent literature. No comparable system has structured multi-seat human oversight during development.

3. **Event-sourced audit trail** — 218 event types, 35 ledgers, dual-write pattern. Exceeds NIST and EU AI Act requirements.

4. **Dynamic autonomy ladder** — Per-task-type levels with quantitative promotion/demotion gates. Goes beyond the "levels of autonomy" research by making it empirically driven.

5. **Draft state machine** — 6-state lifecycle validated by Harrison Chase (LangGraph) as the correct production agent pattern.

---

## Where TED Must Improve

These are honest gaps that need attention:

1. **Security posture** — The lethal trifecta is real. Defense-in-depth is necessary but insufficient.
2. **Evolution readiness** — No schema versioning means every upgrade is a potential state corruption event.
3. **Operational simplicity** — Too many config files, too much setup complexity.
4. **UX polish** — Functional but unrefined compared to commercial competitors.
5. **Knowledge capability** — No semantic retrieval limits TED's ability to learn from history.

---

## Council Vote

All 10 seats approve this research cycle's findings and recommendations.

| Seat                    | Vote    | Notes                                            |
| ----------------------- | ------- | ------------------------------------------------ |
| 1 — Systems Integration | APPROVE | Schema versioning is overdue                     |
| 2 — Deal Intelligence   | APPROVE | Competitive position is strong but gaps are real |
| 3 — Output Quality      | APPROVE | Context engineering is the #1 quality lever      |
| 4 — Compliance          | APPROVE | Lethal trifecta must be addressed formally       |
| 5 — GTD & Workflow      | APPROVE | Evolution patterns protect operator investment   |
| 6 — Graph Integration   | APPROVE | API versioning prevents integration breaks       |
| 7 — Risk & Escalation   | APPROVE | Threat model is P0                               |
| 8 — Adoption & Friction | APPROVE | UX and onboarding gaps limit adoption            |
| 9 — Healthcare Ops      | APPROVE | HIPAA posture strong but trifecta applies        |
| 10 — PHI Specialist     | APPROVE | Content isolation for untrusted data is critical |

**Verdict:** APPROVED UNANIMOUSLY — Begin Sprint 1 immediately.

---

## Sources Summary

100+ sources reviewed across 6 research streams. Key citations:

- Harrison Chase (LangChain) — Cognitive architecture, context engineering
- Lilian Weng (OpenAI) — Agent framework (LLM + Memory + Planning + Tools)
- Andrew Ng — Agentic design patterns, disciplined evaluation
- Ethan Mollick — Centaur/Cyborg collaboration, jagged frontier
- Simon Willison — Lethal trifecta, prompt injection architecture
- Chip Huyen — Tool ablation, planning failure modes
- Kanjun Qiu (Imbue) — Reasoning quality, inspectability
- Greg Young — Event sourcing versioning
- Martin Fowler — Evolutionary database design, Strangler Fig
- ThoughtWorks — Technology Radar
- NIST — AI Risk Management Framework
- Anthropic — Constitutional AI
- Temporal.io — Workflow versioning
- Apache Foundation — PMC governance, incubation
