---
summary: "Comprensión entrante de imagen/audio/video (opcional) con proveedor y alternativas por CLI"
read_when:
  - Diseño o refactorización de la comprensión de medios
  - Ajuste del preprocesamiento entrante de audio/video/imagen
title: "Comprensión de Medios"
x-i18n:
  source_path: nodes/media-understanding.md
  source_hash: 4b275b152060eae3
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:59:32Z
---

# Comprensión de Medios (Entrante) — 2026-01-17

OpenClaw puede **resumir medios entrantes** (imagen/audio/video) antes de que se ejecute el flujo de respuesta. Detecta automáticamente cuándo hay herramientas locales o claves de proveedor disponibles, y puede deshabilitarse o personalizarse. Si la comprensión está desactivada, los modelos aún reciben los archivos/URL originales como de costumbre.

## Objetivos

- Opcional: pre‑digerir medios entrantes en texto corto para un enrutamiento más rápido y un mejor análisis de comandos.
- Preservar siempre la entrega del medio original al modelo.
- Soportar **APIs de proveedores** y **alternativas por CLI**.
- Permitir múltiples modelos con respaldo ordenado (error/tamaño/tiempo de espera).

## Comportamiento de alto nivel

1. Recopilar adjuntos entrantes (`MediaPaths`, `MediaUrls`, `MediaTypes`).
2. Para cada capacidad habilitada (imagen/audio/video), seleccionar adjuntos según la política (por defecto: **primero**).
3. Elegir la primera entrada de modelo elegible (tamaño + capacidad + autenticación).
4. Si un modelo falla o el medio es demasiado grande, **retroceder a la siguiente entrada**.
5. En caso de éxito:
   - `Body` se convierte en un bloque `[Image]`, `[Audio]` o `[Video]`.
   - El audio establece `{{Transcript}}`; el análisis de comandos usa el texto del subtítulo cuando está presente,
     de lo contrario, la transcripción.
   - Los subtítulos se preservan como `User text:` dentro del bloque.

Si la comprensión falla o está deshabilitada, **el flujo de respuesta continúa** con el cuerpo original + adjuntos.

## Resumen de configuración

`tools.media` admite **modelos compartidos** más anulaciones por capacidad:

- `tools.media.models`: lista de modelos compartidos (use `capabilities` para restringir).
- `tools.media.image` / `tools.media.audio` / `tools.media.video`:
  - valores predeterminados (`prompt`, `maxChars`, `maxBytes`, `timeoutSeconds`, `language`)
  - anulaciones de proveedor (`baseUrl`, `headers`, `providerOptions`)
  - opciones de audio Deepgram mediante `tools.media.audio.providerOptions.deepgram`
  - lista **opcional por capacidad `models`** (preferida antes que los modelos compartidos)
  - política `attachments` (`mode`, `maxAttachments`, `prefer`)
  - `scope` (restricción opcional por canal/chatType/clave de sesión)
- `tools.media.concurrency`: máximo de ejecuciones concurrentes por capacidad (por defecto **2**).

```json5
{
  tools: {
    media: {
      models: [
        /* shared list */
      ],
      image: {
        /* optional overrides */
      },
      audio: {
        /* optional overrides */
      },
      video: {
        /* optional overrides */
      },
    },
  },
}
```

### Entradas de modelo

Cada entrada `models[]` puede ser de **proveedor** o **CLI**:

```json5
{
  type: "provider", // default if omitted
  provider: "openai",
  model: "gpt-5.2",
  prompt: "Describe the image in <= 500 chars.",
  maxChars: 500,
  maxBytes: 10485760,
  timeoutSeconds: 60,
  capabilities: ["image"], // optional, used for multi‑modal entries
  profile: "vision-profile",
  preferredProfile: "vision-fallback",
}
```

```json5
{
  type: "cli",
  command: "gemini",
  args: [
    "-m",
    "gemini-3-flash",
    "--allowed-tools",
    "read_file",
    "Read the media at {{MediaPath}} and describe it in <= {{MaxChars}} characters.",
  ],
  maxChars: 500,
  maxBytes: 52428800,
  timeoutSeconds: 120,
  capabilities: ["video", "image"],
}
```

