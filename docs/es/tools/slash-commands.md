---
summary: "Comandos slash: texto vs nativos, configuracion y comandos compatibles"
read_when:
  - Uso o configuracion de comandos de chat
  - Depuracion del enrutamiento de comandos o permisos
title: "Comandos Slash"
x-i18n:
  source_path: tools/slash-commands.md
  source_hash: ca0deebf89518e8c
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:00:36Z
---

# Comandos slash

Los comandos son manejados por el Gateway. La mayoria de los comandos deben enviarse como un mensaje **independiente** que comience con `/`.
El comando de chat bash solo para el host usa `! <cmd>` (con `/bash <cmd>` como alias).

Hay dos sistemas relacionados:

- **Comandos**: mensajes `/...` independientes.
- **Directivas**: `/think`, `/verbose`, `/reasoning`, `/elevated`, `/exec`, `/model`, `/queue`.
  - Las directivas se eliminan del mensaje antes de que el modelo lo vea.
  - En mensajes de chat normales (no solo directivas), se tratan como “pistas en linea” y **no** persisten la configuracion de la sesion.
  - En mensajes solo de directivas (el mensaje contiene solo directivas), persisten en la sesion y responden con una confirmacion.
  - Las directivas solo se aplican para **remitentes autorizados** (allowlists/emparejamiento de canal mas `commands.useAccessGroups`).
    Los remitentes no autorizados ven las directivas tratadas como texto plano.

Tambien hay algunos **atajos en linea** (solo remitentes allowlisted/autorizados): `/help`, `/commands`, `/status`, `/whoami` (`/id`).
Se ejecutan de inmediato, se eliminan antes de que el modelo vea el mensaje, y el texto restante continua por el flujo normal.

## Configuracion

```json5
{
  commands: {
    native: "auto",
    nativeSkills: "auto",
    text: true,
    bash: false,
    bashForegroundMs: 2000,
    config: false,
    debug: false,
    restart: false,
    useAccessGroups: true,
  },
}
```

- `commands.text` (por defecto `true`) habilita el analisis de `/...` en mensajes de chat.
  - En superficies sin comandos nativos (WhatsApp/WebChat/Signal/iMessage/Google Chat/MS Teams), los comandos de texto aun funcionan incluso si establece esto en `false`.
- `commands.native` (por defecto `"auto"`) registra comandos nativos.
  - Auto: activado para Discord/Telegram; desactivado para Slack (hasta que agregue comandos slash); ignorado para proveedores sin soporte nativo.
  - Establezca `channels.discord.commands.native`, `channels.telegram.commands.native` o `channels.slack.commands.native` para anular por proveedor (bool o `"auto"`).
  - `false` limpia los comandos previamente registrados en Discord/Telegram al inicio. Los comandos de Slack se administran en la app de Slack y no se eliminan automaticamente.
- `commands.nativeSkills` (por defecto `"auto"`) registra comandos de **skill** de forma nativa cuando es compatible.
  - Auto: activado para Discord/Telegram; desactivado para Slack (Slack requiere crear un comando slash por skill).
  - Establezca `channels.discord.commands.nativeSkills`, `channels.telegram.commands.nativeSkills` o `channels.slack.commands.nativeSkills` para anular por proveedor (bool o `"auto"`).
- `commands.bash` (por defecto `false`) habilita `! <cmd>` para ejecutar comandos del shell del host (`/bash <cmd>` es un alias; requiere allowlists `tools.elevated`).
- `commands.bashForegroundMs` (por defecto `2000`) controla cuanto tiempo espera bash antes de cambiar a modo en segundo plano (`0` pasa a segundo plano de inmediato).
- `commands.config` (por defecto `false`) habilita `/config` (lee/escribe `openclaw.json`).
- `commands.debug` (por defecto `false`) habilita `/debug` (anulaciones solo en tiempo de ejecucion).
- `commands.useAccessGroups` (por defecto `true`) aplica allowlists/politicas para comandos.

## Lista de comandos

Texto + nativo (cuando esta habilitado):

