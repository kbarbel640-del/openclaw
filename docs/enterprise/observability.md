# Observability Guide

This guide covers monitoring, metrics, tracing, and alerting for enterprise deployments.

## Health Endpoints

The gateway exposes HTTP health endpoints for container orchestration:

### Liveness Probe

```
GET /health
```

Returns `200 OK` if the gateway process is alive:

```json
{
  "status": "healthy",
  "version": "2024.1.15",
  "uptimeMs": 3600000
}
```

### Readiness Probe

```
GET /ready
```

Returns `200 OK` if channels are connected and ready:

```json
{
  "status": "healthy",
  "checks": {
    "channels": {
      "telegram": "connected",
      "discord": "connected",
      "slack": "degraded"
    }
  }
}
```

Returns `503 Service Unavailable` if critical channels are down.

### Deep Health Check

```
GET /health/deep
Authorization: Bearer <gateway-token>
```

Returns detailed system status (requires authentication):

```json
{
  "status": "healthy",
  "version": "2024.1.15",
  "uptimeMs": 3600000,
  "checks": {
    "channels": {
      "telegram": { "status": "connected", "latencyMs": 45 },
      "discord": { "status": "connected", "latencyMs": 62 }
    },
    "memory": {
      "heapUsed": 128000000,
      "heapTotal": 256000000,
      "rss": 312000000
    }
  }
}
```

### Kubernetes Configuration

```yaml
livenessProbe:
  httpGet:
    path: /health
    port: 18789
  initialDelaySeconds: 10
  periodSeconds: 30
  failureThreshold: 3

readinessProbe:
  httpGet:
    path: /ready
    port: 18789
  initialDelaySeconds: 5
  periodSeconds: 10
  failureThreshold: 2
```

## Prometheus Metrics

The gateway exposes Prometheus metrics at `/metrics`:

```
GET /metrics
Authorization: Bearer <gateway-token>
```

### Available Metrics

#### Token Usage

```prometheus
# Total tokens used
clawdbot_tokens_total{type="input"} 125000
clawdbot_tokens_total{type="output"} 45000
clawdbot_tokens_total{type="cache_read"} 80000
clawdbot_tokens_total{type="cache_write"} 15000
```

#### Cost Tracking

```prometheus
# Total cost in USD
clawdbot_cost_usd_total{channel="telegram",provider="anthropic",model="claude-sonnet-4-20250514"} 1.25
```

#### Message Processing

```prometheus
# Messages processed
clawdbot_message_processed_total{channel="telegram",outcome="completed"} 500
clawdbot_message_processed_total{channel="telegram",outcome="error"} 5

# Message processing duration
clawdbot_message_duration_seconds_bucket{channel="telegram",le="1"} 450
clawdbot_message_duration_seconds_bucket{channel="telegram",le="5"} 495
clawdbot_message_duration_seconds_bucket{channel="telegram",le="30"} 500
```

#### Webhooks

```prometheus
# Webhook events
clawdbot_webhook_received_total{channel="telegram"} 1000
clawdbot_webhook_processed_total{channel="telegram"} 995
clawdbot_webhook_error_total{channel="telegram"} 5
```

#### Sessions

```prometheus
# Active sessions by state
clawdbot_session_state{state="idle"} 10
clawdbot_session_state{state="processing"} 2
clawdbot_session_state{state="waiting"} 1
```

#### Queue

```prometheus
# Queue depth
clawdbot_queue_depth{lane="default"} 3
```

#### System

```prometheus
# Gateway uptime
clawdbot_gateway_uptime_seconds 3600
```

### Prometheus Configuration

```yaml
# prometheus.yml
scrape_configs:
  - job_name: 'clawdbot'
    static_configs:
      - targets: ['gateway-host:18789']
    bearer_token: '<gateway-token>'
    metrics_path: '/metrics'
```

### Grafana Dashboard

Import this dashboard for key metrics:

```json
{
  "title": "Clawdbot Gateway",
  "panels": [
    {
      "title": "Token Usage Rate",
      "type": "graph",
      "targets": [
        {
          "expr": "rate(clawdbot_tokens_total[5m])",
          "legendFormat": "{{type}}"
        }
      ]
    },
    {
      "title": "Message Throughput",
      "type": "graph",
      "targets": [
        {
          "expr": "rate(clawdbot_message_processed_total[5m])",
          "legendFormat": "{{channel}} - {{outcome}}"
        }
      ]
    },
    {
      "title": "Cost per Hour",
      "type": "stat",
      "targets": [
        {
          "expr": "increase(clawdbot_cost_usd_total[1h])"
        }
      ]
    },
    {
      "title": "Active Sessions",
      "type": "gauge",
      "targets": [
        {
          "expr": "sum(clawdbot_session_state)"
        }
      ]
    }
  ]
}
```

## Distributed Tracing

The gateway supports W3C Trace Context for distributed tracing.

### Trace ID Propagation

All requests include a trace ID that flows through:
- Audit logs (`traceId` field)
- Diagnostic events
- Console/file logs
- Outgoing HTTP requests

