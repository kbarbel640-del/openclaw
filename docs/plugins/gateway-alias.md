---
title: "Gateway Alias"
description: "Hostname-based reverse proxy for multi-gateway setups"
---

# Gateway Alias Plugin

Access your OpenClaw gateways by friendly hostnames instead of port numbers.

```
http://hal  →  localhost:18789
http://sam  →  localhost:19789
```

Perfect for multi-agent setups where each agent has its own gateway.

## Install

The plugin ships bundled with OpenClaw. Enable it:

```bash
openclaw plugins enable gateway-alias
```

## Configure

Add aliases to your config:

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

Each key is a hostname, each value is the target gateway port.

## One-Time Setup

The plugin needs two system-level changes that require elevated privileges:

1. `/etc/hosts` entries so your machine resolves the hostnames
2. Port forwarding so port 80 reaches the proxy

Run once:

```bash
sudo openclaw gateway-alias setup
```

Then restart the gateway:

```bash
openclaw gateway restart
```

## Config Reference

| Key           | Type      | Default       | Description                      |
| ------------- | --------- | ------------- | -------------------------------- |
| `aliases`     | `object`  | `{}`          | Hostname → gateway port mapping  |
| `port`        | `integer` | `80`          | Proxy listen port                |
| `bind`        | `string`  | `"127.0.0.1"` | Proxy bind address               |
| `manageHosts` | `boolean` | `true`        | Auto-manage `/etc/hosts` entries |

## How It Works

The plugin starts a lightweight HTTP reverse proxy as a background service.
It routes requests by `Host` header to the matching gateway, supporting both
regular HTTP and WebSocket upgrades (needed for the control UI).

On startup, the proxy also attempts to update `/etc/hosts` (requires write
access). If it lacks privileges, it logs a warning and continues — the
`setup` command handles the privileged work.

### Port Forwarding

Port 80 requires elevated privileges. The `setup` command configures:

- **macOS**: `pfctl` redirect (lo0) + LaunchDaemon for persistence
- **Linux**: `iptables` NAT redirect (manual persistence via iptables-persistent)

## Commands

Chat command:

```
/aliases
```

CLI:

```bash
sudo openclaw gateway-alias setup   # One-time system setup
openclaw gateway-alias status        # Show configured aliases
```

## Adding Agents

When spinning up a new agent, add its alias to the config and re-run setup:

```bash
openclaw config set plugins.entries.gateway-alias.config.aliases \
  '{"hal": 18789, "sam": 19789, "eve": 20789}'
sudo openclaw gateway-alias setup
openclaw gateway restart
```

## Uninstall

Remove system changes:

```bash
# macOS
sudo launchctl unload /Library/LaunchDaemons/com.openclaw.gateway-alias.plist
sudo rm /Library/LaunchDaemons/com.openclaw.gateway-alias.plist
sudo rm /etc/pf.anchors/com.openclaw.gateway-alias

# All platforms: remove the hosts block
# (between "# >>> openclaw-gateway-alias" and "# <<< openclaw-gateway-alias" in /etc/hosts)

# Disable the plugin
openclaw plugins disable gateway-alias
```
