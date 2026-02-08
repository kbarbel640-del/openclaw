---
summary: "Compatibilidad con Signal mediante signal-cli (JSON-RPC + SSE), configuracion y modelo de numeros"
read_when:
  - Configuracion del soporte de Signal
  - Depuracion del envio/recepcion de Signal
title: "Signal"
x-i18n:
  source_path: channels/signal.md
  source_hash: ca4de8b3685017f5
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:58:09Z
---

# Signal (signal-cli)

Estado: integracion de CLI externa. El Gateway se comunica con `signal-cli` mediante HTTP JSON-RPC + SSE.

## Inicio rapido (principiante)

1. Use un **numero de Signal separado** para el bot (recomendado).
2. Instale `signal-cli` (se requiere Java).
3. Vincule el dispositivo del bot e inicie el daemon:
   - `signal-cli link -n "OpenClaw"`
4. Configure OpenClaw e inicie el gateway.

Configuracion minima:

```json5
{
  channels: {
    signal: {
      enabled: true,
      account: "+15551234567",
      cliPath: "signal-cli",
      dmPolicy: "pairing",
      allowFrom: ["+15557654321"],
    },
  },
}
```

## Que es

- Canal de Signal mediante `signal-cli` (no es una libsignal embebida).
- Enrutamiento determinista: las respuestas siempre regresan a Signal.
- Los Mensajes directos comparten la sesion principal del agente; los grupos estan aislados (`agent:<agentId>:signal:group:<groupId>`).

## Escrituras de configuracion

De forma predeterminada, Signal puede escribir actualizaciones de configuracion activadas por `/config set|unset` (requiere `commands.config: true`).

Deshabilite con:

```json5
{
  channels: { signal: { configWrites: false } },
}
```

## El modelo de numeros (importante)

- El gateway se conecta a un **dispositivo de Signal** (la cuenta `signal-cli`).
- Si ejecuta el bot en **su cuenta personal de Signal**, ignorara sus propios mensajes (proteccion de bucles).
- Para el caso de "le escribo al bot y responde", use un **numero de bot separado**.

## Configuracion (ruta rapida)

1. Instale `signal-cli` (se requiere Java).
2. Vincule una cuenta de bot:
   - `signal-cli link -n "OpenClaw"` y luego escanee el QR en Signal.
3. Configure Signal e inicie el gateway.

Ejemplo:

```json5
{
  channels: {
    signal: {
      enabled: true,
      account: "+15551234567",
      cliPath: "signal-cli",
      dmPolicy: "pairing",
      allowFrom: ["+15557654321"],
    },
  },
}
```

