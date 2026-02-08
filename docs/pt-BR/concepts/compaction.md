---
summary: "Janela de contexto + compactacao: como o OpenClaw mantem sessoes dentro dos limites do modelo"
read_when:
  - Voce quer entender a auto-compactacao e o /compact
  - Voce esta depurando sessoes longas que atingem limites de contexto
title: "Compactacao"
x-i18n:
  source_path: concepts/compaction.md
  source_hash: e1d6791f2902044b
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:55:53Z
---

# Janela de Contexto & Compactacao

Todo modelo tem uma **janela de contexto** (maximo de tokens que ele consegue ver). Chats de longa duracao acumulam mensagens e resultados de ferramentas; quando a janela fica apertada, o OpenClaw **compacta** o historico mais antigo para permanecer dentro dos limites.

## O que e compactacao

A compactacao **resume conversas mais antigas** em uma entrada de resumo compacta e mantem as mensagens recentes intactas. O resumo e armazenado no historico da sessao, de modo que solicitacoes futuras usem:

- O resumo de compactacao
- Mensagens recentes apos o ponto de compactacao

A compactacao **persiste** no historico JSONL da sessao.

## Configuracao

Veja [Configuracao e modos de compactacao](/concepts/compaction) para as configuracoes `agents.defaults.compaction`.

## Auto-compactacao (ativada por padrao)

Quando uma sessao se aproxima ou excede a janela de contexto do modelo, o OpenClaw aciona a auto-compactacao e pode tentar novamente a solicitacao original usando o contexto compactado.

Voce vera:

- `🧹 Auto-compaction complete` no modo verboso
- `/status` mostrando `🧹 Compactions: <count>`

Antes da compactacao, o OpenClaw pode executar um turno de **descarga silenciosa de memoria** para armazenar notas duraveis em disco. Veja [Memoria](/concepts/memory) para detalhes e configuracao.

## Compactacao manual

Use `/compact` (opcionalmente com instrucoes) para forcar uma passagem de compactacao:

```
/compact Focus on decisions and open questions
```

## Fonte da janela de contexto

A janela de contexto e especifica do modelo. O OpenClaw usa a definicao do modelo do catalogo de provedores configurado para determinar os limites.

## Compactacao vs poda

- **Compactacao**: resume e **persiste** em JSONL.
- **Poda de sessao**: remove apenas **resultados de ferramentas** antigos, **em memoria**, por solicitacao.

Veja [/concepts/session-pruning](/concepts/session-pruning) para detalhes de poda.

## Dicas

- Use `/compact` quando as sessoes parecerem estagnadas ou o contexto estiver inchado.
- Saidas grandes de ferramentas ja sao truncadas; a poda pode reduzir ainda mais o acumulo de resultados de ferramentas.
- Se voce precisa de uma folha em branco, `/new` ou `/reset` inicia um novo id de sessao.
