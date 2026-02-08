---
summary: "Soporte heredado de iMessage mediante imsg (JSON-RPC sobre stdio). Las nuevas configuraciones deben usar BlueBubbles."
read_when:
  - Configuracion del soporte de iMessage
  - Depuracion del envio/recepcion de iMessage
title: iMessage
x-i18n:
  source_path: channels/imessage.md
  source_hash: 7c8c276701528b8d
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:58:12Z
---

# iMessage (heredado: imsg)

> **Recomendado:** Use [BlueBubbles](/channels/bluebubbles) para nuevas configuraciones de iMessage.
>
> El canal `imsg` es una integracion heredada de CLI externa y puede eliminarse en una version futura.

Estado: integracion heredada de CLI externa. El Gateway inicia `imsg rpc` (JSON-RPC sobre stdio).

## Inicio rapido (principiante)

1. Asegurese de que Mensajes tenga sesion iniciada en este Mac.
2. Instale `imsg`:
   - `brew install steipete/tap/imsg`
3. Configure OpenClaw con `channels.imessage.cliPath` y `channels.imessage.dbPath`.
4. Inicie el Gateway y apruebe cualquier aviso de macOS (Automatizacion + Acceso completo al disco).

Configuracion minima:

```json5
{
  channels: {
    imessage: {
      enabled: true,
      cliPath: "/usr/local/bin/imsg",
      dbPath: "/Users/<you>/Library/Messages/chat.db",
    },
  },
}
```

## Que es

- Canal de iMessage respaldado por `imsg` en macOS.
- Enrutamiento determinista: las respuestas siempre regresan a iMessage.
- Los Mensajes directos comparten la sesion principal del agente; los grupos estan aislados (`agent:<agentId>:imessage:group:<chat_id>`).
- Si llega un hilo con varios participantes con `is_group=false`, aun puede aislarlo `chat_id` usando `channels.imessage.groups` (vea “Hilos tipo grupo” mas abajo).

## Escrituras de configuracion

De forma predeterminada, iMessage puede escribir actualizaciones de configuracion activadas por `/config set|unset` (requiere `commands.config: true`).

Desactive con:

```json5
{
  channels: { imessage: { configWrites: false } },
}
```

## Requisitos

- macOS con Mensajes con sesion iniciada.
- Acceso completo al disco para OpenClaw + `imsg` (acceso a la BD de Mensajes).
- Permiso de Automatizacion al enviar.
- `channels.imessage.cliPath` puede apuntar a cualquier comando que proxifique stdin/stdout (por ejemplo, un script envoltorio que haga SSH a otro Mac y ejecute `imsg rpc`).

## Configuracion (ruta rapida)

1. Asegurese de que Mensajes tenga sesion iniciada en este Mac.
2. Configure iMessage e inicie el Gateway.

### Usuario dedicado de macOS para el bot (identidad aislada)

Si desea que el bot envie desde una **identidad de iMessage separada** (y mantener limpios sus Mensajes personales), use un Apple ID dedicado + un usuario de macOS dedicado.

1. Cree un Apple ID dedicado (ejemplo: `my-cool-bot@icloud.com`).
   - Apple puede requerir un numero de telefono para verificacion / 2FA.
2. Cree un usuario de macOS (ejemplo: `openclawhome`) e inicie sesion.
3. Abra Mensajes en ese usuario de macOS e inicie sesion en iMessage usando el Apple ID del bot.
4. Habilite Inicio de sesion remoto (Configuracion del sistema → General → Compartir → Inicio de sesion remoto).
5. Instale `imsg`:
   - `brew install steipete/tap/imsg`
6. Configure SSH para que `ssh <bot-macos-user>@localhost true` funcione sin contraseña.
7. Apunte `channels.imessage.accounts.bot.cliPath` a un envoltorio SSH que ejecute `imsg` como el usuario del bot.

Nota del primer inicio: el envio/recepcion puede requerir aprobaciones de la GUI (Automatizacion + Acceso completo al disco) en el _usuario de macOS del bot_. Si `imsg rpc` parece quedarse atascado o salir, inicie sesion en ese usuario (Compartir pantalla ayuda), ejecute una sola vez `imsg chats --limit 1` / `imsg send ...`, apruebe los avisos y vuelva a intentarlo.

Ejemplo de envoltorio (`chmod +x`). Reemplace `<bot-macos-user>` con su nombre de usuario real de macOS:

```bash
#!/usr/bin/env bash
set -euo pipefail

# Run an interactive SSH once first to accept host keys:
#   ssh <bot-macos-user>@localhost true
exec /usr/bin/ssh -o BatchMode=yes -o ConnectTimeout=5 -T <bot-macos-user>@localhost \
  "/usr/local/bin/imsg" "$@"
```

