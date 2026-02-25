---
name: govee
description: Controls Govee smart lights via Cloud API. Use when turning lights on/off, setting brightness, color, or temperature.
invocation: user
---

# Govee Light Control Skill

Control Govee smart lights in the honklab via the Cloud API.

## Quick Reference

| Command               | Description                 |
| --------------------- | --------------------------- |
| `govee list`          | List all devices            |
| `govee on [device]`   | Turn on light               |
| `govee off [device]`  | Turn off light              |
| `govee brightness 50` | Set to 50% brightness       |
| `govee color 255 0 0` | Set to red (RGB)            |
| `govee temp 4000`     | Set warm white (2000-9000K) |
| `govee status`        | Get current state           |

## Devices

| Name       | Model | MAC                     |
| ---------- | ----- | ----------------------- |
| H6003_0e0c | H6003 | e5:c4:d4:ad:fc:08:0e:0c |
| H6003_8d75 | H6003 | f9:a4:7c:a6:b0:c1:8d:75 |
| H6003_992e | H6003 | c4:57:d4:ad:fc:08:99:2e |

## Setup

1. **API Key**: Stored in 1Password (Agents vault) as `Govee API` with field `credential`
   - Or set `GOVEE_API_KEY` environment variable
2. **Get API Key**: Govee App → Settings → About Us → Apply for API Key

## Device Selection

Commands accept an optional device name (partial match):

```bash
govee on bedroom      # Turn on device with "bedroom" in name
govee off             # Turn off first device
govee color 0 255 0 office  # Set office light to green
```

## Notes

- H6003 uses **Cloud API only** (no LAN control)
- Commands require internet connectivity
- Device list is cached for 5 minutes; use `govee refresh` to clear

## Troubleshooting

```bash
# Check API key is working
govee list

# Force refresh device cache
govee refresh

# Check device state
govee status
```
