---
title: Refatoracao do Espelhamento de Sessao de Saida (Issue #1520)
description: Track outbound session mirroring refactor notes, decisions, tests, and open items.
x-i18n:
  source_path: refactor/outbound-session-mirroring.md
  source_hash: b88a72f36f7b6d8a
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:57:18Z
---

# Refatoracao do Espelhamento de Sessao de Saida (Issue #1520)

## Status

- Em andamento.
- Roteamento de canais do core + plugins atualizado para espelhamento de saida.
- O envio pelo Gateway agora deriva a sessao de destino quando sessionKey e omitida.

## Contexto

Envios de saida eram espelhados na sessao _atual_ do agente (chave de sessao da ferramenta) em vez da sessao do canal de destino. O roteamento de entrada usa chaves de sessao de canal/par, portanto as respostas de saida caiam na sessao errada e alvos de primeiro contato frequentemente nao tinham entradas de sessao.

## Objetivos

- Espelhar mensagens de saida na chave de sessao do canal de destino.
- Criar entradas de sessao na saida quando estiverem ausentes.
- Manter o escopo de thread/topico alinhado com as chaves de sessao de entrada.
- Cobrir canais do core e extensoes empacotadas.

## Resumo da Implementacao

- Novo helper de roteamento de sessao de saida:
  - `src/infra/outbound/outbound-session.ts`
  - `resolveOutboundSessionRoute` constroi a sessionKey de destino usando `buildAgentSessionKey` (dmScope + identityLinks).
  - `ensureOutboundSessionEntry` grava um(a) `MsgContext` minimo(a) via `recordSessionMetaFromInbound`.
- `runMessageAction` (send) deriva a sessionKey de destino e a passa para `executeSendAction` para espelhamento.
- `message-tool` nao espelha mais diretamente; apenas resolve o agentId a partir da chave de sessao atual.
- O caminho de envio de plugins espelha via `appendAssistantMessageToSessionTranscript` usando a sessionKey derivada.
- O envio pelo Gateway deriva uma chave de sessao de destino quando nenhuma e fornecida (agente padrao) e garante uma entrada de sessao.

## Tratamento de Thread/Topico

- Slack: replyTo/threadId -> `resolveThreadSessionKeys` (sufixo).
- Discord: threadId/replyTo -> `resolveThreadSessionKeys` com `useSuffix=false` para corresponder a entrada (o id do canal de thread ja delimita a sessao).
- Telegram: IDs de topico mapeiam para `chatId:topic:<id>` via `buildTelegramGroupPeerId`.

## Extensoes Cobertas

- Matrix, MS Teams, Mattermost, BlueBubbles, Nextcloud Talk, Zalo, Zalo Personal, Nostr, Tlon.
- Observacoes:
  - Alvos do Mattermost agora removem `@` para roteamento de chave de sessao de DM.
  - Zalo Personal usa o tipo de par de DM para alvos 1:1 (grupo apenas quando `group:` esta presente).
  - Alvos de grupo do BlueBubbles removem prefixos `chat_*` para corresponder as chaves de sessao de entrada.
  - O espelhamento automatico de threads do Slack corresponde ids de canal sem diferenciar maiusculas/minusculas.
  - O envio pelo Gateway converte para minusculas as chaves de sessao fornecidas antes do espelhamento.

## Decisoes

- **Derivacao de sessao no envio pelo Gateway**: se `sessionKey` for fornecida, use-a. Se omitida, derive uma sessionKey a partir do alvo + agente padrao e espelhe nela.
- **Criacao de entrada de sessao**: sempre usar `recordSessionMetaFromInbound` com `Provider/From/To/ChatType/AccountId/Originating*` alinhado aos formatos de entrada.
- **Normalizacao de alvo**: o roteamento de saida usa alvos resolvidos (apos `resolveChannelTarget`) quando disponiveis.
- **Capitalizacao da chave de sessao**: canonizar chaves de sessao para minusculas na gravacao e durante migracoes.

## Testes Adicionados/Atualizados

- `src/infra/outbound/outbound-session.test.ts`
  - Chave de sessao de thread do Slack.
  - Chave de sessao de topico do Telegram.
  - dmScope identityLinks com Discord.
- `src/agents/tools/message-tool.test.ts`
  - Deriva agentId a partir da chave de sessao (nenhuma sessionKey passada adiante).
- `src/gateway/server-methods/send.test.ts`
  - Deriva a chave de sessao quando omitida e cria a entrada de sessao.

## Itens em Aberto / Acoes Futuras

- O plugin de chamada de voz usa chaves de sessao personalizadas `voice:<phone>`. O mapeamento de saida nao e padronizado aqui; se a ferramenta de mensagens precisar suportar envios de chamada de voz, adicionar mapeamento explicito.
- Confirmar se algum plugin externo usa formatos `From/To` nao padrao alem do conjunto empacotado.

## Arquivos Modificados

- `src/infra/outbound/outbound-session.ts`
- `src/infra/outbound/outbound-send-service.ts`
- `src/infra/outbound/message-action-runner.ts`
- `src/agents/tools/message-tool.ts`
- `src/gateway/server-methods/send.ts`
- Testes em:
  - `src/infra/outbound/outbound-session.test.ts`
  - `src/agents/tools/message-tool.test.ts`
  - `src/gateway/server-methods/send.test.ts`
