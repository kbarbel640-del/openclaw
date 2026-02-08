---
summary: "CLI-Referenz für `openclaw reset` (lokalen Status/Konfiguration zurücksetzen)"
read_when:
  - Sie möchten den lokalen Status löschen und die CLI installiert behalten
  - Sie möchten einen Dry-Run dessen durchführen, was entfernt würde
title: "reset"
x-i18n:
  source_path: cli/reset.md
  source_hash: 08afed5830f892e0
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:03:47Z
---

# `openclaw reset`

Setzt die lokale Konfiguration/den lokalen Status zurück (die CLI bleibt installiert).

```bash
openclaw reset
openclaw reset --dry-run
openclaw reset --scope config+creds+sessions --yes --non-interactive
```
