# SDD 74: Validation Research Refinements

**Status:** Active
**Version:** v1
**Date:** 2026-02-25
**Council Mandate:** Validation round — Verify SDD 72 improvement plan against latest research
**Sources:** 30+ additional sources consulted in validation round

---

## Executive Summary

The validation round confirms SDD 72's improvement plan is **directionally sound** across all 5 areas tested. All core patterns (schema versioning, content isolation, Strangler Fig, prompt registry, healthcare M&A domain) are validated by current industry best practices. **Five targeted refinements** are recommended to strengthen the plan.

---

## Validation Results

### 1. Schema Versioning: CONFIRMED (HIGH confidence)

- Weak schema + read-time upcasting is the **canonical approach** for JSONL event stores
- Validated by: Oskar Dudycz (event-driven.io), Marten framework, Axon Framework, Greg Young
- **Refinement:** Add hybrid upcasting — lazy on read for recent records, eager rewrite during compaction. Add `_migrated_at` timestamp on compacted records for audit trail.

### 2. Content Isolation: CONFIRMED + STRENGTHENED (HIGH confidence)

- TED's approach directly implements the **Dual LLM pattern** (Reversec Labs, August 2025)
- Validated by: OWASP LLM01:2025, Microsoft MSRC, arXiv security papers
- **Refinements:**
  - Add JSON schema validation on all quarantined LLM call outputs (discard malformed outputs)
  - Add deterministic exfiltration blocking (strip suspicious URLs from LLM outputs)
  - Consider datamarking (tokens inserted throughout untrusted text, not just at boundaries)
  - Enforce per-session tool call rate limits

### 3. Strangler Fig Decomposition: CONFIRMED WITH CAVEATS (MEDIUM-HIGH confidence)

- Successfully applied at Shopify (3,000+ line "God Object"), AWS, and Node.js monoliths
- **Critical caveat:** TED's shared mutable state (`let` variables, closures) is the primary risk
- **Refinements:**
  - Target "modular monolith" (separate files, same process) — NOT microservices
  - Start with scheduler (smallest, fewest dependencies), not SharePoint
  - Use dependency injection factories: `createSchedulerModule({ appendEvent, ... })`
  - Preserve single-process model at all times

### 4. Prompt Registry: CONFIRMED (HIGH confidence)

- File-based approach appropriate for single-operator, HIPAA-compliant deployment
- Validated by: Braintrust, Langfuse, MLflow, LaunchDarkly
- **Refinements:**
  - Add prompt taxonomy (classification, generation, summarization, extraction, governance)
  - Add LLM-as-Judge evaluation for generation prompts
  - Add hot-reload without sidecar restart
  - Add change log metadata (who/why/what/SHA per version)

### 5. Healthcare M&A Domain: FOUNDATION CONFIRMED (HIGH confidence)

- McKinsey: Gen AI reduces M&A costs ~20%. Top dealmakers use AI as "continuously available analyst"
- Deloitte: 86% of M&A orgs have integrated GenAI; security (67%) is top concern
- PwC: Healthcare M&A renewed with AI-enabled operations focus
- **Refinements:**
  - Add deal-centric dashboard view (aggregate all intelligence around each deal)
  - Track "time saved" metrics for operator ROI
  - Document AI governance for buyer due diligence readiness
  - HIPAA 2025: 30-day breach notification, mandatory encryption, continuous monitoring compliance
  - Consider future VDR (DealRoom, Datasite) integration path

---

## Updated Sprint Priorities (Post-Validation)

### Sprint 1 Additions

- **1D-002 enhanced:** Add JSON schema validation on quarantined LLM call outputs
- **1D-003 enhanced:** Add deterministic exfiltration blocking (strip URLs from LLM outputs containing encoded data)
- **1D-004 (NEW):** Add `_migrated_at` support to compaction for eager rewrite audit trail

### Sprint 2 Adjustments

