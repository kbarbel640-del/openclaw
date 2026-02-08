---
summary: "Herramientas de sesion del agente para listar sesiones, obtener el historial y enviar mensajes entre sesiones"
read_when:
  - Agregar o modificar herramientas de sesion
title: "Herramientas de Sesion"
x-i18n:
  source_path: concepts/session-tool.md
  source_hash: cb6e0982ebf507bc
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:58:48Z
---

# Herramientas de Sesion

Objetivo: conjunto de herramientas pequeño y difícil de usar incorrectamente para que los agentes puedan listar sesiones, obtener el historial y enviar mensajes a otra sesion.

## Nombres de Herramientas

- `sessions_list`
- `sessions_history`
- `sessions_send`
- `sessions_spawn`

## Modelo de Claves

- El bucket principal de chat directo siempre es la clave literal `"main"` (resuelta a la clave principal del agente actual).
- Los chats grupales usan `agent:<agentId>:<channel>:group:<id>` o `agent:<agentId>:<channel>:channel:<id>` (pase la clave completa).
- Los cron jobs usan `cron:<job.id>`.
- Los hooks usan `hook:<uuid>` a menos que se establezca explícitamente.
- Las sesiones de nodo usan `node-<nodeId>` a menos que se establezca explícitamente.

`global` y `unknown` son valores reservados y nunca se listan. Si `session.scope = "global"`, lo aliamos a `main` para todas las herramientas, de modo que los llamadores nunca vean `global`.

## sessions_list

Liste sesiones como un arreglo de filas.

Parámetros:

- filtro `kinds?: string[]`: cualquiera de `"main" | "group" | "cron" | "hook" | "node" | "other"`
- `limit?: number` máximo de filas (predeterminado: valor del servidor; se limita, p. ej., 200)
- `activeMinutes?: number` solo sesiones actualizadas dentro de N minutos
- `messageLimit?: number` 0 = sin mensajes (predeterminado 0); >0 = incluir los últimos N mensajes

Comportamiento:

- `messageLimit > 0` obtiene `chat.history` por sesion e incluye los últimos N mensajes.
- Los resultados de herramientas se filtran en la salida de la lista; use `sessions_history` para mensajes de herramientas.
- Cuando se ejecuta en una sesion de agente **en sandbox**, las herramientas de sesion usan por defecto **visibilidad solo de sesiones creadas** (ver abajo).

Forma de la fila (JSON):

- `key`: clave de sesion (string)
- `kind`: `main | group | cron | hook | node | other`
- `channel`: `whatsapp | telegram | discord | signal | imessage | webchat | internal | unknown`
- `displayName` (etiqueta de visualizacion del grupo si está disponible)
- `updatedAt` (ms)
- `sessionId`
- `model`, `contextTokens`, `totalTokens`
- `thinkingLevel`, `verboseLevel`, `systemSent`, `abortedLastRun`
- `sendPolicy` (anulacion de sesion si se establece)
- `lastChannel`, `lastTo`
- `deliveryContext` (`{ channel, to, accountId }` normalizado cuando está disponible)
- `transcriptPath` (ruta de mejor esfuerzo derivada del directorio de almacenamiento + sessionId)
- `messages?` (solo cuando `messageLimit > 0`)

## sessions_history

Obtenga la transcripcion de una sesion.

Parámetros:

- `sessionKey` (obligatorio; acepta clave de sesion o `sessionId` de `sessions_list`)
- `limit?: number` máximo de mensajes (el servidor limita)
- `includeTools?: boolean` (predeterminado false)

Comportamiento:

- `includeTools=false` filtra mensajes `role: "toolResult"`.
- Devuelve un arreglo de mensajes en el formato de transcripcion sin procesar.
- Cuando se proporciona un `sessionId`, OpenClaw lo resuelve a la clave de sesion correspondiente (error si faltan ids).

## sessions_send

Envíe un mensaje a otra sesion.

Parámetros:

- `sessionKey` (obligatorio; acepta clave de sesion o `sessionId` de `sessions_list`)
- `message` (obligatorio)
- `timeoutSeconds?: number` (predeterminado >0; 0 = fire-and-forget)

Comportamiento:

