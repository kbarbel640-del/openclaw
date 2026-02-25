# SDD 68: TED Feature Strength/Weakness Assessment

**Status:** Active
**Version:** v1
**Date:** 2026-02-25
**Council Mandate:** Streams 3 & 4 — Internal audit informed by industry research
**Methodology:** Each TED subsystem evaluated against 2+ industry comparisons

---

## Executive Summary

TED has built a genuinely unique system. The combination of event-sourced governance, self-improving Builder Lane, progressive autonomy, and human-in-the-loop design is unmatched in the current landscape. However, significant gaps exist in UX, multi-user support, knowledge management, and operational simplicity.

The assessment identifies 12 strengths, 14 weaknesses, and 8 missing capabilities.

---

## Part I: Strengths (What TED Does Well)

### S-1: Event-Sourced Architecture (EXCEPTIONAL)

- TED's append-only JSONL ledger system with dual-write pattern provides replay, audit, and compliance guarantees that NO competitor matches
- 35+ ledgers with 218 event types across 39 namespaces
- Industry comparison: Microsoft Copilot has no user-accessible event log; Notion tracks block history but not at the event-sourcing level; Linear has event-based architecture but not user-accessible
- Assessment: This is TED's strongest architectural differentiator

### S-2: Governance Choke-Point (STRONG)

- Single sidecar processes ALL requests — no bypass paths
- Execution boundary policy covers every route
- Industry comparison: Most AI assistants have distributed policy enforcement or none at all
- Assessment: Validates Design Law #1. Unique in the landscape.

### S-3: Builder Lane Self-Improvement (EXCEPTIONAL)

- Correction signals → pattern detection (with time decay) → gated proposals → constitution validation → shadow mode → rubber-stamping detection
- Industry comparison: No surveyed system has a comparable self-improvement loop with this level of governance
- Assessment: Research-leading. Exceeds what academic papers describe.

### S-4: Progressive Autonomy Ladder (STRONG)

- Per-task-type autonomy levels with dual-signal promotion gates (corrections <5% AND engagement >70%)
- Demotion triggers (factual error → immediate)
- 7-day shadow post-promotion
- Industry comparison: Most systems are binary (on/off). Kanjun Qiu advocates incremental autonomy; TED implements it with quantitative gates.

### S-5: Draft State Machine (STRONG)

- 6-state lifecycle: drafted → pending_review → edited → approved → executed → archived
- Idempotent edit, submit-review workflow, never-dark fallback
- Industry comparison: Harrison Chase identifies state machines as the correct production pattern. Most competitors treat drafts as simple save/send.

### S-6: Human-in-the-Loop Design (STRONG)

- REQUIRES_OPERATOR_CONFIRMATION for 7 write tools
- before_tool_call hook blocks self-approve
- X-Ted-Approval-Source header tracking
- Industry comparison: Universal consensus that production agents need HITL. TED's implementation is among the most rigorous.

### S-7: HIPAA Compliance Architecture (STRONG)

- Entity-level overrides in LLM provider selection
- PHI redaction with phone/email patterns, default-on
- Provider cascade respects compliance requirements
- Industry comparison: Most AI assistants either don't address HIPAA or treat it as a checkbox. TED's architecture-level enforcement is robust.

### S-8: Council Governance Process (UNIQUE)

- 10-seat council with domain specialization
- 12+ critical review cycles
- Behavioral proof requirements (string-presence BANNED)
- Industry comparison: No comparable AI system has a formal multi-seat governance council during development

### S-9: Multi-Tenant M365 Integration (GOOD)

- Separate auth, scopes, caches per tenant
- Token refresh with per-profile mutex
- Mail, Calendar, Planner, To Do, SharePoint
- Industry comparison: On par with Copilot's depth for the specific M365 services covered

### S-10: Reconciliation Engine (GOOD)

- Bidirectional sync between TED ledgers and M365 (Planner/To Do)
- Dedup via existingProposalSet
- Approval-gated writes
- Industry comparison: Most systems are one-way sync. Bidirectional with dedup is advanced.

### S-11: Self-Healing Infrastructure (GOOD)

- Circuit breakers per workload group
- LLM provider EWMA health scoring
- Config drift reconciliation with SHA-256 and atomic restore
- Zombie draft detection
- Graduated noise reduction (5-level state machine)
- Industry comparison: Inspired by production resilience patterns (Netflix Hystrix, etc.)

