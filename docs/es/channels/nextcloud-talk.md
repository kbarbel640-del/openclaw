---
summary: "Estado de soporte, capacidades y configuracion de Nextcloud Talk"
read_when:
  - Trabajando en funciones del canal Nextcloud Talk
title: "Nextcloud Talk"
x-i18n:
  source_path: channels/nextcloud-talk.md
  source_hash: 4062946ebf333903
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:58:04Z
---

# Nextcloud Talk (plugin)

Estado: compatible mediante plugin (bot de webhook). Se admiten mensajes directos, salas, reacciones y mensajes con markdown.

## Plugin requerido

Nextcloud Talk se distribuye como un plugin y no viene incluido con la instalacion principal.

Instalar via CLI (registro npm):

```bash
openclaw plugins install @openclaw/nextcloud-talk
```

Checkout local (cuando se ejecuta desde un repositorio git):

```bash
openclaw plugins install ./extensions/nextcloud-talk
```

Si elige Nextcloud Talk durante la configuracion/incorporacion y se detecta un checkout de git,
OpenClaw ofrecera automaticamente la ruta de instalacion local.

Detalles: [Plugins](/plugin)

## Configuracion rapida (principiante)

1. Instale el plugin de Nextcloud Talk.
2. En su servidor Nextcloud, cree un bot:
   ```bash
   ./occ talk:bot:install "OpenClaw" "<shared-secret>" "<webhook-url>" --feature reaction
   ```
3. Habilite el bot en la configuracion de la sala de destino.
4. Configure OpenClaw:
   - Config: `channels.nextcloud-talk.baseUrl` + `channels.nextcloud-talk.botSecret`
   - O env: `NEXTCLOUD_TALK_BOT_SECRET` (solo cuenta predeterminada)
5. Reinicie el Gateway (o finalice la incorporacion).

Configuracion minima:

```json5
{
  channels: {
    "nextcloud-talk": {
      enabled: true,
      baseUrl: "https://cloud.example.com",
      botSecret: "shared-secret",
      dmPolicy: "pairing",
    },
  },
}
```

## Notas

- Los bots no pueden iniciar Mensajes directos. El usuario debe escribirle al bot primero.
- La URL del webhook debe ser accesible por el Gateway; configure `webhookPublicUrl` si esta detras de un proxy.
- Las cargas de medios no son compatibles con la API del bot; los medios se envian como URL.
- El payload del webhook no distingue entre Mensajes directos y salas; configure `apiUser` + `apiPassword` para habilitar la deteccion del tipo de sala (de lo contrario, los Mensajes directos se tratan como salas).

## Control de acceso (Mensajes directos)

- Predeterminado: `channels.nextcloud-talk.dmPolicy = "pairing"`. Los remitentes desconocidos reciben un codigo de emparejamiento.
- Aprobar via:
  - `openclaw pairing list nextcloud-talk`
  - `openclaw pairing approve nextcloud-talk <CODE>`
- Mensajes directos publicos: `channels.nextcloud-talk.dmPolicy="open"` mas `channels.nextcloud-talk.allowFrom=["*"]`.
- `allowFrom` coincide solo con IDs de usuario de Nextcloud; los nombres para mostrar se ignoran.

## Salas (grupos)

- Predeterminado: `channels.nextcloud-talk.groupPolicy = "allowlist"` (restringido por mencion).
- Permitir salas en lista blanca con `channels.nextcloud-talk.rooms`:

```json5
{
  channels: {
    "nextcloud-talk": {
      rooms: {
        "room-token": { requireMention: true },
      },
    },
  },
}
```

- Para no permitir salas, mantenga la lista blanca vacia o establezca `channels.nextcloud-talk.groupPolicy="disabled"`.

## Capacidades

| Funcionalidad     | Estado        |
| ----------------- | ------------- |
| Mensajes directos | Compatible    |
| Salas             | Compatible    |
| Hilos             | No compatible |
| Medios            | Solo URL      |
| Reacciones        | Compatible    |
| Comandos nativos  | No compatible |

## Referencia de configuracion (Nextcloud Talk)

Configuracion completa: [Configuracion](/gateway/configuration)

Opciones del proveedor:

- `channels.nextcloud-talk.enabled`: habilitar/deshabilitar el inicio del canal.
- `channels.nextcloud-talk.baseUrl`: URL de la instancia de Nextcloud.
- `channels.nextcloud-talk.botSecret`: secreto compartido del bot.
- `channels.nextcloud-talk.botSecretFile`: ruta del archivo de secreto.
- `channels.nextcloud-talk.apiUser`: usuario de la API para busquedas de salas (deteccion de Mensajes directos).
- `channels.nextcloud-talk.apiPassword`: contraseña de la API/app para busquedas de salas.
- `channels.nextcloud-talk.apiPasswordFile`: ruta del archivo de contraseña de la API.
- `channels.nextcloud-talk.webhookPort`: puerto del listener del webhook (predeterminado: 8788).
- `channels.nextcloud-talk.webhookHost`: host del webhook (predeterminado: 0.0.0.0).
- `channels.nextcloud-talk.webhookPath`: ruta del webhook (predeterminado: /nextcloud-talk-webhook).
- `channels.nextcloud-talk.webhookPublicUrl`: URL del webhook accesible externamente.
- `channels.nextcloud-talk.dmPolicy`: `pairing | allowlist | open | disabled`.
- `channels.nextcloud-talk.allowFrom`: lista blanca de Mensajes directos (IDs de usuario). `open` requiere `"*"`.
- `channels.nextcloud-talk.groupPolicy`: `allowlist | open | disabled`.
- `channels.nextcloud-talk.groupAllowFrom`: lista blanca de grupos (IDs de usuario).
- `channels.nextcloud-talk.rooms`: configuraciones por sala y lista blanca.
- `channels.nextcloud-talk.historyLimit`: limite de historial de grupos (0 deshabilita).
- `channels.nextcloud-talk.dmHistoryLimit`: limite de historial de Mensajes directos (0 deshabilita).
- `channels.nextcloud-talk.dms`: anulaciones por Mensaje directo (historyLimit).
- `channels.nextcloud-talk.textChunkLimit`: tamano de fragmento de texto saliente (caracteres).
- `channels.nextcloud-talk.chunkMode`: `length` (predeterminado) o `newline` para dividir en lineas en blanco (limites de parrafo) antes de fragmentar por longitud.
- `channels.nextcloud-talk.blockStreaming`: deshabilitar el streaming por bloques para este canal.
- `channels.nextcloud-talk.blockStreamingCoalesce`: ajuste de coalescencia del streaming por bloques.
- `channels.nextcloud-talk.mediaMaxMb`: limite de medios entrantes (MB).