Las plantillas de CLI también pueden usar:

- `{{MediaDir}}` (directorio que contiene el archivo de medios)
- `{{OutputDir}}` (directorio temporal creado para esta ejecución)
- `{{OutputBase}}` (ruta base del archivo temporal, sin extensión)

## Valores predeterminados y límites

Valores recomendados:

- `maxChars`: **500** para imagen/video (corto, amigable para comandos)
- `maxChars`: **sin establecer** para audio (transcripción completa a menos que establezca un límite)
- `maxBytes`:
  - imagen: **10MB**
  - audio: **20MB**
  - video: **50MB**

Reglas:

- Si el medio supera `maxBytes`, ese modelo se omite y **se prueba el siguiente modelo**.
- Si el modelo devuelve más de `maxChars`, la salida se recorta.
- `prompt` usa por defecto “Describe the {media}.” más la guía `maxChars` (solo imagen/video).
- Si `<capability>.enabled: true` pero no hay modelos configurados, OpenClaw intenta el
  **modelo de respuesta activo** cuando su proveedor admite la capacidad.

### Detección automática de comprensión de medios (predeterminada)

Si `tools.media.<capability>.enabled` **no** está establecido en `false` y no ha
configurado modelos, OpenClaw detecta automáticamente en este orden y **se detiene en la primera
opción que funcione**:

1. **CLIs locales** (solo audio; si están instalados)
   - `sherpa-onnx-offline` (requiere `SHERPA_ONNX_MODEL_DIR` con codificador/decodificador/unidor/tokens)
   - `whisper-cli` (`whisper-cpp`; usa `WHISPER_CPP_MODEL` o el modelo tiny incluido)
   - `whisper` (CLI de Python; descarga modelos automáticamente)
2. **Gemini CLI** (`gemini`) usando `read_many_files`
3. **Claves de proveedor**
   - Audio: OpenAI → Groq → Deepgram → Google
   - Imagen: OpenAI → Anthropic → Google → MiniMax
   - Video: Google

Para deshabilitar la detección automática, establezca:

```json5
{
  tools: {
    media: {
      audio: {
        enabled: false,
      },
    },
  },
}
```

Nota: La detección de binarios es de mejor esfuerzo en macOS/Linux/Windows; asegúrese de que el CLI esté en `PATH` (expandimos `~`), o establezca un modelo CLI explícito con una ruta de comando completa.

## Capacidades (opcional)

Si establece `capabilities`, la entrada solo se ejecuta para esos tipos de medios. Para listas
compartidas, OpenClaw puede inferir valores predeterminados:

- `openai`, `anthropic`, `minimax`: **imagen**
- `google` (API de Gemini): **imagen + audio + video**
- `groq`: **audio**
- `deepgram`: **audio**

Para entradas CLI, **establezca `capabilities` explícitamente** para evitar coincidencias sorprendentes.
Si omite `capabilities`, la entrada es elegible para la lista en la que aparece.

## Matriz de soporte de proveedores (integraciones de OpenClaw)

| Capacidad | Integración de proveedor                        | Notas                                                             |
| --------- | ----------------------------------------------- | ----------------------------------------------------------------- |
| Imagen    | OpenAI / Anthropic / Google / otros vía `pi-ai` | Cualquier modelo con capacidad de imagen en el registro funciona. |
| Audio     | OpenAI, Groq, Deepgram, Google                  | Transcripción del proveedor (Whisper/Deepgram/Gemini).            |
| Video     | Google (API de Gemini)                          | Comprensión de video del proveedor.                               |

## Proveedores recomendados

**Imagen**

- Prefiera su modelo activo si admite imágenes.
- Buenas opciones predeterminadas: `openai/gpt-5.2`, `anthropic/claude-opus-4-6`, `google/gemini-3-pro-preview`.

**Audio**

- `openai/gpt-4o-mini-transcribe`, `groq/whisper-large-v3-turbo` o `deepgram/nova-3`.
- Alternativa por CLI: `whisper-cli` (whisper-cpp) o `whisper`.
- Configuración de Deepgram: [Deepgram (transcripción de audio)](/providers/deepgram).

**Video**

