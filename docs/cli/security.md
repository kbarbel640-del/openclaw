---
summary: "CLI reference for `openclaw security` (audit and fix common security footguns)"
read_when:
  - You want to run a quick security audit on config/state
  - You want to apply safe “fix” suggestions (chmod, tighten defaults)
title: "security"
---

# `openclaw security`

Security tools (audit + optional fixes).

Related:

- Security guide: [Security](/gateway/security)

## Audit

```bash
openclaw security audit
openclaw security audit --deep
openclaw security audit --fix
```

The audit warns when multiple DM senders share the main session and recommends **secure DM mode**: `session.dmScope="per-channel-peer"` (or `per-account-channel-peer` for multi-account channels) for shared inboxes.
It also warns when small models (`<=300B`) are used without sandboxing and with web/browser tools enabled.
For webhook ingress, it warns when `hooks.defaultSessionKey` is unset, when request `sessionKey` overrides are enabled, and when overrides are enabled without `hooks.allowedSessionKeyPrefixes`.
It also warns when sandbox Docker settings are configured while sandbox mode is off, when `gateway.nodes.denyCommands` uses ineffective pattern-like/unknown entries, when global `tools.profile="minimal"` is overridden by agent tool profiles, and when installed extension plugin tools may be reachable under permissive tool policy.

### Skill and plugin static scan reason codes

`openclaw security audit --deep` includes static scan findings for installed skills/plugins with normalized rule IDs.

Examples:

- `suspicious.dangerous_exec`
- `suspicious.dynamic_code_execution`
- `suspicious.potential_exfiltration`
- `suspicious.obfuscated_code`
- `suspicious.prompt_injection_instructions`
- `suspicious.install_untrusted_source`
- `suspicious.privileged_always`
- `malicious.env_harvesting`
- `malicious.crypto_mining`
- `malicious.known_blocked_signature`

Warnings now include reason codes plus short evidence snippets so you can quickly verify whether a finding is expected for your skill.
