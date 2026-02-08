---
summary: "Descripcion general del soporte de plataformas (Gateway + aplicaciones complementarias)"
read_when:
  - Buscando soporte de SO o rutas de instalacion
  - Decidiendo donde ejecutar el Gateway
title: "Plataformas"
x-i18n:
  source_path: platforms/index.md
  source_hash: 959479995f9ecca3
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:59:21Z
---

# Plataformas

El nucleo de OpenClaw esta escrito en TypeScript. **Node es el runtime recomendado**.
Bun no se recomienda para el Gateway (errores con WhatsApp/Telegram).

Existen aplicaciones complementarias para macOS (aplicacion de barra de menu) y nodos moviles (iOS/Android). Las aplicaciones complementarias para Windows y
Linux estan planificadas, pero el Gateway cuenta con soporte completo hoy.
Tambien estan planificadas aplicaciones complementarias nativas para Windows; se recomienda el Gateway via WSL2.

## Elija su SO

- macOS: [macOS](/platforms/macos)
- iOS: [iOS](/platforms/ios)
- Android: [Android](/platforms/android)
- Windows: [Windows](/platforms/windows)
- Linux: [Linux](/platforms/linux)

## VPS y hosting

- Hub VPS: [VPS hosting](/vps)
- Fly.io: [Fly.io](/install/fly)
- Hetzner (Docker): [Hetzner](/install/hetzner)
- GCP (Compute Engine): [GCP](/install/gcp)
- exe.dev (VM + proxy HTTPS): [exe.dev](/install/exe-dev)

## Enlaces comunes

- Guia de instalacion: [Primeros Pasos](/start/getting-started)
- Runbook del Gateway: [Gateway](/gateway)
- Configuracion del Gateway: [Configuracion](/gateway/configuration)
- Estado del servicio: `openclaw gateway status`

## Instalacion del servicio Gateway (CLI)

Use una de estas (todas compatibles):

- Asistente (recomendado): `openclaw onboard --install-daemon`
- Directo: `openclaw gateway install`
- Flujo de configuracion: `openclaw configure` → seleccione **servicio Gateway**
- Reparar/migrar: `openclaw doctor` (ofrece instalar o corregir el servicio)

El destino del servicio depende del SO:

- macOS: LaunchAgent (`bot.molt.gateway` o `bot.molt.<profile>`; heredado `com.openclaw.*`)
- Linux/WSL2: servicio de usuario systemd (`openclaw-gateway[-<profile>].service`)
