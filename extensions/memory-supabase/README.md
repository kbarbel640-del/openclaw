# Memory (Supabase)

Bundled OpenClaw memory plugin that stores long-term memory in Supabase (`pgvector`).

## Setup

1. In Supabase SQL editor, run [`schema.sql`](./schema.sql).
2. Configure plugin slot:

```json5
plugins: {
  slots: {
    memory: "memory-supabase"
  },
  entries: {
    "memory-supabase": {
      enabled: true,
      config: {
        supabase: {
          url: "${SUPABASE_URL}",
          serviceKey: "${SUPABASE_SERVICE_ROLE_KEY}"
        },
        embedding: {
          provider: "openai",
          apiKey: "${OPENAI_API_KEY}",
          model: "text-embedding-3-small"
        },
        autoRecall: true,
        autoCapture: true
      }
    }
  }
}
```

3. Restart the gateway.

## Notes

- `embedding.provider` supports `openai`, `gemini`, `voyage`, `mistral`, and `local`.
- `embedding.apiKey` is optional. If omitted, OpenClaw resolves auth using core conventions (auth profiles, `models.providers.*.apiKey`, env vars like `OPENAI_API_KEY`, `GEMINI_API_KEY`, `VOYAGE_API_KEY`, `MISTRAL_API_KEY`).
- SQL schema defaults to `vector(1536)` (`text-embedding-3-small`). If your selected model has a different vector length, update schema dimensions to match.
- Keep exactly one memory backend in `plugins.slots.memory` (for this setup, `memory-supabase`).
- This plugin provides `memory_search`, `memory_get`, `memory_store`, and `memory_forget`.
