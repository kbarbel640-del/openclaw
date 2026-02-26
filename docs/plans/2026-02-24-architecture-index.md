# OpenClaw-MABOS Architecture Documentation — Master Index

| Field              | Value                                           |
| ------------------ | ----------------------------------------------- |
| **Document**       | Master Index — Architecture Documentation Suite |
| **Version**        | 2026.2.24                                       |
| **Date**           | 2026-02-24                                      |
| **Status**         | Living Document                                 |
| **Total Coverage** | 10 documents, 24,022 lines, ~1.08 MB            |
| **License**        | MIT                                             |

---

## Overview

This master index links the ten architecture documents that together provide a comprehensive technical reference for the OpenClaw-MABOS platform. The documents cover every major subsystem — from the gateway server and plugin architecture to the BDI cognitive framework, knowledge graph, and reasoning engine.

**OpenClaw** is a self-hosted, terminal-first AI assistant platform built in TypeScript. It runs across devices and 40+ messaging channels, with a plugin architecture for extensibility.

**MABOS** (Multi-Agent Business Operating System) is its flagship bundled extension, providing a BDI cognitive architecture with SBVR ontology, multi-agent coordination, a 35-method reasoning engine, and TypeDB knowledge graph integration.

---

## Reading Guide

### For New Developers

Start with the **System Architecture** document for the full platform overview, then dive into specific subsystems as needed.

### For AI/Cognitive Architecture

Read in this order: **BDI + SBVR Framework** → **SBVR Ontology System** → **Reasoning & Inference Engine** → **Multi-Agent Coordination** → **Memory & Knowledge Management** → **RLM Memory Enhancements** → **TypeDB Knowledge Graph**.

### For Platform/Infrastructure

Read in this order: **System Architecture** → **Gateway & Channel Integration** → **Plugin & Extension Architecture**.

### For All Documents

Every document follows a consistent structure: metadata header, table of contents, executive summary, ASCII architecture diagrams, source code references, and cross-references to companion documents.

---

## Document Catalog

### 1. System Architecture (Platform Overview)

|              |                                                                                                          |
| ------------ | -------------------------------------------------------------------------------------------------------- |
| **File**     | [`2026-02-24-openclaw-mabos-system-architecture.md`](./2026-02-24-openclaw-mabos-system-architecture.md) |
| **Lines**    | 2,294                                                                                                    |
| **Sections** | 23                                                                                                       |
| **Scope**    | Complete platform reference                                                                              |

The top-level architecture document covering the entire OpenClaw-MABOS platform. Start here for a bird's-eye view.

**Key topics**: Gateway architecture (Express 5.2, WebSocket, 4 auth strategies), 40+ channel integrations across 3 tiers, plugin system (discovery, loading, registry, 7 hook categories), memory subsystem (hybrid FTS5 + vector search, 5 embedding providers), MABOS extension overview (99 tools, 21 modules), BDI runtime service, native apps (iOS, Android, macOS), deployment (Docker, Fly.io, Render), security architecture, technology stack, data flow diagrams, configuration reference.

---

### 2. Gateway & Channel Integration

|              |                                                                                            |
| ------------ | ------------------------------------------------------------------------------------------ |
| **File**     | [`2026-02-24-gateway-channel-integration.md`](./2026-02-24-gateway-channel-integration.md) |
| **Lines**    | 2,883                                                                                      |
| **Sections** | 31 + 7 appendices                                                                          |
| **Scope**    | Gateway server, WebSocket protocol, HTTP APIs, 25+ channel integrations                    |

Deep-dive into the central communication hub — the gateway server and the channel integration layer.

**Key topics**: Express 5.2 + WebSocket server, 4 authentication strategies (token, password, Tailscale, trusted-proxy), Ed25519 device identity, WebSocket challenge/response handshake, role system (operator/node) with 5 scopes, OpenAI `/v1/chat/completions` compatibility, OpenResponses `/v1/responses` API, 60+ RPC methods, channel lifecycle management with exponential backoff auto-restart, health monitoring (5 min checks, 3 restarts/hour), per-channel normalizers/outbound/onboarding/actions, complete message flow (webhook → normalize → gate → agent → outbound), webhook template rendering, config hot-reload, CSRF protection, TLS pinning, capability tokens, 229 source files documented.

---

### 3. Plugin & Extension Architecture

|              |                                                                                                |
| ------------ | ---------------------------------------------------------------------------------------------- |
| **File**     | [`2026-02-24-plugin-extension-architecture.md`](./2026-02-24-plugin-extension-architecture.md) |
| **Lines**    | 3,013                                                                                          |
| **Sections** | 26                                                                                             |
| **Scope**    | Plugin system, extension development, 41 bundled extensions                                    |

