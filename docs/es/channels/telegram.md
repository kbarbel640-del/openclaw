---
summary: "Estado de soporte del bot de Telegram, capacidades y configuracion"
read_when:
  - Al trabajar en funciones de Telegram o webhooks
title: "Telegram"
x-i18n:
  source_path: channels/telegram.md
  source_hash: 5f75bd20da52c8f0
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:59:05Z
---

# Telegram (Bot API)

Estado: listo para produccion para Mensajes directos de bots + grupos via grammY. Sondeo largo por defecto; webhook opcional.

## Configuracion rapida (principiantes)

1. Cree un bot con **@BotFather** ([enlace directo](https://t.me/BotFather)). Confirme que el identificador sea exactamente `@BotFather`, luego copie el token.
2. Establezca el token:
   - Env: `TELEGRAM_BOT_TOKEN=...`
   - O config: `channels.telegram.botToken: "..."`.
   - Si ambos estan configurados, la configuracion tiene prioridad (el respaldo por env es solo para la cuenta predeterminada).
3. Inicie el Gateway.
4. El acceso por Mensajes directos es por emparejamiento de forma predeterminada; apruebe el codigo de emparejamiento en el primer contacto.

Configuracion minima:

```json5
{
  channels: {
    telegram: {
      enabled: true,
      botToken: "123:abc",
      dmPolicy: "pairing",
    },
  },
}
```

## Que es

- Un canal de Telegram Bot API propiedad del Gateway.
- Enrutamiento determinista: las respuestas regresan a Telegram; el modelo nunca elige canales.
- Los Mensajes directos comparten la sesion principal del agente; los grupos permanecen aislados (`agent:<agentId>:telegram:group:<chatId>`).

## Configuracion (ruta rapida)

### 1) Crear un token de bot (BotFather)

1. Abra Telegram y chatee con **@BotFather** ([enlace directo](https://t.me/BotFather)). Confirme que el identificador sea exactamente `@BotFather`.
2. Ejecute `/newbot`, luego siga las indicaciones (nombre + nombre de usuario que termine en `bot`).
3. Copie el token y guardelo de forma segura.

Configuraciones opcionales de BotFather:

- `/setjoingroups` — permitir/denegar agregar el bot a grupos.
- `/setprivacy` — controlar si el bot ve todos los mensajes del grupo.

### 2) Configurar el token (env o config)

Ejemplo:

```json5
{
  channels: {
    telegram: {
      enabled: true,
      botToken: "123:abc",
      dmPolicy: "pairing",
      groups: { "*": { requireMention: true } },
    },
  },
}
```

Opcion por env: `TELEGRAM_BOT_TOKEN=...` (funciona para la cuenta predeterminada).
Si tanto env como config estan configurados, config tiene prioridad.

Soporte multi-cuenta: use `channels.telegram.accounts` con tokens por cuenta y `name` opcional. Consulte [`gateway/configuration`](/gateway/configuration#telegramaccounts--discordaccounts--slackaccounts--signalaccounts--imessageaccounts) para el patron compartido.

3. Inicie el Gateway. Telegram se inicia cuando se resuelve un token (primero config, respaldo por env).
4. El acceso por Mensajes directos es por emparejamiento de forma predeterminada. Apruebe el codigo cuando el bot sea contactado por primera vez.
5. Para grupos: agregue el bot, decida el comportamiento de privacidad/admin (abajo), luego configure `channels.telegram.groups` para controlar el filtrado por menciones + listas de permitidos.

## Token + privacidad + permisos (lado de Telegram)

### Creacion de token (BotFather)

- `/newbot` crea el bot y devuelve el token (mantengalo en secreto).
- Si un token se filtra, revoquelo/regenerelo via @BotFather y actualice su configuracion.

### Visibilidad de mensajes de grupo (Modo Privacidad)

Los bots de Telegram tienen **Modo Privacidad** activado por defecto, lo que limita que mensajes de grupo reciben.
Si su bot debe ver _todos_ los mensajes del grupo, tiene dos opciones:

- Deshabilitar el modo privacidad con `/setprivacy` **o**
- Agregar el bot como **admin** del grupo (los bots admin reciben todos los mensajes).

**Nota:** Cuando cambia el modo privacidad, Telegram requiere quitar y volver a agregar el bot
a cada grupo para que el cambio surta efecto.

### Permisos de grupo (derechos de admin)

El estado de admin se establece dentro del grupo (UI de Telegram). Los bots admin siempre reciben todos
los mensajes del grupo, asi que use admin si necesita visibilidad total.

## Como funciona (comportamiento)

- Los mensajes entrantes se normalizan en el sobre de canal compartido con contexto de respuesta y marcadores de medios.
- Las respuestas en grupos requieren una mencion por defecto (mencion nativa @ o `agents.list[].groupChat.mentionPatterns` / `messages.groupChat.mentionPatterns`).
- Anulacion multi-agente: configure patrones por agente en `agents.list[].groupChat.mentionPatterns`.
- Las respuestas siempre se enrutan de vuelta al mismo chat de Telegram.
- El sondeo largo usa el runner de grammY con secuenciacion por chat; la concurrencia total esta limitada por `agents.defaults.maxConcurrent`.
- La Telegram Bot API no admite confirmaciones de lectura; no existe la opcion `sendReadReceipts`.

## Streaming de borradores

OpenClaw puede transmitir respuestas parciales en Mensajes directos de Telegram usando `sendMessageDraft`.

Requisitos:

- Modo con hilos habilitado para el bot en @BotFather (modo de temas de foro).
- Solo hilos de chats privados (Telegram incluye `message_thread_id` en mensajes entrantes).
- `channels.telegram.streamMode` no establecido en `"off"` (predeterminado: `"partial"`, `"block"` habilita actualizaciones de borrador por bloques).

El streaming de borradores es solo para Mensajes directos; Telegram no lo admite en grupos o canales.

## Formato (HTML de Telegram)

- El texto saliente de Telegram usa `parse_mode: "HTML"` (subconjunto de etiquetas compatibles de Telegram).
- La entrada tipo Markdown se renderiza a **HTML seguro para Telegram** (negrita/cursiva/tachado/codigo/enlaces); los elementos de bloque se aplanan a texto con saltos de linea/viñetas.
- El HTML crudo de los modelos se escapa para evitar errores de parseo de Telegram.
- Si Telegram rechaza la carga HTML, OpenClaw reintenta el mismo mensaje como texto plano.

## Comandos (nativos + personalizados)

OpenClaw registra comandos nativos (como `/status`, `/reset`, `/model`) en el menu del bot de Telegram al iniciar.
Puede agregar comandos personalizados al menu via config:

```json5
{
  channels: {
    telegram: {
      customCommands: [
        { command: "backup", description: "Git backup" },
        { command: "generate", description: "Create an image" },
      ],
    },
  },
}
```

## Solucion de problemas

- `setMyCommands failed` en los logs normalmente significa que HTTPS/DNS saliente esta bloqueado hacia `api.telegram.org`.
- Si ve fallas `sendMessage` o `sendChatAction`, verifique el enrutamiento IPv6 y DNS.

Mas ayuda: [Solucion de problemas de canales](/channels/troubleshooting).

Notas:

- Los comandos personalizados son **solo entradas de menu**; OpenClaw no los implementa a menos que usted los maneje en otro lugar.
- Los nombres de comandos se normalizan (se elimina el `/` inicial, se convierten a minusculas) y deben coincidir con `a-z`, `0-9`, `_` (1–32 caracteres).
- Los comandos personalizados **no pueden sobrescribir comandos nativos**. Los conflictos se ignoran y se registran.
- Si `commands.native` esta deshabilitado, solo se registran los comandos personalizados (o se limpian si no hay ninguno).

## Limites

- El texto saliente se fragmenta a `channels.telegram.textChunkLimit` (predeterminado 4000).
- Fragmentacion opcional por saltos de linea: configure `channels.telegram.chunkMode="newline"` para dividir en lineas en blanco (limites de parrafo) antes de fragmentar por longitud.
- Descargas/cargas de medios estan limitadas por `channels.telegram.mediaMaxMb` (predeterminado 5).
- Las solicitudes a la Telegram Bot API expiran despues de `channels.telegram.timeoutSeconds` (predeterminado 500 via grammY). Configure un valor menor para evitar bloqueos prolongados.
- El contexto de historial de grupo usa `channels.telegram.historyLimit` (o `channels.telegram.accounts.*.historyLimit`), con respaldo a `messages.groupChat.historyLimit`. Configure `0` para deshabilitarlo (predeterminado 50).
- El historial de Mensajes directos puede limitarse con `channels.telegram.dmHistoryLimit` (turnos de usuario). Anulaciones por usuario: `channels.telegram.dms["<user_id>"].historyLimit`.

## Modos de activacion de grupos

Por defecto, el bot solo responde a menciones en grupos (`@botname` o patrones en `agents.list[].groupChat.mentionPatterns`). Para cambiar este comportamiento:

### Via config (recomendado)

```json5
{
  channels: {
    telegram: {
      groups: {
        "-1001234567890": { requireMention: false }, // always respond in this group
      },
    },
  },
}
```

**Importante:** Configurar `channels.telegram.groups` crea una **lista de permitidos**: solo los grupos listados (o `"*"`) seran aceptados.
Los temas de foro heredan la configuracion de su grupo padre (allowFrom, requireMention, skills, prompts) a menos que agregue anulaciones por tema bajo `channels.telegram.groups.<groupId>.topics.<topicId>`.

Para permitir todos los grupos con respuesta siempre activa:

```json5
{
  channels: {
    telegram: {
      groups: {
        "*": { requireMention: false }, // all groups, always respond
      },
    },
  },
}
```

Para mantener solo menciones para todos los grupos (comportamiento predeterminado):

```json5
{
  channels: {
    telegram: {
      groups: {
        "*": { requireMention: true }, // or omit groups entirely
      },
    },
  },
}
```

### Via comando (nivel de sesion)

Envie en el grupo:

- `/activation always` - responder a todos los mensajes
- `/activation mention` - requerir menciones (predeterminado)

**Nota:** Los comandos actualizan solo el estado de la sesion. Para un comportamiento persistente tras reinicios, use config.

### Obtener el ID del chat del grupo

Reenvie cualquier mensaje del grupo a `@userinfobot` o `@getidsbot` en Telegram para ver el ID del chat (numero negativo como `-1001234567890`).

**Consejo:** Para su propio ID de usuario, envie un Mensaje directo al bot y este respondera con su ID de usuario (mensaje de emparejamiento), o use `/whoami` una vez que los comandos esten habilitados.

**Nota de privacidad:** `@userinfobot` es un bot de terceros. Si lo prefiere, agregue el bot al grupo, envie un mensaje y use `openclaw logs --follow` para leer `chat.id`, o use la Bot API `getUpdates`.

## Escrituras de configuracion

Por defecto, Telegram puede escribir actualizaciones de configuracion activadas por eventos del canal o `/config set|unset`.

Esto ocurre cuando:

- Un grupo se actualiza a supergrupo y Telegram emite `migrate_to_chat_id` (cambia el ID del chat). OpenClaw puede migrar `channels.telegram.groups` automaticamente.
- Usted ejecuta `/config set` o `/config unset` en un chat de Telegram (requiere `commands.config: true`).

Deshabilitar con:

```json5
{
  channels: { telegram: { configWrites: false } },
}
```

## Temas (supergrupos de foro)

Los temas de foro de Telegram incluyen un `message_thread_id` por mensaje. OpenClaw:

- Anexa `:topic:<threadId>` a la clave de sesion del grupo de Telegram para que cada tema quede aislado.
- Envia indicadores de escritura y respuestas con `message_thread_id` para que las respuestas permanezcan en el tema.
- El tema general (id de hilo `1`) es especial: los envios de mensajes omiten `message_thread_id` (Telegram lo rechaza), pero los indicadores de escritura aun lo incluyen.
- Expone `MessageThreadId` + `IsForum` en el contexto de plantillas para enrutamiento/templating.
- La configuracion especifica por tema esta disponible bajo `channels.telegram.groups.<chatId>.topics.<threadId>` (skills, listas de permitidos, auto-respuesta, prompts del sistema, deshabilitar).
- Las configuraciones de temas heredan los ajustes del grupo (requireMention, listas de permitidos, skills, prompts, habilitado) a menos que se anulen por tema.

Los chats privados pueden incluir `message_thread_id` en algunos casos extremos. OpenClaw mantiene la clave de sesion de Mensajes directos sin cambios, pero aun usa el id de hilo para respuestas/streaming de borradores cuando esta presente.

## Botones en linea

Telegram admite teclados en linea con botones de callback.

```json5
{
  channels: {
    telegram: {
      capabilities: {
        inlineButtons: "allowlist",
      },
    },
  },
}
```

Para configuracion por cuenta:

```json5
{
  channels: {
    telegram: {
      accounts: {
        main: {
          capabilities: {
            inlineButtons: "allowlist",
          },
        },
      },
    },
  },
}
```

Ambitos:

- `off` — botones en linea deshabilitados
- `dm` — solo Mensajes directos (objetivos de grupo bloqueados)
- `group` — solo grupos (objetivos de Mensajes directos bloqueados)
- `all` — Mensajes directos + grupos
- `allowlist` — Mensajes directos + grupos, pero solo remitentes permitidos por `allowFrom`/`groupAllowFrom` (mismas reglas que los comandos de control)

Predeterminado: `allowlist`.
Legado: `capabilities: ["inlineButtons"]` = `inlineButtons: "all"`.

### Envio de botones

Use la herramienta de mensajes con el parametro `buttons`:

```json5
{
  action: "send",
  channel: "telegram",
  to: "123456789",
  message: "Choose an option:",
  buttons: [
    [
      { text: "Yes", callback_data: "yes" },
      { text: "No", callback_data: "no" },
    ],
    [{ text: "Cancel", callback_data: "cancel" }],
  ],
}
```

Cuando un usuario hace clic en un boton, los datos de callback se envian de vuelta al agente como un mensaje con el formato:
`callback_data: value`

### Opciones de configuracion

Las capacidades de Telegram pueden configurarse en dos niveles (se muestra el formulario de objeto arriba; los arreglos de cadenas heredados aun se admiten):

- `channels.telegram.capabilities`: Configuracion global predeterminada de capacidades aplicada a todas las cuentas de Telegram a menos que se anule.
- `channels.telegram.accounts.<account>.capabilities`: Capacidades por cuenta que anulan los valores globales para esa cuenta especifica.

Use la configuracion global cuando todos los bots/cuentas de Telegram deban comportarse igual. Use la configuracion por cuenta cuando diferentes bots necesiten comportamientos distintos (por ejemplo, una cuenta solo maneja Mensajes directos mientras otra esta permitida en grupos).

## Control de acceso (Mensajes directos + grupos)

### Acceso por Mensajes directos

- Predeterminado: `channels.telegram.dmPolicy = "pairing"`. Los remitentes desconocidos reciben un codigo de emparejamiento; los mensajes se ignoran hasta que se aprueban (los codigos expiran despues de 1 hora).
- Aprobar via:
  - `openclaw pairing list telegram`
  - `openclaw pairing approve telegram <CODE>`
- El emparejamiento es el intercambio de tokens predeterminado usado para Mensajes directos de Telegram. Detalles: [Emparejamiento](/start/pairing)
- `channels.telegram.allowFrom` acepta IDs numericos de usuario (recomendado) o entradas `@username`. **No** es el nombre de usuario del bot; use el ID del remitente humano. El asistente acepta `@username` y lo resuelve al ID numerico cuando es posible.

#### Encontrar su ID de usuario de Telegram

Mas seguro (sin bot de terceros):

1. Inicie el Gateway y envie un Mensaje directo a su bot.
2. Ejecute `openclaw logs --follow` y busque `from.id`.

Alternativa (Bot API oficial):

1. Envie un Mensaje directo a su bot.
2. Obtenga actualizaciones con el token de su bot y lea `message.from.id`:
   ```bash
   curl "https://api.telegram.org/bot<bot_token>/getUpdates"
   ```

Terceros (menos privado):

- Envie un Mensaje directo a `@userinfobot` o `@getidsbot` y use el ID de usuario devuelto.

### Acceso a grupos

Dos controles independientes:

**1. Que grupos estan permitidos** (lista de permitidos de grupos via `channels.telegram.groups`):

- Sin configuracion `groups` = todos los grupos permitidos
- Con configuracion `groups` = solo los grupos listados o `"*"` estan permitidos
- Ejemplo: `"groups": { "-1001234567890": {}, "*": {} }` permite todos los grupos

**2. Que remitentes estan permitidos** (filtrado de remitentes via `channels.telegram.groupPolicy`):

- `"open"` = todos los remitentes en grupos permitidos pueden escribir
- `"allowlist"` = solo los remitentes en `channels.telegram.groupAllowFrom` pueden escribir
- `"disabled"` = no se aceptan mensajes de grupo en absoluto
  El valor predeterminado es `groupPolicy: "allowlist"` (bloqueado a menos que agregue `groupAllowFrom`).

La mayoria de los usuarios quieren: `groupPolicy: "allowlist"` + `groupAllowFrom` + grupos especificos listados en `channels.telegram.groups`

Para permitir que **cualquier miembro del grupo** hable en un grupo especifico (manteniendo los comandos de control restringidos a remitentes autorizados), configure una anulacion por grupo:

```json5
{
  channels: {
    telegram: {
      groups: {
        "-1001234567890": {
          groupPolicy: "open",
          requireMention: false,
        },
      },
    },
  },
}
```

## Sondeo largo vs webhook

- Predeterminado: sondeo largo (no se requiere URL publica).
- Modo webhook: configure `channels.telegram.webhookUrl` y `channels.telegram.webhookSecret` (opcionalmente `channels.telegram.webhookPath`).
  - El listener local se vincula a `0.0.0.0:8787` y sirve `POST /telegram-webhook` por defecto.
  - Si su URL publica es diferente, use un proxy inverso y apunte `channels.telegram.webhookUrl` al endpoint publico.

## Enhebrado de respuestas

Telegram admite respuestas en hilos opcionales via etiquetas:

- `[[reply_to_current]]` -- responder al mensaje que lo disparo.
- `[[reply_to:<id>]]` -- responder a un ID de mensaje especifico.

Controlado por `channels.telegram.replyToMode`:

- `first` (predeterminado), `all`, `off`.

## Mensajes de audio (voz vs archivo)

Telegram distingue **notas de voz** (burbuja redonda) de **archivos de audio** (tarjeta de metadatos).
OpenClaw usa por defecto archivos de audio por compatibilidad hacia atras.

Para forzar una burbuja de nota de voz en las respuestas del agente, incluya esta etiqueta en cualquier lugar de la respuesta:

- `[[audio_as_voice]]` — enviar audio como nota de voz en lugar de archivo.

La etiqueta se elimina del texto entregado. Otros canales ignoran esta etiqueta.

Para envios con la herramienta de mensajes, configure `asVoice: true` con una URL de audio compatible con voz `media`
(`message` es opcional cuando hay medios):

```json5
{
  action: "send",
  channel: "telegram",
  to: "123456789",
  media: "https://example.com/voice.ogg",
  asVoice: true,
}
```

## Stickers

OpenClaw admite recibir y enviar stickers de Telegram con almacenamiento en cache inteligente.

### Recepcion de stickers

Cuando un usuario envia un sticker, OpenClaw lo maneja segun el tipo de sticker:

- **Stickers estaticos (WEBP):** Se descargan y procesan con vision. El sticker aparece como un marcador `<media:sticker>` en el contenido del mensaje.
- **Stickers animados (TGS):** Se omiten (formato Lottie no compatible para procesamiento).
- **Stickers de video (WEBM):** Se omiten (formato de video no compatible para procesamiento).

Campo de contexto de plantilla disponible al recibir stickers:

- `Sticker` — objeto con:
  - `emoji` — emoji asociado con el sticker
  - `setName` — nombre del conjunto de stickers
  - `fileId` — ID de archivo de Telegram (envie el mismo sticker de vuelta)
  - `fileUniqueId` — ID estable para busqueda en cache
  - `cachedDescription` — descripcion de vision en cache cuando esta disponible

### Cache de stickers

Los stickers se procesan mediante las capacidades de vision de la IA para generar descripciones. Dado que los mismos stickers a menudo se envian repetidamente, OpenClaw almacena en cache estas descripciones para evitar llamadas redundantes a la API.

**Como funciona:**

1. **Primer encuentro:** La imagen del sticker se envia a la IA para analisis de vision. La IA genera una descripcion (por ejemplo, "Un gato caricaturesco saludando con entusiasmo").
2. **Almacenamiento en cache:** La descripcion se guarda junto con el ID de archivo del sticker, el emoji y el nombre del conjunto.
3. **Encuentros posteriores:** Cuando se vuelve a ver el mismo sticker, se usa directamente la descripcion en cache. La imagen no se envia a la IA.

**Ubicacion del cache:** `~/.openclaw/telegram/sticker-cache.json`

**Formato de entrada del cache:**

```json
{
  "fileId": "CAACAgIAAxkBAAI...",
  "fileUniqueId": "AgADBAADb6cxG2Y",
  "emoji": "👋",
  "setName": "CoolCats",
  "description": "A cartoon cat waving enthusiastically",
  "cachedAt": "2026-01-15T10:30:00.000Z"
}
```

**Beneficios:**

- Reduce los costos de la API al evitar llamadas de vision repetidas para el mismo sticker
- Tiempos de respuesta mas rapidos para stickers en cache (sin retraso de procesamiento de vision)
- Habilita la funcionalidad de busqueda de stickers basada en descripciones en cache

El cache se completa automaticamente a medida que se reciben stickers. No se requiere gestion manual del cache.

### Envio de stickers

El agente puede enviar y buscar stickers usando las acciones `sticker` y `sticker-search`. Estas estan deshabilitadas por defecto y deben habilitarse en config:

```json5
{
  channels: {
    telegram: {
      actions: {
        sticker: true,
      },
    },
  },
}
```

**Enviar un sticker:**

```json5
{
  action: "sticker",
  channel: "telegram",
  to: "123456789",
  fileId: "CAACAgIAAxkBAAI...",
}
```

Parametros:

- `fileId` (requerido) — el ID de archivo de Telegram del sticker. Obtengalo de `Sticker.fileId` al recibir un sticker, o de un resultado `sticker-search`.
- `replyTo` (opcional) — ID del mensaje al que responder.
- `threadId` (opcional) — ID del hilo del mensaje para temas de foro.

**Buscar stickers:**

El agente puede buscar stickers en cache por descripcion, emoji o nombre del conjunto:

```json5
{
  action: "sticker-search",
  channel: "telegram",
  query: "cat waving",
  limit: 5,
}
```

Devuelve stickers coincidentes del cache:

```json5
{
  ok: true,
  count: 2,
  stickers: [
    {
      fileId: "CAACAgIAAxkBAAI...",
      emoji: "👋",
      description: "A cartoon cat waving enthusiastically",
      setName: "CoolCats",
    },
  ],
}
```

La busqueda usa coincidencia difusa a traves del texto de descripcion, caracteres emoji y nombres de conjuntos.

**Ejemplo con enhebrado:**

```json5
{
  action: "sticker",
  channel: "telegram",
  to: "-1001234567890",
  fileId: "CAACAgIAAxkBAAI...",
  replyTo: 42,
  threadId: 123,
}
```

## Streaming (borradores)

Telegram puede transmitir **burbujas de borrador** mientras el agente genera una respuesta.
OpenClaw usa la Bot API `sendMessageDraft` (no mensajes reales) y luego envia la
respuesta final como un mensaje normal.

Requisitos (Telegram Bot API 9.3+):

- **Chats privados con temas habilitados** (modo de temas de foro para el bot).
- Los mensajes entrantes deben incluir `message_thread_id` (hilo de tema privado).
- El streaming se ignora para grupos/supergrupos/canales.

Config:

- `channels.telegram.streamMode: "off" | "partial" | "block"` (predeterminado: `partial`)
  - `partial`: actualiza la burbuja de borrador con el texto de streaming mas reciente.
  - `block`: actualiza la burbuja de borrador en bloques mas grandes (por bloques).
  - `off`: deshabilita el streaming de borradores.
- Opcional (solo para `streamMode: "block"`):
  - `channels.telegram.draftChunk: { minChars?, maxChars?, breakPreference? }`
    - valores predeterminados: `minChars: 200`, `maxChars: 800`, `breakPreference: "paragraph"` (limitados a `channels.telegram.textChunkLimit`).

Nota: el streaming de borradores es independiente del **streaming por bloques** (mensajes del canal).
El streaming por bloques esta desactivado por defecto y requiere `channels.telegram.blockStreaming: true`
si desea mensajes tempranos de Telegram en lugar de actualizaciones de borrador.

Streaming de razonamiento (solo Telegram):

- `/reasoning stream` transmite el razonamiento en la burbuja de borrador mientras la respuesta se
  genera, y luego envia la respuesta final sin razonamiento.
- Si `channels.telegram.streamMode` es `off`, el streaming de razonamiento esta deshabilitado.
  Mas contexto: [Streaming + fragmentacion](/concepts/streaming).

## Politica de reintentos

Las llamadas salientes a la API de Telegram reintentan ante errores transitorios de red/429 con backoff exponencial y jitter. Configure via `channels.telegram.retry`. Consulte [Politica de reintentos](/concepts/retry).

## Herramienta del agente (mensajes + reacciones)

- Herramienta: `telegram` con accion `sendMessage` (`to`, `content`, opcional `mediaUrl`, `replyToMessageId`, `messageThreadId`).
- Herramienta: `telegram` con accion `react` (`chatId`, `messageId`, `emoji`).
- Herramienta: `telegram` con accion `deleteMessage` (`chatId`, `messageId`).
- Semantica de eliminacion de reacciones: ver [/tools/reactions](/tools/reactions).
- Control de herramientas: `channels.telegram.actions.reactions`, `channels.telegram.actions.sendMessage`, `channels.telegram.actions.deleteMessage` (predeterminado: habilitado), y `channels.telegram.actions.sticker` (predeterminado: deshabilitado).

## Notificaciones de reacciones

**Como funcionan las reacciones:**
Las reacciones de Telegram llegan como **eventos `message_reaction` separados**, no como propiedades en las cargas de mensajes. Cuando un usuario agrega una reaccion, OpenClaw:

1. Recibe la actualizacion `message_reaction` de la API de Telegram
2. La convierte en un **evento del sistema** con el formato: `"Telegram reaction added: {emoji} by {user} on msg {id}"`
3. Encola el evento del sistema usando la **misma clave de sesion** que los mensajes normales
4. Cuando llega el siguiente mensaje en esa conversacion, los eventos del sistema se drenan y se anteponen al contexto del agente

El agente ve las reacciones como **notificaciones del sistema** en el historial de la conversacion, no como metadatos del mensaje.

**Configuracion:**

- `channels.telegram.reactionNotifications`: Controla que reacciones disparan notificaciones
  - `"off"` — ignorar todas las reacciones
  - `"own"` — notificar cuando los usuarios reaccionan a mensajes del bot (mejor esfuerzo; en memoria) (predeterminado)
  - `"all"` — notificar todas las reacciones

- `channels.telegram.reactionLevel`: Controla la capacidad de reaccion del agente
  - `"off"` — el agente no puede reaccionar a mensajes
  - `"ack"` — el bot envia reacciones de acuse (👀 mientras procesa) (predeterminado)
  - `"minimal"` — el agente puede reaccionar con moderacion (guia: 1 cada 5–10 intercambios)
  - `"extensive"` — el agente puede reaccionar liberalmente cuando sea apropiado

**Grupos de foro:** Las reacciones en grupos de foro incluyen `message_thread_id` y usan claves de sesion como `agent:main:telegram:group:{chatId}:topic:{threadId}`. Esto asegura que reacciones y mensajes en el mismo tema permanezcan juntos.

**Ejemplo de config:**

```json5
{
  channels: {
    telegram: {
      reactionNotifications: "all", // See all reactions
      reactionLevel: "minimal", // Agent can react sparingly
    },
  },
}
```

**Requisitos:**

- Los bots de Telegram deben solicitar explicitamente `message_reaction` en `allowed_updates` (configurado automaticamente por OpenClaw)
- Para modo webhook, las reacciones se incluyen en el webhook `allowed_updates`
- Para modo de sondeo, las reacciones se incluyen en las `getUpdates` `allowed_updates`

## Destinos de entrega (CLI/cron)

- Use un ID de chat (`123456789`) o un nombre de usuario (`@name`) como destino.
- Ejemplo: `openclaw message send --channel telegram --target 123456789 --message "hi"`.

## Solucion de problemas

**El bot no responde a mensajes sin mencion en un grupo:**

- Si configuro `channels.telegram.groups.*.requireMention=false`, el **modo privacidad** de la Bot API de Telegram debe estar deshabilitado.
  - BotFather: `/setprivacy` → **Deshabilitar** (luego quite y vuelva a agregar el bot al grupo)
- `openclaw channels status` muestra una advertencia cuando la config espera mensajes de grupo sin mencion.
- `openclaw channels status --probe` puede ademas verificar membresia para IDs de grupo numericos explicitos (no puede auditar reglas comodin `"*"`).
- Prueba rapida: `/activation always` (solo sesion; use config para persistencia)

**El bot no ve mensajes de grupo en absoluto:**

- Si `channels.telegram.groups` esta configurado, el grupo debe estar listado o usar `"*"`
- Verifique Configuracion de Privacidad en @BotFather → "Group Privacy" debe estar **OFF**
- Verifique que el bot sea realmente miembro (no solo admin sin acceso de lectura)
- Revise los logs del Gateway: `openclaw logs --follow` (busque "skipping group message")

**El bot responde a menciones pero no a `/activation always`:**

- El comando `/activation` actualiza el estado de la sesion pero no persiste en la config
- Para comportamiento persistente, agregue el grupo a `channels.telegram.groups` con `requireMention: false`

**Comandos como `/status` no funcionan:**

- Asegurese de que su ID de usuario de Telegram este autorizado (via emparejamiento o `channels.telegram.allowFrom`)
- Los comandos requieren autorizacion incluso en grupos con `groupPolicy: "open"`

**El sondeo largo se aborta inmediatamente en Node 22+ (a menudo con proxies/fetch personalizado):**

- Node 22+ es mas estricto con instancias `AbortSignal`; señales externas pueden abortar llamadas `fetch` de inmediato.
- Actualice a una version de OpenClaw que normalice las señales de aborto, o ejecute el Gateway en Node 20 hasta que pueda actualizar.

**El bot inicia y luego deja de responder silenciosamente (o registra `HttpError: Network request ... failed`):**

- Algunos hosts resuelven `api.telegram.org` primero a IPv6. Si su servidor no tiene salida IPv6 funcional, grammY puede quedarse atascado en solicitudes solo IPv6.
- Solucione habilitando salida IPv6 **o** forzando resolucion IPv4 para `api.telegram.org` (por ejemplo, agregue una entrada `/etc/hosts` usando el registro A IPv4, o prefiera IPv4 en la pila DNS de su SO), luego reinicie el Gateway.
- Comprobacion rapida: `dig +short api.telegram.org A` y `dig +short api.telegram.org AAAA` para confirmar que devuelve DNS.

## Referencia de configuracion (Telegram)

Configuracion completa: [Configuracion](/gateway/configuration)

Opciones del proveedor:

- `channels.telegram.enabled`: habilitar/deshabilitar el inicio del canal.
- `channels.telegram.botToken`: token del bot (BotFather).
- `channels.telegram.tokenFile`: leer el token desde una ruta de archivo.
- `channels.telegram.dmPolicy`: `pairing | allowlist | open | disabled` (predeterminado: emparejamiento).
- `channels.telegram.allowFrom`: lista de permitidos de Mensajes directos (ids/nombres de usuario). `open` requiere `"*"`.
- `channels.telegram.groupPolicy`: `open | allowlist | disabled` (predeterminado: lista de permitidos).
- `channels.telegram.groupAllowFrom`: lista de permitidos de remitentes de grupo (ids/nombres de usuario).
- `channels.telegram.groups`: valores predeterminados por grupo + lista de permitidos (use `"*"` para valores globales).
  - `channels.telegram.groups.<id>.groupPolicy`: anulacion por grupo para groupPolicy (`open | allowlist | disabled`).
  - `channels.telegram.groups.<id>.requireMention`: filtrado por menciones predeterminado.
  - `channels.telegram.groups.<id>.skills`: filtro de skills (omitir = todas las skills, vacio = ninguna).
  - `channels.telegram.groups.<id>.allowFrom`: anulacion por grupo de lista de permitidos de remitentes.
  - `channels.telegram.groups.<id>.systemPrompt`: prompt de sistema adicional para el grupo.
  - `channels.telegram.groups.<id>.enabled`: deshabilitar el grupo cuando `false`.
  - `channels.telegram.groups.<id>.topics.<threadId>.*`: anulaciones por tema (mismos campos que el grupo).
  - `channels.telegram.groups.<id>.topics.<threadId>.groupPolicy`: anulacion por tema para groupPolicy (`open | allowlist | disabled`).
  - `channels.telegram.groups.<id>.topics.<threadId>.requireMention`: anulacion por tema del filtrado por menciones.
- `channels.telegram.capabilities.inlineButtons`: `off | dm | group | all | allowlist` (predeterminado: lista de permitidos).
- `channels.telegram.accounts.<account>.capabilities.inlineButtons`: anulacion por cuenta.
- `channels.telegram.replyToMode`: `off | first | all` (predeterminado: `first`).
- `channels.telegram.textChunkLimit`: tamano de fragmento saliente (caracteres).
- `channels.telegram.chunkMode`: `length` (predeterminado) o `newline` para dividir en lineas en blanco (limites de parrafo) antes de fragmentar por longitud.
- `channels.telegram.linkPreview`: alternar vistas previas de enlaces para mensajes salientes (predeterminado: true).
- `channels.telegram.streamMode`: `off | partial | block` (streaming de borradores).
- `channels.telegram.mediaMaxMb`: limite de medios entrantes/salientes (MB).
- `channels.telegram.retry`: politica de reintentos para llamadas salientes a la API de Telegram (intentos, minDelayMs, maxDelayMs, jitter).
- `channels.telegram.network.autoSelectFamily`: anular autoSelectFamily de Node (true=habilitar, false=deshabilitar). Predeterminado deshabilitado en Node 22 para evitar timeouts de Happy Eyeballs.
- `channels.telegram.proxy`: URL de proxy para llamadas a la Bot API (SOCKS/HTTP).
- `channels.telegram.webhookUrl`: habilitar modo webhook (requiere `channels.telegram.webhookSecret`).
- `channels.telegram.webhookSecret`: secreto del webhook (requerido cuando se configura webhookUrl).
- `channels.telegram.webhookPath`: ruta local del webhook (predeterminado `/telegram-webhook`).
- `channels.telegram.actions.reactions`: controlar reacciones de herramientas de Telegram.
- `channels.telegram.actions.sendMessage`: controlar envios de mensajes de herramientas de Telegram.
- `channels.telegram.actions.deleteMessage`: controlar eliminaciones de mensajes de herramientas de Telegram.
- `channels.telegram.actions.sticker`: controlar acciones de stickers de Telegram — enviar y buscar (predeterminado: false).
- `channels.telegram.reactionNotifications`: `off | own | all` — controlar que reacciones disparan eventos del sistema (predeterminado: `own` cuando no esta configurado).
- `channels.telegram.reactionLevel`: `off | ack | minimal | extensive` — controlar la capacidad de reaccion del agente (predeterminado: `minimal` cuando no esta configurado).

Opciones globales relacionadas:

- `agents.list[].groupChat.mentionPatterns` (patrones de filtrado por menciones).
- `messages.groupChat.mentionPatterns` (respaldo global).
- `commands.native` (predeterminado `"auto"` → activado para Telegram/Discord, desactivado para Slack), `commands.text`, `commands.useAccessGroups` (comportamiento de comandos). Anule con `channels.telegram.commands.native`.
- `messages.responsePrefix`, `messages.ackReaction`, `messages.ackReactionScope`, `messages.removeAckAfterReply`.