- `/help`
- `/commands`
- `/skill <name> [input]` (ejecutar una skill por nombre)
- `/status` (mostrar el estado actual; incluye uso/cuota del proveedor para el proveedor de modelo actual cuando esta disponible)
- `/allowlist` (listar/agregar/eliminar entradas de allowlist)
- `/approve <id> allow-once|allow-always|deny` (resolver solicitudes de aprobacion de exec)
- `/context [list|detail|json]` (explicar “contexto”; `detail` muestra el tamaño por archivo + por herramienta + por skill + del prompt del sistema)
- `/whoami` (mostrar su id de remitente; alias: `/id`)
- `/subagents list|stop|log|info|send` (inspeccionar, detener, registrar o enviar mensajes a ejecuciones de sub-agentes para la sesion actual)
- `/config show|get|set|unset` (persistir configuracion en disco, solo propietario; requiere `commands.config: true`)
- `/debug show|set|unset|reset` (anulaciones en tiempo de ejecucion, solo propietario; requiere `commands.debug: true`)
- `/usage off|tokens|full|cost` (pie de uso por respuesta o resumen de costo local)
- `/tts off|always|inbound|tagged|status|provider|limit|summary|audio` (controlar TTS; vea [/tts](/tts))
  - Discord: el comando nativo es `/voice` (Discord reserva `/tts`); el texto `/tts` aun funciona.
- `/stop`
- `/restart`
- `/dock-telegram` (alias: `/dock_telegram`) (cambiar respuestas a Telegram)
- `/dock-discord` (alias: `/dock_discord`) (cambiar respuestas a Discord)
- `/dock-slack` (alias: `/dock_slack`) (cambiar respuestas a Slack)
- `/activation mention|always` (solo grupos)
- `/send on|off|inherit` (solo propietario)
- `/reset` o `/new [model]` (pista opcional de modelo; el resto se pasa tal cual)
- `/think <off|minimal|low|medium|high|xhigh>` (opciones dinamicas por modelo/proveedor; aliases: `/thinking`, `/t`)
- `/verbose on|full|off` (alias: `/v`)
- `/reasoning on|off|stream` (alias: `/reason`; cuando esta activado, envia un mensaje separado con prefijo `Reasoning:`; `stream` = solo borrador de Telegram)
- `/elevated on|off|ask|full` (alias: `/elev`; `full` omite aprobaciones de exec)
- `/exec host=<sandbox|gateway|node> security=<deny|allowlist|full> ask=<off|on-miss|always> node=<id>` (envie `/exec` para mostrar el actual)
- `/model <name>` (alias: `/models`; o `/<alias>` desde `agents.defaults.models.*.alias`)
- `/queue <mode>` (mas opciones como `debounce:2s cap:25 drop:summarize`; envie `/queue` para ver la configuracion actual)
- `/bash <command>` (solo host; alias de `! <command>`; requiere allowlists `commands.bash: true` + `tools.elevated`)

Solo texto:

- `/compact [instructions]` (vea [/concepts/compaction](/concepts/compaction))
- `! <command>` (solo host; uno a la vez; use `!poll` + `!stop` para trabajos de larga duracion)
- `!poll` (ver salida / estado; acepta `sessionId` opcional; `/bash poll` tambien funciona)
- `!stop` (detener el trabajo bash en ejecucion; acepta `sessionId` opcional; `/bash stop` tambien funciona)

Notas:

- Los comandos aceptan un `:` opcional entre el comando y los argumentos (p. ej., `/think: high`, `/send: on`, `/help:`).
- `/new <model>` acepta un alias de modelo, `provider/model` o un nombre de proveedor (coincidencia difusa); si no hay coincidencia, el texto se trata como el cuerpo del mensaje.
- Para el desglose completo de uso por proveedor, use `openclaw status --usage`.
- `/allowlist add|remove` requiere `commands.config=true` y respeta el `configWrites` del canal.
- `/usage` controla el pie de uso por respuesta; `/usage cost` imprime un resumen de costo local desde los registros de sesion de OpenClaw.
- `/restart` esta deshabilitado por defecto; establezca `commands.restart: true` para habilitarlo.
- `/verbose` esta pensado para depuracion y visibilidad adicional; mantengalo **apagado** en uso normal.
- `/reasoning` (y `/verbose`) son riesgosos en configuraciones de grupo: pueden revelar razonamiento interno o salida de herramientas que no pretendia exponer. Prefiera dejarlos apagados, especialmente en chats grupales.
- **Ruta rapida:** los mensajes solo de comandos de remitentes allowlisted se manejan de inmediato (evitan cola + modelo).
- **Bloqueo por mencion en grupos:** los mensajes solo de comandos de remitentes allowlisted evitan los requisitos de mencion.
- **Atajos en linea (solo remitentes allowlisted):** ciertos comandos tambien funcionan cuando se incrustan en un mensaje normal y se eliminan antes de que el modelo vea el texto restante.
  - Ejemplo: `hey /status` activa una respuesta de estado, y el texto restante continua por el flujo normal.
