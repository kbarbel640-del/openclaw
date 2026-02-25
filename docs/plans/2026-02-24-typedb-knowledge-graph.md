# TypeDB Integration and Knowledge Graph System in OpenClaw-MABOS

> **Document type:** Definitive Technical Reference
> **System:** OpenClaw-MABOS (Multi-Agent Business Operating System)
> **Subsystem:** TypeDB Knowledge Graph Backend
> **Last updated:** 2026-02-24
> **Companion documents:** `openclaw-mabos-system-architecture.md`, `bdi-sbvr-framework.md`, `sbvr-ontology-system.md`, `reasoning-inference-engine.md`

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Architecture Overview](#2-architecture-overview)
3. [File Inventory](#3-file-inventory)
4. [TypeDB Client](#4-typedb-client)
5. [Dual-Storage Architecture](#5-dual-storage-architecture)
6. [Schema Generation Pipeline](#6-schema-generation-pipeline)
7. [XSD to TypeQL Type Mapping and Name Conversion](#7-xsd-to-typeql-type-mapping-and-name-conversion)
8. [SBVR-to-TypeDB Projection](#8-sbvr-to-typedb-projection)
9. [Base Schema](#9-base-schema)
10. [Agent Scoping and Multi-Tenant Isolation](#10-agent-scoping-and-multi-tenant-isolation)
11. [Query Builder Classes](#11-query-builder-classes)
12. [Fact Store Integration](#12-fact-store-integration)
13. [Rule Engine Integration](#13-rule-engine-integration)
14. [Inference Engine Integration](#14-inference-engine-integration)
15. [Memory Integration](#15-memory-integration)
16. [CBR Integration](#16-cbr-integration)
17. [BDI Cognitive State Queries](#17-bdi-cognitive-state-queries)
18. [BPMN 2.0 Workflow Persistence](#18-bpmn-20-workflow-persistence)
19. [Dashboard Data Access Layer](#19-dashboard-data-access-layer)
20. [Agent-Facing TypeDB Tools](#20-agent-facing-typedb-tools)
21. [Goal Seed System](#21-goal-seed-system)
22. [Ontology-to-TypeDB Pipeline](#22-ontology-to-typedb-pipeline)
23. [Extension Integration](#23-extension-integration)
24. [Data Flow Diagrams](#24-data-flow-diagrams)
25. [Operational Considerations](#25-operational-considerations)
26. [References](#26-references)

---

## 1. Executive Summary

TypeDB serves as the knowledge graph backend for the entire MABOS cognitive architecture. It provides a strongly-typed, relation-first database that maps directly to the BDI (Belief-Desire-Intention) mental model, the SBVR business vocabulary, the OWL/JSON-LD ontology layer, and the BPMN 2.0 workflow persistence layer.

**What TypeDB provides to MABOS:**

- **Structured knowledge representation** -- SPO (Subject-Predicate-Object) fact triples, inference rules, memory items, and CBR cases stored as first-class typed entities with rich attribute sets.
- **BDI cognitive state persistence** -- Beliefs, desires, goals, intentions, plans, plan steps, and decisions are all TypeDB entities connected through typed relations that mirror the BDI reasoning cycle.
- **Multi-tenant agent isolation** -- Every entity in the graph is scoped to its owning agent through the `agent_owns` relation, ensuring that queries for one agent never leak data from another.
- **BPMN 2.0 workflow storage** -- Full CRUD for workflows, elements, flows, pools, and lanes with structural relations that allow graph traversal of process models.
- **Ontology-driven schema** -- JSON-LD/OWL ontologies are automatically converted to TypeQL `define` statements, keeping the graph schema synchronized with the domain model.
- **SBVR projection** -- SBVR concept types, fact types, business rules, and proof tables are mapped into TypeQL entities and relations, enabling formal business rule validation through graph queries.
- **Dashboard data access** -- The dashboard REST API queries TypeDB directly for agent lists, agent details, decisions, workflows, tasks, Tropos goal models, and knowledge statistics.
- **Graceful degradation** -- TypeDB is optional. When unavailable, all subsystems fall back to JSON file storage transparently. No feature is lost; only the graph query capability is deferred.

The system uses a **write-through architecture**: JSON files remain the source of truth, TypeDB receives best-effort writes in parallel, and reads attempt TypeDB first before falling back to JSON. A third layer -- Markdown materialization -- provides compatibility with OpenClaw's native search indexer.

---

## 2. Architecture Overview

The following diagram shows how TypeDB integrates with every subsystem in the MABOS extension:

```
+------------------------------------------------------------------+
|                    MABOS Extension (index.ts)                     |
|                                                                   |
|  Startup: lazy TypeDB connection (fire-and-forget)                |
|  Shutdown: TypeDB close()                                         |
|  BDI Heartbeat: writeBdiCycleResultToTypeDB()                     |
|  Onboarding: schema sync + goal seed + Tropos model               |
+------------------------------------------------------------------+
         |              |              |              |
         v              v              v              v
+-------------+  +-------------+  +-------------+  +-------------+
| Fact Store  |  | Rule Engine |  | Memory Tools|  | Inference   |
| fact-store  |  | rule-engine |  | memory-tools|  | inference-  |
| .ts         |  | .ts         |  | .ts         |  | tools.ts    |
+------+------+  +------+------+  +------+------+  +------+------+
       |                |                |                |
       | Write-through  | Write-through  | Write-through  | Query
       v                v                v                v
+------------------------------------------------------------------+
|              TypeDB Query Layer (typedb-queries.ts)               |
|                                                                   |
|  12 Query Builder Classes:                                        |
|  FactStoreQueries | RuleStoreQueries | MemoryQueries             |
|  InferenceQueries | CBRQueries       | GoalStoreQueries          |
|  DesireStoreQueries | BeliefStoreQueries | DecisionStoreQueries  |
|  WorkflowStoreQueries | TaskStoreQueries | IntentionStoreQueries |
+------------------------------------------------------------------+
         |              |              |              |
         v              v              v              v
+------------------------------------------------------------------+
|           TypeDB Client (typedb-client.ts)                        |
|                                                                   |
|  Singleton HTTP wrapper around typedb-driver-http                 |
|  Methods: connect, ensureDatabase, defineSchema,                  |
|           insertData, matchQuery, deleteData,                     |
|           healthCheck, close                                      |
|  Error: TypeDBUnavailableError -> graceful fallback               |
+------------------------------------------------------------------+
         |                                          |
         v                                          v
+-------------------------+    +----------------------------------+
|  TypeDB Server (HTTP)   |    |  JSON File Storage (fallback)    |
|  http://157.230.13.13   |    |  agents/<id>/facts.json          |
|  :8729                  |    |  agents/<id>/rules.json           |
|  Database: mabos_<biz>  |    |  agents/<id>/memory-store.json   |
+-------------------------+    +----------------------------------+
                                         |
                                         v
                               +------------------+
                               | Markdown Layer   |
                               | (.md files for   |
                               |  search indexer) |
                               +------------------+

+------------------------------------------------------------------+
|           Schema Pipeline                                         |
|                                                                   |
|  .jsonld files --> loadOntologies() --> mergeOntologies()          |
|       --> jsonldToTypeQL() --> generateDefineQuery()               |
|       --> getBaseSchema() + ontology schema                       |
|       --> defineSchema() to TypeDB                                |
+------------------------------------------------------------------+

+------------------------------------------------------------------+
|           Dashboard Data Access (typedb-dashboard.ts)             |
|                                                                   |
|  queryAgentListFromTypeDB()    queryAgentDetailFromTypeDB()       |
|  queryDecisionsFromTypeDB()    queryWorkflowsFromTypeDB()         |
|  queryTasksFromTypeDB()        writeBdiCycleResultToTypeDB()      |
|  queryKnowledgeStatsFromTypeDB()  queryGoalModelFromTypeDB()      |
+------------------------------------------------------------------+

+------------------------------------------------------------------+
|           BPMN Queries (bpmn-queries.ts)                          |
|                                                                   |
|  BpmnStoreQueries: createWorkflow, addElement, addFlow,           |
|  addPool, addLane, linkWorkflowToGoal, queryOrphanNodes ...       |
+------------------------------------------------------------------+

+------------------------------------------------------------------+
|           Goal Seed (goal-seed.ts, 2630 lines)                    |
|                                                                   |
|  9 agents, 18 desires, 42 goals, 8 beliefs, 5 decisions,         |
|  11 workflows with plans, plan steps, tasks, and all relations    |
+------------------------------------------------------------------+
```

**Data flow summary:**

1. **Writes** go to JSON first (source of truth), then to TypeDB (best-effort), then to Markdown (materialization).
2. **Reads** try TypeDB first; if unavailable or empty, fall back to JSON file parsing.
3. **Schema** is generated from JSON-LD ontologies and the hardcoded base schema, then pushed to TypeDB via `defineSchema()`.
4. **Dashboard** queries TypeDB directly for display data, with null returns triggering filesystem fallback.

---

## 3. File Inventory

### Knowledge Directory

Located at `extensions/mabos/src/knowledge/`:

| File                  | Lines | Purpose                                           |
| --------------------- | ----- | ------------------------------------------------- |
| `typedb-client.ts`    | 186   | Singleton HTTP client with graceful degradation   |
| `typedb-schema.ts`    | 234   | JSON-LD/OWL to TypeQL schema converter            |
| `typedb-queries.ts`   | 1,468 | 12 query builder classes + base schema definition |
| `typedb-dashboard.ts` | 749   | Dashboard data access layer                       |
| `bpmn-queries.ts`     | 506   | BPMN 2.0 workflow query builders                  |

### Tool Files with TypeDB Integration

Located at `extensions/mabos/src/tools/`:

| File                 | Lines | TypeDB Role                           |
| -------------------- | ----- | ------------------------------------- |
| `typedb-tools.ts`    | 304   | 5 agent-facing TypeDB tools           |
| `fact-store.ts`      | ~250  | SPO triples with TypeDB write-through |
| `rule-engine.ts`     | ~300  | Rules with TypeDB write-through       |
| `inference-tools.ts` | ~250  | Inference engine with TypeDB queries  |
| `workflow-tools.ts`  | ~400  | BPMN workflows persisted to TypeDB    |
| `goal-seed.ts`       | 2,630 | VividWalls business goal seeding      |

### Ontology

Located at `extensions/mabos/src/ontology/`:

| File                   | Purpose                                           |
| ---------------------- | ------------------------------------------------- |
| `index.ts`             | Loader, validator, merger, SBVR export for TypeDB |
| `mabos-upper.jsonld`   | Upper ontology (core concepts)                    |
| `business-core.jsonld` | Business core ontology                            |
| `ecommerce.jsonld`     | E-commerce domain ontology                        |
| `retail.jsonld`        | Retail domain ontology                            |
| `saas.jsonld`          | SaaS domain ontology                              |
| `consulting.jsonld`    | Consulting domain ontology                        |
| `marketplace.jsonld`   | Marketplace domain ontology                       |
| `cross-domain.jsonld`  | Cross-domain relations                            |
| `shapes.jsonld`        | SHACL validation shapes                           |
| `shapes-sbvr.jsonld`   | SBVR-specific SHACL shapes                        |

---

## 4. TypeDB Client

**File:** `extensions/mabos/src/knowledge/typedb-client.ts` (186 lines)

### Purpose

The TypeDB client is a singleton HTTP wrapper around the `typedb-driver-http` package. It provides a thin abstraction that handles connection management, database lifecycle, query execution, and health checking. When TypeDB is unreachable, it throws `TypeDBUnavailableError` so callers can fall back to file-based storage.

### TypeDBUnavailableError

```typescript
export class TypeDBUnavailableError extends Error {
  constructor(message = "TypeDB is not available") {
    super(message);
    this.name = "TypeDBUnavailableError";
  }
}
```

This custom error class is the cornerstone of graceful degradation. Every caller in the system catches this specific error type and continues with JSON/Markdown storage instead. It is never caught internally within the client itself -- it propagates to the caller so the caller decides the fallback strategy.

### Helper: unwrap()

```typescript
function unwrap<T>(res: ApiResponse<T>): T {
  if ("err" in res) {
    throw new Error(`TypeDB API error [${res.err.code}]: ${res.err.message}`);
  }
  return (res as { ok: T }).ok;
}
```

All TypeDB HTTP driver responses come as `ApiResponse<T>` unions of `{ ok: T }` and `{ err: { code, message } }`. The `unwrap()` helper normalizes this into a throw-on-error pattern consistent with the rest of the codebase.

### TypeDBClient Class

```typescript
export class TypeDBClient {
  private driver: TypeDBHttpDriverType | null = null;
  private available = false;
  private driverParams: DriverParams;
  private currentDatabase: string | null = null;
}
```

**Constructor parameters:**

- `username` -- defaults to `"admin"`
- `password` -- defaults to `"password"`
- `addresses` -- defaults to `[process.env.TYPEDB_URL || "http://157.230.13.13:8729"]`

### Methods

| Method                      | Transaction Type  | Purpose                                                            |
| --------------------------- | ----------------- | ------------------------------------------------------------------ |
| `connect()`                 | N/A               | Attempt connection, set `available` flag. Returns `boolean`.       |
| `isAvailable()`             | N/A               | Check the `available` flag and driver existence.                   |
| `ensureDatabase(name)`      | Admin             | Create database if it does not exist. Sets `currentDatabase`.      |
| `defineSchema(typeql, db?)` | Schema (one-shot) | Run a TypeQL `define` transaction.                                 |
| `insertData(typeql, db?)`   | Write (one-shot)  | Run a TypeQL `insert` or `match...insert` transaction.             |
| `matchQuery(typeql, db?)`   | Read (one-shot)   | Run a TypeQL `match` query. Returns `QueryResponse`.               |
| `deleteData(typeql, db?)`   | Write (one-shot)  | Run a TypeQL `match...delete` transaction.                         |
| `healthCheck()`             | Read              | Ping server, return `{ available: boolean, databases: string[] }`. |
| `close()`                   | N/A               | Null the driver reference, set `available = false`.                |

**Key design decisions:**

1. **One-shot queries** -- Every query uses `oneShotQuery()` from the HTTP driver, which opens a transaction, executes the query, and commits (or rolls back on error) in a single HTTP round trip. This avoids long-lived transaction management.

2. **Schema vs. Write vs. Read** -- The driver's `oneShotQuery()` takes a `transactionType` parameter: `"schema"` for define queries, `"write"` for inserts/deletes, and `"read"` for match queries. The `commitChanges` boolean is set to `true` for schema and write transactions, `false` for reads.

3. **Database fallback in ensureAvailable()** -- If the driver is `null` or `available` is `false`, the method throws `TypeDBUnavailableError` immediately. No reconnection is attempted at query time.

4. **Error recovery in ensureDatabase()** -- If listing or creating the database fails, `available` is set to `false` and `TypeDBUnavailableError` is thrown. This prevents cascading failures from a temporarily unreachable server.

### Singleton Factory

```typescript
let clientInstance: TypeDBClient | null = null;

export function getTypeDBClient(serverUrl?: string): TypeDBClient {
  if (!clientInstance) {
    const addresses = serverUrl
      ? [serverUrl.startsWith("http") ? serverUrl : `http://${serverUrl}`]
      : undefined;
    clientInstance = new TypeDBClient(addresses ? { addresses } : undefined);
    // Fire-and-forget connection attempt
    clientInstance.connect().catch(() => {});
  }
  return clientInstance;
}
```

**Fire-and-forget semantics:** The first call to `getTypeDBClient()` creates the singleton and initiates a connection attempt. The `.catch(() => {})` ensures the unhandled promise rejection does not crash the process. Subsequent calls return the same instance. If the connection failed, `isAvailable()` returns `false` and callers handle it.

**URL normalization:** If a `serverUrl` is provided without the `http://` prefix, it is automatically prepended.

---

## 5. Dual-Storage Architecture

MABOS employs a three-layer storage strategy where TypeDB is the graph layer, JSON files are the persistence layer, and Markdown is the search layer:

### Layer 1: JSON Files (Source of Truth)

```
workspace/agents/<agent-id>/
  facts.json         -- SPO fact triples
  rules.json         -- Inference, constraint, and policy rules
  memory-store.json  -- Working, short-term, and long-term memory
```

JSON files are read and written synchronously with every data operation. They survive TypeDB outages, server restarts, and schema migrations. The file format is stable and human-readable.

### Layer 2: TypeDB (Knowledge Graph)

```
Database: mabos_<business-id>
  Schema: base schema + ontology-derived schema
  Data: all entities scoped via agent_owns relation
```

TypeDB receives **best-effort writes** wrapped in try/catch blocks. Failures are logged but never block the primary operation. Reads **try TypeDB first** -- if the client is available and returns data, that data is used; otherwise the system falls back to JSON.

### Layer 3: Markdown (Search Indexer)

```
workspace/agents/<agent-id>/
  knowledge/facts.md      -- Materialized fact list
  knowledge/rules.md      -- Materialized rule list
  knowledge/memory.md     -- Materialized memory items
```

After every write, the `memory-materializer.ts` module renders the data as Markdown files. OpenClaw's native search indexer (which powers the `@workspace` context in chat) can then find and surface knowledge entries.

### Write-Through Pattern

The write-through pattern is implemented identically across `fact-store.ts`, `rule-engine.ts`, and `memory-tools.ts`:

```
[Agent Tool Call]
       |
       v
  1. Read JSON file (load current state)
  2. Mutate in-memory data structure
  3. Write JSON file (persist change)
  4. Materialize Markdown (search indexer)
  5. Try TypeDB write (best-effort):
       |
       +-- Success: data is now in both JSON and TypeDB
       |
       +-- TypeDBUnavailableError: log, continue
       |
       +-- Other error: log, continue
       |
       v
  6. Return result to agent
```

### Read-Through Pattern

```
[Agent Tool Call / Dashboard Request]
       |
       v
  1. Is TypeDB available?
       |
       +-- Yes: Execute TypeQL match query
       |     |
       |     +-- Results found: return TypeDB data
       |     |
       |     +-- No results: fall through to JSON
       |
       +-- No: fall through to JSON
       |
       v
  2. Read JSON file (fallback)
  3. Parse and return file data
```

### Why Three Layers?

| Layer    | Durability                 | Query Power                              | Search Integration      |
| -------- | -------------------------- | ---------------------------------------- | ----------------------- |
| JSON     | High (filesystem)          | Low (linear scan)                        | None                    |
| TypeDB   | Medium (server dependency) | High (graph traversal, pattern matching) | None                    |
| Markdown | High (filesystem)          | None                                     | Full (OpenClaw indexer) |

The three-layer approach ensures that:

- Data is never lost (JSON files)
- Complex queries are possible when TypeDB is available (graph traversal)
- Knowledge is discoverable through OpenClaw's chat interface (Markdown)

---

## 6. Schema Generation Pipeline

**File:** `extensions/mabos/src/knowledge/typedb-schema.ts` (234 lines)

The schema generation pipeline converts JSON-LD/OWL ontologies into TypeQL `define` statements. This is a multi-stage transformation:

```
.jsonld files
     |
     v
loadOntologies()          -- Read all .jsonld files from ontology directory
     |
     v
mergeOntologies()         -- Produce MergedGraph (classes, objectProperties,
     |                       datatypeProperties)
     v
jsonldToTypeQL(graph)     -- Walk MergedGraph, produce TypeQLSchema
     |                       (entities, attributes, relations)
     v
generateDefineQuery()     -- Concatenate into TypeQL `define` block
     |
     v
getBaseSchema()           -- Hardcoded base schema for runtime entities
     |
     v
defineSchema()            -- Push to TypeDB via HTTP client
```

### TypeQLSchema Type Structure

```typescript
interface TypeQLEntityDef {
  name: string;
  parent?: string; // for `sub` inheritance
  owns: string[]; // attributes this entity owns
}

interface TypeQLAttributeDef {
  name: string;
  valueType: "string" | "integer" | "double" | "boolean" | "datetime";
}

interface TypeQLRelationDef {
  name: string;
  roles: Array<{ roleName: string; playerEntity: string }>;
}

interface TypeQLSchema {
  entities: TypeQLEntityDef[];
  attributes: TypeQLAttributeDef[];
  relations: TypeQLRelationDef[];
}
```

### Core Converter: jsonldToTypeQL()

The converter walks the `MergedGraph` in three passes:

**Pass 1: Attributes from owl:DatatypeProperty nodes**

For each datatype property in the merged graph, the converter extracts the property's `rdfs:range` (defaulting to `xsd:string` if absent), maps it through the XSD-to-TypeQL type table, converts the property name to snake_case, and emits a `TypeQLAttributeDef`.

It also ensures six base attributes always exist regardless of ontology content: `name`, `description`, `uid`, `confidence`, `created_at`, `updated_at`.

**Pass 2: Entities from owl:Class nodes**

For each OWL class, the converter:

1. Converts the class name to snake_case via `typeqlName()`
2. Checks for `rdfs:subClassOf` to set the parent entity (for TypeQL `sub` inheritance)
3. Collects all datatype properties whose `rdfs:domain` equals this class ID
4. Emits a `TypeQLEntityDef` with the collected `owns` list

**Pass 3: Relations from owl:ObjectProperty nodes**

For each object property, the converter checks for `sbvr:roles` annotations:

- If `sbvr:roles` is present and non-empty: each role becomes a `relates` declaration with the role name and player entity derived from the SBVR annotation
- If `sbvr:roles` is absent: falls back to using `rdfs:domain` as the "subject" role and `rdfs:range` as the "object" role

### generateDefineQuery()

The generator concatenates the schema into a single TypeQL `define` block with strict ordering:

1. **Attributes first** -- `attribute <name>, value <type>;`
2. **Entities second** -- `entity <name> [sub <parent>] [, owns <attr>...];`
3. **Relations third** -- `relation <name>, relates <role>...;` followed by role-playing declarations
4. **Agent scoping** -- Always appends the `agent_owns` relation at the end

Example output:

```typeql
define
  attribute revenue, value double;
  attribute business_name, value string;

  entity business_entity,
    owns revenue,
    owns business_name;

  entity consulting_firm sub business_entity;

  relation provides_service,
    relates provider,
    relates consumer;
  consulting_firm plays provides_service:provider;
  business_entity plays provides_service:consumer;

  relation agent_owns,
    relates owner,
    relates owned;
```

---

## 7. XSD to TypeQL Type Mapping and Name Conversion

### XSD Type Mapping

The schema converter maps XML Schema (XSD) datatypes to TypeQL value types:

| XSD Type       | TypeQL Value Type | Notes                         |
| -------------- | ----------------- | ----------------------------- |
| `xsd:string`   | `string`          | Default for unknown types     |
| `xsd:integer`  | `integer`         | Also used for `xsd:int`       |
| `xsd:long`     | `integer`         | TypeQL `integer` is 64-bit    |
| `xsd:float`    | `double`          | Promoted to double precision  |
| `xsd:double`   | `double`          | Direct mapping                |
| `xsd:decimal`  | `double`          | Approximated as double        |
| `xsd:boolean`  | `boolean`         | Direct mapping                |
| `xsd:dateTime` | `datetime`        | Direct mapping                |
| `xsd:date`     | `datetime`        | Promoted to datetime          |
| `xsd:time`     | `string`          | No native time type in TypeQL |
| `xsd:anyURI`   | `string`          | Stored as string              |

The mapping function defaults to `"string"` for any unrecognized XSD type:

```typescript
function xsdToTypeQL(xsdType: string): TypeQLAttributeDef["valueType"] {
  return XSD_TYPE_MAP[xsdType] || "string";
}
```

### Name Conversion Pipeline

Ontology identifiers go through a three-step conversion to produce TypeQL-safe names:

**Step 1: stripPrefix()**

Removes namespace prefixes separated by a colon:

```
"mabos:BusinessEntity"  -->  "BusinessEntity"
"ecom:ProductCatalog"   -->  "ProductCatalog"
"schema:Organization"   -->  "Organization"
```

**Step 2: toSnakeCase()**

Converts camelCase and PascalCase to snake_case:

```
"BusinessEntity"     -->  "business_entity"
"hasRevenue"         -->  "has_revenue"
"ProductCatalog"     -->  "product_catalog"
"isCompetitorOf"     -->  "is_competitor_of"
"ARPreviewFeature"   -->  "a_r_preview_feature"
```

The regex handles both `lowerUPPER` and `UPPERUpper` transitions:

```typescript
function toSnakeCase(name: string): string {
  return name
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .replace(/([A-Z])([A-Z][a-z])/g, "$1_$2")
    .toLowerCase();
}
```

**Step 3: typeqlName()**

Composes the two transformations:

```typescript
function typeqlName(id: string): string {
  return toSnakeCase(stripPrefix(id));
}
```

### Naming Conventions Summary

| Ontology Convention         | TypeQL Convention     | Example                                       |
| --------------------------- | --------------------- | --------------------------------------------- |
| PascalCase classes          | snake_case entities   | `owl:BusinessEntity` -> `business_entity`     |
| camelCase properties        | snake_case attributes | `mabos:hasRevenue` -> `has_revenue`           |
| camelCase object properties | snake_case relations  | `mabos:providesService` -> `provides_service` |

---

## 8. SBVR-to-TypeDB Projection

**Files:** `ontology/index.ts` (exportSBVRForTypeDB), `knowledge/typedb-schema.ts` (exportSBVRForTypeDB bridge)

### Overview

SBVR (Semantics of Business Vocabulary and Business Rules) annotations embedded in JSON-LD ontologies are projected into TypeDB through two pathways:

1. **Schema pathway:** `sbvr:roles` annotations on `owl:ObjectProperty` nodes drive the relation/role structure in TypeQL.
2. **Data pathway:** SBVR concept types, fact types, rules, and proof tables are exported as structured data that can be inserted into TypeDB entities.

### SBVR Concept Types to TypeQL Entities

OWL classes annotated with `sbvr:conceptType: "NounConcept"` are exported as concept type records:

```json
{
  "id": "mabos:BusinessEntity",
  "name": "Business Entity",
  "definition": "An organization that conducts business operations",
  "properties": { "subClassOf": "mabos:Agent", "vocabulary": "core" },
  "constraints": {},
  "business_context": "core"
}
```

In the TypeQL schema, these become entities:

```typeql
entity business_entity sub agent,
  owns name,
  owns description;
```

### SBVR Fact Types to TypeQL Relations

OWL object properties annotated with `sbvr:conceptType: "FactType"` are exported as fact type records with role information:

```json
{
  "id": "mabos:employs",
  "name": "Organization employs Agent",
  "definition": "An organization has an agent in its employ",
  "arity": 2,
  "roles": [
    { "name": "employer", "concept": "mabos:Organization", "cardinality": "1" },
    { "name": "employee", "concept": "mabos:Agent", "cardinality": "1" }
  ]
}
```

In the TypeQL schema, these become relations:

```typeql
relation employs,
  relates employer,
  relates employee;
organization plays employs:employer;
agent plays employs:employee;
```

The `sbvr:roles` array directly determines the `relates` declarations. If `sbvr:roles` is absent, the converter falls back to `rdfs:domain` as "subject" and `rdfs:range` as "object".

### SBVR Rules to TypeDB Data

Business rules annotated as `sbvr:DefinitionalRule` or `sbvr:BehavioralRule` are exported with full metadata:

```json
{
  "id": "rule:minimum-order-value",
  "name": "Minimum Order Value",
  "definition": "Each order must have a total value of at least $25",
  "rule_type": "behavioral",
  "condition": "order.total >= 25",
  "action": "Enforce behavioral constraint",
  "priority": 8,
  "validation_logic": {
    "preconditions": ["mabos:hasOrder"],
    "postconditions": ["constraint_validated"]
  },
  "proof_requirements": ["proof_table_validation"],
  "business_impact": "high",
  "is_active": true
}
```

These can be inserted into TypeDB as `knowledge_rule` entities using `RuleStoreQueries.createRule()`.

### SBVR Proof Tables

Rules with `sbvr:hasProofTable` annotations generate proof table records:

```json
{
  "id": "pt:min-order-proof",
  "name": "Minimum Order Value Proof",
  "description": "Proof table for Minimum Order Value",
  "rule_id": "rule:minimum-order-value",
  "input_variables": ["mabos:hasOrder"],
  "output_variables": ["truth_value"],
  "truth_conditions": [{ "condition": "order.total >= 25", "expected_result": true }],
  "optimization_hints": {
    "indexing_strategy": "btree_on_conditions",
    "caching_policy": "cache_frequent_validations"
  }
}
```

### Bridge Function

The `typedb-schema.ts` file provides a bridge function that combines both pathways:

```typescript
export function exportSBVRForTypeDB(
  graph: MergedGraph,
  sbvrExport: SBVRExport,
): SBVRExport & { typeql: string } {
  const schema = jsonldToTypeQL(graph);
  const typeql = generateDefineQuery(schema);
  return { ...sbvrExport, typeql };
}
```

This returns the standard SBVR export data augmented with the generated TypeQL schema string, allowing consumers to push both the schema and the SBVR data in a single operation.

---

## 9. Base Schema

**File:** `extensions/mabos/src/knowledge/typedb-queries.ts`, function `getBaseSchema()`

The base schema is a hardcoded TypeQL `define` block that establishes all runtime entities, attributes, and relations needed by MABOS. It is independent of the ontology-derived schema and is always pushed to TypeDB first.

### Attributes (~100)

The base schema defines approximately 100 attributes organized into categories:

**Core Attributes:**

| Attribute     | Type   | Usage                                             |
| ------------- | ------ | ------------------------------------------------- |
| `uid`         | string | Universal unique identifier (used as `@key`)      |
| `name`        | string | Display name                                      |
| `description` | string | Long-form description                             |
| `confidence`  | double | Confidence score (0.0-1.0)                        |
| `source`      | string | Origin of the data                                |
| `created_at`  | string | ISO 8601 creation timestamp                       |
| `updated_at`  | string | ISO 8601 last-modified timestamp                  |
| `status`      | string | Current status (active, completed, pending, etc.) |
| `content`     | string | Free-form content field                           |

**Fact Store Attributes:**

| Attribute      | Type   | Usage                       |
| -------------- | ------ | --------------------------- |
| `subject`      | string | SPO triple subject          |
| `predicate`    | string | SPO triple predicate        |
| `object_value` | string | SPO triple object           |
| `valid_from`   | string | Temporal validity start     |
| `valid_until`  | string | Temporal validity end       |
| `rule_id`      | string | Rule that derived this fact |

**Rule Engine Attributes:**

| Attribute           | Type    | Usage                            |
| ------------------- | ------- | -------------------------------- |
| `rule_type`         | string  | inference, constraint, or policy |
| `condition_count`   | integer | Number of conditions             |
| `confidence_factor` | double  | Rule confidence multiplier       |
| `enabled`           | boolean | Whether rule is active           |
| `domain`            | string  | Knowledge domain                 |

**Memory Attributes:**

| Attribute      | Type    | Usage                          |
| -------------- | ------- | ------------------------------ |
| `memory_type`  | string  | Type classification            |
| `importance`   | double  | Importance score               |
| `store_name`   | string  | working, short_term, long_term |
| `access_count` | integer | Number of times accessed       |
| `accessed_at`  | string  | Last access timestamp          |
| `tag`          | string  | Tagging (multi-valued)         |

**CBR Attributes:**

| Attribute   | Type   | Usage                 |
| ----------- | ------ | --------------------- |
| `situation` | string | Case situation (JSON) |
| `solution`  | string | Case solution (JSON)  |
| `outcome`   | string | Case outcome (JSON)   |

**BDI Cognitive Attributes:**

| Attribute             | Type    | Usage                            |
| --------------------- | ------- | -------------------------------- |
| `category`            | string  | Belief category                  |
| `certainty`           | double  | Belief certainty (0.0-1.0)       |
| `priority`            | double  | Priority score                   |
| `urgency`             | double  | Urgency score                    |
| `alignment`           | double  | Strategic alignment score        |
| `hierarchy_level`     | string  | strategic, tactical, operational |
| `success_criteria`    | string  | Goal success criteria            |
| `deadline`            | string  | Goal/intention deadline          |
| `progress`            | double  | Goal progress (0.0-1.0)          |
| `parent_goal_id`      | string  | Parent goal for hierarchy        |
| `commitment_strategy` | string  | Intention commitment type        |
| `plan_ref`            | string  | Reference to plan                |
| `plan_source`         | string  | Where the plan came from         |
| `step_count`          | integer | Number of steps in plan          |
| `adaptation_notes`    | string  | Plan adaptation history          |
| `step_type`           | string  | Plan step type                   |
| `tool_binding`        | string  | Tool bound to step               |
| `estimated_duration`  | string  | Estimated time for step          |
| `sequence_order`      | integer | Step ordering                    |

**Agent Identity Attributes:**

| Attribute            | Type   | Usage                      |
| -------------------- | ------ | -------------------------- |
| `role_title`         | string | Agent's role title         |
| `department`         | string | Department assignment      |
| `responsibilities`   | string | Role responsibilities      |
| `autonomy_level`     | string | low, medium, high          |
| `approval_threshold` | double | USD threshold for autonomy |
| `proficiency_level`  | double | Skill proficiency          |
| `skill_category`     | string | Skill categorization       |
| `tool_access`        | string | Tools this skill grants    |

**Scheduling Attributes:**

| Attribute         | Type    | Usage                      |
| ----------------- | ------- | -------------------------- |
| `cron_expression` | string  | Cron schedule              |
| `cron_enabled`    | boolean | Whether schedule is active |
| `cron_timezone`   | string  | Timezone for schedule      |

**Workflow Attributes:**

| Attribute           | Type   | Usage                      |
| ------------------- | ------ | -------------------------- |
| `workflow_type`     | string | Workflow classification    |
| `trigger`           | string | What triggers the workflow |
| `current_step_id`   | string | Active step pointer        |
| `assigned_agent_id` | string | Agent assigned to task     |
| `depends_on_ids`    | string | Dependency list (JSON)     |
| `task_type`         | string | Task classification        |

**Reasoning Attributes:**

| Attribute         | Type    | Usage                        |
| ----------------- | ------- | ---------------------------- |
| `method_category` | string  | Reasoning method type        |
| `applicability`   | string  | When method applies          |
| `method_used`     | string  | Which method was used        |
| `conclusion`      | string  | Reasoning conclusion         |
| `reasoning_trace` | string  | Step-by-step trace           |
| `decision_type`   | string  | Decision classification      |
| `options_count`   | integer | Number of options            |
| `chosen_option`   | string  | Selected option              |
| `impact_level`    | string  | Decision impact              |
| `urgency_level`   | string  | Decision urgency             |
| `resolved`        | boolean | Whether decision is resolved |
| `options_json`    | string  | Options as JSON string       |
| `recommendation`  | string  | Agent recommendation         |
| `committed_at`    | string  | When intention was committed |

**BPMN 2.0 Attributes:**

| Attribute           | Type    | Usage                                                |
| ------------------- | ------- | ---------------------------------------------------- |
| `element_type`      | string  | BPMN element type (event, task, gateway, subprocess) |
| `event_position`    | string  | start, intermediate, end                             |
| `event_trigger`     | string  | none, message, timer, signal, error, etc.            |
| `event_catching`    | boolean | Catching vs. throwing                                |
| `event_definition`  | string  | Event definition details                             |
| `task_type_bpmn`    | string  | user, service, script, manual, etc.                  |
| `loop_type`         | string  | standard, multi-instance                             |
| `is_compensation`   | boolean | Compensation activity flag                           |
| `subprocess_type`   | string  | embedded, call_activity                              |
| `called_element`    | string  | Called process reference                             |
| `gateway_type`      | string  | exclusive, parallel, inclusive, event-based          |
| `default_flow_id`   | string  | Default sequence flow                                |
| `flow_type`         | string  | sequence, message, association                       |
| `condition_expr`    | string  | Flow condition expression                            |
| `is_default`        | boolean | Default flow flag                                    |
| `waypoints`         | string  | Flow waypoints (JSON)                                |
| `pos_x`             | double  | Element X position                                   |
| `pos_y`             | double  | Element Y position                                   |
| `size_w`            | double  | Element width                                        |
| `size_h`            | double  | Element height                                       |
| `pool_id`           | string  | Pool reference                                       |
| `lane_id`           | string  | Lane reference                                       |
| `participant_ref`   | string  | Pool participant reference                           |
| `is_black_box`      | boolean | Black-box pool flag                                  |
| `assignee_agent_id` | string  | Agent assigned to element                            |
| `action_tool`       | string  | Tool bound to task element                           |
| `schedule_json`     | string  | Schedule configuration                               |
| `workflow_version`  | integer | Schema version number                                |
| `documentation`     | string  | Element documentation                                |

### Entities (~25)

**Core Entities:**

| Entity           | Key Attributes                                                             | Purpose                          |
| ---------------- | -------------------------------------------------------------------------- | -------------------------------- |
| `agent`          | uid (key), name                                                            | The agent itself                 |
| `spo_fact`       | uid (key), subject, predicate, object_value, confidence, source            | SPO triple                       |
| `knowledge_rule` | uid (key), name, rule_type, condition_count, confidence_factor, enabled    | Inference/constraint/policy rule |
| `memory_item`    | uid (key), content, memory_type, importance, store_name, access_count, tag | Memory entry                     |
| `cbr_case`       | uid (key), situation, solution, outcome, domain                            | Case-based reasoning case        |

**BDI Cognitive Entities:**

| Entity      | Key Attributes                                                               | Purpose         |
| ----------- | ---------------------------------------------------------------------------- | --------------- |
| `belief`    | uid (key), category, certainty, subject, content, source                     | Agent belief    |
| `desire`    | uid (key), name, priority, importance, urgency, alignment, category          | Agent desire    |
| `goal`      | uid (key), name, hierarchy_level, priority, progress, status, parent_goal_id | Agent goal      |
| `intention` | uid (key), name, commitment_strategy, status, plan_ref, committed_at         | Agent intention |
| `plan`      | uid (key), name, plan_source, step_count, confidence, status                 | Execution plan  |
| `plan_step` | uid (key), name, step_type, tool_binding, sequence_order, cron_expression    | Plan step       |

**Agent Identity Entities:**

| Entity    | Key Attributes                                                      | Purpose       |
| --------- | ------------------------------------------------------------------- | ------------- |
| `persona` | uid (key), role_title, department, responsibilities, autonomy_level | Agent persona |
| `skill`   | uid (key), name, proficiency_level, skill_category, tool_access     | Agent skill   |

**Workflow and Execution Entities:**

| Entity             | Key Attributes                                                            | Purpose             |
| ------------------ | ------------------------------------------------------------------------- | ------------------- |
| `workflow`         | uid (key), name, workflow_type, trigger, status, cron_expression          | Cron/event workflow |
| `task`             | uid (key), name, task_type, assigned_agent_id, depends_on_ids, status     | Task                |
| `action_execution` | uid (key), tool_used, input_summary, output_summary, success, duration_ms | Execution log       |

**Reasoning Entities:**

| Entity             | Key Attributes                                                       | Purpose           |
| ------------------ | -------------------------------------------------------------------- | ----------------- |
| `reasoning_method` | uid (key), name, method_category, applicability                      | Reasoning method  |
| `reasoning_result` | uid (key), method_used, conclusion, confidence, reasoning_trace      | Reasoning outcome |
| `decision`         | uid (key), name, status, urgency_level, options_json, recommendation | Decision record   |

**BPMN 2.0 Entities:**

| Entity          | Key Attributes                                        | Purpose            |
| --------------- | ----------------------------------------------------- | ------------------ |
| `bpmn_workflow` | uid (key), name, status, workflow_version             | BPMN process model |
| `bpmn_element`  | uid (key), element_type, pos_x, pos_y, size_w, size_h | BPMN node          |
| `bpmn_flow`     | uid (key), flow_type, condition_expr, is_default      | BPMN edge          |
| `bpmn_pool`     | uid (key), name, participant_ref, is_black_box        | BPMN pool          |
| `bpmn_lane`     | uid (key), name, assignee_agent_id                    | BPMN lane          |

### Relations (~18)

**Core Relations:**

| Relation     | Roles                               | Purpose              |
| ------------ | ----------------------------------- | -------------------- |
| `agent_owns` | owner (agent), owned (all entities) | Multi-tenant scoping |

**BDI Relations:**

| Relation                 | Roles                                         | Purpose               |
| ------------------------ | --------------------------------------------- | --------------------- |
| `belief_supports_goal`   | believer (belief), supported (goal)           | Belief-goal linkage   |
| `desire_motivates_goal`  | motivator (desire), motivated (goal)          | Desire-goal linkage   |
| `goal_requires_plan`     | requiring (goal), required (plan)             | Goal-plan linkage     |
| `plan_contains_step`     | container (plan), contained (plan_step)       | Plan decomposition    |
| `step_depends_on`        | dependent (plan_step), dependency (plan_step) | Step ordering         |
| `decision_resolves_goal` | resolver (decision), resolved_goal (goal)     | Decision-goal linkage |

**Agent Identity Relations:**

| Relation            | Roles                                       | Purpose            |
| ------------------- | ------------------------------------------- | ------------------ |
| `agent_has_skill`   | skilled (agent), possessed (skill)          | Agent capabilities |
| `agent_has_persona` | personified (agent), persona_role (persona) | Agent personas     |

**Reasoning Relations:**

| Relation                 | Roles                                                | Purpose            |
| ------------------------ | ---------------------------------------------------- | ------------------ |
| `method_produces_result` | method (reasoning_method), result (reasoning_result) | Method-result link |

**BPMN 2.0 Relations:**

| Relation                    | Roles                                                                         | Purpose                 |
| --------------------------- | ----------------------------------------------------------------------------- | ----------------------- |
| `workflow_contains_element` | wf_container (bpmn_workflow), wf_contained (bpmn_element)                     | Workflow composition    |
| `workflow_contains_flow`    | wff_container (bpmn_workflow), wff_contained (bpmn_flow)                      | Workflow flow ownership |
| `workflow_contains_pool`    | wfp_container (bpmn_workflow), wfp_contained (bpmn_pool)                      | Workflow pool ownership |
| `pool_contains_lane`        | pl_container (bpmn_pool), pl_contained (bpmn_lane)                            | Pool-lane hierarchy     |
| `lane_contains_element`     | le_container (bpmn_lane), le_contained (bpmn_element)                         | Lane-element assignment |
| `flow_connects`             | flow_source (bpmn_element), flow_target (bpmn_element), flow_edge (bpmn_flow) | Ternary flow connection |
| `goal_has_workflow`         | gh_goal (goal), gh_workflow (bpmn_workflow)                                   | Goal-to-BPMN linkage    |
| `project_has_workflow`      | ph_project (agent), ph_workflow (bpmn_workflow)                               | Project-to-BPMN linkage |

---

## 10. Agent Scoping and Multi-Tenant Isolation

### The agent_owns Relation

Every entity in the knowledge graph is connected to its owning agent through the `agent_owns` relation:

```typeql
relation agent_owns,
  relates owner,
  relates owned;
```

All 25+ entity types play the `owned` role:

```typeql
agent plays agent_owns:owner;
spo_fact plays agent_owns:owned;
knowledge_rule plays agent_owns:owned;
memory_item plays agent_owns:owned;
cbr_case plays agent_owns:owned;
belief plays agent_owns:owned;
desire plays agent_owns:owned;
goal plays agent_owns:owned;
intention plays agent_owns:owned;
plan plays agent_owns:owned;
plan_step plays agent_owns:owned;
persona plays agent_owns:owned;
skill plays agent_owns:owned;
workflow plays agent_owns:owned;
task plays agent_owns:owned;
action_execution plays agent_owns:owned;
reasoning_method plays agent_owns:owned;
reasoning_result plays agent_owns:owned;
decision plays agent_owns:owned;
bpmn_workflow plays agent_owns:owned;
bpmn_element plays agent_owns:owned;
bpmn_flow plays agent_owns:owned;
bpmn_pool plays agent_owns:owned;
bpmn_lane plays agent_owns:owned;
```

### Query Scoping Pattern

Every query in the system includes the agent scoping clause:

```typeql
match
  $agent isa agent, has uid "vw-ceo";
  $goal isa goal, has uid $gid, has name $n;
  (owner: $agent, owned: $goal) isa agent_owns;
```

The three-line scoping pattern ensures that:

1. The agent entity is resolved by its UID
2. The target entity is declared
3. The `agent_owns` relation constrains the result set to only entities owned by that agent

### Insert Scoping Pattern

Every insert includes the agent_owns relation creation:

```typeql
match
  $agent isa agent, has uid "vw-ceo";
insert
  $goal isa goal,
    has uid "G-S001",
    has name "Reach $13.7M Revenue by Year 5";
  (owner: $agent, owned: $goal) isa agent_owns;
```

### Cross-Agent Relations

Some relations connect entities owned by different agents. For example, `belief_supports_goal` might link a CFO belief to a CEO goal. These cross-agent relations use double scoping:

```typeql
match
  $agent isa agent, has uid "vw-cfo";
  $belief isa belief, has uid "BEL-001";
  $goal isa goal, has uid "G-S001";
  (owner: $agent, owned: $belief) isa agent_owns;
  (owner: $agent, owned: $goal) isa agent_owns;
insert
  (believer: $belief, supported: $goal) isa belief_supports_goal;
```

### Why agent_owns Instead of Separate Databases?

Using a single relation for multi-tenancy instead of separate databases per agent provides several advantages:

1. **Cross-agent queries** -- The dashboard can query goals across all agents in a single query without database switching
2. **Shared schema** -- One schema definition serves all agents
3. **Relation connectivity** -- Beliefs from one agent can support goals of another through typed relations
4. **Simpler management** -- One database per business, not per agent

---

## 11. Query Builder Classes

**File:** `extensions/mabos/src/knowledge/typedb-queries.ts` (1,468 lines)

The query layer provides 12 static query builder classes. Each class contains methods that return TypeQL query strings (not results -- the strings are passed to the TypeDB client for execution). All methods are `static` so no instantiation is required.

### 1. FactStoreQueries

| Method                         | Query Type   | Description                                                              |
| ------------------------------ | ------------ | ------------------------------------------------------------------------ |
| `assertFact(agentId, fact)`    | match/insert | Insert an SPO fact with all attributes + agent_owns                      |
| `retractFact(agentId, factId)` | match/delete | Delete a fact by UID, scoped to agent                                    |
| `queryFacts(agentId, filters)` | match        | Query facts with optional subject/predicate/object/minConfidence filters |
| `explainFact(agentId, factId)` | match        | Retrieve a fact with its full attribute set for explanation              |

**assertFact example output:**

```typeql
match
  $agent isa agent, has uid "vw-cfo";
insert
  $fact isa spo_fact,
    has uid "F-001",
    has subject "VividWalls",
    has predicate "hasRevenue",
    has object_value "$2.3M",
    has confidence 0.95,
    has source "financial-report",
    has created_at "2026-02-24T12:00:00Z",
    has updated_at "2026-02-24T12:00:00Z";
  (owner: $agent, owned: $fact) isa agent_owns;
```

**queryFacts with filters:**

```typeql
match
  $agent isa agent, has uid "vw-cfo";
  $fact isa spo_fact, has uid $fid, has subject $s, has predicate $p,
    has object_value $o, has confidence $c, has source $src;
  (owner: $agent, owned: $fact) isa agent_owns;
  $p = "hasRevenue";
  $c >= 0.8;
```

### 2. RuleStoreQueries

| Method                                 | Query Type          | Description                                                            |
| -------------------------------------- | ------------------- | ---------------------------------------------------------------------- |
| `createRule(agentId, rule)`            | match/insert        | Insert a knowledge_rule with type, conditions count, confidence factor |
| `listRules(agentId, type?)`            | match               | List rules with optional type filter                                   |
| `toggleRule(agentId, ruleId, enabled)` | match/delete/insert | Update the `enabled` attribute                                         |

### 3. MemoryQueries

| Method                                                | Query Type   | Description                                         |
| ----------------------------------------------------- | ------------ | --------------------------------------------------- |
| `storeItem(agentId, item)`                            | match/insert | Insert a memory_item with tags and store assignment |
| `recallItems(agentId, filters)`                       | match        | Query memory with type/store/minImportance filters  |
| `consolidate(agentId, minImportance, minAccessCount)` | match        | Find short-term items eligible for promotion        |

### 4. InferenceQueries

| Method                                                        | Query Type | Description                                                  |
| ------------------------------------------------------------- | ---------- | ------------------------------------------------------------ |
| `findMatchingPatterns(agentId, predicate, subject?, object?)` | match      | Find facts matching a condition pattern for forward chaining |
| `proveGoal(agentId, predicate, subject?, object?)`            | match      | Find supporting facts for backward chaining goal proving     |

### 5. CBRQueries

| Method                             | Query Type   | Description                                                         |
| ---------------------------------- | ------------ | ------------------------------------------------------------------- |
| `storeCase(agentId, caseData)`     | match/insert | Insert a cbr_case with situation/solution/outcome                   |
| `retrieveSimilar(agentId, domain)` | match        | Retrieve all cases in a domain for similarity scoring by the caller |

### 6. GoalStoreQueries

| Method                                                   | Query Type          | Description                                                                           |
| -------------------------------------------------------- | ------------------- | ------------------------------------------------------------------------------------- |
| `createGoal(agentId, goal)`                              | match/insert        | Insert a goal with tier, priority, status, deadline, success criteria, parent_goal_id |
| `linkDesireToGoal(agentId, desireId, goalId)`            | match/insert        | Create desire_motivates_goal relation                                                 |
| `linkGoalToPlan(agentId, goalId, planId)`                | match/insert        | Create goal_requires_plan relation                                                    |
| `queryGoals(agentId, filters)`                           | match               | Query goals with hierarchy_level/status/minPriority filters                           |
| `updateGoalProgress(agentId, goalId, progress, status?)` | match/delete/insert | Update progress and optional status                                                   |

### 7. DesireStoreQueries

| Method                           | Query Type   | Description                                                             |
| -------------------------------- | ------------ | ----------------------------------------------------------------------- |
| `createDesire(agentId, desire)`  | match/insert | Insert a desire with priority, importance, urgency, alignment, category |
| `queryDesires(agentId, filters)` | match        | Query desires with optional category/status filter                      |

### 8. BeliefStoreQueries

| Method                                        | Query Type   | Description                                              |
| --------------------------------------------- | ------------ | -------------------------------------------------------- |
| `createBelief(agentId, belief)`               | match/insert | Insert a belief with category, certainty, content        |
| `linkBeliefToGoal(agentId, beliefId, goalId)` | match/insert | Create belief_supports_goal relation                     |
| `queryBeliefs(agentId, filters)`              | match        | Query beliefs with optional category/minCertainty filter |

### 9. DecisionStoreQueries

| Method                                   | Query Type          | Description                                                       |
| ---------------------------------------- | ------------------- | ----------------------------------------------------------------- |
| `createDecision(agentId, decision)`      | match/insert        | Insert a decision with options JSON, urgency, recommendation      |
| `resolveDecision(uid, resolution)`       | match/delete/insert | Update status to resolution value                                 |
| `queryDecisions(agentId?, status?)`      | match               | Query decisions, optionally scoped to agent or filtered by status |
| `linkDecisionToGoal(decisionId, goalId)` | match/insert        | Create decision_resolves_goal relation                            |

### 10. WorkflowStoreQueries

| Method                              | Query Type   | Description                                         |
| ----------------------------------- | ------------ | --------------------------------------------------- |
| `createWorkflow(agentId, workflow)` | match/insert | Insert a workflow with type, trigger, cron settings |
| `queryWorkflows(agentId?, status?)` | match        | Query workflows with optional agent/status filter   |

### 11. TaskStoreQueries

| Method                          | Query Type          | Description                                               |
| ------------------------------- | ------------------- | --------------------------------------------------------- |
| `createTask(agentId, task)`     | match/insert        | Insert a task with type, assignee, priority, dependencies |
| `queryTasks(agentId?, status?)` | match               | Query tasks with optional agent/status filter             |
| `updateTaskStatus(uid, status)` | match/delete/insert | Update task status                                        |

### 12. IntentionStoreQueries

| Method                                | Query Type          | Description                                                      |
| ------------------------------------- | ------------------- | ---------------------------------------------------------------- |
| `createIntention(agentId, intention)` | match/insert        | Insert an intention with commitment strategy, plan ref, deadline |
| `queryIntentions(agentId?, status?)`  | match               | Query intentions with optional agent/status filter               |
| `updateIntentionStatus(uid, status)`  | match/delete/insert | Update intention status                                          |

### Update Pattern (Delete-then-Insert)

TypeQL does not support in-place attribute mutation. All updates follow a match/delete/insert pattern:

```typeql
match
  $goal isa goal, has uid "G-S001", has progress $old_progress, has updated_at $old_updated;
  (owner: $agent, owned: $goal) isa agent_owns;
  $agent isa agent, has uid "vw-cfo";
delete
  $goal has $old_progress;
  $goal has $old_updated;
insert
  $goal has progress 0.35;
  $goal has updated_at "2026-02-24T14:30:00Z";
```

The old attribute values are matched into variables (`$old_progress`, `$old_updated`), deleted, and then new values are inserted. This is atomic within the write transaction.

---

## 12. Fact Store Integration

**File:** `extensions/mabos/src/tools/fact-store.ts`

### Write-Through Implementation

The fact store manages SPO (Subject-Predicate-Object) triples. Every write operation follows this sequence:

```typescript
// 1. Load current facts from JSON
const store = await loadFacts(api, agentId);

// 2. Create the new fact object
const newFact: Fact = {
  id: `F-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
  subject,
  predicate,
  object,
  confidence,
  source,
  valid_from,
  valid_until,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

// 3. Add to in-memory array and save JSON
store.facts.push(newFact);
await saveFacts(api, agentId, store);

// 4. Materialize Markdown
await materializeFacts(api, agentId, store.facts);

// 5. Best-effort TypeDB write
try {
  const client = getTypeDBClient();
  if (client.isAvailable()) {
    const typeql = FactStoreQueries.assertFact(agentId, {
      id: newFact.id,
      subject: newFact.subject,
      predicate: newFact.predicate,
      object: newFact.object,
      confidence: newFact.confidence,
      source: newFact.source,
      validFrom: newFact.valid_from,
      validUntil: newFact.valid_until,
    });
    await client.insertData(typeql, `mabos_${businessId}`);
  }
} catch (e) {
  // TypeDBUnavailableError or other -- log and continue
}
```

### Imports and Dependencies

```typescript
import { getTypeDBClient, TypeDBUnavailableError } from "../knowledge/typedb-client.js";
import { FactStoreQueries } from "../knowledge/typedb-queries.js";
```

The fact store explicitly imports `TypeDBUnavailableError` for catch filtering, though in practice it catches all errors generically since the write is best-effort regardless of error type.

### Fact Query with TypeDB-First

When querying facts, the system tries TypeDB first:

```typescript
// Try TypeDB
try {
  const client = getTypeDBClient();
  if (client.isAvailable()) {
    const typeql = FactStoreQueries.queryFacts(agentId, { subject, predicate, object });
    const results = await client.matchQuery(typeql, dbName);
    if (results && results.answers?.length > 0) {
      return transformTypeDBResults(results);
    }
  }
} catch {
  // Fall through to JSON
}

// Fallback: JSON file
const store = await loadFacts(api, agentId);
return filterFacts(store.facts, { subject, predicate, object });
```

---

## 13. Rule Engine Integration

**File:** `extensions/mabos/src/tools/rule-engine.ts`

### Write-Through for Rules

The rule engine supports three rule types (inference, constraint, policy) and follows the same write-through pattern as the fact store:

```typescript
import { getTypeDBClient } from "../knowledge/typedb-client.js";
import { RuleStoreQueries } from "../knowledge/typedb-queries.js";
```

When creating a rule:

1. The rule is first written to `rules.json`
2. Then a best-effort TypeDB insert is attempted via `RuleStoreQueries.createRule()`

```typescript
try {
  const client = getTypeDBClient();
  if (client.isAvailable()) {
    const typeql = RuleStoreQueries.createRule(agentId, {
      id: rule.id,
      name: rule.name,
      description: rule.description,
      type: rule.type,
      conditionCount: rule.conditions.length,
      confidenceFactor: rule.confidence_factor,
      enabled: rule.enabled,
      domain: rule.domain,
    });
    await client.insertData(typeql, dbName);
  }
} catch {
  // Non-blocking
}
```

### Rule Toggle Sync

When a rule is toggled (enabled/disabled), the change is synced to TypeDB:

```typescript
const typeql = RuleStoreQueries.toggleRule(agentId, ruleId, enabled);
await client.insertData(typeql, dbName); // Uses write transaction for delete+insert
```

### Condition Count vs. Full Conditions

The TypeDB representation stores `condition_count` (an integer) rather than the full conditions array. This is because TypeQL does not natively support array attributes. The full condition logic is stored in the JSON file; TypeDB stores the metadata for indexing and filtering.

---

## 14. Inference Engine Integration

**File:** `extensions/mabos/src/tools/inference-tools.ts`

### InferenceQueries for Pattern Matching

The inference engine implements forward chaining (derive new facts from existing facts) and backward chaining (prove a goal by finding supporting facts). When TypeDB is available, it uses `InferenceQueries` to find matching patterns:

```typescript
import { getTypeDBClient } from "../knowledge/typedb-client.js";
import { InferenceQueries } from "../knowledge/typedb-queries.js";
```

**Forward chaining with TypeDB:**

For each rule condition, the engine generates a pattern match query:

```typescript
const typeql = InferenceQueries.findMatchingPatterns(
  agentId,
  condition.predicate,
  condition.subject,
  condition.object,
);
const results = await client.matchQuery(typeql, dbName);
```

The TypeQL produced:

```typeql
match
  $agent isa agent, has uid "vw-cfo";
  $fact isa spo_fact, has predicate "hasRevenue", has subject "VividWalls",
    has subject $s, has object_value $o, has confidence $c;
  (owner: $agent, owned: $fact) isa agent_owns;
```

**Backward chaining (goal proving):**

```typescript
const typeql = InferenceQueries.proveGoal(
  agentId,
  goalTriple.predicate,
  goalTriple.subject,
  goalTriple.object,
);
```

This searches for any facts whose predicate matches the goal, providing the starting point for backward chaining through derivation chains.

### Hybrid Execution

The inference engine uses a hybrid approach:

- **TypeDB** is used for pattern matching when available (leveraging graph indexing)
- **In-memory** forward chaining operates on the JSON-loaded fact array (for fixed-point computation)
- New derived facts are written through the standard write-through pattern (JSON + TypeDB + Markdown)

---

## 15. Memory Integration

### MemoryQueries for Store/Recall/Consolidate

The memory system uses three stores: working memory (volatile), short-term memory (session-scoped), and long-term memory (persistent). TypeDB integration follows the write-through pattern.

**Storing a memory item:**

```typescript
const typeql = MemoryQueries.storeItem(agentId, {
  id: item.id,
  content: item.content,
  type: item.type,
  importance: item.importance,
  source: item.source,
  store: "short_term",
  tags: item.tags,
});
await client.insertData(typeql, dbName);
```

**Recalling items:**

```typescript
const typeql = MemoryQueries.recallItems(agentId, {
  query: searchQuery,
  store: "long_term",
  minImportance: 0.5,
});
const results = await client.matchQuery(typeql, dbName);
```

**Consolidation:**

Memory consolidation promotes short-term items to long-term based on importance and access frequency:

```typeql
match
  $agent isa agent, has uid "vw-ceo";
  $mem isa memory_item, has uid $mid, has store_name "short_term",
    has importance $imp, has access_count $ac;
  (owner: $agent, owned: $mem) isa agent_owns;
  { $imp >= 0.7; } or { $ac >= 3; };
```

This query uses TypeQL's disjunction (`or`) to find items that meet either the importance threshold or the access count threshold.

---

## 16. CBR Integration

### Case Storage and Retrieval

Case-Based Reasoning (CBR) cases are stored in TypeDB as `cbr_case` entities with situation, solution, and outcome as string attributes (containing JSON):

**Storing a case:**

```typescript
const typeql = CBRQueries.storeCase(agentId, {
  id: caseData.id,
  situation: JSON.stringify(caseData.situation),
  solution: JSON.stringify(caseData.solution),
  outcome: JSON.stringify(caseData.outcome),
  domain: caseData.domain,
});
```

**Retrieving similar cases:**

```typescript
const typeql = CBRQueries.retrieveSimilar(agentId, "ecommerce");
const results = await client.matchQuery(typeql, dbName);
```

This retrieves all cases in the specified domain. Similarity scoring is performed by the caller (not by TypeDB) because it requires domain-specific distance metrics that vary by use case. TypeDB serves as the indexed retrieval layer, providing efficient domain-scoped case fetching.

---

## 17. BDI Cognitive State Queries

The BDI (Belief-Desire-Intention) cognitive architecture is fully represented in the TypeDB schema. Five query builder classes manage the cognitive state:

### GoalStoreQueries

Goals follow a three-tier TOGAF hierarchy:

- **Strategic** (5-year vision)
- **Tactical** (Year 1-2 milestones)
- **Operational** (monthly/weekly tasks)

Goals are linked to desires through `desire_motivates_goal`, to plans through `goal_requires_plan`, and to parent goals through `parent_goal_id`.

**Creating a goal:**

```typeql
match
  $agent isa agent, has uid "vw-cfo";
insert
  $goal isa goal,
    has uid "G-S001",
    has name "Reach $13.7M Revenue by Year 5",
    has description "Grow VividWalls from $2.3M to $13.7M annual revenue",
    has hierarchy_level "strategic",
    has priority 0.95,
    has progress 0.0,
    has status "active",
    has success_criteria "Annual revenue >= $13.7M",
    has deadline "2030-12-31",
    has created_at "2026-02-24T00:00:00Z",
    has updated_at "2026-02-24T00:00:00Z";
  (owner: $agent, owned: $goal) isa agent_owns;
```

**Linking desire to goal:**

```typeql
match
  $agent isa agent, has uid "vw-cfo";
  $desire isa desire, has uid "D-CFO-002";
  $goal isa goal, has uid "G-S001";
  (owner: $agent, owned: $desire) isa agent_owns;
  (owner: $agent, owned: $goal) isa agent_owns;
insert
  (motivator: $desire, motivated: $goal) isa desire_motivates_goal;
```

### DesireStoreQueries

Desires have two categories: **terminal** (end-state aspirations) and **instrumental** (means to achieve terminal desires). Each desire has priority, importance, urgency, and alignment scores.

### BeliefStoreQueries

Beliefs represent the agent's understanding of the world. Each belief has a category, certainty level, subject, content, and source. Beliefs can be linked to goals via `belief_supports_goal`.

### IntentionStoreQueries

Intentions represent committed courses of action. They have commitment strategies (e.g., "blind", "single-minded", "open-minded"), plan references, and deadlines.

### DecisionStoreQueries

Decisions represent choice points. They carry options (as JSON), urgency levels, recommendations, and resolution status. Decisions are linked to goals via `decision_resolves_goal`.

### Cross-Cutting BDI Relations

The BDI relations form a connected graph:

```
Desire --[motivates]--> Goal --[requires]--> Plan --[contains]--> PlanStep
   ^                      |                                          |
   |                      |                                   [depends_on]
Belief --[supports]---+   |                                          |
                          +--[has_workflow]--> BpmnWorkflow           v
                          |                                     PlanStep
Decision --[resolves]--+
```

This graph structure allows TypeDB to answer complex queries like:

- "Which desires motivate goals that require plans with overdue steps?"
- "Which beliefs support goals that have stalled?"
- "Which decisions are blocking goal progress?"

---

## 18. BPMN 2.0 Workflow Persistence

**File:** `extensions/mabos/src/knowledge/bpmn-queries.ts` (506 lines)

### BpmnStoreQueries

The `BpmnStoreQueries` class provides full CRUD for BPMN 2.0 workflow models:

**Workflow CRUD:**

| Method                               | Description                                                     |
| ------------------------------------ | --------------------------------------------------------------- |
| `createWorkflow(agentId, workflow)`  | Create a workflow scoped to an agent                            |
| `queryWorkflow(workflowId)`          | Query a single workflow by ID                                   |
| `queryWorkflows(agentId, filters?)`  | Query all workflows for an agent, optionally filtered by status |
| `updateWorkflow(workflowId, fields)` | Update workflow name, status, or description                    |
| `deleteWorkflow(workflowId)`         | Delete a workflow                                               |

**Element CRUD:**

| Method                                     | Description                                           |
| ------------------------------------------ | ----------------------------------------------------- |
| `addElement(agentId, workflowId, element)` | Add a BPMN element (event, task, gateway, subprocess) |
| `updateElement(elementId, fields)`         | Update element properties                             |
| `updateElementPosition(elementId, x, y)`   | Update position only (for drag events)                |
| `deleteElement(elementId)`                 | Delete an element                                     |
| `queryElements(workflowId)`                | Query all elements in a workflow                      |

**Flow CRUD:**

| Method                               | Description                           |
| ------------------------------------ | ------------------------------------- |
| `addFlow(agentId, workflowId, flow)` | Create a flow connecting two elements |
| `updateFlow(flowId, fields)`         | Update flow properties                |
| `deleteFlow(flowId)`                 | Delete a flow                         |
| `queryFlows(workflowId)`             | Query all flows in a workflow         |

**Swimlane CRUD:**

| Method                               | Description                  |
| ------------------------------------ | ---------------------------- |
| `addPool(agentId, workflowId, pool)` | Add a pool to a workflow     |
| `queryPools(workflowId)`             | Query pools for a workflow   |
| `addLane(agentId, poolId, lane)`     | Add a lane to a pool         |
| `updateLane(laneId, fields)`         | Update lane name or assignee |
| `deleteLane(laneId)`                 | Delete a lane                |
| `queryLanes(poolId)`                 | Query lanes for a pool       |

**Linkage:**

| Method                                         | Description                          |
| ---------------------------------------------- | ------------------------------------ |
| `linkWorkflowToGoal(workflowId, goalId)`       | Create goal_has_workflow relation    |
| `linkWorkflowToProject(workflowId, projectId)` | Create project_has_workflow relation |

**Validation:**

| Method                         | Description                                      |
| ------------------------------ | ------------------------------------------------ |
| `queryOrphanNodes(workflowId)` | Find elements with no incoming or outgoing flows |

### BPMN Element Model

BPMN elements use a rich attribute set that captures all BPMN 2.0 element types:

```typeql
entity bpmn_element,
  owns uid @key,
  owns name,
  owns element_type,       -- "event", "task", "gateway", "subprocess"
  owns pos_x,
  owns pos_y,
  owns size_w,
  owns size_h,
  owns documentation,
  owns event_position,     -- "start", "intermediate", "end"
  owns event_trigger,      -- "none", "message", "timer", "signal", "error"
  owns event_catching,     -- true = catching, false = throwing
  owns task_type_bpmn,     -- "user", "service", "script", "manual"
  owns loop_type,          -- "standard", "multi-instance"
  owns gateway_type,       -- "exclusive", "parallel", "inclusive", "event-based"
  owns assignee_agent_id,  -- which agent is assigned
  owns action_tool,        -- which tool to execute
  owns lane_id;            -- which lane contains this element
```

### Flow Connection (Ternary Relation)

The `flow_connects` relation is a ternary relation connecting source element, target element, and the flow entity itself:

```typeql
relation flow_connects,
  relates flow_source,
  relates flow_target,
  relates flow_edge;
```

This allows querying both directions of the flow and the flow's attributes (condition, type) in a single pattern:

```typeql
match
  $wf isa bpmn_workflow, has uid "WF-001";
  (wff_container: $wf, wff_contained: $fl) isa workflow_contains_flow;
  $fl isa bpmn_flow, has uid $fid, has flow_type $ft;
  (flow_source: $src, flow_target: $tgt, flow_edge: $fl) isa flow_connects;
  $src has uid $sid;
  $tgt has uid $tid;
```

### Orphan Node Detection

The `queryOrphanNodes()` method uses TypeQL negation to find elements with no connections:

```typeql
match
  $wf isa bpmn_workflow, has uid "WF-001";
  (wf_container: $wf, wf_contained: $el) isa workflow_contains_element;
  $el has uid $eid, has element_type $etype;
  not {
    (flow_source: $el, flow_target: $any, flow_edge: $f1) isa flow_connects;
  };
  not {
    (flow_source: $any2, flow_target: $el, flow_edge: $f2) isa flow_connects;
  };
```

This is used for workflow validation -- finding elements that are disconnected from the process flow.

---

## 19. Dashboard Data Access Layer

**File:** `extensions/mabos/src/knowledge/typedb-dashboard.ts` (749 lines)

The dashboard data access layer provides query functions that read from TypeDB and transform results into the shapes expected by the dashboard REST API. All functions return `null` on failure so callers can fall back to filesystem-based logic.

### ID Mapping

The dashboard uses a `vw-` prefix mapping between TypeDB IDs and dashboard IDs:

```typescript
const BIZ_PREFIX = "vw-";

function toDashboardId(typedbId: string): string {
  return typedbId.startsWith(BIZ_PREFIX) ? typedbId.slice(BIZ_PREFIX.length) : typedbId;
}

function toTypeDBId(dashboardId: string): string {
  return dashboardId.startsWith(BIZ_PREFIX) ? dashboardId : BIZ_PREFIX + dashboardId;
}
```

### Response Parsing Helpers

Two helpers normalize TypeDB query responses:

```typescript
function getConceptValue(concept: Concept | undefined): any {
  if (!concept) return null;
  if ("value" in concept) return concept.value;
  return null;
}

function getRows(response: QueryResponse | null): ConceptRowAnswer[] {
  if (!response) return [];
  if (response.answerType === "conceptRows") {
    return response.answers;
  }
  return [];
}
```

### Query Functions

**queryAgentListFromTypeDB(dbName)**

Returns `AgentListItem[] | null`.

1. Queries all agents: `match $agent isa agent, has uid $id, has name $n;`
2. For each agent, runs four parallel count queries for beliefs, goals, desires, and intentions
3. Uses `Promise.all()` with `.catch(() => null)` for resilient parallel execution
4. Returns null if no agents found or if TypeDB is unavailable

**queryAgentDetailFromTypeDB(agentId, dbName)**

Returns `AgentDetail | null`.

1. Converts dashboard ID to TypeDB ID
2. Verifies the agent exists
3. Runs four parallel queries for belief contents, goal names, desire names, and intention names
4. Optionally queries knowledge stats (facts, rules, memories, cases)
5. Returns the detail object with counts and string arrays

**queryDecisionsFromTypeDB(dbName)**

Returns `Decision[] | null`.

1. Queries all decisions with their owning agents using a complex match:
   ```typeql
   match $agent isa agent, has uid $aid, has name $aname;
     $d isa decision, has uid $did, has name $n, has description $desc,
     has urgency_level $urg, has status $st, has options_json $opts,
     has created_at $ca;
     (owner: $agent, owned: $d) isa agent_owns;
   ```
2. Parses `options_json` from the string attribute
3. For each decision, attempts to query the optional `recommendation` attribute
4. Returns null if no decisions found

**queryWorkflowsFromTypeDB(dbName)**

Returns `DashboardWorkflow[] | null`.

1. Queries all workflows with their names and statuses
2. For each workflow, finds owning agents via `agent_owns`
3. Returns workflow list with agent IDs

**queryTasksFromTypeDB(dbName)**

Returns `DashboardTask[] | null`.

1. Queries all tasks with their owning agents
2. For each task, attempts to query optional attributes (assigned_agent_id, estimated_duration)
3. Returns task list with all metadata

**writeBdiCycleResultToTypeDB(agentId, dbName, result)**

Returns `boolean`.

This is a write function called by the BDI heartbeat. It inserts new beliefs and intentions generated by the BDI reasoning cycle:

```typescript
// Insert new intentions
for (const intentionName of result.newIntentions) {
  const uid = `INT-${agentId}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  await client.insertData(
    `match $agent isa agent, has uid "${typedbId}";
     insert $int isa intention, has uid "${uid}", has name ${JSON.stringify(intentionName)}, ...;
     (owner: $agent, owned: $int) isa agent_owns;`,
    dbName,
  );
}

// Insert new beliefs
for (const beliefContent of result.newBeliefs) {
  const uid = `BEL-${agentId}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  await client.insertData(
    `match $agent isa agent, has uid "${typedbId}";
     insert $b isa belief, has uid "${uid}", has category "environment", has certainty 0.7, ...;
     (owner: $agent, owned: $b) isa agent_owns;`,
    dbName,
  );
}
```

All insertions are individually wrapped in try/catch blocks to ensure that a failure on one item does not prevent others from being inserted.

**queryKnowledgeStatsFromTypeDB(agentId, dbName)**

Returns `{ facts: number; rules: number; memories: number; cases: number } | null`.

Runs four parallel count queries using the agent_owns scoping pattern and returns the row counts.

**queryGoalModelFromTypeDB(dbName)**

Returns `TroposGoalModel | null`.

This is the most complex query function, assembling a complete Tropos goal model:

1. **Actors:** Queries all agents and creates a "Stakeholder" principal actor plus one agent actor per TypeDB agent entity
2. **Goals:** Queries all goals with their owning agents, extracting hierarchy_level, priority, and description
3. **Desire links:** Queries `desire_motivates_goal` relations to build a map of goal-to-desire-name arrays
4. **Workflows:** For each goal, traverses `goal_requires_plan` to find plans, then `plan_contains_step` to find steps, building the workflow hierarchy
5. **Dependencies:** Queries `parent_goal_id` attributes to build parent-child dependency links

The TroposGoalModel structure:

```typescript
interface TroposGoalModel {
  actors: {
    id: string;
    name: string;
    type: "principal" | "agent";
    goals: string[];
  }[];
  goals: {
    id: string;
    name: string;
    text?: string;
    description: string;
    level: string;
    type: string;
    priority: number;
    actor?: string;
    desires: string[];
    workflows: any[];
  }[];
  dependencies: {
    from: string;
    to: string;
    type: string;
    goalId: string;
  }[];
}
```

---

## 20. Agent-Facing TypeDB Tools

**File:** `extensions/mabos/src/tools/typedb-tools.ts` (304 lines)

Five tools are exposed to agents through the OpenClaw tool system:

### Tool 1: typedb_status

**Parameters:** None

**Behavior:**

1. Gets the singleton TypeDB client
2. Calls `healthCheck()`
3. Returns connection status and database list

**Output example (connected):**

```markdown
## TypeDB Status

**Connection:** Connected
**Databases:** mabos_vividwalls, mabos_test

TypeDB is available. Knowledge operations use dual-layer storage (TypeDB + JSON).
```

**Output example (disconnected):**

```markdown
## TypeDB Status

**Connection:** Disconnected
**Server:** Not reachable

TypeDB is not available. All knowledge operations use file-based JSON storage.
```

### Tool 2: typedb_sync_schema

**Parameters:**

- `business_id` (string) -- Business ID used as database name prefix

**Behavior:**

1. Ensures TypeDB is connected (attempts reconnection if needed)
2. Creates/ensures database `mabos_<business_id>`
3. Pushes the base schema via `defineSchema(getBaseSchema())`
4. Dynamically imports ontology modules
5. Loads ontologies via `loadOntologies()`
6. Merges via `mergeOntologies()`
7. Converts via `jsonldToTypeQL()`
8. Generates via `generateDefineQuery()`
9. Pushes ontology schema via `defineSchema()`

**Output example:**

```markdown
## TypeDB Schema Synced

**Database:** mabos_vividwalls
**Base schema:** defined (agents, facts, rules, memory, cases)
**Ontology schema:** 47 entities, 83 attributes, 21 relations

Schema push completed successfully.
```

### Tool 3: typedb_query

**Parameters:**

- `database` (string) -- Database name (e.g., `mabos_acme`)
- `typeql` (string) -- TypeQL match query to execute

**Behavior:**

1. Validates TypeDB availability
2. Executes the raw TypeQL query via `matchQuery()`
3. Returns results as JSON (truncated at 4,000 characters)

This tool allows agents to run arbitrary read queries against the knowledge graph for exploration, debugging, and ad-hoc analysis.

### Tool 4: typedb_sync_agent_data

**Parameters:**

- `agent_id` (string) -- Agent ID whose JSON data to import
- `business_id` (string) -- Business ID for database name

**Behavior:**

1. Ensures the agent entity exists in TypeDB (inserts if not present)
2. Reads `facts.json` from the agent's directory, inserts each fact via `FactStoreQueries.assertFact()`
3. Reads `rules.json`, inserts each rule via `RuleStoreQueries.createRule()`
4. Reads `memory-store.json`, collects items from all three stores (working, short_term, long_term), inserts each via `MemoryQueries.storeItem()`
5. Reports per-domain sync counts

**Output example:**

```markdown
## Agent Data Synced to TypeDB

**Agent:** vw-ceo
**Database:** mabos_vividwalls

- Facts: 23/25 synced
- Rules: 12/12 synced
- Memory: 45/48 synced
```

Individual item failures (e.g., duplicate UIDs) are silently skipped to ensure maximum data transfer.

### Tool 5: goal_seed_business

**Parameters:** Defined in `goal-seed.ts`

**Behavior:** Seeds the complete VividWalls business goal model (see Section 21).

---

## 21. Goal Seed System

**File:** `extensions/mabos/src/tools/goal-seed.ts` (2,630 lines)

### Overview

The goal seed system is a programmatic data loader that populates the TypeDB knowledge graph with a complete business model for VividWalls, the reference deployment. It uses the query builder classes from `typedb-queries.ts` to insert all entities and create all relations.

### Seed Data Inventory

**9 Agents:**

| Agent ID       | Name            | Role                       |
| -------------- | --------------- | -------------------------- |
| `vw-ceo`       | CEO Agent       | Overall business strategy  |
| `vw-cfo`       | CFO Agent       | Financial management       |
| `vw-cmo`       | CMO Agent       | Marketing and brand        |
| `vw-cto`       | CTO Agent       | Technology and platform    |
| `vw-coo`       | COO Agent       | Operations and fulfillment |
| `vw-hr`        | HR Agent        | Talent and workforce       |
| `vw-legal`     | Legal Agent     | IP and compliance          |
| `vw-knowledge` | Knowledge Agent | Knowledge management       |
| `vw-strategy`  | Strategy Agent  | Competitive strategy       |

**18 Desires (terminal and instrumental):**

| ID          | Agent    | Name                     | Category     |
| ----------- | -------- | ------------------------ | ------------ |
| D-CEO-001   | CEO      | Business Viability       | terminal     |
| D-CEO-002   | CEO      | Strategic Coherence      | terminal     |
| D-CEO-003   | CEO      | Innovation & Growth      | terminal     |
| D-CFO-001   | CFO      | Financial Solvency       | terminal     |
| D-CFO-002   | CFO      | Revenue Growth           | terminal     |
| D-CFO-003   | CFO      | Cost Optimization        | instrumental |
| D-CMO-001   | CMO      | Brand Awareness          | terminal     |
| D-CMO-002   | CMO      | Customer Acquisition     | terminal     |
| D-CMO-003   | CMO      | Limited Edition Success  | terminal     |
| D-CTO-001   | CTO      | Platform Reliability     | terminal     |
| D-CTO-002   | CTO      | AI/ML Excellence         | terminal     |
| D-CTO-003   | CTO      | AR Innovation            | instrumental |
| D-COO-001   | COO      | Operational Efficiency   | terminal     |
| D-COO-002   | COO      | Supply Chain Reliability | terminal     |
| D-COO-003   | COO      | Quality Control          | terminal     |
| D-HR-001    | HR       | Talent Acquisition       | terminal     |
| D-LEGAL-001 | Legal    | IP Protection            | terminal     |
| D-STRAT-001 | Strategy | Competitive Positioning  | terminal     |

**42 Goals (three-tier TOGAF hierarchy):**

- **12 Strategic Goals** (5-year horizon, e.g., "Reach $13.7M Revenue by Year 5", "Achieve 26% EBITDA Margin")
- **15 Tactical Goals** (Year 1-2 milestones, e.g., "Launch EU Storefront", "Implement AR Preview")
- **15 Operational Goals** (monthly/weekly, e.g., "Monthly SEO Audit", "Weekly Inventory Check")

Each goal has:

- Hierarchy level (strategic/tactical/operational)
- Priority score
- Success criteria
- Deadline
- Parent goal ID (for hierarchy)
- Desire IDs (for motivation relations)

**8 Beliefs:**

Market research findings, pricing assumptions, scarcity marketing effectiveness, AI efficiency projections, and other foundational knowledge that supports goal decisions.

**5 Decisions:**

| Decision           | Status  | Impact                  |
| ------------------ | ------- | ----------------------- |
| EU Expansion       | pending | Market entry strategy   |
| Payment Processor  | pending | Stripe vs. alternatives |
| Cloud Provider     | pending | AWS vs. GCP vs. Azure   |
| LE Launch Strategy | pending | Limited edition rollout |
| Print Production   | pending | In-house vs. outsource  |

**11 Workflows (WF-001 through WF-110):**

Each workflow includes plans, plan steps with cron schedules and tool bindings, and tasks with dependency chains.

### Seeding Process

The goal seed tool executes insertions in dependency order:

```
1. Insert agent entities (9 agents)
2. Insert desires (18 desires, scoped to agents)
3. Insert goals (42 goals, scoped to agents)
4. Create desire_motivates_goal relations
5. Insert beliefs (8 beliefs, scoped to agents)
6. Create belief_supports_goal relations
7. Insert decisions (5 decisions, scoped to agents)
8. Create decision_resolves_goal relations
9. Insert plans and plan steps
10. Create goal_requires_plan relations
11. Create plan_contains_step relations
12. Create step_depends_on relations
13. Insert workflows and tasks
14. Create goal_has_workflow relations
```

Each insertion uses the corresponding query builder class:

```typescript
// Insert desire
const typeql = DesireStoreQueries.createDesire(desire.agentId, {
  id: desire.id,
  name: desire.name,
  description: desire.description,
  priority: desire.priority,
  importance: desire.importance,
  urgency: desire.urgency,
  alignment: desire.alignment,
  category: desire.category,
});
await client.insertData(typeql, dbName);

// Link desire to goal
const linkTypeql = GoalStoreQueries.linkDesireToGoal(goal.agentId, desireId, goal.id);
await client.insertData(linkTypeql, dbName);
```

### Relation Graph

After seeding, the knowledge graph contains the following relation structure:

```
18 Desires --[desire_motivates_goal]--> 42 Goals
 8 Beliefs --[belief_supports_goal]---> selected Goals
 5 Decisions --[decision_resolves_goal]--> selected Goals
42 Goals --[goal_requires_plan]--> Plans
   Plans --[plan_contains_step]--> PlanSteps
   PlanSteps --[step_depends_on]--> PlanSteps
   Goals --[goal_has_workflow]--> BpmnWorkflows
```

All entities are scoped to their responsible C-suite agent via `agent_owns`.

---

## 22. Ontology-to-TypeDB Pipeline

**Files:** `ontology/index.ts`, `knowledge/typedb-schema.ts`

### End-to-End Flow

The complete pipeline from `.jsonld` files to TypeDB schema definition follows seven stages:

**Stage 1: loadOntologies()**

```typescript
export function loadOntologies(): Map<string, Ontology> {
  const ontologies = new Map<string, Ontology>();
  const excludeFiles = new Set(["shapes.jsonld", "shapes-sbvr.jsonld"]);
  const files = readdirSync(ONTOLOGY_DIR).filter(
    (f) => f.endsWith(".jsonld") && !excludeFiles.has(f),
  );

  for (const file of files) {
    const content = readFileSync(join(ONTOLOGY_DIR, file), "utf-8");
    const ontology: Ontology = JSON.parse(content);
    ontologies.set(ontology["@id"], ontology);
  }
  return ontologies;
}
```

Reads all `.jsonld` files from the ontology directory, excluding SHACL shapes files (which are validation schemas, not domain ontologies). Returns a `Map<string, Ontology>` keyed by ontology `@id`.

**Stage 2: validateOntologies()**

Performs six validation checks:

1. All `owl:imports` resolve to loaded ontologies
2. All `rdfs:domain` references resolve to defined classes
3. All `rdfs:range` references resolve to defined classes or XSD types
4. All `rdfs:subClassOf` references resolve (with exception for `schema:` external classes)
5. No duplicate `@id` across the merged graph (warnings only)
6. SBVR annotation completeness: `sbvr:conceptType` on classes, `sbvr:reading` on properties, `sbvr:arity` matching `sbvr:roles` count, `sbvr:rolePlayer` references valid classes

Returns `ValidationResult { valid: boolean, errors: string[], warnings: string[] }`.

**Stage 3: mergeOntologies()**

```typescript
export function mergeOntologies(ontologies: Map<string, Ontology>): MergedGraph {
  const classes = new Map<string, OntologyNode>();
  const objectProperties = new Map<string, OntologyNode>();
  const datatypeProperties = new Map<string, OntologyNode>();
  const allNodes: OntologyNode[] = [];

  for (const [, ont] of ontologies) {
    for (const node of ont["@graph"]) {
      allNodes.push(node);
      const type = Array.isArray(node["@type"]) ? node["@type"] : [node["@type"]];
      if (type.includes("owl:Class")) classes.set(node["@id"], node);
      if (type.includes("owl:ObjectProperty")) objectProperties.set(node["@id"], node);
      if (type.includes("owl:DatatypeProperty")) datatypeProperties.set(node["@id"], node);
    }
  }
  return { classes, objectProperties, datatypeProperties, ontologies, allNodes };
}
```

Flattens all ontology graphs into a single `MergedGraph` with separate Maps for classes, object properties, and datatype properties. The `allNodes` array preserves all nodes for SBVR rule extraction.

**Stage 4: jsonldToTypeQL(graph)**

Converts the merged graph to a `TypeQLSchema` object (see Section 6 for details).

**Stage 5: generateDefineQuery(schema)**

Produces a single TypeQL `define` block string (see Section 6 for details).

**Stage 6: getBaseSchema()**

Returns the hardcoded base schema string for runtime entities (see Section 9).

**Stage 7: defineSchema() push**

The `typedb_sync_schema` tool combines both schemas and pushes them to TypeDB:

```typescript
// Push base schema first (runtime entities)
await client.defineSchema(getBaseSchema(), dbName);

// Push ontology-derived schema second (domain entities)
const schema = jsonldToTypeQL(graph);
const typeql = generateDefineQuery(schema);
await client.defineSchema(typeql, dbName);
```

The base schema is pushed first because ontology-derived entities may reference base attributes. TypeQL `define` is idempotent -- re-pushing the same schema does not cause errors.

### SBVR Export Pathway

Parallel to the TypeQL schema generation, the SBVR export pathway produces structured data:

```typescript
const sbvrExport = exportSBVRForTypeDB(graph);
// Returns: { conceptTypes, factTypes, rules, proofTables }
```

This data can be used to seed TypeDB with business rule entities, or to generate documentation, or to validate incoming data against SBVR constraints.

---

## 23. Extension Integration

**File:** `extensions/mabos/src/index.ts` (3,270 lines)

TypeDB is wired throughout the MABOS extension entry point. The integration points are:

### Startup

```typescript
// Lazy TypeDB connection (fire-and-forget, non-blocking)
const typedbClient = getTypeDBClient();
// Connection happens in background; if it fails, isAvailable() returns false
```

The extension does not block on TypeDB availability at startup. This ensures the extension activates promptly even when TypeDB is unreachable.

### BDI Heartbeat

The BDI heartbeat is a periodic cycle that runs the Belief-Desire-Intention reasoning loop. After each cycle:

```typescript
// Write cycle results to TypeDB
await writeBdiCycleResultToTypeDB(agentId, dbName, {
  newBeliefs: cycleResult.newBeliefs,
  newIntentions: cycleResult.newIntentions,
  updatedGoals: cycleResult.updatedGoals,
});
```

This ensures that cognitive state changes from the BDI loop are reflected in the knowledge graph in near real-time.

### Dashboard Agent List

The dashboard agent list endpoint overlays TypeDB data onto filesystem data:

```typescript
// Try TypeDB first for belief/intention/desire/goal counts
const typedbAgents = await queryAgentListFromTypeDB(dbName);
if (typedbAgents) {
  // Overlay TypeDB counts onto filesystem agent data
  for (const agent of agents) {
    const typedbAgent = typedbAgents.find((ta) => ta.id === agent.id);
    if (typedbAgent) {
      agent.beliefs = typedbAgent.beliefs;
      agent.goals = typedbAgent.goals;
      agent.intentions = typedbAgent.intentions;
      agent.desires = typedbAgent.desires;
    }
  }
}
```

### Dashboard Decisions

```typescript
const typedbDecisions = await queryDecisionsFromTypeDB(dbName);
if (typedbDecisions) {
  return typedbDecisions;
}
// Fallback: read from filesystem
```

### Dashboard Agent Detail

```typescript
const typedbDetail = await queryAgentDetailFromTypeDB(agentId, dbName);
if (typedbDetail) {
  return typedbDetail;
}
// Fallback: read from filesystem
```

### Knowledge Stats

```typescript
const stats = await queryKnowledgeStatsFromTypeDB(agentId, dbName);
if (stats) {
  return stats;
}
// Fallback: count from JSON files
```

### Tropos Goal Model

```typescript
const goalModel = await queryGoalModelFromTypeDB(dbName);
if (goalModel) {
  return goalModel;
}
// Fallback: build from filesystem goal files
```

### Onboarding

The onboarding flow integrates multiple TypeDB operations:

1. **Schema sync** -- Pushes the base schema and ontology-derived schema to TypeDB
2. **Goal seed** -- Runs the goal seed tool to populate the knowledge graph
3. **Tropos model** -- Queries the seeded data to build the Tropos goal model for display

### Workflow API Routes

Workflow API endpoints (create, update, delete workflows/elements/flows/pools/lanes) delegate to the TypeDB-backed `BpmnStoreQueries` class.

### Shutdown

```typescript
// Close TypeDB connection on deactivation
await typedbClient.close();
```

The `close()` method nulls the driver reference and sets `available = false`. Since the HTTP driver is stateless, this is a no-op at the network level but cleans up the singleton.

---

## 24. Data Flow Diagrams

### Write-Through Flow

```
Agent Tool Call (e.g., assert_fact)
         |
         v
+------------------+
| Load JSON file   |  <-- facts.json, rules.json, memory-store.json
+------------------+
         |
         v
+------------------+
| Mutate in-memory |  <-- add/update/delete the data structure
+------------------+
         |
         v
+------------------+
| Save JSON file   |  <-- Atomic write to filesystem
+------------------+
         |
    +----+----+
    |         |
    v         v
+--------+ +-------------------+
| Write  | | Materialize       |
| to     | | Markdown (.md)    |
| TypeDB | | for search indexer|
+--------+ +-------------------+
    |
    +-- Try: client.insertData(typeql, db)
    |
    +-- Catch TypeDBUnavailableError: log, continue
    |
    +-- Catch other error: log, continue
```

### Schema Sync Flow

```
Agent calls typedb_sync_schema(business_id)
         |
         v
+------------------+
| connect()        |  <-- Ensure TypeDB is available
+------------------+
         |
         v
+------------------+
| ensureDatabase() |  <-- Create mabos_<business_id> if needed
+------------------+
         |
    +----+----+
    |         |
    v         v
+--------+ +-------------------+
| Push   | | Load ontologies   |
| base   | | from .jsonld files|
| schema | +-------------------+
+--------+          |
                    v
            +-------------------+
            | mergeOntologies() |
            +-------------------+
                    |
                    v
            +-------------------+
            | jsonldToTypeQL()  |
            +-------------------+
                    |
                    v
            +-------------------+
            | generateDefine()  |
            +-------------------+
                    |
                    v
            +-------------------+
            | Push ontology     |
            | schema to TypeDB  |
            +-------------------+
```

### Query Fallback Flow

```
Dashboard / Agent Query
         |
         v
+------------------+
| getTypeDBClient()|  <-- Get singleton
+------------------+
         |
         v
+------------------+
| isAvailable()?   |
+------------------+
    |           |
    | Yes       | No
    v           v
+--------+ +-------------------+
| Execute| | Read JSON file    |
| TypeQL | | Parse and filter  |
| query  | | Return results    |
+--------+ +-------------------+
    |
    v
+------------------+
| Results found?   |
+------------------+
    |           |
    | Yes       | No (empty or error)
    v           v
+--------+ +-------------------+
| Return | | Read JSON file    |
| TypeDB | | Parse and filter  |
| results| | Return results    |
+--------+ +-------------------+
```

### BDI Heartbeat Flow

```
Periodic BDI Cycle Trigger
         |
         v
+------------------+
| Run BDI reasoning|  <-- Evaluate beliefs, desires, intentions
| cycle in-memory  |
+------------------+
         |
         v
+------------------+
| Generate results |  <-- newBeliefs[], newIntentions[], updatedGoals[]
+------------------+
         |
    +----+----+
    |         |
    v         v
+--------+ +-----------------------------+
| Update | | writeBdiCycleResultToTypeDB()|
| JSON   | | Insert new beliefs/intentions|
| files  | | to knowledge graph           |
+--------+ +-----------------------------+
```

### Goal Seed Flow

```
Agent calls goal_seed_business
         |
         v
+------------------+
| Insert 9 agents  |  <-- Agent entities with uid, name
+------------------+
         |
         v
+------------------+
| Insert 18 desires|  <-- DesireStoreQueries.createDesire()
+------------------+       + agent_owns relations
         |
         v
+------------------+
| Insert 42 goals  |  <-- GoalStoreQueries.createGoal()
+------------------+       + agent_owns relations
         |
         v
+----------------------------------+
| Create desire_motivates_goal     |
| relations (desire -> goal links) |
+----------------------------------+
         |
         v
+------------------+
| Insert 8 beliefs |  <-- BeliefStoreQueries.createBelief()
+------------------+       + belief_supports_goal relations
         |
         v
+-------------------+
| Insert 5 decisions|  <-- DecisionStoreQueries.createDecision()
+-------------------+       + decision_resolves_goal relations
         |
         v
+------------------+
| Insert plans,    |  <-- Plans, PlanSteps, Tasks
| steps, tasks     |      + goal_requires_plan
+------------------+       + plan_contains_step
         |                 + step_depends_on
         v
+-------------------+
| Insert workflows  |  <-- WorkflowStoreQueries
+-------------------+       + goal_has_workflow
```

---

## 25. Operational Considerations

### Connection Management

**Singleton lifecycle:**

- The TypeDB client singleton is created on first access via `getTypeDBClient()`
- Connection is attempted immediately (fire-and-forget)
- If connection fails, `available` is set to `false` and all queries gracefully degrade
- The singleton persists for the entire extension lifecycle
- On extension deactivation, `close()` is called

**Reconnection:**

- There is no automatic reconnection loop
- If TypeDB becomes available after startup, the `healthCheck()` method or manual `connect()` call will re-establish availability
- The `typedb_status` tool calls `healthCheck()`, which attempts reconnection if the driver is null
- Dashboard query functions also attempt reconnection if `isAvailable()` returns false

**Server URL configuration:**

- Default: `http://157.230.13.13:8729`
- Override: set `TYPEDB_URL` environment variable
- The URL can also be passed directly to `getTypeDBClient(serverUrl)`

### Error Handling Strategy

**Three error categories:**

1. **TypeDBUnavailableError** -- Server unreachable or connection lost. All callers catch this and fall back to JSON. The client sets `available = false` to prevent further attempts until explicit reconnection.

2. **TypeDB API errors** -- Server reachable but query fails (schema mismatch, invalid TypeQL, etc.). These propagate as standard Error objects. The `unwrap()` helper formats the error code and message.

3. **Network errors** -- Timeouts, DNS failures, etc. These are caught by the driver and manifest as connection failures in `connect()` or query failures in the one-shot methods.

**Error isolation:**

- Each TypeDB write in the write-through pattern is individually try/caught
- Dashboard queries return `null` on any error
- The goal seed tool skips individual item failures but continues seeding
- The BDI heartbeat logs but does not fail on TypeDB errors

### Performance Considerations

**One-shot transactions:**

- Every query opens a new transaction, which adds overhead compared to long-lived transactions
- This trade-off is intentional: it simplifies error handling and avoids transaction timeout management
- For bulk operations (goal seeding), this means N round trips for N insertions

**Parallel queries:**

- Dashboard functions use `Promise.all()` for parallel count queries
- Individual `.catch(() => null)` handlers ensure one failed query does not block others
- The agent list endpoint runs 4 parallel queries per agent (beliefs, goals, desires, intentions)

**Query optimization:**

- All queries use `uid @key` annotations for indexed lookups
- Agent scoping via `agent_owns` is the most common pattern and benefits from TypeDB's relation indexing
- The `retrieveSimilar()` CBR query fetches all cases in a domain, relying on the caller for similarity scoring -- this could become a bottleneck with large case bases

**Database naming:**

- Databases follow the pattern `mabos_<business_id>`
- Each business gets one database containing all its agents
- Schema is shared across all agents within a database

### Schema Evolution

**Additive schema changes:**

- TypeQL `define` is idempotent for new definitions
- Adding new attributes, entities, or relations does not affect existing data
- Re-running `typedb_sync_schema` is safe

**Breaking schema changes:**

- Renaming or removing attributes requires manual migration
- Changing attribute value types requires dropping and recreating the attribute
- The base schema uses `string` for timestamps (not `datetime`) to avoid parsing issues

**Ontology-to-schema drift:**

- If the ontology changes, re-running `typedb_sync_schema` will add new schema elements
- Removed ontology classes will leave orphaned schema definitions (TypeQL does not have `undefine` in the one-shot API)
- The base schema is hardcoded and changes only with code deployments

### Data Consistency

**JSON-TypeDB consistency:**

- JSON is always written first, ensuring no data loss
- TypeDB may lag behind JSON if writes fail
- The `typedb_sync_agent_data` tool can re-sync JSON data to TypeDB at any time
- There is no reverse sync (TypeDB -> JSON); JSON is always authoritative

**Duplicate handling:**

- `uid @key` annotations prevent duplicate entities with the same UID
- Re-inserting an existing entity will fail at the TypeDB level; the error is caught and skipped
- Relation duplicates are possible if the same link is created multiple times (TypeDB allows duplicate relation instances)

**Temporal consistency:**

- All timestamps are ISO 8601 strings
- `created_at` is set at insertion time
- `updated_at` is set at every modification
- There is no distributed timestamp coordination between JSON and TypeDB writes

---

## 26. References

### Companion Documents

| Document                      | Path                                    | Coverage                                                   |
| ----------------------------- | --------------------------------------- | ---------------------------------------------------------- |
| System Architecture           | `openclaw-mabos-system-architecture.md` | Overall MABOS architecture, extension lifecycle, dashboard |
| BDI-SBVR Framework            | `bdi-sbvr-framework.md`                 | BDI cognitive cycle, SBVR integration, reasoning           |
| SBVR Ontology System          | `sbvr-ontology-system.md`               | Ontology design, SBVR annotations, validation              |
| Reasoning & Inference         | `reasoning-inference-engine.md`         | Forward/backward chaining, abductive reasoning             |
| Memory Enhancements           | `rlm-memory-enhancements.md`            | Memory hierarchy, consolidation, materialization           |
| Multi-Agent Coordination      | `multi-agent-coordination.md`           | Agent communication, delegation, coordination              |
| Plugin Extension Architecture | `plugin-extension-architecture.md`      | OpenClaw plugin SDK, tool registration, lifecycle          |

### Source Files

| File                    | Absolute Path                                        |
| ----------------------- | ---------------------------------------------------- |
| TypeDB Client           | `extensions/mabos/src/knowledge/typedb-client.ts`    |
| TypeDB Schema Converter | `extensions/mabos/src/knowledge/typedb-schema.ts`    |
| TypeDB Query Layer      | `extensions/mabos/src/knowledge/typedb-queries.ts`   |
| TypeDB Dashboard        | `extensions/mabos/src/knowledge/typedb-dashboard.ts` |
| BPMN Queries            | `extensions/mabos/src/knowledge/bpmn-queries.ts`     |
| TypeDB Tools            | `extensions/mabos/src/tools/typedb-tools.ts`         |
| Fact Store              | `extensions/mabos/src/tools/fact-store.ts`           |
| Rule Engine             | `extensions/mabos/src/tools/rule-engine.ts`          |
| Inference Tools         | `extensions/mabos/src/tools/inference-tools.ts`      |
| Goal Seed               | `extensions/mabos/src/tools/goal-seed.ts`            |
| Ontology Index          | `extensions/mabos/src/ontology/index.ts`             |

### External Dependencies

| Package              | Version | Purpose                                     |
| -------------------- | ------- | ------------------------------------------- |
| `typedb-driver-http` | latest  | HTTP driver for TypeDB server               |
| `@sinclair/typebox`  | latest  | Runtime type validation for tool parameters |

### TypeDB Documentation

- TypeDB Server: https://typedb.com/docs
- TypeQL Language: https://typedb.com/docs/typeql
- HTTP Driver: https://github.com/vaticle/typedb-driver/tree/master/http

---

_End of document._
