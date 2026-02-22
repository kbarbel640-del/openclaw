# MABOS ERP Tools Design

**Date:** 2026-02-19
**Status:** Approved
**Scope:** Add ERP application tools to MABOS agents covering 13 business domains

## Overview

Add a full ERP tooling layer to MABOS agents with domain-action tools for ecommerce, customers, finance, legal, projects, marketing, HR, inventory, suppliers, supply chain, compliance, analytics, and workflows. Data is split across three layers: Postgres (transactional records), TypeDB (knowledge graph relationships), and Markdown (agent BDI cognitive state) with two-way sync between ERP and BDI.

## Data Layer Architecture

### Three-Layer Split

| Layer                 | Engine         | What Lives Here                                                                                                                            |
| --------------------- | -------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| Transactional records | Postgres       | Orders, invoices, payments, ledger entries, inventory counts, payroll, shipping records, stock movements                                   |
| Knowledge graph       | TypeDB         | Customer-product affinities, org hierarchies, contract dependencies, campaign-goal linkages, supply chain networks, compliance rule graphs |
| Cognitive state       | Markdown files | Agent beliefs, desires, goals, intentions (existing BDI layer)                                                                             |

### Postgres Schema

All tables live under `CREATE SCHEMA erp`. Core tables per domain:

**Shared:**

- `erp.audit_log` (id, domain, entity_type, entity_id, action, agent_id, payload JSONB, created_at)

**Finance:**

- `erp.accounts` (id, name, type, currency, balance, parent_id, created_at)
- `erp.invoices` (id, customer_id, status, amount, currency, due_date, line_items JSONB, created_at)
- `erp.payments` (id, invoice_id, amount, method, status, processed_at)
- `erp.ledger_entries` (id, account_id, debit, credit, description, reference_type, reference_id, posted_at)

**Ecommerce:**

- `erp.products` (id, sku, name, description, price, currency, status, metadata JSONB, created_at)
- `erp.orders` (id, customer_id, status, total, currency, line_items JSONB, shipping_address JSONB, created_at)
- `erp.carts` (id, customer_id, items JSONB, expires_at, created_at)

**Customers:**

- `erp.contacts` (id, name, email, phone, company, segment, lifecycle_stage, metadata JSONB, created_at)
- `erp.interactions` (id, contact_id, channel, type, summary, sentiment, agent_id, created_at)

**Projects:**

- `erp.projects` (id, name, status, owner_agent_id, start_date, end_date, budget, metadata JSONB, created_at)
- `erp.tasks` (id, project_id, title, status, assigned_agent_id, priority, due_date, dependencies JSONB, created_at)
- `erp.milestones` (id, project_id, title, target_date, status, kpi_targets JSONB, created_at)

**Marketing:**

- `erp.campaigns` (id, name, status, type, channel, budget, start_date, end_date, target_segment, goals JSONB, metrics JSONB, created_at)
- `erp.funnels` (id, campaign_id, name, stages JSONB, conversion_rates JSONB, created_at)

**HR:**

- `erp.employees` (id, name, email, role, department, status, start_date, metadata JSONB, created_at)
- `erp.payroll` (id, employee_id, period, gross, deductions, net, status, created_at)

**Inventory:**

- `erp.warehouses` (id, name, location, capacity, metadata JSONB, created_at)
- `erp.stock_items` (id, product_id, warehouse_id, quantity, reorder_point, last_counted_at, created_at)

**Suppliers:**

- `erp.suppliers` (id, name, contact_email, category, rating, status, payment_terms, metadata JSONB, created_at)
- `erp.supplier_contracts` (id, supplier_id, terms JSONB, start_date, end_date, status, created_at)

**Supply Chain:**

- `erp.supply_nodes` (id, name, type, location, capacity JSONB, metadata JSONB, created_at)
- `erp.shipments` (id, origin_node_id, dest_node_id, order_id, status, carrier, tracking JSONB, created_at)

**Legal:**

