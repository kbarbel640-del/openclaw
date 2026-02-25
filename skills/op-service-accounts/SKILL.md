---
name: op-service-accounts
description: Manages 1Password CLI service-account tokens and prompt-free access. Use when user needs OP_SERVICE_ACCOUNT_TOKEN, wants non-interactive op in agents, or needs to create/rotate a service account.
invocation: user
arguments: "[setup|rotate|verify]"
---

# op-service-accounts

Create and manage 1Password service-account tokens so `op` works non-interactively for terminals and AI agents.

## Quick Reference

| Goal                          | Command                                                                          |
| ----------------------------- | -------------------------------------------------------------------------------- |
| Verify current auth           | `op whoami`                                                                      |
| Create vault (if missing)     | `op vault create Agents`                                                         |
| Create service account token  | `op service-account create <name> --vault "Agents:read_items" --raw`             |
| Install token on this machine | `op-token-set "ops_..."`                                                         |
| Verify token loaded           | `echo ${OP_SERVICE_ACCOUNT_TOKEN:+set}`                                          |
| Restart user services         | `systemctl --user restart clawdbot-gateway.service clawdbot-sync-notify.service` |

## Workflow (setup)

1. **Preflight**

- Only needed when creating/rotating tokens: ensure app integration is signed in: `op whoami`
- If not signed in, run: `op signin --account <your-account>`

2. **Ensure a custom vault exists**

- Service accounts cannot access Personal/Private vaults.
- Create or use a custom vault, e.g.:
  - `op vault create Agents`

3. **Create the service account token**

- Use read-only unless you need writes:
  - `op service-account create agents-cli-$(date +%Y%m%d-%H%M%S) --vault "Agents:read_items" --raw`
- Save the token immediately; it is only shown once.

4. **Install token locally**

- On this machine, use the helper:
  - `op-token-set "ops_..."`
- This writes:
  - `~/.config/op/op.env` (shells)
  - `~/.config/environment.d/10-1password.conf` (user services)

5. **Restart agents to inherit env**

- `systemctl --user restart clawdbot-gateway.service clawdbot-sync-notify.service`
- Restart any long-running terminals/agents.

6. **Validate**

- `op whoami` should show `SERVICE_ACCOUNT`.
- `op vault list` should include the custom vault.

## Workflow (rotate token)

1. Create a new service account token (Step 3 above).
2. Run `op-token-set "ops_..."` with the new token.
3. Restart agents/services.
4. Revoke the old token in the 1Password Admin UI.

## Troubleshooting

- **`op whoami` says “account is not signed in”**
  - Token not set in the environment. Check:
    - `echo $OP_SERVICE_ACCOUNT_TOKEN`
    - `test -s ~/.config/op/op.env`
- **`op` prompts for access**
  - You are using app integration; ensure `OP_SERVICE_ACCOUNT_TOKEN` is set in the session.
- **Missing items**
  - Move items into the custom vault (e.g. Agents). Service accounts cannot access Personal/Private.

## Notes

- Use `read_items` unless you need writes.
- For multiple scopes, create multiple service accounts tied to specific vaults.