Soporte multi-cuenta: use `channels.signal.accounts` con configuracion por cuenta y `name` opcional. Vea [`gateway/configuration`](/gateway/configuration#telegramaccounts--discordaccounts--slackaccounts--signalaccounts--imessageaccounts) para el patron compartido.

## Modo daemon externo (httpUrl)

Si desea administrar `signal-cli` usted mismo (arranques lentos del JVM, inicializacion de contenedores o CPUs compartidas), ejecute el daemon por separado y apunte OpenClaw hacia el:

```json5
{
  channels: {
    signal: {
      httpUrl: "http://127.0.0.1:8080",
      autoStart: false,
    },
  },
}
```

Esto omite el auto-arranque y la espera de inicio dentro de OpenClaw. Para arranques lentos al auto-arrancar, configure `channels.signal.startupTimeoutMs`.

## Control de acceso (Mensajes directos + grupos)

Mensajes directos:

- Predeterminado: `channels.signal.dmPolicy = "pairing"`.
- Los remitentes desconocidos reciben un codigo de emparejamiento; los mensajes se ignoran hasta que se aprueban (los codigos expiran despues de 1 hora).
- Apruebe mediante:
  - `openclaw pairing list signal`
  - `openclaw pairing approve signal <CODE>`
- El emparejamiento es el intercambio de tokens predeterminado para Mensajes directos de Signal. Detalles: [Emparejamiento](/start/pairing)
- Los remitentes solo con UUID (de `sourceUuid`) se almacenan como `uuid:<id>` en `channels.signal.allowFrom`.

Grupos:

- `channels.signal.groupPolicy = open | allowlist | disabled`.
- `channels.signal.groupAllowFrom` controla quien puede activar acciones en grupos cuando se establece `allowlist`.

## Como funciona (comportamiento)

- `signal-cli` se ejecuta como daemon; el gateway lee eventos mediante SSE.
- Los mensajes entrantes se normalizan en el sobre compartido del canal.
- Las respuestas siempre se enrutan de vuelta al mismo numero o grupo.

## Medios + limites

- El texto saliente se divide en fragmentos de `channels.signal.textChunkLimit` (predeterminado 4000).
- Fragmentacion opcional por saltos de linea: establezca `channels.signal.chunkMode="newline"` para dividir por lineas en blanco (limites de parrafo) antes de la fragmentacion por longitud.
- Soporte de adjuntos (base64 obtenido de `signal-cli`).
- Limite de medios predeterminado: `channels.signal.mediaMaxMb` (predeterminado 8).
- Use `channels.signal.ignoreAttachments` para omitir la descarga de medios.
- El contexto del historial de grupos usa `channels.signal.historyLimit` (o `channels.signal.accounts.*.historyLimit`), con respaldo a `messages.groupChat.historyLimit`. Configure `0` para deshabilitarlo (predeterminado 50).

## Indicadores de escritura + confirmaciones de lectura

- **Indicadores de escritura**: OpenClaw envia senales de escritura mediante `signal-cli sendTyping` y las actualiza mientras se esta generando una respuesta.
- **Confirmaciones de lectura**: cuando `channels.signal.sendReadReceipts` es true, OpenClaw reenvia confirmaciones de lectura para Mensajes directos permitidos.
- Signal-cli no expone confirmaciones de lectura para grupos.

## Reacciones (herramienta de mensajes)

- Use `message action=react` con `channel=signal`.
- Objetivos: E.164 del remitente o UUID (use `uuid:<id>` de la salida de emparejamiento; un UUID sin prefijo tambien funciona).
- `messageId` es la marca de tiempo de Signal del mensaje al que esta reaccionando.
- Las reacciones en grupos requieren `targetAuthor` o `targetAuthorUuid`.

Ejemplos:

```
message action=react channel=signal target=uuid:123e4567-e89b-12d3-a456-426614174000 messageId=1737630212345 emoji=🔥
message action=react channel=signal target=+15551234567 messageId=1737630212345 emoji=🔥 remove=true
message action=react channel=signal target=signal:group:<groupId> targetAuthor=uuid:<sender-uuid> messageId=1737630212345 emoji=✅
```

Configuracion:

- `channels.signal.actions.reactions`: habilitar/deshabilitar acciones de reaccion (predeterminado true).
- `channels.signal.reactionLevel`: `off | ack | minimal | extensive`.
  - `off`/`ack` deshabilita las reacciones del agente (la herramienta de mensajes `react` devolvera error).
  - `minimal`/`extensive` habilita las reacciones del agente y establece el nivel de orientacion.
- Anulaciones por cuenta: `channels.signal.accounts.<id>.actions.reactions`, `channels.signal.accounts.<id>.reactionLevel`.

## Destinos de entrega (CLI/cron)

- Mensajes directos: `signal:+15551234567` (o E.164 simple).
- Mensajes directos por UUID: `uuid:<id>` (o UUID sin prefijo).
- Grupos: `signal:group:<groupId>`.
- Nombres de usuario: `username:<name>` (si su cuenta de Signal los admite).

## Referencia de configuracion (Signal)

Configuracion completa: [Configuracion](/gateway/configuration)

Opciones del proveedor:

- `channels.signal.enabled`: habilitar/deshabilitar el inicio del canal.
- `channels.signal.account`: E.164 para la cuenta del bot.
- `channels.signal.cliPath`: ruta a `signal-cli`.
- `channels.signal.httpUrl`: URL completa del daemon (anula host/puerto).
- `channels.signal.httpHost`, `channels.signal.httpPort`: enlace del daemon (predeterminado 127.0.0.1:8080).
- `channels.signal.autoStart`: auto-arranque del daemon (predeterminado true si `httpUrl` no esta configurado).
- `channels.signal.startupTimeoutMs`: tiempo de espera de inicio en ms (tope 120000).
- `channels.signal.receiveMode`: `on-start | manual`.
- `channels.signal.ignoreAttachments`: omitir descargas de adjuntos.
- `channels.signal.ignoreStories`: ignorar historias del daemon.
- `channels.signal.sendReadReceipts`: reenviar confirmaciones de lectura.
- `channels.signal.dmPolicy`: `pairing | allowlist | open | disabled` (predeterminado: emparejamiento).
- `channels.signal.allowFrom`: lista de permitidos para Mensajes directos (E.164 o `uuid:<id>`). `open` requiere `"*"`. Signal no tiene nombres de usuario; use IDs de telefono/UUID.
- `channels.signal.groupPolicy`: `open | allowlist | disabled` (predeterminado: lista de permitidos).
- `channels.signal.groupAllowFrom`: lista de remitentes permitidos para grupos.
- `channels.signal.historyLimit`: maximo de mensajes de grupo a incluir como contexto (0 lo deshabilita).
- `channels.signal.dmHistoryLimit`: limite de historial de Mensajes directos en turnos de usuario. Anulaciones por usuario: `channels.signal.dms["<phone_or_uuid>"].historyLimit`.
- `channels.signal.textChunkLimit`: tamano de fragmento saliente (caracteres).
- `channels.signal.chunkMode`: `length` (predeterminado) o `newline` para dividir por lineas en blanco (limites de parrafo) antes de la fragmentacion por longitud.
- `channels.signal.mediaMaxMb`: limite de medios entrantes/salientes (MB).

Opciones globales relacionadas:

- `agents.list[].groupChat.mentionPatterns` (Signal no admite menciones nativas).
- `messages.groupChat.mentionPatterns` (respaldo global).
- `messages.responsePrefix`.
