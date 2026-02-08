---
summary: "Transcripción de Deepgram para notas de voz entrantes"
read_when:
  - Desea usar el reconocimiento de voz a texto de Deepgram para archivos de audio adjuntos
  - Necesita un ejemplo rápido de configuración de Deepgram
title: "Deepgram"
x-i18n:
  source_path: providers/deepgram.md
  source_hash: 8f19e072f0867211
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:59:39Z
---

# Deepgram (Transcripción de audio)

Deepgram es una API de reconocimiento de voz a texto. En OpenClaw se utiliza para la **transcripción de audio/notas de voz entrantes** mediante `tools.media.audio`.

Cuando está habilitado, OpenClaw carga el archivo de audio a Deepgram e inyecta la transcripción en la canalización de respuesta (bloque `{{Transcript}}` + `[Audio]`). Esto **no es streaming**; utiliza el endpoint de transcripción pregrabada.

Sitio web: https://deepgram.com  
Documentación: https://developers.deepgram.com

## Inicio rapido

1. Configure su clave de API:

```
DEEPGRAM_API_KEY=dg_...
```

2. Habilite el proveedor:

```json5
{
  tools: {
    media: {
      audio: {
        enabled: true,
        models: [{ provider: "deepgram", model: "nova-3" }],
      },
    },
  },
}
```

## Opciones

- `model`: id del modelo de Deepgram (predeterminado: `nova-3`)
- `language`: sugerencia de idioma (opcional)
- `tools.media.audio.providerOptions.deepgram.detect_language`: habilitar detección de idioma (opcional)
- `tools.media.audio.providerOptions.deepgram.punctuate`: habilitar puntuación (opcional)
- `tools.media.audio.providerOptions.deepgram.smart_format`: habilitar formato inteligente (opcional)

Ejemplo con idioma:

```json5
{
  tools: {
    media: {
      audio: {
        enabled: true,
        models: [{ provider: "deepgram", model: "nova-3", language: "en" }],
      },
    },
  },
}
```

Ejemplo con opciones de Deepgram:

```json5
{
  tools: {
    media: {
      audio: {
        enabled: true,
        providerOptions: {
          deepgram: {
            detect_language: true,
            punctuate: true,
            smart_format: true,
          },
        },
        models: [{ provider: "deepgram", model: "nova-3" }],
      },
    },
  },
}
```

## Notas

- La autenticación sigue el orden estándar de autenticación del proveedor; `DEEPGRAM_API_KEY` es la ruta más simple.
- Puede sobrescribir endpoints o encabezados con `tools.media.audio.baseUrl` y `tools.media.audio.headers` cuando use un proxy.
- La salida sigue las mismas reglas de audio que otros proveedores (límites de tamaño, tiempos de espera, inyección de transcripciones).
