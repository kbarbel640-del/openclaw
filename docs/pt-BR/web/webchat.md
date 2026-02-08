---
summary: "Hospedagem estática do WebChat em loopback e uso de WS do Gateway para UI de chat"
read_when:
  - Depurando ou configurando o acesso ao WebChat
title: "WebChat"
x-i18n:
  source_path: web/webchat.md
  source_hash: b5ee2b462c8c979a
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:57:42Z
---

# WebChat (UI WebSocket do Gateway)

Status: a UI de chat SwiftUI para macOS/iOS fala diretamente com o WebSocket do Gateway.

## O que é

- Uma UI de chat nativa para o gateway (sem navegador embutido e sem servidor estático local).
- Usa as mesmas sessoes e regras de roteamento que outros canais.
- Roteamento deterministico: as respostas sempre voltam para o WebChat.

## Inicio rapido

1. Inicie o gateway.
2. Abra a UI do WebChat (app macOS/iOS) ou a aba de chat da UI de Controle.
3. Garanta que a autenticacao do gateway esteja configurada (obrigatoria por padrao, mesmo em loopback).

## Como funciona (comportamento)

- A UI conecta-se ao WebSocket do Gateway e usa `chat.history`, `chat.send` e `chat.inject`.
- `chat.inject` adiciona uma nota do assistente diretamente ao transcript e a transmite para a UI (sem execucao de agente).
- O historico e sempre buscado no gateway (sem monitoramento de arquivo local).
- Se o gateway estiver inacessivel, o WebChat fica somente leitura.

## Uso remoto

- O modo remoto tunela o WebSocket do gateway via SSH/Tailscale.
- Voce nao precisa executar um servidor WebChat separado.

## Referencia de configuracao (WebChat)

Configuracao completa: [Configuration](/gateway/configuration)

Opcoes de canal:

- Nao ha um bloco `webchat.*` dedicado. O WebChat usa o endpoint do gateway + as configuracoes de autenticacao abaixo.

Opcoes globais relacionadas:

- `gateway.port`, `gateway.bind`: host/porta do WebSocket.
- `gateway.auth.mode`, `gateway.auth.token`, `gateway.auth.password`: autenticacao do WebSocket.
- `gateway.remote.url`, `gateway.remote.token`, `gateway.remote.password`: destino remoto do gateway.
- `session.*`: armazenamento de sessao e padroes da chave principal.
