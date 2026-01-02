# Clawdis Setup - Hetzner VM

## Bot Information
- **Telegram Bot**: @clawdis_med_bot
- **Allowed User ID**: 171050333 (@emmanuelem)
- **Claude Model**: anthropic/claude-opus-4-5

## Ports
| Service | Port |
|---------|------|
| Gateway WebSocket | 18789 |
| Node Bridge | 18790 |
| Browser Control | 18791 |
| Canvas Host | 18793 |

## File Locations
- **Config**: `~/.clawdis/clawdis.json`
- **OAuth credentials**: `~/.clawdis/credentials/oauth.json`
- **Logs**: `/tmp/clawdis/clawdis-YYYY-MM-DD.log`
- **Clawdis source**: `~/clawdis`
- **Systemd service**: `~/.config/systemd/user/clawdis.service`
- **Claude Code credentials**: `~/.claude/.credentials.json`

## OAuth Token Refresh

If the OAuth token expires, refresh it from Claude Code credentials:
```bash
# Extract from Claude Code and write to Clawdis format
cat ~/.claude/.credentials.json | python3 -c "
import json, sys
data = json.load(sys.stdin)['claudeAiOauth']
print(json.dumps({'anthropic': {
    'access_token': data['accessToken'],
    'refresh_token': data['refreshToken'],
    'expires_at': data['expiresAt']
}}, indent=2))
" > ~/.clawdis/credentials/oauth.json
chmod 600 ~/.clawdis/credentials/oauth.json
systemctl --user restart clawdis
```

## Service Management

```bash
# Check status
systemctl --user status clawdis

# Restart service
systemctl --user restart clawdis

# Stop service
systemctl --user stop clawdis

# View live logs
journalctl --user -u clawdis -f

# View recent logs
journalctl --user -u clawdis -n 100 --no-pager
```

## Telegram Commands
- `/status` - System health check
- `/new` or `/reset` - Reset conversation session
- `/think <level>` - Set thinking level (off|minimal|low|medium|high)
- `/verbose on|off` - Toggle verbose output

## Updating Clawdis

```bash
cd ~/clawdis
git pull
source ~/.nvm/nvm.sh
pnpm install
pnpm build
pnpm ui:build
systemctl --user restart clawdis
```

## Configuration

Current config (`~/.clawdis/clawdis.json`):
```json
{
  "gateway": {
    "mode": "local",
    "bind": "loopback"
  },
  "telegram": {
    "enabled": true,
    "botToken": "8528839953:AAF1EU7mS7Acdi9VE1DpAZ8uDpzFF_SaYkM",
    "allowFrom": [171050333]
  },
  "web": {
    "enabled": false
  }
}
```

## Node.js Environment

Node.js is installed via nvm. To use node/pnpm in a new shell:
```bash
source ~/.nvm/nvm.sh
```

---
Setup completed: 2026-01-01
