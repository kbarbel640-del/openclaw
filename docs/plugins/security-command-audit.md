---
summary: "Security Command Audit plugin: audit and block high-risk exec/bash commands (install + enable + approval flow)"
read_when:
  - You want to prevent destructive shell commands from running
  - You want an approval gate for high-risk exec/bash tool calls
title: "Security Command Audit Plugin"
---

# Security Command Audit (plugin)

`security-command-audit` is a Gateway plugin that audits `exec`/`bash` tool calls **before** they run.

It is designed to be **fail-safe**:

- It **never throws** in the hot path (tool call execution).

## Where it runs

This plugin runs **inside the Gateway process**.

If you use a remote Gateway, install and enable it on the **machine running the Gateway**, then restart the Gateway.

## Install

### Option A: install from npm

```bash
openclaw plugins install @openclaw/security-command-audit
```

Restart the Gateway afterwards.

### Option B: install from a local folder (dev)

```bash
openclaw plugins install ./extensions/security-command-audit
cd ./extensions/security-command-audit && pnpm install
```

Restart the Gateway afterwards.

## Enable

Enable via config:

```json5
{
  plugins: {
    allow: ["security-command-audit"],
    entries: {
      "security-command-audit": {
        enabled: true,
        // config: { approvalsForAsk: true }
      },
    },
  },
}
```

## Behavior

### Violation: always blocked (no bypass)

When a command is classified as a **violation** (e.g. external-domain / exfil), the plugin blocks it and does not allow bypass.

### High-risk: approval required

The plugin supports two modes for **high-risk** ("ask") matches:

- **Mode A (exec approvals)**: set `config.approvalsForAsk=true`. The plugin will enforce approvals by setting `ask: "always"` on the `exec` tool call.
  - This requires `exec` to run on `host=gateway|node` (see [Exec Tool](/tools/exec) and [Exec approvals](/tools/exec-approvals)).
  - If approvals forwarding is enabled, you can approve from chat with `/approve <id> ...`.
- **Mode B (two-step confirm)**: default. The plugin blocks the tool call and asks you to re-run with an explicit confirm flag.

For **Mode B**, re-run the same call with:

```json5
{
  _sec_confirm: true,
}
```

The confirm flag is **stripped** before the tool call reaches `exec`/`bash` (to avoid passing unknown parameters to the tool).

## Internal host allowlist (optional)

External-domain checks treat private IPs and common internal TLDs as internal by default.
To add your own internal domains, set:

- `SECURITY_COMMAND_INTERNAL_ALLOWLIST_SOURCE`
