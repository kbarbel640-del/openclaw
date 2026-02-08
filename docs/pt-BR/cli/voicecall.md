---
summary: "Referencia da CLI para `openclaw voicecall` (superficie de comandos do plugin voice-call)"
read_when:
  - Voce usa o plugin voice-call e quer os pontos de entrada da CLI
  - Voce quer exemplos rapidos para `voicecall call|continue|status|tail|expose`
title: "voicecall"
x-i18n:
  source_path: cli/voicecall.md
  source_hash: d93aaee6f6f5c9ac
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:55:43Z
---

# `openclaw voicecall`

`voicecall` e um comando fornecido por plugin. Ele so aparece se o plugin voice-call estiver instalado e habilitado.

Documento principal:

- Plugin voice-call: [Voice Call](/plugins/voice-call)

## Comandos comuns

```bash
openclaw voicecall status --call-id <id>
openclaw voicecall call --to "+15555550123" --message "Hello" --mode notify
openclaw voicecall continue --call-id <id> --message "Any questions?"
openclaw voicecall end --call-id <id>
```

## Expondo webhooks (Tailscale)

```bash
openclaw voicecall expose --mode serve
openclaw voicecall expose --mode funnel
openclaw voicecall unexpose
```

Nota de seguranca: exponha o endpoint de webhook apenas para redes em que voce confia. Prefira Tailscale Serve em vez de Funnel quando possivel.
