---
summary: "Estado de soporte del bot de Zalo, capacidades y configuracion"
read_when:
  - Trabajando en funciones o webhooks de Zalo
title: "Zalo"
x-i18n:
  source_path: channels/zalo.md
  source_hash: 0311d932349f9641
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:58:14Z
---

# Zalo (Bot API)

Estado: experimental. Solo mensajes directos; los grupos llegaran pronto segun la documentacion de Zalo.

## Plugin requerido

Zalo se distribuye como un plugin y no viene incluido con la instalacion principal.

- Instale via CLI: `openclaw plugins install @openclaw/zalo`
- O seleccione **Zalo** durante la incorporacion y confirme el aviso de instalacion
- Detalles: [Plugins](/plugin)

## Configuracion rapida (principiantes)

1. Instale el plugin de Zalo:
   - Desde un checkout del codigo fuente: `openclaw plugins install ./extensions/zalo`
   - Desde npm (si esta publicado): `openclaw plugins install @openclaw/zalo`
   - O elija **Zalo** en la incorporacion y confirme el aviso de instalacion
2. Configure el token:
   - Variable de entorno: `ZALO_BOT_TOKEN=...`
   - O configuracion: `channels.zalo.botToken: "..."`.
3. Reinicie el Gateway (o finalice la incorporacion).
4. El acceso por Mensaje directo usa emparejamiento por defecto; apruebe el codigo de emparejamiento en el primer contacto.

Configuracion minima:

```json5
{
  channels: {
    zalo: {
      enabled: true,
      botToken: "12345689:abc-xyz",
      dmPolicy: "pairing",
    },
  },
}
```

## Que es

Zalo es una aplicacion de mensajeria enfocada en Vietnam; su Bot API permite que el Gateway ejecute un bot para conversaciones 1:1.
Es una buena opcion para soporte o notificaciones cuando desea un enrutamiento deterministico de regreso a Zalo.

- Un canal de Zalo Bot API propiedad del Gateway.
- Enrutamiento deterministico: las respuestas regresan a Zalo; el modelo nunca elige canales.
- Los Mensajes directos comparten la sesion principal del agente.
- Los grupos aun no estan soportados (la documentacion de Zalo indica "llegan pronto").

## Configuracion (ruta rapida)

### 1) Crear un token de bot (Zalo Bot Platform)

1. Vaya a **https://bot.zaloplatforms.com** e inicie sesion.
2. Cree un nuevo bot y configure sus ajustes.
3. Copie el token del bot (formato: `12345689:abc-xyz`).

### 2) Configurar el token (variable de entorno o configuracion)

Ejemplo:

```json5
{
  channels: {
    zalo: {
      enabled: true,
      botToken: "12345689:abc-xyz",
      dmPolicy: "pairing",
    },
  },
}
```

Opcion por variable de entorno: `ZALO_BOT_TOKEN=...` (funciona solo para la cuenta predeterminada).

Soporte multi-cuenta: use `channels.zalo.accounts` con tokens por cuenta y `name` opcional.

3. Reinicie el Gateway. Zalo se inicia cuando se resuelve un token (variable de entorno o configuracion).
4. El acceso por Mensaje directo usa emparejamiento por defecto. Apruebe el codigo cuando el bot sea contactado por primera vez.

## Como funciona (comportamiento)

- Los mensajes entrantes se normalizan en el sobre de canal compartido con marcadores de medios.
- Las respuestas siempre se enrutan de vuelta al mismo chat de Zalo.
- Long-polling por defecto; el modo webhook esta disponible con `channels.zalo.webhookUrl`.

## Limites

- El texto saliente se fragmenta en bloques de 2000 caracteres (limite de la API de Zalo).
- Las descargas/subidas de medios estan limitadas por `channels.zalo.mediaMaxMb` (valor predeterminado 5).
- El streaming esta bloqueado por defecto debido a que el limite de 2000 caracteres lo hace menos util.

## Control de acceso (Mensajes directos)

### Acceso por Mensaje directo

- Predeterminado: `channels.zalo.dmPolicy = "pairing"`. Los remitentes desconocidos reciben un codigo de emparejamiento; los mensajes se ignoran hasta que se aprueban (los codigos expiran despues de 1 hora).
- Aprobar via:
  - `openclaw pairing list zalo`
  - `openclaw pairing approve zalo <CODE>`
- El emparejamiento es el intercambio de token predeterminado. Detalles: [Pairing](/start/pairing)
- `channels.zalo.allowFrom` acepta IDs de usuario numericos (no hay busqueda por nombre de usuario).

