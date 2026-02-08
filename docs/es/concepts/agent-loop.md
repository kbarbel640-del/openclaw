---
summary: "Ciclo de vida del bucle del agente, flujos y semántica de espera"
read_when:
  - Necesita un recorrido exacto del bucle del agente o de los eventos del ciclo de vida
title: "Bucle del Agente"
x-i18n:
  source_path: concepts/agent-loop.md
  source_hash: 0775b96eb3451e13
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:58:38Z
---

# Bucle del Agente (OpenClaw)

Un bucle agentic es la ejecución “real” completa de un agente: ingesta → ensamblaje de contexto → inferencia del modelo →
ejecución de herramientas → respuestas en streaming → persistencia. Es la ruta autoritativa que convierte un mensaje
en acciones y una respuesta final, manteniendo el estado de la sesion consistente.

En OpenClaw, un bucle es una ejecución única y serializada por sesion que emite eventos de ciclo de vida y de streaming
mientras el modelo razona, llama herramientas y transmite salida. Este documento explica cómo ese bucle auténtico
está cableado de extremo a extremo.

## Puntos de entrada

- Gateway RPC: `agent` y `agent.wait`.
- CLI: comando `agent`.

## Cómo funciona (alto nivel)

1. El RPC `agent` valida parámetros, resuelve la sesion (sessionKey/sessionId), persiste metadatos de la sesion y devuelve `{ runId, acceptedAt }` de inmediato.
2. `agentCommand` ejecuta el agente:
   - resuelve el modelo + valores predeterminados de thinking/verbose
   - carga el snapshot de Skills
   - llama a `runEmbeddedPiAgent` (runtime de pi-agent-core)
   - emite **fin/error del ciclo de vida** si el bucle embebido no emite uno
3. `runEmbeddedPiAgent`:
   - serializa ejecuciones mediante colas por sesion + globales
   - resuelve el modelo + perfil de autenticacion y construye la sesion de pi
   - se suscribe a eventos de pi y transmite deltas del asistente/herramientas
   - aplica tiempo de espera -> aborta la ejecucion si se excede
   - devuelve payloads + metadatos de uso
4. `subscribeEmbeddedPiSession` conecta eventos de pi-agent-core con el stream `agent` de OpenClaw:
   - eventos de herramientas => `stream: "tool"`
   - deltas del asistente => `stream: "assistant"`
   - eventos de ciclo de vida => `stream: "lifecycle"` (`phase: "start" | "end" | "error"`)
5. `agent.wait` usa `waitForAgentJob`:
   - espera **fin/error del ciclo de vida** para `runId`
   - devuelve `{ status: ok|error|timeout, startedAt, endedAt, error? }`

## Encolado + concurrencia

- Las ejecuciones se serializan por clave de sesion (carril de sesion) y opcionalmente a través de un carril global.
- Esto evita carreras de herramientas/sesion y mantiene consistente el historial de la sesion.
- Los canales de mensajeria pueden elegir modos de cola (collect/steer/followup) que alimentan este sistema de carriles.
  Vea [Command Queue](/concepts/queue).

## Preparación de sesion + espacio de trabajo

- El espacio de trabajo se resuelve y crea; las ejecuciones en sandbox pueden redirigirse a una raiz de espacio de trabajo de sandbox.
- Las Skills se cargan (o se reutilizan desde un snapshot) y se inyectan en el entorno y el prompt.
- Los archivos de arranque/contexto se resuelven y se inyectan en el reporte del prompt del sistema.
- Se adquiere un bloqueo de escritura de la sesion; `SessionManager` se abre y prepara antes del streaming.

## Ensamblaje del prompt + prompt del sistema

- El prompt del sistema se construye a partir del prompt base de OpenClaw, el prompt de Skills, el contexto de arranque y anulaciones por ejecucion.
- Se aplican límites específicos del modelo y tokens de reserva para compactacion.
- Vea [System prompt](/concepts/system-prompt) para lo que ve el modelo.

## Puntos de hook (donde puede interceptar)

OpenClaw tiene dos sistemas de hooks:

- **Hooks internos** (hooks del Gateway): scripts dirigidos por eventos para comandos y eventos del ciclo de vida.
- **Hooks de plugins**: puntos de extension dentro del ciclo de vida del agente/herramienta y del pipeline del gateway.

