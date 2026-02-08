---
summary: "Referencia de la CLI para `openclaw logs` (seguir logs del Gateway vía RPC)"
read_when:
  - Necesita seguir logs del Gateway de forma remota (sin SSH)
  - Quiere líneas de logs en JSON para herramientas
title: "registros"
x-i18n:
  source_path: cli/logs.md
  source_hash: 911a57f0f3b78412
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:58:18Z
---

# `openclaw logs`

Siga logs de archivos del Gateway a través de RPC (funciona en modo remoto).

Relacionado:

- Descripción general del logging: [Logging](/logging)

## Ejemplos

```bash
openclaw logs
openclaw logs --follow
openclaw logs --json
openclaw logs --limit 500
```
