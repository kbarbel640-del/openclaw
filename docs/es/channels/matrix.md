---
summary: "Estado de soporte de Matrix, capacidades y configuracion"
read_when:
  - Trabajando en funciones del canal Matrix
title: "Matrix"
x-i18n:
  source_path: channels/matrix.md
  source_hash: 923ff717cf14d01c
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:58:11Z
---

# Matrix (plugin)

Matrix es un protocolo de mensajeria abierto y descentralizado. OpenClaw se conecta como un **usuario**
de Matrix en cualquier homeserver, por lo que necesita una cuenta de Matrix para el bot. Una vez que
inicia sesion, puede enviar Mensajes directos al bot o invitarlo a salas (los “grupos” de Matrix).
Beeper tambien es una opcion de cliente valida, pero requiere que E2EE este habilitado.

Estado: compatible mediante plugin (@vector-im/matrix-bot-sdk). Mensajes directos, salas, hilos, medios, reacciones,
encuestas (envio + inicio de encuesta como texto), ubicacion y E2EE (con soporte criptografico).

## Plugin requerido

Matrix se distribuye como un plugin y no esta incluido con la instalacion principal.

Instalar via CLI (registro npm):

```bash
openclaw plugins install @openclaw/matrix
```

Checkout local (cuando se ejecuta desde un repositorio git):

```bash
openclaw plugins install ./extensions/matrix
```

Si elige Matrix durante la configuracion/incorporacion y se detecta un checkout de git,
OpenClaw ofrecera automaticamente la ruta de instalacion local.

Detalles: [Plugins](/plugin)

## Configuracion

1. Instale el plugin de Matrix:
   - Desde npm: `openclaw plugins install @openclaw/matrix`
   - Desde un checkout local: `openclaw plugins install ./extensions/matrix`
