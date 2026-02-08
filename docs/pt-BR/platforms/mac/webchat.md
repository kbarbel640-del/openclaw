---
summary: "Como o app para mac incorpora o WebChat do Gateway e como depurá-lo"
read_when:
  - Depurando a visualizacao do WebChat no mac ou a porta de loopback
title: "WebChat"
x-i18n:
  source_path: platforms/mac/webchat.md
  source_hash: 04ff448758e53009
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:56:56Z
---

# WebChat (app macOS)

O app da barra de menu do macOS incorpora a interface do WebChat como uma view nativa em SwiftUI. Ele
se conecta ao Gateway e, por padrao, usa a **sessao principal** do agente selecionado
(com um alternador de sessoes para outras sessoes).

- **Modo local**: conecta-se diretamente ao WebSocket local do Gateway.
- **Modo remoto**: encaminha a porta de controle do Gateway via SSH e usa esse
  tunel como plano de dados.

## Inicializacao e depuracao

- Manual: menu Lobster → “Open Chat”.
- Abertura automatica para testes:
  ```bash
  dist/OpenClaw.app/Contents/MacOS/OpenClaw --webchat
  ```
- Logs: `./scripts/clawlog.sh` (subsistema `bot.molt`, categoria `WebChatSwiftUI`).

## Como esta conectado

- Plano de dados: metodos WS do Gateway `chat.history`, `chat.send`, `chat.abort`,
  `chat.inject` e eventos `chat`, `agent`, `presence`, `tick`, `health`.
- Sessao: por padrao, a sessao primaria (`main`, ou `global` quando o escopo e
  global). A interface pode alternar entre sessoes.
- A integracao inicial usa uma sessao dedicada para manter a configuracao da primeira execucao separada.

## Superficie de seguranca

- O modo remoto encaminha apenas a porta de controle do WebSocket do Gateway via SSH.

## Limitacoes conhecidas

- A interface e otimizada para sessoes de chat (nao e um sandbox de navegador completo).
