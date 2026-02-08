---
summary: "Estado de soporte del bot de Discord, capacidades y configuración"
read_when:
  - Al trabajar en funciones del canal de Discord
title: "Discord"
x-i18n:
  source_path: channels/discord.md
  source_hash: 9bebfe8027ff1972
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:58:38Z
---

# Discord (Bot API)

Estado: listo para Mensajes directos y canales de texto de servidores mediante el gateway oficial de bots de Discord.

## Configuración rápida (principiante)

1. Cree un bot de Discord y copie el token del bot.
2. En la configuración de la app de Discord, habilite **Message Content Intent** (y **Server Members Intent** si planea usar listas de permitidos o búsquedas por nombre).
3. Configure el token para OpenClaw:
   - Env: `DISCORD_BOT_TOKEN=...`
   - O config: `channels.discord.token: "..."`.
   - Si ambos están configurados, la configuración tiene prioridad (el fallback por env es solo para la cuenta predeterminada).
4. Invite el bot a su servidor con permisos de mensajes (cree un servidor privado si solo quiere Mensajes directos).
5. Inicie el Gateway.
6. El acceso por Mensajes directos se empareja por defecto; apruebe el código de emparejamiento en el primer contacto.

Configuración mínima:

```json5
{
  channels: {
    discord: {
      enabled: true,
      token: "YOUR_BOT_TOKEN",
    },
  },
}
```

## Objetivos

- Hablar con OpenClaw mediante Mensajes directos de Discord o canales de servidor.
- Los chats directos se consolidan en la sesión principal del agente (por defecto `agent:main:main`); los canales de servidor permanecen aislados como `agent:<agentId>:discord:channel:<channelId>` (los nombres visibles usan `discord:<guildSlug>#<channelSlug>`).
- Los Mensajes directos grupales se ignoran por defecto; habilítelos con `channels.discord.dm.groupEnabled` y opcionalmente restrínjalos con `channels.discord.dm.groupChannels`.
- Mantener un enrutamiento determinista: las respuestas siempre vuelven al canal por el que llegaron.

## Cómo funciona

1. Cree una aplicación de Discord → Bot, habilite los intents que necesite (Mensajes directos + mensajes de servidor + contenido de mensajes) y obtenga el token del bot.
2. Invite el bot a su servidor con los permisos necesarios para leer/enviar mensajes donde quiera usarlo.
3. Configure OpenClaw con `channels.discord.token` (o `DISCORD_BOT_TOKEN` como fallback).
4. Ejecute el Gateway; inicia automáticamente el canal de Discord cuando hay un token disponible (primero config, luego env como fallback) y `channels.discord.enabled` no es `false`.
   - Si prefiere variables de entorno, configure `DISCORD_BOT_TOKEN` (el bloque de configuración es opcional).
5. Chats directos: use `user:<id>` (o una mención `<@id>`) al entregar; todos los turnos llegan a la sesión compartida `main`. Los IDs numéricos sin contexto son ambiguos y se rechazan.
6. Canales de servidor: use `channel:<channelId>` para la entrega. Las menciones son obligatorias por defecto y pueden configurarse por servidor o por canal.
7. Chats directos: seguros por defecto mediante `channels.discord.dm.policy` (predeterminado: `"pairing"`). Los remitentes desconocidos reciben un código de emparejamiento (expira después de 1 hora); apruébelo mediante `openclaw pairing approve discord <code>`.
   - Para mantener el comportamiento antiguo de “abierto a cualquiera”: configure `channels.discord.dm.policy="open"` y `channels.discord.dm.allowFrom=["*"]`.
   - Para una lista de permitidos estricta: configure `channels.discord.dm.policy="allowlist"` y liste los remitentes en `channels.discord.dm.allowFrom`.
   - Para ignorar todos los Mensajes directos: configure `channels.discord.dm.enabled=false` o `channels.discord.dm.policy="disabled"`.
