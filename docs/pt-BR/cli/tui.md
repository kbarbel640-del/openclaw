---
summary: "Referencia de CLI para `openclaw tui` (UI de terminal conectada ao Gateway)"
read_when:
  - Voce quer uma UI de terminal para o Gateway (amigavel para acesso remoto)
  - Voce quer passar url/token/sessao a partir de scripts
title: "tui"
x-i18n:
  source_path: cli/tui.md
  source_hash: f0a97d92e08746a9
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:55:43Z
---

# `openclaw tui`

Abra a UI de terminal conectada ao Gateway.

Relacionado:

- Guia de TUI: [TUI](/tui)

## Exemplos

```bash
openclaw tui
openclaw tui --url ws://127.0.0.1:18789 --token <token>
openclaw tui --session main --deliver
```
