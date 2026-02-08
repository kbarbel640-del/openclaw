---
summary: "Runtime do Gateway no macOS (serviço launchd externo)"
read_when:
  - Empacotando o OpenClaw.app
  - Depurando o serviço launchd do Gateway no macOS
  - Instalando o CLI do Gateway para macOS
title: "Gateway no macOS"
x-i18n:
  source_path: platforms/mac/bundled-gateway.md
  source_hash: 4a3e963d13060b12
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:56:48Z
---

# Gateway no macOS (launchd externo)

O OpenClaw.app não inclui mais Node/Bun nem o runtime do Gateway. O app do macOS
espera uma instalação **externa** do CLI `openclaw`, não inicia o Gateway como um
processo filho e gerencia um serviço launchd por usuário para manter o Gateway
em execução (ou se conecta a um Gateway local existente, se já houver um em execução).

## Instalar o CLI (obrigatório para modo local)

Você precisa do Node 22+ no Mac e, em seguida, instalar `openclaw` globalmente:

```bash
npm install -g openclaw@<version>
```

O botão **Install CLI** do app macOS executa o mesmo fluxo via npm/pnpm (bun não é recomendado para o runtime do Gateway).

## Launchd (Gateway como LaunchAgent)

Label:

- `bot.molt.gateway` (ou `bot.molt.<profile>`; o legado `com.openclaw.*` pode permanecer)

Local do plist (por usuário):

- `~/Library/LaunchAgents/bot.molt.gateway.plist`
  (ou `~/Library/LaunchAgents/bot.molt.<profile>.plist`)

Gerenciamento:

- O app do macOS é responsável pela instalação/atualização do LaunchAgent no modo Local.
- O CLI também pode instalá-lo: `openclaw gateway install`.

Comportamento:

- “OpenClaw Active” ativa/desativa o LaunchAgent.
- Fechar o app **não** para o gateway (o launchd o mantém ativo).
- Se um Gateway já estiver em execução na porta configurada, o app se conecta a
  ele em vez de iniciar um novo.

Logs:

- stdout/err do launchd: `/tmp/openclaw/openclaw-gateway.log`

## Compatibilidade de versão

O app do macOS verifica a versão do gateway em relação à sua própria versão. Se
forem incompatíveis, atualize o CLI global para corresponder à versão do app.

## Smoke check

```bash
openclaw --version

OPENCLAW_SKIP_CHANNELS=1 \
OPENCLAW_SKIP_CANVAS_HOST=1 \
openclaw gateway --port 18999 --bind loopback
```

Em seguida:

```bash
openclaw gateway call health --url ws://127.0.0.1:18999 --timeout 3000
```
