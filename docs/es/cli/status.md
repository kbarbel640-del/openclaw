---
summary: "Referencia de CLI para `openclaw status` (diagnósticos, sondeos, instantáneas de uso)"
read_when:
  - Quiere un diagnóstico rápido de la salud de los canales + destinatarios de sesiones recientes
  - Quiere un estado “all” pegable para depuración
title: "estado"
x-i18n:
  source_path: cli/status.md
  source_hash: 2bbf5579c48034fc
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:58:22Z
---

# `openclaw status`

Diagnósticos para canales + sesiones.

```bash
openclaw status
openclaw status --all
openclaw status --deep
openclaw status --usage
```

Notas:

- `--deep` ejecuta sondeos en vivo (WhatsApp Web + Telegram + Discord + Google Chat + Slack + Signal).
- La salida incluye almacenes de sesión por agente cuando se configuran múltiples agentes.
- La vista general incluye el estado de instalación/ejecución del servicio de host del Gateway + nodo cuando está disponible.
- La vista general incluye el canal de actualización + git SHA (para checkouts desde el código fuente).
- La información de actualización aparece en la vista general; si hay una actualización disponible, el estado imprime una sugerencia para ejecutar `openclaw update` (ver [Actualización](/install/updating)).
