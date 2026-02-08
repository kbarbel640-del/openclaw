---
summary: "Trabajos cron + activaciones para el programador del Gateway"
read_when:
  - Programar trabajos en segundo plano o activaciones
  - Conectar automatizaciones que deban ejecutarse con o junto a heartbeats
  - Decidir entre heartbeat y cron para tareas programadas
title: "Trabajos Cron"
x-i18n:
  source_path: automation/cron-jobs.md
  source_hash: 523721a7da2c4e27
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:58:12Z
---

# Trabajos cron (programador del Gateway)

> **¿Cron vs Heartbeat?** Consulte [Cron vs Heartbeat](/automation/cron-vs-heartbeat) para obtener orientación sobre cuándo usar cada uno.

Cron es el programador integrado del Gateway. Persiste los trabajos, despierta al agente en
el momento correcto y, opcionalmente, puede entregar la salida de vuelta a un chat.

Si quiere _«ejecutar esto cada mañana»_ o _«activar al agente en 20 minutos»_,
cron es el mecanismo.

## TL;DR

- Cron se ejecuta **dentro del Gateway** (no dentro del modelo).
- Los trabajos persisten bajo `~/.openclaw/cron/` para que los reinicios no pierdan los horarios.
- Dos estilos de ejecución:
  - **Sesion principal**: encola un evento del sistema y luego se ejecuta en el siguiente heartbeat.
  - **Aislado**: ejecuta un turno de agente dedicado en `cron:<jobId>`, con entrega (anunciar por defecto o ninguna).
- Las activaciones son de primera clase: un trabajo puede solicitar “despertar ahora” vs “siguiente heartbeat”.

## Inicio rapido (accionable)

Cree un recordatorio de una sola vez, verifique que exista y ejecútelo de inmediato:

```bash
openclaw cron add \
  --name "Reminder" \
  --at "2026-02-01T16:00:00Z" \
  --session main \
  --system-event "Reminder: check the cron docs draft" \
  --wake now \
  --delete-after-run

openclaw cron list
openclaw cron run <job-id> --force
openclaw cron runs --id <job-id>
```

Programe un trabajo aislado recurrente con entrega:

```bash
openclaw cron add \
  --name "Morning brief" \
  --cron "0 7 * * *" \
  --tz "America/Los_Angeles" \
  --session isolated \
  --message "Summarize overnight updates." \
  --announce \
  --channel slack \
  --to "channel:C1234567890"
```

## Equivalentes de llamadas de herramienta (herramienta cron del Gateway)