8. Los Mensajes directos grupales se ignoran por defecto; habilítelos con `channels.discord.dm.groupEnabled` y opcionalmente restrínjalos con `channels.discord.dm.groupChannels`.
9. Reglas opcionales por servidor: configure `channels.discord.guilds` con clave por id de servidor (preferido) o slug, con reglas por canal.
10. Comandos nativos opcionales: `commands.native` tiene como valor predeterminado `"auto"` (activado para Discord/Telegram, desactivado para Slack). Anule con `channels.discord.commands.native: true|false|"auto"`; `false` borra comandos registrados previamente. Los comandos de texto se controlan con `commands.text` y deben enviarse como mensajes independientes `/...`. Use `commands.useAccessGroups: false` para omitir comprobaciones de grupos de acceso para comandos.
    - Lista completa de comandos + configuración: [Slash commands](/tools/slash-commands)
11. Historial de contexto opcional por servidor: configure `channels.discord.historyLimit` (predeterminado 20, con fallback a `messages.groupChat.historyLimit`) para incluir los últimos N mensajes del servidor como contexto al responder a una mención. Configure `0` para deshabilitarlo.
12. Reacciones: el agente puede activar reacciones mediante la herramienta `discord` (controlada por `channels.discord.actions.*`).
    - Semántica de eliminación de reacciones: vea [/tools/reactions](/tools/reactions).
    - La herramienta `discord` solo se expone cuando el canal actual es Discord.
13. Los comandos nativos usan claves de sesión aisladas (`agent:<agentId>:discord:slash:<userId>`) en lugar de la sesión compartida `main`.

Nota: La resolución nombre → id usa la búsqueda de miembros del servidor y requiere Server Members Intent; si el bot no puede buscar miembros, use ids o menciones `<@id>`.
Nota: Los slugs están en minúsculas con espacios reemplazados por `-`. Los nombres de canales se convierten a slug sin el `#` inicial.
Nota: Las líneas de contexto del servidor `[from:]` incluyen `author.tag` + `id` para facilitar respuestas listas para ping.

## Escrituras de configuración

Por defecto, Discord puede escribir actualizaciones de configuración activadas por `/config set|unset` (requiere `commands.config: true`).

Deshabilitar con:

```json5
{
  channels: { discord: { configWrites: false } },
}
```

## Cómo crear su propio bot

Esta es la configuración del “Discord Developer Portal” para ejecutar OpenClaw en un canal de servidor (guild) como `#help`.

### 1) Crear la app de Discord + usuario bot

1. Discord Developer Portal → **Applications** → **New Application**
2. En su app:
   - **Bot** → **Add Bot**
   - Copie el **Bot Token** (esto es lo que coloca en `DISCORD_BOT_TOKEN`)

### 2) Habilitar los gateway intents que OpenClaw necesita

Discord bloquea los “privileged intents” a menos que los habilite explícitamente.

En **Bot** → **Privileged Gateway Intents**, habilite:

- **Message Content Intent** (requerido para leer el texto de mensajes en la mayoría de los servidores; sin él verá “Used disallowed intents” o el bot se conectará pero no reaccionará a los mensajes)
- **Server Members Intent** (recomendado; requerido para algunas búsquedas de miembros/usuarios y coincidencias de listas de permitidos en servidores)

Normalmente **no** necesita **Presence Intent**. Configurar la presencia del propio bot (acción `setPresence`) usa gateway OP3 y no requiere este intent; solo es necesario si quiere recibir actualizaciones de presencia de otros miembros del servidor.

### 3) Generar una URL de invitación (OAuth2 URL Generator)

En su app: **OAuth2** → **URL Generator**

**Scopes**

- ✅ `bot`
- ✅ `applications.commands` (requerido para comandos nativos)

**Bot Permissions** (línea base mínima)

- ✅ View Channels
- ✅ Send Messages
- ✅ Read Message History
- ✅ Embed Links
- ✅ Attach Files
- ✅ Add Reactions (opcional pero recomendado)
- ✅ Use External Emojis / Stickers (opcional; solo si los quiere)

Evite **Administrator** a menos que esté depurando y confíe plenamente en el bot.

Copie la URL generada, ábrala, elija su servidor e instale el bot.

### 4) Obtener los ids (servidor/usuario/canal)

Discord usa ids numéricos en todas partes; la configuración de OpenClaw prefiere ids.

