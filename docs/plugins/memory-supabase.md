---
summary: "Memory Supabase plugin: durable remote memory with Supabase pgvector and production guardrails"
read_when:
  - You want OpenClaw memory in Supabase instead of local storage
  - You are deploying memory-supabase in production
title: "Memory Supabase Plugin"
---

# Memory Supabase Plugin

`memory-supabase` is the bundled OpenClaw memory plugin for durable, remote
long-term memory using Supabase Postgres + `pgvector`.

It supports:

- Semantic recall (`memory_search`)
- Point reads (`memory_get`)
- Explicit writes (`memory_store`)
- Deletes (`memory_forget`)
- Auto recall before responses
- Auto capture after successful runs

## Quick setup

1. In Supabase SQL editor, run
   [`extensions/memory-supabase/schema.sql`](https://github.com/openclaw/openclaw/blob/main/extensions/memory-supabase/schema.sql).
2. Configure OpenClaw plugin slot and plugin config:

```json5
{
  plugins: {
    slots: {
      memory: "memory-supabase",
    },
    entries: {
      "memory-supabase": {
        enabled: true,
        config: {
          supabase: {
            url: "${SUPABASE_URL}",
            serviceKey: "${SUPABASE_SERVICE_ROLE_KEY}",
          },
          embedding: {
            apiKey: "${OPENAI_API_KEY}",
            model: "text-embedding-3-small",
          },
          autoRecall: true,
          autoCapture: true,
        },
      },
    },
  },
}
```

3. Restart OpenClaw Gateway.

## Supabase best practices

### Key handling and secrets

- Use only the Supabase `service_role` key for this plugin.
- Never use `anon` or publishable keys for server-side memory writes.
- Keep Supabase and OpenAI keys in environment variables or a secret manager.
- Never commit secrets in config files, docs, or test fixtures.
- Rotate keys periodically and restart OpenClaw after rotation.

### Database access and privilege model

- Keep direct table access restricted; use RPC functions for plugin operations.
- Grant execute on memory RPC functions only to `service_role`.
- Do not grant memory RPC execute permissions to `anon` or `authenticated`.
- Treat `security definer` RPC functions as privileged code and review changes
  carefully before deploy.

### Vector and model consistency

- Keep embedding model and vector dimension aligned.
- `text-embedding-3-small` uses 1536 dimensions.
- `text-embedding-3-large` uses 3072 dimensions.
- If you change models, migrate table schema and RPC function expectations
  together.

### Performance and scale

- Keep the `hnsw` vector index from `schema.sql`.
- Run `ANALYZE` after large backfills so query planning stays accurate.
- Use bounded recall in config (`maxRecallResults`, `minScore`) to control cost
  and latency.
- Use pooling and region proximity between OpenClaw and Supabase where possible.

### Durability, retention, and decay

- Enable Supabase backups and point in time recovery for production projects.
- Define explicit retention policy by category and age.
- Add scheduled decay jobs to reduce importance over time for stale memories.
- Purge low-importance stale data on a schedule to keep recall quality high.

### Observability and operations

- Track RPC errors and latency in logs.
- Run periodic health checks against memory RPC functions.
- Alert on auth failures, schema mismatch errors, and sustained latency spikes.
- Keep a staging Supabase project for schema and plugin rollouts before
  production.

## Security checklist

- `SUPABASE_SERVICE_ROLE_KEY` is server-only.
- `OPENAI_API_KEY` is server-only.
- No hardcoded secrets in `openclaw.json`, docs, or repository files.
- RPC privileges scoped to `service_role`.
- Backups enabled and restore path tested.

## Troubleshooting

- `permission denied for function ...`:
  Check grants in `schema.sql`, and verify you are using `service_role`.
- Vector dimension errors:
  Ensure table vector dimension matches embedding model.
- Empty recall results:
  Validate inserts are happening, then tune `minScore` lower.
- Slow search:
  Rebuild/analyze indexes and verify region/network placement.

See also [Plugins](/tools/plugin) and [Memory](/concepts/memory).
