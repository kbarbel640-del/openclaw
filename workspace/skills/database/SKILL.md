---
name: database
description: >
  Query and write to the Supabase database. Supports schema inspection,
  filtered reads with relations, aggregate analytics (GROUP BY/HAVING),
  and atomic multi-table writes via WriteIntent. All operations are
  schema-validated with type coercion and actionable error messages.
  JSON in, JSON out. No raw SQL.
---

# Database Skill

## Quick Start

Always **inspect first**, then read, then write. The tool validates everything against schema.json.

```bash
# Setup
pip install supabase
# Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_KEY)
```

## Commands

### inspect — Discover schema

```bash
# List all tables
python scripts/db_tool.py inspect

# Table columns (compact)
python scripts/db_tool.py inspect products

# Full detail: constraints, relationships, enums, descriptions
python scripts/db_tool.py inspect products --detailed
```

### read — Query data

```bash
python scripts/db_tool.py read products \
  --filters '{"is_active": true, "price": {"gt": 100}}' \
  --search '{"name": "%bottle%"}' \
  --columns 'id,sku,name,price' \
  --relations 'product_families(name,sku_prefix)' \
  --limit 20 --offset 0
```

**Key distinction:**
- `--filters` = exact match, operators (`gt`, `gte`, `lt`, `lte`, `eq`, `neq`, `in`), list → IN
- `--search` = ILIKE with `%` wildcards, list → OR between patterns
- `--count-only` = return count instead of rows

### aggregate — Analytics via RPC

```bash
python scripts/db_tool.py aggregate products \
  --aggregates '{"total": "count(*)", "avg_price": "avg(price)"}' \
  --filters '{"is_active": true}' \
  --group-by 'product_family_id' \
  --having '{"total": {"gt": 5}}'
```

Requires `dynamic_aggregate` RPC function (migration 006).

### write — Atomic writes via WriteIntent

```bash
python scripts/db_tool.py write --intent '{
  "goal": "Create PET Bottles product family with 2 variants",
  "reasoning": "No duplicates found. New product line.",
  "operations": [
    {
      "action": "create",
      "table": "product_families",
      "data": {"name": "PET Bottles", "sku_prefix": "PET"},
      "returns": "family"
    },
    {
      "action": "create",
      "table": "products",
      "data": [
        {"product_family_id": "@family.id", "sku": "PET-500ML", "name": "PET 500ml", "price": 30},
        {"product_family_id": "@family.id", "sku": "PET-1L", "name": "PET 1L", "price": 50}
      ]
    }
  ],
  "impact": {"creates": {"product_families": 1, "products": 2}}
}'
```

Add `--dry-run` to preview without executing.

## How It Works

1. **Schema validation** — table/column names checked against `references/schema.json`
2. **Type coercion** — filter values auto-cast to match column types
3. **Auto-enrichment** — UUIDs generated for `id`, `created_at`/`updated_at` auto-set
4. **Dependency detection** — `@name.field` references auto-detected (no manual `dependencies` needed)
5. **Atomic execution** — all write operations in a single Postgres transaction via RPC

## Workflow Pattern

```
1. inspect              → discover tables and columns
2. read (search/filter) → check existing data, avoid duplicates
3. write (dry-run)      → preview changes
4. write                → execute
```

## Error Format

All errors include actionable hints:
```json
{"success": false, "error": "Unknown table: 'prodcts'", "hint": "Use 'inspect' to list available tables.", "available_tables": ["products", ...]}
```

## References

- `references/schema.json` — complete database schema
- `references/query_patterns.md` — read/aggregate examples
- `references/write_patterns.md` — WriteIntent examples
