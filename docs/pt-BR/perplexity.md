---
summary: "Configuracao do Perplexity Sonar para web_search"
read_when:
  - Voce quer usar o Perplexity Sonar para busca na web
  - Voce precisa do PERPLEXITY_API_KEY ou de configuracao do OpenRouter
title: "Perplexity Sonar"
x-i18n:
  source_path: perplexity.md
  source_hash: 264d08e62e3bec85
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:56:44Z
---

# Perplexity Sonar

O OpenClaw pode usar o Perplexity Sonar para a ferramenta `web_search`. Voce pode se conectar
pela API direta do Perplexity ou via OpenRouter.

## Opcoes de API

### Perplexity (direto)

- URL base: https://api.perplexity.ai
- Variavel de ambiente: `PERPLEXITY_API_KEY`

### OpenRouter (alternativa)

- URL base: https://openrouter.ai/api/v1
- Variavel de ambiente: `OPENROUTER_API_KEY`
- Oferece suporte a creditos prepagos/cripto.

## Exemplo de configuracao

```json5
{
  tools: {
    web: {
      search: {
        provider: "perplexity",
        perplexity: {
          apiKey: "pplx-...",
          baseUrl: "https://api.perplexity.ai",
          model: "perplexity/sonar-pro",
        },
      },
    },
  },
}
```

## Mudando do Brave

```json5
{
  tools: {
    web: {
      search: {
        provider: "perplexity",
        perplexity: {
          apiKey: "pplx-...",
          baseUrl: "https://api.perplexity.ai",
        },
      },
    },
  },
}
```

Se ambos `PERPLEXITY_API_KEY` e `OPENROUTER_API_KEY` estiverem definidos, defina
`tools.web.search.perplexity.baseUrl` (ou `tools.web.search.perplexity.apiKey`)
para desambiguar.

Se nenhuma URL base estiver definida, o OpenClaw escolhe um padrao com base na origem da chave de API:

- `PERPLEXITY_API_KEY` ou `pplx-...` → Perplexity direto (`https://api.perplexity.ai`)
- `OPENROUTER_API_KEY` ou `sk-or-...` → OpenRouter (`https://openrouter.ai/api/v1`)
- Formatos de chave desconhecidos → OpenRouter (fallback seguro)

## Modelos

- `perplexity/sonar` — perguntas e respostas rapidas com busca na web
- `perplexity/sonar-pro` (padrao) — raciocinio em multiplas etapas + busca na web
- `perplexity/sonar-reasoning-pro` — pesquisa aprofundada

Veja [Ferramentas da web](/tools/web) para a configuracao completa de web_search.
