---
summary: "Referencia de la CLI para `openclaw tui` (UI de terminal conectada al Gateway)"
read_when:
  - Desea una UI de terminal para el Gateway (apta para uso remoto)
  - Desea pasar url/token/sesion desde scripts
title: "tui"
x-i18n:
  source_path: cli/tui.md
  source_hash: f0a97d92e08746a9
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:58:20Z
---

# `openclaw tui`

Abra la UI de terminal conectada al Gateway.

Relacionado:

- Guía de TUI: [TUI](/tui)

## Ejemplos

```bash
openclaw tui
openclaw tui --url ws://127.0.0.1:18789 --token <token>
openclaw tui --session main --deliver
```
