---
name: findmy
description: Locate Cole's Apple devices using Find My via pyicloud on the Mac Mini. Use when asked to find a device, check phone location/battery, or locate anything Apple.
metadata: { "openclaw": { "emoji": "📍" } }
---

# Find My Devices

## Overview

Query Apple Find My device locations by SSHing into Cole's Mac Mini and running pyicloud. Returns device names, locations (lat/lon), and battery levels.

## Requirements

- SSH key access to `coletebou@100.120.154.29` (Mac Mini on Tailscale)
- Key at `/root/.ssh/id_ed25519` — **unsandboxed agents only**
- pyicloud installed on the Mac (`/Library/Developer/CommandLineTools/usr/bin/python3`)
- Cached iCloud session for `coletebou@gmail.com` (already authenticated)

## Usage

```bash
python3 /opt/openclaw/skills/findmy/scripts/find_my_devices.py
```

### Options

- `--json` — Output raw JSON (for programmatic use)
- No flags — Human-readable output with names, locations, battery

### Example output

```
Future Fone (iPhone 15 Pro): 39.043, -77.112 | Battery: 62%
Cole's Apple Watch (Apple Watch Ultra 2): 39.043, -77.112 | Battery: 87%
Cole's Mac mini (Mac mini (2024)): 39.049, -77.107 | Battery: 0%
```

## Limitations

- **Only Cole's own devices** — Find My Friends (other people's locations) is not available via the iCloud web API. Apple deprecated it.
- **Unsandboxed agents only** — Requires SSH key at `/root/.ssh/id_ed25519`. Sandboxed agents in Docker cannot access this.
- Some devices (old iPhones, iPods, iPads not in use) will show "No location".

## Reverse Geocoding

The script returns raw lat/lon. To make it human-readable, use a web search or geocoding service to convert coordinates to an address/neighborhood.
