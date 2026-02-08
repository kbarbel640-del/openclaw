---
summary: "Texto a voz (TTS) para respuestas salientes"
read_when:
  - Habilitar texto a voz para respuestas
  - Configurar proveedores o limites de TTS
  - Usar comandos /tts
title: "Texto a Voz"
x-i18n:
  source_path: tts.md
  source_hash: 070ff0cc8592f64c
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:00:36Z
---

# Texto a voz (TTS)

OpenClaw puede convertir respuestas salientes en audio usando ElevenLabs, OpenAI o Edge TTS.
Funciona en cualquier lugar donde OpenClaw pueda enviar audio; Telegram obtiene una burbuja redonda de nota de voz.

## Servicios compatibles

- **ElevenLabs** (proveedor primario o de respaldo)
- **OpenAI** (proveedor primario o de respaldo; tambien usado para resúmenes)
- **Edge TTS** (proveedor primario o de respaldo; usa `node-edge-tts`, predeterminado cuando no hay claves de API)

### Notas sobre Edge TTS

Edge TTS usa el servicio de TTS neuronal en linea de Microsoft Edge a traves de la biblioteca
`node-edge-tts`. Es un servicio alojado (no local), usa endpoints de Microsoft y no
requiere una clave de API. `node-edge-tts` expone opciones de configuracion de voz y
formatos de salida, pero no todas las opciones son compatibles con el servicio Edge. citeturn2search0

Debido a que Edge TTS es un servicio web publico sin un SLA o cuota publicados, trátelo
como de mejor esfuerzo. Si necesita limites garantizados y soporte, use OpenAI o ElevenLabs.
La API REST de Speech de Microsoft documenta un limite de audio de 10 minutos por solicitud;
Edge TTS no publica limites, asi que asuma limites similares o inferiores. citeturn0search3

## Claves opcionales

Si desea OpenAI o ElevenLabs:

- `ELEVENLABS_API_KEY` (o `XI_API_KEY`)
- `OPENAI_API_KEY`

Edge TTS **no** requiere una clave de API. Si no se encuentran claves de API, OpenClaw usa
Edge TTS de forma predeterminada (a menos que se deshabilite mediante `messages.tts.edge.enabled=false`).

Si se configuran varios proveedores, el proveedor seleccionado se usa primero y los demas son opciones de respaldo.
El auto‑resumen usa el `summaryModel` (o `agents.defaults.model.primary`) configurado,
por lo que ese proveedor tambien debe estar autenticado si habilita los resúmenes.

## Enlaces de servicios

