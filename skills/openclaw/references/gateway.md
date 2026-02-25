# Gateway + distributed topology notes (OpenClaw)

Source: docs/gateway/configuration.md, docs/start/clawd.md, docs/concepts/multi-agent.md.

## Topology basics

- Gateway owns provider sockets (WhatsApp, Telegram, etc.).
- CLI / macOS app talk to the gateway; provider sockets do not run in the CLI.
- In distributed setups, keep a single gateway host per provider session set.

## Safe defaults for production

- Always set whatsapp.allowFrom (never open DMs globally).
- Use pairing for DM gating when you want bulletproof access control.
- For groups, set whatsapp.groupPolicy + whatsapp.groups allowlist.

## Multi-agent routing

- Use routing.bindings to map provider+peer to agentId.
- Use provider accounts (whatsapp.accounts) for multi-number setups.

## Observability

- Provider logs: openclaw providers logs --provider whatsapp
- Health checks: docs/gateway/health.md
