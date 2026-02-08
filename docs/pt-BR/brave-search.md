---
summary: "Configuracao da API do Brave Search para web_search"
read_when:
  - Voce quer usar o Brave Search para web_search
  - Voce precisa de um BRAVE_API_KEY ou de detalhes do plano
title: "Brave Search"
x-i18n:
  source_path: brave-search.md
  source_hash: cdcb037b092b8a10
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:55:12Z
---

# API do Brave Search

O OpenClaw usa o Brave Search como o provedor padrao para `web_search`.

## Obtenha uma chave de API

1. Crie uma conta da API do Brave Search em https://brave.com/search/api/
2. No painel, escolha o plano **Data for Search** e gere uma chave de API.
3. Armazene a chave na configuracao (recomendado) ou defina `BRAVE_API_KEY` no ambiente do Gateway.

## Exemplo de configuracao

```json5
{
  tools: {
    web: {
      search: {
        provider: "brave",
        apiKey: "BRAVE_API_KEY_HERE",
        maxResults: 5,
        timeoutSeconds: 30,
      },
    },
  },
}
```

## Notas

- O plano Data for AI **nao** e compativel com `web_search`.
- O Brave oferece um nivel gratuito alem de planos pagos; verifique o portal da API do Brave para os limites atuais.

Veja [Web tools](/tools/web) para a configuracao completa do web_search.
