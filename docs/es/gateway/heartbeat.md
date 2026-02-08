---
summary: "Mensajes de sondeo de heartbeat y reglas de notificación"
read_when:
  - Ajustar la cadencia o la mensajería del heartbeat
  - Decidir entre heartbeat y cron para tareas programadas
title: "Heartbeat"
x-i18n:
  source_path: gateway/heartbeat.md
  source_hash: 27db9803263a5f2d
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:59:13Z
---

# Heartbeat (Gateway)

> **¿Heartbeat vs Cron?** Consulte [Cron vs Heartbeat](/automation/cron-vs-heartbeat) para obtener orientación sobre cuándo usar cada uno.

Heartbeat ejecuta **turnos periódicos del agente** en la sesión principal para que el modelo pueda
sacar a la luz cualquier cosa que requiera atención sin saturarle con mensajes.

## Inicio rapido (principiante)

1. Deje los heartbeats habilitados (el valor predeterminado es `30m`, o `1h` para Anthropic OAuth/setup-token) o establezca su propia cadencia.
2. Cree una pequeña lista de verificación `HEARTBEAT.md` en el espacio de trabajo del agente (opcional pero recomendado).
3. Decida a dónde deben ir los mensajes de heartbeat (`target: "last"` es el valor predeterminado).
4. Opcional: habilite la entrega de razonamiento del heartbeat para mayor transparencia.
5. Opcional: restrinja los heartbeats a horas activas (hora local).

Ejemplo de configuracion:

```json5
{
  agents: {
    defaults: {
      heartbeat: {
        every: "30m",
        target: "last",
        // activeHours: { start: "08:00", end: "24:00" },
        // includeReasoning: true, // optional: send separate `Reasoning:` message too
      },
    },
  },
}
```

## Valores predeterminados

- Intervalo: `30m` (o `1h` cuando Anthropic OAuth/setup-token es el modo de autenticacion detectado). Establezca `agents.defaults.heartbeat.every` o por agente `agents.list[].heartbeat.every`; use `0m` para deshabilitar.
- Cuerpo del prompt (configurable via `agents.defaults.heartbeat.prompt`):
  `Read HEARTBEAT.md if it exists (workspace context). Follow it strictly. Do not infer or repeat old tasks from prior chats. If nothing needs attention, reply HEARTBEAT_OK.`
- El prompt de heartbeat se envía **verbatim** como el mensaje del usuario. El prompt del sistema
  incluye una seccion “Heartbeat” y la ejecucion se marca internamente.
- Las horas activas (`heartbeat.activeHours`) se verifican en la zona horaria configurada.
  Fuera de la ventana, los heartbeats se omiten hasta el siguiente tick dentro de la ventana.

## Para que sirve el prompt de heartbeat

El prompt predeterminado es intencionalmente amplio:

- **Tareas en segundo plano**: “Consider outstanding tasks” impulsa al agente a revisar
  seguimientos (bandeja de entrada, calendario, recordatorios, trabajo en cola) y sacar a la luz cualquier cosa urgente.
- **Chequeo humano**: “Checkup sometimes on your human during day time” impulsa
  un mensaje ocasional y liviano del tipo “¿necesita algo?”, pero evita el spam nocturno
  usando su zona horaria local configurada (ver [/concepts/timezone](/concepts/timezone)).

Si desea que un heartbeat haga algo muy específico (p. ej., “check Gmail PubSub
stats” o “verify gateway health”), establezca `agents.defaults.heartbeat.prompt` (o
`agents.list[].heartbeat.prompt`) con un cuerpo personalizado (enviado verbatim).

## Contrato de respuesta

- Si no se necesita atencion, responda con **`HEARTBEAT_OK`**.
- Durante ejecuciones de heartbeat, OpenClaw trata `HEARTBEAT_OK` como un acuse cuando aparece
  al **inicio o al final** de la respuesta. El token se elimina y la respuesta se
  descarta si el contenido restante es **≤ `ackMaxChars`** (predeterminado: 300).
- Si `HEARTBEAT_OK` aparece en el **medio** de una respuesta, no se trata de forma
  especial.