### Hooks internos (hooks del Gateway)

- **`agent:bootstrap`**: se ejecuta mientras se construyen los archivos de arranque antes de finalizar el prompt del sistema.
  Úselo para agregar/quitar archivos de contexto de arranque.
- **Hooks de comandos**: `/new`, `/reset`, `/stop` y otros eventos de comandos (vea el doc de Hooks).

Vea [Hooks](/hooks) para configuración y ejemplos.

### Hooks de plugins (ciclo de vida del agente + gateway)

Estos se ejecutan dentro del bucle del agente o del pipeline del gateway:

- **`before_agent_start`**: inyecta contexto o anula el prompt del sistema antes de que comience la ejecucion.
- **`agent_end`**: inspecciona la lista final de mensajes y los metadatos de la ejecucion después de completar.
- **`before_compaction` / `after_compaction`**: observa o anota ciclos de compactacion.
- **`before_tool_call` / `after_tool_call`**: intercepta parámetros/resultados de herramientas.
- **`tool_result_persist`**: transforma sincrónicamente los resultados de herramientas antes de que se escriban en la transcripcion de la sesion.
- **`message_received` / `message_sending` / `message_sent`**: hooks de mensajes entrantes + salientes.
- **`session_start` / `session_end`**: límites del ciclo de vida de la sesion.
- **`gateway_start` / `gateway_stop`**: eventos del ciclo de vida del gateway.

Vea [Plugins](/plugin#plugin-hooks) para la API de hooks y los detalles de registro.

## Streaming + respuestas parciales

- Los deltas del asistente se transmiten desde pi-agent-core y se emiten como eventos `assistant`.
- El streaming por bloques puede emitir respuestas parciales ya sea en `text_end` o `message_end`.
- El streaming de razonamiento puede emitirse como un stream separado o como respuestas por bloques.
- Vea [Streaming](/concepts/streaming) para el comportamiento de fragmentacion y respuestas por bloques.

## Ejecucion de herramientas + herramientas de mensajeria

- Los eventos de inicio/actualizacion/fin de herramientas se emiten en el stream `tool`.
- Los resultados de herramientas se sanitizan por tamaño y payloads de imagen antes de registrar/emitar.
- Los envíos de herramientas de mensajeria se rastrean para suprimir confirmaciones duplicadas del asistente.

## Moldeado de respuestas + supresion

- Los payloads finales se ensamblan a partir de:
  - texto del asistente (y razonamiento opcional)
  - resúmenes de herramientas en línea (cuando verbose + permitido)
  - texto de error del asistente cuando el modelo falla
- `NO_REPLY` se trata como un token silencioso y se filtra de los payloads salientes.
- Los duplicados de herramientas de mensajeria se eliminan de la lista final de payloads.
- Si no quedan payloads renderizables y una herramienta falló, se emite una respuesta de error de herramienta de respaldo
  (a menos que una herramienta de mensajeria ya haya enviado una respuesta visible para el usuario).

## Compactacion + reintentos

- La auto-compactacion emite eventos de stream `compaction` y puede activar un reintento.
- En el reintento, los buffers en memoria y los resúmenes de herramientas se reinician para evitar salida duplicada.
- Vea [Compaction](/concepts/compaction) para el pipeline de compactacion.

## Streams de eventos (hoy)

- `lifecycle`: emitido por `subscribeEmbeddedPiSession` (y como respaldo por `agentCommand`)
- `assistant`: deltas transmitidos desde pi-agent-core
- `tool`: eventos de herramientas transmitidos desde pi-agent-core

## Manejo del canal de chat

- Los deltas del asistente se almacenan en búfer en mensajes de chat `delta`.
- Se emite un `final` de chat en **fin/error del ciclo de vida**.

## Tiempos de espera

- `agent.wait` predeterminado: 30s (solo la espera). El parámetro `timeoutMs` lo anula.
- Runtime del agente: `agents.defaults.timeoutSeconds` predeterminado 600s; aplicado en el temporizador de aborto `runEmbeddedPiAgent`.

## Dónde las cosas pueden terminar antes

- Tiempo de espera del agente (aborto)
- AbortSignal (cancelacion)
- Desconexion del Gateway o tiempo de espera del RPC
- Tiempo de espera de `agent.wait` (solo espera, no detiene el agente)
