---
summary: "Reglas de manejo de imágenes y medios para envíos, gateway y respuestas del agente"
read_when:
  - Modifying media pipeline or attachments
title: "Soporte de Imágenes y Medios"
x-i18n:
  source_path: nodes/images.md
  source_hash: 971aed398ea01078
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:59:21Z
---

# Soporte de Imágenes y Medios — 2025-12-05

El canal de WhatsApp se ejecuta mediante **Baileys Web**. Este documento captura las reglas actuales de manejo de medios para envíos, gateway y respuestas del agente.

## Objetivos

- Enviar medios con subtítulos opcionales mediante `openclaw message send --media`.
- Permitir que las respuestas automáticas desde la bandeja de entrada web incluyan medios junto con texto.
- Mantener límites por tipo razonables y predecibles.

## Superficie de CLI

- `openclaw message send --media <path-or-url> [--message <caption>]`
  - `--media` opcional; el subtítulo puede estar vacío para envíos solo de medios.
  - `--dry-run` imprime la carga útil resuelta; `--json` emite `{ channel, to, messageId, mediaUrl, caption }`.

## Comportamiento del canal WhatsApp Web

- Entrada: ruta de archivo local **o** URL HTTP(S).
- Flujo: cargar en un Buffer, detectar el tipo de medio y construir la carga útil correcta:
  - **Imágenes:** redimensionar y recomprimir a JPEG (lado máximo 2048px) apuntando a `agents.defaults.mediaMaxMb` (predeterminado 5 MB), con tope de 6 MB.
  - **Audio/Voz/Video:** paso directo hasta 16 MB; el audio se envía como nota de voz (`ptt: true`).
  - **Documentos:** cualquier otro, hasta 100 MB, con el nombre de archivo preservado cuando esté disponible.
- Reproducción estilo GIF de WhatsApp: enviar un MP4 con `gifPlayback: true` (CLI: `--gif-playback`) para que los clientes móviles reproduzcan en bucle en línea.
- La detección MIME prioriza bytes mágicos, luego encabezados y luego la extensión del archivo.
- El subtítulo proviene de `--message` o `reply.text`; se permite subtítulo vacío.
- Registro: no verboso muestra `↩️`/`✅`; el modo verboso incluye tamaño y ruta/URL de origen.

## Canalización de Respuesta Automática

- `getReplyFromConfig` devuelve `{ text?, mediaUrl?, mediaUrls? }`.
- Cuando hay medios presentes, el remitente web resuelve rutas locales o URLs usando la misma canalización que `openclaw message send`.
- Si se proporcionan múltiples entradas de medios, se envían de forma secuencial.

## Medios Entrantes a Comandos (Pi)

- Cuando los mensajes web entrantes incluyen medios, OpenClaw descarga a un archivo temporal y expone variables de plantillas:
  - `{{MediaUrl}}` pseudo-URL para el medio entrante.
  - `{{MediaPath}}` ruta temporal local escrita antes de ejecutar el comando.
- Cuando está habilitado un sandbox de Docker por sesión, los medios entrantes se copian al espacio de trabajo del sandbox y `MediaPath`/`MediaUrl` se reescriben a una ruta relativa como `media/inbound/<filename>`.
- La comprensión de medios (si se configura mediante `tools.media.*` o compartido `tools.media.models`) se ejecuta antes del templating y puede insertar bloques `[Image]`, `[Audio]` y `[Video]` en `Body`.
  - El audio establece `{{Transcript}}` y usa la transcripción para el análisis del comando, de modo que los comandos con barra sigan funcionando.
  - Las descripciones de video e imagen preservan cualquier texto de subtítulo para el análisis del comando.
- De forma predeterminada, solo se procesa el primer adjunto coincidente de imagen/audio/video; configure `tools.media.<cap>.attachments` para procesar múltiples adjuntos.

## Límites y Errores

**Topes de envío saliente (envío web de WhatsApp)**

- Imágenes: tope de ~6 MB después de la recomprensión.
- Audio/voz/video: tope de 16 MB; documentos: tope de 100 MB.
- Medios demasiado grandes o ilegibles → error claro en los registros y se omite la respuesta.

**Topes de comprensión de medios (transcripción/descripción)**

- Imagen predeterminada: 10 MB (`tools.media.image.maxBytes`).
- Audio predeterminado: 20 MB (`tools.media.audio.maxBytes`).
- Video predeterminado: 50 MB (`tools.media.video.maxBytes`).
- Los medios demasiado grandes omiten la comprensión, pero las respuestas siguen enviándose con el cuerpo original.

## Notas para Pruebas

- Cubra los flujos de envío + respuesta para casos de imagen/audio/documento.
- Valide la recomprensión para imágenes (límite de tamaño) y la marca de nota de voz para audio.
- Asegure que las respuestas con múltiples medios se distribuyan como envíos secuenciales.
