# @openclaw/gateway-alias

Hostname-based reverse proxy for multi-gateway OpenClaw setups.

Access your gateways by name instead of port number:

```
http://hal  →  localhost:18789
http://sam  →  localhost:19789
```

No more remembering port numbers.

## Quick Start

### 1. Install & enable

```bash
openclaw plugins enable gateway-alias
```

### 2. Configure aliases

Add to your OpenClaw config (`~/.openclaw/openclaw.json`):

```json
{
  "plugins": {
    "entries": {
      "gateway-alias": {
        "enabled": true,
        "config": {
          "aliases": {
            "hal": 18789,
            "sam": 19789
          }
        }
      }
    }
  }
}
```

Or via CLI:

```bash
openclaw config set plugins.entries.gateway-alias.config.aliases '{"hal": 18789, "sam": 19789}'
```

### 3. Run setup (one-time, requires sudo)

```bash
sudo openclaw gateway-alias setup
```

This does three things:

1. Adds hostname entries to `/etc/hosts` (`127.0.0.1  hal`, etc.)
2. Configures port forwarding (macOS pfctl / Linux iptables) so port 80 routes to the proxy
3. (macOS) Installs a LaunchDaemon to persist pfctl rules across reboots

### 4. Restart the gateway

```bash
openclaw gateway restart
```

Now open `http://hal` in your browser. Done.

## Configuration

| Key           | Type      | Default       | Description                                 |
| ------------- | --------- | ------------- | ------------------------------------------- |
| `aliases`     | `object`  | `{}`          | Map of hostname → gateway port              |
| `port`        | `integer` | `80`          | Port the reverse proxy listens on           |
| `bind`        | `string`  | `"127.0.0.1"` | Bind address for the proxy                  |
| `manageHosts` | `boolean` | `true`        | Auto-manage `/etc/hosts` entries on startup |

### Port considerations

- **Port 80** (default): Requires the one-time `sudo openclaw gateway-alias setup` to configure port forwarding. The proxy itself runs unprivileged on port 80 after pfctl/iptables redirects traffic.
- **Port > 1024**: No setup needed, but you'll need to include the port in URLs (`http://hal:8080`).

## Commands

### Slash command

```
/aliases
```

Shows configured aliases in chat.

### CLI

```bash
# One-time setup (hosts + port forwarding)
sudo openclaw gateway-alias setup

# Show status
openclaw gateway-alias status
```

## How It Works

The plugin registers a background service that starts an HTTP reverse proxy when the gateway boots. The proxy:

1. Listens on the configured port (default: 80)
2. Routes incoming requests by `Host` header to the matching gateway port
3. Supports both HTTP requests and WebSocket upgrades (needed for the OpenClaw control UI)
4. Preserves the original `Host` header via `X-Forwarded-Host`

```
Browser → http://hal → proxy (:80) → gateway (:18789)
Browser → http://sam → proxy (:80) → gateway (:19789)
```

## Adding More Agents

When you spin up a new agent:

1. Add its alias to the config:
   ```json
   "aliases": {
     "hal": 18789,
     "sam": 19789,
     "eve": 20789
   }
   ```
2. Add to `/etc/hosts`: `127.0.0.1  eve`
3. Restart the gateway

Or just re-run `sudo openclaw gateway-alias setup` — it updates `/etc/hosts` from the config.

## Platform Support

| Platform | /etc/hosts | Port forwarding | Persistence                      |
| -------- | ---------- | --------------- | -------------------------------- |
| macOS    | ✓          | pfctl           | LaunchDaemon                     |
| Linux    | ✓          | iptables        | Manual (use iptables-persistent) |
| Windows  | —          | —               | Not yet supported                |

## Uninstall

To remove the plugin's system changes:

1. Remove the hosts block from `/etc/hosts` (between `# >>> openclaw-gateway-alias` and `# <<< openclaw-gateway-alias`)
2. (macOS) `sudo launchctl unload /Library/LaunchDaemons/com.openclaw.gateway-alias.plist`
3. (macOS) Remove pfctl anchor from `/etc/pf.conf`
4. Disable the plugin: `openclaw plugins disable gateway-alias`
