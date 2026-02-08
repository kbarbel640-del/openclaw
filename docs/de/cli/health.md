---
summary: "CLI-Referenz fuer `openclaw health` (Gateway-Health-Endpunkt ueber RPC)"
read_when:
  - Sie moechten schnell den Gesundheitszustand des laufenden Gateways pruefen
title: "health"
x-i18n:
  source_path: cli/health.md
  source_hash: 82a78a5a97123f7a
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:03:44Z
---

# `openclaw health`

Rufen Sie den Gesundheitszustand vom laufenden Gateway ab.

```bash
openclaw health
openclaw health --json
openclaw health --verbose
```

Hinweise:

- `--verbose` fuehrt Live-Probes aus und gibt bei mehreren konfigurierten Accounts zeitliche Messwerte pro Account aus.
- Die Ausgabe enthaelt bei mehreren konfigurierten Agenten die Sitzungsspeicher pro Agent.
