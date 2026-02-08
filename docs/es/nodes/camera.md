---
summary: "Captura de cámara (nodo iOS + app macOS) para uso del agente: fotos (jpg) y clips cortos de video (mp4)"
read_when:
  - Al agregar o modificar la captura de cámara en nodos iOS o macOS
  - Al extender flujos de trabajo de archivos temporales MEDIA accesibles por el agente
title: "Captura de cámara"
x-i18n:
  source_path: nodes/camera.md
  source_hash: b4d5f5ecbab6f705
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:59:22Z
---

# Captura de cámara (agente)

OpenClaw admite **captura de cámara** para flujos de trabajo del agente:

- **Nodo iOS** (emparejado vía Gateway): capture una **foto** (`jpg`) o un **clip corto de video** (`mp4`, con audio opcional) mediante `node.invoke`.
- **Nodo Android** (emparejado vía Gateway): capture una **foto** (`jpg`) o un **clip corto de video** (`mp4`, con audio opcional) mediante `node.invoke`.
- **App macOS** (nodo vía Gateway): capture una **foto** (`jpg`) o un **clip corto de video** (`mp4`, con audio opcional) mediante `node.invoke`.

Todo el acceso a la cámara está protegido por **configuraciones controladas por el usuario**.

## Nodo iOS

### Configuración del usuario (activada por defecto)

- Pestaña de Configuración de iOS → **Camera** → **Allow Camera** (`camera.enabled`)
  - Predeterminado: **activado** (una clave faltante se trata como habilitada).
  - Cuando está desactivado: los comandos `camera.*` devuelven `CAMERA_DISABLED`.

### Comandos (vía Gateway `node.invoke`)

- `camera.list`
  - Payload de respuesta:
    - `devices`: arreglo de `{ id, name, position, deviceType }`

- `camera.snap`
  - Parámetros:
    - `facing`: `front|back` (predeterminado: `front`)
    - `maxWidth`: number (opcional; predeterminado `1600` en el nodo iOS)
    - `quality`: `0..1` (opcional; predeterminado `0.9`)
    - `format`: actualmente `jpg`
    - `delayMs`: number (opcional; predeterminado `0`)
    - `deviceId`: string (opcional; desde `camera.list`)
  - Payload de respuesta:
    - `format: "jpg"`
    - `base64: "<...>"`
    - `width`, `height`
  - Protección del payload: las fotos se recomprimen para mantener el payload base64 por debajo de 5 MB.

- `camera.clip`
  - Parámetros:
    - `facing`: `front|back` (predeterminado: `front`)
    - `durationMs`: number (predeterminado `3000`, limitado a un máximo de `60000`)
    - `includeAudio`: boolean (predeterminado `true`)
    - `format`: actualmente `mp4`
    - `deviceId`: string (opcional; desde `camera.list`)
  - Payload de respuesta:
    - `format: "mp4"`
    - `base64: "<...>"`
    - `durationMs`
    - `hasAudio`

### Requisito de primer plano

Al igual que `canvas.*`, el nodo iOS solo permite comandos `camera.*` en **primer plano**. Las invocaciones en segundo plano devuelven `NODE_BACKGROUND_UNAVAILABLE`.

### Ayudante CLI (archivos temporales + MEDIA)

La forma más sencilla de obtener adjuntos es mediante el ayudante de la CLI, que escribe el medio decodificado en un archivo temporal e imprime `MEDIA:<path>`.

Ejemplos:

```bash
openclaw nodes camera snap --node <id>               # default: both front + back (2 MEDIA lines)
openclaw nodes camera snap --node <id> --facing front
openclaw nodes camera clip --node <id> --duration 3000
openclaw nodes camera clip --node <id> --no-audio
```

Notas:

- `nodes camera snap` se establece de forma predeterminada en **ambas** orientaciones para ofrecer al agente ambas vistas.
- Los archivos de salida son temporales (en el directorio temporal del SO) a menos que usted cree su propio wrapper.

## Nodo Android

### Configuración del usuario (activada por defecto)

- Hoja de Configuración de Android → **Camera** → **Allow Camera** (`camera.enabled`)
  - Predeterminado: **activado** (una clave faltante se trata como habilitada).
  - Cuando está desactivado: los comandos `camera.*` devuelven `CAMERA_DISABLED`.

### Permisos

- Android requiere permisos en tiempo de ejecución:
  - `CAMERA` tanto para `camera.snap` como para `camera.clip`.
  - `RECORD_AUDIO` para `camera.clip` cuando `includeAudio=true`.

Si faltan permisos, la app solicitará permiso cuando sea posible; si se deniega, las solicitudes `camera.*` fallan con un
error `*_PERMISSION_REQUIRED`.

### Requisito de primer plano

Al igual que `canvas.*`, el nodo Android solo permite comandos `camera.*` en **primer plano**. Las invocaciones en segundo plano devuelven `NODE_BACKGROUND_UNAVAILABLE`.

### Protección del payload

Las fotos se recomprimen para mantener el payload base64 por debajo de 5 MB.

## App macOS

### Configuración del usuario (desactivada por defecto)

La app complementaria de macOS expone una casilla:

- **Settings → General → Allow Camera** (`openclaw.cameraEnabled`)
  - Predeterminado: **desactivado**
  - Cuando está desactivado: las solicitudes de cámara devuelven “Camera disabled by user”.

### Ayudante CLI (invocación de nodo)

Use la CLI principal `openclaw` para invocar comandos de cámara en el nodo macOS.

Ejemplos:

```bash
openclaw nodes camera list --node <id>            # list camera ids
openclaw nodes camera snap --node <id>            # prints MEDIA:<path>
openclaw nodes camera snap --node <id> --max-width 1280
openclaw nodes camera snap --node <id> --delay-ms 2000
openclaw nodes camera snap --node <id> --device-id <id>
openclaw nodes camera clip --node <id> --duration 10s          # prints MEDIA:<path>
openclaw nodes camera clip --node <id> --duration-ms 3000      # prints MEDIA:<path> (legacy flag)
openclaw nodes camera clip --node <id> --device-id <id>
openclaw nodes camera clip --node <id> --no-audio
```

Notas:

- `openclaw nodes camera snap` se establece de forma predeterminada en `maxWidth=1600` a menos que se sobrescriba.
- En macOS, `camera.snap` espera `delayMs` (predeterminado 2000 ms) después del calentamiento/estabilización de la exposición antes de capturar.
- Los payloads de fotos se recomprimen para mantener base64 por debajo de 5 MB.

## Seguridad + límites prácticos

- El acceso a la cámara y al micrófono activa los avisos de permisos habituales del SO (y requiere cadenas de uso en Info.plist).
- Los clips de video están limitados (actualmente `<= 60s`) para evitar payloads de nodo demasiado grandes (sobrecarga base64 + límites de mensajes).

## Video de pantalla en macOS (nivel del SO)

Para video de _pantalla_ (no de cámara), use el complemento de macOS:

```bash
openclaw nodes screen record --node <id> --duration 10s --fps 15   # prints MEDIA:<path>
```

Notas:

- Requiere el permiso de macOS **Screen Recording** (TCC).
