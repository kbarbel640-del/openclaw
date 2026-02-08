---
summary: "Reglas de gestion de sesiones, claves y persistencia para chats"
read_when:
  - Modifying session handling or storage
title: "Gestion de Sesiones"
x-i18n:
  source_path: concepts/session.md
  source_hash: 1486759a5c2fdced
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:58:53Z
---

# Gestion de Sesiones

OpenClaw trata **una sesion de chat directo por agente** como primaria. Los chats directos colapsan a `agent:<agentId>:<mainKey>` (por defecto `main`), mientras que los chats de grupo/canal obtienen sus propias claves. Se respeta `session.mainKey`.

Use `session.dmScope` para controlar como se agrupan los **mensajes directos**:

- `main` (por defecto): todos los MD comparten la sesion principal para continuidad.
- `per-peer`: aislar por id de remitente entre canales.
- `per-channel-peer`: aislar por canal + remitente (recomendado para bandejas de entrada multiusuario).
- `per-account-channel-peer`: aislar por cuenta + canal + remitente (recomendado para bandejas de entrada multicuentas).
  Use `session.identityLinks` para mapear ids de pares con prefijo de proveedor a una identidad canonica, de modo que la misma persona comparta una sesion de MD entre canales cuando use `per-peer`, `per-channel-peer` o `per-account-channel-peer`.

### Modo de MD seguro (recomendado para configuraciones multiusuario)

> **Advertencia de seguridad:** Si su agente puede recibir MD de **multiples personas**, deberia considerar firmemente habilitar el modo de MD seguro. Sin el, todos los usuarios comparten el mismo contexto de conversacion, lo que puede filtrar informacion privada entre usuarios.

**Ejemplo del problema con la configuracion predeterminada:**

- Alicia (`<SENDER_A>`) le escribe a su agente sobre un tema privado (por ejemplo, una cita medica)
- Bob (`<SENDER_B>`) le escribe a su agente preguntando "¿De que estabamos hablando?"
- Debido a que ambos MD comparten la misma sesion, el modelo puede responder a Bob usando el contexto previo de Alicia.

**La solucion:** Establezca `dmScope` para aislar sesiones por usuario:

```json5
// ~/.openclaw/openclaw.json
{
  session: {
    // Secure DM mode: isolate DM context per channel + sender.
    dmScope: "per-channel-peer",
  },
}
```

**Cuando habilitar esto:**

- Tiene aprobaciones de emparejamiento para mas de un remitente
- Usa una lista de permitidos de MD con multiples entradas
- Establece `dmPolicy: "open"`
- Multiples numeros de telefono o cuentas pueden escribirle a su agente

Notas:

- El valor predeterminado es `dmScope: "main"` para continuidad (todos los MD comparten la sesion principal). Esto esta bien para configuraciones de un solo usuario.
- Para bandejas de entrada multicuentas en el mismo canal, prefiera `per-account-channel-peer`.
- Si la misma persona se comunica con usted en multiples canales, use `session.identityLinks` para colapsar sus sesiones de MD en una sola identidad canonica.
- Puede verificar su configuracion de MD con `openclaw security audit` (vea [security](/cli/security)).

## Gateway es la fuente de la verdad

Todo el estado de sesion es **propiedad del gateway** (el OpenClaw “maestro”). Los clientes de UI (app de macOS, WebChat, etc.) deben consultar al gateway para obtener listas de sesiones y conteos de tokens en lugar de leer archivos locales.

- En **modo remoto**, el almacenamiento de sesiones que importa vive en el host remoto del gateway, no en su Mac.
- Los conteos de tokens mostrados en las UIs provienen de los campos del almacén del gateway (`inputTokens`, `outputTokens`, `totalTokens`, `contextTokens`). Los clientes no analizan transcripciones JSONL para “arreglar” totales.

## Donde vive el estado

- En el **host del gateway**:
  - Archivo de almacenamiento: `~/.openclaw/agents/<agentId>/sessions/sessions.json` (por agente).
- Transcripciones: `~/.openclaw/agents/<agentId>/sessions/<SessionId>.jsonl` (las sesiones de temas de Telegram usan `.../<SessionId>-topic-<threadId>.jsonl`).
- El almacen es un mapa `sessionKey -> { sessionId, updatedAt, ... }`. Eliminar entradas es seguro; se recrean bajo demanda.
- Las entradas de grupo pueden incluir `displayName`, `channel`, `subject`, `room` y `space` para etiquetar sesiones en las UIs.
- Las entradas de sesion incluyen metadatos `origin` (etiqueta + pistas de enrutamiento) para que las UIs puedan explicar de donde provino una sesion.
- OpenClaw **no** lee carpetas de sesiones heredadas de Pi/Tau.

