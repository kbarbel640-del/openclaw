---
summary: "Ferramentas de sessao de agente para listar sessoes, buscar historico e enviar mensagens entre sessoes"
read_when:
  - Adicionando ou modificando ferramentas de sessao
title: "Ferramentas de Sessao"
x-i18n:
  source_path: concepts/session-tool.md
  source_hash: cb6e0982ebf507bc
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:56:13Z
---

# Ferramentas de Sessao

Objetivo: conjunto pequeno e dificil de usar incorretamente para que agentes possam listar sessoes, buscar historico e enviar mensagens para outra sessao.

## Nomes das Ferramentas

- `sessions_list`
- `sessions_history`
- `sessions_send`
- `sessions_spawn`

## Modelo de Chaves

- O bucket principal de chat direto e sempre a chave literal `"main"` (resolvida para a chave principal do agente atual).
- Chats em grupo usam `agent:<agentId>:<channel>:group:<id>` ou `agent:<agentId>:<channel>:channel:<id>` (passe a chave completa).
- Cron jobs usam `cron:<job.id>`.
- Hooks usam `hook:<uuid>` a menos que explicitamente definido.
- Sessoes de Node usam `node-<nodeId>` a menos que explicitamente definido.

`global` e `unknown` sao valores reservados e nunca sao listados. Se `session.scope = "global"`, fazemos alias para `main` para todas as ferramentas para que chamadores nunca vejam `global`.

## sessions_list

Lista sessoes como um array de linhas.

Parametros:

- filtro `kinds?: string[]`: qualquer de `"main" | "group" | "cron" | "hook" | "node" | "other"`
- `limit?: number` max de linhas (padrao: padrao do servidor, limitado por exemplo a 200)
- `activeMinutes?: number` apenas sessoes atualizadas nos ultimos N minutos
- `messageLimit?: number` 0 = sem mensagens (padrao 0); >0 = incluir as ultimas N mensagens

Comportamento:

- `messageLimit > 0` busca `chat.history` por sessao e inclui as ultimas N mensagens.
- Resultados de ferramentas sao filtrados na saida da lista; use `sessions_history` para mensagens de ferramentas.
- Ao executar em uma sessao de agente **em sandbox**, as ferramentas de sessao usam por padrao **visibilidade apenas do que foi criado** (veja abaixo).

Formato da linha (JSON):

- `key`: chave da sessao (string)
- `kind`: `main | group | cron | hook | node | other`
- `channel`: `whatsapp | telegram | discord | signal | imessage | webchat | internal | unknown`
- `displayName` (rotulo de exibicao do grupo, se disponivel)
- `updatedAt` (ms)
- `sessionId`
- `model`, `contextTokens`, `totalTokens`
- `thinkingLevel`, `verboseLevel`, `systemSent`, `abortedLastRun`
- `sendPolicy` (override de sessao, se definido)
- `lastChannel`, `lastTo`
- `deliveryContext` ( `{ channel, to, accountId }` normalizado quando disponivel)
- `transcriptPath` (caminho de melhor esforco derivado do diretorio de armazenamento + sessionId)
- `messages?` (apenas quando `messageLimit > 0`)

## sessions_history

Busca a transcricao de uma sessao.

Parametros:

- `sessionKey` (obrigatorio; aceita chave de sessao ou `sessionId` de `sessions_list`)
- `limit?: number` max de mensagens (o servidor limita)
- `includeTools?: boolean` (padrao false)

Comportamento:

- `includeTools=false` filtra mensagens `role: "toolResult"`.
- Retorna o array de mensagens no formato bruto da transcricao.
- Quando fornecido um `sessionId`, o OpenClaw resolve para a chave de sessao correspondente (erro se ids ausentes).

## sessions_send

Envia uma mensagem para outra sessao.

Parametros:

- `sessionKey` (obrigatorio; aceita chave de sessao ou `sessionId` de `sessions_list`)
- `message` (obrigatorio)
- `timeoutSeconds?: number` (padrao >0; 0 = fire-and-forget)

Comportamento:

