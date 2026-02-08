---
summary: "Host estatico de WebChat en loopback y uso de WS del Gateway para la interfaz de chat"
read_when:
  - Depuracion o configuracion del acceso a WebChat
title: "WebChat"
x-i18n:
  source_path: web/webchat.md
  source_hash: b5ee2b462c8c979a
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:00:19Z
---

# WebChat (Interfaz de Usuario WebSocket del Gateway)

Estado: la interfaz de chat SwiftUI de macOS/iOS se comunica directamente con el WebSocket del Gateway.

## Que es

- Una interfaz de chat nativa para el Gateway (sin navegador integrado ni servidor estatico local).
- Utiliza las mismas sesiones y reglas de enrutamiento que otros canales.
- Enrutamiento determinista: las respuestas siempre regresan a WebChat.

## Inicio rapido

1. Inicie el Gateway.
2. Abra la interfaz de WebChat (aplicacion macOS/iOS) o la pestana de chat de la Interfaz de Control.
3. Asegurese de que la autenticacion del Gateway este configurada (requerida de forma predeterminada, incluso en loopback).

## Como funciona (comportamiento)

- La interfaz se conecta al WebSocket del Gateway y utiliza `chat.history`, `chat.send` y `chat.inject`.
- `chat.inject` agrega una nota del asistente directamente a la transcripcion y la transmite a la interfaz (sin ejecucion de agente).
- El historial siempre se obtiene desde el Gateway (sin observacion de archivos locales).
- Si el Gateway no es accesible, WebChat es de solo lectura.

## Uso remoto

- El modo remoto tuneliza el WebSocket del Gateway a traves de SSH/Tailscale.
- No necesita ejecutar un servidor de WebChat separado.

## Referencia de configuracion (WebChat)

Configuracion completa: [Configuration](/gateway/configuration)

Opciones del canal:

- No hay un bloque `webchat.*` dedicado. WebChat utiliza el endpoint del Gateway + las configuraciones de autenticacion a continuacion.

Opciones globales relacionadas:

- `gateway.port`, `gateway.bind`: host/puerto de WebSocket.
- `gateway.auth.mode`, `gateway.auth.token`, `gateway.auth.password`: autenticacion de WebSocket.
- `gateway.remote.url`, `gateway.remote.token`, `gateway.remote.password`: destino del Gateway remoto.
- `session.*`: almacenamiento de sesiones y valores predeterminados de la clave principal.