### S-12: Scheduler System (GOOD)

- cronMatchesNow with day-of-month, month, DOW fields
- 6 execution gates
- Pending delivery queue
- Auto-dispatch via mcpCallInternal loopback
- Industry comparison: Comparable to Temporal's scheduling but simpler and purpose-built

---

## Part II: Weaknesses (What Needs to Change)

### W-1: Monolithic Codebase (HIGH SEVERITY)

- server.mjs: ~19,000 lines in one file
- index.ts: ~10,000 lines in one file
- views/ted.ts: ~4,400 lines
- Impact: Difficult to maintain, test, and evolve. High cognitive load for any developer.
- Recommendation: Strangler Fig pattern to extract domain modules incrementally

### W-2: No Multi-User Support (HIGH SEVERITY)

- TED is designed for a single operator (Clint)
- No concurrent access model, no user sessions, no permissions
- Impact: Cannot scale to team deployment
- Industry comparison: Every competitor supports multi-user
- Recommendation: Not urgent for current use case (single operator), but architectural planning needed

### W-3: UX Polish and Accessibility (HIGH SEVERITY)

- 26 cards with inconsistent styling (discovered during testing: missing card boundaries, stop symbols on buttons)
- Limited keyboard navigation, limited screen reader support
- No mobile-responsive design
- Industry comparison: Notion, Linear have world-class UX. TED's UI is functional but unrefined.
- Recommendation: UX audit and systematic polish pass

### W-4: No Knowledge Base / RAG (MEDIUM SEVERITY)

- TED has ledgers (structured data) but no semantic knowledge retrieval
- Cannot search across historical context semantically
- Industry comparison: Copilot has Semantic Index; Notion has full-text + AI search; Glean is built around enterprise search
- Recommendation: Consider vector store for semantic retrieval of historical patterns

### W-5: Onboarding Complexity (MEDIUM SEVERITY)

- 7-phase ted-setup.sh script
- Requires Azure AD App Registration for M365
- Many config files to understand
- Industry comparison: Most competitors offer click-to-install or OAuth-only setup
- Recommendation: Reduce mandatory configuration; sensible defaults; guided wizard

### W-6: No Automated Evaluation Pipeline (MEDIUM SEVERITY)

- Evaluation is manual (council review cycles)
- 7 golden fixtures validate output contracts, but no continuous quality measurement
- Andrew Ng: "Disciplined evaluation is the single biggest predictor of success"
- Recommendation: Automated behavioral tests running on schedule; LLM-as-Judge quality scoring

### W-7: Context Engineering Not Formalized (MEDIUM SEVERITY)

- LLM prompts are constructed ad-hoc in route handlers
- No systematic context budget or priority-ranked assembly
- Harrison Chase identifies context engineering as THE differentiator for long-horizon agents
- Recommendation: Formalize context assembly with explicit budget and priority ranking

### W-8: Lethal Trifecta Exposure (CRITICAL SECURITY)

- TED combines: private data (Graph email, calendar) + untrusted content (email bodies) + external communication (send emails)
- Simon Willison: This combination is always exploitable via prompt injection
- Current mitigations: prompt delimiters, PHI redaction, operator approval gates
- Recommendation: Formal threat model; consider architectural isolation of untrusted content processing

### W-9: No Real-Time Collaboration (LOW SEVERITY for current use case)

- No WebSocket streaming, no live updates
- Dashboard requires manual refresh
- Industry comparison: Notion, Linear have real-time collaboration built-in
- Recommendation: Low priority for single-operator use; evaluate when scaling

### W-10: JSONL Performance at Scale (MEDIUM SEVERITY, FUTURE)

- Linear scan for ledger queries
- No indexing, no query optimization
- Compaction helps but doesn't solve query performance
- Recommendation: Monitor ledger sizes; implement snapshots; evaluate migration to SQLite for large ledgers if needed

### W-11: No Voice/Multimodal Interaction (LOW SEVERITY)

- Text-only interface
- No voice input, no image analysis, no audio processing
- Industry comparison: Copilot supports voice; Gemini supports multimodal
- Recommendation: Low priority; evaluate as LLM multimodal capabilities mature