- Para alertas, **no** incluya `HEARTBEAT_OK`; devuelva solo el texto de la alerta.

Fuera de los heartbeats, cualquier `HEARTBEAT_OK` suelto al inicio/final de un mensaje se elimina
y se registra; un mensaje que sea solo `HEARTBEAT_OK` se descarta.

## Configuracion

```json5
{
  agents: {
    defaults: {
      heartbeat: {
        every: "30m", // default: 30m (0m disables)
        model: "anthropic/claude-opus-4-6",
        includeReasoning: false, // default: false (deliver separate Reasoning: message when available)
        target: "last", // last | none | <channel id> (core or plugin, e.g. "bluebubbles")
        to: "+15551234567", // optional channel-specific override
        accountId: "ops-bot", // optional multi-account channel id
        prompt: "Read HEARTBEAT.md if it exists (workspace context). Follow it strictly. Do not infer or repeat old tasks from prior chats. If nothing needs attention, reply HEARTBEAT_OK.",
        ackMaxChars: 300, // max chars allowed after HEARTBEAT_OK
      },
    },
  },
}
```

### Alcance y precedencia

- `agents.defaults.heartbeat` establece el comportamiento global del heartbeat.
- `agents.list[].heartbeat` se fusiona por encima; si algun agente tiene un bloque `heartbeat`, **solo esos agentes** ejecutan heartbeats.
- `channels.defaults.heartbeat` establece valores predeterminados de visibilidad para todos los canales.
- `channels.<channel>.heartbeat` anula los valores predeterminados del canal.
- `channels.<channel>.accounts.<id>.heartbeat` (canales multi-cuenta) anula la configuracion por canal.

### Heartbeats por agente

Si alguna entrada `agents.list[]` incluye un bloque `heartbeat`, **solo esos agentes**
ejecutan heartbeats. El bloque por agente se fusiona por encima de `agents.defaults.heartbeat`
(para que pueda establecer valores compartidos una sola vez y anularlos por agente).

Ejemplo: dos agentes, solo el segundo agente ejecuta heartbeats.

```json5
{
  agents: {
    defaults: {
      heartbeat: {
        every: "30m",
        target: "last",
      },
    },
    list: [
      { id: "main", default: true },
      {
        id: "ops",
        heartbeat: {
          every: "1h",
          target: "whatsapp",
          to: "+15551234567",
          prompt: "Read HEARTBEAT.md if it exists (workspace context). Follow it strictly. Do not infer or repeat old tasks from prior chats. If nothing needs attention, reply HEARTBEAT_OK.",
        },
      },
    ],
  },
}
```

### Ejemplo de horas activas

Restrinja los heartbeats al horario laboral en una zona horaria específica:

```json5
{
  agents: {
    defaults: {
      heartbeat: {
        every: "30m",
        target: "last",
        activeHours: {
          start: "09:00",
          end: "22:00",
          timezone: "America/New_York", // optional; uses your userTimezone if set, otherwise host tz
        },
      },
    },
  },
}
```

Fuera de esta ventana (antes de las 9 a. m. o después de las 10 p. m. hora del Este), los heartbeats se omiten. El siguiente tick programado dentro de la ventana se ejecutará con normalidad.

### Ejemplo de multi-cuenta

Use `accountId` para apuntar a una cuenta específica en canales multi-cuenta como Telegram:

```json5
{
  agents: {
    list: [
      {
        id: "ops",
        heartbeat: {
          every: "1h",
          target: "telegram",
          to: "12345678",
          accountId: "ops-bot",
        },
      },
    ],
  },
  channels: {
    telegram: {
      accounts: {
        "ops-bot": { botToken: "YOUR_TELEGRAM_BOT_TOKEN" },
      },
    },
  },
}
```

### Notas de campos

- `every`: intervalo de heartbeat (cadena de duracion; unidad predeterminada = minutos).
- `model`: anulacion opcional del modelo para ejecuciones de heartbeat (`provider/model`).
- `includeReasoning`: cuando esta habilitado, tambien entrega el mensaje separado `Reasoning:` cuando esta disponible (misma forma que `/reasoning on`).
- `session`: clave de sesion opcional para ejecuciones de heartbeat.
  - `main` (predeterminado): sesion principal del agente.
  - Clave de sesion explicita (copie desde `openclaw sessions --json` o el [CLI de sesiones](/cli/sessions)).
  - Formatos de clave de sesion: ver [Sessions](/concepts/session) y [Groups](/concepts/groups).
