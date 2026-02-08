---
summary: "Endurecimento da allowlist do Telegram: normalizacao de prefixo + espacos em branco"
read_when:
  - Revisando alteracoes historicas da allowlist do Telegram
title: "Endurecimento da Allowlist do Telegram"
x-i18n:
  source_path: experiments/plans/group-policy-hardening.md
  source_hash: a2eca5fcc8537694
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:56:06Z
---

# Endurecimento da Allowlist do Telegram

**Data**: 2026-01-05  
**Status**: Concluido  
**PR**: #216

## Resumo

As allowlists do Telegram agora aceitam os prefixos `telegram:` e `tg:` sem diferenciar maiusculas/minusculas e toleram
espacos em branco acidentais. Isso alinha as verificacoes de allowlist de entrada com a normalizacao de envio de saida.

## O que mudou

- Os prefixos `telegram:` e `tg:` sao tratados da mesma forma (sem diferenciar maiusculas/minusculas).
- As entradas da allowlist sao aparadas; entradas vazias sao ignoradas.

## Exemplos

Todos estes sao aceitos para o mesmo ID:

- `telegram:123456`
- `TG:123456`
- `tg:123456`

## Por que isso importa

Copiar/colar de logs ou IDs de chat frequentemente inclui prefixos e espacos em branco. A normalizacao evita
falsos negativos ao decidir se deve responder em Mensagens diretas ou grupos.

## Documentos relacionados

- [Group Chats](/concepts/groups)
- [Telegram Provider](/channels/telegram)
