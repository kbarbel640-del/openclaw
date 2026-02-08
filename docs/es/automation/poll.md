---
summary: "Envío de encuestas vía gateway + CLI"
read_when:
  - Agregar o modificar el soporte de encuestas
  - Depurar envíos de encuestas desde el CLI o el gateway
title: "Encuestas"
x-i18n:
  source_path: automation/poll.md
  source_hash: 760339865d27ec40
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:57:48Z
---

# Encuestas

## Canales compatibles

- WhatsApp (canal web)
- Discord
- MS Teams (Tarjetas Adaptativas)

## CLI

```bash
# WhatsApp
openclaw message poll --target +15555550123 \
  --poll-question "Lunch today?" --poll-option "Yes" --poll-option "No" --poll-option "Maybe"
openclaw message poll --target 123456789@g.us \
  --poll-question "Meeting time?" --poll-option "10am" --poll-option "2pm" --poll-option "4pm" --poll-multi

# Discord
openclaw message poll --channel discord --target channel:123456789 \
  --poll-question "Snack?" --poll-option "Pizza" --poll-option "Sushi"
openclaw message poll --channel discord --target channel:123456789 \
  --poll-question "Plan?" --poll-option "A" --poll-option "B" --poll-duration-hours 48

# MS Teams
openclaw message poll --channel msteams --target conversation:19:abc@thread.tacv2 \
  --poll-question "Lunch?" --poll-option "Pizza" --poll-option "Sushi"
```

Opciones:

- `--channel`: `whatsapp` (predeterminado), `discord`, o `msteams`
- `--poll-multi`: permite seleccionar múltiples opciones
- `--poll-duration-hours`: solo Discord (predeterminado: 24 cuando se omite)

## Gateway RPC

Método: `poll`

Parámetros:

- `to` (string, requerido)
- `question` (string, requerido)
- `options` (string[], requerido)
- `maxSelections` (number, opcional)
- `durationHours` (number, opcional)
- `channel` (string, opcional, predeterminado: `whatsapp`)
- `idempotencyKey` (string, requerido)

## Diferencias entre canales

- WhatsApp: 2–12 opciones, `maxSelections` debe estar dentro del conteo de opciones, ignora `durationHours`.
- Discord: 2–10 opciones, `durationHours` se limita a 1–768 horas (predeterminado: 24). `maxSelections > 1` habilita la selección múltiple; Discord no admite un conteo de selección estricto.
- MS Teams: encuestas con Tarjetas Adaptativas (administradas por OpenClaw). No hay API nativa de encuestas; `durationHours` se ignora.

## Herramienta del agente (Mensaje)

Use la herramienta `message` con la acción `poll` (`to`, `pollQuestion`, `pollOption`, `pollMulti` opcional, `pollDurationHours`, `channel`).

Nota: Discord no tiene un modo de “elegir exactamente N”; `pollMulti` se asigna a selección múltiple.
Las encuestas de Teams se renderizan como Tarjetas Adaptativas y requieren que el gateway permanezca en línea
para registrar votos en `~/.openclaw/msteams-polls.json`.
