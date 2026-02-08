---
summary: "Referencia de la CLI para `openclaw voicecall` (superficie de comandos del plugin de llamadas de voz)"
read_when:
  - Usted utiliza el plugin de llamadas de voz y desea los puntos de entrada de la CLI
  - Usted quiere ejemplos rapidos para `voicecall call|continue|status|tail|expose`
title: "voicecall"
x-i18n:
  source_path: cli/voicecall.md
  source_hash: d93aaee6f6f5c9ac
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:58:24Z
---

# `openclaw voicecall`

`voicecall` es un comando proporcionado por un plugin. Solo aparece si el plugin de llamadas de voz está instalado y habilitado.

Documento principal:

- Plugin de llamadas de voz: [Voice Call](/plugins/voice-call)

## Comandos comunes

```bash
openclaw voicecall status --call-id <id>
openclaw voicecall call --to "+15555550123" --message "Hello" --mode notify
openclaw voicecall continue --call-id <id> --message "Any questions?"
openclaw voicecall end --call-id <id>
```

## Exposicion de webhooks (Tailscale)

```bash
openclaw voicecall expose --mode serve
openclaw voicecall expose --mode funnel
openclaw voicecall unexpose
```

Nota de seguridad: exponga el endpoint del webhook solo a redes en las que usted confie. Prefiera Tailscale Serve sobre Funnel cuando sea posible.