- `timeoutSeconds = 0`: enfileira e retorna `{ runId, status: "accepted" }`.
- `timeoutSeconds > 0`: aguarda ate N segundos pela conclusao e entao retorna `{ runId, status: "ok", reply }`.
- Se o tempo de espera expirar: `{ runId, status: "timeout", error }`. A execucao continua; chame `sessions_history` depois.
- Se a execucao falhar: `{ runId, status: "error", error }`.
- As execucoes de anuncio de entrega ocorrem apos a execucao primaria concluir e sao de melhor esforco; `status: "ok"` nao garante que o anuncio foi entregue.
- Aguarda via `agent.wait` do gateway (lado do servidor) para que reconexoes nao interrompam a espera.
- O contexto de mensagem agente-para-agente e injetado para a execucao primaria.
- Apos a execucao primaria concluir, o OpenClaw executa um **loop de resposta**:
  - A partir da rodada 2+, alterna entre o agente solicitante e o agente alvo.
  - Responda exatamente `REPLY_SKIP` para parar o ping‑pong.
  - O maximo de rodadas e `session.agentToAgent.maxPingPongTurns` (0–5, padrao 5).
- Quando o loop termina, o OpenClaw executa a **etapa de anuncio agente‑para‑agente** (apenas o agente alvo):
  - Responda exatamente `ANNOUNCE_SKIP` para permanecer em silencio.
  - Qualquer outra resposta e enviada ao canal alvo.
  - A etapa de anuncio inclui a solicitacao original + resposta da rodada 1 + a resposta mais recente do ping‑pong.

## Campo Channel

- Para grupos, `channel` e o canal registrado na entrada da sessao.
- Para chats diretos, `channel` mapeia a partir de `lastChannel`.
- Para cron/hook/node, `channel` e `internal`.
- Se ausente, `channel` e `unknown`.

## Seguranca / Politica de Envio

Bloqueio baseado em politica por canal/tipo de chat (nao por id de sessao).

```json
{
  "session": {
    "sendPolicy": {
      "rules": [
        {
          "match": { "channel": "discord", "chatType": "group" },
          "action": "deny"
        }
      ],
      "default": "allow"
    }
  }
}
```

Override em tempo de execucao (por entrada de sessao):

- `sendPolicy: "allow" | "deny"` (nao definido = herda a configuracao)
- Definivel via `sessions.patch` ou `/send on|off|inherit` somente do proprietario (mensagem standalone).

Pontos de aplicacao:

- `chat.send` / `agent` (gateway)
- logica de entrega de auto-resposta

## sessions_spawn

Inicia uma execucao de sub-agente em uma sessao isolada e anuncia o resultado de volta ao canal de chat do solicitante.

Parametros:

- `task` (obrigatorio)
- `label?` (opcional; usado para logs/UI)
- `agentId?` (opcional; iniciar sob outro id de agente se permitido)
- `model?` (opcional; substitui o modelo do sub-agente; valores invalidos geram erro)
- `runTimeoutSeconds?` (padrao 0; quando definido, aborta a execucao do sub-agente apos N segundos)
- `cleanup?` (`delete|keep`, padrao `keep`)

Lista de permitidos:

- `agents.list[].subagents.allowAgents`: lista de ids de agente permitidos via `agentId` (`["*"]` para permitir qualquer). Padrao: apenas o agente solicitante.

Descoberta:

- Use `agents_list` para descobrir quais ids de agente sao permitidos para `sessions_spawn`.

Comportamento:

- Inicia uma nova sessao `agent:<agentId>:subagent:<uuid>` com `deliver: false`.
- Sub-agentes usam por padrao o conjunto completo de ferramentas **menos ferramentas de sessao** (configuravel via `tools.subagents.tools`).
- Sub-agentes nao podem chamar `sessions_spawn` (sem iniciar sub-agente → sub-agente).
- Sempre nao bloqueante: retorna `{ status: "accepted", runId, childSessionKey }` imediatamente.
- Apos a conclusao, o OpenClaw executa uma **etapa de anuncio** do sub-agente e publica o resultado no canal de chat do solicitante.
- Responda exatamente `ANNOUNCE_SKIP` durante a etapa de anuncio para permanecer em silencio.
- As respostas de anuncio sao normalizadas para `Status`/`Result`/`Notes`; `Status` vem do resultado em tempo de execucao (nao do texto do modelo).
- Sessoes de sub-agente sao auto-arquivadas apos `agents.defaults.subagents.archiveAfterMinutes` (padrao: 60).
- As respostas de anuncio incluem uma linha de estatisticas (tempo de execucao, tokens, sessionKey/sessionId, caminho da transcricao e custo opcional).

## Visibilidade de Sessao em Sandbox

Sessoes em sandbox podem usar ferramentas de sessao, mas por padrao elas apenas veem sessoes que criaram via `sessions_spawn`.

Configuracao:

```json5
{
  agents: {
    defaults: {
      sandbox: {
        // default: "spawned"
        sessionToolsVisibility: "spawned", // or "all"
      },
    },
  },
}
```
