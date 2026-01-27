# Security Hardening Guide

This guide covers security configuration for enterprise deployments.

## Authentication

### Gateway Authentication

Always enable authentication for production deployments:

```yaml
# config.yaml
gateway:
  auth:
    mode: token  # or "password"
    token: ${GATEWAY_TOKEN}  # Use environment variable
```

**Token vs Password:**
- **Token:** Preferred for API clients and automation
- **Password:** Suitable for interactive users

Generate a secure token:

```bash
openssl rand -base64 32
```

### Device Pairing

For remote access, use device pairing with cryptographic identity:

```yaml
gateway:
  auth:
    mode: token
    token: ${GATEWAY_TOKEN}
```

Paired devices receive a device token after approval, eliminating the need to share the gateway token.

### Tailscale Authentication

For zero-trust networking with Tailscale:

```yaml
gateway:
  auth:
    mode: tailscale
    allowTailscale: true
```

## Role-Based Access Control (RBAC)

Enable RBAC to restrict user permissions:

```yaml
rbac:
  enabled: true
  defaultRole: user  # Fallback for unassigned users

  roles:
    # Custom role for DevOps team
    devops:
      name: "DevOps Engineer"
      permissions:
        - exec           # Basic command execution
        - exec.elevated  # Sudo/admin commands
        - exec.approve   # Can approve exec requests
      agents:
        - main
        - deploy

    # Restricted role for support
    support:
      name: "Support Agent"
      permissions:
        - exec
      tools:
        deny:
          - bash
          - write

  assignments:
    "admin@company.com": admin
    "devops@company.com": devops
    "support@company.com": support
```

### Permission Levels

| Permission | Description |
|------------|-------------|
| `exec` | Execute basic commands |
| `exec.elevated` | Execute sudo/admin commands |
| `exec.approve` | Approve exec requests from agents |
| `admin` | Full access (grants all permissions) |
| `read-only` | View-only access, no tool execution |

### Tool Restrictions

Restrict specific tools per role:

```yaml
roles:
  limited:
    name: "Limited User"
    permissions: [exec]
    tools:
      allow:
        - read
        - search
        - glob
      deny:
        - bash
        - write
        - edit
```

## Audit Logging

All security-relevant events are logged to `~/.clawdbot/audit.jsonl`:

```yaml
# Audit logging is enabled by default
# Configure retention in gateway settings
gateway:
  audit:
    enabled: true
    retentionDays: 30  # Keep logs for 30 days
```

### Audited Events

| Event Type | Description |
|------------|-------------|
| `auth.login` | Successful authentication |
| `auth.failure` | Failed authentication attempt |
| `pairing.request` | Device pairing request |
| `pairing.approve` | Device pairing approved |
| `pairing.reject` | Device pairing rejected |
| `exec.request` | Command execution requested |
| `exec.approve` | Command execution approved |
| `exec.reject` | Command execution rejected |
| `rbac.denied` | RBAC permission denied |
| `config.change` | Configuration modified |

### Audit Log Format

Each entry is a JSON line:

```json
{
  "ts": "2024-01-15T10:30:00.000Z",
  "eventId": "550e8400-e29b-41d4-a716-446655440000",
  "type": "auth.login",
  "actor": {
    "type": "device",
    "id": "device-abc123",
    "remoteIp": "192.168.1.100"
  },
  "outcome": "success",
  "traceId": "4bf92f3577b34da6a3ce929d0e0e4736",
  "metadata": {
    "method": "device-token"
  }
}
```

### Querying Audit Logs

```bash
# Find all failed auth attempts
cat ~/.clawdbot/audit.jsonl | jq 'select(.type == "auth.failure")'

# Find RBAC denials for a user
cat ~/.clawdbot/audit.jsonl | jq 'select(.type == "rbac.denied" and .actor.id == "user@company.com")'

# Count events by type
cat ~/.clawdbot/audit.jsonl | jq -s 'group_by(.type) | map({type: .[0].type, count: length})'
```

## Rate Limiting