## Poda de sesiones

OpenClaw recorta **resultados antiguos de herramientas** del contexto en memoria justo antes de las llamadas al LLM por defecto.
Esto **no** reescribe el historial JSONL. Vea [/concepts/session-pruning](/concepts/session-pruning).

## Vaciado de memoria previo a la compactacion

Cuando una sesion se acerca a la auto-compactacion, OpenClaw puede ejecutar un **vaciado silencioso de memoria**
que recuerda al modelo escribir notas duraderas en disco. Esto solo se ejecuta cuando
el espacio de trabajo es escribible. Vea [Memory](/concepts/memory) y
[Compaction](/concepts/compaction).

## Mapeo de transportes → claves de sesion

- Los chats directos siguen `session.dmScope` (por defecto `main`).
  - `main`: `agent:<agentId>:<mainKey>` (continuidad entre dispositivos/canales).
    - Multiples numeros de telefono y canales pueden mapearse a la misma clave principal del agente; actuan como transportes hacia una sola conversacion.
  - `per-peer`: `agent:<agentId>:dm:<peerId>`.
  - `per-channel-peer`: `agent:<agentId>:<channel>:dm:<peerId>`.
  - `per-account-channel-peer`: `agent:<agentId>:<channel>:<accountId>:dm:<peerId>` (accountId por defecto es `default`).
  - Si `session.identityLinks` coincide con un id de par con prefijo de proveedor (por ejemplo `telegram:123`), la clave canonica reemplaza a `<peerId>` para que la misma persona comparta una sesion entre canales.
- Los chats de grupo aislan el estado: `agent:<agentId>:<channel>:group:<id>` (salas/canales usan `agent:<agentId>:<channel>:channel:<id>`).
  - Los temas de foros de Telegram agregan `:topic:<threadId>` al id de grupo para el aislamiento.
  - Las claves heredadas `group:<id>` aun se reconocen para migracion.
- Los contextos entrantes aun pueden usar `group:<id>`; el canal se infiere desde `Provider` y se normaliza a la forma canonica `agent:<agentId>:<channel>:group:<id>`.
- Otras fuentes:
  - Trabajos cron: `cron:<job.id>`
  - Webhooks: `hook:<uuid>` (a menos que el hook lo establezca explicitamente)
  - Ejecuciones de nodos: `node-<nodeId>`

## Ciclo de vida

- Politica de reinicio: las sesiones se reutilizan hasta que expiran, y la expiracion se evalua en el siguiente mensaje entrante.
- Reinicio diario: por defecto a las **4:00 AM hora local en el host del gateway**. Una sesion esta obsoleta una vez que su ultima actualizacion es anterior al tiempo de reinicio diario mas reciente.
- Reinicio por inactividad (opcional): `idleMinutes` agrega una ventana deslizante de inactividad. Cuando se configuran ambos reinicios, diario y por inactividad, **el que expire primero** fuerza una nueva sesion.
- Modo heredado solo por inactividad: si establece `session.idleMinutes` sin ninguna configuracion `session.reset`/`resetByType`, OpenClaw permanece en modo solo por inactividad por compatibilidad hacia atras.
- Anulaciones por tipo (opcional): `resetByType` le permite anular la politica para sesiones `dm`, `group` y `thread` (hilo = hilos de Slack/Discord, temas de Telegram, hilos de Matrix cuando el conector los proporciona).
- Anulaciones por canal (opcional): `resetByChannel` anula la politica de reinicio para un canal (aplica a todos los tipos de sesion para ese canal y tiene prioridad sobre `reset`/`resetByType`).
- Disparadores de reinicio: `/new` o `/reset` exactos (mas cualquier extra en `resetTriggers`) inician un id de sesion nuevo y pasan el resto del mensaje. `/new <model>` acepta un alias de modelo, `provider/model` o nombre de proveedor (coincidencia difusa) para establecer el modelo de la nueva sesion. Si `/new` o `/reset` se envia solo, OpenClaw ejecuta un breve turno de saludo “hola” para confirmar el reinicio.
- Reinicio manual: elimine claves especificas del almacen o quite la transcripcion JSONL; el siguiente mensaje las recrea.
- Los trabajos cron aislados siempre generan una `sessionId` nueva por ejecucion (sin reutilizacion por inactividad).

