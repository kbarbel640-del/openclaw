---
summary: "CLI-Referenz fuer `openclaw logs` (Gateway-Logs ueber RPC verfolgen)"
read_when:
  - Sie muessen Gateway-Logs remote verfolgen (ohne SSH)
  - Sie moechten JSON-Logzeilen fuer Tooling
title: "Logs"
x-i18n:
  source_path: cli/logs.md
  source_hash: 911a57f0f3b78412
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:03:42Z
---

# `openclaw logs`

Gateway-Dateilogs ueber RPC verfolgen (funktioniert im Remote-Modus).

Verwandt:

- Uebersicht zur Protokollierung: [Logging](/logging)

## Beispiele

```bash
openclaw logs
openclaw logs --follow
openclaw logs --json
openclaw logs --limit 500
```