- `timeoutSeconds = 0`: encola y devuelve `{ runId, status: "accepted" }`.
- `timeoutSeconds > 0`: espera hasta N segundos a que finalice y luego devuelve `{ runId, status: "ok", reply }`.
- Si la espera expira: `{ runId, status: "timeout", error }`. La ejecucion continúa; llame a `sessions_history` más tarde.
- Si la ejecucion falla: `{ runId, status: "error", error }`.
- Los anuncios de entrega se ejecutan después de que la ejecucion principal finaliza y son de mejor esfuerzo; `status: "ok"` no garantiza que el anuncio se haya entregado.
- La espera se realiza vía el Gateway `agent.wait` (del lado del servidor) para que las reconexiones no interrumpan la espera.
- Se inyecta el contexto de mensajes agente a agente para la ejecucion principal.
- Después de que finaliza la ejecucion principal, OpenClaw ejecuta un **bucle de respuesta de vuelta**:
  - La ronda 2+ alterna entre el agente solicitante y el agente objetivo.
  - Responda exactamente `REPLY_SKIP` para detener el ping‑pong.
  - El máximo de turnos es `session.agentToAgent.maxPingPongTurns` (0–5, predeterminado 5).
- Una vez que termina el bucle, OpenClaw ejecuta el **paso de anuncio agente a agente** (solo el agente objetivo):
  - Responda exactamente `ANNOUNCE_SKIP` para permanecer en silencio.
  - Cualquier otra respuesta se envía al canal objetivo.
  - El paso de anuncio incluye la solicitud original + la respuesta de la ronda 1 + la última respuesta del ping‑pong.

## Campo Channel

- Para grupos, `channel` es el canal registrado en la entrada de la sesion.
- Para chats directos, `channel` se asigna desde `lastChannel`.
- Para cron/hook/node, `channel` es `internal`.
- Si falta, `channel` es `unknown`.

## Seguridad / Politica de Envío

Bloqueo basado en politicas por canal/tipo de chat (no por id de sesion).

```json
{
  "session": {
    "sendPolicy": {
      "rules": [
        {
          "match": { "channel": "discord", "chatType": "group" },
          "action": "deny"
        }
      ],
      "default": "allow"
    }
  }
}
```

Anulacion en tiempo de ejecucion (por entrada de sesion):

- `sendPolicy: "allow" | "deny"` (sin establecer = hereda la configuracion)
- Configurable vía `sessions.patch` o `/send on|off|inherit` solo para el propietario (mensaje independiente).

Puntos de aplicacion:

- `chat.send` / `agent` (Gateway)
- logica de entrega de respuestas automaticas

## sessions_spawn

Genere una ejecucion de subagente en una sesion aislada y anuncie el resultado de vuelta al canal de chat del solicitante.

Parámetros:

- `task` (obligatorio)
- `label?` (opcional; usado para registros/UI)
- `agentId?` (opcional; generar bajo otro id de agente si se permite)
- `model?` (opcional; anula el modelo del subagente; valores invalidos generan error)
- `runTimeoutSeconds?` (predeterminado 0; cuando se establece, aborta la ejecucion del subagente después de N segundos)
- `cleanup?` (`delete|keep`, predeterminado `keep`)

Lista de permitidos:

- `agents.list[].subagents.allowAgents`: lista de ids de agente permitidos vía `agentId` (`["*"]` para permitir cualquiera). Predeterminado: solo el agente solicitante.

Descubrimiento:

- Use `agents_list` para descubrir qué ids de agente están permitidos para `sessions_spawn`.

Comportamiento:

- Inicia una nueva sesion `agent:<agentId>:subagent:<uuid>` con `deliver: false`.
- Los subagentes usan por defecto el conjunto completo de herramientas **menos las herramientas de sesion** (configurable vía `tools.subagents.tools`).
- Los subagentes no pueden llamar a `sessions_spawn` (no se permite generar subagente → subagente).
- Siempre no bloqueante: devuelve `{ status: "accepted", runId, childSessionKey }` inmediatamente.
- Tras la finalizacion, OpenClaw ejecuta un **paso de anuncio** del subagente y publica el resultado en el canal de chat del solicitante.
- Responda exactamente `ANNOUNCE_SKIP` durante el paso de anuncio para permanecer en silencio.
- Las respuestas de anuncio se normalizan a `Status`/`Result`/`Notes`; `Status` proviene del resultado en tiempo de ejecucion (no del texto del modelo).
- Las sesiones de subagente se archivan automaticamente después de `agents.defaults.subagents.archiveAfterMinutes` (predeterminado: 60).
- Las respuestas de anuncio incluyen una línea de estadisticas (tiempo de ejecucion, tokens, sessionKey/sessionId, ruta de la transcripcion y costo opcional).

## Visibilidad de Sesiones en Sandbox

Las sesiones en sandbox pueden usar herramientas de sesion, pero por defecto solo ven las sesiones que generaron vía `sessions_spawn`.

Configuracion:

```json5
{
  agents: {
    defaults: {
      sandbox: {
        // default: "spawned"
        sessionToolsVisibility: "spawned", // or "all"
      },
    },
  },
}
```