- [Guia de Texto a Voz de OpenAI](https://platform.openai.com/docs/guides/text-to-speech)
- [Referencia de la API de Audio de OpenAI](https://platform.openai.com/docs/api-reference/audio)
- [Texto a Voz de ElevenLabs](https://elevenlabs.io/docs/api-reference/text-to-speech)
- [Autenticacion de ElevenLabs](https://elevenlabs.io/docs/api-reference/authentication)
- [node-edge-tts](https://github.com/SchneeHertz/node-edge-tts)
- [Formatos de salida de Microsoft Speech](https://learn.microsoft.com/azure/ai-services/speech-service/rest-text-to-speech#audio-outputs)

## ¿Esta habilitado de forma predeterminada?

No. El auto‑TTS esta **desactivado** de forma predeterminada. Habilitelo en la configuracion con
`messages.tts.auto` o por sesion con `/tts always` (alias: `/tts on`).

Edge TTS **si** esta habilitado de forma predeterminada una vez que TTS esta activo, y se usa automaticamente
cuando no hay claves de API de OpenAI o ElevenLabs disponibles.

## Configuracion

La configuracion de TTS vive bajo `messages.tts` en `openclaw.json`.
El esquema completo esta en [Configuracion del Gateway](/gateway/configuration).

### Configuracion minima (habilitar + proveedor)

```json5
{
  messages: {
    tts: {
      auto: "always",
      provider: "elevenlabs",
    },
  },
}
```

### OpenAI como primario con ElevenLabs como respaldo

```json5
{
  messages: {
    tts: {
      auto: "always",
      provider: "openai",
      summaryModel: "openai/gpt-4.1-mini",
      modelOverrides: {
        enabled: true,
      },
      openai: {
        apiKey: "openai_api_key",
        model: "gpt-4o-mini-tts",
        voice: "alloy",
      },
      elevenlabs: {
        apiKey: "elevenlabs_api_key",
        baseUrl: "https://api.elevenlabs.io",
        voiceId: "voice_id",
        modelId: "eleven_multilingual_v2",
        seed: 42,
        applyTextNormalization: "auto",
        languageCode: "en",
        voiceSettings: {
          stability: 0.5,
          similarityBoost: 0.75,
          style: 0.0,
          useSpeakerBoost: true,
          speed: 1.0,
        },
      },
    },
  },
}
```

### Edge TTS como primario (sin clave de API)

```json5
{
  messages: {
    tts: {
      auto: "always",
      provider: "edge",
      edge: {
        enabled: true,
        voice: "en-US-MichelleNeural",
        lang: "en-US",
        outputFormat: "audio-24khz-48kbitrate-mono-mp3",
        rate: "+10%",
        pitch: "-5%",
      },
    },
  },
}
```

### Deshabilitar Edge TTS

```json5
{
  messages: {
    tts: {
      edge: {
        enabled: false,
      },
    },
  },
}
```

### Limites personalizados + ruta de preferencias

```json5
{
  messages: {
    tts: {
      auto: "always",
      maxTextLength: 4000,
      timeoutMs: 30000,
      prefsPath: "~/.openclaw/settings/tts.json",
    },
  },
}
```

### Solo responder con audio despues de una nota de voz entrante

```json5
{
  messages: {
    tts: {
      auto: "inbound",
    },
  },
}
```

### Deshabilitar auto‑resumen para respuestas largas

```json5
{
  messages: {
    tts: {
      auto: "always",
    },
  },
}
```

Luego ejecute:

```
/tts summary off
```

### Notas sobre los campos

- `auto`: modo de auto‑TTS (`off`, `always`, `inbound`, `tagged`).
  - `inbound` solo envia audio despues de una nota de voz entrante.
  - `tagged` solo envia audio cuando la respuesta incluye etiquetas `[[tts]]`.
- `enabled`: interruptor heredado (doctor lo migra a `auto`).
- `mode`: `"final"` (predeterminado) o `"all"` (incluye respuestas de herramientas/bloques).
- `provider`: `"elevenlabs"`, `"openai"` o `"edge"` (el respaldo es automatico).
- Si `provider` esta **sin configurar**, OpenClaw prefiere `openai` (si hay clave), luego `elevenlabs` (si hay clave),
  de lo contrario `edge`.
- `summaryModel`: modelo economico opcional para auto‑resumen; por defecto `agents.defaults.model.primary`.
  - Acepta `provider/model` o un alias de modelo configurado.
- `modelOverrides`: permitir que el modelo emita directivas de TTS (activado por defecto).
- `maxTextLength`: limite estricto para la entrada de TTS (caracteres). `/tts audio` falla si se excede.
- `timeoutMs`: tiempo de espera de solicitud (ms).
- `prefsPath`: sobrescribir la ruta del JSON de preferencias locales (proveedor/limite/resumen).
- Los valores de `apiKey` recurren a variables de entorno (`ELEVENLABS_API_KEY`/`XI_API_KEY`, `OPENAI_API_KEY`).
- `elevenlabs.baseUrl`: sobrescribir la URL base de la API de ElevenLabs.
- `elevenlabs.voiceSettings`:
  - `stability`, `similarityBoost`, `style`: `0..1`
  - `useSpeakerBoost`: `true|false`
  - `speed`: `0.5..2.0` (1.0 = normal)
- `elevenlabs.applyTextNormalization`: `auto|on|off`
- `elevenlabs.languageCode`: ISO 639-1 de 2 letras (p. ej., `en`, `de`)
- `elevenlabs.seed`: entero `0..4294967295` (determinismo de mejor esfuerzo)
- `edge.enabled`: permitir el uso de Edge TTS (predeterminado `true`; sin clave de API).
- `edge.voice`: nombre de voz neuronal de Edge (p. ej., `en-US-MichelleNeural`).
- `edge.lang`: codigo de idioma (p. ej., `en-US`).
- `edge.outputFormat`: formato de salida de Edge (p. ej., `audio-24khz-48kbitrate-mono-mp3`).
  - Consulte los formatos de salida de Microsoft Speech para valores validos; no todos los formatos son compatibles con Edge.
- `edge.rate` / `edge.pitch` / `edge.volume`: cadenas de porcentaje (p. ej., `+10%`, `-5%`).
- `edge.saveSubtitles`: escribir subtitulos JSON junto al archivo de audio.
- `edge.proxy`: URL de proxy para solicitudes de Edge TTS.
- `edge.timeoutMs`: sobrescritura del tiempo de espera de solicitud (ms).

## Anulaciones controladas por el modelo (activadas por defecto)

De forma predeterminada, el modelo **puede** emitir directivas de TTS para una sola respuesta.
Cuando `messages.tts.auto` es `tagged`, estas directivas son necesarias para activar el audio.

Cuando esta habilitado, el modelo puede emitir directivas `[[tts:...]]` para anular la voz
para una sola respuesta, ademas de un bloque opcional `[[tts:text]]...[[/tts:text]]` para
proporcionar etiquetas expresivas (risas, indicaciones de canto, etc.) que solo deben aparecer en el audio.

Ejemplo de carga util de respuesta:

```
Here you go.

[[tts:provider=elevenlabs voiceId=pMsXgVXv3BLzUgSXRplE model=eleven_v3 speed=1.1]]
[[tts:text]](laughs) Read the song once more.[[/tts:text]]
```

Claves de directiva disponibles (cuando estan habilitadas):

- `provider` (`openai` | `elevenlabs` | `edge`)
- `voice` (voz de OpenAI) o `voiceId` (ElevenLabs)
- `model` (modelo TTS de OpenAI o id de modelo de ElevenLabs)
- `stability`, `similarityBoost`, `style`, `speed`, `useSpeakerBoost`
- `applyTextNormalization` (`auto|on|off`)
- `languageCode` (ISO 639-1)
- `seed`

Deshabilitar todas las anulaciones del modelo:

```json5
{
  messages: {
    tts: {
      modelOverrides: {
        enabled: false,
      },
    },
  },
}
```

Lista blanca opcional (deshabilitar anulaciones especificas manteniendo las etiquetas habilitadas):

```json5
{
  messages: {
    tts: {
      modelOverrides: {
        enabled: true,
        allowProvider: false,
        allowSeed: false,
      },
    },
  },
}
```

## Preferencias por usuario

Los comandos slash escriben anulaciones locales en `prefsPath` (predeterminado:
`~/.openclaw/settings/tts.json`, sobrescribir con `OPENCLAW_TTS_PREFS` o
`messages.tts.prefsPath`).

Campos almacenados:

- `enabled`
- `provider`
- `maxLength` (umbral de resumen; predeterminado 1500 caracteres)
- `summarize` (predeterminado `true`)

Estos anulan `messages.tts.*` para ese host.

## Formatos de salida (fijos)

- **Telegram**: nota de voz Opus (`opus_48000_64` de ElevenLabs, `opus` de OpenAI).
  - 48kHz / 64kbps es un buen equilibrio para notas de voz y es requerido para la burbuja redonda.
- **Otros canales**: MP3 (`mp3_44100_128` de ElevenLabs, `mp3` de OpenAI).
  - 44.1kHz / 128kbps es el equilibrio predeterminado para la claridad del habla.
- **Edge TTS**: usa `edge.outputFormat` (predeterminado `audio-24khz-48kbitrate-mono-mp3`).
  - `node-edge-tts` acepta un `outputFormat`, pero no todos los formatos estan disponibles
    desde el servicio Edge. citeturn2search0
  - Los valores de formato de salida siguen los formatos de salida de Microsoft Speech (incluyendo Ogg/WebM Opus). citeturn1search0
  - Telegram `sendVoice` acepta OGG/MP3/M4A; use OpenAI/ElevenLabs si necesita
    notas de voz Opus garantizadas. citeturn1search1
  - Si falla el formato de salida de Edge configurado, OpenClaw reintenta con MP3.

Los formatos de OpenAI/ElevenLabs son fijos; Telegram espera Opus para la UX de notas de voz.

## Comportamiento de auto‑TTS

Cuando esta habilitado, OpenClaw:

- omite TTS si la respuesta ya contiene medios o una directiva `MEDIA:`.
- omite respuestas muy cortas (< 10 caracteres).
- resume respuestas largas cuando esta habilitado usando `agents.defaults.model.primary` (o `summaryModel`).
- adjunta el audio generado a la respuesta.

Si la respuesta excede `maxLength` y el resumen esta desactivado (o no hay clave de API para el
modelo de resumen), se omite el audio y se envia la respuesta de texto normal.

## Diagrama de flujo

```
Reply -> TTS enabled?
  no  -> send text
  yes -> has media / MEDIA: / short?
          yes -> send text
          no  -> length > limit?
                   no  -> TTS -> attach audio
                   yes -> summary enabled?
                            no  -> send text
                            yes -> summarize (summaryModel or agents.defaults.model.primary)
                                      -> TTS -> attach audio
```

## Uso del comando slash

Hay un solo comando: `/tts`.
Consulte [Comandos slash](/tools/slash-commands) para detalles de habilitacion.

Nota de Discord: `/tts` es un comando integrado de Discord, por lo que OpenClaw registra
`/voice` como el comando nativo alli. El texto `/tts ...` aun funciona.

```
/tts off
/tts always
/tts inbound
/tts tagged
/tts status
/tts provider openai
/tts limit 2000
/tts summary off
/tts audio Hello from OpenClaw
```

Notas:

- Los comandos requieren un remitente autorizado (las reglas de lista blanca/propietario siguen aplicando).
- `commands.text` o el registro de comandos nativos debe estar habilitado.
- `off|always|inbound|tagged` son conmutadores por sesion (`/tts on` es un alias de `/tts always`).
- `limit` y `summary` se almacenan en preferencias locales, no en la configuracion principal.
- `/tts audio` genera una respuesta de audio unica (no activa TTS).

## Herramienta del agente

La herramienta `tts` convierte texto a voz y devuelve una ruta `MEDIA:`. Cuando el
resultado es compatible con Telegram, la herramienta incluye `[[audio_as_voice]]` para que
Telegram envie una burbuja de voz.

## RPC del Gateway

Metodos del Gateway:

- `tts.status`
- `tts.enable`
- `tts.disable`
- `tts.convert`
- `tts.setProvider`
- `tts.providers`