The gateway includes built-in rate limiting to prevent abuse:

```yaml
gateway:
  rateLimit:
    enabled: true
    windowMs: 60000      # 1 minute window
    maxRequests: 100     # Max requests per window
    maxConnections: 50   # Max concurrent WebSocket connections
```

### Pairing Rate Limits

Pairing attempts are rate-limited to prevent brute-force attacks:
- Maximum 10 attempts per minute per channel
- Automatic backoff on repeated failures

## TLS Configuration

### With Reverse Proxy (Recommended)

Terminate TLS at your reverse proxy (nginx, Caddy, Traefik):

```nginx
server {
    listen 443 ssl http2;
    server_name gateway.company.com;

    ssl_certificate /etc/ssl/certs/gateway.crt;
    ssl_certificate_key /etc/ssl/private/gateway.key;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256;
    ssl_prefer_server_ciphers on;
    ssl_session_cache shared:SSL:10m;

    # HSTS
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;

    location / {
        proxy_pass http://localhost:18789;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### Trusted Proxies

When behind a proxy, configure trusted proxy addresses:

```yaml
gateway:
  trustedProxies:
    - "127.0.0.1"
    - "10.0.0.0/8"
    - "172.16.0.0/12"
```

This ensures client IP addresses are correctly extracted from `X-Forwarded-For` headers.

## Command Execution Security

### Exec Approvals

Require human approval for dangerous commands:

```yaml
approvals:
  exec:
    enabled: true
    requireApproval:
      - elevated  # Require approval for sudo commands
      - destructive  # Require approval for rm, delete, etc.
    timeoutMs: 120000  # 2 minute timeout
```

### Sandbox Mode

Run commands in a restricted sandbox:

```yaml
tools:
  policy: sandbox  # Restrict file system access
```

### Command Blocklist

Block dangerous command patterns:

```yaml
tools:
  exec:
    blocklist:
      - "rm -rf /"
      - ":(){ :|:& };:"  # Fork bomb
      - "dd if=/dev/zero"
```

## Secrets Management

### Environment Variables

Store secrets in environment variables, not config files:

```yaml
# config.yaml - reference environment variables
gateway:
  auth:
    token: ${GATEWAY_TOKEN}

models:
  anthropic:
    apiKey: ${ANTHROPIC_API_KEY}
```

### Credential Storage

Channel credentials are stored with restricted permissions:
- Location: `~/.clawdbot/credentials/`
- Permissions: `0600` (owner read/write only)

Run security checks:

```bash
clawdbot doctor --check credentials
```

## Network Security

### Bind Address

Restrict which interfaces accept connections:

```yaml
gateway:
  # Localhost only (most secure)
  bind: "127.0.0.1"

  # All interfaces (for remote access)
  bind: "0.0.0.0"
```

### Firewall Rules

Minimal required firewall rules:

```bash
# Allow gateway port from trusted networks
iptables -A INPUT -p tcp --dport 18789 -s 10.0.0.0/8 -j ACCEPT
iptables -A INPUT -p tcp --dport 18789 -j DROP

# Allow outbound HTTPS for APIs
iptables -A OUTPUT -p tcp --dport 443 -j ACCEPT
```

## Security Checklist

### Pre-Production

- [ ] Enable gateway authentication (`gateway.auth.mode`)
- [ ] Configure RBAC with least-privilege roles
- [ ] Set up TLS termination
- [ ] Configure trusted proxies
- [ ] Enable audit logging
- [ ] Review rate limiting settings
- [ ] Remove default/test credentials

### Ongoing

- [ ] Rotate gateway tokens quarterly
- [ ] Review audit logs for anomalies
- [ ] Update to latest Clawdbot version
- [ ] Review RBAC assignments when team changes
- [ ] Test backup and recovery procedures

## Next Steps

- [Enterprise Deployment](/enterprise/deployment) - Deployment patterns
- [Observability](/enterprise/observability) - Monitoring and alerting
- [Gateway Security Reference](/gateway/security) - Detailed security documentation
