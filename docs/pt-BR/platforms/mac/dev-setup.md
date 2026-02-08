---
summary: "Guia de configuracao para desenvolvedores trabalhando no aplicativo macOS do OpenClaw"
read_when:
  - Configurando o ambiente de desenvolvimento macOS
title: "Configuracao de Desenvolvimento no macOS"
x-i18n:
  source_path: platforms/mac/dev-setup.md
  source_hash: 4ea67701bd58b751
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:56:54Z
---

# Configuracao para Desenvolvedores no macOS

Este guia aborda as etapas necessarias para compilar e executar o aplicativo macOS do OpenClaw a partir do codigo-fonte.

## Pre-requisitos

Antes de compilar o app, certifique-se de ter o seguinte instalado:

1.  **Xcode 26.2+**: Necessario para desenvolvimento em Swift.
2.  **Node.js 22+ e pnpm**: Necessarios para o gateway, CLI e scripts de empacotamento.

## 1. Instalar Dependencias

Instale as dependencias de todo o projeto:

```bash
pnpm install
```

## 2. Compilar e Empacotar o App

Para compilar o app macOS e empacota-lo em `dist/OpenClaw.app`, execute:

```bash
./scripts/package-mac-app.sh
```

Se voce nao tiver um certificado Apple Developer ID, o script usara automaticamente **assinatura ad-hoc** (`-`).

Para modos de execucao de desenvolvimento, flags de assinatura e solucao de problemas de Team ID, veja o README do app macOS:
https://github.com/openclaw/openclaw/blob/main/apps/macos/README.md

> **Nota**: Apps assinados com ad-hoc podem acionar avisos de seguranca. Se o app travar imediatamente com "Abort trap 6", veja a secao [Solucao de problemas](#troubleshooting).

## 3. Instalar a CLI

O app macOS espera uma instalacao global da CLI `openclaw` para gerenciar tarefas em segundo plano.

**Para instalar (recomendado):**

1.  Abra o app OpenClaw.
2.  Va para a aba de configuracoes **General**.
3.  Clique em **"Install CLI"**.

Alternativamente, instale manualmente:

```bash
npm install -g openclaw@<version>
```

## Solucao de problemas

### Falha na Compilacao: Incompatibilidade de Toolchain ou SDK

A compilacao do app macOS espera o SDK mais recente do macOS e a toolchain Swift 6.2.

**Dependencias do sistema (obrigatorias):**

- **Versao mais recente do macOS disponivel no Software Update** (exigida pelos SDKs do Xcode 26.2)
- **Xcode 26.2** (toolchain Swift 6.2)

**Verificacoes:**

```bash
xcodebuild -version
xcrun swift --version
```

Se as versoes nao corresponderem, atualize o macOS/Xcode e execute a compilacao novamente.

### App Trava ao Conceder Permissao

Se o app travar quando voce tentar permitir acesso a **Reconhecimento de Fala** ou **Microfone**, pode ser devido a um cache TCC corrompido ou incompatibilidade de assinatura.

**Correcao:**

1. Redefina as permissoes TCC:
   ```bash
   tccutil reset All bot.molt.mac.debug
   ```
2. Se isso falhar, altere temporariamente o `BUNDLE_ID` em [`scripts/package-mac-app.sh`](https://github.com/openclaw/openclaw/blob/main/scripts/package-mac-app.sh) para forcar um "estado limpo" no macOS.

### Gateway "Starting..." indefinidamente

Se o status do Gateway permanecer em "Starting...", verifique se um processo zumbi esta mantendo a porta ocupada:

```bash
openclaw gateway status
openclaw gateway stop

# If you’re not using a LaunchAgent (dev mode / manual runs), find the listener:
lsof -nP -iTCP:18789 -sTCP:LISTEN
```

Se uma execucao manual estiver mantendo a porta ocupada, pare esse processo (Ctrl+C). Como ultimo recurso, finalize o PID encontrado acima.
