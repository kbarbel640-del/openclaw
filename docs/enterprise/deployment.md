# Enterprise Deployment Guide

This guide covers deployment patterns for enterprise environments with multiple users, teams, and security requirements.

## Deployment Patterns

### Single-Tenant (Recommended for Teams)

A single gateway serves one team with shared configuration:

```
┌─────────────────────────────────────────┐
│              Gateway Host               │
│  ┌─────────────────────────────────┐   │
│  │         Moltbot Gateway        │   │
│  │  - All team channels            │   │
│  │  - Shared agent config          │   │
│  │  - Team-wide RBAC               │   │
│  └─────────────────────────────────┘   │
└─────────────────────────────────────────┘
         │           │           │
    ┌────┴───┐  ┌────┴───┐  ┌────┴───┐
    │ User A │  │ User B │  │ User C │
    └────────┘  └────────┘  └────────┘
```

**Configuration:**

```yaml
# config.yaml
gateway:
  port: 18789
  auth:
    mode: token
    token: ${GATEWAY_TOKEN}

rbac:
  enabled: true
  defaultRole: user
  assignments:
    "admin@company.com": admin
    "dev@company.com": operator
```

### Multi-Tenant (Isolated Teams)

Separate gateway instances per team for full isolation:

```
┌──────────────────┐  ┌──────────────────┐
│   Team A Host    │  │   Team B Host    │
│ ┌──────────────┐ │  │ ┌──────────────┐ │
│ │   Gateway A  │ │  │ │   Gateway B  │ │
│ │  Port 18789  │ │  │ │  Port 18790  │ │
│ └──────────────┘ │  │ └──────────────┘ │
└──────────────────┘  └──────────────────┘
        │                     │
   Team A Users          Team B Users
```

**Benefits:**
- Complete data isolation between teams
- Independent configuration and credentials
- Separate audit logs per team
- Different RBAC policies per team

**Setup:**

```bash
# Team A gateway
clawdbot config set gateway.port 18789
clawdbot config set gateway.auth.token "team-a-token"

# Team B gateway (different host or port)
clawdbot config set gateway.port 18790
clawdbot config set gateway.auth.token "team-b-token"
```

### Multi-Agent Routing

Route different users to different agents based on channel or identity:

```yaml
# config.yaml
agents:
  main:
    model: claude-sonnet-4-20250514
    system: "You are a general assistant."

  devops:
    model: claude-sonnet-4-20250514
    system: "You are a DevOps specialist."
    tools:
      policy: elevated

  support:
    model: claude-sonnet-4-20250514
    system: "You are a customer support agent."
    tools:
      policy: read-only

bindings:
  - channel: slack
    channelId: "devops-channel"
    agentId: devops

  - channel: telegram
    senderId: "support-team"
    agentId: support
```

### Per-User Agent Isolation

Give each user their own agent instance:

```yaml
# config.yaml
agents:
  template:
    model: claude-sonnet-4-20250514
    session:
      mode: persistent
      dir: ~/.clawdbot/sessions/${senderId}

bindings:
  - channel: "*"
    agentId: template
    sessionKey: "${channel}:${senderId}"
```

## Container Deployment

### Docker

```dockerfile
FROM node:22-alpine
RUN npm install -g clawdbot@latest
EXPOSE 18789
VOLUME /root/.clawdbot
CMD ["clawdbot", "gateway", "run", "--bind", "0.0.0.0"]
```

```yaml
# docker-compose.yaml
services:
  clawdbot:
    image: clawdbot:latest
    ports:
      - "18789:18789"
    volumes:
      - ./config:/root/.clawdbot
    environment:
      - ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY}
      - GATEWAY_TOKEN=${GATEWAY_TOKEN}
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:18789/health"]
      interval: 30s
      timeout: 10s
      retries: 3
```

### Kubernetes

