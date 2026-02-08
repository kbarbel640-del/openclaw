---
summary: „CLI-Referenz für `openclaw tui` (Terminal-UI, verbunden mit dem Gateway)“
read_when:
  - Sie möchten eine Terminal-UI für das Gateway (remote-freundlich)
  - Sie möchten URL/Token/Sitzung aus Skripten übergeben
title: „tui“
x-i18n:
  source_path: cli/tui.md
  source_hash: f0a97d92e08746a9
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:03:50Z
---

# `openclaw tui`

Öffnen Sie die mit dem Gateway verbundene Terminal-UI.

Verwandt:

- TUI-Leitfaden: [TUI](/tui)

## Beispiele

```bash
openclaw tui
openclaw tui --url ws://127.0.0.1:18789 --token <token>
openclaw tui --session main --deliver
```
