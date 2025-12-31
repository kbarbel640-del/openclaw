# Clawdis Bot DevOps Guide

## Overview

This guide covers the bulletproof deployment and monitoring setup for the Clawdis Telegram bot.

## Quick Status Check

```bash
./scripts/bot-status.sh
```

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    SYSTEMD SERVICE                          │
│  clawdis-gateway.service                                    │
│  ├── Restart=always (auto-restart on failure)              │
│  ├── RestartSec=10 (wait 10s between restarts)             │
│  ├── MemoryMax=2G / MemoryHigh=1G (memory limits)          │
│  └── StartLimitBurst=5/300s (prevent restart storm)        │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                    start-gateway.sh                         │
│  ├── Sets correct Node.js v22.21.1 PATH (fnm)              │
│  ├── Loads .env file                                       │
│  └── Starts gateway via pnpm                               │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                    GATEWAY PROCESS                          │
│  Port 18789: WebSocket gateway                             │
│  Port 18790: Bridge (TCP)                                  │
│  Port 18791: Browser control                               │
│  Port 18793: Canvas host                                   │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                    TELEGRAM BOT                             │
│  @Lana_smartai_bot ◄──► PROXY ◄──► Telegram API            │
│                     ◄──────────────► Z.ai API              │
└─────────────────────────────────────────────────────────────┘
```

## CRITICAL: Network Configuration

**This server CANNOT reach Telegram directly** - all TCP connections to Telegram IPs (149.154.x.x) get blocked. A proxy is REQUIRED.

### Required Configuration (`~/.clawdis/clawdis.json`)
```json
{
  "telegram": {
    "allowFrom": ["14835038"],
    "botToken": "YOUR_BOT_TOKEN",
    "proxy": "http://user205740:8f39bh@103.99.54.122:8019"
  }
}
```

### Token Must Be Set In 3 Places
1. `~/.clawdis/clawdis.json` - `telegram.botToken`
2. `/home/almaz/zoo_flow/clawdis/.env` - `TELEGRAM_BOT_TOKEN=`
3. `~/.clawdis/secrets.env` - `TELEGRAM_BOT_TOKEN=`

### Verify Network Connectivity
```bash
# Check if proxy connections are ESTABLISHED (not SYN-SENT)
ss -tnp | grep "103.99.54.122"

# If you see SYN-SENT to 149.154.x.x, proxy is NOT working:
ss -tnp | grep "149.154"  # Should be empty or via proxy

# Test Telegram API directly
curl -s "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/getMe"
```

## Deployment Steps

### 1. Update Systemd Service

```bash
# Copy the new bulletproof service file
sudo cp /home/almaz/zoo_flow/clawdis/clawdis-gateway.service /etc/systemd/system/

# Reload systemd
sudo systemctl daemon-reload

# Restart service
sudo systemctl restart clawdis-gateway

# Verify
sudo systemctl status clawdis-gateway
```

### 2. Enable Watchdog Cron Job

```bash
# Add to crontab (runs every 5 minutes)
(crontab -l 2>/dev/null; echo "*/5 * * * * /home/almaz/zoo_flow/clawdis/scripts/watchdog.sh") | crontab -

