---
summary: "CLI-Referenz für `openclaw memory` (Status/Index/Suche)"
read_when:
  - Sie moechten semantischen Speicher indizieren oder durchsuchen
  - Sie debuggen die Speicherverfuegbarkeit oder Indizierung
title: "memory"
x-i18n:
  source_path: cli/memory.md
  source_hash: 95a9e94306f95be2
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:03:45Z
---

# `openclaw memory`

Verwalten der Indizierung und Suche von semantischem Speicher.
Bereitgestellt durch das aktive Speicher-Plugin (Standard: `memory-core`; setzen Sie `plugins.slots.memory = "none"`, um es zu deaktivieren).

Verwandt:

- Memory-Konzept: [Memory](/concepts/memory)
- Plugins: [Plugins](/plugins)

## Beispiele

```bash
openclaw memory status
openclaw memory status --deep
openclaw memory status --deep --index
openclaw memory status --deep --index --verbose
openclaw memory index
openclaw memory index --verbose
openclaw memory search "release checklist"
openclaw memory status --agent main
openclaw memory index --agent main --verbose
```

## Optionen

Allgemein:

- `--agent <id>`: auf einen einzelnen Agenten beschraenken (Standard: alle konfigurierten Agenten).
- `--verbose`: detaillierte Logs waehrend Probes und Indizierung ausgeben.

Hinweise:

- `memory status --deep` prueft die Verfuegbarkeit von Vektoren und Embeddings.
- `memory status --deep --index` fuehrt eine Neuindizierung aus, wenn der Store als „dirty“ markiert ist.
- `memory index --verbose` gibt Details pro Phase aus (Anbieter, Modell, Quellen, Batch-Aktivitaet).
- `memory status` schliesst alle zusaetzlichen Pfade ein, die ueber `memorySearch.extraPaths` konfiguriert sind.
