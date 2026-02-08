---
summary: "Descripción general del bot de Feishu, características y configuración"
read_when:
  - Quiere conectar un bot de Feishu/Lark
  - Está configurando el canal de Feishu
title: Feishu
x-i18n:
  source_path: channels/feishu.md
  source_hash: fd2c93ebb6dbeabf
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:58:09Z
---

# Bot de Feishu

Feishu (Lark) es una plataforma de chat para equipos utilizada por empresas para mensajería y colaboración. Este plugin conecta OpenClaw a un bot de Feishu/Lark utilizando la suscripción de eventos WebSocket de la plataforma, de modo que los mensajes puedan recibirse sin exponer una URL pública de webhook.

---

## Plugin requerido

Instale el plugin de Feishu:

```bash
openclaw plugins install @openclaw/feishu
```

Checkout local (cuando se ejecuta desde un repositorio git):

```bash
openclaw plugins install ./extensions/feishu
```

---

## Inicio rapido

Hay dos formas de agregar el canal de Feishu:

### Metodo 1: asistente de incorporacion (recomendado)

Si acaba de instalar OpenClaw, ejecute el asistente:

```bash
openclaw onboard
```

El asistente lo guia a traves de:

1. Crear una app de Feishu y recopilar credenciales
2. Configurar las credenciales de la app en OpenClaw
3. Iniciar el gateway

✅ **Despues de la configuracion**, verifique el estado del gateway:

- `openclaw gateway status`
- `openclaw logs --follow`

### Metodo 2: configuracion por CLI

Si ya completo la instalacion inicial, agregue el canal mediante CLI:

```bash
openclaw channels add
```

Elija **Feishu**, luego ingrese el App ID y el App Secret.

✅ **Despues de la configuracion**, administre el gateway:

- `openclaw gateway status`
- `openclaw gateway restart`
- `openclaw logs --follow`

---

## Paso 1: Crear una app de Feishu

### 1. Abrir Feishu Open Platform