Deep-dive into how OpenClaw's plugin system works and how extensions are built.

**Key topics**: Plugin definition contract (`OpenClawPluginDefinition`), discovery from 4 origins (config, workspace, global, bundled), manifest system (`openclaw.plugin.json`), 9-step jiti-based loading pipeline, plugin registry (12 registration categories), `OpenClawPluginApi` (12 methods), plugin runtime (config, media, TTS, memory, per-channel operations), 24 hooks across 6 categories with 3 execution strategies (void/parallel, modifying/sequential, synchronous), service lifecycle, exclusive slot system (memory slot), security (path safety, install scanning), 41 bundled extensions catalog, extension development guide with 6 patterns, MABOS as reference implementation (99 tools, 20+ endpoints).

---

### 4. BDI + SBVR Multi-Agent Framework

|              |                                                                                                |
| ------------ | ---------------------------------------------------------------------------------------------- |
| **File**     | [`2026-02-24-bdi-sbvr-multiagent-framework.md`](./2026-02-24-bdi-sbvr-multiagent-framework.md) |
| **Lines**    | 1,565                                                                                          |
| **Sections** | 19                                                                                             |
| **Scope**    | BDI cognitive architecture, SBVR ontology, multi-agent coordination overview                   |

The cognitive architecture guide — how agents think, plan, and coordinate.

**Key topics**: BDI 5-phase cycle (Perceive → Deliberate → Plan → Act → Learn), goal system (3-tier: strategic/tactical/operational), desire management (priority formula: `base×0.30 + importance×0.25 + urgency×0.25 + alignment×0.15 + deps×0.05`), commitment strategies (single-minded/open-minded/cautious), HTN decomposition, SBVR ontology (10 domains, 170 concepts, 131 fact types), ACL messaging (8 performatives), Contract Net Protocol, workforce management, BPMN 2.0 workflows, 99-tool catalog, BDI runtime service.

---

### 5. Multi-Agent Coordination & Communication

|              |                                                                                      |
| ------------ | ------------------------------------------------------------------------------------ |
| **File**     | [`2026-02-24-multi-agent-coordination.md`](./2026-02-24-multi-agent-coordination.md) |
| **Lines**    | 2,828                                                                                |
| **Sections** | 24 + 5 appendices                                                                    |
| **Scope**    | Inter-agent messaging, negotiation, delegation, governance, workflows                |

Deep-dive into how agents coordinate, communicate, delegate work, and make decisions.

**Key topics**: Agent architecture (10 cognitive files, 9 C-suite roles), BDI cognitive cycle, goal/desire management with conflict detection, intention reconsideration triggers, planning system (HTN + CBR adaptation + risk assessment), ACL messaging (8 performatives, conversation threading, inbox model), Contract Net Protocol (CFP lifecycle, proposal evaluation, award), stakeholder governance (decision styles, approval thresholds, auto-approve), workforce management (trust scoring ±0.1, work packages, skill matching), agent-to-human handoff, BPMN 2.0 workflow engine (14 element types, validation, lanes), business venture system (9 agents per business), BDI runtime heartbeat, REST API, SSE streaming, 44-tool catalog.

---

### 6. SBVR Ontology System & Domain Modeling

|              |                                                                              |
| ------------ | ---------------------------------------------------------------------------- |
| **File**     | [`2026-02-24-sbvr-ontology-system.md`](./2026-02-24-sbvr-ontology-system.md) |
| **Lines**    | 2,103                                                                        |
| **Sections** | 25                                                                           |
| **Scope**    | SBVR standard, 10 JSON-LD/OWL ontology files, governance pipeline            |

Deep-dive into the ontological backbone — SBVR encoding, domain modeling, and ontology governance.

**Key topics**: SBVR standard overview and rationale, JSON-LD/OWL encoding strategy with annotated examples, all 10 ontology files documented (upper: 33 BDI classes + 12 SBVR metaclasses; business-core: 37 classes, 8 rules; ecommerce: 21; saas: 20; marketplace: 18; retail: 18; consulting: 18; cross-domain: 9 mappings; shapes: 13; sbvr-shapes: 6), SBVR rule types/modalities (definitional/behavioral × alethic/deontic), ontology loader/validator/merger (7 validation checks), TypeDB schema projection, governance pipeline (propose → validate → merge, 5 tools), domain scaffolding, knowledge infrastructure consumers, statistics (~181 classes, ~127 object properties, ~96 datatype properties).

