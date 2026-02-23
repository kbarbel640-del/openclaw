---
summary: "CLI reference for `openclaw approvals` (exec approvals for gateway or node hosts)"
read_when:
  - You want to edit exec approvals from the CLI
  - You need to manage allowlists on gateway or node hosts
title: "approvals"
---

# `openclaw approvals`

Manage exec approvals for the **local host**, **gateway host**, or a **node host**.
By default, commands target the local approvals file on disk. Use `--gateway` to target the gateway, or `--node` to target a specific node.

Related:

- Exec approvals: [Exec approvals](/tools/exec-approvals)
- Nodes: [Nodes](/nodes)

## Common commands

```bash
openclaw approvals get
openclaw approvals get --node <id|name|ip>
openclaw approvals get --gateway
```

## Replace approvals from a file

```bash
openclaw approvals set --file ./exec-approvals.json
openclaw approvals set --node <id|name|ip> --file ./exec-approvals.json
openclaw approvals set --gateway --file ./exec-approvals.json
```

## Allowlist helpers

```bash
openclaw approvals allowlist add "~/Projects/**/bin/rg"
openclaw approvals allowlist add --agent main --node <id|name|ip> "/usr/bin/uptime"
openclaw approvals allowlist add --agent "*" "/usr/bin/uname"

openclaw approvals allowlist remove "~/Projects/**/bin/rg"
```

## Notes

- `--node` uses the same resolver as `openclaw nodes` (id, name, ip, or id prefix).
- `--agent` defaults to `"*"`, which applies to all agents.
- The node host must advertise `system.execApprovals.get/set` (macOS app or headless node host).
- Approvals files are stored per host at `~/.openclaw/exec-approvals.json`.

## Operator workflow

Use `openclaw approvals` to set policy and allowlists, then resolve runtime approval prompts
from chat using `/approve <id> allow-once|allow-always|deny`.

If your team uses a separate chat policy token (for example `GO <LEDGER_ID>`), treat it as
intent approval only. It does not replace `/approve <id> ...` for gateway exec requests.

## Forward approval prompts to Telegram

```bash
openclaw config set approvals.exec.enabled true
openclaw config set approvals.exec.mode both
openclaw config set approvals.exec.targets '[{"channel":"telegram","to":"123456789"}]'
openclaw gateway restart
```

Then approve in Telegram:

```text
/approve <id> allow-once
```

Use the full `ID: ...` from the approval prompt. Unique prefixes can work only when unambiguous.

## Common operator pitfalls

- Approving with a workflow token (for example `GO <LEDGER_ID>`) instead of `/approve <id> ...`.
- Approving with a gateway/system id instead of the approval prompt id.
- Approving in a different chat/thread than where the prompt was delivered.
- Approving a stale id after it expired.
- Triggering multiple exec requests in parallel and mixing up ids.
- Using a short id prefix that matches multiple pending approvals (`ambiguous approval id prefix`).
- Reusing an old id after a fresh retry generated a new pending request (`unknown approval id`).

## Token source of truth

If `/approve` fails with `unauthorized: device token mismatch`, check token source drift first.

Most commonly, the gateway service has `OPENCLAW_GATEWAY_TOKEN` injected via systemd drop-ins,
while config uses a different `gateway.auth.token`. In this state, approval commands can fail
even when gateway health appears normal.

Quick checks:

```bash
openclaw config get gateway.auth.token
systemctl --user show openclaw-gateway -p Environment -p DropInPaths --no-pager
```

If values differ, keep a single source of truth (recommended: `gateway.auth.token` in config)
and disable extra token-forcing drop-ins, then reload + restart:

```bash
systemctl --user daemon-reload
systemctl --user restart openclaw-gateway
```
