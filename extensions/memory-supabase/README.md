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

- SQL schema defaults to `vector(1536)` (`text-embedding-3-small`).
- If you switch to `text-embedding-3-large`, update table/function vector dimensions to `3072`.
- This plugin provides `memory_search`, `memory_get`, `memory_store`, and `memory_forget`.
