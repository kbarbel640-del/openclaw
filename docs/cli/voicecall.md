---
summary: "CLI reference for `amigo voicecall` (voice-call plugin command surface)"
read_when:
  - You use the voice-call plugin and want the CLI entry points
  - You want quick examples for `voicecall call|continue|status|tail|expose`
title: "voicecall"
---

# `amigo voicecall`

`voicecall` is a plugin-provided command. It only appears if the voice-call plugin is installed and enabled.

Primary doc:

- Voice-call plugin: [Voice Call](/plugins/voice-call)

## Common commands

```bash
amigo voicecall status --call-id <id>
amigo voicecall call --to "+15555550123" --message "Hello" --mode notify
amigo voicecall continue --call-id <id> --message "Any questions?"
amigo voicecall end --call-id <id>
```

## Exposing webhooks (Tailscale)

```bash
amigo voicecall expose --mode serve
amigo voicecall expose --mode funnel
amigo voicecall unexpose
```

Security note: only expose the webhook endpoint to networks you trust. Prefer Tailscale Serve over Funnel when possible.
