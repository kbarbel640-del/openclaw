# SDD 70: Research Process Improvements

**Status:** Active
**Version:** v1
**Date:** 2026-02-25
**Council Mandate:** Stream 6 — Meta-research on improving the council's own research capability
**Sources:** 40+ external sources on technology radars, competitive intelligence, knowledge management, governance

---

## Executive Summary

The council has conducted 12+ review cycles across 50+ SDD documents, but the research process is reactive, findings are not cross-referenced, and there is no systematic process for tracking the evolving AI landscape. This document establishes 8 process improvements based on the ThoughtWorks Technology Radar, Apache governance, Zettelkasten knowledge management, Architecture Decision Records, and DORA metrics.

---

## Current State Assessment

### What Works

- Council review cycles produce thorough findings
- Behavioral proof requirements enforce quality
- 10-seat domain specialization covers key areas
- SDD document series provides chronological record

### What Doesn't Work

- Research is reactive (triggered by implementation, not proactive)
- Findings are not cross-referenced across cycles
- No technology landscape tracking
- No competitive intelligence process
- No capability maturity benchmarking
- Research debt accumulates (early findings not re-evaluated)
- No formal decision records (alternatives and rationale not captured)

---

## Improvement 1: Technology Radar

**Source:** ThoughtWorks Technology Radar, Zalando, Spotify Backstage

### What It Is

A living document categorizing technologies into 4 rings (Adopt/Trial/Assess/Hold) across 4 quadrants.

### TED Implementation

Create `ted_technology_radar.json`:

```json
[
  {
    "name": "Event Sourcing (JSONL)",
    "quadrant": "techniques",
    "ring": "adopt",
    "description": "Core architectural pattern for TED state management",
    "council_cycle": 12,
    "moved": "unchanged"
  },
  {
    "name": "Vector Store / RAG",
    "quadrant": "techniques",
    "ring": "assess",
    "description": "Semantic retrieval to supplement JSONL ledgers",
    "council_cycle": 13,
    "moved": "in"
  }
]
```

**Quadrants:** Techniques, Tools, Platforms, Integrations
**Cadence:** Review every 3 council cycles
**Lead seats:** Rotating pair

---

## Improvement 2: Competitive Landscape Tracking

**Source:** Miro AI, PM Prompt frameworks

### What It Is

Structured feature-by-feature comparison with comparable systems, updated quarterly.

### TED Implementation

Create `competitive_landscape.json` tracking:

- System name, category (copilot/agent/framework)
- Feature parity per capability (ahead/parity/behind)
- Last evaluated date, sources
- Gap items feed into technology radar (assess ring)

**Cadence:** Quarterly, led by Seats 1 and 3

---

## Improvement 3: Structured Literature Review Protocol

**Source:** Kitchenham SLR methodology (adapted for engineering teams)

### What It Is

A lightweight "rapid review" process for targeted research questions.

### TED Implementation

Before each council cycle, formulate 1-3 explicit research questions.
Protocol per question (time-boxed to 2 hours):

1. Define search terms
2. Search 5+ sources
3. Extract key findings
4. Assess applicability to TED
5. Form recommendation

Store in `research_questions.jsonl`:

```json
{"id": "RQ-013-001", "cycle": 13, "question": "What are best practices for LLM output contract validation?", "search_terms": ["llm output validation", "contract testing ai"], "sources": [...], "findings": "...", "recommendation": "...", "seats": [3, 5], "confidence": "high"}
```

**Two-reviewer minimum** for each question.

---

## Improvement 4: Knowledge Graph for Findings

**Source:** Zettelkasten method, knowledge graphs, MarkTechPost

### What It Is

A cross-referenced index of atomic findings from all council cycles.

### TED Implementation

Create `research_knowledge_graph.json`:

```json
{
  "nodes": [
    {
      "id": "F-009-001",
      "sdd": 47,
      "cycle": 9,
      "summary": "Morning brief must fetch real calendar before LLM call",
      "tags": ["morning_brief", "calendar", "graph_api"],
      "status": "active",
      "links": ["F-010-015", "F-011-003"],
      "superseded_by": null
    }
  ]
}
```

**Retroactive extraction:** Extract atomic findings from all 50+ existing SDDs (one-time task).
**On every new SDD:** Author must link findings to related prior findings.
**Contradiction handling:** Bidirectional "contradicts" links; superseded findings marked.
**Search capability:** Sidecar route `/council/knowledge/search` for tag/keyword queries.

---

## Improvement 5: Architecture Decision Records (ADRs)

**Source:** UK Government ADR Framework, AWS ADR process

### What It Is

Structured records of architectural decisions with context, alternatives, and consequences.

### TED Implementation

Add structured fields to council output documents:

```markdown
## Decision: [D-013-001] Use JSONL over SQLite for ledgers

**Status:** Accepted
**Context:** TED needs durable state storage for 35+ ledgers
**Alternatives Considered:**

1. SQLite — better query performance but adds dependency
2. JSONL — append-only, crash-safe, human-readable, no dependencies
3. PostgreSQL — overkill for single-operator system

**Decision:** JSONL for all ledgers
**Consequences:** Linear scan performance; mitigated by snapshots and compaction
**Related Decisions:** D-009-003 (dual-write pattern), D-010-001 (compaction)
```

**Decision levels:**

- Seat-level: documented, not escalated
- Cross-seat: requires quorum
- Architecture-changing: requires full council vote

Store in `decision_index.json` for searchability.

---

## Improvement 6: Capability Maturity Model

**Source:** OWASP AIMA, CNA AI Maturity Model, METR

### What It Is

Self-assessment scoring across capability dimensions, tracked over time.

### TED Implementation

5 maturity levels: 0=Not Present, 1=Basic, 2=Functional, 3=Governed, 4=Self-Improving

