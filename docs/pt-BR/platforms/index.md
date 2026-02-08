---
summary: "Visao geral de suporte a plataformas (Gateway + aplicativos complementares)"
read_when:
  - Procurando suporte a SO ou caminhos de instalacao
  - Decidindo onde executar o Gateway
title: "Plataformas"
x-i18n:
  source_path: platforms/index.md
  source_hash: 959479995f9ecca3
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:56:45Z
---

# Plataformas

O core do OpenClaw e escrito em TypeScript. **Node e o runtime recomendado**.
Bun nao e recomendado para o Gateway (bugs no WhatsApp/Telegram).

Existem aplicativos complementares para macOS (app de barra de menu) e nos moveis (iOS/Android). Aplicativos complementares para Windows e
Linux estao planejados, mas o Gateway ja e totalmente suportado hoje.
Aplicativos complementares nativos para Windows tambem estao planejados; o Gateway e recomendado via WSL2.

## Escolha seu SO

- macOS: [macOS](/platforms/macos)
- iOS: [iOS](/platforms/ios)
- Android: [Android](/platforms/android)
- Windows: [Windows](/platforms/windows)
- Linux: [Linux](/platforms/linux)

## VPS & hospedagem

- Hub de VPS: [VPS hosting](/vps)
- Fly.io: [Fly.io](/install/fly)
- Hetzner (Docker): [Hetzner](/install/hetzner)
- GCP (Compute Engine): [GCP](/install/gcp)
- exe.dev (VM + proxy HTTPS): [exe.dev](/install/exe-dev)

## Links comuns

- Guia de instalacao: [Primeiros Passos](/start/getting-started)
- Runbook do Gateway: [Gateway](/gateway)
- Configuracao do Gateway: [Configuration](/gateway/configuration)
- Status do servico: `openclaw gateway status`

## Instalacao do servico do Gateway (CLI)

Use um destes (todos suportados):

- Assistente (recomendado): `openclaw onboard --install-daemon`
- Direto: `openclaw gateway install`
- Configurar fluxo: `openclaw configure` → selecione **servico do Gateway**
- Reparar/migrar: `openclaw doctor` (oferece instalar ou corrigir o servico)

O alvo do servico depende do SO:

- macOS: LaunchAgent (`bot.molt.gateway` ou `bot.molt.<profile>`; legado `com.openclaw.*`)
- Linux/WSL2: servico de usuario systemd (`openclaw-gateway[-<profile>].service`)