- `target`:
  - `last` (predeterminado): entrega al ultimo canal externo utilizado.
  - canal explicito: `whatsapp` / `telegram` / `discord` / `googlechat` / `slack` / `msteams` / `signal` / `imessage`.
  - `none`: ejecute el heartbeat pero **no entregue** externamente.
- `to`: anulacion opcional del destinatario (id especifico del canal, p. ej., E.164 para WhatsApp o un id de chat de Telegram).
- `accountId`: id de cuenta opcional para canales multi-cuenta. Cuando `target: "last"`, el id de cuenta se aplica al ultimo canal resuelto si admite cuentas; de lo contrario se ignora. Si el id de cuenta no coincide con una cuenta configurada para el canal resuelto, la entrega se omite.
- `prompt`: anula el cuerpo del prompt predeterminado (no se fusiona).
- `ackMaxChars`: maximo de caracteres permitidos despues de `HEARTBEAT_OK` antes de la entrega.
- `activeHours`: restringe las ejecuciones de heartbeat a una ventana de tiempo. Objeto con `start` (HH:MM, inclusivo), `end` (HH:MM exclusivo; se permite `24:00` para fin de dia), y `timezone` opcional.
  - Omitido o `"user"`: usa su `agents.defaults.userTimezone` si esta configurado; de lo contrario, recurre a la zona horaria del sistema anfitrion.
  - `"local"`: siempre usa la zona horaria del sistema anfitrion.
  - Cualquier identificador IANA (p. ej., `America/New_York`): se usa directamente; si no es valido, recurre al comportamiento `"user"` anterior.
  - Fuera de la ventana activa, los heartbeats se omiten hasta el siguiente tick dentro de la ventana.

## Comportamiento de entrega

- Los heartbeats se ejecutan en la sesion principal del agente de forma predeterminada (`agent:<id>:<mainKey>`),
  o `global` cuando `session.scope = "global"`. Establezca `session` para anular a una
  sesion de canal específica (Discord/WhatsApp/etc.).
- `session` solo afecta el contexto de ejecucion; la entrega esta controlada por `target` y `to`.
- Para entregar a un canal/destinatario específico, establezca `target` + `to`. Con
  `target: "last"`, la entrega usa el ultimo canal externo para esa sesion.
- Si la cola principal esta ocupada, el heartbeat se omite y se reintenta mas tarde.
- Si `target` se resuelve a ningun destino externo, la ejecucion aun ocurre pero no se envia
  ningun mensaje saliente.
- Las respuestas solo de heartbeat **no** mantienen viva la sesion; el ultimo `updatedAt`
  se restaura para que la expiracion por inactividad se comporte con normalidad.

## Controles de visibilidad

De forma predeterminada, los acuses `HEARTBEAT_OK` se suprimen mientras que el contenido de alerta se
entrega. Puede ajustar esto por canal o por cuenta:

```yaml
channels:
  defaults:
    heartbeat:
      showOk: false # Hide HEARTBEAT_OK (default)
      showAlerts: true # Show alert messages (default)
      useIndicator: true # Emit indicator events (default)
  telegram:
    heartbeat:
      showOk: true # Show OK acknowledgments on Telegram
  whatsapp:
    accounts:
      work:
        heartbeat:
          showAlerts: false # Suppress alert delivery for this account
```

Precedencia: por cuenta → por canal → valores predeterminados del canal → valores predeterminados integrados.

### Que hace cada bandera

- `showOk`: envia un acuse `HEARTBEAT_OK` cuando el modelo devuelve una respuesta solo-OK.
- `showAlerts`: envia el contenido de alerta cuando el modelo devuelve una respuesta no-OK.
- `useIndicator`: emite eventos de indicador para superficies de estado de la UI.

Si **las tres** son falsas, OpenClaw omite la ejecucion del heartbeat por completo (sin llamada al modelo).

### Ejemplos por canal vs por cuenta

