---
title: Refactorizacion del Espejado de Sesiones Salientes (Issue #1520)
description: Track outbound session mirroring refactor notes, decisions, tests, and open items.
x-i18n:
  source_path: refactor/outbound-session-mirroring.md
  source_hash: b88a72f36f7b6d8a
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:59:52Z
---

# Refactorizacion del Espejado de Sesiones Salientes (Issue #1520)

## Estado

- En progreso.
- Enrutamiento de canales del core + plugins actualizado para el espejado saliente.
- El envio del Gateway ahora deriva la sesion de destino cuando se omite sessionKey.

## Contexto

Los envios salientes se espejaban en la sesion _actual_ del agente (clave de sesion de la herramienta) en lugar de en la sesion del canal de destino. El enrutamiento entrante usa claves de sesion de canal/par, por lo que las respuestas salientes terminaban en la sesion incorrecta y los destinos de primer contacto a menudo carecian de entradas de sesion.

## Objetivos

- Espejar los mensajes salientes en la clave de sesion del canal de destino.
- Crear entradas de sesion en envios salientes cuando falten.
- Mantener el alcance de hilos/temas alineado con las claves de sesion entrantes.
- Cubrir canales del core mas extensiones incluidas.

## Resumen de Implementacion

- Nuevo helper de enrutamiento de sesion saliente:
  - `src/infra/outbound/outbound-session.ts`
  - `resolveOutboundSessionRoute` construye la sessionKey de destino usando `buildAgentSessionKey` (dmScope + identityLinks).
  - `ensureOutboundSessionEntry` escribe un(a) `MsgContext` minimo(a) via `recordSessionMetaFromInbound`.
- `runMessageAction` (send) deriva la sessionKey de destino y la pasa a `executeSendAction` para el espejado.
- `message-tool` ya no espeja directamente; solo resuelve agentId a partir de la clave de sesion actual.
- La ruta de envio de plugins espeja via `appendAssistantMessageToSessionTranscript` usando la sessionKey derivada.
- El envio del Gateway deriva una clave de sesion de destino cuando no se proporciona ninguna (agente por defecto) y asegura una entrada de sesion.

## Manejo de Hilos/Temas

- Slack: replyTo/threadId -> `resolveThreadSessionKeys` (sufijo).
- Discord: threadId/replyTo -> `resolveThreadSessionKeys` con `useSuffix=false` para coincidir con lo entrante (el id del canal de hilo ya delimita la sesion).
- Telegram: los IDs de tema se asignan a `chatId:topic:<id>` via `buildTelegramGroupPeerId`.

## Extensiones Cubiertas

- Matrix, MS Teams, Mattermost, BlueBubbles, Nextcloud Talk, Zalo, Zalo Personal, Nostr, Tlon.
- Notas:
  - Los destinos de Mattermost ahora eliminan `@` para el enrutamiento de claves de sesion de DM.
  - Zalo Personal usa el tipo de par de DM para destinos 1:1 (grupo solo cuando `group:` esta presente).
  - Los destinos de grupo de BlueBubbles eliminan los prefijos `chat_*` para coincidir con las claves de sesion entrantes.
  - El espejado automatico de hilos de Slack coincide con los IDs de canal sin distinguir mayusculas/minusculas.
  - El envio del Gateway convierte a minusculas las claves de sesion proporcionadas antes de espejar.

## Decisiones

- **Derivacion de sesion en envio del Gateway**: si se proporciona `sessionKey`, usarlo. Si se omite, derivar una sessionKey a partir del destino + agente por defecto y espejar alli.
- **Creacion de entradas de sesion**: usar siempre `recordSessionMetaFromInbound` con `Provider/From/To/ChatType/AccountId/Originating*` alineado a los formatos entrantes.
- **Normalizacion de destinos**: el enrutamiento saliente usa destinos resueltos (post `resolveChannelTarget`) cuando estan disponibles.
- **Uso de mayusculas/minusculas en claves de sesion**: canonizar las claves de sesion a minusculas al escribir y durante las migraciones.

## Pruebas Agregadas/Actualizadas

- `src/infra/outbound/outbound-session.test.ts`
  - Clave de sesion de hilo de Slack.
  - Clave de sesion de tema de Telegram.
  - identityLinks de dmScope con Discord.
- `src/agents/tools/message-tool.test.ts`
  - Deriva agentId a partir de la clave de sesion (no se pasa sessionKey).
- `src/gateway/server-methods/send.test.ts`
  - Deriva la clave de sesion cuando se omite y crea la entrada de sesion.

## Elementos Abiertos / Seguimientos

- El plugin de llamadas de voz usa claves de sesion `voice:<phone>` personalizadas. El mapeo saliente no esta estandarizado aqui; si la herramienta de mensajes debe soportar envios de llamadas de voz, agregar un mapeo explicito.
- Confirmar si algun plugin externo usa formatos `From/To` no estandar mas alla del conjunto incluido.

## Archivos Modificados

- `src/infra/outbound/outbound-session.ts`
- `src/infra/outbound/outbound-send-service.ts`
- `src/infra/outbound/message-action-runner.ts`
- `src/agents/tools/message-tool.ts`
- `src/gateway/server-methods/send.ts`
- Pruebas en:
  - `src/infra/outbound/outbound-session.test.ts`
  - `src/agents/tools/message-tool.test.ts`
  - `src/gateway/server-methods/send.test.ts`
