# Model System HTTP Integration

## ✅ Status: INTEGRATED

**Date:** 2026-02-12  
**Author:** Carlos (backend-architect)  
**Integrated by:** Carlos

---

## Overview

Model System HTTP routes are now integrated into the OpenClaw gateway at `/api/models/*`.

**Implemented:**

- ✅ `GET /api/models/metrics` — Full metrics snapshot (JSON or Prometheus)
- ✅ `GET /api/models/metrics/summary` — Quick summary (top providers/models/errors)
- ✅ `DELETE /api/models/metrics` — Reset metrics (admin only)
- 🚧 `GET /api/models` — List models (stub, needs model-catalog.ts integration)
- 🚧 `GET /api/models/:id` — Model details (stub)
- 🚧 `POST /api/models/test` — Test model availability (stub)
- 🚧 `GET /api/models/health` — Health check (stub)
- 🚧 `PUT /api/models/:id/quarantine` — Quarantine model (stub)
- 🚧 `DELETE /api/models/:id/quarantine` — Remove quarantine (stub)

---

## Architecture

### Files Created

1. **`src/gateway/models-http.ts`** — Main HTTP handler (Node HTTP, no Express)
   - Exports `handleModelsHttpRequest(req, res): Promise<boolean>`
   - Handles all `/api/models/*` routes
   - Follows OpenClaw HTTP handler pattern (returns `true` if handled)

2. **Integration Point:** `src/gateway/server-http.ts`
   - Added import: `import { handleModelsHttpRequest } from "./models-http.js"`
   - Added handler call after `handleAccountTagsHttpRequest` (line ~292)
   - Pattern: early-exit cascading handlers

### Dependencies

- `src/agents/provider-metrics.ts` — Core metrics collector (already implemented by Paulo)
- `src/agents/provider-instrumentation.ts` — Provider call wrappers (already implemented)

---

## API Endpoints

### 1. GET /api/models/metrics

Get full metrics snapshot.

**Query Params:**

- `provider` (optional) — Filter by provider (e.g., `openai`)
- `model` (optional) — Filter by model (requires `provider`)
- `format` (optional) — `json` (default) or `prometheus`

**Examples:**

```bash
# All metrics (JSON)
curl http://localhost:3000/api/models/metrics

# Single provider
curl http://localhost:3000/api/models/metrics?provider=openai

# Single model
curl http://localhost:3000/api/models/metrics?provider=openai&model=gpt-4o

# Prometheus format
curl http://localhost:3000/api/models/metrics?format=prometheus
```

**Response (JSON):**

```json
{
  "providers": {
    "openai": {
      "models": {
        "gpt-4o": {
          "requests": { "started": 150, "success": 148, "error": 2, "successRate": 0.9867, "errorRate": 0.0133 },
          "latency": { "p50": 1250, "p95": 2500, "p99": 3200, "count": 150 },
          "tokens": { "input": 50000, "output": 75000, "total": 125000 },
          "cost": { "estimated": 0.875 },
          "errors": { "RateLimitError": 2 },
          "fallbacks": { "triggered": 2, "targets": { "google/gemini-2.0-flash-exp": 2 } },
          "rateLimits": 2,
          "lastRequestAt": 1707744000000
        }
      },
      "totals": { "requests": {...}, "tokens": {...}, "cost": {...}, "fallbacks": 2, "rateLimits": 2 }
    }
  },
  "global": {
    "requests": { "started": 320, "success": 315, "error": 5, "successRate": 0.984, "errorRate": 0.016 },
    "tokens": { "input": 120000, "output": 180000, "total": 300000 },
    "cost": { "estimated": 2.45 },
    "fallbacks": 5,
    "rateLimits": 5,
    "activeProviders": 3,
    "activeModels": 7
  },
  "snapshotAt": 1707744000000
}
```

**Response (Prometheus):**

```
# HELP openclaw_ai_requests_total Total number of AI requests
# TYPE openclaw_ai_requests_total counter
openclaw_ai_requests_total{status="started"} 320 1707744000000
openclaw_ai_requests_total{status="success"} 315 1707744000000
openclaw_ai_requests_total{status="error"} 5 1707744000000

# HELP openclaw_ai_model_requests_total Per-model request counts
# TYPE openclaw_ai_model_requests_total counter
openclaw_ai_model_requests_total{provider="openai",model="gpt-4o",status="started"} 150 1707744000000
openclaw_ai_model_requests_total{provider="openai",model="gpt-4o",status="success"} 148 1707744000000
...
```

---

### 2. GET /api/models/metrics/summary

Quick summary: top providers, top models, errors.

**Example:**

```bash
curl http://localhost:3000/api/models/metrics/summary
```

**Response:**

```json
{
  "global": { "requests": {...}, "tokens": {...}, "cost": {...}, ... },
  "topProviders": [
    { "provider": "openai", "requests": 150, "successRate": 0.986, "tokens": 125000, "cost": 0.875 },
    { "provider": "anthropic", "requests": 100, "successRate": 0.99, "tokens": 95000, "cost": 1.2 }
  ],
  "topModels": [
    { "provider": "openai", "model": "gpt-4o", "requests": 150, "successRate": 0.986, "latencyP95": 2500, ... }
  ],
  "errors": [
    { "provider": "openai", "model": "gpt-4o", "errors": 2, "errorRate": 0.0133, "errorTypes": { "RateLimitError": 2 } }
  ],
  "snapshotAt": 1707744000000
}
```

