---
name: eightctl
description: Use when you need to control Eight Sleep pods via the eightctl CLI, e.g., to adjust temperature, manage alarms, or check pod status.
homepage: https://eightctl.sh
metadata:
  openclaw:
    emoji: 🎛️
    requires:
      bins: ["eightctl"]
    install:
      - id: go
        kind: go
        module: github.com/steipete/eightctl/cmd/eightctl@latest
        bins: ["eightctl"]
        label: "Install eightctl (go)"
---

# eightctl

Use `eightctl` for Eight Sleep pod control. Requires auth.

Auth

- Config: `~/.config/eightctl/config.yaml`
- Env: `EIGHTCTL_EMAIL`, `EIGHTCTL_PASSWORD`

Quick start

- `eightctl status`
- `eightctl on|off`
- `eightctl temp 20`

Common tasks

- Alarms: `eightctl alarm list|create|dismiss`
- Schedules: `eightctl schedule list|create|update`
- Audio: `eightctl audio state|play|pause`
- Base: `eightctl base info|angle`

Notes

- API is unofficial and rate-limited; avoid repeated logins.
- Confirm before changing temperature or alarms.