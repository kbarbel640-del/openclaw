---
summary: "Estado de soporte, capacidades y configuracion de Tlon/Urbit"
read_when:
  - Trabajando en funciones del canal Tlon/Urbit
title: "Tlon"
x-i18n:
  source_path: channels/tlon.md
  source_hash: 19d7ffe23e82239f
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:58:03Z
---

# Tlon (plugin)

Tlon es un mensajero descentralizado construido sobre Urbit. OpenClaw se conecta a su nave Urbit y puede
responder a Mensajes directos y mensajes de chat grupal. Las respuestas en grupos requieren una mención con @ de forma predeterminada y pueden
restringirse aun mas mediante allowlists.

Estado: compatible mediante plugin. Mensajes directos, menciones en grupos, respuestas en hilos y alternativa de medios solo texto
(URL agregada a la leyenda). No se admiten reacciones, encuestas ni cargas de medios nativos.

## Plugin requerido

Tlon se distribuye como un plugin y no viene incluido con la instalacion principal.

Instalar via CLI (registro npm):

```bash
openclaw plugins install @openclaw/tlon
```

Checkout local (cuando se ejecuta desde un repositorio git):

```bash
openclaw plugins install ./extensions/tlon
```

Detalles: [Plugins](/plugin)

## Configuracion

1. Instale el plugin de Tlon.
2. Reuna la URL de su nave y el codigo de inicio de sesion.
3. Configure `channels.tlon`.
4. Reinicie el Gateway.
5. Envie un Mensaje directo al bot o mencionelo en un canal de grupo.

Configuracion minima (una sola cuenta):

```json5
{
  channels: {
    tlon: {
      enabled: true,
      ship: "~sampel-palnet",
      url: "https://your-ship-host",
      code: "lidlut-tabwed-pillex-ridrup",
    },
  },
}
```

## Canales de grupo

El descubrimiento automatico esta habilitado de forma predeterminada. Tambien puede fijar canales manualmente:

```json5
{
  channels: {
    tlon: {
      groupChannels: ["chat/~host-ship/general", "chat/~host-ship/support"],
    },
  },
}
```

Deshabilitar el descubrimiento automatico:

```json5
{
  channels: {
    tlon: {
      autoDiscoverChannels: false,
    },
  },
}
```

## Control de acceso

Allowlist de Mensajes directos (vacia = permitir todos):

```json5
{
  channels: {
    tlon: {
      dmAllowlist: ["~zod", "~nec"],
    },
  },
}
```

Autorizacion de grupos (restringida de forma predeterminada):

```json5
{
  channels: {
    tlon: {
      defaultAuthorizedShips: ["~zod"],
      authorization: {
        channelRules: {
          "chat/~host-ship/general": {
            mode: "restricted",
            allowedShips: ["~zod", "~nec"],
          },
          "chat/~host-ship/announcements": {
            mode: "open",
          },
        },
      },
    },
  },
}
```

## Destinos de entrega (CLI/cron)

Use estos con `openclaw message send` o entrega por cron:

- Mensaje directo: `~sampel-palnet` o `dm/~sampel-palnet`
- Grupo: `chat/~host-ship/channel` o `group:~host-ship/channel`

## Notas

- Las respuestas en grupos requieren una mencion (p. ej., `~your-bot-ship`) para responder.
- Respuestas en hilos: si el mensaje entrante esta en un hilo, OpenClaw responde dentro del hilo.
- Medios: `sendMedia` usa alternativa de texto + URL (sin carga nativa).