```yaml
channels:
  defaults:
    heartbeat:
      showOk: false
      showAlerts: true
      useIndicator: true
  slack:
    heartbeat:
      showOk: true # all Slack accounts
    accounts:
      ops:
        heartbeat:
          showAlerts: false # suppress alerts for the ops account only
  telegram:
    heartbeat:
      showOk: true
```

### Patrones comunes

| Objetivo                                                         | Configuracion                                                                            |
| ---------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| Comportamiento predeterminado (OKs silenciosos, alertas activas) | _(no se necesita configuracion)_                                                         |
| Totalmente silencioso (sin mensajes, sin indicador)              | `channels.defaults.heartbeat: { showOk: false, showAlerts: false, useIndicator: false }` |
| Solo indicador (sin mensajes)                                    | `channels.defaults.heartbeat: { showOk: false, showAlerts: false, useIndicator: true }`  |
| OKs solo en un canal                                             | `channels.telegram.heartbeat: { showOk: true }`                                          |

## HEARTBEAT.md (opcional)

Si existe un archivo `HEARTBEAT.md` en el espacio de trabajo, el prompt predeterminado indica al
agente que lo lea. Piense en el como su “lista de verificacion de heartbeat”: pequeña, estable y
segura para incluir cada 30 minutos.

Si existe `HEARTBEAT.md` pero esta efectivamente vacio (solo lineas en blanco y encabezados de markdown como `# Heading`), OpenClaw omite la ejecucion del heartbeat para ahorrar llamadas a la API.
Si el archivo falta, el heartbeat aun se ejecuta y el modelo decide que hacer.

Mantengalo pequeno (lista corta de verificacion o recordatorios) para evitar inflar el prompt.

Ejemplo de `HEARTBEAT.md`:

```md
# Heartbeat checklist

- Quick scan: anything urgent in inboxes?
- If it’s daytime, do a lightweight check-in if nothing else is pending.
- If a task is blocked, write down _what is missing_ and ask Peter next time.
```

### ¿Puede el agente actualizar HEARTBEAT.md?

Si — si usted se lo pide.

`HEARTBEAT.md` es solo un archivo normal en el espacio de trabajo del agente, por lo que puede
decirle al agente (en un chat normal) algo como:

- “Actualice `HEARTBEAT.md` para agregar una revision diaria del calendario.”
- “Reescriba `HEARTBEAT.md` para que sea mas corto y enfocado en seguimientos de la bandeja de entrada.”

Si desea que esto ocurra de forma proactiva, tambien puede incluir una linea explicita en
su prompt de heartbeat como: “Si la lista de verificacion se vuelve obsoleta, actualice HEARTBEAT.md
con una mejor.”

Nota de seguridad: no ponga secretos (claves de API, numeros de telefono, tokens privados) en
`HEARTBEAT.md` — pasa a formar parte del contexto del prompt.

## Activacion manual (bajo demanda)

Puede encolar un evento del sistema y activar un heartbeat inmediato con:

```bash
openclaw system event --text "Check for urgent follow-ups" --mode now
```

Si varios agentes tienen `heartbeat` configurado, una activacion manual ejecuta inmediatamente
los heartbeats de cada uno de esos agentes.

Use `--mode next-heartbeat` para esperar al siguiente tick programado.

## Entrega de razonamiento (opcional)

De forma predeterminada, los heartbeats entregan solo la carga final de “respuesta”.

Si desea transparencia, habilite:

- `agents.defaults.heartbeat.includeReasoning: true`

Cuando esta habilitado, los heartbeats tambien entregaran un mensaje separado con el prefijo
`Reasoning:` (misma forma que `/reasoning on`). Esto puede ser util cuando el agente
administra multiples sesiones/codices y usted quiere ver por que decidio avisarle —
pero tambien puede filtrar mas detalle interno del que desea. Prefiera mantenerlo
desactivado en chats grupales.

## Conciencia de costos

Los heartbeats ejecutan turnos completos del agente. Intervalos mas cortos consumen mas tokens.
Mantenga `HEARTBEAT.md` pequeno y considere un `model` o `target: "none"` mas economico si
solo desea actualizaciones de estado internas.