## Long-polling vs webhook

- Predeterminado: long-polling (no se requiere URL publica).
- Modo webhook: configure `channels.zalo.webhookUrl` y `channels.zalo.webhookSecret`.
  - El secreto del webhook debe tener entre 8 y 256 caracteres.
  - La URL del webhook debe usar HTTPS.
  - Zalo envia eventos con el encabezado `X-Bot-Api-Secret-Token` para verificacion.
  - El HTTP del Gateway maneja las solicitudes del webhook en `channels.zalo.webhookPath` (por defecto es la ruta de la URL del webhook).

**Nota:** getUpdates (polling) y webhook son mutuamente excluyentes segun la documentacion de la API de Zalo.

## Tipos de mensajes compatibles

- **Mensajes de texto**: Soporte completo con fragmentacion de 2000 caracteres.
- **Mensajes de imagen**: Descarga y procesa imagenes entrantes; envia imagenes via `sendPhoto`.
- **Stickers**: Se registran pero no se procesan completamente (sin respuesta del agente).
- **Tipos no compatibles**: Se registran (por ejemplo, mensajes de usuarios protegidos).

## Capacidades

| Caracteristica    | Estado                        |
| ----------------- | ----------------------------- |
| Mensajes directos | ✅ Compatible                 |
| Grupos            | ❌ Llegan pronto (segun docs) |
| Medios (imagenes) | ✅ Compatible                 |
| Reacciones        | ❌ No compatible              |
| Hilos             | ❌ No compatible              |
| Encuestas         | ❌ No compatible              |
| Comandos nativos  | ❌ No compatible              |
| Streaming         | ⚠️ Bloqueado (limite 2000)    |

## Destinos de entrega (CLI/cron)

- Use un id de chat como destino.
- Ejemplo: `openclaw message send --channel zalo --target 123456789 --message "hi"`.

## Solucion de problemas

**El bot no responde:**

- Verifique que el token sea valido: `openclaw channels status --probe`
- Verifique que el remitente este aprobado (emparejamiento o allowFrom)
- Revise los registros del Gateway: `openclaw logs --follow`

**El webhook no recibe eventos:**

- Asegurese de que la URL del webhook use HTTPS
- Verifique que el token secreto tenga entre 8 y 256 caracteres
- Confirme que el endpoint HTTP del Gateway sea accesible en la ruta configurada
- Verifique que el polling getUpdates no este en ejecucion (son mutuamente excluyentes)

## Referencia de configuracion (Zalo)

Configuracion completa: [Configuration](/gateway/configuration)

Opciones del proveedor:

- `channels.zalo.enabled`: habilitar/deshabilitar el inicio del canal.
- `channels.zalo.botToken`: token del bot de Zalo Bot Platform.
- `channels.zalo.tokenFile`: leer el token desde una ruta de archivo.
- `channels.zalo.dmPolicy`: `pairing | allowlist | open | disabled` (predeterminado: emparejamiento).
- `channels.zalo.allowFrom`: lista de permitidos de Mensaje directo (IDs de usuario). `open` requiere `"*"`. El asistente solicitara IDs numericos.
- `channels.zalo.mediaMaxMb`: limite de medios entrantes/salientes (MB, predeterminado 5).
- `channels.zalo.webhookUrl`: habilitar modo webhook (se requiere HTTPS).
- `channels.zalo.webhookSecret`: secreto del webhook (8-256 caracteres).
- `channels.zalo.webhookPath`: ruta del webhook en el servidor HTTP del Gateway.
- `channels.zalo.proxy`: URL de proxy para solicitudes a la API.

Opciones multi-cuenta:

- `channels.zalo.accounts.<id>.botToken`: token por cuenta.
- `channels.zalo.accounts.<id>.tokenFile`: archivo de token por cuenta.
- `channels.zalo.accounts.<id>.name`: nombre para mostrar.
- `channels.zalo.accounts.<id>.enabled`: habilitar/deshabilitar cuenta.
- `channels.zalo.accounts.<id>.dmPolicy`: politica de Mensaje directo por cuenta.
- `channels.zalo.accounts.<id>.allowFrom`: lista de permitidos por cuenta.
- `channels.zalo.accounts.<id>.webhookUrl`: URL de webhook por cuenta.
- `channels.zalo.accounts.<id>.webhookSecret`: secreto de webhook por cuenta.
- `channels.zalo.accounts.<id>.webhookPath`: ruta de webhook por cuenta.
- `channels.zalo.accounts.<id>.proxy`: URL de proxy por cuenta.