- **2F prompt registry enhanced:** Add change log metadata, hot-reload support
- **2D context engineering enhanced:** Define prompt taxonomy (5 categories) before implementing context budgets
- **2E evaluation enhanced:** Add LLM-as-Judge scoring for generation prompts (morning_brief, eod_digest, draft_email)

### Sprint 3 Adjustments

- **3A decomposition reordered:** Start with scheduler (not SharePoint) — fewest dependencies
- **3A-002 through 3A-004:** Use dependency injection factory pattern
- **3A target clarified:** Modular monolith (same process, separate files), NOT microservices

### New Sprint 4 Items

- **4D:** Deal-centric dashboard view (aggregate TED intelligence per deal)
- **4E:** "Time saved" metrics (inbox triage time, meeting prep time, draft generation time)
- **4F:** AI governance documentation (buyer due diligence ready)

---

## Key Sources from Validation Round

### Schema Versioning

1. [Event Schema Versioning Patterns — event-driven.io](https://event-driven.io/en/simple_events_versioning_patterns/)
2. [Upcasters or Versioned Event Store — Michiel Rook](https://www.michielrook.nl/2017/11/upcasters-versioned-event-store-pros-cons/)
3. [Events Versioning — Marten](https://martendb.io/events/versioning.html)

### Content Isolation

4. [Secure LLM Agent Design Patterns — Reversec Labs](https://labs.reversec.com/posts/2025/08/design-patterns-to-secure-llm-agents-in-action)
5. [Microsoft Indirect Prompt Injection Defense — MSRC](https://www.microsoft.com/en-us/msrc/blog/2025/07/how-microsoft-defends-against-indirect-prompt-injection-attacks)
6. [OWASP LLM01:2025 Prompt Injection](https://genai.owasp.org/llmrisk/llm01-prompt-injection/)
7. [Prompt Injection Prevention Cheat Sheet — OWASP](https://cheatsheetseries.owasp.org/cheatsheets/LLM_Prompt_Injection_Prevention_Cheat_Sheet.html)

### Strangler Fig

8. [Refactoring Legacy Code — Shopify Engineering](https://shopify.engineering/refactoring-legacy-code-strangler-fig-pattern)
9. [Strangler Fig Pattern — AWS](https://docs.aws.amazon.com/prescriptive-guidance/latest/modernization-decomposing-monoliths/strangler-fig.html)
10. [Node.js Modular Monolith — w3tutorials](https://www.w3tutorials.net/blog/nodejs-modular-monolith/)

### Prompt Registry

11. [Best Prompt Versioning Tools 2025 — Braintrust](https://www.braintrust.dev/articles/best-prompt-versioning-tools-2025)
12. [Prompt Registry — MLflow](https://mlflow.org/docs/latest/genai/prompt-registry/)
13. [A/B Testing LLM Prompts — Langfuse](https://langfuse.com/docs/prompt-management/features/a-b-testing)

### Healthcare M&A

14. [Gen AI in M&A — McKinsey](https://www.mckinsey.com/capabilities/m-and-a/our-insights/gen-ai-in-m-and-a-from-theory-to-practice-to-high-performance)
15. [M&A Generative AI Study — Deloitte](https://www.deloitte.com/us/en/what-we-do/capabilities/mergers-acquisitions-restructuring/articles/m-and-a-generative-ai-study.html)
16. [Healthcare M&A Trends 2026 — PwC](https://www.pwc.com/gx/en/services/deals/trends/health-industries.html)
17. [AI Due Diligence in Healthcare — Sheppard Health Law](https://www.sheppardhealthlaw.com/2025/10/articles/artificial-intelligence/ai-due-diligence-in-healthcare-transactions/)

---

## Council Verdict

The validation round **strengthens confidence** in SDD 72. All 5 core approaches are confirmed. The 5 refinements should be incorporated into the plan before Sprint 1 execution begins.

**APPROVED — Proceed with Sprint 1 incorporating refinements.**