# Verify
crontab -l
```

### 3. Set Up Log Rotation (System-level)

```bash
sudo tee /etc/logrotate.d/clawdis << 'EOF'
/home/almaz/.clawdis/*.log {
    daily
    rotate 7
    compress
    delaycompress
    missingok
    notifempty
    create 0644 almaz almaz
    size 100M
}
EOF
```

## Monitoring Scripts

| Script | Purpose | Usage |
|--------|---------|-------|
| `bot-status.sh` | Full status dashboard | `./scripts/bot-status.sh` |
| `health-check.sh` | Quick health check | `./scripts/health-check.sh --verbose` |
| `watchdog.sh` | Auto-recovery (cron) | Runs automatically |

## Resilience Features

### 1. Node.js Version Fix
The `start-gateway.sh` script sets the correct PATH to ensure Node.js v22.21.1 is used:
```bash
export PATH="/home/almaz/.local/share/fnm/node-versions/v22.21.1/installation/bin:$PATH"
```

### 2. Systemd Restart Policy
- `Restart=always`: Restart on any failure
- `RestartSec=10`: Wait 10s between restarts
- `StartLimitBurst=5`: Max 5 restarts per 300s (prevents restart storm)

### 3. Watchdog Timer
- `WatchdogSec=60`: If process doesn't respond in 60s, systemd kills and restarts it

### 4. Resource Limits
- `MemoryMax=1G`: Hard memory limit
- `MemoryHigh=768M`: Soft limit (triggers throttling)
- `CPUQuota=80%`: CPU throttling

### 5. Security Hardening
- `NoNewPrivileges=true`: Prevent privilege escalation
- `PrivateTmp=true`: Isolated /tmp
- `ProtectSystem=strict`: Read-only filesystem
- `ProtectHome=read-only`: Protect home directory

## Stability Checklist (Bot Always Available)

### ✅ Pre-Flight Checks
```bash
# 1. Verify all 3 token locations match
grep TELEGRAM_BOT_TOKEN .env
grep botToken ~/.clawdis/clawdis.json
grep TELEGRAM_BOT_TOKEN ~/.clawdis/secrets.env

# 2. Verify proxy is configured
grep proxy ~/.clawdis/clawdis.json

# 3. Verify Node.js v22+
/home/almaz/.local/share/fnm/node-versions/v22.21.1/installation/bin/node --version

# 4. Check pending updates (should be 0 when healthy)
source .env && curl -s "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getWebhookInfo" | grep pending
```

### ✅ Network Health Indicators
| Indicator | Healthy | Unhealthy |
|-----------|---------|-----------|
| Proxy connections | `ESTAB` to 103.99.54.122 | None or `SYN-SENT` |
| Telegram direct | Empty or via proxy | `SYN-SENT` to 149.154.x.x |
| Pending updates | 0 | > 0 (not processing) |
| getMe API | `"ok":true` | `404` or timeout |

### ✅ Recovery Commands
```bash
# Quick restart (use this first)
sudo systemctl restart clawdis-gateway

# Force kill and restart
pkill -9 -f "clawdis gateway" && sleep 5 && sudo systemctl start clawdis-gateway

# Check if systemd restarted it automatically
systemctl status clawdis-gateway --no-pager | head -15
```

## Troubleshooting

### Bot Not Responding

1. **Check network first** (most common issue):
   ```bash
   ss -tnp | grep "103.99.54.122"  # Should see ESTABLISHED
   ss -tnp | grep "149.154"        # Should be empty
   ```

2. **If SYN-SENT to 149.154.x.x** - proxy not working:
   ```bash
   # Verify proxy in config
   grep proxy ~/.clawdis/clawdis.json
   # Restart to reload config
   sudo systemctl restart clawdis-gateway
   ```

3. **Check pending updates**:
   ```bash
   source .env && curl -s "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getWebhookInfo"
   ```
   - `pending_update_count: 0` = healthy
   - `pending_update_count: > 0` = not processing (restart needed)

4. **Check token validity**:
   ```bash
   source .env && curl -s "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getMe"
   ```
   - `"ok":true` = token valid
   - `404` = token revoked, get new token from @BotFather

5. Check status:
   ```bash
   ./scripts/bot-status.sh
   ```

6. Check logs:
   ```bash
   tail -50 /home/almaz/.clawdis/gateway-error.log
   ```

7. Restart manually:
   ```bash
   sudo systemctl restart clawdis-gateway
   ```

### High Memory Usage

1. Check process memory:
   ```bash
   ps aux | grep clawdis
   ```

2. If over 1GB, the service will auto-restart due to `MemoryMax=1G`

### Authentication Errors (401)

1. Verify API key is set:
   ```bash
   grep ANTHROPIC_API_KEY .env
   ```

2. Test API directly:
   ```bash
   source .env && curl -H "Authorization: Bearer $ANTHROPIC_API_KEY" \
     https://api.z.ai/api/anthropic/v1/models
   ```

### Node.js Version Issues

1. Verify correct Node.js:
   ```bash
   /home/almaz/.local/share/fnm/node-versions/v22.21.1/installation/bin/node --version
   # Should be v22.21.1
   ```

2. Check start script:
   ```bash
   cat scripts/start-gateway.sh | head -6
   # Should include PATH export
   ```

## Log Files

| File | Purpose |
|------|---------|
| `/home/almaz/.clawdis/gateway.log` | Main gateway output |
| `/home/almaz/.clawdis/gateway-error.log` | Error output |
| `/home/almaz/.clawdis/watchdog.log` | Watchdog activity |
| `/tmp/clawdis/clawdis-YYYY-MM-DD.log` | Daily session logs |

## Metrics to Monitor

- Process uptime (should be days/weeks)
- Memory usage (should be < 500MB normally)
- Restart count (check with `systemctl status`)
- Response time (check in Telegram)
- Error rate (grep error log)

## Emergency Recovery

If everything fails:

```bash
# Kill all processes
pkill -9 -f clawdis

# Clear logs (if disk full)
truncate -s 0 /home/almaz/.clawdis/*.log

# Start fresh
cd /home/almaz/zoo_flow/clawdis
source .env
./scripts/start-gateway.sh &

# Or restart via systemd
sudo systemctl restart clawdis-gateway
```
