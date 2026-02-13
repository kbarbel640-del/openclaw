# Docker Entrypoint Fixes for Trusted-Proxy Authentication

## Summary

This directory contains fixes for critical Docker deployment bugs in the trusted-proxy authentication feature.

## Files

- **`entrypoint.sh`** - Fixed Docker entrypoint script
- **`Dockerfile`** - Updated Dockerfile with proper directory creation and dependencies
- **`README.md`** - This file

## Problems Fixed

### 1. Invalid JSON Array Generation ❌ → ✅

**Before (BROKEN):**

```bash
SUBNETS=$(ip -o -f inet addr show | grep -v "127.0.0.1" | awk '{print $4}' | tr ' ' '|')
# Output: "192.168.86.89/24 10.42.0.1/24"
# tr ' ' '|' produces: "192.168.86.89/24|10.42.0.1/24"
# Result in config: ["192.168.86.89/24"] ["10.42.0.1/24"] ← INVALID JSON!
```

**After (FIXED):**

```bash
SUBNETS=$(ip -o -f inet addr show | grep -v "127.0.0.1" | awk '{print $4}' | paste -sd ',' -)
JSON_ARRAY=$(echo "$SUBNETS" | jq -R 'split(",") | map(select(length > 0))')
# Output: ["192.168.86.89/24","10.42.0.1/24"] ← Valid JSON!
```

**Key changes:**

- `paste -sd ',' -` properly converts newlines to commas
- `jq` generates robust JSON arrays
- Result: Valid JSON that OpenClaw can parse

### 2. Permission Errors ❌ → ✅

**Before (BROKEN):**

```dockerfile
# Dockerfile
RUN useradd -m -d /claw -s /bin/bash claw
# Missing: mkdir -p /claw/.openclaw

# entrypoint.sh (runs config commands BEFORE chown)
su - claw -c "openclaw config set ..."  # ← Permission denied!
chown -R claw:claw /claw                # ← Too late!
```

**After (FIXED):**

```dockerfile
# Dockerfile
RUN useradd -m -d /claw -s /bin/bash claw && \
    mkdir -p /claw/workspace && \
    mkdir -p /claw/.openclaw && \
    chown -R claw:claw /claw

# entrypoint.sh (chown BEFORE config commands)
chown -R claw:claw /claw                # ← Runs first!
su - claw -c "openclaw config set ..."  # ← Now it works!
```

## Testing

### Build and Test

```bash
cd /claw/workspace/docker-fixes

# Build the image
docker build -t openclaw-trusted-proxy:fixed .

# Run with Docker Compose (requires Pomerium setup)
docker run -d \
  --name openclaw-gateway \
  -p 18789:18789 \
  -e POMERIUM_CLUSTER_DOMAIN=your-cluster.pomerium.app \
  -v openclaw-data:/claw/.openclaw \
  openclaw-trusted-proxy:fixed
```

### Expected Output (Success)

```
Detecting Docker networks...
Detected Docker networks: 192.168.86.89/24,10.42.0.1/24,172.17.0.1/16
Setting trustedProxies to: ["192.168.86.89/24","10.42.0.1/24","172.17.0.1/16"]
Updated gateway.trustedProxies. Restart the gateway to apply.
Configuring Control UI allowed origins for Pomerium cluster: your-cluster.pomerium.app
Starting OpenClaw Gateway...
[gateway] listening on ws://0.0.0.0:18789
```

### Verify Configuration

```bash
docker exec openclaw-gateway cat /claw/.openclaw/config.yaml
```

Should show:

```yaml
gateway:
  trustedProxies:
    - "192.168.86.89/24"
    - "10.42.0.1/24"
    - "172.17.0.1/16"
  auth:
    mode: "trusted-proxy"
    trustedProxy:
      userHeader: "x-pomerium-claim-email"
      requiredHeaders:
        - "x-pomerium-jwt-assertion"
```

## Dependencies

**Requires PR #1710:** Add trusted-proxy authentication mode

These fixes are specifically for Docker deployments of the trusted-proxy feature.

## Integration

These files should be added to the OpenClaw repository at:

- `docker/entrypoint.sh`
- `docker/Dockerfile.trusted-proxy`

Or create a new PR based on the `feat/trusted-proxy-auth` branch.

## Related Issues

- Main feature: PR #1710
- Docker deployment guide: (to be created)

---

**Status:** Ready for review and testing with Pomerium reverse proxy setup.
