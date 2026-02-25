---
summary: "Operator preflight checklist for upgrading to v2026.2.24"
title: "Upgrade checklist: v2026.2.24"
---

# Upgrade checklist: v2026.2.24

Use this when upgrading from **v2026.2.23 → v2026.2.24**.

## Why this checklist exists

v2026.2.24 includes two behavior changes that can affect existing installs:

1. **Heartbeat delivery now blocks direct/DM destinations** (heartbeats still run, but DM sends are skipped).
2. **Sandbox Docker `network: "container:<id>"` is blocked by default** unless you opt in with a break-glass flag.

Related (from the recent SSRF migration window):

- `browser.ssrfPolicy.allowPrivateNetwork` is a legacy alias; canonical key is `browser.ssrfPolicy.dangerouslyAllowPrivateNetwork`.

## Pre-upgrade checks

### 1) Confirm current version and config snapshot

```bash
openclaw --version
cp ~/.openclaw/openclaw.json ~/.openclaw/openclaw.json.pre-v2026.2.24.bak
```

### 2) Heartbeat delivery target audit (DM block)

Check heartbeat targets (global + per-agent overrides):

```bash
openclaw config get agents.defaults.heartbeat
openclaw config get agents.list
```

What to verify:

- If you rely on heartbeat messages landing in DMs (`user:<id>`, Telegram user IDs, WhatsApp direct IDs/JIDs), that delivery will now be blocked.
- Prefer non-DM destinations (channels/groups) for heartbeat notifications.
- `target: "none"` is now the safe default for internal-only heartbeat processing.

### 3) Sandbox Docker network audit (namespace-join block)

Find any container namespace joins:

```bash
openclaw config get agents.defaults.sandbox.docker
openclaw config get agents.list
```

Look for:

- `sandbox.docker.network: "container:<id>"`

If present, decide explicitly:

- **Preferred:** move to `bridge` or a dedicated network.
- **Only if intentional (break-glass):** set
  `sandbox.docker.dangerouslyAllowContainerNamespaceJoin: true`.

### 4) SSRF key migration sanity check

Run doctor migration and verify canonical key:

```bash
openclaw doctor --fix
openclaw config get browser.ssrfPolicy
```

What to verify:

- Prefer `browser.ssrfPolicy.dangerouslyAllowPrivateNetwork`.
- Legacy `allowPrivateNetwork` should not be the long-term key in your config.

## Post-upgrade verification

```bash
openclaw gateway restart
openclaw health
openclaw system heartbeat last
```

Confirm:

- Gateway is healthy after restart.
- Heartbeat runs still execute.
- If heartbeat destination is DM-like, delivery is skipped (expected).
- If using sandbox Docker networking, no new startup validation errors are raised.

## Rollback

If needed:

```bash
npm i -g openclaw@2026.2.23
openclaw doctor
openclaw gateway restart
```

See also: [Updating](/install/updating)
