---
summary: "Superficies de acompanhamento de uso e requisitos de credenciais"
read_when:
  - Voce esta conectando superficies de uso/cota do provedor
  - Voce precisa explicar o comportamento do acompanhamento de uso ou os requisitos de autenticacao
title: "Acompanhamento de Uso"
x-i18n:
  source_path: concepts/usage-tracking.md
  source_hash: 6f6ed2a70329b2a6
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:56:05Z
---

# Acompanhamento de uso

## O que é

- Puxa o uso/cota do provedor diretamente dos endpoints de uso.
- Sem custos estimados; apenas as janelas reportadas pelo provedor.

## Onde aparece

- `/status` nos chats: cartão de status rico em emojis com tokens da sessao + custo estimado (somente chave de API). O uso do provedor aparece para o **provedor de modelo atual** quando disponível.
- `/usage off|tokens|full` nos chats: rodape de uso por resposta (OAuth mostra apenas tokens).
- `/usage cost` nos chats: resumo de custos local agregado a partir dos logs de sessao do OpenClaw.
- CLI: `openclaw status --usage` imprime um detalhamento completo por provedor.
- CLI: `openclaw channels list` imprime o mesmo snapshot de uso junto com a configuracao do provedor (use `--no-usage` para pular).
- Barra de menus do macOS: secao “Uso” em Contexto (somente se disponivel).

## Provedores + credenciais

- **Anthropic (Claude)**: tokens OAuth em perfis de autenticacao.
- **GitHub Copilot**: tokens OAuth em perfis de autenticacao.
- **Gemini CLI**: tokens OAuth em perfis de autenticacao.
- **Antigravity**: tokens OAuth em perfis de autenticacao.
- **OpenAI Codex**: tokens OAuth em perfis de autenticacao (accountId usado quando presente).
- **MiniMax**: chave de API (chave do plano de codificacao; `MINIMAX_CODE_PLAN_KEY` ou `MINIMAX_API_KEY`); usa a janela de plano de codificacao de 5 horas.
- **z.ai**: chave de API via variaveis de ambiente/configuracao/armazenamento de autenticacao.

O uso fica oculto se nao existirem credenciais OAuth/API correspondentes.