---

### 7. Reasoning & Inference Engine

|              |                                                                                          |
| ------------ | ---------------------------------------------------------------------------------------- |
| **File**     | [`2026-02-24-reasoning-inference-engine.md`](./2026-02-24-reasoning-inference-engine.md) |
| **Lines**    | 2,321                                                                                    |
| **Sections** | 26                                                                                       |
| **Scope**    | 35 reasoning methods, inference engine, rule engine, fact store, CBR                     |

Deep-dive into the reasoning and inference subsystem.

**Key topics**: 35 reasoning methods across 6 categories (formal: 9, probabilistic: 6, causal: 5, experience: 5, social: 7, meta: 4), algorithmic implementations (Bayesian updater, Mamdani fuzzy inference, CSP backtracking solver, trust scoring with exponential decay, topological sort, descriptive statistics), meta-reasoning engine (6-dimension problem classification, selection matrix, auto-scoring), multi-method fusion (agreement scoring, disagreement detection), inference engine (forward chaining with variable binding and confidence propagation, backward chaining with knowledge gaps, abductive hypothesis ranking), rule engine (inference/constraint/policy, `?variable` binding, severity levels), SPO fact store (confidence, temporal validity, 2-level derivation chains), CBR-BDI (`S(B,D) = 0.6×Sb + 0.4×Sd`), TypeDB query layer (12 query classes, 70+ attributes, 20+ entities), BDI cycle integration.

---

### 8. Memory & Knowledge Management

|              |                                                                                          |
| ------------ | ---------------------------------------------------------------------------------------- |
| **File**     | [`2026-02-24-memory-system-architecture.md`](./2026-02-24-memory-system-architecture.md) |
| **Lines**    | 1,796                                                                                    |
| **Sections** | 26                                                                                       |
| **Scope**    | Memory system, knowledge management tools, hybrid search                                 |

The memory and knowledge subsystem — how agents store, search, and manage knowledge.

**Key topics**: Three-tier memory (working: 7 items, short-term: 200 items/2h TTL, long-term: persistent), hybrid search (FTS5 BM25 + sqlite-vec cosine, MMR diversity), embedding providers (OpenAI, Gemini, Voyage, local), memory materialization to Markdown, SPO fact store, rule engine, inference engine, CBR, ontology management, 35-method reasoning engine, TypeDB agent tools, implementation phases.

---

### 9. RLM-Inspired Memory Enhancements

|              |                                                                                    |
| ------------ | ---------------------------------------------------------------------------------- |
| **File**     | [`2026-02-24-rlm-memory-enhancements.md`](./2026-02-24-rlm-memory-enhancements.md) |
| **Lines**    | 2,449                                                                              |
| **Sections** | 22                                                                                 |
| **Scope**    | 5 RLM-inspired enhancements to the memory and cognitive systems                    |

Deep-dive into the five enhancements inspired by the Recursive Language Models paper (arXiv:2512.24601v2).

**Key topics**: R1 — Recursive Memory Consolidation (Jaccard grouping + summarization with `derived_from` provenance), R2 — Hierarchical Memory Index (daily → weekly → monthly → quarterly materialization), R3 — Context-Aware Pre-Compaction Compression (structured session checkpoints for continuity), R4 — Recursive Memory Search (iterative query refinement up to depth 3), R5 — BDI Cycle as Recursive Reasoning Loop (chunked belief processing + conflict detection), RLM paper-to-MABOS mapping, end-to-end data lifecycle trace, file implementation map, verification procedures, performance analysis.

---

### 10. TypeDB Integration & Knowledge Graph

|              |                                                                                  |
| ------------ | -------------------------------------------------------------------------------- |
| **File**     | [`2026-02-24-typedb-knowledge-graph.md`](./2026-02-24-typedb-knowledge-graph.md) |
| **Lines**    | 2,770                                                                            |
| **Sections** | 26                                                                               |
| **Scope**    | TypeDB client, schema generation, query layer, write-through patterns            |

Deep-dive into TypeDB as the knowledge graph backend.

**Key topics**: TypeDB HTTP client (singleton, graceful degradation), three-layer dual-storage (JSON source of truth + TypeDB write-through + Markdown materialization), schema generation pipeline (JSON-LD/OWL → TypeQLSchema → define query), SBVR-to-TypeDB projection, base schema (~100 attributes, ~25 entities, ~18 relations), agent scoping (`agent_owns` multi-tenant isolation), 12 query builder classes (FactStore, RuleStore, Memory, Inference, CBR, Goal, Desire, Belief, Decision, Workflow, Task, Intention), per-subsystem integration patterns, BPMN 2.0 workflow persistence, dashboard data access (8 query functions, Tropos goal model), goal seed system (VividWalls: 9 agents, 42 goals, 18 desires, 11 workflows), extension integration points.