## Politica de envio (opcional)

Bloquee la entrega para tipos de sesion especificos sin listar ids individuales.

```json5
{
  session: {
    sendPolicy: {
      rules: [
        { action: "deny", match: { channel: "discord", chatType: "group" } },
        { action: "deny", match: { keyPrefix: "cron:" } },
      ],
      default: "allow",
    },
  },
}
```

Anulacion en tiempo de ejecucion (solo propietario):

- `/send on` → permitir para esta sesion
- `/send off` → denegar para esta sesion
- `/send inherit` → limpiar la anulacion y usar reglas de configuracion
  Envie estos como mensajes independientes para que se registren.

## Configuracion (ejemplo opcional de cambio de nombre)

```json5
// ~/.openclaw/openclaw.json
{
  session: {
    scope: "per-sender", // keep group keys separate
    dmScope: "main", // DM continuity (set per-channel-peer/per-account-channel-peer for shared inboxes)
    identityLinks: {
      alice: ["telegram:123456789", "discord:987654321012345678"],
    },
    reset: {
      // Defaults: mode=daily, atHour=4 (gateway host local time).
      // If you also set idleMinutes, whichever expires first wins.
      mode: "daily",
      atHour: 4,
      idleMinutes: 120,
    },
    resetByType: {
      thread: { mode: "daily", atHour: 4 },
      dm: { mode: "idle", idleMinutes: 240 },
      group: { mode: "idle", idleMinutes: 120 },
    },
    resetByChannel: {
      discord: { mode: "idle", idleMinutes: 10080 },
    },
    resetTriggers: ["/new", "/reset"],
    store: "~/.openclaw/agents/{agentId}/sessions/sessions.json",
    mainKey: "main",
  },
}
```

## Inspeccion

- `openclaw status` — muestra la ruta del almacen y sesiones recientes.
- `openclaw sessions --json` — vuelca cada entrada (filtre con `--active <minutes>`).
- `openclaw gateway call sessions.list --params '{}'` — obtiene sesiones del gateway en ejecucion (use `--url`/`--token` para acceso a gateway remoto).
- Envie `/status` como mensaje independiente en el chat para ver si el agente es alcanzable, cuanto del contexto de la sesion se usa, los alternadores actuales de razonamiento/detallado y cuando se actualizaron por ultima vez sus credenciales web de WhatsApp (ayuda a detectar necesidades de reconexion).
- Envie `/context list` o `/context detail` para ver que hay en el prompt del sistema y los archivos del espacio de trabajo inyectados (y los mayores contribuyentes de contexto).
- Envie `/stop` como mensaje independiente para abortar la ejecucion actual, limpiar seguimientos en cola para esa sesion y detener cualquier ejecucion de subagentes generada a partir de ella (la respuesta incluye el conteo detenido).
- Envie `/compact` (instrucciones opcionales) como mensaje independiente para resumir contexto antiguo y liberar espacio de ventana. Vea [/concepts/compaction](/concepts/compaction).
- Las transcripciones JSONL pueden abrirse directamente para revisar turnos completos.

## Consejos

- Mantenga la clave primaria dedicada al trafico 1:1; deje que los grupos mantengan sus propias claves.
- Al automatizar la limpieza, elimine claves individuales en lugar de todo el almacen para preservar contexto en otros lugares.

## Metadatos de origen de sesion

Cada entrada de sesion registra de donde provino (mejor esfuerzo) en `origin`:

- `label`: etiqueta humana (resuelta a partir de la etiqueta de conversacion + asunto del grupo/canal)
- `provider`: id de canal normalizado (incluyendo extensiones)
- `from`/`to`: ids de enrutamiento en bruto del sobre entrante
- `accountId`: id de cuenta del proveedor (cuando es multicuentas)
- `threadId`: id de hilo/tema cuando el canal lo admite
  Los campos de origen se rellenan para mensajes directos, canales y grupos. Si un
  conector solo actualiza el enrutamiento de entrega (por ejemplo, para mantener fresca
  una sesion principal de MD), aun deberia proporcionar contexto entrante para que la sesion
  conserve sus metadatos explicativos. Las extensiones pueden hacer esto enviando `ConversationLabel`,
  `GroupSubject`, `GroupChannel`, `GroupSpace` y `SenderName` en el contexto entrante
  y llamando a `recordSessionMetaFromInbound` (o pasando el mismo contexto
  a `updateLastRoute`).
