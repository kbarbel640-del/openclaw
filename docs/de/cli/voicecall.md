---
summary: "CLI-Referenz fuer `openclaw voicecall` (Befehlsoberflaeche des Voice-Call-Plugins)"
read_when:
  - Sie verwenden das Voice-Call-Plugin und moechten die CLI-Einstiegspunkte
  - Sie moechten schnelle Beispiele fuer `voicecall call|continue|status|tail|expose`
title: "voicecall"
x-i18n:
  source_path: cli/voicecall.md
  source_hash: d93aaee6f6f5c9ac
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:03:52Z
---

# `openclaw voicecall`

`voicecall` ist ein vom Plugin bereitgestellter Befehl. Er erscheint nur, wenn das Voice-Call-Plugin installiert und aktiviert ist.

Primaere Dokumentation:

- Voice-Call-Plugin: [Voice Call](/plugins/voice-call)

## Gelaeufige Befehle

```bash
openclaw voicecall status --call-id <id>
openclaw voicecall call --to "+15555550123" --message "Hello" --mode notify
openclaw voicecall continue --call-id <id> --message "Any questions?"
openclaw voicecall end --call-id <id>
```

## Webhooks exponieren (Tailscale)

```bash
openclaw voicecall expose --mode serve
openclaw voicecall expose --mode funnel
openclaw voicecall unexpose
```

Sicherheitshinweis: Exponieren Sie den Webhook-Endpunkt nur fuer Netzwerke, denen Sie vertrauen. Bevorzugen Sie nach Moeglichkeit Tailscale Serve gegenueber Funnel.