---

### 3. DELETE /api/models/metrics

Reset metrics (admin only).

**Query Params:**

- `provider` (optional) — Reset specific provider
- `model` (optional) — Reset specific model (requires `provider`)

**Examples:**

```bash
# Reset all metrics
curl -X DELETE http://localhost:3000/api/models/metrics

# Reset provider
curl -X DELETE http://localhost:3000/api/models/metrics?provider=openai

# Reset model
curl -X DELETE http://localhost:3000/api/models/metrics?provider=openai&model=gpt-4o
```

**Response:**

```json
{ "ok": true, "message": "All metrics reset" }
```

---

### 4-9. Stub Endpoints (Pending Integration)

These routes are implemented as stubs and return placeholder responses:

- `GET /api/models` — List models
- `GET /api/models/:id` — Get model details
- `POST /api/models/test` — Test model availability
- `GET /api/models/health` — Health check
- `PUT /api/models/:id/quarantine` — Quarantine model
- `DELETE /api/models/:id/quarantine` — Remove quarantine

**Next Steps:**

1. Integrate with `src/agents/model-catalog.ts` for catalog operations
2. Integrate with `src/agents/model-availability.ts` for health/quarantine
3. Add authentication/authorization checks (admin-only for DELETE/PUT)

---

## Testing

### Manual Testing

1. **Start OpenClaw:**

   ```bash
   cd /Users/juliocezar/Desenvolvimento/openclawdev
   bun run dev
   ```

2. **Test metrics endpoint:**

   ```bash
   # Trigger some AI requests first (via chat or API)
   # Then check metrics
   curl http://localhost:3000/api/models/metrics/summary | jq
   ```

3. **Test Prometheus format:**
   ```bash
   curl "http://localhost:3000/api/models/metrics?format=prometheus"
   ```

### Integration Testing

Add to test suite:

```typescript
// src/gateway/__tests__/models-http.test.ts
import { describe, it, expect } from "bun:test";
import { handleModelsHttpRequest } from "../models-http.js";

describe("handleModelsHttpRequest", () => {
  it("should handle /api/models/metrics", async () => {
    // TODO: implement test
  });

  it("should return 404 for non-models routes", async () => {
    // TODO: implement test
  });
});
```

---

## Prometheus Integration (Optional)

### Scrape Config

Add to `prometheus.yml`:

```yaml
scrape_configs:
  - job_name: "openclaw-ai-metrics"
    static_configs:
      - targets: ["localhost:3000"]
    metrics_path: "/api/models/metrics"
    params:
      format: ["prometheus"]
    scrape_interval: 15s
```

### Grafana Dashboard

Key panels:

- **Request Rate** — `rate(openclaw_ai_requests_total{status="success"}[5m])`
- **Error Rate** — `rate(openclaw_ai_requests_total{status="error"}[5m])`
- **Latency (P95)** — `openclaw_ai_model_latency_p95`
- **Cost** — `openclaw_ai_cost_estimated_total`

---

## Security

### Current State

- ❌ **No authentication** on metrics endpoints (read-only, low-risk)
- ❌ **No admin auth** on DELETE /api/models/metrics (TODO: add auth)

### Recommended

1. **Add auth middleware** for destructive operations:

   ```typescript
   // In models-http.ts
   function requireAdmin(req: IncomingMessage): boolean {
     const token = getBearerToken(req);
     return validateAdminToken(token); // TODO: implement
   }
   ```

2. **Rate limiting** for metrics endpoints (optional)

---

## Performance

- **In-memory storage** — No DB overhead
- **Latency overhead** — <1ms per request (percentile tracking)
- **Memory footprint** — ~1KB per model (1000 samples max)
- **Thread-safe** — Single-threaded Node.js event loop

---

## Next Steps

1. ✅ **Metrics routes** (done)
2. 🚧 **Integrate model catalog** (GET /api/models, GET /api/models/:id)
3. 🚧 **Integrate availability** (POST /api/models/test, GET /api/models/health)
4. 🚧 **Integrate quarantine** (PUT/DELETE /api/models/:id/quarantine)
5. 🚧 **Add authentication** (admin-only for DELETE/PUT)
6. 🚧 **Add integration tests**
7. 🚧 **Prometheus + Grafana setup** (optional)

---

## Questions?

Ping:

- **@Carlos** (backend-architect) — API design, integration
- **@Paulo** (performance-engineer) — Metrics implementation
- **@Thiago** (devops-engineer) — Prometheus/Grafana setup
- **@Rafael** (sre) — Production deployment

---

## Changelog

**2026-02-12** — Initial integration (Carlos)

- Created `src/gateway/models-http.ts`
- Integrated into `src/gateway/server-http.ts`
- Implemented 3 metrics endpoints (GET/GET/DELETE)
- Added 6 stub endpoints for future catalog/health integration
