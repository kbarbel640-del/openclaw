---
summary: "Configuración del bot de Mattermost y configuracion de OpenClaw"
read_when:
  - Configuración de Mattermost
  - Depuración del enrutamiento de Mattermost
title: "Mattermost"
x-i18n:
  source_path: channels/mattermost.md
  source_hash: 57fabe5eb0efbcb8
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:57:59Z
---

# Mattermost (plugin)

Estado: compatible mediante plugin (token de bot + eventos WebSocket). Se admiten canales, grupos y Mensajes directos.
Mattermost es una plataforma de mensajería de equipo autoalojable; consulte el sitio oficial en
[mattermost.com](https://mattermost.com) para obtener detalles del producto y descargas.

## Plugin requerido

Mattermost se distribuye como un plugin y no está incluido con la instalación principal.

Instalar vía CLI (registro npm):

```bash
openclaw plugins install @openclaw/mattermost
```

Checkout local (cuando se ejecuta desde un repositorio git):

```bash
openclaw plugins install ./extensions/mattermost
```

Si elige Mattermost durante la configuración/incorporacion y se detecta un checkout de git,
OpenClaw ofrecerá automáticamente la ruta de instalación local.

Detalles: [Plugins](/plugin)

## Inicio rapido

1. Instale el plugin de Mattermost.
2. Cree una cuenta de bot de Mattermost y copie el **token del bot**.
3. Copie la **URL base** de Mattermost (p. ej., `https://chat.example.com`).
4. Configure OpenClaw e inicie el Gateway.

Configuración mínima:

```json5
{
  channels: {
    mattermost: {
      enabled: true,
      botToken: "mm-token",
      baseUrl: "https://chat.example.com",
      dmPolicy: "pairing",
    },
  },
}
```

## Variables de entorno (cuenta predeterminada)

Configure estas en el host del Gateway si prefiere variables de entorno:

- `MATTERMOST_BOT_TOKEN=...`
- `MATTERMOST_URL=https://chat.example.com`

Las variables de entorno se aplican solo a la cuenta **predeterminada** (`default`). Otras cuentas deben usar valores de configuración.

## Modos de chat

Mattermost responde automáticamente a Mensajes directos. El comportamiento en canales se controla con `chatmode`:

- `oncall` (predeterminado): responder solo cuando se menciona con @ en canales.
- `onmessage`: responder a cada mensaje del canal.
- `onchar`: responder cuando un mensaje comienza con un prefijo disparador.

Ejemplo de configuración:

```json5
{
  channels: {
    mattermost: {
      chatmode: "onchar",
      oncharPrefixes: [">", "!"],
    },
  },
}
```

Notas:

- `onchar` aún responde a menciones explícitas con @.
- `channels.mattermost.requireMention` se respeta para configuraciones heredadas, pero se prefiere `chatmode`.

## Control de acceso (Mensajes directos)

- Predeterminado: `channels.mattermost.dmPolicy = "pairing"` (los remitentes desconocidos reciben un código de emparejamiento).
- Aprobar mediante:
  - `openclaw pairing list mattermost`
  - `openclaw pairing approve mattermost <CODE>`
- Mensajes directos públicos: `channels.mattermost.dmPolicy="open"` más `channels.mattermost.allowFrom=["*"]`.

## Canales (grupos)

- Predeterminado: `channels.mattermost.groupPolicy = "allowlist"` (restringido por mención).
- Permitir remitentes con `channels.mattermost.groupAllowFrom` (IDs de usuario o `@username`).
- Canales abiertos: `channels.mattermost.groupPolicy="open"` (restringido por mención).

## Destinos para entrega saliente

Use estos formatos de destino con `openclaw message send` o cron/webhooks:

- `channel:<id>` para un canal
- `user:<id>` para un Mensaje directo
- `@username` para un Mensaje directo (resuelto mediante la API de Mattermost)

Los IDs sin prefijo se tratan como canales.

## Múltiples cuentas

Mattermost admite múltiples cuentas bajo `channels.mattermost.accounts`:

```json5
{
  channels: {
    mattermost: {
      accounts: {
        default: { name: "Primary", botToken: "mm-token", baseUrl: "https://chat.example.com" },
        alerts: { name: "Alerts", botToken: "mm-token-2", baseUrl: "https://alerts.example.com" },
      },
    },
  },
}
```

## Solucion de problemas

- Sin respuestas en canales: asegúrese de que el bot esté en el canal y menciónelo (oncall), use un prefijo disparador (onchar) o establezca `chatmode: "onmessage"`.
- Errores de autenticación: verifique el token del bot, la URL base y si la cuenta está habilitada.
- Problemas con múltiples cuentas: las variables de entorno solo se aplican a la cuenta `default`.
