---
summary: "Analisis de ubicacion de canales entrantes (Telegram + WhatsApp) y campos de contexto"
read_when:
  - Al agregar o modificar el analisis de ubicacion de canales
  - Al usar campos de contexto de ubicacion en prompts o herramientas del agente
title: "Analisis de ubicacion de canales"
x-i18n:
  source_path: channels/location.md
  source_hash: 5602ef105c3da7e4
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:57:54Z
---

# Analisis de ubicacion de canales

OpenClaw normaliza las ubicaciones compartidas desde canales de chat en:

- texto legible para humanos agregado al cuerpo entrante, y
- campos estructurados en la carga util de contexto de respuesta automatica.

Actualmente compatible con:

- **Telegram** (pines de ubicacion + lugares + ubicaciones en vivo)
- **WhatsApp** (locationMessage + liveLocationMessage)
- **Matrix** (`m.location` con `geo_uri`)

## Formato de texto

Las ubicaciones se representan como lineas amigables sin corchetes:

- Pin:
  - `📍 48.858844, 2.294351 ±12m`
- Lugar con nombre:
  - `📍 Eiffel Tower — Champ de Mars, Paris (48.858844, 2.294351 ±12m)`
- Compartir en vivo:
  - `🛰 Live location: 48.858844, 2.294351 ±12m`

Si el canal incluye un pie de foto/comentario, se agrega en la siguiente linea:

```
📍 48.858844, 2.294351 ±12m
Meet here
```

## Campos de contexto

Cuando hay una ubicacion presente, estos campos se agregan a `ctx`:

- `LocationLat` (numero)
- `LocationLon` (numero)
- `LocationAccuracy` (numero, metros; opcional)
- `LocationName` (cadena; opcional)
- `LocationAddress` (cadena; opcional)
- `LocationSource` (`pin | place | live`)
- `LocationIsLive` (booleano)

## Notas por canal

- **Telegram**: los lugares se asignan a `LocationName/LocationAddress`; las ubicaciones en vivo usan `live_period`.
- **WhatsApp**: `locationMessage.comment` y `liveLocationMessage.caption` se agregan como la linea de pie de foto.
- **Matrix**: `geo_uri` se analiza como una ubicacion de pin; la altitud se ignora y `LocationIsLive` siempre es false.
