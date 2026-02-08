---
summary: "Cómo la app de macOS informa los estados de salud de gateway/Baileys"
read_when:
  - Depuración de indicadores de salud de la app de macOS
title: "Comprobaciones de Salud"
x-i18n:
  source_path: platforms/mac/health.md
  source_hash: 0560e96501ddf53a
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:59:26Z
---

# Comprobaciones de Salud en macOS

Cómo ver si el canal vinculado está saludable desde la app de la barra de menú.

## Barra de menú

- El punto de estado ahora refleja la salud de Baileys:
  - Verde: vinculado + socket abierto recientemente.
  - Naranja: conectando/reintentando.
  - Rojo: sesión cerrada o la sonda falló.
- La línea secundaria muestra "linked · auth 12m" o indica el motivo del fallo.
- El elemento de menú "Run Health Check" activa una sonda bajo demanda.

## Ajustes

- La pestaña General incorpora una tarjeta de Salud que muestra: antigüedad de autenticación vinculada, ruta/conteo del almacén de sesión, hora de la última comprobación, último error/código de estado, y botones para Run Health Check / Reveal Logs.
- Usa una instantánea en caché para que la interfaz cargue al instante y tenga una degradación elegante cuando está sin conexión.
- **La pestaña Channels** muestra el estado del canal + controles para WhatsApp/Telegram (QR de inicio de sesión, cerrar sesión, sonda, última desconexión/error).

## Cómo funciona la sonda

- La app ejecuta `openclaw health --json` mediante `ShellExecutor` cada ~60 s y bajo demanda. La sonda carga credenciales e informa el estado sin enviar mensajes.
- Se almacena en caché la última instantánea correcta y el último error por separado para evitar parpadeos; se muestra la marca de tiempo de cada uno.

## En caso de duda

- Aún puede usar el flujo de CLI en [Gateway health](/gateway/health) (`openclaw status`, `openclaw status --deep`, `openclaw health --json`) y hacer tail de `/tmp/openclaw/openclaw-*.log` para `web-heartbeat` / `web-reconnect`.