### W-12: Tool Sprawl Risk (MEDIUM SEVERITY)

- 71 MCP tools, 78 agent tools, 156 gateway methods
- No usage tracking or ablation analysis
- Chip Huyen: Conduct tool ablation studies to find the essential set
- Recommendation: Add tool usage telemetry; quarterly ablation review

### W-13: Limited Integration Beyond M365 (MEDIUM SEVERITY)

- Focused on M365 only. Monday.com, DocuSign, Zoom mentioned but not implemented
- Industry comparison: Copilot connects to 1400+ apps; Glean has 100+ connectors
- Recommendation: MCP-based connector framework for future integrations

### W-14: Error Handling UX (LOW SEVERITY)

- Error messages are technical, not user-friendly
- No contextual help or recovery suggestions
- Recommendation: Error message humanization pass

---

## Part III: Missing Capabilities (What Needs to Be Added)

### M-1: Explicit Constitutional Document (HIGH)

- TED's governance rules are spread across execution boundary policy, hard bans, HIPAA overrides, and config files
- Anthropic's constitutional approach: single hierarchical document with clear precedence
- Recommendation: Create `ted_constitution.json` with 4-tier priority hierarchy

### M-2: Human-as-a-Tool Pattern (MEDIUM)

- TED can ask for approval/rejection but cannot proactively ask for clarification mid-task
- Research shows Cyborg-style collaboration (back-and-forth) produces better results for some tasks
- Recommendation: Allow TED to post questions to operator that require response before proceeding

### M-3: Automated Capability Regression Testing (HIGH)

- Beyond golden fixtures: end-to-end capability tests that verify TED produces correct outputs for representative scenarios
- Recommendation: 20+ end-to-end test fixtures running in self-healing maintenance cron

### M-4: Prompt Registry (MEDIUM)

- LLM prompts are inline in server.mjs
- No versioning, no A/B testing, no rollback
- Recommendation: External prompt registry with semantic versioning

### M-5: Operator Engagement Mechanisms (MEDIUM)

- Ethan Mollick warns operators will "fall asleep at the wheel" over time
- Need periodic challenges, varied approval granularity, surprise quality checks
- Recommendation: Engagement scoring with proactive re-engagement

### M-6: Schema Version Tracking (HIGH)

- No \_schema_version on JSONL records
- No \_config_version on JSON config files
- No migration runner
- Recommendation: Add versioning now, build migration infrastructure

### M-7: Technology Radar (LOW)

- No systematic process for tracking technology landscape changes
- Recommendation: ted_technology_radar.json with adopt/trial/assess/hold ratings

### M-8: Council Knowledge Graph (MEDIUM)

- 50+ SDD documents not cross-referenced
- Cannot answer "What has the council said about X across all cycles?"
- Recommendation: Atomic findings extraction + knowledge graph + search endpoint

---

## Summary Scorecard

| Category                   | Score  | Industry Rank                |
| -------------------------- | ------ | ---------------------------- |
| Governance & Safety        | 9.5/10 | #1 (no comparable system)    |
| Event-Sourced Architecture | 9.5/10 | #1                           |
| Self-Improvement Loop      | 10/10  | #1 (unique in landscape)     |
| M365 Integration           | 7/10   | #2 (behind Copilot)          |
| HIPAA Compliance           | 8.5/10 | #1 for AI co-work            |
| UX Polish                  | 4/10   | Behind all major competitors |
| Multi-User Support         | 1/10   | Behind all competitors       |
| Knowledge/RAG              | 2/10   | Behind most competitors      |
| Integration Breadth        | 3/10   | Behind most competitors      |
| Operational Simplicity     | 4/10   | Behind most competitors      |
| Non-Destructive Evolution  | 3/10   | Behind best practices        |

---

## Council Verdict

TED's architectural foundation is exceptionally strong — the governance model, self-improvement loop, and event-sourced architecture are genuinely unique in the industry. No competitor combines these capabilities.

However, the system has clear gaps in user experience, operational simplicity, and future-proofing (schema versioning, modular decomposition). These gaps don't threaten TED's core value proposition but limit its adoption potential and long-term maintainability.

**Priority Action:** Address W-8 (Lethal Trifecta), M-6 (Schema Versioning), and W-1 (Monolith Decomposition) before scaling.
