## Security Command Audit (plugin)

Audits high-risk `exec`/`bash` tool calls **before** they run.

- Blocks data-exfiltration / external-domain violations (cannot be bypassed)
- For high-risk/destructive commands, either requires explicit re-run with `_sec_confirm=true` (default) or uses exec approvals (`ask=always`) when enabled.

This plugin runs **inside the Gateway process**.

### Install

- **From npm**:

```bash
openclaw plugins install @openclaw/security-command-audit
```

- **From a local folder (dev)**:

```bash
openclaw plugins install ./extensions/security-command-audit
cd ./extensions/security-command-audit && pnpm install
```

Restart the Gateway afterwards.

### Enable

Set config under `plugins.entries.security-command-audit`:

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

### Ask handling modes

- **Mode A (exec approvals)**: set `config.approvalsForAsk=true` to enforce high-risk "ask" via exec approvals by setting `ask: "always"` on the tool call. This requires `exec` to run on `host=gateway|node` (see `tools.exec.host`).
- **Mode B (two-step confirm)**: default. The first call is blocked; re-run with `_sec_confirm=true` to proceed.

### Bypass (approval flow)

If a command is blocked with an approval message, re-run the same tool call and add:

```json5
{ _sec_confirm: true }
```

### Internal host allowlist (optional)

External-domain checks use a built-in internal allowlist for private IPs and common internal TLDs.
To add your own internal domains, set:

- `SECURITY_COMMAND_INTERNAL_ALLOWLIST_SOURCE`
