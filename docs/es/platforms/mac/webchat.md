---
summary: "Cómo la app de mac incrusta el WebChat del Gateway y cómo depurarlo"
read_when:
  - Depuración de la vista WebChat de mac o del puerto de loopback
title: "WebChat"
x-i18n:
  source_path: platforms/mac/webchat.md
  source_hash: 04ff448758e53009
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:59:31Z
---

# WebChat (app de macOS)

La app de la barra de menú de macOS incrusta la UI de WebChat como una vista nativa de SwiftUI. Se
conecta al Gateway y, de forma predeterminada, usa la **sesión principal** para el agente seleccionado
(con un selector de sesiones para otras sesiones).

- **Modo local**: se conecta directamente al WebSocket local del Gateway.
- **Modo remoto**: reenvía el puerto de control del Gateway por SSH y usa ese
  túnel como el plano de datos.

## Inicio y depuración

- Manual: menú Lobster → “Abrir chat”.
- Apertura automática para pruebas:
  ```bash
  dist/OpenClaw.app/Contents/MacOS/OpenClaw --webchat
  ```
- Registros: `./scripts/clawlog.sh` (subsistema `bot.molt`, categoría `WebChatSwiftUI`).

## Cómo está cableado

- Plano de datos: métodos WS del Gateway `chat.history`, `chat.send`, `chat.abort`,
  `chat.inject` y eventos `chat`, `agent`, `presence`, `tick`, `health`.
- Sesión: por defecto, la sesión primaria (`main`, o `global` cuando el alcance es
  global). La UI puede cambiar entre sesiones.
- La incorporación usa una sesión dedicada para mantener separada la configuración del primer inicio.

## Superficie de seguridad

- El modo remoto reenvía únicamente el puerto de control del WebSocket del Gateway por SSH.

## Limitaciones conocidas

- La UI está optimizada para sesiones de chat (no es un sandbox de navegador completo).
