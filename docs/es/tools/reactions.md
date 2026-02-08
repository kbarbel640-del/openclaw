---
summary: "Semántica de reacciones compartida entre canales"
read_when:
  - Al trabajar en reacciones en cualquier canal
title: "Reacciones"
x-i18n:
  source_path: tools/reactions.md
  source_hash: 0f11bff9adb4bd02
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:00:14Z
---

# Herramientas de reacciones

Semántica de reacciones compartida entre canales:

- `emoji` es obligatorio al agregar una reacción.
- `emoji=""` elimina la(s) reacción(es) del bot cuando es compatible.
- `remove: true` elimina el emoji especificado cuando es compatible (requiere `emoji`).

Notas por canal:

- **Discord/Slack**: `emoji` vacío elimina todas las reacciones del bot en el mensaje; `remove: true` elimina solo ese emoji.
- **Google Chat**: `emoji` vacío elimina las reacciones de la aplicación en el mensaje; `remove: true` elimina solo ese emoji.
- **Telegram**: `emoji` vacío elimina las reacciones del bot; `remove: true` también elimina reacciones, pero aún requiere un `emoji` no vacío para la validación de la herramienta.
- **WhatsApp**: `emoji` vacío elimina la reacción del bot; `remove: true` se asigna a emoji vacío (aún requiere `emoji`).
- **Signal**: las notificaciones de reacciones entrantes emiten eventos del sistema cuando `channels.signal.reactionNotifications` está habilitado.
