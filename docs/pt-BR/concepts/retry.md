---
summary: "Politica de retry para chamadas de provedores de saida"
read_when:
  - Atualizando o comportamento ou os padroes de retry do provedor
  - Depurando erros de envio do provedor ou limites de taxa
title: "Politica de Retry"
x-i18n:
  source_path: concepts/retry.md
  source_hash: 55bb261ff567f46c
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:55:53Z
---

# Politica de retry

## Objetivos

- Fazer retry por requisicao HTTP, nao por fluxo de varias etapas.
- Preservar a ordem fazendo retry apenas da etapa atual.
- Evitar a duplicacao de operacoes nao idempotentes.

## Padroes

- Tentativas: 3
- Limite maximo de atraso: 30000 ms
- Jitter: 0.1 (10 por cento)
- Padroes do provedor:
  - Atraso minimo do Telegram: 400 ms
  - Atraso minimo do Discord: 500 ms

## Comportamento

### Discord

- Faz retry apenas em erros de limite de taxa (HTTP 429).
- Usa `retry_after` quando disponivel; caso contrario, backoff exponencial.

### Telegram

- Faz retry em erros transitorios (429, timeout, connect/reset/closed, temporariamente indisponivel).
- Usa `retry_after` quando disponivel; caso contrario, backoff exponencial.
- Erros de parse de Markdown nao sao reexecutados; fazem fallback para texto simples.

## Configuracao

Defina a politica de retry por provedor em `~/.openclaw/openclaw.json`:

```json5
{
  channels: {
    telegram: {
      retry: {
        attempts: 3,
        minDelayMs: 400,
        maxDelayMs: 30000,
        jitter: 0.1,
      },
    },
    discord: {
      retry: {
        attempts: 3,
        minDelayMs: 500,
        maxDelayMs: 30000,
        jitter: 0.1,
      },
    },
  },
}
```

## Notas

- Retries se aplicam por requisicao (envio de mensagem, upload de midia, reacao, enquete, figurinha).
- Fluxos compostos nao fazem retry de etapas concluidas.
