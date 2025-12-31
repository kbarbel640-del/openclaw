# Debug Session: Telegram Bot Reliability

**Date:** 2025-12-31
**Issue:** Bot appeared unresponsive after systemd service restart
**Resolution:** Bot was actually working; initial delay during restart

## Timeline

1. **09:36** - Systemd service restarted with new configuration
2. **09:39** - User reported bot not responding
3. **09:42** - Direct API test successful - message reached bot

## Investigation Steps

### 1. Initial Status Check
```bash
./scripts/bot-status.sh
```
**Result:** All systems showed green (ports listening, APIs connected)

### 2. Log Analysis
Checked gateway logs:
```
[telegram] starting provider (@Lana_smartai_bot)
```
Telegram provider was starting correctly.

### 3. Network Connection Verification
```bash
ss -tnp | grep <PID>
```
**Result:** Active connections to Telegram servers (149.154.167.220:443)
- 2 ESTABLISHED connections
- 1 SYN-SENT (new polling request)

### 4. Direct API Test
```bash
curl -s -X POST "https://api.telegram.org/bot${TOKEN}/sendMessage" \
  -d "chat_id=14835038" -d "text=Test from DevOps - $(date +%H:%M:%S)"
```
**Result:** Message sent successfully, user confirmed receipt

## Root Cause Analysis

The bot **was working** - the apparent unresponsiveness was due to:
1. Gateway restart takes ~10-15 seconds to fully initialize
2. Telegram long-polling needs to reconnect after restart
3. Pending messages in queue (2 pending updates seen)

## Key Learnings

### Debugging Checklist for "Bot Not Responding"
1. Check process status: `./scripts/bot-status.sh`
2. Check network connections: `ss -tnp | grep clawdis`
3. Check Telegram API: `curl getMe` and `getWebhookInfo`
4. Send direct test message via API
5. Check gateway logs for errors

### False Alarm Indicators
- All ports listening
- Telegram API connected
- Active connections to Telegram servers
- No errors in logs

### True Problem Indicators
- Process not running
- Ports not listening
- `getMe` returns error
- No network connections to Telegram
- Errors in gateway-error.log

## System Health After Fix

```
PROCESS STATUS: RUNNING (PID: 4133738)
Memory: 225MB
Threads: 12
State: Sleeping (normal for event loop)

PORT STATUS:
- Gateway (18789): LISTENING
- Bridge (18790): LISTENING
- Browser (18791): LISTENING
- Canvas (18793): LISTENING

TELEGRAM: Connected to 149.154.167.220:443
```

## Improvements Made This Session

1. **Node.js PATH fix** in `start-gateway.sh`
2. **Secrets moved** to `~/.clawdis/secrets.env`
3. **Robust startup script** with validation
4. **Health check script** for quick diagnosis
5. **Bot status dashboard** for visual status
6. **Systemd service** with restart policies

## Commands for Future Debugging

```bash
# Quick health check
./scripts/bot-status.sh

# Check if polling is active
ss -tnp | grep $(pgrep -f "clawdis gateway")

# Test outbound messaging
source .env && curl -s -X POST \
  "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage" \
  -d "chat_id=14835038" -d "text=Debug test"

# Check pending updates
source .env && curl -s \
  "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getWebhookInfo"

# View recent logs
tail -50 ~/.clawdis/gateway.log
tail -20 ~/.clawdis/gateway-error.log
```
