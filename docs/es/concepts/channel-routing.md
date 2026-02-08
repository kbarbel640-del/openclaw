---
summary: "Reglas de enrutamiento por canal (WhatsApp, Telegram, Discord, Slack) y contexto compartido"
read_when:
  - Cambiar el enrutamiento de canales o el comportamiento de la bandeja de entrada
title: "Enrutamiento de canales"
x-i18n:
  source_path: concepts/channel-routing.md
  source_hash: 1a322b5187e32c82
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:58:28Z
---

# Canales y enrutamiento

OpenClaw enruta las respuestas **de vuelta al canal del que provino el mensaje**. El
modelo no elige un canal; el enrutamiento es determinista y está controlado por la
configuración del host.

## Términos clave

- **Canal**: `whatsapp`, `telegram`, `discord`, `slack`, `signal`, `imessage`, `webchat`.
- **AccountId**: instancia de cuenta por canal (cuando es compatible).
- **AgentId**: un espacio de trabajo aislado + almacén de sesiones (“cerebro”).
- **SessionKey**: la clave de contenedor usada para almacenar contexto y controlar la concurrencia.

## Formas de claves de sesión (ejemplos)

Los mensajes directos se consolidan en la sesión **principal** del agente:

- `agent:<agentId>:<mainKey>` (predeterminado: `agent:main:main`)

Los grupos y canales permanecen aislados por canal:

- Grupos: `agent:<agentId>:<channel>:group:<id>`
- Canales/salas: `agent:<agentId>:<channel>:channel:<id>`

Hilos:

- Los hilos de Slack/Discord agregan `:thread:<threadId>` a la clave base.
- Los temas de foros de Telegram incorporan `:topic:<topicId>` en la clave del grupo.

Ejemplos:

- `agent:main:telegram:group:-1001234567890:topic:42`
- `agent:main:discord:channel:123456:thread:987654`

## Reglas de enrutamiento (cómo se elige un agente)

El enrutamiento selecciona **un agente** para cada mensaje entrante:

1. **Coincidencia exacta de par** (`bindings` con `peer.kind` + `peer.id`).
2. **Coincidencia de guild** (Discord) mediante `guildId`.
3. **Coincidencia de equipo** (Slack) mediante `teamId`.
4. **Coincidencia de cuenta** (`accountId` en el canal).
5. **Coincidencia de canal** (cualquier cuenta en ese canal).
6. **Agente predeterminado** (`agents.list[].default`, de lo contrario la primera entrada de la lista, con respaldo a `main`).

El agente coincidente determina qué espacio de trabajo y almacén de sesiones se utilizan.

## Grupos de difusión (ejecutar múltiples agentes)

Los grupos de difusión le permiten ejecutar **múltiples agentes** para el mismo par **cuando OpenClaw normalmente respondería** (por ejemplo: en grupos de WhatsApp, después de la activación por mención).

Configuración:

```json5
{
  broadcast: {
    strategy: "parallel",
    "120363403215116621@g.us": ["alfred", "baerbel"],
    "+15555550123": ["support", "logger"],
  },
}
```

Ver: [Grupos de difusión](/broadcast-groups).

## Resumen de configuración

- `agents.list`: definiciones de agentes con nombre (espacio de trabajo, modelo, etc.).
- `bindings`: asigna canales/cuentas/pares entrantes a agentes.

Ejemplo:

```json5
{
  agents: {
    list: [{ id: "support", name: "Support", workspace: "~/.openclaw/workspace-support" }],
  },
  bindings: [
    { match: { channel: "slack", teamId: "T123" }, agentId: "support" },
    { match: { channel: "telegram", peer: { kind: "group", id: "-100123" } }, agentId: "support" },
  ],
}
```

## Almacenamiento de sesiones

Los almacenes de sesiones viven bajo el directorio de estado (predeterminado `~/.openclaw`):

- `~/.openclaw/agents/<agentId>/sessions/sessions.json`
- Las transcripciones JSONL viven junto al almacén

Puede sobrescribir la ruta del almacén mediante la plantilla `session.store` y `{agentId}`.

## Comportamiento de WebChat

WebChat se adjunta al **agente seleccionado** y, de forma predeterminada, a la sesión
principal del agente. Debido a esto, WebChat le permite ver el contexto entre canales
para ese agente en un solo lugar.

## Contexto de respuesta

Las respuestas entrantes incluyen:

- `ReplyToId`, `ReplyToBody` y `ReplyToSender` cuando están disponibles.
- El contexto citado se agrega a `Body` como un bloque `[Replying to ...]`.

Esto es consistente en todos los canales.
