---
summary: "Referencia da CLI para `openclaw reset` (redefine o estado/configuracao local)"
read_when:
  - Voce quer apagar o estado local mantendo a CLI instalada
  - Voce quer uma simulacao (dry-run) do que seria removido
title: "reset"
x-i18n:
  source_path: cli/reset.md
  source_hash: 08afed5830f892e0
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:55:37Z
---

# `openclaw reset`

Redefine a configuracao/estado local (mantem a CLI instalada).

```bash
openclaw reset
openclaw reset --dry-run
openclaw reset --scope config+creds+sessions --yes --non-interactive
```