Ejemplo de configuracion:

```json5
{
  channels: {
    imessage: {
      enabled: true,
      accounts: {
        bot: {
          name: "Bot",
          enabled: true,
          cliPath: "/path/to/imsg-bot",
          dbPath: "/Users/<bot-macos-user>/Library/Messages/chat.db",
        },
      },
    },
  },
}
```

Para configuraciones de una sola cuenta, use opciones planas (`channels.imessage.cliPath`, `channels.imessage.dbPath`) en lugar del mapa `accounts`.

### Variante remota/SSH (opcional)

Si desea iMessage en otro Mac, establezca `channels.imessage.cliPath` en un envoltorio que ejecute `imsg` en el host macOS remoto por SSH. OpenClaw solo necesita stdio.

Ejemplo de envoltorio:

```bash
#!/usr/bin/env bash
exec ssh -T gateway-host imsg "$@"
```

**Adjuntos remotos:** Cuando `cliPath` apunta a un host remoto via SSH, las rutas de adjuntos en la base de datos de Mensajes hacen referencia a archivos en la maquina remota. OpenClaw puede obtenerlos automaticamente por SCP configurando `channels.imessage.remoteHost`:

```json5
{
  channels: {
    imessage: {
      cliPath: "~/imsg-ssh", // SSH wrapper to remote Mac
      remoteHost: "user@gateway-host", // for SCP file transfer
      includeAttachments: true,
    },
  },
}
```

Si `remoteHost` no esta configurado, OpenClaw intenta detectarlo automaticamente analizando el comando SSH en su script envoltorio. Se recomienda la configuracion explicita para mayor fiabilidad.

#### Mac remoto via Tailscale (ejemplo)

Si el Gateway se ejecuta en un host/VM Linux pero iMessage debe ejecutarse en un Mac, Tailscale es el puente mas sencillo: el Gateway se comunica con el Mac a traves de la tailnet, ejecuta `imsg` por SSH y recupera adjuntos por SCP.

Arquitectura:

```
┌──────────────────────────────┐          SSH (imsg rpc)          ┌──────────────────────────┐
│ Gateway host (Linux/VM)      │──────────────────────────────────▶│ Mac with Messages + imsg │
│ - openclaw gateway           │          SCP (attachments)        │ - Messages signed in     │
│ - channels.imessage.cliPath  │◀──────────────────────────────────│ - Remote Login enabled   │
└──────────────────────────────┘                                   └──────────────────────────┘
              ▲
              │ Tailscale tailnet (hostname or 100.x.y.z)
              ▼
        user@gateway-host
```

Ejemplo concreto de configuracion (nombre de host de Tailscale):

```json5
{
  channels: {
    imessage: {
      enabled: true,
      cliPath: "~/.openclaw/scripts/imsg-ssh",
      remoteHost: "bot@mac-mini.tailnet-1234.ts.net",
      includeAttachments: true,
      dbPath: "/Users/bot/Library/Messages/chat.db",
    },
  },
}
```

Ejemplo de envoltorio (`~/.openclaw/scripts/imsg-ssh`):

```bash
#!/usr/bin/env bash
exec ssh -T bot@mac-mini.tailnet-1234.ts.net imsg "$@"
```

Notas:

- Asegurese de que el Mac tenga sesion iniciada en Mensajes y que el Inicio de sesion remoto este habilitado.
- Use claves SSH para que `ssh bot@mac-mini.tailnet-1234.ts.net` funcione sin avisos.
- `remoteHost` debe coincidir con el destino SSH para que SCP pueda obtener los adjuntos.