---

## Cross-Reference Matrix

This matrix shows which subsystems are covered by which documents, helping you find the right reference for any topic.

| Subsystem                       | Primary Document             | Also Covered In                                     |
| ------------------------------- | ---------------------------- | --------------------------------------------------- |
| Gateway server                  | Gateway & Channel (2)        | System Architecture (1)                             |
| WebSocket protocol              | Gateway & Channel (2)        | —                                                   |
| Authentication                  | Gateway & Channel (2)        | System Architecture (1)                             |
| Channel integrations            | Gateway & Channel (2)        | Plugin & Extension (3)                              |
| Plugin system                   | Plugin & Extension (3)       | System Architecture (1)                             |
| Hook system                     | Plugin & Extension (3)       | —                                                   |
| Extension development           | Plugin & Extension (3)       | —                                                   |
| BDI cognitive cycle             | BDI + SBVR (4)               | Multi-Agent Coordination (5)                        |
| Goal/desire management          | Multi-Agent Coordination (5) | BDI + SBVR (4)                                      |
| ACL messaging                   | Multi-Agent Coordination (5) | BDI + SBVR (4)                                      |
| Contract Net Protocol           | Multi-Agent Coordination (5) | BDI + SBVR (4)                                      |
| Workforce management            | Multi-Agent Coordination (5) | —                                                   |
| Stakeholder governance          | Multi-Agent Coordination (5) | —                                                   |
| BPMN 2.0 workflows              | Multi-Agent Coordination (5) | TypeDB Knowledge Graph (10)                         |
| SBVR standard                   | SBVR Ontology (6)            | BDI + SBVR (4)                                      |
| JSON-LD/OWL ontologies          | SBVR Ontology (6)            | —                                                   |
| Ontology governance             | SBVR Ontology (6)            | —                                                   |
| Domain scaffolding              | SBVR Ontology (6)            | —                                                   |
| 35 reasoning methods            | Reasoning & Inference (7)    | —                                                   |
| Inference engine                | Reasoning & Inference (7)    | Memory & Knowledge (8)                              |
| Rule engine                     | Reasoning & Inference (7)    | Memory & Knowledge (8), SBVR Ontology (6)           |
| Fact store (SPO triples)        | Reasoning & Inference (7)    | Memory & Knowledge (8), TypeDB Knowledge Graph (10) |
| CBR-BDI                         | Reasoning & Inference (7)    | BDI + SBVR (4)                                      |
| Meta-reasoning router           | Reasoning & Inference (7)    | —                                                   |
| Memory system                   | Memory & Knowledge (8)       | System Architecture (1), RLM Enhancements (9)       |
| Hybrid search (FTS5 + vector)   | Memory & Knowledge (8)       | System Architecture (1)                             |
| Knowledge management tools      | Memory & Knowledge (8)       | SBVR Ontology (6), Reasoning & Inference (7)        |
| RLM enhancements (R1–R5)        | RLM Enhancements (9)         | Memory & Knowledge (8)                              |
| Memory consolidation            | RLM Enhancements (9)         | —                                                   |
| Hierarchical memory index       | RLM Enhancements (9)         | —                                                   |
| Session checkpoints             | RLM Enhancements (9)         | —                                                   |
| Recursive search                | RLM Enhancements (9)         | —                                                   |
| TypeDB client                   | TypeDB Knowledge Graph (10)  | —                                                   |
| TypeQL schema generation        | TypeDB Knowledge Graph (10)  | SBVR Ontology (6)                                   |
| TypeDB query layer              | TypeDB Knowledge Graph (10)  | Reasoning & Inference (7)                           |
| Write-through pattern           | TypeDB Knowledge Graph (10)  | —                                                   |
| Goal seed system                | TypeDB Knowledge Graph (10)  | —                                                   |
| Dashboard data access           | TypeDB Knowledge Graph (10)  | —                                                   |
| BDI runtime service             | Multi-Agent Coordination (5) | BDI + SBVR (4), RLM Enhancements (9)                |
| Business venture system         | Multi-Agent Coordination (5) | BDI + SBVR (4)                                      |
| Native apps (iOS/Android/macOS) | System Architecture (1)      | —                                                   |
| Deployment (Docker/cloud)       | System Architecture (1)      | —                                                   |
| Security architecture           | Gateway & Channel (2)        | System Architecture (1), Plugin & Extension (3)     |

