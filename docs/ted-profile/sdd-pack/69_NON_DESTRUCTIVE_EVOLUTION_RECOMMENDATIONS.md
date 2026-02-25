# SDD 69: Non-Destructive Evolution Recommendations

**Status:** Active
**Version:** v1
**Date:** 2026-02-25
**Council Mandate:** Stream 5 — How to evolve without destroying operator state
**Sources:** 40+ external sources on event sourcing versioning, config migration, deployment patterns

---

## Executive Summary

TED stores critical operator state in 35+ JSONL ledgers and 15+ JSON config files. As the system evolves, code changes risk corrupting or losing this state. This document establishes 6 layers of non-destructive evolution based on industry best practices from event sourcing (Greg Young), database evolution (Martin Fowler), platform architecture (Notion, Temporal, Kubernetes), and deployment patterns (canary, shadow, blue-green).

---

## The Problem

When TED's code changes, these artifacts must survive intact:

- **Operator-tuned configs**: autonomy_ladder.json, hard_bans.json, style_guide.json, etc. (15+ files)
- **Ledger history**: 35+ JSONL files containing deals, commitments, drafts, triage, GTD actions, correction signals, improvement proposals
- **Event log**: event_log.jsonl with 218+ event types — the canonical audit trail
- **In-flight state**: Drafts in mid-lifecycle, pending deliveries, active shadow runs, incomplete reconciliation proposals
- **Builder Lane learned preferences**: Correction patterns, confidence scores, calibration data, style deltas

---

## Layer 1: Data Schema Evolution

### Pattern: Weak Schema + Read-Time Upcasting

**Source:** Greg Young (Event Sourcing), event-driven.io, EventStoreDB

**How it works:**

- Store events/records in flexible JSON format
- At read time, transform old records to current shape via upcaster functions
- Greg Young's rule: "A new version must be convertible from the old version. If not, it is a new event."

**Implementation for TED:**

1. Add `_schema_version: 1` to ALL new JSONL records NOW (establishes baseline)
2. Create `upcastRecord(rawLine, ledgerName)` function in the JSONL read pipeline
3. Chain upcasters: v1 → v2 → v3 (application code only handles latest version)
4. NEVER modify old JSONL lines — corrections are compensating events
5. All event consumers tolerate missing fields with sensible defaults

**Estimated effort:** ~100 lines in readJsonlLines path + per-ledger upcaster modules
**Risk:** LOW — read-time transformation, no data modification

### Five Versioning Strategies

| Strategy                | When to Use                              | TED Application                           |
| ----------------------- | ---------------------------------------- | ----------------------------------------- |
| Weak Schema             | Default — adding fields                  | Most common TED change                    |
| Upcasting               | Old records need transformation          | Ledger record shape changes               |
| Strong Schema + Version | Multiple consumers need strict contracts | Output contract changes                   |
| Copy-and-Transform      | Fundamental stream restructure           | Ledger compaction (SH-005)                |
| Compensating Events     | Correcting past records                  | Error corrections, "accountants use pens" |

---

## Layer 2: Configuration Evolution

### Pattern: Expand-Contract (Martin Fowler's Parallel Change)

**Source:** Martin Fowler, Open Practice Library

**How it works:**

1. **Expand:** Add new config fields alongside old ones. Both valid.
2. **Migrate:** Application reads new fields; migration function converts old → new.
3. **Contract:** Remove old fields (optional, can defer indefinitely).

**Implementation for TED:**

1. Add `"_config_version": 1` to every JSON config file NOW
2. Create `migrateConfig(configName, rawData)` that checks version and applies sequential migration steps
3. Run config migration at sidecar startup (before route registration)
4. Log every migration as `config.migrated` event with before/after snapshots
5. Backup before migration: copy to `config_backups/{name}_{timestamp}.json`
6. NEVER remove fields in the same release that adds new ones

**Config Migration Runner:**

```
migrations/
  001_add_schema_version_to_configs.mjs
  002_rename_notification_budget_fields.mjs
  ...
migration_state.json  (tracks applied migrations)
```

**Estimated effort:** ~150 lines for migration runner + per-config migration functions
**Risk:** LOW — expand phase is inherently backward-compatible

---

## Layer 3: Code Evolution

### Pattern A: Version-Aware State Machines (inspired by Temporal.io)

**Source:** Temporal.io patching, workflow versioning

**How it works:**

- Long-running state machines (drafts, deals, deliveries) carry a `_code_version` field
- On upgrade, migration sweep brings in-flight items from old version to current
- New items created with current version

**Implementation for TED:**

- Add `_code_version: 1` to draft queue items, deal records, pending deliveries
- On startup, scan in-flight items and apply upcasters for old versions
- Log each migration as `system.state_machine_migrated` event

### Pattern B: Strangler Fig Decomposition

**Source:** Martin Fowler, AWS Prescriptive Guidance

**How it works:**

- Extract bounded functionality from monolith into separate modules
- Route requests to either old or new implementation
- Once proven, eliminate old code

**Implementation for TED:**