```yaml
# deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: clawdbot-gateway
spec:
  replicas: 1
  selector:
    matchLabels:
      app: clawdbot
  template:
    metadata:
      labels:
        app: clawdbot
    spec:
      containers:
        - name: gateway
          image: clawdbot:latest
          ports:
            - containerPort: 18789
          env:
            - name: ANTHROPIC_API_KEY
              valueFrom:
                secretKeyRef:
                  name: clawdbot-secrets
                  key: anthropic-api-key
          livenessProbe:
            httpGet:
              path: /health
              port: 18789
            initialDelaySeconds: 10
            periodSeconds: 30
          readinessProbe:
            httpGet:
              path: /ready
              port: 18789
            initialDelaySeconds: 5
            periodSeconds: 10
          volumeMounts:
            - name: config
              mountPath: /root/.clawdbot
      volumes:
        - name: config
          configMap:
            name: clawdbot-config
```

```yaml
# service.yaml
apiVersion: v1
kind: Service
metadata:
  name: clawdbot
  annotations:
    prometheus.io/scrape: "true"
    prometheus.io/port: "18789"
    prometheus.io/path: "/metrics"
spec:
  selector:
    app: clawdbot
  ports:
    - port: 18789
      targetPort: 18789
```

## High Availability

### Load Balancing Considerations

Moltbot gateway is stateful (WebSocket connections, session state). For HA:

1. **Sticky sessions** - Route users to the same instance
2. **Shared state** - Use external session storage (future feature)
3. **Active-passive** - Run standby instance for failover

### Health Endpoints

Configure your load balancer to use:

- **Liveness:** `GET /health` - Returns 200 if process is alive
- **Readiness:** `GET /ready` - Returns 200 if channels are connected

### Graceful Shutdown

The gateway handles SIGTERM gracefully:
1. Stops accepting new connections
2. Completes in-flight requests
3. Closes WebSocket connections cleanly
4. Flushes audit logs

## Network Configuration

### Firewall Rules

| Port | Direction | Purpose |
|------|-----------|---------|
| 18789 | Inbound | Gateway WebSocket/HTTP |
| 443 | Outbound | Anthropic API, channel APIs |

### Reverse Proxy

With nginx:

```nginx
upstream clawdbot {
    server localhost:18789;
}

server {
    listen 443 ssl;
    server_name gateway.company.com;

    ssl_certificate /etc/ssl/certs/gateway.crt;
    ssl_certificate_key /etc/ssl/private/gateway.key;

    location / {
        proxy_pass http://clawdbot;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 86400;
    }
}
```

Configure trusted proxies in Moltbot:

```yaml
gateway:
  trustedProxies:
    - "10.0.0.0/8"
    - "172.16.0.0/12"
    - "192.168.0.0/16"
```

## Environment Variables

| Variable | Description |
|----------|-------------|
| `ANTHROPIC_API_KEY` | API key for Claude models |
| `GATEWAY_TOKEN` | Gateway authentication token |
| `CLAWDBOT_CONFIG_PATH` | Custom config file path |
| `CLAWDBOT_STATE_DIR` | State directory (sessions, logs) |
| `LOG_LEVEL` | Logging verbosity (debug, info, warn, error) |

## Backup and Recovery

### Critical Data

| Path | Description | Backup Priority |
|------|-------------|-----------------|
| `~/.clawdbot/config.yaml` | Configuration | High |
| `~/.clawdbot/credentials/` | Channel tokens, pairing | High |
| `~/.clawdbot/sessions/` | Session history | Medium |
| `~/.clawdbot/audit.jsonl` | Audit logs | High |

### Backup Script

```bash
#!/bin/bash
BACKUP_DIR="/backups/clawdbot/$(date +%Y%m%d)"
mkdir -p "$BACKUP_DIR"

# Config and credentials (encrypted)
tar -czf "$BACKUP_DIR/config.tar.gz" \
  ~/.clawdbot/config.yaml \
  ~/.clawdbot/credentials/

# Audit logs
cp ~/.clawdbot/audit*.jsonl "$BACKUP_DIR/"

# Retain 30 days
find /backups/clawdbot -mtime +30 -delete
```

## Next Steps

- [Security Hardening](/enterprise/security-hardening) - TLS, rate limiting, audit configuration
- [Observability](/enterprise/observability) - Metrics, tracing, dashboards
- [Gateway Configuration](/gateway/configuration) - Full configuration reference