1. Discord (escritorio/web) → **User Settings** → **Advanced** → habilite **Developer Mode**
2. Clic derecho:
   - Nombre del servidor → **Copy Server ID** (id del servidor)
   - Canal (p. ej., `#help`) → **Copy Channel ID**
   - Su usuario → **Copy User ID**

### 5) Configurar OpenClaw

#### Token

Configure el token del bot mediante variable de entorno (recomendado en servidores):

- `DISCORD_BOT_TOKEN=...`

O mediante configuración:

```json5
{
  channels: {
    discord: {
      enabled: true,
      token: "YOUR_BOT_TOKEN",
    },
  },
}
```

Soporte multi-cuenta: use `channels.discord.accounts` con tokens por cuenta y `name` opcional. Vea [`gateway/configuration`](/gateway/configuration#telegramaccounts--discordaccounts--slackaccounts--signalaccounts--imessageaccounts) para el patrón compartido.

#### Lista de permitidos + enrutamiento de canales

Ejemplo “un solo servidor, solo permitirme a mí, solo permitir #help”:

```json5
{
  channels: {
    discord: {
      enabled: true,
      dm: { enabled: false },
      guilds: {
        YOUR_GUILD_ID: {
          users: ["YOUR_USER_ID"],
          requireMention: true,
          channels: {
            help: { allow: true, requireMention: true },
          },
        },
      },
      retry: {
        attempts: 3,
        minDelayMs: 500,
        maxDelayMs: 30000,
        jitter: 0.1,
      },
    },
  },
}
```

Notas:

- `requireMention: true` significa que el bot solo responde cuando se le menciona (recomendado para canales compartidos).
- `agents.list[].groupChat.mentionPatterns` (o `messages.groupChat.mentionPatterns`) también cuentan como menciones para mensajes de servidor.
- Anulación multi-agente: configure patrones por agente en `agents.list[].groupChat.mentionPatterns`.
- Si `channels` está presente, cualquier canal no listado se deniega por defecto.
- Use una entrada de canal `"*"` para aplicar valores predeterminados en todos los canales; las entradas explícitas de canal anulan el comodín.
- Los hilos heredan la configuración del canal padre (lista de permitidos, `requireMention`, skills, prompts, etc.) a menos que agregue explícitamente el id del hilo.
- Pista de propietario: cuando una lista de permitidos `users` por servidor o por canal coincide con el remitente, OpenClaw trata a ese remitente como el propietario en el prompt del sistema. Para un propietario global entre canales, configure `commands.ownerAllowFrom`.
- Los mensajes creados por bots se ignoran por defecto; configure `channels.discord.allowBots=true` para permitirlos (los mensajes propios siguen filtrados).
- Advertencia: si permite respuestas a otros bots (`channels.discord.allowBots=true`), evite bucles bot-a-bot con `requireMention`, listas de permitidos `channels.discord.guilds.*.channels.<id>.users`, y/o eliminando guardrails en `AGENTS.md` y `SOUL.md`.

### 6) Verificar que funciona

1. Inicie el Gateway.
2. En su canal del servidor, envíe: `@Krill hello` (o el nombre de su bot).
3. Si no ocurre nada: revise **Solución de problemas** abajo.

### Solución de problemas

- Primero: ejecute `openclaw doctor` y `openclaw channels status --probe` (advertencias accionables + auditorías rápidas).
- **“Used disallowed intents”**: habilite **Message Content Intent** (y probablemente **Server Members Intent**) en el Developer Portal, luego reinicie el Gateway.
- **El bot se conecta pero nunca responde en un canal de servidor**:
  - Falta **Message Content Intent**, o
  - El bot carece de permisos del canal (View/Send/Read History), o
  - Su configuración requiere menciones y no lo mencionó, o
  - Su lista de permitidos del servidor/canal deniega el canal/usuario.
- **`requireMention: false` pero aún no hay respuestas**:
- `channels.discord.groupPolicy` tiene como valor predeterminado **allowlist**; configúrelo como `"open"` o agregue una entrada de servidor bajo `channels.discord.guilds` (opcionalmente liste canales bajo `channels.discord.guilds.<id>.channels` para restringir).
  - Si solo configura `DISCORD_BOT_TOKEN` y nunca crea una sección `channels.discord`, el runtime
    establece por defecto `groupPolicy` como `open`. Agregue `channels.discord.groupPolicy`,
    `channels.defaults.groupPolicy`, o una lista de permitidos de servidor/canal para restringirlo.
- `requireMention` debe estar bajo `channels.discord.guilds` (o un canal específico). `channels.discord.requireMention` en el nivel superior se ignora.
- Las **auditorías de permisos** (`channels status --probe`) solo verifican IDs numéricos de canales. Si usa slugs/nombres como claves `channels.discord.guilds.*.channels`, la auditoría no puede verificar permisos.
- **Los Mensajes directos no funcionan**: `channels.discord.dm.enabled=false`, `channels.discord.dm.policy="disabled"`, o aún no ha sido aprobado (`channels.discord.dm.policy="pairing"`).
- **Aprobaciones de exec en Discord**: Discord admite una **interfaz de botones** para aprobaciones de exec en Mensajes directos (Permitir una vez / Permitir siempre / Denegar). `/approve <id> ...` es solo para aprobaciones reenviadas y no resolverá los avisos de botones de Discord. Si ve `❌ Failed to submit approval: Error: unknown approval id` o la interfaz nunca aparece, verifique:
  - `channels.discord.execApprovals.enabled: true` en su configuración.
  - Que su ID de usuario de Discord esté listado en `channels.discord.execApprovals.approvers` (la interfaz solo se envía a aprobadores).
  - Use los botones en el aviso por Mensaje directo (**Permitir una vez**, **Permitir siempre**, **Denegar**).
  - Vea [Exec approvals](/tools/exec-approvals) y [Slash commands](/tools/slash-commands) para el flujo más amplio de aprobaciones y comandos.

## Capacidades y límites

- Mensajes directos y canales de texto de servidores (los hilos se tratan como canales separados; voz no compatible).
- Indicadores de escritura enviados en el mejor esfuerzo; el troceado de mensajes usa `channels.discord.textChunkLimit` (predeterminado 2000) y divide respuestas largas por conteo de líneas (`channels.discord.maxLinesPerMessage`, predeterminado 17).
- Troceado opcional por saltos de línea: configure `channels.discord.chunkMode="newline"` para dividir en líneas en blanco (límites de párrafo) antes del troceado por longitud.
- Carga de archivos compatible hasta el `channels.discord.mediaMaxMb` configurado (predeterminado 8 MB).
- Respuestas en servidores con mención obligatoria por defecto para evitar bots ruidosos.
- El contexto de respuesta se inyecta cuando un mensaje referencia a otro mensaje (contenido citado + ids).
- El encadenado nativo de respuestas está **desactivado por defecto**; habilítelo con `channels.discord.replyToMode` y etiquetas de respuesta.

## Política de reintentos

Las llamadas salientes a la API de Discord reintentan en límites de tasa (429) usando `retry_after` de Discord cuando está disponible, con backoff exponencial y jitter. Configure mediante `channels.discord.retry`. Vea [Retry policy](/concepts/retry).

## Configuración

```json5
{
  channels: {
    discord: {
      enabled: true,
      token: "abc.123",
      groupPolicy: "allowlist",
      guilds: {
        "*": {
          channels: {
            general: { allow: true },
          },
        },
      },
      mediaMaxMb: 8,
      actions: {
        reactions: true,
        stickers: true,
        emojiUploads: true,
        stickerUploads: true,
        polls: true,
        permissions: true,
        messages: true,
        threads: true,
        pins: true,
        search: true,
        memberInfo: true,
        roleInfo: true,
        roles: false,
        channelInfo: true,
        channels: true,
        voiceStatus: true,
        events: true,
        moderation: false,
        presence: false,
      },
      replyToMode: "off",
      dm: {
        enabled: true,
        policy: "pairing", // pairing | allowlist | open | disabled
        allowFrom: ["123456789012345678", "steipete"],
        groupEnabled: false,
        groupChannels: ["openclaw-dm"],
      },
      guilds: {
        "*": { requireMention: true },
        "123456789012345678": {
          slug: "friends-of-openclaw",
          requireMention: false,
          reactionNotifications: "own",
          users: ["987654321098765432", "steipete"],
          channels: {
            general: { allow: true },
            help: {
              allow: true,
              requireMention: true,
              users: ["987654321098765432"],
              skills: ["search", "docs"],
              systemPrompt: "Keep answers short.",
            },
          },
        },
      },
    },
  },
}
```

Las reacciones de acuse se controlan globalmente mediante `messages.ackReaction` +
`messages.ackReactionScope`. Use `messages.removeAckAfterReply` para limpiar la
reacción de acuse después de que el bot responda.

- `dm.enabled`: configure `false` para ignorar todos los Mensajes directos (predeterminado `true`).
- `dm.policy`: control de acceso a Mensajes directos (`pairing` recomendado). `"open"` requiere `dm.allowFrom=["*"]`.
- `dm.allowFrom`: lista de permitidos de Mensajes directos (ids o nombres de usuario). Usada por `dm.policy="allowlist"` y para validación de `dm.policy="open"`. El asistente acepta nombres de usuario y los resuelve a ids cuando el bot puede buscar miembros.
- `dm.groupEnabled`: habilitar Mensajes directos grupales (predeterminado `false`).
- `dm.groupChannels`: lista de permitidos opcional para ids o slugs de canales de Mensajes directos grupales.
- `groupPolicy`: controla el manejo de canales de servidor (`open|disabled|allowlist`); `allowlist` requiere listas de permitidos de canales.
- `guilds`: reglas por servidor con clave por id de servidor (preferido) o slug.
- `guilds."*"`: configuraciones predeterminadas por servidor aplicadas cuando no existe una entrada explícita.
- `guilds.<id>.slug`: slug amigable opcional usado para nombres visibles.
- `guilds.<id>.users`: lista de permitidos opcional de usuarios por servidor (ids o nombres).
- `guilds.<id>.tools`: anulaciones opcionales de política de herramientas por servidor (`allow`/`deny`/`alsoAllow`) usadas cuando falta la anulación por canal.
- `guilds.<id>.toolsBySender`: anulaciones opcionales de política de herramientas por remitente a nivel de servidor (se aplican cuando falta la anulación por canal; se admite comodín `"*"`).
- `guilds.<id>.channels.<channel>.allow`: permitir/denegar el canal cuando `groupPolicy="allowlist"`.
- `guilds.<id>.channels.<channel>.requireMention`: control por mención para el canal.
- `guilds.<id>.channels.<channel>.tools`: anulaciones opcionales de política de herramientas por canal (`allow`/`deny`/`alsoAllow`).
- `guilds.<id>.channels.<channel>.toolsBySender`: anulaciones opcionales de política de herramientas por remitente dentro del canal (se admite comodín `"*"`).
- `guilds.<id>.channels.<channel>.users`: lista de permitidos opcional de usuarios por canal.
- `guilds.<id>.channels.<channel>.skills`: filtro de skills (omitir = todas las skills, vacío = ninguna).
- `guilds.<id>.channels.<channel>.systemPrompt`: prompt de sistema adicional para el canal. Los temas de canales de Discord se inyectan como contexto **no confiable** (no como prompt del sistema).
- `guilds.<id>.channels.<channel>.enabled`: configure `false` para deshabilitar el canal.
- `guilds.<id>.channels`: reglas de canal (las claves son slugs o ids de canal).
- `guilds.<id>.requireMention`: requisito de mención por servidor (anulable por canal).
- `guilds.<id>.reactionNotifications`: modo de eventos del sistema de reacciones (`off`, `own`, `all`, `allowlist`).
- `textChunkLimit`: tamaño de trozo de texto saliente (caracteres). Predeterminado: 2000.
- `chunkMode`: `length` (predeterminado) divide solo cuando excede `textChunkLimit`; `newline` divide en líneas en blanco (límites de párrafo) antes del troceado por longitud.
- `maxLinesPerMessage`: máximo suave de líneas por mensaje. Predeterminado: 17.
- `mediaMaxMb`: limitar medios entrantes guardados en disco.
- `historyLimit`: número de mensajes recientes del servidor a incluir como contexto al responder a una mención (predeterminado 20; fallback a `messages.groupChat.historyLimit`; `0` deshabilita).
- `dmHistoryLimit`: límite de historial de Mensajes directos en turnos de usuario. Anulaciones por usuario: `dms["<user_id>"].historyLimit`.
- `retry`: política de reintentos para llamadas salientes a la API de Discord (intentos, minDelayMs, maxDelayMs, jitter).
- `pluralkit`: resolver mensajes proxificados de PluralKit para que los miembros del sistema aparezcan como remitentes distintos.
- `actions`: controles de herramientas por acción; omitir para permitir todo (configure `false` para deshabilitar).
  - `reactions` (cubre reaccionar + leer reacciones)
  - `stickers`, `emojiUploads`, `stickerUploads`, `polls`, `permissions`, `messages`, `threads`, `pins`, `search`
  - `memberInfo`, `roleInfo`, `channelInfo`, `voiceStatus`, `events`
  - `channels` (crear/editar/eliminar canales + categorías + permisos)
  - `roles` (agregar/quitar roles, predeterminado `false`)
  - `moderation` (timeout/expulsar/banear, predeterminado `false`)
  - `presence` (estado/actividad del bot, predeterminado `false`)
- `execApprovals`: aprobaciones de exec solo para Discord por Mensaje directo (interfaz de botones). Admite `enabled`, `approvers`, `agentFilter`, `sessionFilter`.

Las notificaciones de reacciones usan `guilds.<id>.reactionNotifications`:

- `off`: sin eventos de reacción.
- `own`: reacciones en los mensajes propios del bot (predeterminado).
- `all`: todas las reacciones en todos los mensajes.
- `allowlist`: reacciones de `guilds.<id>.users` en todos los mensajes (lista vacía deshabilita).

### Soporte de PluralKit (PK)

Habilite búsquedas de PK para que los mensajes proxificados se resuelvan al sistema + miembro subyacentes.
Cuando está habilitado, OpenClaw usa la identidad del miembro para listas de permitidos y etiqueta al
remitente como `Member (PK:System)` para evitar pings accidentales en Discord.

```json5
{
  channels: {
    discord: {
      pluralkit: {
        enabled: true,
        token: "pk_live_...", // optional; required for private systems
      },
    },
  },
}
```

Notas de listas de permitidos (con PK habilitado):

- Use `pk:<memberId>` en `dm.allowFrom`, `guilds.<id>.users`, o `users` por canal.
- Los nombres visibles de miembros también coinciden por nombre/slug.
- Las búsquedas usan el **ID del mensaje original** de Discord (el mensaje previo al proxy), por lo que
  la API de PK solo lo resuelve dentro de su ventana de 30 minutos.
- Si las búsquedas de PK fallan (p. ej., sistema privado sin token), los mensajes proxificados
  se tratan como mensajes de bot y se descartan a menos que `channels.discord.allowBots=true`.

### Valores predeterminados de acciones de herramientas

| Grupo de acciones | Predeterminado | Notas                                      |
| ----------------- | -------------- | ------------------------------------------ |
| reactions         | enabled        | Reaccionar + listar reacciones + emojiList |
| stickers          | enabled        | Enviar stickers                            |
| emojiUploads      | enabled        | Subir emojis                               |
| stickerUploads    | enabled        | Subir stickers                             |
| polls             | enabled        | Crear encuestas                            |
| permissions       | enabled        | Instantánea de permisos de canal           |
| messages          | enabled        | Leer/enviar/editar/eliminar                |
| threads           | enabled        | Crear/listar/responder                     |
| pins              | enabled        | Fijar/desfijar/listar                      |
| search            | enabled        | Búsqueda de mensajes (vista previa)        |
| memberInfo        | enabled        | Información de miembros                    |
| roleInfo          | enabled        | Lista de roles                             |
| channelInfo       | enabled        | Información de canal + lista               |
| channels          | enabled        | Gestión de canales/categorías              |
| voiceStatus       | enabled        | Consulta de estado de voz                  |
| events            | enabled        | Listar/crear eventos programados           |
| roles             | disabled       | Agregar/quitar roles                       |
| moderation        | disabled       | Timeout/expulsar/banear                    |
| presence          | disabled       | Estado/actividad del bot (setPresence)     |

- `replyToMode`: `off` (predeterminado), `first`, o `all`. Aplica solo cuando el modelo incluye una etiqueta de respuesta.

## Etiquetas de respuesta

Para solicitar una respuesta en hilo, el modelo puede incluir una etiqueta en su salida:

- `[[reply_to_current]]` — responder al mensaje de Discord que activó la acción.
- `[[reply_to:<id>]]` — responder a un id de mensaje específico del contexto/historial.
  Los ids de mensajes actuales se agregan a los prompts como `[message_id: …]`; las entradas del historial ya incluyen ids.

El comportamiento se controla con `channels.discord.replyToMode`:

- `off`: ignorar etiquetas.
- `first`: solo el primer trozo/adjunto saliente es una respuesta.
- `all`: cada trozo/adjunto saliente es una respuesta.

Notas de coincidencia de listas de permitidos:

- `allowFrom`/`users`/`groupChannels` aceptan ids, nombres, etiquetas o menciones como `<@id>`.
- Se admiten prefijos como `discord:`/`user:` (usuarios) y `channel:` (Mensajes directos grupales).
- Use `*` para permitir cualquier remitente/canal.
- Cuando `guilds.<id>.channels` está presente, los canales no listados se deniegan por defecto.
- Cuando `guilds.<id>.channels` se omite, se permiten todos los canales del servidor en la lista de permitidos.
- Para permitir **ningún canal**, configure `channels.discord.groupPolicy: "disabled"` (o mantenga una lista de permitidos vacía).
- El asistente de configuración acepta nombres `Guild/Channel` (públicos + privados) y los resuelve a IDs cuando es posible.
- Al iniciar, OpenClaw resuelve nombres de canales/usuarios en listas de permitidos a IDs (cuando el bot puede buscar miembros)
  y registra el mapeo; las entradas no resueltas se mantienen tal como se escribieron.

Notas sobre comandos nativos:

- Los comandos registrados reflejan los comandos de chat de OpenClaw.
- Los comandos nativos respetan las mismas listas de permitidos que los Mensajes directos/mensajes de servidor (`channels.discord.dm.allowFrom`, `channels.discord.guilds`, reglas por canal).
- Los slash commands aún pueden ser visibles en la interfaz de Discord para usuarios que no están en la lista de permitidos; OpenClaw aplica las listas de permitidos en la ejecución y responde “no autorizado”.

## Acciones de herramientas

El agente puede llamar a `discord` con acciones como:

- `react` / `reactions` (agregar o listar reacciones)
- `sticker`, `poll`, `permissions`
- `readMessages`, `sendMessage`, `editMessage`, `deleteMessage`
- Las cargas de herramientas de leer/buscar/fijar incluyen `timestampMs` normalizado (UTC epoch ms) y `timestampUtc` junto con el `timestamp` crudo de Discord.
- `threadCreate`, `threadList`, `threadReply`
- `pinMessage`, `unpinMessage`, `listPins`
- `searchMessages`, `memberInfo`, `roleInfo`, `roleAdd`, `roleRemove`, `emojiList`
- `channelInfo`, `channelList`, `voiceStatus`, `eventList`, `eventCreate`
- `timeout`, `kick`, `ban`
- `setPresence` (actividad del bot y estado en línea)

Los ids de mensajes de Discord se muestran en el contexto inyectado (`[discord message id: …]` y líneas de historial) para que el agente pueda apuntarlos.
Los emojis pueden ser unicode (p. ej., `✅`) o sintaxis de emoji personalizados como `<:party_blob:1234567890>`.

## Seguridad y operaciones

- Trate el token del bot como una contraseña; prefiera la variable de entorno `DISCORD_BOT_TOKEN` en hosts supervisados o restrinja los permisos del archivo de configuración.
- Otorgue al bot solo los permisos que necesita (normalmente Leer/Enviar mensajes).
- Si el bot queda atascado o limitado por tasa, reinicie el Gateway (`openclaw gateway --force`) después de confirmar que ningún otro proceso posee la sesión de Discord.