```
modules/
  sharepoint.mjs      (Tier 1 — low coupling)
  scheduler.mjs       (Tier 1)
  self_healing.mjs    (Tier 1)
  builder_lane.mjs    (Tier 2 — medium coupling)
  ingestion.mjs       (Tier 2)
  deals.mjs           (Tier 3 — high coupling, extract last)
  drafts.mjs          (Tier 3)
  ...
server.mjs            (kernel: auth, routing, shared helpers)
```

Each module exports `registerRoutes(router, helpers)`.
Shared infrastructure stays in server.mjs: readJsonlLines, appendJsonlLine, sendJson, appendAudit, appendEvent, graphFetchWithRetry, routeLlmCall.

**Estimated effort:** ~40 hours of careful extraction
**Risk:** MEDIUM — requires thorough testing at each extraction step

---

## Layer 4: Interface Evolution

### Pattern: API Version Header + Optional Properties

**Source:** Shopify API versioning, VS Code extension guidelines, Slack API

**Implementation for TED:**

1. Add `X-Ted-Api-Version` header (default: `2026-02`)
2. Extension sends version header with every request
3. New response fields are ALWAYS optional
4. When route shape must change: new version number, deprecation notice, both shapes served for >=1 release
5. For MCP tools: new tool name for breaking changes (ted_sharepoint_upload_v2), deprecate old

**Sidecar /status response addition:**

```json
{
  "api_version": "2026-02",
  "min_supported_version": "2026-02",
  "deprecated_routes": []
}
```

---

## Layer 5: LLM Behavior Evolution

### Pattern: Prompt Registry + Shadow Testing

**Source:** Langfuse, MLflow prompt registry, Portkey canary testing

**Implementation for TED:**

1. Externalize prompts to `prompts/` directory with versioned files
2. Prompt registry config: `prompt_registry.json`
3. Extend Builder Lane shadow mode for prompt A/B testing
4. Per-prompt-version engagement metrics in engagement.jsonl
5. Correction signals feed back into prompt version evaluation

**Prompt asset structure:**

```json
{
  "morning_brief": {
    "production": "v2",
    "staging": "v3",
    "versions": {
      "v2": {
        "file": "morning_brief_v2.txt",
        "model": "gpt-4o",
        "temperature": 0.3,
        "max_tokens": 2000
      },
      "v3": {
        "file": "morning_brief_v3.txt",
        "model": "gpt-4o",
        "temperature": 0.2,
        "max_tokens": 2500
      }
    }
  }
}
```

---

## Layer 6: Deployment Safety

### Pre-Upgrade Validation (run on every startup)

1. All JSONL ledger files readable (check last line is valid JSON)
2. All JSON config files parse successfully
3. Schema versions at or above minimum expected
4. No pending deliveries in inconsistent state
5. Migration state is current
6. Log `system.startup_validation` event

### Graceful Shutdown (SIGTERM/SIGINT)

1. Stop accepting new requests
2. Complete in-flight LLM calls (with 10s timeout)
3. Flush buffered writes
4. Write `system.shutdown` event
5. Exit cleanly

### Replay Testing

Before deploying code changes, replay last N events from event_log.jsonl against new code (read-only mode) to verify no state corruption.

---

## Implementation Priority

| Layer                                        | Priority | Effort | Impact                        |
| -------------------------------------------- | -------- | ------ | ----------------------------- |
| L1: Schema versioning (add \_schema_version) | P0       | Low    | Enables all future migrations |
| L2: Config versioning (add \_config_version) | P0       | Low    | Protects operator config      |
| L6: Pre-upgrade validation                   | P0       | Low    | Catches corruption early      |
| L6: Graceful shutdown                        | P0       | Low    | Prevents data loss            |
| L2: Migration runner                         | P1       | Medium | Automates config evolution    |
| L1: Upcaster pipeline                        | P1       | Medium | Automates schema evolution    |
| L3A: Version-aware state machines            | P1       | Medium | Protects in-flight work       |
| L4: API version header                       | P1       | Low    | Future-proofs interface       |
| L5: Prompt registry                          | P1       | Medium | Enables safe LLM evolution    |
| L3B: Strangler Fig extraction                | P2       | High   | Reduces maintenance burden    |
| L1: Snapshots for large ledgers              | P2       | Medium | Performance optimization      |
| L6: Replay testing                           | P2       | Medium | Strongest verification        |

---

## Sources

1. Greg Young — Versioning in an Event Sourced System
2. event-driven.io — Simple Patterns for Event Schema Versioning
3. Martin Fowler — Parallel Change (Expand and Contract)
4. Martin Fowler — Evolutionary Database Design
5. Temporal.io — Workflow Versioning Documentation
6. Notion Blog — Data Model Behind Notion
7. Shopify — API Versioning
8. VS Code — Extension API Guidelines
9. Azure Architecture Center — Event Sourcing Pattern
10. AWS Prescriptive Guidance — Strangler Fig Pattern
11. Langfuse — A/B Testing Prompts
12. MLflow — Prompt Registry
13. Kubernetes — StatefulSet Documentation
14. Slack Engineering — Evolving the API
15. Martin Fowler — Strangler Fig Application
