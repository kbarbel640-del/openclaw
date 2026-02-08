---
summary: "Integración de la API de Bots de Telegram mediante grammY con notas de configuración"
read_when:
  - Trabajando en flujos de Telegram o grammY
title: grammY
x-i18n:
  source_path: channels/grammy.md
  source_hash: ea7ef23e6d77801f
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:57:55Z
---

# Integración de grammY (API de Bots de Telegram)

# Por qué grammY

- Cliente de API de Bots orientado a TS con helpers integrados para long-poll y webhooks, middleware, manejo de errores y limitador de tasa.
- Helpers de medios más limpios que implementar fetch + FormData a mano; compatible con todos los métodos de la API de Bots.
- Extensible: soporte de proxy mediante fetch personalizado, middleware de sesiones (opcional), contexto con tipado seguro.

# Lo que entregamos

- **Ruta de cliente única:** se eliminó la implementación basada en fetch; grammY es ahora el único cliente de Telegram (envío + gateway) con el limitador de grammY habilitado por defecto.
- **Gateway:** `monitorTelegramProvider` construye un `Bot` de grammY, conecta el control por menciones/lista de permitidos, descarga de medios mediante `getFile`/`download`, y entrega respuestas con `sendMessage/sendPhoto/sendVideo/sendAudio/sendDocument`. Soporta long-poll o webhook mediante `webhookCallback`.
- **Proxy:** el `channels.telegram.proxy` opcional usa `undici.ProxyAgent` a través del `client.baseFetch` de grammY.
- **Soporte de webhook:** `webhook-set.ts` envuelve `setWebhook/deleteWebhook`; `webhook.ts` aloja el callback con health y apagado ordenado. El Gateway habilita el modo webhook cuando se establecen `channels.telegram.webhookUrl` + `channels.telegram.webhookSecret` (de lo contrario usa long-poll).
- **Sesiones:** los chats directos se consolidan en la sesión principal del agente (`agent:<agentId>:<mainKey>`); los grupos usan `agent:<agentId>:telegram:group:<chatId>`; las respuestas se enrutan de vuelta al mismo canal.
- **Perillas de configuración:** `channels.telegram.botToken`, `channels.telegram.dmPolicy`, `channels.telegram.groups` (valores predeterminados de lista de permitidos + menciones), `channels.telegram.allowFrom`, `channels.telegram.groupAllowFrom`, `channels.telegram.groupPolicy`, `channels.telegram.mediaMaxMb`, `channels.telegram.linkPreview`, `channels.telegram.proxy`, `channels.telegram.webhookSecret`, `channels.telegram.webhookUrl`.
- **Streaming de borradores:** el `channels.telegram.streamMode` opcional usa `sendMessageDraft` en chats de tema privado (API de Bots 9.3+). Esto es independiente del streaming de bloques de canal.
- **Pruebas:** los mocks de grammY cubren Mensajes directos + control por menciones en grupos y envío saliente; aún se agradecen más fixtures de medios/webhook.

Preguntas abiertas

- Plugins opcionales de grammY (limitador) si encontramos 429 de la API de Bots.
- Agregar más pruebas estructuradas de medios (stickers, notas de voz).
- Hacer configurable el puerto de escucha del webhook (actualmente fijo en 8787 salvo que se conecte a través del Gateway).