| Dimension           | Current Level      | Target |
| ------------------- | ------------------ | ------ |
| Email handling      | 3 (Governed)       | 4      |
| Calendar awareness  | 3 (Governed)       | 3      |
| Task management     | 3 (Governed)       | 4      |
| Deal tracking       | 3 (Governed)       | 3      |
| Document management | 2 (Functional)     | 3      |
| Governance          | 4 (Self-Improving) | 4      |
| Self-healing        | 4 (Self-Improving) | 4      |
| Personalization     | 3 (Governed)       | 4      |
| Knowledge retrieval | 1 (Basic)          | 3      |
| Multi-user          | 0 (Not Present)    | 1      |

Re-score each council cycle. Capability drift triggers CRITICAL finding.

---

## Improvement 7: Research Debt Tracking

**Source:** Distill.pub (Olah & Carter), Google Research (ML technical debt)

### What It Is

Tracking areas where findings exist but explanatory documentation is lacking, or where early findings haven't been re-evaluated.

### TED Implementation

Per-area debt score in `research_debt_scores.json`:

```json
{
  "areas": [
    {
      "name": "scheduler",
      "findings_count": 8,
      "explained": true,
      "last_reviewed": "cycle_011",
      "debt_score": "low"
    },
    {
      "name": "builder_lane",
      "findings_count": 15,
      "explained": true,
      "last_reviewed": "cycle_012",
      "debt_score": "low"
    },
    {
      "name": "sharepoint",
      "findings_count": 2,
      "explained": false,
      "last_reviewed": "cycle_012",
      "debt_score": "medium"
    }
  ]
}
```

**Interpretive labor budget:** 20% of each council cycle dedicated to explanation + cross-referencing.
**Debt retirement sprint:** Every 5 cycles, dedicate full cycle to debt retirement.

---

## Improvement 8: Council Self-Assessment Protocol

**Source:** Apache PMC governance, Linux Foundation governance

### What It Is

Each cycle, the council evaluates its own process.

### Self-Assessment Questions (end of every cycle)

1. What did we miss that should have been caught?
2. What did we find that was caught in a prior cycle but not fixed?
3. Are the right domains covered by current seats?
4. Did we have enough external research to ground our findings?
5. What process change would have made this cycle more effective?

Results stored in each cycle's SDD as a "Meta-Assessment" appendix.

---

## Improvement 9: Feature Maturity Model

**Source:** Apache Incubator graduation process

### TED Feature Maturity Levels

1. **Proposed** — Designed but not built
2. **Incubating** — Built, basic tests pass
3. **Graduated** — Council-reviewed, proof tests pass, hardened
4. **Mature** — Survived 3+ council cycles without findings

Track in `feature_maturity.json`. Features regress if new findings are discovered.

---

## Recommended Cadence

| Activity                       | Frequency                  | Lead               |
| ------------------------------ | -------------------------- | ------------------ |
| Technology Radar Review        | Every 3 cycles             | All seats          |
| Competitive Landscape Scan     | Quarterly                  | Seats 1, 3         |
| Structured Literature Review   | Each cycle (1-3 questions) | Rotating pairs     |
| Capability Maturity Assessment | Each cycle                 | All seats          |
| Research Debt Retirement       | Every 5 cycles             | All seats          |
| Knowledge Graph Update         | Each cycle                 | Finding authors    |
| Council Self-Assessment        | Each cycle                 | All seats          |
| ADR Review                     | Each cycle                 | Architecture seats |

---

## New Artifacts Summary

| Artifact                      | Format | Purpose                         |
| ----------------------------- | ------ | ------------------------------- |
| ted_technology_radar.json     | JSON   | Technology adoption tracking    |
| competitive_landscape.json    | JSON   | Feature comparison matrix       |
| research_questions.jsonl      | JSONL  | Research question tracking      |
| research_knowledge_graph.json | JSON   | Cross-referenced findings       |
| decision_index.json           | JSON   | ADR searchable index            |
| capability_maturity.json      | JSON   | Self-assessment scores          |
| research_debt_scores.json     | JSON   | Debt tracking                   |
| feature_maturity.json         | JSON   | Apache-style feature graduation |

---

## Implementation Priority

1. **Immediate** (next cycle): Capability Maturity Model + Council Self-Assessment + Feature Maturity tracking
2. **Near-term** (next 3 cycles): Knowledge Graph + Decision Index + Research Question template
3. **Medium-term** (next 6 cycles): Technology Radar + Competitive Landscape + Research Debt tracking
4. **Ongoing:** Literature reviews, benchmark comparisons, debt retirement sprints

---

## Sources

1. ThoughtWorks Technology Radar — https://www.thoughtworks.com/en-us/radar
2. Zalando Tech Radar — https://opensource.zalando.com/tech-radar/
3. Martin Fowler — Parallel Change — https://martinfowler.com/bliki/ParallelChange.html
4. Kitchenham — SLR Guidelines for Software Engineering
5. Zettelkasten Method — Greasy Guide
6. MarkTechPost — Self-Organizing Knowledge Graphs
7. UK Government ADR Framework — https://www.gov.uk/government/publications/architectural-decision-record-framework
8. AWS ADR Process — https://docs.aws.amazon.com/prescriptive-guidance/latest/architectural-decision-records/adr-process.html
9. DORA Metrics — https://dora.dev/guides/dora-metrics-four-keys/
10. Apache Incubator Graduation — https://incubator.apache.org/guides/graduation.html
11. OWASP AI Maturity Assessment — https://owasp.org/www-project-ai-maturity-assessment/
12. Distill.pub Research Debt — https://distill.pub/2017/research-debt/
13. Google Research — Hidden Technical Debt in ML Systems
14. METR — Model Evaluation and Threat Research — https://metr.org/