- Actualmente: `/help`, `/commands`, `/status`, `/whoami` (`/id`).
- Los mensajes solo de comandos no autorizados se ignoran silenciosamente, y los tokens en linea `/...` se tratan como texto plano.
- **Comandos de skill:** las skills `user-invocable` se exponen como comandos slash. Los nombres se saneanan a `a-z0-9_` (max 32 caracteres); las colisiones obtienen sufijos numericos (p. ej., `_2`).
  - `/skill <name> [input]` ejecuta una skill por nombre (util cuando los limites de comandos nativos impiden comandos por skill).
  - Por defecto, los comandos de skill se reenvian al modelo como una solicitud normal.
  - Las skills pueden declarar opcionalmente `command-dispatch: tool` para enrutar el comando directamente a una herramienta (deterministico, sin modelo).
  - Ejemplo: `/prose` (plugin OpenProse) — vea [OpenProse](/prose).
- **Argumentos de comandos nativos:** Discord usa autocompletado para opciones dinamicas (y menus de botones cuando omite argumentos obligatorios). Telegram y Slack muestran un menu de botones cuando un comando admite opciones y usted omite el argumento.

## Superficies de uso (que se muestra donde)

- **Uso/cuota del proveedor** (ejemplo: “Claude 80% restante”) aparece en `/status` para el proveedor del modelo actual cuando el seguimiento de uso esta habilitado.
- **Tokens/costo por respuesta** se controla con `/usage off|tokens|full` (se agrega a las respuestas normales).
- `/model status` trata sobre **modelos/autenticacion/endpoints**, no sobre uso.

## Seleccion de modelo (`/model`)

`/model` se implementa como una directiva.

Ejemplos:

```
/model
/model list
/model 3
/model openai/gpt-5.2
/model opus@anthropic:default
/model status
```

Notas:

- `/model` y `/model list` muestran un selector compacto y numerado (familia de modelos + proveedores disponibles).
- `/model <#>` selecciona desde ese selector (y prefiere el proveedor actual cuando es posible).
- `/model status` muestra la vista detallada, incluyendo el endpoint del proveedor configurado (`baseUrl`) y el modo de API (`api`) cuando esta disponible.

## Anulaciones de depuracion

`/debug` le permite establecer anulaciones de configuracion **solo en tiempo de ejecucion** (memoria, no disco). Solo propietario. Deshabilitado por defecto; habilitelo con `commands.debug: true`.

Ejemplos:

```
/debug show
/debug set messages.responsePrefix="[openclaw]"
/debug set channels.whatsapp.allowFrom=["+1555","+4477"]
/debug unset messages.responsePrefix
/debug reset
```

Notas:

- Las anulaciones se aplican de inmediato a nuevas lecturas de configuracion, pero **no** escriben en `openclaw.json`.
- Use `/debug reset` para borrar todas las anulaciones y volver a la configuracion en disco.

## Actualizaciones de configuracion

`/config` escribe en su configuracion en disco (`openclaw.json`). Solo propietario. Deshabilitado por defecto; habilitelo con `commands.config: true`.

Ejemplos:

```
/config show
/config show messages.responsePrefix
/config get messages.responsePrefix
/config set messages.responsePrefix="[openclaw]"
/config unset messages.responsePrefix
```

Notas:

- La configuracion se valida antes de escribir; los cambios no validos se rechazan.
- Las actualizaciones de `/config` persisten a traves de reinicios.

## Notas de superficie

- **Comandos de texto** se ejecutan en la sesion de chat normal (los Mensajes directos comparten `main`, los grupos tienen su propia sesion).
- **Comandos nativos** usan sesiones aisladas:
  - Discord: `agent:<agentId>:discord:slash:<userId>`
  - Slack: `agent:<agentId>:slack:slash:<userId>` (prefijo configurable via `channels.slack.slashCommand.sessionPrefix`)
  - Telegram: `telegram:slash:<userId>` (apunta a la sesion del chat via `CommandTargetSessionKey`)
- **`/stop`** apunta a la sesion de chat activa para poder abortar la ejecucion actual.
- **Slack:** `channels.slack.slashCommand` aun es compatible para un solo comando de estilo `/openclaw`. Si habilita `commands.native`, debe crear un comando slash de Slack por cada comando integrado (los mismos nombres que `/help`). Los menus de argumentos de comandos para Slack se entregan como botones efimeros de Block Kit.