- `erp.contracts` (id, title, party, type, status, effective_date, expiry_date, terms JSONB, document_url, created_at)
- `erp.approvals` (id, entity_type, entity_id, approver_agent_id, status, comments, decided_at, created_at)

**Compliance:**

- `erp.compliance_rules` (id, domain, name, description, severity, check_query, active, created_at)
- `erp.audits` (id, rule_id, status, findings JSONB, auditor_agent_id, completed_at, created_at)
- `erp.violations` (id, rule_id, entity_type, entity_id, severity, resolution, resolved_at, created_at)

**Analytics:**

- `erp.kpis` (id, domain, name, query, target, current, unit, period, updated_at)
- `erp.dashboards` (id, name, owner_agent_id, layout JSONB, kpi_ids UUID[], created_at)

**Workflows:**

- `erp.workflows` (id, name, domain, trigger_event, steps JSONB, status, created_at)
- `erp.workflow_runs` (id, workflow_id, status, current_step, context JSONB, started_at, completed_at)

### TypeDB Schema

Entities: customer, product, supplier, campaign, project, goal, agent, supply-node, compliance-rule, contract, department

Relations: purchased (buyer-item), supplies (vendor-item), targets (campaign-audience), advances (campaign/project-goal), depends-on (dependent-dependency), assigned-to (assignee-work-item), governed-by (entity-rule), supply-route (origin-destination), belongs-to (member-group)

Full schema in `mabos/erp/db/schema/erp-knowledge-graph.tql`.

## Tool Interface Design

### Pattern: Domain-Action Tools

Each domain exposes a single `erp_<domain>` tool with an `action` parameter. Built by `createErpDomainTool()` factory in `shared/tool-factory.ts`.

```typescript
erp_finance({ action: "create_invoice", params: { customer_id, line_items, due_date } });
erp_projects({ action: "assign_task", params: { project_id, title, assigned_agent_id } });
erp_marketing({ action: "launch_campaign", params: { name, channel, budget } });
```

### Standard Actions (all domains)

| Action | Description                            |
| ------ | -------------------------------------- |
| create | Create a new entity                    |
| get    | Get entity by ID                       |
| list   | List/search with filters               |
| update | Update entity fields                   |
| delete | Soft-delete (status: archived)         |
| search | Full-text + TypeDB relationship search |
| link   | Create TypeDB relationship             |
| unlink | Remove TypeDB relationship             |

Plus domain-specific actions (e.g. `record_payment`, `profit_loss`, `run_audit`, `launch_campaign`).

### Tool Context

Every tool handler receives `ErpToolContext` with: agentId, agentDir, pg (Postgres client), typedb (TypeDB client), syncEngine (BDI sync), logger.

### Agent Role-Based Tool Access

| Agent Role       | Tools Loaded                                                                |
| ---------------- | --------------------------------------------------------------------------- |
| Marketing Agent  | erp-overview, erp-marketing, erp-projects, erp-customers, erp-analytics     |
| Finance Agent    | erp-overview, erp-finance, erp-compliance, erp-analytics                    |
| Operations Agent | erp-overview, erp-inventory, erp-suppliers, erp-supply-chain, erp-workflows |
| Legal Agent      | erp-overview, erp-legal, erp-compliance                                     |
| HR Agent         | erp-overview, erp-hr, erp-compliance                                        |
| Executive Agent  | erp-overview, all domain skills                                             |

## BDI Two-Way Sync Engine

### Direction 1: ERP to BDI (immediate, on mutation)

| ERP Event              | Cognitive Target | Effect                                      |
| ---------------------- | ---------------- | ------------------------------------------- |
| New project            | Desires.md       | Adds desire with priority, budget, timeline |
| New campaign           | Desires.md       | Adds desire with channel, segment, budget   |
| New task assigned      | Intentions.md    | Adds intention with deadline, priority      |
| New milestone          | Intentions.md    | Adds intention with deadline, KPI targets   |
| KPI update             | Beliefs.md       | Updates belief with current vs target       |
| Compliance violation   | Goals.md         | Adds goal to resolve violation              |
| Supplier rating change | Beliefs.md       | Updates belief with risk level              |
| New order              | Beliefs.md       | Adds demand signal belief                   |