Visite [Feishu Open Platform](https://open.feishu.cn/app) e inicie sesion.

Los tenants de Lark (global) deben usar https://open.larksuite.com/app y establecer `domain: "lark"` en la configuracion de Feishu.

### 2. Crear una app

1. Haga clic en **Create enterprise app**
2. Complete el nombre y la descripcion de la app
3. Elija un icono para la app

![Create enterprise app](../images/feishu-step2-create-app.png)

### 3. Copiar credenciales

Desde **Credentials & Basic Info**, copie:

- **App ID** (formato: `cli_xxx`)
- **App Secret**

❗ **Importante:** mantenga el App Secret privado.

![Get credentials](../images/feishu-step3-credentials.png)

### 4. Configurar permisos

En **Permissions**, haga clic en **Batch import** y pegue:

```json
{
  "scopes": {
    "tenant": [
      "aily:file:read",
      "aily:file:write",
      "application:application.app_message_stats.overview:readonly",
      "application:application:self_manage",
      "application:bot.menu:write",
      "contact:user.employee_id:readonly",
      "corehr:file:download",
      "event:ip_list",
      "im:chat.access_event.bot_p2p_chat:read",
      "im:chat.members:bot_access",
      "im:message",
      "im:message.group_at_msg:readonly",
      "im:message.p2p_msg:readonly",
      "im:message:readonly",
      "im:message:send_as_bot",
      "im:resource"
    ],
    "user": ["aily:file:read", "aily:file:write", "im:chat.access_event.bot_p2p_chat:read"]
  }
}
```

![Configure permissions](../images/feishu-step4-permissions.png)

### 5. Habilitar la capacidad del bot

En **App Capability** > **Bot**:

1. Habilite la capacidad del bot
2. Establezca el nombre del bot

![Enable bot capability](../images/feishu-step5-bot-capability.png)

### 6. Configurar la suscripcion de eventos

⚠️ **Importante:** antes de configurar la suscripcion de eventos, asegurese de que:

1. Ya ejecuto `openclaw channels add` para Feishu
2. El gateway esta en ejecucion (`openclaw gateway status`)

En **Event Subscription**:

1. Elija **Use long connection to receive events** (WebSocket)
2. Agregue el evento: `im.message.receive_v1`

⚠️ Si el gateway no esta en ejecucion, es posible que la configuracion de conexion larga no se guarde correctamente.

![Configure event subscription](../images/feishu-step6-event-subscription.png)

### 7. Publicar la app

1. Cree una version en **Version Management & Release**
2. Envie para revision y publique
3. Espere la aprobacion del administrador (las apps empresariales suelen aprobarse automaticamente)

---

## Paso 2: Configurar OpenClaw

### Configurar con el asistente (recomendado)

```bash
openclaw channels add
```

Elija **Feishu** y pegue su App ID y App Secret.

### Configurar mediante archivo de configuracion

Edite `~/.openclaw/openclaw.json`:

```json5
{
  channels: {
    feishu: {
      enabled: true,
      dmPolicy: "pairing",
      accounts: {
        main: {
          appId: "cli_xxx",
          appSecret: "xxx",
          botName: "My AI assistant",
        },
      },
    },
  },
}
```

### Configurar mediante variables de entorno

```bash
export FEISHU_APP_ID="cli_xxx"
export FEISHU_APP_SECRET="xxx"
```

### Dominio de Lark (global)

Si su tenant esta en Lark (internacional), establezca el dominio en `lark` (o una cadena de dominio completa). Puede configurarlo en `channels.feishu.domain` o por cuenta (`channels.feishu.accounts.<id>.domain`).

```json5
{
  channels: {
    feishu: {
      domain: "lark",
      accounts: {
        main: {
          appId: "cli_xxx",
          appSecret: "xxx",
        },
      },
    },
  },
}
```

---

## Paso 3: Iniciar y probar

### 1. Iniciar el gateway

```bash
openclaw gateway
```

### 2. Enviar un mensaje de prueba

En Feishu, busque su bot y envie un mensaje.

### 3. Aprobar el emparejamiento

De forma predeterminada, el bot responde con un codigo de emparejamiento. Apruebelo:

```bash
openclaw pairing approve feishu <CODE>
```

Despues de la aprobacion, puede chatear normalmente.

---

## Descripcion general

- **Canal de bot de Feishu**: bot de Feishu administrado por el gateway
- **Enrutamiento determinista**: las respuestas siempre regresan a Feishu
- **Aislamiento de sesiones**: los Mensajes directos comparten una sesion principal; los grupos estan aislados
- **Conexion WebSocket**: conexion larga mediante el SDK de Feishu, no se necesita una URL publica

---

## Control de acceso

### Mensajes directos

- **Predeterminado**: `dmPolicy: "pairing"` (los usuarios desconocidos reciben un codigo de emparejamiento)
- **Aprobar emparejamiento**:
  ```bash
  openclaw pairing list feishu
  openclaw pairing approve feishu <CODE>
  ```
- **Modo de lista permitida**: establezca `channels.feishu.allowFrom` con los Open ID permitidos

### Chats grupales

**1. Politica de grupo** (`channels.feishu.groupPolicy`):

- `"open"` = permitir a todos en grupos (predeterminado)
- `"allowlist"` = permitir solo `groupAllowFrom`
- `"disabled"` = deshabilitar mensajes de grupo

**2. Requisito de mencion** (`channels.feishu.groups.<chat_id>.requireMention`):

- `true` = requerir @mencion (predeterminado)
- `false` = responder sin menciones

---

## Ejemplos de configuracion de grupos

### Permitir todos los grupos, requerir @mencion (predeterminado)

```json5
{
  channels: {
    feishu: {
      groupPolicy: "open",
      // Default requireMention: true
    },
  },
}
```

### Permitir todos los grupos, no se requiere @mencion

```json5
{
  channels: {
    feishu: {
      groups: {
        oc_xxx: { requireMention: false },
      },
    },
  },
}
```

### Permitir solo usuarios especificos en grupos

```json5
{
  channels: {
    feishu: {
      groupPolicy: "allowlist",
      groupAllowFrom: ["ou_xxx", "ou_yyy"],
    },
  },
}
```

---

## Obtener IDs de grupo/usuario

### IDs de grupo (chat_id)

Los IDs de grupo se ven como `oc_xxx`.

**Metodo 1 (recomendado)**

1. Inicie el gateway y @mencione al bot en el grupo
2. Ejecute `openclaw logs --follow` y busque `chat_id`

**Metodo 2**

Use el depurador de la API de Feishu para listar chats grupales.

### IDs de usuario (open_id)

Los IDs de usuario se ven como `ou_xxx`.

**Metodo 1 (recomendado)**

1. Inicie el gateway y envie un Mensaje directo al bot
2. Ejecute `openclaw logs --follow` y busque `open_id`

**Metodo 2**

Revise las solicitudes de emparejamiento para obtener los Open ID de usuario:

```bash
openclaw pairing list feishu
```

---

## Comandos comunes

| Comando   | Descripcion            |
| --------- | ---------------------- |
| `/status` | Mostrar estado del bot |
| `/reset`  | Restablecer la sesion  |
| `/model`  | Mostrar/cambiar modelo |

> Nota: Feishu aun no admite menus de comandos nativos, por lo que los comandos deben enviarse como texto.

## Comandos de administracion del gateway

| Comando                    | Descripcion                              |
| -------------------------- | ---------------------------------------- |
| `openclaw gateway status`  | Mostrar estado del gateway               |
| `openclaw gateway install` | Instalar/iniciar el servicio del gateway |
| `openclaw gateway stop`    | Detener el servicio del gateway          |
| `openclaw gateway restart` | Reiniciar el servicio del gateway        |
| `openclaw logs --follow`   | Ver logs del gateway                     |

---

## Solucion de problemas

### El bot no responde en chats grupales

1. Asegurese de que el bot este agregado al grupo
2. Asegurese de @mencionar al bot (comportamiento predeterminado)
3. Verifique que `groupPolicy` no este configurado como `"disabled"`
4. Revise los logs: `openclaw logs --follow`

### El bot no recibe mensajes

1. Asegurese de que la app este publicada y aprobada
2. Asegurese de que la suscripcion de eventos incluya `im.message.receive_v1`
3. Asegurese de que la **conexion larga** este habilitada
4. Asegurese de que los permisos de la app esten completos
5. Asegurese de que el gateway este en ejecucion: `openclaw gateway status`
6. Revise los logs: `openclaw logs --follow`

### Fuga del App Secret

1. Restablezca el App Secret en Feishu Open Platform
2. Actualice el App Secret en su configuracion
3. Reinicie el gateway

### Fallos al enviar mensajes

1. Asegurese de que la app tenga el permiso `im:message:send_as_bot`
2. Asegurese de que la app este publicada
3. Revise los logs para obtener errores detallados

---

## Configuracion avanzada

### Multiples cuentas

```json5
{
  channels: {
    feishu: {
      accounts: {
        main: {
          appId: "cli_xxx",
          appSecret: "xxx",
          botName: "Primary bot",
        },
        backup: {
          appId: "cli_yyy",
          appSecret: "yyy",
          botName: "Backup bot",
          enabled: false,
        },
      },
    },
  },
}
```

### Limites de mensajes

- `textChunkLimit`: tamano de fragmento de texto saliente (predeterminado: 2000 caracteres)
- `mediaMaxMb`: limite de carga/descarga de medios (predeterminado: 30MB)

### Streaming

Feishu admite respuestas en streaming mediante tarjetas interactivas. Cuando esta habilitado, el bot actualiza una tarjeta a medida que genera texto.

```json5
{
  channels: {
    feishu: {
      streaming: true, // enable streaming card output (default true)
      blockStreaming: true, // enable block-level streaming (default true)
    },
  },
}
```

Establezca `streaming: false` para esperar la respuesta completa antes de enviar.

### Enrutamiento multi-agente

Use `bindings` para enrutar Mensajes directos o grupos de Feishu a diferentes agentes.

```json5
{
  agents: {
    list: [
      { id: "main" },
      {
        id: "clawd-fan",
        workspace: "/home/user/clawd-fan",
        agentDir: "/home/user/.openclaw/agents/clawd-fan/agent",
      },
      {
        id: "clawd-xi",
        workspace: "/home/user/clawd-xi",
        agentDir: "/home/user/.openclaw/agents/clawd-xi/agent",
      },
    ],
  },
  bindings: [
    {
      agentId: "main",
      match: {
        channel: "feishu",
        peer: { kind: "dm", id: "ou_xxx" },
      },
    },
    {
      agentId: "clawd-fan",
      match: {
        channel: "feishu",
        peer: { kind: "dm", id: "ou_yyy" },
      },
    },
    {
      agentId: "clawd-xi",
      match: {
        channel: "feishu",
        peer: { kind: "group", id: "oc_zzz" },
      },
    },
  ],
}
```

Campos de enrutamiento:

- `match.channel`: `"feishu"`
- `match.peer.kind`: `"dm"` o `"group"`
- `match.peer.id`: Open ID de usuario (`ou_xxx`) o ID de grupo (`oc_xxx`)

Consulte [Obtener IDs de grupo/usuario](#get-groupuser-ids) para obtener consejos de busqueda.

---

## Referencia de configuracion

Configuracion completa: [Gateway configuration](/gateway/configuration)

Opciones clave:

| Configuracion                                     | Descripcion                                             | Predeterminado |
| ------------------------------------------------- | ------------------------------------------------------- | -------------- |
| `channels.feishu.enabled`                         | Habilitar/deshabilitar canal                            | `true`         |
| `channels.feishu.domain`                          | Dominio de API (`feishu` o `lark`)                      | `feishu`       |
| `channels.feishu.accounts.<id>.appId`             | App ID                                                  | -              |
| `channels.feishu.accounts.<id>.appSecret`         | App Secret                                              | -              |
| `channels.feishu.accounts.<id>.domain`            | Sobrescritura de dominio de API por cuenta              | `feishu`       |
| `channels.feishu.dmPolicy`                        | Politica de Mensajes directos                           | `pairing`      |
| `channels.feishu.allowFrom`                       | Lista permitida de Mensajes directos (lista de open_id) | -              |
| `channels.feishu.groupPolicy`                     | Politica de grupo                                       | `open`         |
| `channels.feishu.groupAllowFrom`                  | Lista permitida de grupo                                | -              |
| `channels.feishu.groups.<chat_id>.requireMention` | Requerir @mencion                                       | `true`         |
| `channels.feishu.groups.<chat_id>.enabled`        | Habilitar grupo                                         | `true`         |
| `channels.feishu.textChunkLimit`                  | Tamano de fragmento de mensaje                          | `2000`         |
| `channels.feishu.mediaMaxMb`                      | Limite de tamano de medios                              | `30`           |
| `channels.feishu.streaming`                       | Habilitar salida de tarjeta en streaming                | `true`         |
| `channels.feishu.blockStreaming`                  | Habilitar block streaming                               | `true`         |

---

## Referencia de dmPolicy

| Valor         | Comportamiento                                                                                    |
| ------------- | ------------------------------------------------------------------------------------------------- |
| `"pairing"`   | **Predeterminado.** Los usuarios desconocidos reciben un codigo de emparejamiento; debe aprobarse |
| `"allowlist"` | Solo los usuarios en `allowFrom` pueden chatear                                                   |
| `"open"`      | Permitir a todos los usuarios (requiere `"*"` en allowFrom)                                       |
| `"disabled"`  | Deshabilitar Mensajes directos                                                                    |

---

## Tipos de mensajes compatibles

### Recibir

- ✅ Texto
- ✅ Texto enriquecido (post)
- ✅ Imagenes
- ✅ Archivos
- ✅ Audio
- ✅ Video
- ✅ Stickers

### Enviar

- ✅ Texto
- ✅ Imagenes
- ✅ Archivos
- ✅ Audio
- ⚠️ Texto enriquecido (soporte parcial)