### Log Correlation

Trace IDs appear in logs for correlation:

```
[gateway] [a1b2c3d4] Processing message from telegram
[agent] [a1b2c3d4] Invoking claude-sonnet-4-20250514
[gateway] [a1b2c3d4] Message completed in 2.3s
```

### Audit Log Correlation

Query audit logs by trace ID:

```bash
cat ~/.clawdbot/audit.jsonl | jq 'select(.traceId == "4bf92f3577b34da6a3ce929d0e0e4736")'
```

### OpenTelemetry Integration

For full APM integration, use the diagnostics-otel extension:

```yaml
plugins:
  diagnostics-otel:
    enabled: true
    endpoint: "http://otel-collector:4317"
```

This exports:
- Traces to your APM (Jaeger, Zipkin, Datadog, etc.)
- Metrics in OTLP format
- Logs with trace correlation

## Logging

### Log Levels

Configure log verbosity:

```yaml
logging:
  level: info  # trace, debug, info, warn, error, silent
  console:
    level: warn  # Separate console level
    style: pretty  # pretty, compact, json
```

### Structured Logging

JSON log format for log aggregation:

```yaml
logging:
  console:
    style: json
```

Output:

```json
{"time":"2024-01-15T10:30:00.000Z","level":"info","subsystem":"gateway","message":"Gateway started","traceId":"a1b2c3d4"}
```

### Log Files

Logs are written to `~/.clawdbot/logs/`:

```
~/.clawdbot/logs/
├── clawdbot.log        # Current log
├── clawdbot.1.log      # Rotated logs
└── clawdbot.2.log
```

### Log Aggregation

Ship logs to your aggregation system:

**Filebeat:**
```yaml
filebeat.inputs:
  - type: log
    paths:
      - /root/.clawdbot/logs/*.log
    json.keys_under_root: true
    json.add_error_key: true

output.elasticsearch:
  hosts: ["elasticsearch:9200"]
```

**Fluentd:**
```
<source>
  @type tail
  path /root/.clawdbot/logs/*.log
  pos_file /var/log/fluentd/clawdbot.pos
  tag clawdbot
  <parse>
    @type json
  </parse>
</source>
```

## Alerting

### Prometheus Alerting Rules

```yaml
# alerts.yml
groups:
  - name: clawdbot
    rules:
      - alert: ClawdbotDown
        expr: up{job="clawdbot"} == 0
        for: 1m
        labels:
          severity: critical
        annotations:
          summary: "Clawdbot gateway is down"

      - alert: HighErrorRate
        expr: rate(clawdbot_message_processed_total{outcome="error"}[5m]) > 0.1
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "High message error rate"

      - alert: ChannelDisconnected
        expr: clawdbot_channel_connected == 0
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "Channel {{ $labels.channel }} disconnected"

      - alert: HighCostRate
        expr: increase(clawdbot_cost_usd_total[1h]) > 10
        for: 1m
        labels:
          severity: info
        annotations:
          summary: "High API cost in last hour: ${{ $value }}"
```

### Key Metrics to Monitor

| Metric | Alert Threshold | Severity |
|--------|-----------------|----------|
| Gateway uptime | Down > 1m | Critical |
| Message error rate | > 10% | Warning |
| Channel disconnected | > 5m | Warning |
| Hourly cost | > $10 | Info |
| Queue depth | > 100 | Warning |
| Processing latency p99 | > 30s | Warning |

## Diagnostic Events

The gateway emits real-time diagnostic events for monitoring:

```typescript
// Subscribe to diagnostic events
import { onDiagnosticEvent } from 'clawdbot/diagnostic-events';

onDiagnosticEvent((event) => {
  console.log(event.type, event);
});
```

### Event Types

| Event | Description |
|-------|-------------|
| `model.usage` | Token usage and cost |
| `webhook.received` | Incoming webhook |
| `webhook.processed` | Webhook processing complete |
| `webhook.error` | Webhook processing error |
| `message.queued` | Message added to queue |
| `message.processed` | Message processing complete |
| `session.state` | Session state change |
| `session.stuck` | Session stuck detection |
| `diagnostic.heartbeat` | Periodic status summary |

## Troubleshooting

### Common Issues

**No metrics at /metrics:**
- Check authentication header
- Verify `gateway.metrics.enabled: true`

**Missing trace IDs:**
- Ensure requests flow through the gateway
- Check log format includes trace context

**High memory usage:**
- Review session retention settings
- Check for stuck sessions
- Monitor queue depth

### Debug Commands

```bash
# Check gateway health
curl -s http://localhost:18789/health | jq

# View recent audit events
tail -100 ~/.clawdbot/audit.jsonl | jq

# Check channel status
clawdbot channels status --deep

# View diagnostic events
clawdbot gateway events --follow
```

## Next Steps

- [Enterprise Deployment](/enterprise/deployment) - Deployment patterns
- [Security Hardening](/enterprise/security-hardening) - Security configuration
- [Gateway Troubleshooting](/gateway/troubleshooting) - Detailed troubleshooting