Para las formas JSON canónicas y ejemplos, consulte [Esquema JSON para llamadas de herramienta](/automation/cron-jobs#json-schema-for-tool-calls).

## Dónde se almacenan los trabajos cron

Los trabajos cron se persisten en el host del Gateway en `~/.openclaw/cron/jobs.json` por defecto.
El Gateway carga el archivo en memoria y lo vuelve a escribir cuando hay cambios, por lo que las ediciones manuales
solo son seguras cuando el Gateway está detenido. Prefiera `openclaw cron add/edit` o la API de llamadas de herramienta
cron para realizar cambios.

## Descripción general para principiantes

Piense en un trabajo cron como: **cuándo** ejecutar + **qué** hacer.

1. **Elija un horario**
   - Recordatorio de una sola vez → `schedule.kind = "at"` (CLI: `--at`)
   - Trabajo repetitivo → `schedule.kind = "every"` o `schedule.kind = "cron"`
   - Si su marca de tiempo ISO omite una zona horaria, se trata como **UTC**.

2. **Elija dónde se ejecuta**
   - `sessionTarget: "main"` → se ejecuta durante el siguiente heartbeat con el contexto principal.
   - `sessionTarget: "isolated"` → ejecuta un turno de agente dedicado en `cron:<jobId>`.

3. **Elija la carga útil**
   - Sesion principal → `payload.kind = "systemEvent"`
   - Sesion aislada → `payload.kind = "agentTurn"`

Opcional: los trabajos de una sola vez (`schedule.kind = "at"`) se eliminan después del éxito por defecto. Configure
`deleteAfterRun: false` para conservarlos (se deshabilitarán después del éxito).

## Conceptos

### Trabajos

Un trabajo cron es un registro almacenado con:

- un **horario** (cuándo debe ejecutarse),
- una **carga útil** (qué debe hacer),
- **modo de entrega** opcional (anunciar o ninguno).
- **vinculación de agente** opcional (`agentId`): ejecuta el trabajo bajo un agente específico; si
  falta o es desconocido, el gateway vuelve al agente predeterminado.

Los trabajos se identifican por un `jobId` estable (usado por las API del CLI/Gateway).
En llamadas de herramienta del agente, `jobId` es canónico; el legado `id` se acepta por compatibilidad.
Los trabajos de una sola vez se eliminan automáticamente después del éxito por defecto; configure `deleteAfterRun: false` para conservarlos.

### Horarios

Cron admite tres tipos de horarios:

- `at`: marca de tiempo de una sola vez mediante `schedule.at` (ISO 8601).
- `every`: intervalo fijo (ms).
- `cron`: expresión cron de 5 campos con zona horaria IANA opcional.

Las expresiones cron usan `croner`. Si se omite una zona horaria, se utiliza la zona horaria local del host del Gateway.

### Ejecución principal vs aislada

#### Trabajos de sesion principal (eventos del sistema)

Los trabajos principales encolan un evento del sistema y opcionalmente despiertan el ejecutor de heartbeat.
Deben usar `payload.kind = "systemEvent"`.

- `wakeMode: "next-heartbeat"` (predeterminado): el evento espera al siguiente heartbeat programado.
- `wakeMode: "now"`: el evento activa una ejecución inmediata del heartbeat.

Es la mejor opción cuando desea el prompt normal de heartbeat + el contexto de la sesion principal.
Consulte [Heartbeat](/gateway/heartbeat).

#### Trabajos aislados (sesiones cron dedicadas)

Los trabajos aislados ejecutan un turno de agente dedicado en la sesion `cron:<jobId>`.

Comportamientos clave:

- El prompt se antepone con `[cron:<jobId> <job name>]` para trazabilidad.
- Cada ejecución inicia un **id de sesion nuevo** (sin arrastre de conversaciones previas).
- Comportamiento predeterminado: si se omite `delivery`, los trabajos aislados anuncian un resumen (`delivery.mode = "announce"`).
- `delivery.mode` (solo aislado) elige qué sucede:
  - `announce`: entrega un resumen al canal de destino y publica un breve resumen en la sesion principal.
  - `none`: solo interno (sin entrega, sin resumen de sesion principal).
- `wakeMode` controla cuándo se publica el resumen de la sesion principal:
  - `now`: heartbeat inmediato.
  - `next-heartbeat`: espera al siguiente heartbeat programado.

Use trabajos aislados para tareas ruidosas, frecuentes o “quehaceres en segundo plano” que no deberían
saturar su historial de chat principal.

### Formas de carga útil (qué se ejecuta)

Se admiten dos tipos de carga útil:

- `systemEvent`: solo sesion principal, enrutado a través del prompt de heartbeat.
- `agentTurn`: solo sesion aislada, ejecuta un turno de agente dedicado.

Campos comunes de `agentTurn`:

- `message`: prompt de texto requerido.
- `model` / `thinking`: anulaciones opcionales (ver abajo).
- `timeoutSeconds`: anulación opcional de tiempo de espera.

Configuración de entrega (solo trabajos aislados):

- `delivery.mode`: `none` | `announce`.
- `delivery.channel`: `last` o un canal específico.
- `delivery.to`: destino específico del canal (id de teléfono/chat/canal).
- `delivery.bestEffort`: evita que el trabajo falle si la entrega de anuncio falla.

La entrega por anuncio suprime los envíos de herramientas de mensajería durante la ejecución; use `delivery.channel`/`delivery.to`
para dirigir el chat en su lugar. Cuando `delivery.mode = "none"`, no se publica ningún resumen en la sesion principal.

Si se omite `delivery` para trabajos aislados, OpenClaw usa por defecto `announce`.

#### Flujo de entrega por anuncio

Cuando `delivery.mode = "announce"`, cron entrega directamente a través de los adaptadores de canal de salida.
El agente principal no se inicia para crear o reenviar el mensaje.

Detalles del comportamiento:

- Contenido: la entrega usa las cargas útiles salientes de la ejecución aislada (texto/medios) con la fragmentación normal y
  el formato del canal.
- Las respuestas solo de heartbeat (`HEARTBEAT_OK` sin contenido real) no se entregan.
- Si la ejecución aislada ya envió un mensaje al mismo destino mediante la herramienta de mensajería, la entrega se omite para evitar duplicados.
- Los destinos de entrega faltantes o inválidos hacen que el trabajo falle a menos que `delivery.bestEffort = true`.
- Se publica un breve resumen en la sesion principal solo cuando `delivery.mode = "announce"`.
- El resumen de la sesion principal respeta `wakeMode`: `now` activa un heartbeat inmediato y
  `next-heartbeat` espera al siguiente heartbeat programado.

### Anulaciones de modelo y thinking

Los trabajos aislados (`agentTurn`) pueden anular el modelo y el nivel de thinking:

- `model`: cadena proveedor/modelo (p. ej., `anthropic/claude-sonnet-4-20250514`) o alias (p. ej., `opus`)
- `thinking`: nivel de thinking (`off`, `minimal`, `low`, `medium`, `high`, `xhigh`; solo modelos GPT-5.2 + Codex)

Nota: También puede configurar `model` en trabajos de sesion principal, pero cambia el modelo de la sesion
principal compartida. Recomendamos anular el modelo solo para trabajos aislados para evitar
cambios de contexto inesperados.

Prioridad de resolución:

1. Anulación en la carga útil del trabajo (más alta)
2. Valores predeterminados específicos del hook (p. ej., `hooks.gmail.model`)
3. Valor predeterminado de la configuracion del agente

### Entrega (canal + destino)

Los trabajos aislados pueden entregar la salida a un canal mediante la configuracion de nivel superior `delivery`:

- `delivery.mode`: `announce` (entregar un resumen) o `none`.
- `delivery.channel`: `whatsapp` / `telegram` / `discord` / `slack` / `mattermost` (plugin) / `signal` / `imessage` / `last`.
- `delivery.to`: destino del destinatario específico del canal.

La configuracion de entrega solo es válida para trabajos aislados (`sessionTarget: "isolated"`).

Si se omite `delivery.channel` o `delivery.to`, cron puede recurrir a la “última ruta” de la sesion principal
(el último lugar donde el agente respondió).

Recordatorios de formato de destino:

- Los destinos de Slack/Discord/Mattermost (plugin) deben usar prefijos explícitos (p. ej., `channel:<id>`, `user:<id>`) para evitar ambigüedad.
- Los temas de Telegram deben usar el formato `:topic:` (ver abajo).

#### Destinos de entrega de Telegram (temas / hilos de foro)

Telegram admite temas de foro mediante `message_thread_id`. Para la entrega de cron, puede codificar
el tema/hilo en el campo `to`:

- `-1001234567890` (solo id de chat)
- `-1001234567890:topic:123` (preferido: marcador de tema explícito)
- `-1001234567890:123` (abreviado: sufijo numérico)

También se aceptan destinos con prefijo como `telegram:...` / `telegram:group:...`:

- `telegram:group:-1001234567890:topic:123`

## Esquema JSON para llamadas de herramienta

Use estas formas cuando llame directamente a las herramientas `cron.*` del Gateway (llamadas de herramienta del agente o RPC).
Los flags del CLI aceptan duraciones legibles como `20m`, pero las llamadas de herramienta deben usar una cadena ISO 8601
para `schedule.at` y milisegundos para `schedule.everyMs`.

### Parámetros de cron.add

Trabajo de una sola vez, sesion principal (evento del sistema):

```json
{
  "name": "Reminder",
  "schedule": { "kind": "at", "at": "2026-02-01T16:00:00Z" },
  "sessionTarget": "main",
  "wakeMode": "now",
  "payload": { "kind": "systemEvent", "text": "Reminder text" },
  "deleteAfterRun": true
}
```

Trabajo recurrente, aislado con entrega:

```json
{
  "name": "Morning brief",
  "schedule": { "kind": "cron", "expr": "0 7 * * *", "tz": "America/Los_Angeles" },
  "sessionTarget": "isolated",
  "wakeMode": "next-heartbeat",
  "payload": {
    "kind": "agentTurn",
    "message": "Summarize overnight updates."
  },
  "delivery": {
    "mode": "announce",
    "channel": "slack",
    "to": "channel:C1234567890",
    "bestEffort": true
  }
}
```

Notas:

- `schedule.kind`: `at` (`at`), `every` (`everyMs`), o `cron` (`expr`, opcional `tz`).
- `schedule.at` acepta ISO 8601 (zona horaria opcional; tratada como UTC cuando se omite).
- `everyMs` es en milisegundos.
- `sessionTarget` debe ser `"main"` o `"isolated"` y debe coincidir con `payload.kind`.
- Campos opcionales: `agentId`, `description`, `enabled`, `deleteAfterRun` (predetermina a true para `at`),
  `delivery`.
- `wakeMode` predetermina a `"next-heartbeat"` cuando se omite.

### Parámetros de cron.update

```json
{
  "jobId": "job-123",
  "patch": {
    "enabled": false,
    "schedule": { "kind": "every", "everyMs": 3600000 }
  }
}
```

Notas:

- `jobId` es canónico; `id` se acepta por compatibilidad.
- Use `agentId: null` en el parche para borrar una vinculación de agente.

### Parámetros de cron.run y cron.remove

```json
{ "jobId": "job-123", "mode": "force" }
```

```json
{ "jobId": "job-123" }
```

## Almacenamiento e historial

- Almacén de trabajos: `~/.openclaw/cron/jobs.json` (JSON gestionado por el Gateway).
- Historial de ejecuciones: `~/.openclaw/cron/runs/<jobId>.jsonl` (JSONL, depurado automáticamente).
- Anular ruta de almacenamiento: `cron.store` en la configuracion.

## Configuracion

```json5
{
  cron: {
    enabled: true, // default true
    store: "~/.openclaw/cron/jobs.json",
    maxConcurrentRuns: 1, // default 1
  },
}
```

Deshabilitar cron por completo:

- `cron.enabled: false` (config)
- `OPENCLAW_SKIP_CRON=1` (env)

## Inicio rapido del CLI

Recordatorio de una sola vez (ISO UTC, eliminación automática tras el éxito):

```bash
openclaw cron add \
  --name "Send reminder" \
  --at "2026-01-12T18:00:00Z" \
  --session main \
  --system-event "Reminder: submit expense report." \
  --wake now \
  --delete-after-run
```

Recordatorio de una sola vez (sesion principal, despertar inmediatamente):

```bash
openclaw cron add \
  --name "Calendar check" \
  --at "20m" \
  --session main \
  --system-event "Next heartbeat: check calendar." \
  --wake now
```

Trabajo aislado recurrente (anunciar a WhatsApp):

```bash
openclaw cron add \
  --name "Morning status" \
  --cron "0 7 * * *" \
  --tz "America/Los_Angeles" \
  --session isolated \
  --message "Summarize inbox + calendar for today." \
  --announce \
  --channel whatsapp \
  --to "+15551234567"
```

Trabajo aislado recurrente (entregar a un tema de Telegram):

```bash
openclaw cron add \
  --name "Nightly summary (topic)" \
  --cron "0 22 * * *" \
  --tz "America/Los_Angeles" \
  --session isolated \
  --message "Summarize today; send to the nightly topic." \
  --announce \
  --channel telegram \
  --to "-1001234567890:topic:123"
```

Trabajo aislado con anulación de modelo y thinking:

```bash
openclaw cron add \
  --name "Deep analysis" \
  --cron "0 6 * * 1" \
  --tz "America/Los_Angeles" \
  --session isolated \
  --message "Weekly deep analysis of project progress." \
  --model "opus" \
  --thinking high \
  --announce \
  --channel whatsapp \
  --to "+15551234567"
```

Selección de agente (configuraciones multiagente):

```bash
# Pin a job to agent "ops" (falls back to default if that agent is missing)
openclaw cron add --name "Ops sweep" --cron "0 6 * * *" --session isolated --message "Check ops queue" --agent ops

# Switch or clear the agent on an existing job
openclaw cron edit <jobId> --agent ops
openclaw cron edit <jobId> --clear-agent
```

Ejecución manual (depuración):

```bash
openclaw cron run <jobId> --force
```

Editar un trabajo existente (parchear campos):

```bash
openclaw cron edit <jobId> \
  --message "Updated prompt" \
  --model "opus" \
  --thinking low
```

Historial de ejecuciones:

```bash
openclaw cron runs --id <jobId> --limit 50
```

Evento del sistema inmediato sin crear un trabajo:

```bash
openclaw system event --mode now --text "Next heartbeat: check battery."
```

## Superficie de la API del Gateway

- `cron.list`, `cron.status`, `cron.add`, `cron.update`, `cron.remove`
- `cron.run` (forzar o vencido), `cron.runs`
  Para eventos del sistema inmediatos sin un trabajo, use [`openclaw system event`](/cli/system).

## Solucion de problemas

### “Nada se ejecuta”

- Verifique que cron esté habilitado: `cron.enabled` y `OPENCLAW_SKIP_CRON`.
- Verifique que el Gateway se esté ejecutando continuamente (cron se ejecuta dentro del proceso del Gateway).
- Para horarios `cron`: confirme la zona horaria (`--tz`) vs la zona horaria del host.

### Telegram entrega en el lugar incorrecto

- Para temas de foro, use `-100…:topic:<id>` para que sea explícito e inequívoco.
- Si ve prefijos `telegram:...` en los registros o en los destinos de “última ruta” almacenados, es normal;
  la entrega de cron los acepta y aun así analiza correctamente los IDs de tema.
