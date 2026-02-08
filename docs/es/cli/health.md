---
summary: "Referencia de CLI para `openclaw health` (endpoint de salud del Gateway vía RPC)"
read_when:
  - Quiere verificar rápidamente la salud del Gateway en ejecución
title: "salud"
x-i18n:
  source_path: cli/health.md
  source_hash: 82a78a5a97123f7a
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:58:14Z
---

# `openclaw health`

Obtenga la salud del Gateway en ejecución.

```bash
openclaw health
openclaw health --json
openclaw health --verbose
```

Notas:

- `--verbose` ejecuta sondas en vivo e imprime los tiempos por cuenta cuando hay múltiples cuentas configuradas.
- La salida incluye almacenes de sesiones por agente cuando hay múltiples agentes configurados.
