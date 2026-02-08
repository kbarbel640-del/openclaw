---
summary: "CLI-Referenz für `openclaw setup` (Konfiguration + Arbeitsbereich initialisieren)"
read_when:
  - Sie führen die Ersteinrichtung ohne den vollständigen Einführungsassistenten durch
  - Sie möchten den Standardpfad für den Arbeitsbereich festlegen
title: "Setup"
x-i18n:
  source_path: cli/setup.md
  source_hash: 7f3fc8b246924edf
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:03:48Z
---

# `openclaw setup`

Initialisieren Sie `~/.openclaw/openclaw.json` und den Agent-Arbeitsbereich.

Zugehörig:

- Erste Schritte: [Erste Schritte](/start/getting-started)
- Assistent: [Einfuehrung](/start/onboarding)

## Beispiele

```bash
openclaw setup
openclaw setup --workspace ~/.openclaw/workspace
```

So führen Sie den Assistenten über setup aus:

```bash
openclaw setup --wizard
```
