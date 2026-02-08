---
summary: "Tiempo de ejecución del Gateway en macOS (servicio launchd externo)"
read_when:
  - Empaquetando OpenClaw.app
  - Depurando el servicio launchd del Gateway en macOS
  - Instalando la CLI del Gateway para macOS
title: "Gateway en macOS"
x-i18n:
  source_path: platforms/mac/bundled-gateway.md
  source_hash: 4a3e963d13060b12
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:59:22Z
---

# Gateway en macOS (launchd externo)

OpenClaw.app ya no incluye Node/Bun ni el tiempo de ejecución del Gateway. La app de macOS
espera una instalación **externa** de la CLI `openclaw`, no inicia el Gateway como un
proceso hijo y administra un servicio launchd por usuario para mantener el Gateway
en ejecución (o se conecta a un Gateway local existente si ya hay uno en ejecución).

## Instalar la CLI (requerido para el modo local)

Necesita Node 22+ en el Mac y luego instalar `openclaw` de forma global:

```bash
npm install -g openclaw@<version>
```

El botón **Install CLI** de la app de macOS ejecuta el mismo flujo vía npm/pnpm (no se recomienda bun para el tiempo de ejecución del Gateway).

## Launchd (Gateway como LaunchAgent)

Etiqueta:

- `bot.molt.gateway` (o `bot.molt.<profile>`; el legado `com.openclaw.*` puede permanecer)

Ubicación del plist (por usuario):

- `~/Library/LaunchAgents/bot.molt.gateway.plist`
  (o `~/Library/LaunchAgents/bot.molt.<profile>.plist`)

Administrador:

- La app de macOS controla la instalación/actualización del LaunchAgent en modo Local.
- La CLI también puede instalarlo: `openclaw gateway install`.

Comportamiento:

- “OpenClaw Active” habilita/deshabilita el LaunchAgent.
- Salir de la app **no** detiene el Gateway (launchd lo mantiene activo).
- Si un Gateway ya se está ejecutando en el puerto configurado, la app se conecta
  a él en lugar de iniciar uno nuevo.

Registro:

- stdout/err de launchd: `/tmp/openclaw/openclaw-gateway.log`

## Compatibilidad de versiones

La app de macOS verifica la versión del Gateway contra su propia versión. Si son
incompatibles, actualice la CLI global para que coincida con la versión de la app.

## Prueba rápida

```bash
openclaw --version

OPENCLAW_SKIP_CHANNELS=1 \
OPENCLAW_SKIP_CANVAS_HOST=1 \
openclaw gateway --port 18999 --bind loopback
```

Luego:

```bash
openclaw gateway call health --url ws://127.0.0.1:18999 --timeout 3000
```
