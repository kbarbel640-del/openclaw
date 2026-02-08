---
summary: "iMessage vía el servidor macOS de BlueBubbles (envío/recepción REST, escritura, reacciones, emparejamiento, acciones avanzadas)."
read_when:
  - Configuración del canal BlueBubbles
  - Solución de problemas de emparejamiento de webhooks
  - Configuración de iMessage en macOS
title: "BlueBubbles"
x-i18n:
  source_path: channels/bluebubbles.md
  source_hash: 1414cf657d347ee7
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:58:11Z
---

# BlueBubbles (REST de macOS)

Estado: plugin incluido que se comunica con el servidor macOS de BlueBubbles mediante HTTP. **Recomendado para la integración con iMessage** debido a su API más completa y una configuración más sencilla en comparación con el canal imsg heredado.

## Descripción general

- Se ejecuta en macOS mediante la app auxiliar de BlueBubbles ([bluebubbles.app](https://bluebubbles.app)).
- Recomendado/probado: macOS Sequoia (15). macOS Tahoe (26) funciona; la edición está actualmente rota en Tahoe y las actualizaciones del ícono de grupo pueden reportar éxito pero no sincronizar.
- OpenClaw se comunica a través de su API REST (`GET /api/v1/ping`, `POST /message/text`, `POST /chat/:id/*`).
- Los mensajes entrantes llegan vía webhooks; las respuestas salientes, indicadores de escritura, confirmaciones de lectura y tapbacks son llamadas REST.
- Los adjuntos y stickers se ingieren como medios entrantes (y se exponen al agente cuando es posible).
- El emparejamiento/lista de permitidos funciona igual que en otros canales (`/start/pairing` etc.) con `channels.bluebubbles.allowFrom` + códigos de emparejamiento.
- Las reacciones se exponen como eventos del sistema igual que Slack/Telegram, para que los agentes puedan “mencionarlas” antes de responder.
- Funciones avanzadas: editar, deshacer envío, hilos de respuesta, efectos de mensaje, gestión de grupos.

## Inicio rápido

1. Instale el servidor de BlueBubbles en su Mac (siga las instrucciones en [bluebubbles.app/install](https://bluebubbles.app/install)).
2. En la configuración de BlueBubbles, habilite la API web y establezca una contraseña.
3. Ejecute `openclaw onboard` y seleccione BlueBubbles, o configure manualmente:
   ```json5
   {
     channels: {
       bluebubbles: {
         enabled: true,
         serverUrl: "http://192.168.1.100:1234",
         password: "example-password",
         webhookPath: "/bluebubbles-webhook",
       },
     },
   }
   ```
4. Apunte los webhooks de BlueBubbles a su Gateway (ejemplo: `https://your-gateway-host:3000/bluebubbles-webhook?password=<password>`).
5. Inicie el Gateway; registrará el manejador de webhooks y comenzará el emparejamiento.

## Mantener Messages.app activo (VM / configuraciones headless)

Algunas configuraciones de macOS en VM / siempre encendidas pueden hacer que Messages.app quede “inactivo” (los eventos entrantes se detienen hasta que la app se abre o pasa al primer plano). Una solución simple es **activar Messages cada 5 minutos** usando un AppleScript + LaunchAgent.

### 1) Guardar el AppleScript

Guárdelo como:

- `~/Scripts/poke-messages.scpt`

Script de ejemplo (no interactivo; no roba el foco):

```applescript
try
  tell application "Messages"
    if not running then
      launch
    end if

    -- Touch the scripting interface to keep the process responsive.
    set _chatCount to (count of chats)
  end tell
on error
  -- Ignore transient failures (first-run prompts, locked session, etc).
end try
```

### 2) Instalar un LaunchAgent

Guárdelo como:

- `~/Library/LaunchAgents/com.user.poke-messages.plist`

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
  <dict>
    <key>Label</key>
    <string>com.user.poke-messages</string>

    <key>ProgramArguments</key>
    <array>
      <string>/bin/bash</string>
      <string>-lc</string>
      <string>/usr/bin/osascript &quot;$HOME/Scripts/poke-messages.scpt&quot;</string>
    </array>

    <key>RunAtLoad</key>
    <true/>

    <key>StartInterval</key>
    <integer>300</integer>

    <key>StandardOutPath</key>
    <string>/tmp/poke-messages.log</string>
    <key>StandardErrorPath</key>
    <string>/tmp/poke-messages.err</string>
  </dict>
</plist>
```

Notas:

- Esto se ejecuta **cada 300 segundos** y **al iniciar sesión**.
- La primera ejecución puede activar avisos de **Automatización** de macOS (`osascript` → Messages). Apruébelos en la misma sesión de usuario que ejecuta el LaunchAgent.

Cárguelo:

```bash
launchctl unload ~/Library/LaunchAgents/com.user.poke-messages.plist 2>/dev/null || true
launchctl load ~/Library/LaunchAgents/com.user.poke-messages.plist
```

## Incorporacion

BlueBubbles está disponible en el asistente interactivo de configuración:

```
openclaw onboard
```

El asistente solicita:

- **URL del servidor** (requerido): dirección del servidor BlueBubbles (p. ej., `http://192.168.1.100:1234`)
- **Contraseña** (requerido): contraseña de la API desde la configuración del servidor BlueBubbles
- **Ruta del webhook** (opcional): por defecto `/bluebubbles-webhook`
- **Política de Mensajes directos**: emparejamiento, lista de permitidos, abierto o deshabilitado
- **Lista de permitidos**: números de teléfono, correos electrónicos o destinos de chat

También puede agregar BlueBubbles vía CLI:

```
openclaw channels add bluebubbles --http-url http://192.168.1.100:1234 --password <password>
```

## Control de acceso (Mensajes directos + grupos)

Mensajes directos:

- Predeterminado: `channels.bluebubbles.dmPolicy = "pairing"`.
- Los remitentes desconocidos reciben un código de emparejamiento; los mensajes se ignoran hasta su aprobación (los códigos expiran después de 1 hora).
- Apruebe vía:
  - `openclaw pairing list bluebubbles`
  - `openclaw pairing approve bluebubbles <CODE>`
- El emparejamiento es el intercambio de tokens predeterminado. Detalles: [Pairing](/start/pairing)

Grupos:

- `channels.bluebubbles.groupPolicy = open | allowlist | disabled` (predeterminado: `allowlist`).
- `channels.bluebubbles.groupAllowFrom` controla quién puede activar en grupos cuando se establece `allowlist`.

### Bloqueo por menciones (grupos)

BlueBubbles admite bloqueo por menciones para chats grupales, coincidiendo con el comportamiento de iMessage/WhatsApp:

- Usa `agents.list[].groupChat.mentionPatterns` (o `messages.groupChat.mentionPatterns`) para detectar menciones.
- Cuando `requireMention` está habilitado para un grupo, el agente solo responde cuando es mencionado.
- Los comandos de control de remitentes autorizados omiten el bloqueo por menciones.

Configuración por grupo:

```json5
{
  channels: {
    bluebubbles: {
      groupPolicy: "allowlist",
      groupAllowFrom: ["+15555550123"],
      groups: {
        "*": { requireMention: true }, // default for all groups
        "iMessage;-;chat123": { requireMention: false }, // override for specific group
      },
    },
  },
}
```

### Bloqueo de comandos

- Los comandos de control (p. ej., `/config`, `/model`) requieren autorización.
- Usa `allowFrom` y `groupAllowFrom` para determinar la autorización de comandos.
- Los remitentes autorizados pueden ejecutar comandos de control incluso sin mencionar en grupos.

## Escritura + confirmaciones de lectura

- **Indicadores de escritura**: se envían automáticamente antes y durante la generación de la respuesta.
- **Confirmaciones de lectura**: controladas por `channels.bluebubbles.sendReadReceipts` (predeterminado: `true`).
- **Indicadores de escritura**: OpenClaw envía eventos de inicio de escritura; BlueBubbles limpia la escritura automáticamente al enviar o por tiempo de espera (la detención manual vía DELETE no es confiable).

```json5
{
  channels: {
    bluebubbles: {
      sendReadReceipts: false, // disable read receipts
    },
  },
}
```

## Acciones avanzadas

BlueBubbles admite acciones avanzadas de mensajes cuando están habilitadas en la configuración:

```json5
{
  channels: {
    bluebubbles: {
      actions: {
        reactions: true, // tapbacks (default: true)
        edit: true, // edit sent messages (macOS 13+, broken on macOS 26 Tahoe)
        unsend: true, // unsend messages (macOS 13+)
        reply: true, // reply threading by message GUID
        sendWithEffect: true, // message effects (slam, loud, etc.)
        renameGroup: true, // rename group chats
        setGroupIcon: true, // set group chat icon/photo (flaky on macOS 26 Tahoe)
        addParticipant: true, // add participants to groups
        removeParticipant: true, // remove participants from groups
        leaveGroup: true, // leave group chats
        sendAttachment: true, // send attachments/media
      },
    },
  },
}
```

Acciones disponibles:

- **react**: Agregar/quitar reacciones tapback (`messageId`, `emoji`, `remove`)
- **edit**: Editar un mensaje enviado (`messageId`, `text`)
- **unsend**: Deshacer el envío de un mensaje (`messageId`)
- **reply**: Responder a un mensaje específico (`messageId`, `text`, `to`)
- **sendWithEffect**: Enviar con efecto de iMessage (`text`, `to`, `effectId`)
- **renameGroup**: Renombrar un chat grupal (`chatGuid`, `displayName`)
- **setGroupIcon**: Establecer el ícono/foto de un chat grupal (`chatGuid`, `media`) — inestable en macOS 26 Tahoe (la API puede devolver éxito pero el ícono no se sincroniza).
- **addParticipant**: Agregar a alguien a un grupo (`chatGuid`, `address`)
- **removeParticipant**: Quitar a alguien de un grupo (`chatGuid`, `address`)
- **leaveGroup**: Salir de un chat grupal (`chatGuid`)
- **sendAttachment**: Enviar medios/archivos (`to`, `buffer`, `filename`, `asVoice`)
  - Notas de voz: establezca `asVoice: true` con audio **MP3** o **CAF** para enviar como mensaje de voz de iMessage. BlueBubbles convierte MP3 → CAF al enviar notas de voz.

### IDs de mensajes (cortos vs completos)

OpenClaw puede exponer IDs de mensaje _cortos_ (p. ej., `1`, `2`) para ahorrar tokens.

- `MessageSid` / `ReplyToId` pueden ser IDs cortos.
- `MessageSidFull` / `ReplyToIdFull` contienen los IDs completos del proveedor.
- Los IDs cortos están en memoria; pueden expirar al reiniciar o por expulsión de caché.
- Las acciones aceptan `messageId` cortos o completos, pero los IDs cortos fallarán si ya no están disponibles.

Use IDs completos para automatizaciones y almacenamiento duraderos:

- Plantillas: `{{MessageSidFull}}`, `{{ReplyToIdFull}}`
- Contexto: `MessageSidFull` / `ReplyToIdFull` en cargas entrantes

Consulte [Configuration](/gateway/configuration) para variables de plantillas.

## Bloquear streaming

Controle si las respuestas se envían como un solo mensaje o se transmiten en bloques:

```json5
{
  channels: {
    bluebubbles: {
      blockStreaming: true, // enable block streaming (off by default)
    },
  },
}
```

## Medios + límites

- Los adjuntos entrantes se descargan y almacenan en la caché de medios.
- Límite de medios vía `channels.bluebubbles.mediaMaxMb` (predeterminado: 8 MB).
- El texto saliente se fragmenta a `channels.bluebubbles.textChunkLimit` (predeterminado: 4000 caracteres).

## Referencia de configuración

Configuración completa: [Configuration](/gateway/configuration)

Opciones del proveedor:

- `channels.bluebubbles.enabled`: Habilitar/deshabilitar el canal.
- `channels.bluebubbles.serverUrl`: URL base de la API REST de BlueBubbles.
- `channels.bluebubbles.password`: Contraseña de la API.
- `channels.bluebubbles.webhookPath`: Ruta del endpoint del webhook (predeterminado: `/bluebubbles-webhook`).
- `channels.bluebubbles.dmPolicy`: `pairing | allowlist | open | disabled` (predeterminado: `pairing`).
- `channels.bluebubbles.allowFrom`: Lista de permitidos de Mensajes directos (identificadores, correos, números E.164, `chat_id:*`, `chat_guid:*`).
- `channels.bluebubbles.groupPolicy`: `open | allowlist | disabled` (predeterminado: `allowlist`).
- `channels.bluebubbles.groupAllowFrom`: Lista de permitidos de remitentes de grupos.
- `channels.bluebubbles.groups`: Configuración por grupo (`requireMention`, etc.).
- `channels.bluebubbles.sendReadReceipts`: Enviar confirmaciones de lectura (predeterminado: `true`).
- `channels.bluebubbles.blockStreaming`: Habilitar transmisión por bloques (predeterminado: `false`; requerido para respuestas en streaming).
- `channels.bluebubbles.textChunkLimit`: Tamaño de fragmento saliente en caracteres (predeterminado: 4000).
- `channels.bluebubbles.chunkMode`: `length` (predeterminado) divide solo al exceder `textChunkLimit`; `newline` divide en líneas en blanco (límites de párrafo) antes del fragmentado por longitud.
- `channels.bluebubbles.mediaMaxMb`: Límite de medios entrantes en MB (predeterminado: 8).
- `channels.bluebubbles.historyLimit`: Máximo de mensajes de grupo para contexto (0 deshabilita).
- `channels.bluebubbles.dmHistoryLimit`: Límite de historial de Mensajes directos.
- `channels.bluebubbles.actions`: Habilitar/deshabilitar acciones específicas.
- `channels.bluebubbles.accounts`: Configuración de múltiples cuentas.

Opciones globales relacionadas:

- `agents.list[].groupChat.mentionPatterns` (o `messages.groupChat.mentionPatterns`).
- `messages.responsePrefix`.

## Direccionamiento / destinos de entrega

Prefiera `chat_guid` para un enrutamiento estable:

- `chat_guid:iMessage;-;+15555550123` (preferido para grupos)
- `chat_id:123`
- `chat_identifier:...`
- Identificadores directos: `+15555550123`, `user@example.com`
  - Si un identificador directo no tiene un chat de Mensaje directo existente, OpenClaw creará uno vía `POST /api/v1/chat/new`. Esto requiere que la API privada de BlueBubbles esté habilitada.

## Seguridad

- Las solicitudes de webhook se autentican comparando los parámetros de consulta o encabezados `guid`/`password` contra `channels.bluebubbles.password`. También se aceptan solicitudes desde `localhost`.
- Mantenga en secreto la contraseña de la API y el endpoint del webhook (trátelos como credenciales).
- La confianza en localhost significa que un proxy inverso en el mismo host puede omitir la contraseña de forma no intencional. Si usa un proxy para el Gateway, requiera autenticación en el proxy y configure `gateway.trustedProxies`. Consulte [Gateway security](/gateway/security#reverse-proxy-configuration).
- Habilite HTTPS + reglas de firewall en el servidor BlueBubbles si lo expone fuera de su LAN.

## Solucion de problemas

- Si los eventos de escritura/lectura dejan de funcionar, revise los registros de webhooks de BlueBubbles y verifique que la ruta del Gateway coincida con `channels.bluebubbles.webhookPath`.
- Los códigos de emparejamiento expiran después de una hora; use `openclaw pairing list bluebubbles` y `openclaw pairing approve bluebubbles <code>`.
- Las reacciones requieren la API privada de BlueBubbles (`POST /api/v1/message/react`); asegúrese de que la versión del servidor la exponga.
- Editar/deshacer envío requiere macOS 13+ y una versión compatible del servidor BlueBubbles. En macOS 26 (Tahoe), la edición está actualmente rota debido a cambios en la API privada.
- Las actualizaciones del ícono de grupo pueden ser inestables en macOS 26 (Tahoe): la API puede devolver éxito pero el nuevo ícono no se sincroniza.
- OpenClaw oculta automáticamente acciones conocidas como rotas según la versión de macOS del servidor BlueBubbles. Si la edición aún aparece en macOS 26 (Tahoe), desactívela manualmente con `channels.bluebubbles.actions.edit=false`.
- Para información de estado/salud: `openclaw status --all` o `openclaw status --deep`.

Para una referencia general del flujo de trabajo de canales, consulte [Channels](/channels) y la guía de [Plugins](/plugins).
