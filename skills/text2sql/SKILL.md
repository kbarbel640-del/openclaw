---
name: text2sql
description: Natural-language queries over a read-only PostgreSQL database. Use when the user asks to get data from the database, pull pipeline/table data, run a query, or export to CSV. Requires DATABASE_URL (read-only user recommended).
metadata: { "openclaw": { "emoji": "🗄️", "requires": { "env": ["DATABASE_URL"] } } }
---

# Text2SQL (PostgreSQL read-only)

## Overview

Answer natural-language questions about data in a PostgreSQL database by turning them into read-only SQL. Only **SELECT** is allowed; any request to change data must be declined.

## When to use

- User asks for data from "the database", "Postgres", "our DB", "pipeline data", "table data", "run a query", "export to CSV", or similar.
- Requires `DATABASE_URL` in the environment (recommend a read-only PostgreSQL user).

## Read-only rule

**Only reads are allowed.** If the user asks to INSERT, UPDATE, DELETE, or otherwise change data, decline and explain that this skill is read-only. Do not attempt to run any non-SELECT statement.

## Workflow

1. **Unclear table:** If the request does not identify the table (e.g. "latest pipeline data"), run the script with `list_tables`, then infer from names or **ask the user to confirm** which table to use.
2. **Before building a query:** Run the script with `schema --table <T>` and `sample --table <T>` to get column names and one sample row so you can build correct SQL.
3. **Build and run:** Compose a single `SELECT`; run the script with `query --sql "..." [--limit N]` (max 1000 rows).
4. **Output:** Return raw CSV (with a row limit) or use the result as context and write a short analysis in natural language.

## How to run the script

From the repository root, with `DATABASE_URL` set:

```bash
# List tables
DATABASE_URL="postgresql://..." node --import tsx skills/text2sql/scripts/query.ts list_tables

# Schema for a table
DATABASE_URL="postgresql://..." node --import tsx skills/text2sql/scripts/query.ts schema --table <name>

# One sample row (default limit 1)
DATABASE_URL="postgresql://..." node --import tsx skills/text2sql/scripts/query.ts sample --table <name> [--limit 1]

# Run a SELECT (limit default 500, max 1000)
DATABASE_URL="postgresql://..." node --import tsx skills/text2sql/scripts/query.ts query --sql "SELECT ..." [--limit 500]
```

If Bun is available you can use `bun` instead of `node --import tsx`. Script path: `skills/text2sql/scripts/query.ts` from repo root.