- `google/gemini-3-flash-preview` (rápido), `google/gemini-3-pro-preview` (más completo).
- Alternativa por CLI: CLI `gemini` (admite `read_file` en video/audio).

## Política de adjuntos

La política por capacidad `attachments` controla qué adjuntos se procesan:

- `mode`: `first` (predeterminado) o `all`
- `maxAttachments`: límite de cantidad procesada (predeterminado **1**)
- `prefer`: `first`, `last`, `path`, `url`

Cuando `mode: "all"`, las salidas se etiquetan como `[Image 1/2]`, `[Audio 2/2]`, etc.

## Ejemplos de configuración

### 1) Lista de modelos compartidos + anulaciones

```json5
{
  tools: {
    media: {
      models: [
        { provider: "openai", model: "gpt-5.2", capabilities: ["image"] },
        {
          provider: "google",
          model: "gemini-3-flash-preview",
          capabilities: ["image", "audio", "video"],
        },
        {
          type: "cli",
          command: "gemini",
          args: [
            "-m",
            "gemini-3-flash",
            "--allowed-tools",
            "read_file",
            "Read the media at {{MediaPath}} and describe it in <= {{MaxChars}} characters.",
          ],
          capabilities: ["image", "video"],
        },
      ],
      audio: {
        attachments: { mode: "all", maxAttachments: 2 },
      },
      video: {
        maxChars: 500,
      },
    },
  },
}
```

### 2) Solo Audio + Video (imagen desactivada)

```json5
{
  tools: {
    media: {
      audio: {
        enabled: true,
        models: [
          { provider: "openai", model: "gpt-4o-mini-transcribe" },
          {
            type: "cli",
            command: "whisper",
            args: ["--model", "base", "{{MediaPath}}"],
          },
        ],
      },
      video: {
        enabled: true,
        maxChars: 500,
        models: [
          { provider: "google", model: "gemini-3-flash-preview" },
          {
            type: "cli",
            command: "gemini",
            args: [
              "-m",
              "gemini-3-flash",
              "--allowed-tools",
              "read_file",
              "Read the media at {{MediaPath}} and describe it in <= {{MaxChars}} characters.",
            ],
          },
        ],
      },
    },
  },
}
```

### 3) Comprensión opcional de imágenes

```json5
{
  tools: {
    media: {
      image: {
        enabled: true,
        maxBytes: 10485760,
        maxChars: 500,
        models: [
          { provider: "openai", model: "gpt-5.2" },
          { provider: "anthropic", model: "claude-opus-4-6" },
          {
            type: "cli",
            command: "gemini",
            args: [
              "-m",
              "gemini-3-flash",
              "--allowed-tools",
              "read_file",
              "Read the media at {{MediaPath}} and describe it in <= {{MaxChars}} characters.",
            ],
          },
        ],
      },
    },
  },
}
```

### 4) Entrada única multimodal (capacidades explícitas)

```json5
{
  tools: {
    media: {
      image: {
        models: [
          {
            provider: "google",
            model: "gemini-3-pro-preview",
            capabilities: ["image", "video", "audio"],
          },
        ],
      },
      audio: {
        models: [
          {
            provider: "google",
            model: "gemini-3-pro-preview",
            capabilities: ["image", "video", "audio"],
          },
        ],
      },
      video: {
        models: [
          {
            provider: "google",
            model: "gemini-3-pro-preview",
            capabilities: ["image", "video", "audio"],
          },
        ],
      },
    },
  },
}
```

## Salida de estado

Cuando se ejecuta la comprensión de medios, `/status` incluye una línea de resumen corta:

```
📎 Media: image ok (openai/gpt-5.2) · audio skipped (maxBytes)
```

Esto muestra los resultados por capacidad y el proveedor/modelo elegido cuando corresponde.

## Notas

- La comprensión es de **mejor esfuerzo**. Los errores no bloquean las respuestas.
- Los adjuntos aún se pasan a los modelos incluso cuando la comprensión está deshabilitada.
- Use `scope` para limitar dónde se ejecuta la comprensión (por ejemplo, solo Mensajes directos).

## Documentos relacionados

- [Configuración](/gateway/configuration)
- [Soporte de Imagen y Medios](/nodes/images)
