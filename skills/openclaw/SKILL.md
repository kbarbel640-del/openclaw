---
name: openclaw
description: Set up or harden OpenClaw (formerly Clawdbot) for distributed use (gateway + agents), including OpenAI Codex subscription auth, WhatsApp provider, Gmail Pub/Sub hooks, and production-ish reliability. Use this when configuring OpenClaw on HonkBox/honk/maxblack, adding providers, routing, or enabling showcase-style workflows.
---

# OpenClaw Setup (formerly Clawdbot)

## Overview

Use this skill to design, deploy, and harden a distributed OpenClaw setup across the user's machines, with Codex subscription auth and "next-level" WhatsApp + Gmail workflows. Start by scanning `references/showcase.md` to align on target features.

## Workflow Decision Tree

1. **Clarify scope**

- Which features are required? See `references/showcase.md`.
- What does "gog" refer to (GOG.com, Gmail, or the `gog` watch server)?
- What machines participate (HonkBox, honk MacBook Pro, maxblack)? See `references/machines.md`.

2. **Pick the topology**

- **Single-host**: gateway + providers + agents on HonkBox. See `references/gateway.md`.
- **Distributed**: gateway on HonkBox, agents on MacBook(s), optional provider-specific nodes. See `references/gateway.md`.

3. **Auth path**

- OpenAI subscription (Codex CLI reuse) via `~/.codex/auth.json`. See `references/openai-auth.md`.

4. **Providers + hooks**

- WhatsApp provider: pairing, allowlist, self-chat, group policy. See `references/whatsapp.md`.
- Gmail Pub/Sub: Tailscale Funnel + `gog gmail watch serve`. See `references/gmail-pubsub.md`.

5. **Operational hardening**

- Persistent sessions, routing, logs, health checks, monitoring.

6. **Update to latest OpenClaw**

- Use the official installer to upgrade in-place.

```bash
curl -fsSL https://openclaw.bot/install.sh | bash
```

- Verify version:

```bash
openclaw --version
```

- Re-run health checks + migrations:

```bash
openclaw doctor --fix
```

## Step-by-step Setup

### Step 0: Showcase scope + machine inventory

- Read `references/showcase.md` to confirm target features and demo flows.
- Read `references/machines.md` to confirm HonkBox and honk MacBook details.
- Ask for **maxblack** OS/IP/SSH user, and intended role (gateway/agent/provider).

### Step 1: Choose gateway host

- Default: **HonkBox** (always-on, Docker + Node). See `references/gateway.md`.
- Gateway owns provider sockets (WhatsApp) and routes to agents.

### Step 2: OpenAI subscription auth

- Use Codex subscription auth (no API key).
- Read `references/openai-auth.md` and reuse `~/.codex/auth.json` via
  `openclaw onboard --auth-choice codex-cli`.

### Step 3: WhatsApp: take it up a notch

- Read `references/whatsapp.md` for:
  - pairing/approval flow
  - allowlist controls
  - self-chat mode
  - group policy rules
- Propose upgrades:
  - distinct routing by contact / group
  - higher-touch flows (summaries, reminders, escalation)
  - multi-agent delegation

### Step 4: Gmail + gog

- Read `references/gmail-pubsub.md` for Pub/Sub + `gog gmail watch serve`.
- Default to **Tailscale Funnel** for webhook ingestion.
- Clarify “gog” meaning if not Gmail watch server.

### Step 5: Reliability + ops

- Make sessions persistent on gateway.
- Add health checks + log tailing.
- Separate “provider” and “agent” logs.
- Add Discord gateway visibility (see “Discord Debugging & Visibility” below).

### Step 6: Systemd gateway (Linux)

- Use a dedicated systemd user service so the gateway stays up and restarts automatically.
- Example (adjust paths/token/port):

```ini
[Unit]
Description=OpenClaw Gateway
After=network-online.target
Wants=network-online.target

[Service]
ExecStart=/path/to/openclaw gateway --port 18789
Restart=always
RestartSec=5
KillMode=process
Environment=OPENCLAW_GATEWAY_PORT=18789
Environment=OPENCLAW_GATEWAY_TOKEN=<token>

[Install]
WantedBy=default.target
```

## Context & Bootstrap Files (Docs)

OpenClaw injects workspace bootstrap files into the system prompt at session start. Use these to verify what _should_ be read, and to diagnose when a file is not being used.

**Expected bootstrap files (system prompt):**

- `AGENTS.md` — primary instructions for how to operate in the workspace
- `SOUL.md` — persona / voice configuration
- `TOOLS.md` — tool usage rules, operational preferences
- `IDENTITY.md` — agent identity fields (used by `openclaw agents set-identity --from-identity`)
- `USER.md` — user-specific preferences and constraints
- `HEARTBEAT.md` — heartbeat checklist (polling instructions)
- `BOOTSTRAP.md` — first-run setup instructions
- `MEMORY.md` — long-term memory (typically main session only)

