---
summary: "Configuración y configuración inicial del bot de chat de Twitch"
read_when:
  - Configuración de la integración de chat de Twitch para OpenClaw
title: "Twitch"
x-i18n:
  source_path: channels/twitch.md
  source_hash: 0dd1c05bef570470
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:58:14Z
---

# Twitch (plugin)

Soporte de chat de Twitch mediante conexión IRC. OpenClaw se conecta como un usuario de Twitch (cuenta de bot) para recibir y enviar mensajes en canales.

## Plugin requerido

Twitch se distribuye como un plugin y no viene incluido con la instalación principal.

Instale vía CLI (registro npm):

```bash
openclaw plugins install @openclaw/twitch
```

Clonado local (cuando se ejecuta desde un repositorio git):

```bash
openclaw plugins install ./extensions/twitch
```

Detalles: [Plugins](/plugin)

## Inicio rapido (principiante)

1. Cree una cuenta dedicada de Twitch para el bot (o use una cuenta existente).
2. Genere credenciales: [Twitch Token Generator](https://twitchtokengenerator.com/)
   - Seleccione **Bot Token**
   - Verifique que los alcances `chat:read` y `chat:write` estén seleccionados
   - Copie el **Client ID** y el **Access Token**
3. Encuentre su ID de usuario de Twitch: https://www.streamweasels.com/tools/convert-twitch-username-to-user-id/
4. Configure el token:
   - Env: `OPENCLAW_TWITCH_ACCESS_TOKEN=...` (solo cuenta predeterminada)
   - O config: `channels.twitch.accessToken`
   - Si ambos están configurados, la config tiene prioridad (el env es respaldo solo para la cuenta predeterminada).
5. Inicie el Gateway.

**⚠️ Importante:** Agregue control de acceso (`allowFrom` o `allowedRoles`) para evitar que usuarios no autorizados activen el bot. `requireMention` tiene como valor predeterminado `true`.

Configuración mínima:

```json5
{
  channels: {
    twitch: {
      enabled: true,
      username: "openclaw", // Bot's Twitch account
      accessToken: "oauth:abc123...", // OAuth Access Token (or use OPENCLAW_TWITCH_ACCESS_TOKEN env var)
      clientId: "xyz789...", // Client ID from Token Generator
      channel: "vevisk", // Which Twitch channel's chat to join (required)
      allowFrom: ["123456789"], // (recommended) Your Twitch user ID only - get it from https://www.streamweasels.com/tools/convert-twitch-username-to-user-id/
    },
  },
}
```

## Qué es

- Un canal de Twitch propiedad del Gateway.
- Enrutamiento determinista: las respuestas siempre regresan a Twitch.
- Cada cuenta se asigna a una clave de sesion aislada `agent:<agentId>:twitch:<accountName>`.
- `username` es la cuenta del bot (quien se autentica), `channel` es la sala de chat a la que se une.

## Configuración (detallada)

### Generar credenciales

Use [Twitch Token Generator](https://twitchtokengenerator.com/):

- Seleccione **Bot Token**
- Verifique que los alcances `chat:read` y `chat:write` estén seleccionados
- Copie el **Client ID** y el **Access Token**

No se requiere registro manual de aplicaciones. Los tokens expiran después de varias horas.

### Configurar el bot

**Variable de entorno (solo cuenta predeterminada):**

```bash
OPENCLAW_TWITCH_ACCESS_TOKEN=oauth:abc123...
```

**O configuración:**

```json5
{
  channels: {
    twitch: {
      enabled: true,
      username: "openclaw",
      accessToken: "oauth:abc123...",
      clientId: "xyz789...",
      channel: "vevisk",
    },
  },
}
```

Si se configuran tanto env como config, la config tiene prioridad.

### Control de acceso (recomendado)

```json5
{
  channels: {
    twitch: {
      allowFrom: ["123456789"], // (recommended) Your Twitch user ID only
    },
  },
}
```

Prefiera `allowFrom` para una allowlist estricta. Use `allowedRoles` en su lugar si desea acceso basado en roles.

**Roles disponibles:** `"moderator"`, `"owner"`, `"vip"`, `"subscriber"`, `"all"`.

**¿Por qué IDs de usuario?** Los nombres de usuario pueden cambiar, permitiendo suplantación. Los IDs de usuario son permanentes.

Encuentre su ID de usuario de Twitch: https://www.streamweasels.com/tools/convert-twitch-username-%20to-user-id/ (Convierta su nombre de usuario de Twitch a ID)

## Renovación de token (opcional)

Los tokens de [Twitch Token Generator](https://twitchtokengenerator.com/) no se pueden renovar automáticamente; regenérelos cuando expiren.

Para renovación automática de tokens, cree su propia aplicación de Twitch en [Twitch Developer Console](https://dev.twitch.tv/console) y agréguela a la configuración:

```json5
{
  channels: {
    twitch: {
      clientSecret: "your_client_secret",
      refreshToken: "your_refresh_token",
    },
  },
}
```

El bot renueva automáticamente los tokens antes de que expiren y registra eventos de renovación.

## Soporte multi-cuenta

Use `channels.twitch.accounts` con tokens por cuenta. Consulte [`gateway/configuration`](/gateway/configuration) para el patrón compartido.

Ejemplo (una cuenta de bot en dos canales):

```json5
{
  channels: {
    twitch: {
      accounts: {
        channel1: {
          username: "openclaw",
          accessToken: "oauth:abc123...",
          clientId: "xyz789...",
          channel: "vevisk",
        },
        channel2: {
          username: "openclaw",
          accessToken: "oauth:def456...",
          clientId: "uvw012...",
          channel: "secondchannel",
        },
      },
    },
  },
}
```

**Nota:** Cada cuenta necesita su propio token (un token por canal).

## Control de acceso

### Restricciones basadas en roles

```json5
{
  channels: {
    twitch: {
      accounts: {
        default: {
          allowedRoles: ["moderator", "vip"],
        },
      },
    },
  },
}
```

### Allowlist por ID de usuario (más seguro)

```json5
{
  channels: {
    twitch: {
      accounts: {
        default: {
          allowFrom: ["123456789", "987654321"],
        },
      },
    },
  },
}
```

### Acceso basado en roles (alternativa)

`allowFrom` es una allowlist estricta. Cuando está configurada, solo se permiten esos IDs de usuario.
Si desea acceso basado en roles, deje `allowFrom` sin configurar y configure `allowedRoles` en su lugar:

```json5
{
  channels: {
    twitch: {
      accounts: {
        default: {
          allowedRoles: ["moderator"],
        },
      },
    },
  },
}
```

### Deshabilitar el requisito de @mention

De forma predeterminada, `requireMention` es `true`. Para deshabilitarlo y responder a todos los mensajes:

```json5
{
  channels: {
    twitch: {
      accounts: {
        default: {
          requireMention: false,
        },
      },
    },
  },
}
```

## Solucion de problemas

Primero, ejecute comandos de diagnóstico:

```bash
openclaw doctor
openclaw channels status --probe
```

### El bot no responde a los mensajes

**Verifique el control de acceso:** Asegúrese de que su ID de usuario esté en `allowFrom`, o elimine temporalmente
`allowFrom` y configure `allowedRoles: ["all"]` para probar.

**Verifique que el bot esté en el canal:** El bot debe unirse al canal especificado en `channel`.

### Problemas de token

**"Failed to connect" o errores de autenticación:**

- Verifique que `accessToken` sea el valor del token de acceso OAuth (normalmente comienza con el prefijo `oauth:`)
- Verifique que el token tenga los alcances `chat:read` y `chat:write`
- Si usa renovación de tokens, verifique que `clientSecret` y `refreshToken` estén configurados

### La renovación de tokens no funciona

**Revise los logs para eventos de renovación:**

```
Using env token source for mybot
Access token refreshed for user 123456 (expires in 14400s)
```

Si ve "token refresh disabled (no refresh token)":

- Asegúrese de que `clientSecret` esté proporcionado
- Asegúrese de que `refreshToken` esté proporcionado

## Configuración

**Configuración de cuenta:**

- `username` - Nombre de usuario del bot
- `accessToken` - Token de acceso OAuth con `chat:read` y `chat:write`
- `clientId` - Client ID de Twitch (del Token Generator o de su aplicación)
- `channel` - Canal al que unirse (requerido)
- `enabled` - Habilitar esta cuenta (predeterminado: `true`)
- `clientSecret` - Opcional: Para renovación automática de tokens
- `refreshToken` - Opcional: Para renovación automática de tokens
- `expiresIn` - Vencimiento del token en segundos
- `obtainmentTimestamp` - Marca de tiempo de obtención del token
- `allowFrom` - Allowlist de IDs de usuario
- `allowedRoles` - Control de acceso basado en roles (`"moderator" | "owner" | "vip" | "subscriber" | "all"`)
- `requireMention` - Requerir @mention (predeterminado: `true`)

**Opciones del proveedor:**

- `channels.twitch.enabled` - Habilitar/deshabilitar el inicio del canal
- `channels.twitch.username` - Nombre de usuario del bot (configuración simplificada de una sola cuenta)
- `channels.twitch.accessToken` - Token de acceso OAuth (configuración simplificada de una sola cuenta)
- `channels.twitch.clientId` - Client ID de Twitch (configuración simplificada de una sola cuenta)
- `channels.twitch.channel` - Canal al que unirse (configuración simplificada de una sola cuenta)
- `channels.twitch.accounts.<accountName>` - Configuración multi-cuenta (todos los campos de cuenta anteriores)

Ejemplo completo:

```json5
{
  channels: {
    twitch: {
      enabled: true,
      username: "openclaw",
      accessToken: "oauth:abc123...",
      clientId: "xyz789...",
      channel: "vevisk",
      clientSecret: "secret123...",
      refreshToken: "refresh456...",
      allowFrom: ["123456789"],
      allowedRoles: ["moderator", "vip"],
      accounts: {
        default: {
          username: "mybot",
          accessToken: "oauth:abc123...",
          clientId: "xyz789...",
          channel: "your_channel",
          enabled: true,
          clientSecret: "secret123...",
          refreshToken: "refresh456...",
          expiresIn: 14400,
          obtainmentTimestamp: 1706092800000,
          allowFrom: ["123456789", "987654321"],
          allowedRoles: ["moderator"],
        },
      },
    },
  },
}
```

## Acciones de herramienta

El agente puede llamar a `twitch` con la acción:

- `send` - Enviar un mensaje a un canal

Ejemplo:

```json5
{
  action: "twitch",
  params: {
    message: "Hello Twitch!",
    to: "#mychannel",
  },
}
```

## Seguridad y operaciones

- **Trate los tokens como contraseñas** - Nunca confirme tokens en git
- **Use renovación automática de tokens** para bots de larga duración
- **Use allowlists de IDs de usuario** en lugar de nombres de usuario para el control de acceso
- **Monitoree los logs** para eventos de renovación de tokens y estado de conexión
- **Limite los alcances de los tokens** - Solicite solo `chat:read` y `chat:write`
- **Si se queda atascado**: Reinicie el Gateway después de confirmar que ningún otro proceso posee la sesion

## Límites

- **500 caracteres** por mensaje (dividido automáticamente por límites de palabras)
- El Markdown se elimina antes de la división
- Sin limitación de tasa (usa los límites integrados de Twitch)
