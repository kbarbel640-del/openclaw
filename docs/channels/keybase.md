---
summary: "Keybase support via the Keybase CLI chat API"
read_when:
  - Setting up Keybase support
  - Debugging Keybase send/receive
title: "Keybase"
---

# Keybase (CLI)

Status: built-in channel plugin. Gateway communicates with Keybase via `keybase chat api-listen` (inbound) and `keybase chat api` (outbound).

## Prerequisites

- Keybase CLI installed and running on the host.
- A Keybase account logged in (`keybase login`).
- The Keybase service must be running (`keybase service` or the desktop app).

## Quick setup

1. Install the [Keybase](https://keybase.io/download) client.
2. Log in: `keybase login`.
3. Verify: `keybase whoami` should print your bot's username.
4. Configure OpenClaw and restart the gateway.
5. Send a DM from an allowed user and approve pairing if using `pairing` policy.

Minimal config:

```json5
{
  channels: {
    keybase: {
      enabled: true,
      dmPolicy: "allowlist",
      allowFrom: ["alice"],
    },
  },
}
```

Field reference:

| Field            | Description                                                  |
| ---------------- | ------------------------------------------------------------ |
| `enabled`        | Enable or disable the Keybase channel (default: `true`)      |
| `dmPolicy`       | DM access policy: `pairing`, `allowlist`, `open`, `disabled` |
| `allowFrom`      | Keybase usernames allowed to DM the bot                      |
| `groupPolicy`    | Team channel policy: `allowlist`, `open`, `disabled`         |
| `groupAllowFrom` | Usernames allowed to trigger the bot in team channels        |

## How it works

- **Inbound:** The gateway spawns `keybase chat api-listen` as a child process. Each incoming message is a JSON line on stdout. The monitor parses these, normalizes them into OpenClaw envelopes, and dispatches to the agent pipeline.
- **Outbound:** Replies are sent via `keybase chat api -m '{"method":"send",...}'`.
- **Session routing:** DMs use `keybase:<username>` as the session target. Team channels use `team:<teamname>`.
- **Self-filtering:** Messages from the bot's own username are automatically filtered out to prevent echo loops.

## DM and team channels

Keybase has two conversation types:

- **DMs** (`members_type: "impteamnative"`): Direct messages between users. Addressed by username.
- **Team channels** (`members_type: "team"`): Team conversations with topic channels. Addressed by `team:<name>#<topic>`.

## Access control

Same pattern as other channels:

- `dmPolicy: "pairing"` — New senders get a pairing code. Approve with `openclaw pairing approve keybase <CODE>`.
- `dmPolicy: "allowlist"` — Only usernames in `allowFrom` can DM.
- `dmPolicy: "open"` — Anyone can DM (requires `allowFrom: ["*"]`).
- `groupPolicy: "allowlist"` — Only `groupAllowFrom` senders trigger the bot in teams.

## Troubleshooting

| Symptom                              | Fix                                                          |
| ------------------------------------ | ------------------------------------------------------------ |
| `keybase: failed to detect username` | Run `keybase login` and verify with `keybase whoami`         |
| `keybase chat api-listen exited`     | Check that the Keybase service is running                    |
| Messages not received                | Verify `allowFrom` includes the sender's username            |
| Bot echoing its own messages         | This should be auto-filtered; check `keybase whoami` matches |