**Important limits:**

- `agents.defaults.bootstrapMaxChars` defaults to **20000 chars**. Files larger than this are truncated.

**How to verify injected context:**

- `/context list`
- `/context detail`
- `/usage tokens`

**Workspace defaults (if not overridden):**

- Default: `~/.openclaw/workspace`
- Non-default agents: `~/.openclaw/workspace-<agentId>`

## Token Pressure Best Practices (Docs)

- Keep skill descriptions short and focused.
- Prefer compact updates instead of long histories.
- Trim tool output and files before injecting.
- Use response limits where possible to avoid ballooning the window.

## OpenClaw Docs (Primary)

```
https://docs.openclaw.ai/context
https://docs.openclaw.ai/concepts/multi-agent
https://docs.openclaw.ai/cli/agents
https://docs.openclaw.ai/token-use
https://docs.openclaw.ai/concepts/session-pruning
```

## Discord Debugging & Visibility

### Quick checks (CLI)

- `openclaw doctor` and `openclaw channels status --probe --json` (look for `lastInboundAt` and `connected`).
- `openclaw channels capabilities --channel discord --target channel:<id>` (verifies bot perms/intents).
- `openclaw message read --channel discord --target channel:<id> --limit 1` (REST read path).
- `openclaw message send --channel discord --target channel:<id> --message "test"` (outbound path; proves token + channel perms).

### Log locations

- Gateway file log: `/tmp/openclaw/openclaw-YYYY-MM-DD.log`
- Systemd journal: `journalctl --user -u openclaw-gateway -n 200 --no-pager`
- Empty-content drops now emit `discord: inbound drop` with `reason="empty-content"` and counts for content/embeds/attachments/mentions to confirm intent-related redaction.

### Code path (what happens to a message)

- Discord gateway events → `DiscordMessageListener` → `createDiscordMessageHandler` (debounce) → `preflightDiscordMessage` (allowlist/mention gates) → `processDiscordMessage`.
- `preflightDiscordMessage` calls `recordChannelActivity(...)`, which drives `channels status --probe` inbound timestamps.

### Intents + gating notes (from docs + code)

- OpenClaw requests intents: Guilds, GuildMessages, MessageContent, DirectMessages, GuildMessageReactions, DirectMessageReactions.
- If you see “Used disallowed intents”, enable Message Content Intent (and Server Members if needed) in the Discord Developer Portal.
- If `channels status --probe` shows `application.intents.messageContent` as **limited** or **disabled**, Discord may send **empty message content** for normal guild messages. DMs and explicit mentions still include content. Test by DM or @mention; if that works, enable Message Content Intent in the Developer Portal and restart the gateway.
- Without Message Content Intent, Discord can return empty values for `content`, `embeds`, `attachments`, and other user-input fields in guild messages; only DMs, mentions, and bot-authored messages reliably include content. Treat “empty content” drops as an intent signal.
- `channels.discord.groupPolicy` defaults to allowlist unless set to `"open"`.
- `requireMention` must live under `channels.discord.guilds` (top-level `channels.discord.requireMention` is ignored).
- Permission audits only validate **numeric channel IDs**.

### Extra visibility (when inbound is still silent)

- Run the gateway in verbose mode (e.g., `openclaw gateway run --verbose`) to surface gateway debug lines.
- Look for `discord gateway:` lines (connect/close/reconnect) in the file log.
- If MessageCreate events are not firing, focus on Discord-side permissions/intents or gateway connectivity.
- If guild content is stripped, OpenClaw can hydrate message content via REST when the gateway event arrives empty (look for `discord: failed to hydrate message <id>` or `discord: inbound drop reason=empty-content`).

### Reliability hardening

- Treat model quota/Failover errors as non-fatal so the gateway doesn’t crash.
- Add a periodic health check that alerts if Discord `lastInboundAt` goes stale.

## External Monitoring (Web Tools)

- **Discord Status API** (check platform outages): `https://discordstatus.com/api/v2/status.json` and `.../summary.json`.
- **Uptime Kuma** (self-hosted) for gateway/heartbeat checks + Discord alerts.

## What to load (all references)

- `references/machines.md` — host roles + inventory
- `references/openai-auth.md` — Codex subscription auth
- `references/whatsapp.md` — WhatsApp provider behavior
- `references/gmail-pubsub.md` — Gmail Pub/Sub + gog watch
- `references/gateway.md` — gateway rules
- `references/showcase.md` — showcase feature targets
- OpenClaw docs: `docs/channels/discord.md`, `docs/gateway/troubleshooting.md`