Soporte de multiples cuentas: use `channels.imessage.accounts` con configuracion por cuenta y `name` opcional. Vea [`gateway/configuration`](/gateway/configuration#telegramaccounts--discordaccounts--slackaccounts--signalaccounts--imessageaccounts) para el patron compartido. No confirme `~/.openclaw/openclaw.json` (a menudo contiene tokens).

## Control de acceso (Mensajes directos + grupos)

Mensajes directos:

- Predeterminado: `channels.imessage.dmPolicy = "pairing"`.
- Los remitentes desconocidos reciben un codigo de emparejamiento; los mensajes se ignoran hasta ser aprobados (los codigos expiran despues de 1 hora).
- Apruebe via:
  - `openclaw pairing list imessage`
  - `openclaw pairing approve imessage <CODE>`
- El emparejamiento es el intercambio de tokens predeterminado para Mensajes directos de iMessage. Detalles: [Emparejamiento](/start/pairing)

Grupos:

- `channels.imessage.groupPolicy = open | allowlist | disabled`.
- `channels.imessage.groupAllowFrom` controla quien puede activar en grupos cuando se establece `allowlist`.
- El control por menciones usa `agents.list[].groupChat.mentionPatterns` (o `messages.groupChat.mentionPatterns`) porque iMessage no tiene metadatos nativos de menciones.
- Anulacion multi-agente: establezca patrones por agente en `agents.list[].groupChat.mentionPatterns`.

## Como funciona (comportamiento)

- `imsg` transmite eventos de mensajes; el Gateway los normaliza en el sobre de canal compartido.
- Las respuestas siempre se enrutan de vuelta al mismo id de chat o identificador.

## Hilos tipo grupo (`is_group=false`)

Algunos hilos de iMessage pueden tener multiples participantes pero aun llegar con `is_group=false` dependiendo de como Mensajes almacena el identificador del chat.

Si configura explicitamente un `chat_id` bajo `channels.imessage.groups`, OpenClaw trata ese hilo como un “grupo” para:

- aislamiento de sesion (clave de sesion `agent:<agentId>:imessage:group:<chat_id>` separada)
- comportamiento de lista de permitidos de grupo / control por menciones

Ejemplo:

```json5
{
  channels: {
    imessage: {
      groupPolicy: "allowlist",
      groupAllowFrom: ["+15555550123"],
      groups: {
        "42": { requireMention: false },
      },
    },
  },
}
```

Esto es util cuando desea una personalidad/modelo aislado para un hilo especifico (vea [Enrutamiento multi-agente](/concepts/multi-agent)). Para aislamiento del sistema de archivos, vea [Sandboxing](/gateway/sandboxing).

## Medios + limites

- Ingestion opcional de adjuntos via `channels.imessage.includeAttachments`.
- Limite de medios via `channels.imessage.mediaMaxMb`.

## Limites

- El texto saliente se divide en fragmentos de `channels.imessage.textChunkLimit` (predeterminado 4000).
- Division opcional por nuevas lineas: establezca `channels.imessage.chunkMode="newline"` para dividir en lineas en blanco (limites de parrafo) antes de la division por longitud.
- Las cargas de medios estan limitadas por `channels.imessage.mediaMaxMb` (predeterminado 16).

## Direccionamiento / destinos de entrega

Prefiera `chat_id` para un enrutamiento estable:

- `chat_id:123` (preferido)
- `chat_guid:...`
- `chat_identifier:...`
- identificadores directos: `imessage:+1555` / `sms:+1555` / `user@example.com`

Listar chats:

```
imsg chats --limit 20
```

## Referencia de configuracion (iMessage)

Configuracion completa: [Configuracion](/gateway/configuration)

Opciones del proveedor:

- `channels.imessage.enabled`: habilitar/deshabilitar el inicio del canal.
- `channels.imessage.cliPath`: ruta a `imsg`.
- `channels.imessage.dbPath`: ruta de la BD de Mensajes.
- `channels.imessage.remoteHost`: host SSH para transferencia de adjuntos por SCP cuando `cliPath` apunta a un Mac remoto (p. ej., `user@gateway-host`). Se detecta automaticamente desde el envoltorio SSH si no se configura.
- `channels.imessage.service`: `imessage | sms | auto`.
- `channels.imessage.region`: region SMS.
- `channels.imessage.dmPolicy`: `pairing | allowlist | open | disabled` (predeterminado: emparejamiento).
- `channels.imessage.allowFrom`: lista de permitidos de Mensajes directos (identificadores, correos, numeros E.164 o `chat_id:*`). `open` requiere `"*"`. iMessage no tiene nombres de usuario; use identificadores o destinos de chat.
- `channels.imessage.groupPolicy`: `open | allowlist | disabled` (predeterminado: lista de permitidos).
- `channels.imessage.groupAllowFrom`: lista de permitidos de remitentes de grupo.
- `channels.imessage.historyLimit` / `channels.imessage.accounts.*.historyLimit`: maximo de mensajes de grupo a incluir como contexto (0 deshabilita).
- `channels.imessage.dmHistoryLimit`: limite del historial de Mensajes directos en turnos de usuario. Anulaciones por usuario: `channels.imessage.dms["<handle>"].historyLimit`.
- `channels.imessage.groups`: valores predeterminados por grupo + lista de permitidos (use `"*"` para valores globales).
- `channels.imessage.includeAttachments`: ingerir adjuntos en el contexto.
- `channels.imessage.mediaMaxMb`: limite de medios entrantes/salientes (MB).
- `channels.imessage.textChunkLimit`: tamano de fragmento saliente (caracteres).
- `channels.imessage.chunkMode`: `length` (predeterminado) o `newline` para dividir en lineas en blanco (limites de parrafo) antes de la division por longitud.

Opciones globales relacionadas:

- `agents.list[].groupChat.mentionPatterns` (o `messages.groupChat.mentionPatterns`).
- `messages.responsePrefix`.