2. Cree una cuenta de Matrix en un homeserver:
   - Explore opciones de hosting en [https://matrix.org/ecosystem/hosting/](https://matrix.org/ecosystem/hosting/)
   - O aloje uno usted mismo.
3. Obtenga un token de acceso para la cuenta del bot:
   - Use la API de inicio de sesion de Matrix con `curl` en su homeserver:

   ```bash
   curl --request POST \
     --url https://matrix.example.org/_matrix/client/v3/login \
     --header 'Content-Type: application/json' \
     --data '{
     "type": "m.login.password",
     "identifier": {
       "type": "m.id.user",
       "user": "your-user-name"
     },
     "password": "your-password"
   }'
   ```

   - Reemplace `matrix.example.org` con la URL de su homeserver.
   - O configure `channels.matrix.userId` + `channels.matrix.password`: OpenClaw llama al mismo
     endpoint de inicio de sesion, almacena el token de acceso en `~/.openclaw/credentials/matrix/credentials.json`,
     y lo reutiliza en el siguiente inicio.

4. Configure las credenciales:
   - Entorno: `MATRIX_HOMESERVER`, `MATRIX_ACCESS_TOKEN` (o `MATRIX_USER_ID` + `MATRIX_PASSWORD`)
   - O configuracion: `channels.matrix.*`
   - Si ambos estan configurados, la configuracion tiene prioridad.
   - Con token de acceso: el ID de usuario se obtiene automaticamente via `/whoami`.
   - Cuando se establece, `channels.matrix.userId` debe ser el ID completo de Matrix (ejemplo: `@bot:example.org`).
5. Reinicie el Gateway (o finalice la incorporacion).
6. Inicie un Mensaje directo con el bot o invitelo a una sala desde cualquier cliente de Matrix
   (Element, Beeper, etc.; vea https://matrix.org/ecosystem/clients/). Beeper requiere E2EE,
   por lo que configure `channels.matrix.encryption: true` y verifique el dispositivo.

Configuracion minima (token de acceso, ID de usuario obtenido automaticamente):

```json5
{
  channels: {
    matrix: {
      enabled: true,
      homeserver: "https://matrix.example.org",
      accessToken: "syt_***",
      dm: { policy: "pairing" },
    },
  },
}
```

Configuracion de E2EE (cifrado de extremo a extremo habilitado):

```json5
{
  channels: {
    matrix: {
      enabled: true,
      homeserver: "https://matrix.example.org",
      accessToken: "syt_***",
      encryption: true,
      dm: { policy: "pairing" },
    },
  },
}
```

## Cifrado (E2EE)

El cifrado de extremo a extremo esta **soportado** mediante el SDK criptografico en Rust.

Habilitelo con `channels.matrix.encryption: true`:

- Si el modulo criptografico se carga, las salas cifradas se descifran automaticamente.
- Los medios salientes se cifran al enviar a salas cifradas.
- En la primera conexion, OpenClaw solicita la verificacion del dispositivo desde sus otras sesiones.
- Verifique el dispositivo en otro cliente de Matrix (Element, etc.) para habilitar el intercambio de claves.
- Si el modulo criptografico no puede cargarse, E2EE se deshabilita y las salas cifradas no se descifraran;
  OpenClaw registra una advertencia.
- Si ve errores de modulo criptografico faltante (por ejemplo, `@matrix-org/matrix-sdk-crypto-nodejs-*`),
  permita los scripts de compilacion para `@matrix-org/matrix-sdk-crypto-nodejs` y ejecute
  `pnpm rebuild @matrix-org/matrix-sdk-crypto-nodejs` o obtenga el binario con
  `node node_modules/@matrix-org/matrix-sdk-crypto-nodejs/download-lib.js`.

El estado criptografico se almacena por cuenta + token de acceso en
`~/.openclaw/matrix/accounts/<account>/<homeserver>__<user>/<token-hash>/crypto/`
(base de datos SQLite). El estado de sincronizacion vive junto a el en `bot-storage.json`.
Si el token de acceso (dispositivo) cambia, se crea un nuevo almacenamiento y el bot debe
ser verificado nuevamente para salas cifradas.

**Verificacion de dispositivo:**
Cuando E2EE esta habilitado, el bot solicitara verificacion desde sus otras sesiones al iniciar.
Abra Element (u otro cliente) y apruebe la solicitud de verificacion para establecer confianza.
Una vez verificado, el bot puede descifrar mensajes en salas cifradas.

## Modelo de enrutamiento

- Las respuestas siempre regresan a Matrix.
- Los Mensajes directos comparten la sesion principal del agente; las salas se asignan a sesiones de grupo.

## Control de acceso (Mensajes directos)

- Predeterminado: `channels.matrix.dm.policy = "pairing"`. Los remitentes desconocidos reciben un codigo de emparejamiento.
- Aprobar mediante:
  - `openclaw pairing list matrix`
  - `openclaw pairing approve matrix <CODE>`
- Mensajes directos publicos: `channels.matrix.dm.policy="open"` mas `channels.matrix.dm.allowFrom=["*"]`.
- `channels.matrix.dm.allowFrom` acepta IDs completos de usuario de Matrix (ejemplo: `@user:server`). El asistente resuelve nombres visibles a IDs de usuario cuando la busqueda en el directorio encuentra una unica coincidencia exacta.

## Salas (grupos)

- Predeterminado: `channels.matrix.groupPolicy = "allowlist"` (activado por mencion). Use `channels.defaults.groupPolicy` para anular el valor predeterminado cuando no este configurado.
- Permita salas con `channels.matrix.groups` (IDs o alias de salas; los nombres se resuelven a IDs cuando la busqueda en el directorio encuentra una unica coincidencia exacta):

```json5
{
  channels: {
    matrix: {
      groupPolicy: "allowlist",
      groups: {
        "!roomId:example.org": { allow: true },
        "#alias:example.org": { allow: true },
      },
      groupAllowFrom: ["@owner:example.org"],
    },
  },
}
```

- `requireMention: false` habilita la respuesta automatica en esa sala.
- `groups."*"` puede establecer valores predeterminados para el control por mencion en todas las salas.
- `groupAllowFrom` restringe que remitentes pueden activar el bot en salas (IDs completos de usuario de Matrix).
- Las allowlists por sala `users` pueden restringir aun mas los remitentes dentro de una sala especifica (use IDs completos de usuario de Matrix).
- El asistente de configuracion solicita allowlists de salas (IDs de salas, alias o nombres) y resuelve nombres solo cuando hay una coincidencia exacta y unica.
- Al iniciar, OpenClaw resuelve nombres de salas/usuarios en las allowlists a IDs y registra el mapeo; las entradas no resueltas se ignoran para la coincidencia de allowlists.
- Las invitaciones se aceptan automaticamente de forma predeterminada; controle esto con `channels.matrix.autoJoin` y `channels.matrix.autoJoinAllowlist`.
- Para permitir **ninguna sala**, configure `channels.matrix.groupPolicy: "disabled"` (o mantenga una allowlist vacia).
- Clave heredada: `channels.matrix.rooms` (misma forma que `groups`).

## Hilos

- El encadenamiento de respuestas esta soportado.
- `channels.matrix.threadReplies` controla si las respuestas permanecen en hilos:
  - `off`, `inbound` (predeterminado), `always`
- `channels.matrix.replyToMode` controla los metadatos de respuesta cuando no se responde en un hilo:
  - `off` (predeterminado), `first`, `all`

## Capacidades

| Caracteristica    | Estado                                                                                                      |
| ----------------- | ----------------------------------------------------------------------------------------------------------- |
| Mensajes directos | ✅ Soportado                                                                                                |
| Salas             | ✅ Soportado                                                                                                |
| Hilos             | ✅ Soportado                                                                                                |
| Medios            | ✅ Soportado                                                                                                |
| E2EE              | ✅ Soportado (se requiere modulo criptografico)                                                             |
| Reacciones        | ✅ Soportado (enviar/leer mediante herramientas)                                                            |
| Encuestas         | ✅ Envio soportado; los inicios de encuestas entrantes se convierten a texto (respuestas/finales ignorados) |
| Ubicacion         | ✅ Soportado (URI geo; altitud ignorada)                                                                    |
| Comandos nativos  | ✅ Soportado                                                                                                |

## Referencia de configuracion (Matrix)

Configuracion completa: [Configuration](/gateway/configuration)

Opciones del proveedor:

- `channels.matrix.enabled`: habilitar/deshabilitar el inicio del canal.
- `channels.matrix.homeserver`: URL del homeserver.
- `channels.matrix.userId`: ID de usuario de Matrix (opcional con token de acceso).
- `channels.matrix.accessToken`: token de acceso.
- `channels.matrix.password`: contrasena para inicio de sesion (token almacenado).
- `channels.matrix.deviceName`: nombre para mostrar del dispositivo.
- `channels.matrix.encryption`: habilitar E2EE (predeterminado: false).
- `channels.matrix.initialSyncLimit`: limite de sincronizacion inicial.
- `channels.matrix.threadReplies`: `off | inbound | always` (predeterminado: entrante).
- `channels.matrix.textChunkLimit`: tamano de fragmento de texto saliente (caracteres).
- `channels.matrix.chunkMode`: `length` (predeterminado) o `newline` para dividir en lineas en blanco (limites de parrafo) antes de fragmentar por longitud.
- `channels.matrix.dm.policy`: `pairing | allowlist | open | disabled` (predeterminado: emparejamiento).
- `channels.matrix.dm.allowFrom`: allowlist de Mensajes directos (IDs completos de usuario de Matrix). `open` requiere `"*"`. El asistente resuelve nombres a IDs cuando es posible.
- `channels.matrix.groupPolicy`: `allowlist | open | disabled` (predeterminado: allowlist).
- `channels.matrix.groupAllowFrom`: remitentes permitidos para mensajes de grupo (IDs completos de usuario de Matrix).
- `channels.matrix.allowlistOnly`: forzar reglas de allowlist para Mensajes directos + salas.
- `channels.matrix.groups`: allowlist de grupos + mapa de configuraciones por sala.
- `channels.matrix.rooms`: allowlist/configuracion heredada de grupos.
- `channels.matrix.replyToMode`: modo de respuesta para hilos/etiquetas.
- `channels.matrix.mediaMaxMb`: limite de medios entrantes/salientes (MB).
- `channels.matrix.autoJoin`: manejo de invitaciones (`always | allowlist | off`, predeterminado: siempre).
- `channels.matrix.autoJoinAllowlist`: IDs/alias de salas permitidos para auto-union.
- `channels.matrix.actions`: control por herramienta por accion (reacciones/mensajes/pines/memberInfo/channelInfo).