---

## Statistics

| Document                        |      Lines | Sections |        Size |
| ------------------------------- | ---------: | :------: | ----------: |
| System Architecture             |      2,294 |    23    |      118 KB |
| Gateway & Channel Integration   |      2,883 |    38    |      130 KB |
| Plugin & Extension Architecture |      3,013 |    26    |      107 KB |
| BDI + SBVR Framework            |      1,565 |    19    |       86 KB |
| Multi-Agent Coordination        |      2,828 |    29    |      126 KB |
| SBVR Ontology System            |      2,103 |    25    |      117 KB |
| Reasoning & Inference Engine    |      2,321 |    26    |      114 KB |
| Memory & Knowledge Management   |      1,796 |    26    |       71 KB |
| RLM Memory Enhancements         |      2,449 |    22    |       96 KB |
| TypeDB & Knowledge Graph        |      2,770 |    26    |      113 KB |
| **Total**                       | **24,022** | **260**  | **1.08 MB** |

---

## Source Code Coverage

The documentation suite covers the following source code areas:

| Codebase Area                     |           Files | Primary Document(s)                        |
| --------------------------------- | --------------: | ------------------------------------------ |
| `src/gateway/`                    |             141 | Gateway & Channel Integration              |
| `src/channels/`                   |              88 | Gateway & Channel Integration              |
| `src/plugins/`                    |              80 | Plugin & Extension Architecture            |
| `src/memory/`                     |             40+ | Memory & Knowledge Management              |
| `extensions/mabos/src/tools/`     |     21+ modules | BDI + SBVR, Multi-Agent, Reasoning, Memory |
| `extensions/mabos/src/ontology/`  |              11 | SBVR Ontology System                       |
| `extensions/mabos/src/knowledge/` |               5 | TypeDB Knowledge Graph                     |
| `extensions/mabos/src/reasoning/` |              28 | Reasoning & Inference Engine               |
| `extensions/mabos/index.ts`       | 1 (3,270 lines) | Plugin & Extension, TypeDB                 |
| `mabos/bdi-runtime/`              |               1 | BDI + SBVR, Multi-Agent, RLM               |
| `extensions/` (channel plugins)   |             25+ | Gateway & Channel, Plugin & Extension      |
| `apps/` (native)                  |          4 dirs | System Architecture                        |

---

## Document Dependency Graph

```
                    ┌─────────────────────────┐
                    │   System Architecture   │
                    │        (1)              │
                    └─────────┬───────────────┘
                              │
              ┌───────────────┼───────────────┐
              │               │               │
              ▼               ▼               ▼
   ┌──────────────┐  ┌───────────────┐  ┌──────────────┐
   │  Gateway &   │  │   Plugin &    │  │  BDI + SBVR  │
   │  Channel (2) │  │ Extension (3) │  │ Framework (4)│
   └──────────────┘  └───────────────┘  └──────┬───────┘
                                               │
                         ┌─────────────────────┼──────────────┐
                         │                     │              │
                         ▼                     ▼              ▼
              ┌──────────────────┐  ┌──────────────┐  ┌──────────────┐
              │   Multi-Agent    │  │    SBVR      │  │  Memory &    │
              │ Coordination (5) │  │ Ontology (6) │  │ Knowledge (8)│
              └──────────────────┘  └──────┬───────┘  └──────┬───────┘
                                           │                 │
                         ┌─────────────────┤                 │
                         │                 │                 ▼
                         ▼                 │       ┌──────────────────┐
              ┌──────────────────┐         │       │ RLM Memory      │
              │   Reasoning &   │         │       │ Enhancements (9) │
              │  Inference (7)  │         │       └──────────────────┘
              └────────┬─────────┘         │
                       │                   │
                       ▼                   ▼
              ┌──────────────────────────────┐
              │   TypeDB & Knowledge         │
              │       Graph (10)             │
              └──────────────────────────────┘
```

---

## Conventions Used Across All Documents

- **Metadata headers**: Document title, version, date, status, license
- **Tables of contents**: Numbered section links
- **ASCII diagrams**: Architecture overviews, data flows, component relationships
- **Code snippets**: TypeScript function signatures, TypeQL queries, JSON-LD examples
- **Tables**: Tool catalogs, parameter summaries, comparison matrices
- **Cross-references**: Every document references its companion documents
- **File inventories**: Source file listings with paths and line counts

---

_This index is a living document. Update it when new architecture documents are added to the suite._