### Direction 2: BDI to ERP (on heartbeat cycle)

| Cognitive Change     | ERP Update               |
| -------------------- | ------------------------ |
| Intention -> stalled | Task status -> "blocked" |
| Intention -> expired | Milestone -> "at_risk"   |
| Desire -> dropped    | Project -> "on_hold"     |
| Goal -> resolved     | Violation -> "resolved"  |

### Tagging

Each synced entry is tagged `[erp:<domain>:<entity_id>]` for deduplication and round-trip tracking.

## Directory Structure

```
mabos/erp/
├── db/
│   ├── postgres.ts
│   ├── typedb.ts
│   ├── migrations/ (15 SQL files)
│   └── schema/erp-knowledge-graph.tql
├── shared/
│   ├── types.ts
│   ├── tool-factory.ts
│   ├── bdi-sync.ts
│   ├── audit.ts
│   └── validators.ts
├── ecommerce/ (entities.ts, queries.ts, tools.ts)
├── customers/ (entities.ts, queries.ts, tools.ts)
├── finance/ (entities.ts, queries.ts, tools.ts)
├── legal/ (entities.ts, queries.ts, tools.ts)
├── projects/ (entities.ts, queries.ts, tools.ts)
├── marketing/ (entities.ts, queries.ts, tools.ts)
├── hr/ (entities.ts, queries.ts, tools.ts)
├── inventory/ (entities.ts, queries.ts, tools.ts)
├── suppliers/ (entities.ts, queries.ts, tools.ts)
├── supply-chain/ (entities.ts, queries.ts, tools.ts)
├── compliance/ (entities.ts, queries.ts, tools.ts)
├── analytics/ (entities.ts, queries.ts, tools.ts)
├── workflows/ (entities.ts, queries.ts, tools.ts)
└── index.ts

skills/erp/
├── erp-overview.md
├── bdi-sync.md
├── ecommerce.md
├── customers.md
├── finance.md
├── legal.md
├── projects.md
├── marketing.md
├── hr.md
├── inventory.md
├── suppliers.md
├── supply-chain.md
├── compliance.md
├── analytics.md
└── workflows.md
```

## Build Sequence (8 phases)

| Phase             | Description                                 | Files     |
| ----------------- | ------------------------------------------- | --------- |
| 1. Foundation     | DB clients, shared types, validation, audit | 5 files   |
| 2. Schema         | Postgres migrations, TypeDB schema          | 16 files  |
| 3. Tool Factory   | Domain-action tool builder                  | 1 file    |
| 4. Sync Engine    | Two-way BDI sync                            | 1 file    |
| 5. Domain Modules | 13 domains x 3 files each                   | 39 files  |
| 6. Registration   | Wire together, integrate heartbeat          | 2 files   |
| 7. Skills         | Agent skills for all domains                | 15 files  |
| 8. Testing        | Unit tests per domain + sync                | ~15 files |

### Phase 5 Domain Build Order

**Tier 1 (no deps):** customers, finance, hr
**Tier 2 (needs Tier 1):** ecommerce, suppliers, legal, compliance
**Tier 3 (needs Tier 1+2):** inventory, supply-chain, projects, marketing
**Tier 4 (cross-cutting):** analytics, workflows

## Configuration

```env
MABOS_PG_HOST=localhost
MABOS_PG_PORT=5432
MABOS_PG_DATABASE=mabos_erp
MABOS_PG_USER=mabos
MABOS_PG_PASSWORD=
MABOS_TYPEDB_HOST=localhost
MABOS_TYPEDB_PORT=1729
MABOS_TYPEDB_DATABASE=mabos_knowledge
```

## Dependencies

- `pg` ^8.13.0
- `typedb-driver` ^2.28.0
